import mongoose from 'mongoose';
import { runScenario } from '../services/scenarioRunnerService.js';
import * as neo4jService from '../services/neo4jService.js';
import { ScenarioEventLog } from '../models/scenario_models.js';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/storyteller_db';
const OUTPUT_DIR = './outputs';

async function simulateGame(seed) {
    const sessionId = `sim_${Date.now()}`;
    const outputDir = path.join(OUTPUT_DIR, sessionId);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log(`\n=== INITIALIZING SIMULATION: ${sessionId} ===`);
    console.log(`Seed: "${seed}"\n`);

    // 1. Initial Seeding & Storyteller Acquisition
    const initConfig = {
        sessionId,
        fragment: seed,
        players: { count: 3 },
        universe: { generate_storytellers: true },
        steps: [
            { id: 'init_entities', action: 'ENTITY_DEEPENING', target_entity_id: 'auto' },
            { id: 'acquire_s1', action: 'ACQUIRE_STORYTELLER', player_seat: 0, target_storyteller_id: 'auto' },
            { id: 'acquire_s2', action: 'ACQUIRE_STORYTELLER', player_seat: 1, target_storyteller_id: 'auto' },
            { id: 'acquire_s3', action: 'ACQUIRE_STORYTELLER', player_seat: 2, target_storyteller_id: 'auto' }
        ]
    };

    console.log('[Simulation] Phase 1: Seeding and Onboarding...');
    await runScenario(initConfig);

    // 2. Evolutionary Cycles (Growth to reach 10+ entities/cluster)
    const CYCLES = 12;
    for (let i = 1; i <= CYCLES; i++) {
        console.log(`\n[Simulation] Phase 2: Cycle ${i}/${CYCLES}...`);

        // Fetch current entities to help "auto" resolution if it fails
        const snapshot = await neo4jService.exportGraphSnapshot(sessionId);
        const entityNodes = snapshot.nodes.filter(n => n.labels.includes('Entity'));
        const entityIds = entityNodes.map(n => n.properties.entityId || n.properties.slug);

        const randomTarget = entityIds.length > 0 ? entityIds[Math.floor(Math.random() * entityIds.length)] : 'auto';

        const cycleSteps = [];
        const playerSeat = (i - 1) % 3;

        if (i <= 5) {
            // Early growth: Deepen multiple entities
            cycleSteps.push({
                id: `c${i}_deepen`,
                action: 'ENTITY_DEEPENING',
                player_seat: playerSeat,
                target_entity_id: randomTarget
            });
        } else {
            // Strengthening connections
            const sourceId = randomTarget;
            const targetId = entityIds.find(id => id !== sourceId) || 'auto';

            cycleSteps.push({
                id: `c${i}_connect`,
                action: 'PLACE_AND_CONNECT',
                player_seat: playerSeat,
                source_card_id: sourceId,
                target_card_id: targetId
            });

            // Late game thickening
            if (i % 2 === 0 || i > 10) {
                cycleSteps.push({
                    id: `c${i}_deepen_extra`,
                    action: 'ENTITY_DEEPENING',
                    player_seat: (playerSeat + 1) % 3,
                    target_entity_id: 'auto'
                });
            }
        }

        // Run without full config to avoid duplicate key errors on Arena
        await runScenario({
            sessionId,
            steps: cycleSteps,
            mock: true
        });
    }

    // 3. Final Report Generation
    console.log('\n[Simulation] Generating Final Report...');
    const logs = await ScenarioEventLog.find({ sessionId }).sort({ createdAt: 1 });
    const graphSnapshot = await neo4jService.exportGraphSnapshot(sessionId);

    // Narrativize the graph
    const narrativeStory = narrativizeGraph(graphSnapshot);

    const entityNodes = graphSnapshot.nodes.filter(n => n.labels.includes('Entity'));

    let reportMd = `# Simulation Report: ${sessionId}\n\n`;
    reportMd += `> **Session ID**: \`${sessionId}\`\n\n`;
    reportMd += `**Initial Seed**: ${seed}\n`;
    reportMd += `**Total Cycles**: ${CYCLES}\n`;
    reportMd += `**Total Entities**: ${entityNodes.length}\n`;
    reportMd += `**Total Relationships**: ${graphSnapshot.relationships.length}\n\n`;

    reportMd += `## The Story of the Cluster\n\n`;
    reportMd += `${narrativeStory}\n\n`;

    reportMd += `## Created Entities\n\n`;
    entityNodes.forEach(node => {
        const props = node.properties;
        reportMd += `*   **${props.name || props.slug || props.entityId}** (${props.type || 'ENTITY'}): ${props.description || '...'}\n`;
    });
    reportMd += `\n`;

    reportMd += `## API Audit Trail (Reasoning Log)\n\n`;
    reportMd += `| Step | Action | AI Reasoning | Outcome Summary |\n`;
    reportMd += `| :--- | :--- | :--- | :--- |\n`;

    for (const log of logs) {
        let reasoning = 'N/A';
        let summary = log.outputsSummary || 'Completed';

        try {
            const out = JSON.parse(log.outputsSummary);
            if (out.reasoning) reasoning = out.reasoning;
            else if (Array.isArray(out)) {
                reasoning = out.map(item => item.reasoning).filter(r => r).join('; ');
            }
            else if (out.sprout_entities) {
                reasoning = out.reasoning || out.sprout_entities.map(s => s.reasoning).filter(r => r).join('; ');
            }
            summary = out.status || out.outcome || (out.improved_description ? 'Deepened' : 'Success');
        } catch (e) { }

        reportMd += `| ${log.stepId} | ${log.action} | ${reasoning} | ${summary} |\n`;
    }

    reportMd += `\n## Narrative Audit Trace (Chronological Journal)\n\n`;
    reportMd += `This section traces the exact flow of intent and reasoning for every major decision in the session.\n\n`;
    for (const log of logs) {
        if (log.formattedTrace) {
            reportMd += `> **[${log.stepId}]** ${log.formattedTrace}\n\n`;
        }
    }

    reportMd += `\n## Cluster Retrieval (Cypher)\n\n`;
    reportMd += `To retrieve this cluster manually in Neo4j, use the following query:\n\n`;
    reportMd += `\`\`\`cypher\n`;
    reportMd += `MATCH (e:Entity {sessionId: "${sessionId}"})\n`;
    reportMd += `OPTIONAL MATCH (e)-[r:RELATES_TO]-(connected)\n`;
    reportMd += `WHERE connected.sessionId = "${sessionId}"\n`;
    reportMd += `RETURN e, r, connected\n`;
    reportMd += `\`\`\`\n\n`;

    reportMd += `## Graph Cluster Metrics\n\n`;
    reportMd += `The session resulted in a graph of **${entityNodes.length}** entities.\n`;
    if (entityNodes.length >= 10) {
        reportMd += `> [!NOTE]\n> Objective Achieved: Graph density exceeds 10 entities for the primary cluster.\n`;
    }

    const reportPath = path.join(outputDir, 'simulation_report.md');
    fs.writeFileSync(reportPath, reportMd);
    console.log(`Report saved to: ${reportPath}`);

    return reportPath;
}

/**
 * Turns a graph snapshot into a short narrative paragraph.
 */
function narrativizeGraph(snapshot) {
    const entityNodes = snapshot.nodes.filter(n => n.labels.includes('Entity'));
    if (!entityNodes.length) return "The world remains empty.";

    const rels = snapshot.relationships;
    const startNode = entityNodes[0];
    let story = `The tapestry began with **${startNode.properties.name || startNode.properties.slug}**. `;

    const relBySource = {};
    rels.forEach(r => {
        if (!relBySource[r.start]) relBySource[r.start] = [];
        relBySource[r.start].push(r);
    });

    const seenNodes = new Set([startNode.id]);

    const findNodeById = (id) => snapshot.nodes.find(n => n.id === id);

    entityNodes.forEach((node) => {
        const nodeRels = relBySource[node.id] || [];
        nodeRels.forEach(r => {
            const target = findNodeById(r.end);
            if (target && target.labels.includes('Entity') && !seenNodes.has(target.id)) {
                const predicate = r.type || 'connected to';
                const text = r.props?.surfaceText || `was ${predicate.toLowerCase().replace(/_/g, ' ')}`;
                story += `From ${node.properties.name || node.properties.slug}, it ${text} **${target.properties.name || target.properties.slug}**. `;
                seenNodes.add(target.id);
            }
        });
    });

    entityNodes.forEach(node => {
        if (!seenNodes.has(node.id)) {
            const name = node.properties.name || node.properties.slug;
            const desc = node.properties.description ? node.properties.description.split('.')[0] : 'an enigmatic presence';
            story += `In the periphery, **${name}** was also observed, ${desc}. `;
            seenNodes.add(node.id);
        }
    });

    return story;
}

async function main() {
    const seed = process.argv[2] || "The Iron-Bound Door stands in the center of the Forbidden Grove.";

    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
            console.log('MongoDB connected');
        }

        const reportPath = await simulateGame(seed);
        console.log(`\nSimulation Complete. Review results at:\n${reportPath}`);

    } catch (err) {
        console.error('Simulation Failed:', err);
    } finally {
        await mongoose.connection.close();
        await neo4jService.closeNeo4j();
    }
}

main();


import { runScenario } from '../services/scenarioRunnerService.js';
import * as neo4jService from '../services/neo4jService.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/storyteller_db';

// --- CLI ARGUMENT PARSING ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        sessionId: null,
        seed: null,
        cycles: 6
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--session' && args[i + 1]) config.sessionId = args[++i];
        else if (arg === '--seed' && args[i + 1]) config.seed = args[++i];
        else if (arg === '--cycles' && args[i + 1]) config.cycles = parseInt(args[++i], 10);
    }
    return config;
}

async function runEvolutionaryLoop() {
    // 0. Setup
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
        console.log('MongoDB connected');
    }

    const config = parseArgs();

    // 1. Session & Seed Configuration
    const USER_SEED = `It was still night as she rose from her bed, though she didn't sleep at all that night. Others stirred too, their movements precise, practiced. There was still time, at least 2 hours before their morning walking meditation in the misty pine forest surrounding their monastery, yet the gong sound was heard. Her bare feet found the familiar softness of her walking shoes beneath the bed. She reached down her bed. A small simple wooden box. She opened it. Two vials were inside, each one containing different colored liquid; one golden orange almost the color of sunset and one crystal blue. Others glanced at their boxes as well. But it was forbidden to show which colors you got today. Let alone telling what you drank.\n\nThrough her window, the obelisk's peak disappeared into swirling snow. A sound carried through the storm - not quite bird, not quite wind. Only Master Chen's expression changed, slightly, at the sound. His fingers, selecting his vial, trembled almost imperceptibly.`;

    // Use CLI seed or default
    let currentSeed = config.seed || USER_SEED;

    // Use CLI session or generate new one
    const MASTER_SESSION_ID = config.sessionId || `gen_${Date.now()}_monastery`;

    console.log(`\n=== CONFIGURATION ===`);
    console.log(`SESSION ID: ${MASTER_SESSION_ID}`);
    console.log(`CYCLES    : ${config.cycles}`);
    console.log(`SEED      : "${currentSeed.slice(0, 50)}..."\n`);

    let history = [];

    // 2. The Evolutionary Loop
    console.log(`\n=== STARTING EVOLUTIONARY RUN ===\n`);

    for (let i = 1; i <= config.cycles; i++) {
        console.log(`\n--- CYCLE ${i}/${config.cycles} ---`);
        console.log(`NARRATIVE SEED: "${currentSeed.slice(0, 80)}..."`);

        const runConfig = {
            sessionId: MASTER_SESSION_ID, // Use the persistent ID
            fragment: currentSeed,
            players: { count: 1 },
            steps: [], // Will be populated dynamically
            // Only generate initial assets (Storytellers/Memories) on the FIRST cycle
            universe: { generate_storytellers: true }
        };

        // Randomly decide action for this cycle
        // Cycle 1: Always Deepen to establish a base
        const isDeepening = (i === 1) || (Math.random() > 0.5);
        const actionType = isDeepening ? 'ENTITY_DEEPENING' : 'PLACE_AND_CONNECT';

        console.log(`[Cycle ${i}] Decision: ${actionType === 'ENTITY_DEEPENING' ? 'DEEPEN EXISTING ENTITY' : 'CONNECT AND SPROUT'}`);

        if (actionType === 'ENTITY_DEEPENING') {
            runConfig.steps.push({ id: `deepen_cycle_${i}`, action: 'ENTITY_DEEPENING', target_entity_id: 'auto' });
        } else {
            runConfig.steps.push({ id: `connect_cycle_${i}`, action: 'PLACE_AND_CONNECT', source_card_id: 'auto' });
        }

        try {
            const result = await runScenario(runConfig);

            // Metrics and Logging
            const physics = result.evolutionBridge?.physics || { totalMass: 0, bindingEnergy: 0, density: 0 };

            // Parse Event Log for Sprouts
            let deepenedOut = {};
            try {
                const deepenEvent = result.eventLog.find(e => e.action === 'ENTITY_DEEPENING' || e.stepId === `deepen_cycle_${i}`);
                const summary = deepenEvent?.outputsSummary;
                if (summary && typeof summary === 'string' && summary.startsWith('{')) {
                    deepenedOut = JSON.parse(summary);
                } else if (typeof summary === 'object') {
                    deepenedOut = summary;
                }
            } catch (e) {
                console.warn("Log parse warning:", e.message);
            }

            const sproutedName = deepenedOut?.sprout_entities?.[0]?.name || 'Nothing Sprouted';
            const newTraits = deepenedOut?.new_traits || [];

            history.push({
                cycle: i,
                seedUsed: currentSeed,
                mass: physics.totalMass,
                energy: physics.bindingEnergy,
                sproutedEntity: sproutedName,
                newProperties: newTraits.join(', ')
            });

            // Handoff to Next Cycle
            if (result.evolutionBridge?.nextIterationSeed) {
                currentSeed = result.evolutionBridge.nextIterationSeed;
            } else {
                console.warn("WARNING: No new seed generated. Evolution halted on this branch.");
            }

        } catch (error) {
            console.error(`ERROR IN CYCLE ${i}:`, error);
        }
    }

    // 3. Final Report & Export
    console.log(`\n\n=== FINAL EVOLUTIONARY REPORT ===\n`);
    console.table(history.map(h => ({
        Cycle: h.cycle,
        "Mass": h.mass,
        "Energy": h.energy.toFixed(2),
        "Sprout": h.sproutedEntity
    })));

    // 4. Data Export (The User's "First Wish")
    console.log(`\n--- EXPORTING DATA ---`);
    const sessionDir = path.join(process.cwd(), 'outputs', MASTER_SESSION_ID);
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Save the narrative history (Seed Evolution)
    const logPath = path.join(sessionDir, 'narrative_log.md');
    const logContent = `# Narrative Evolution Log\nSession: ${MASTER_SESSION_ID}\n\n` +
        history.map(h => `## Cycle ${h.cycle}\n**Seed**: ${h.seedUsed}\n**Sprout**: ${h.sproutedEntity}\n`).join('\n');
    fs.writeFileSync(logPath, logContent);
    console.log(`Saved Narrative Log: ${logPath}`);

    // Query Neo4j for ALL Entities
    try {
        const session = neo4jService.getSession(); // Use raw driver if needed, or open a session from service helper
        // Since getSession returns a driver session directly
        const result = await session.run(
            `MATCH (e:Entity {sessionId: $sid})
             OPTIONAL MATCH (e)-[r]->(t:Entity)
             RETURN e, collect(r) as rels, collect(t) as targets`,
            { sid: MASTER_SESSION_ID }
        );

        const entities = result.records.map(rec => {
            const ent = rec.get('e').properties;
            const rels = rec.get('rels');
            const targets = rec.get('targets');

            // Format relationships for JSON
            const relationships = rels.map((r, idx) => ({
                type: r.type,
                target: targets[idx].properties.slug || targets[idx].properties.entityId,
                props: r.properties
            }));

            return {
                ...ent,
                relationships
            };
        });

        const dumpPath = path.join(sessionDir, 'world_graph.json');
        fs.writeFileSync(dumpPath, JSON.stringify(entities, null, 2));
        console.log(`Saved Full Graph Dump: ${dumpPath}`);
        console.log(`Total Entities Retrieved: ${entities.length}`);

        await session.close();

    } catch (err) {
        console.error("Failed to export Neo4j data:", err);
    }

    // Cleanup
    await neo4jService.closeNeo4j();
    process.exit(0);
}

if (process.argv[1].endsWith('evolution_loop_runner.js')) {
    runEvolutionaryLoop().catch(console.error);
}

/**
 * Agent Reflection Service
 * 
 * Generates post-run understanding updates and recommendations
 * based on analysis of LLM samples and event logs.
 */

import { LLMSample, AgentUnderstanding, Recommendation, ScenarioEventLog } from '../models/scenario_models.js';
import { calculateClusterMetrics } from './neo4jService.js';

/**
 * Generate an updated understanding document based on the run.
 * 
 * @param {object|null} priorUnderstanding - Previous understanding doc
 * @param {Array} relationshipCatalog - Current relationship patterns from Neo4j
 * @param {string} sessionId - Current session ID
 * @returns {Promise<object>}
 */
export async function generateUnderstanding(priorUnderstanding, relationshipCatalog, sessionId) {
    // Analyze this session's samples and events
    const sessionSamples = await LLMSample.find({ sessionId }).lean();
    const eventLog = await ScenarioEventLog.find({ sessionId }).lean();

    const highQualitySamples = sessionSamples.filter(s => (s.qualityScore || 0) >= 0.5);

    // 1) Analyze samples for new themes 
    const newThemes = [];
    highQualitySamples.forEach(s => {
        if (Array.isArray(s.output)) {
            s.output.forEach(ent => {
                if (ent.description) {
                    const words = ent.description.toLowerCase().match(/\b(\w{5,})\b/g) || [];
                    newThemes.push(...words);
                }
            });
        }
    });

    if (newThemes.length > 0) {
        console.log(`[Reflection] Found themes in session ${sessionId.slice(-8)}: ${newThemes.slice(0, 5).join(', ')}...`);
    }

    // 2) Update definitions based on themes
    const updatedDefinitions = {
        memories: priorUnderstanding?.definitions?.memories || 'Emotional residue tied to narrative fragments.',
        entities: priorUnderstanding?.definitions?.entities || 'Named elements: characters, locations, objects.',
        storytellers: priorUnderstanding?.definitions?.storytellers || 'Narrative voices that investigate and reveal.',
        relationships: priorUnderstanding?.definitions?.relationships || 'Graph edges with semantic predicates.'
    };

    if (newThemes.length > 0) {
        const topTheme = newThemes[0]; // Take the freshest theme
        updatedDefinitions.entities = `${updatedDefinitions.entities} Current dominant theme: ${topTheme}.`.slice(-250);
    }

    const newVersion = (priorUnderstanding?.version || 0) + 1;
    const topPatterns = (relationshipCatalog || []).slice(0, 10).map(r => ({
        pattern: r.type,
        frequency: r.count,
        examples: []
    }));

    const successfulSteps = eventLog.filter(e => e.success).length;
    const sessionPrinciple = `Session ${sessionId.slice(-8)}: ${sessionSamples.length} samples, ${successfulSteps} successful steps.`;

    const avgQuality = sessionSamples.length > 0
        ? sessionSamples.reduce((sum, s) => sum + (s.qualityScore || 0.5), 0) / sessionSamples.length
        : 0.5;

    return {
        sessionId,
        version: newVersion,
        definitions: updatedDefinitions,
        principles: [
            ...(priorUnderstanding?.principles || []),
            sessionPrinciple,
            avgQuality >= 0.7
                ? `Quality maintained above 70% (avg: ${(avgQuality * 100).toFixed(1)}%)`
                : `Quality needs improvement (avg: ${(avgQuality * 100).toFixed(1)}%)`
        ].slice(-20),
        relationshipPatterns: topPatterns
    };
}

/**
 * Generate an evolutionary bridge from the current session to the next.
 * Synthesizes the results into a new seed and specific LLM guidance.
 */
export async function generateEvolutionaryBridge(sessionId, understanding) {
    const sessionSamples = await LLMSample.find({ sessionId }).sort({ createdAt: -1 }).lean();

    // Extract the most interesting recent developments
    const recentDeepening = sessionSamples.find(s => s.moduleName === 'deepen_entity');
    const recentConsequences = sessionSamples.find(s => s.moduleName === 'generate_choice_consequences');

    let nextSeed = "The world remains in a state of potential.";
    let guidance = "Maintain narrative consistency with established entities.";

    // Calculate Narrative Physics
    const physics = await calculateClusterMetrics(sessionId);

    // Narrativize the physics state
    const physicsReport = `Narrative Mass: ${physics.totalMass}. Binding Energy: ${physics.bindingEnergy.toFixed(2)}. Density: ${physics.density.toFixed(2)}.`;

    if (recentDeepening) {
        const out = recentDeepening.output;
        // Continuity Logic: Explicitly frame as a continuation
        nextSeed = `Chapter 2: The Evolving Truth. Following the investigation of ${out.slug}, which revealed ${out.sprout_entities?.[0]?.name}, the world has grown denser (${physics.density.toFixed(2)} density). The investigation established that ${out.improved_description.slice(0, 100)}...`;
        guidance = `Maintain the newly established density. Ensure ${out.slug} remains central while expanding on its new Sprouts.`;
    } else if (recentConsequences) {
        nextSeed = `Chapter 2: Ripples of Consequence. ${recentConsequences.output.narrative_outcome}`;
        guidance = "Follow the ripples caused by the player's last choice.";
    }

    return {
        nextIterationSeed: nextSeed,
        instructionalGuidance: guidance,
        brainVersion: understanding.version,
        physics: physics
    };
}

/**
 * Propose the next scenario to run based on current understanding.
 */
export async function proposeNextScenario(understanding) {
    const theme = (understanding.definitions?.entities || '').split('theme: ')[1] || 'mysterious';
    const fragment = `The evolving reality of ${theme} where new entities emerge and relationships tighten.`;

    return {
        name: `Evolution Cycle (Brain v${understanding.version})`,
        fragment,
        players: { count: 1 },
        steps: [
            { id: 'deepen_discovery', action: 'ENTITY_DEEPENING', target_entity_id: 'auto' },
            { id: 'connect_new', action: 'PLACE_AND_CONNECT', source_card_id: 'auto' }
        ]
    };
}

/**
 * Generate recommendations based on run analysis.
 * 
 * @param {string} sessionId - Current session ID
 * @param {Array} relationshipCatalog - Current relationship patterns
 * @param {object} config - Scenario configuration
 * @returns {Promise<Array>}
 */
export async function generateRecommendations(sessionId, relationshipCatalog, config) {
    const recommendations = [];
    const samples = await LLMSample.find({ sessionId }).lean();
    const eventLog = await ScenarioEventLog.find({ sessionId }).lean();

    // Analyze for failed steps
    const failedSteps = eventLog.filter(e => !e.success);
    if (failedSteps.length > 0) {
        const actions = [...new Set(failedSteps.map(f => f.action))];
        recommendations.push({
            sessionId,
            category: 'code_change',
            priority: 'high',
            description: `${failedSteps.length} step(s) failed in this run: ${actions.join(', ')}`,
            affectedModule: failedSteps[0]?.action,
            rationale: 'Step failures indicate potential bugs or missing handlers'
        });
    }

    // Check for low-quality samples
    const lowQuality = samples.filter(s => (s.qualityScore || 0) < 0.5);
    if (lowQuality.length > 0) {
        const moduleCounts = {};
        lowQuality.forEach(s => {
            moduleCounts[s.moduleName] = (moduleCounts[s.moduleName] || 0) + 1;
        });

        for (const [mod, count] of Object.entries(moduleCounts)) {
            recommendations.push({
                sessionId,
                category: 'prompt_improvement',
                priority: count > 3 ? 'high' : 'medium',
                description: `${count} low-quality outputs for module ${mod}`,
                affectedModule: mod,
                rationale: 'Consider refining prompts or mock generation logic'
            });
        }
    }

    // Check for missing modules (steps that should have called LLM but didn't generate samples)
    const expectedModules = new Set();
    for (const step of eventLog) {
        if (step.action === 'PLACE_AND_CONNECT' || step.action === 'CONNECT_ONLY') {
            expectedModules.add('validate_connection');
        }
        if (step.action === 'SEND_STORYTELLER') {
            expectedModules.add('storyteller_investigate');
        }
    }

    const sampledModules = new Set(samples.map(s => s.moduleName));
    for (const expected of expectedModules) {
        if (!sampledModules.has(expected)) {
            recommendations.push({
                sessionId,
                category: 'code_change',
                priority: 'medium',
                description: `Expected module ${expected} was not called during execution`,
                affectedModule: expected,
                rationale: 'Step execution may not be triggering LLM calls correctly'
            });
        }
    }

    // Check relationship diversity
    if (relationshipCatalog && relationshipCatalog.length > 0) {
        const topType = relationshipCatalog[0];
        const secondType = relationshipCatalog[1];
        if (secondType && topType.count > secondType.count * 5) {
            recommendations.push({
                sessionId,
                category: 'prompt_improvement',
                priority: 'low',
                description: `Relationship type "${topType.type}" dominates (${topType.count} vs ${secondType.count} for next most common)`,
                affectedModule: 'validate_connection',
                rationale: 'Consider encouraging more diverse relationship types in prompts'
            });
        }
    }

    return recommendations;
}

/**
 * Save understanding document to MongoDB.
 */
export async function saveUnderstanding(sessionId, understanding) {
    const doc = new AgentUnderstanding({
        ...understanding,
        sessionId
    });
    return await doc.save();
}

/**
 * Save recommendations to MongoDB.
 */
export async function saveRecommendations(sessionId, recommendations) {
    const docs = recommendations.map(r => new Recommendation({
        ...r,
        sessionId
    }));
    if (docs.length > 0) {
        return await Recommendation.insertMany(docs);
    }
    return [];
}

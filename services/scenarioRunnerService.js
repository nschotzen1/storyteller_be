/**
 * Scenario Runner Service
 * 
 * Main execution engine for running game scenarios from JSON configs.
 * Creates session graphs, executes steps, and generates post-run analysis.
 */

import { randomUUID } from 'crypto';
import {
    LLMSample,
    ScenarioEventLog,
    AgentUnderstanding,
    Recommendation
} from '../models/scenario_models.js';
import { Storyteller, Arena } from '../models/models.js';
import * as neo4jService from './neo4jService.js';
import { loadRelationshipCatalog, loadPriorSamples, loadLatestUnderstanding } from './scenarioContextService.js';
import { callLLMOrMock } from './mockLLMService.js';
import {
    generateUnderstanding,
    generateRecommendations,
    saveUnderstanding,
    saveRecommendations,
    generateEvolutionaryBridge
} from './agentReflectionService.js';
import { getSupportedModules } from './llmModuleSchemas.js';
import { calculateClusterMetrics } from './neo4jService.js';

const LLM_MODULES = getSupportedModules();

/**
 * Run a scenario from configuration.
 * 
 * @param {object} config - Scenario configuration
 * @returns {Promise<object>} - Run results including sessionId, graph, eventLog, understanding, recommendations
 */
export async function runScenario(config) {
    const startTime = Date.now();

    // 1) Create new session ID or use provided
    const sessionId = config.sessionId || `scenario_${randomUUID()}`;
    const seed = config.seed || Date.now();

    console.log(`[ScenarioRunner] Starting session ${sessionId}`);

    // 2) Load prior knowledge for context
    const priorRelationshipCatalog = await loadRelationshipCatalog(500);
    const priorSamples = await loadPriorSamples(LLM_MODULES, 50);
    const priorUnderstanding = await loadLatestUnderstanding();

    // 4) Create players
    const playerCount = config.players?.count || 2;
    const players = createPlayers(sessionId, playerCount, seed);

    // 3) Initialize session in Neo4j
    try {
        await neo4jService.initNeo4j();
        await neo4jService.createSession(sessionId, seed, config.fragment);
        await neo4jService.persistPlayers(sessionId, players);
    } catch (err) {
        console.warn('[ScenarioRunner] Neo4j sync failed, continuing without full graph:', err.message);
    }

    // 5) Build context object for LLM calls
    const ctx = {
        sessionId,
        seed,
        fragment: config.fragment,
        relationshipCatalog: priorRelationshipCatalog,
        understanding: priorUnderstanding,
        priorSamples,
        players
    };

    // 6) Generate initial content (memories)
    const memoriesTime = Date.now();
    const memories = await callLLMOrMock('generate_memories', ctx, config);
    await saveSample(sessionId, 'generate_memories', 'init_memories', ctx, memories, config);
    await logEvent(sessionId, 'init_memories', 'GENERATE_MEMORIES', { action: 'GENERATE_MEMORIES' }, JSON.stringify(memories), Date.now() - memoriesTime, true, null, memories._meta?.fullPrompt, memories.map(m => m.reasoning).filter(r => r).join('; '));
    try {
        await neo4jService.createMemories(sessionId, memories);
    } catch (err) {
        console.warn('[ScenarioRunner] Neo4j memory sync failed:', err.message);
    }

    // 7) Generate storyteller pool if configured
    let storytellersPool = [];
    if (config.universe?.generate_storytellers !== false) {
        const stTime = Date.now();
        storytellersPool = await callLLMOrMock('generate_storytellers', ctx, config);
        await saveSample(sessionId, 'generate_storytellers', 'init_storytellers', ctx, storytellersPool, config);
        await logEvent(sessionId, 'init_storytellers', 'GENERATE_STORYTELLERS', { action: 'GENERATE_STORYTELLERS' }, JSON.stringify(storytellersPool), Date.now() - stTime, true, null, storytellersPool._meta?.fullPrompt, storytellersPool.map(s => s.reasoning).filter(r => r).join('; '));
        try {
            await neo4jService.createStorytellers(sessionId, storytellersPool);
        } catch (err) {
            console.warn('[ScenarioRunner] Neo4j storyteller sync failed:', err.message);
        }
    }
    ctx.storytellersPool = storytellersPool;

    // 8) Deal hands to players (generate entities)
    const playerHands = {};
    for (const player of players) {
        const entTime = Date.now();
        const entities = await callLLMOrMock('generate_entities', { ...ctx, player }, config);
        await saveSample(sessionId, 'generate_entities', `deal_p${player.seat}`, { ...ctx, player }, entities, config);
        await logEvent(sessionId, `deal_p${player.seat}`, 'GENERATE_ENTITIES', { action: 'GENERATE_ENTITIES', player_seat: player.seat }, JSON.stringify(entities), Date.now() - entTime, true, null, entities._meta?.fullPrompt, entities.map(e => e.reasoning).filter(r => r).join('; '));
        try {
            await neo4jService.createEntitiesAndDealToPlayer(sessionId, player, entities);
        } catch (err) {
            console.warn('[ScenarioRunner] Neo4j entity sync failed:', err.message);
        }
        playerHands[player.id] = entities;
    }
    ctx.playerHands = playerHands;

    // 8.5) Initial Arena Persistence
    try {
        const initialArena = new Arena({
            sessionId,
            arena: {
                entities: Object.values(playerHands).flat().map(e => ({
                    id: e.id,
                    slug: e.slug,
                    name: e.name,
                    type: e.type,
                    description: e.description,
                    sensory_profile: e.sensory_profile,
                    dynamic_state: e.dynamic_state,
                    traits: e.traits,
                    secrets: e.secrets,
                    narrative_weight: e.narrative_weight
                })),
                storytellers: storytellersPool.map(s => ({
                    name: s.name,
                    style: s.style,
                    level: s.level,
                    experience: s.experience,
                    totalStorytellingPoints: s.totalStorytellingPoints
                })),
                memories: memories.map(m => ({
                    id: m.id || `mem_${m.year}_${randomUUID().slice(0, 4)}`,
                    year: m.year,
                    title: m.title,
                    content: m.content,
                    entities: m.entities, // associated entity slugs/ids
                    location: m.location
                }))
            }
        });
        await initialArena.save();
        console.log(`[ScenarioRunner] Initial Arena persisted for ${sessionId}`);
    } catch (err) {
        console.warn('[ScenarioRunner] Failed to persist initial Arena:', err.message);
    }
    ctx.arena = (await Arena.findOne({ sessionId })).arena; // Link the live arena object

    // 9) Execute step script
    const steps = config.steps || [];
    for (const step of steps) {
        await executeStep(ctx, step, config);
    }

    // 10) Final Reflection & Evolutionary Bridge
    const currentRelationshipCatalog = await loadRelationshipCatalog(500);
    const newUnderstanding = await generateUnderstanding(priorUnderstanding, currentRelationshipCatalog, sessionId);
    const recommendations = await generateRecommendations(sessionId, currentRelationshipCatalog, config);
    const evolutionBridge = await generateEvolutionaryBridge(sessionId, newUnderstanding);

    await saveUnderstanding(sessionId, newUnderstanding);
    await saveRecommendations(sessionId, recommendations);

    // 11) Get final state
    const eventLog = await getEventLog(sessionId);
    let graph = { nodes: [], relationships: [] };
    try {
        graph = await neo4jService.exportGraphSnapshot(sessionId);
    } catch (err) {
        console.warn('[ScenarioRunner] Could not export graph:', err.message);
    }

    const duration = Date.now() - startTime;
    console.log(`[ScenarioRunner] Session ${sessionId} completed in ${duration}ms`);

    return {
        sessionId,
        graph,
        eventLog,
        understanding: newUnderstanding,
        recommendations,
        evolutionBridge,
        duration
    };
}

/**
 * Create player objects for the scenario.
 */
function createPlayers(sessionId, count, seed) {
    const players = [];
    const names = ['Ada', 'Bram', 'Cleo', 'Dax', 'Eve', 'Finn'];

    for (let i = 0; i < count; i++) {
        players.push({
            id: `player_${sessionId.slice(-8)}_${i}`,
            seat: i,
            name: names[i] || `Player${i + 1}`,
            sessionId
        });
    }

    return players;
}

/**
 * Execute a single step in the scenario.
 */
async function executeStep(ctx, step, config) {
    const stepStart = Date.now();
    const stepId = step.id;
    const action = step.action;

    console.log(`[ScenarioRunner] Executing step ${stepId}: ${action}`);

    try {
        // Add step to context for mock resolution
        const stepCtx = { ...ctx, step };

        let output = 'completed';

        switch (action) {
            case 'PLACE_AND_CONNECT':
            case 'CONNECT_ONLY':
                output = await executeConnectionStep(stepCtx, step, config);
                break;

            case 'ACQUIRE_STORYTELLER':
                output = await executeAcquireStoryteller(stepCtx, step, config);
                break;

            case 'SEND_STORYTELLER':
                output = await executeStorytellerMission(ctx, step, config);
                break;
            case 'ENTITY_DEEPENING':
                output = await executeEntityDeepening(ctx, step, config);
                break;
            case 'PLAYER_CHOICE':
                output = await executePlayerChoice(ctx, step, config);
                break;
            default:
                console.warn(`[ScenarioRunner] Unknown action: ${step.action}`);
        }

        let prompt = null;
        let reasoning = null;
        let safeOutput = 'completed';

        if (output && typeof output === 'object') {
            prompt = output._meta?.fullPrompt;
            reasoning = output.reasoning;

            // If output is an array (e.g. generate_entities), check for _meta property
            if (Array.isArray(output)) {
                prompt = output._meta?.fullPrompt;
                reasoning = output.map(item => item.reasoning).filter(r => r).join('; ');
            }

            // Create a clean summary for logging
            const logSummary = { ...output };
            delete logSummary._meta;
            safeOutput = JSON.stringify(logSummary);
        } else {
            safeOutput = output || 'completed';
        }

        await logEvent(ctx.sessionId, stepId, action, step, safeOutput, Date.now() - stepStart, true, null, prompt, reasoning);

    } catch (error) {
        console.error(`[ScenarioRunner] Step ${stepId} failed:`, error.message);
        await logEvent(ctx.sessionId, stepId, action, step, error.message, Date.now() - stepStart, false, error.message);
    }
}

/**
 * Execute a connection step (PLACE_AND_CONNECT or CONNECT_ONLY).
 */
async function executeConnectionStep(ctx, step, config) {
    const playerSeat = step.player_seat || 0;
    const player = ctx.players[playerSeat];
    const hand = ctx.playerHands[player.id] || [];

    // Select source and target cards
    const arenaEntities = ctx.arena?.entities || [];

    let sourceCardId = (step.source_card_id === 'auto' || !step.source_card_id)
        ? hand[0]?.id
        : step.source_card_id;

    // Resolve name/slug to ID if needed
    const sourceEnt = arenaEntities.find(e => e.id === sourceCardId || e.slug === sourceCardId || e.name === sourceCardId);
    if (sourceEnt) sourceCardId = sourceEnt.id;

    let targetCardIds = (step.target_card_ids?.[0] === 'auto' || !step.target_card_ids)
        ? [hand[1]?.id].filter(Boolean)
        : step.target_card_ids || [];

    // Resolve names/slugs to IDs for targets
    targetCardIds = targetCardIds.map(tid => {
        const ent = arenaEntities.find(e => e.id === tid || e.slug === tid || e.name === tid);
        return ent ? ent.id : tid;
    });

    if (!sourceCardId || targetCardIds.length === 0) {
        console.warn('[ScenarioRunner] Not enough cards to connect');
        return;
    }

    // Build connection proposal
    const proposal = {
        sourceCardId,
        targetCardIds,
        relationship: step.relationship || {
            surfaceText: 'is connected to',
            direction: 'source_to_target'
        }
    };

    // Validate via LLM
    const verdict = await callLLMOrMock('validate_connection', { ...ctx, proposal }, config);
    await saveSample(ctx.sessionId, 'validate_connection', step.id, { ...ctx, proposal }, verdict, config);

    if (verdict.verdict === 'accepted') {
        console.log(`[ScenarioRunner] Connection accepted with quality ${verdict.quality?.score}`);
        try {
            // Sync to Neo4j
            await neo4jService.createRelationship(ctx.sessionId, {
                edgeId: `edge_${ctx.sessionId.slice(-8)}_${step.id}`,
                fromCardId: sourceCardId,
                toCardId: targetCardIds[0],
                predicate: verdict.predicate || step.relationship?.surfaceText || 'connected_to',
                surfaceText: step.relationship?.surfaceText || 'connected to',
                direction: step.relationship?.direction || 'source_to_target',
                quality: verdict.quality,
                createdBy: player.id
            });
        } catch (err) {
            console.warn('[ScenarioRunner] Neo4j relationship sync failed:', err.message);
        }

        // Phase 14: Relationship Sprouting
        if (verdict.quality?.score >= 0.7) {
            console.log(`[ScenarioRunner] Strong connection (${verdict.quality.score}). Attempting to sprout new entity...`);
            try {
                const derived = await callLLMOrMock('derive_from_relationship', { ...ctx, proposal, verdict }, config);

                if (derived?.sprout_entities?.length > 0) {
                    await processContextualSprouting(ctx, proposal.sourceCardId, derived.sprout_entities);
                    // Merge derived info into verdict for logging
                    verdict.sprouted = derived.sprout_entities.map(s => s.name);
                    if (derived._meta) verdict._meta_derived = derived._meta;
                }
            } catch (sproutErr) {
                console.warn(`[ScenarioRunner] Failed to sprout from relationship: ${sproutErr.message}`);
            }
        }
        return verdict;
    } else {
        console.log(`[ScenarioRunner] Connection rejected: ${verdict.quality?.reasons?.join(', ')}`);
        return verdict;
    }
}

/**
 * Execute an ACQUIRE_STORYTELLER step.
 */
async function executeAcquireStoryteller(ctx, step, config) {
    const playerSeat = step.player_seat || 0;
    const player = ctx.players[playerSeat];
    const pool = ctx.storytellersPool || [];

    if (pool.length === 0) {
        console.warn('[ScenarioRunner] No storytellers in pool to acquire');
        return;
    }

    // Select first available storyteller (or by ID if specified)
    const storyteller = step.storyteller_id
        ? pool.find(s => s.name === step.storyteller_id || s.id === step.storyteller_id)
        : pool[0];

    if (storyteller) {
        console.log(`[ScenarioRunner] Player ${player.name} acquired storyteller: ${storyteller.name}`);
        // Mark as acquired
        storyteller.acquiredBy = player.id;
    }
}

/**
 * Execute a SEND_STORYTELLER step.
 */
async function executeStorytellerMission(ctx, step, config) {
    const playerSeat = step.player_seat || 0;
    const player = ctx.players[playerSeat];
    const pool = ctx.storytellersPool || [];

    // Find storyteller owned by player
    const storyteller = pool.find(s => s.acquiredBy === player.id) || pool[0];

    if (!storyteller) {
        console.warn('[ScenarioRunner] No storyteller available to send');
        return;
    }

    const assignment = {
        storyteller,
        message: step.message || 'Investigate this mystery.',
        targetEntity: step.target_entity_id
    };

    const report = await callLLMOrMock('storyteller_investigate', { ...ctx, assignment }, config);
    await saveSample(ctx.sessionId, 'storyteller_investigate', step.id, { ...ctx, assignment }, report, config);

    console.log(`[ScenarioRunner] Storyteller investigation: ${report.outcome}`);

    // Award points
    if (report.outcome === 'success') {
        const points = 10;
        console.log(`[ScenarioRunner] Awarding ${points} storytelling points to ${storyteller.name}`);
        storyteller.totalStorytellingPoints = (storyteller.totalStorytellingPoints || 0) + points;
        storyteller.experience = (storyteller.experience || 0) + 5;

        // Persist to MongoDB if possible
        try {
            await Storyteller.updateOne(
                { name: storyteller.name, session_id: ctx.sessionId },
                { $inc: { totalStorytellingPoints: points, experience: 5 } }
            );
        } catch (err) {
            console.warn('[ScenarioRunner] Failed to persist storyteller progression:', err.message);
        }
    }
}

/**
 * Execute an ENTITY_DEEPENING step.
 */
async function executeEntityDeepening(ctx, step, config) {
    const playerSeat = step.player_seat || 0;
    const player = ctx.players[playerSeat];
    const pool = ctx.storytellersPool || [];

    const storyteller = pool.find(s => s.acquiredBy === player.id) || pool[0];
    if (!storyteller) {
        console.warn('[ScenarioRunner] No storyteller available to deepen entity');
        return;
    }

    const targetEntityId = step.target_entity_id || 'auto';

    const deepened = await callLLMOrMock('deepen_entity', { ...ctx, storyteller, targetEntityId }, config);
    await saveSample(ctx.sessionId, 'deepen_entity', step.id, { ...ctx, storyteller, targetEntityId }, deepened, config);

    if (deepened.improved_description) {
        console.log(`[ScenarioRunner] Entity ${deepened.entity_id} deepened by ${storyteller.name}`);

        const arena = ctx.arena;
        let originalEnt = arena.entities.find(e => e.id === deepened.entity_id || e.slug === deepened.slug || e.name === deepened.entity_id);
        const resolvedId = originalEnt?.id || deepened.entity_id;

        // 1. Update In-Memory Arena (Deepening)
        if (originalEnt) {
            originalEnt.description = deepened.improved_description;
            originalEnt.slug = deepened.slug || originalEnt.slug;
            originalEnt.sensory_profile = deepened.sensory_profile;
            originalEnt.traits = [...new Set([...(originalEnt.traits || []), ...(deepened.new_traits || [])])];
        }

        // 2. Process Sprout Entities (Refactored)
        await processContextualSprouting(ctx, resolvedId, deepened.sprout_entities);

        // 3. Persist everything to MongoDB
        try {
            await Arena.updateOne(
                { sessionId: ctx.sessionId },
                { $set: { "arena.entities": arena.entities } }
            );
        } catch (err) {
            console.warn('[ScenarioRunner] MongoDB deepen sync failed:', err.message);
        }

        // 4. Update Original Entity in Neo4j
        try {
            await neo4jService.updateEntityDescription(ctx.sessionId, resolvedId, deepened.improved_description);
            if (deepened.slug) {
                await neo4jService.updateEntityProperty(ctx.sessionId, resolvedId, 'slug', deepened.slug);
            }
        } catch (err) {
            console.warn('[ScenarioRunner] Failed to update Neo4j:', err.message);
        }

        // 5. Process Suggested Relationships
        const suggestions = deepened.suggested_relationships || [];
        for (const rel of suggestions) {
            const targetEnt = arena.entities.find(e => e.slug === rel.target_slug);
            if (targetEnt) {
                console.log(`[ScenarioRunner] Auto-connecting ${deepened.slug} to ${rel.target_slug}`);

                const edge = {
                    edgeId: `edge_${randomUUID().slice(0, 8)}`,
                    fromCardId: resolvedId,
                    toCardId: targetEnt.id,
                    surfaceText: rel.surfaceText,
                    predicate: rel.surfaceText.toLowerCase().replace(/\s+/g, '_'),
                    quality: { score: 0.8, confidence: 0.9 }
                };

                // Add to MongoDB
                await Arena.updateOne(
                    { sessionId: ctx.sessionId },
                    { $push: { "arena.edges": edge } }
                );

                // Add to Neo4j
                try {
                    await neo4jService.createRelationship(
                        ctx.sessionId,
                        edge.fromCardId,
                        edge.toCardId,
                        edge.predicate,
                        { surfaceText: edge.surfaceText, quality: edge.quality.score }
                    );
                } catch (e) { }
            }
        }

        // Award points
        storyteller.totalStorytellingPoints = (storyteller.totalStorytellingPoints || 0) + 15;
        storyteller.experience = (storyteller.experience || 0) + 10;
    }

    return deepened;
}

/**
 * Save an LLM sample to MongoDB.
 */
async function saveSample(sessionId, moduleName, stepId, input, output, config) {
    try {
        const prompt = output._meta?.fullPrompt;

        // Clone and clean output
        let cleanOutput;
        if (Array.isArray(output)) {
            cleanOutput = [...output];
        } else {
            cleanOutput = { ...output };
            delete cleanOutput._meta;
        }

        const sample = new LLMSample({
            sessionId,
            moduleName,
            stepId,
            prompt,
            input: { fragment: input.fragment, seed: input.seed },
            output: cleanOutput,
            isMocked: config.mock_overrides?.[moduleName] !== false,
            qualityScore: cleanOutput.quality?.score || output.quality?.score || 0.5,
            seed: input.seed
        });
        await sample.save();
    } catch (error) {
        console.error(`[ScenarioRunner] Failed to save sample:`, error.message);
    }
}

/**
 * Execute a PLAYER_CHOICE step.
 */
async function executePlayerChoice(ctx, step, config) {
    console.log(`[ScenarioRunner] Waiting for player choice... (Step: ${step.id})`);

    // 1. We need an immersion scene to branch from
    // If one isn't provided in the config, we generate one from the latest memory
    let lastScene = ctx.lastScene;
    if (!lastScene) {
        const memory = ctx.arena?.memories?.[0] || { content: ctx.fragment };
        lastScene = await callLLMOrMock('immersion_scene', { ...ctx, memory }, config);
        ctx.lastScene = lastScene;
    }

    const choices = lastScene.choice_points || ['Watch and wait', 'Investigate', 'Withdraw'];

    // 2. Resolve choice (auto-select if in script mode, or from step config)
    const selectedIndex = step.choice_index !== undefined ? step.choice_index : (ctx.seed % choices.length);
    const selectedChoice = choices[selectedIndex];

    console.log(`[ScenarioRunner] Choice selected: "${selectedChoice}"`);

    // 3. Generate consequences
    const consequences = await callLLMOrMock('generate_choice_consequences', { ...ctx, selectedChoice, lastScene }, config);
    await saveSample(ctx.sessionId, 'generate_choice_consequences', step.id, { ...ctx, selectedChoice }, consequences, config);

    console.log(`[ScenarioRunner] Outcome: ${consequences.narrative_outcome}`);

    // 4. Apply world mutations
    if (consequences.world_mutations) {
        for (const mutation of consequences.world_mutations) {
            await applyWorldMutation(ctx, mutation);
        }
    }

    return consequences;
}

/**
 * Apply a mutation to the world state (Arena & Neo4j).
 */
async function applyWorldMutation(ctx, mutation) {
    const { entity_id, property, new_value } = mutation;
    console.log(`[ScenarioRunner] Mutating ${entity_id}: ${property} -> ${new_value}`);

    // Update In-Memory Arena
    const arena = ctx.arena;
    let resolvedId = entity_id;
    if (arena && arena.entities) {
        const ent = arena.entities.find(e => e.id === entity_id || e.slug === entity_id || e.name === entity_id);
        if (ent) {
            resolvedId = ent.id;
            ent[property] = new_value;
        }
    }

    // Update MongoDB
    try {
        await Arena.updateOne(
            { sessionId: ctx.sessionId },
            { $set: { [`arena.entities.$[elem].${property}`]: new_value } },
            { arrayFilters: [{ $or: [{ "elem.id": resolvedId }, { "elem.slug": resolvedId }, { "elem.name": resolvedId }] }] }
        );
    } catch (err) {
        console.warn(`[ScenarioRunner] Mutation persistence failed for ${resolvedId}:`, err.message);
    }

    // Update Neo4j
    try {
        await neo4jService.updateEntityProperty(ctx.sessionId, resolvedId, property, new_value);
    } catch (err) {
        console.warn(`[ScenarioRunner] Neo4j mutation failed for ${resolvedId}:`, err.message);
    }
}

/**
 * Log a step event.
 */
async function logEvent(sessionId, stepId, action, inputs, outputsSummary, durationMs, success, error = null, prompt = null, reasoning = null) {
    try {
        const userId = inputs?.player_seat !== undefined ? `Player_${inputs.player_seat}` : 'System';

        // Construct the human-readable trace
        let tracePrompt = prompt || 'N/A';
        if (tracePrompt.includes('[TASK]')) {
            tracePrompt = tracePrompt.split('[TASK]')[1].trim().split('\n')[0]; // Just the main task line for brevity in trace
        }

        const formattedTrace = `in session ${sessionId} the user ${userId} wanted to ${action} . ${tracePrompt}. and the returned json was ${outputsSummary}. my reasoning for it was ${reasoning || 'N/A'}`;

        const event = new ScenarioEventLog({
            sessionId,
            stepId,
            action,
            inputs: { id: inputs.id, action: inputs.action, player_seat: inputs.player_seat },
            outputsSummary,
            prompt,
            formattedTrace,
            durationMs,
            success,
            error
        });
        await event.save();
    } catch (err) {
        console.error(`[ScenarioRunner] Failed to log event:`, err.message);
    }
}

/**
 * Get event log for a session.
 */
async function getEventLog(sessionId) {
    try {
        return await ScenarioEventLog.find({ sessionId }).sort({ createdAt: 1 }).lean();
    } catch (error) {
        console.error(`[ScenarioRunner] Failed to get event log:`, error.message);
        return [];
    }
}
/**
 * Process and persist sprouted entities.
 * Can be triggered by Deepening or Connection events.
 */
async function processContextualSprouting(ctx, parentId, sprouts = []) {
    if (!sprouts || sprouts.length === 0) return;

    const arena = ctx.arena;

    for (const sprout of sprouts) {
        console.log(`[ScenarioRunner] Sprouting new entity: ${sprout.name} (${sprout.slug})`);
        const newEntity = {
            id: sprout.id || `ent_${randomUUID().slice(0, 8)}`,
            slug: sprout.slug,
            name: sprout.name,
            type: sprout.type,
            description: sprout.description,
            sensory_profile: sprout.sensory_profile,
            traits: [],
            metadata: { sproutedFrom: parentId }
        };
        arena.entities.push(newEntity);

        // Persist Sprout to Neo4j
        try { await neo4jService.syncEntityNode(ctx.sessionId, newEntity); } catch (e) { }
    }
}

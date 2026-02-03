import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import { runScenario } from './services/scenarioRunnerService.js';
import { LLMSample, AgentUnderstanding, Recommendation, ScenarioEventLog } from './models/scenario_models.js';
import * as neo4jService from './services/neo4jService.js';
import fs from 'fs/promises';
import path from 'path';

// Increase timeout for LLM mocks and Neo4j operations
jest.setTimeout(60000);

/**
 * Load scenario configs from the scenario/ directory
 */
async function loadScenarioConfig(name) {
    const configPath = path.join(process.cwd(), 'scenario', `${name}.json`);
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(content);
    } catch (err) {
        throw new Error(`Failed to load scenario config "${name}": ${err.message}`);
    }
}

beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling_test';

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB for testing');
    } catch (err) {
        console.error('MongoDB connection failed:', err.message);
    }

    try {
        await neo4jService.initNeo4j();
        console.log('Connected to Neo4j for testing');
    } catch (err) {
        console.warn('Neo4j connection failed, some tests may be limited:', err.message);
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    await neo4jService.closeNeo4j();
});

describe('Scenario Runner System', () => {

    describe('Basic Execution', () => {
        it('runs the example scenario successfully with mocked modules', async () => {
            const config = await loadScenarioConfig('example_scenario');

            const result = await runScenario(config);

            expect(result.sessionId).toBeTruthy();
            expect(result.sessionId).toMatch(/^scenario_/);
            expect(result.eventLog.length).toBeGreaterThan(0);
            expect(result.understanding).toBeDefined();
            expect(result.recommendations).toBeDefined();

            // Check event log for completed steps
            const completedSteps = result.eventLog.filter(e => e.success);
            expect(completedSteps.length).toBe(config.steps.length);
        });
    });

    describe('Persistence & Learning', () => {
        it('persists LLM samples to MongoDB', async () => {
            const config = await loadScenarioConfig('example_scenario');
            const result = await runScenario(config);

            const samples = await LLMSample.find({ sessionId: result.sessionId }).lean();
            expect(samples.length).toBeGreaterThan(0);

            // Verify key modules generated samples
            const modules = samples.map(s => s.moduleName);
            expect(modules).toContain('generate_memories');
            expect(modules).toContain('generate_entities');
        });

        it('creates Neo4j nodes and exports graph snapshot', async () => {
            const config = await loadScenarioConfig('example_scenario');
            const result = await runScenario(config);

            expect(result.graph).toBeDefined();
            expect(result.graph.nodes.length).toBeGreaterThan(0);

            // Check for specific node types
            const labels = result.graph.nodes.flatMap(n => n.labels);
            expect(labels).toContain('Session');
            expect(labels).toContain('Player');
            expect(labels).toContain('Entity');

            // Cleanup this session's data
            await neo4jService.deleteSessionData(result.sessionId);
        });

        it('accumulates understanding across runs', async () => {
            const config = await loadScenarioConfig('example_scenario');

            // Run 1
            const run1 = await runScenario(config);
            const v1 = run1.understanding.version;

            // Run 2
            const run2 = await runScenario(config);
            const v2 = run2.understanding.version;

            expect(v2).toBeGreaterThan(v1);

            // Understanding should have principles from both runs
            expect(run2.understanding.principles.some(p => p.includes(run1.sessionId.slice(-8)))).toBe(true);
            expect(run2.understanding.principles.some(p => p.includes(run2.sessionId.slice(-8)))).toBe(true);
        });
    });

    describe('Step Logic', () => {
        it('handles PLACE_AND_CONNECT with auto-selection', async () => {
            const config = {
                fragment: 'A celestial observatory floating in a void of ink.',
                players: { count: 1 },
                steps: [{
                    id: 'auto_connect_test',
                    action: 'PLACE_AND_CONNECT',
                    player_seat: 0,
                    source_card_id: 'auto',
                    target_card_ids: ['auto'],
                    relationship: { surfaceText: 'observes' }
                }]
            };

            const result = await runScenario(config);
            const samples = await LLMSample.find({
                sessionId: result.sessionId,
                moduleName: 'validate_connection'
            }).lean();

            expect(samples.length).toBe(1);
            expect(samples[0].output.verdict).toBe('accepted');
        });

        it('handles SEND_STORYTELLER with investigation report', async () => {
            const config = {
                fragment: 'The whispering archives of the void.',
                players: { count: 1 },
                universe: { generate_storytellers: true },
                steps: [
                    { id: 'acquire', action: 'ACQUIRE_STORYTELLER', player_seat: 0 },
                    { id: 'investigate', action: 'SEND_STORYTELLER', player_seat: 0, message: 'Find the truth.' }
                ]
            };

            const result = await runScenario(config);
            const samples = await LLMSample.find({
                sessionId: result.sessionId,
                moduleName: 'storyteller_investigate'
            }).lean();

            expect(samples.length).toBe(1);
            expect(samples[0].output.outcome).toBe('success');
        });
    });

    describe('Recommendations', () => {
        it('generates recommendations for failed actions', async () => {
            const config = {
                fragment: 'Error testing scenario.',
                players: { count: 1 },
                steps: [{
                    id: 'fail_step',
                    action: 'INVALID_ACTION',
                    player_seat: 0
                }]
            };

            const result = await runScenario(config);
            const recs = await Recommendation.find({ sessionId: result.sessionId }).lean();

            expect(recs.some(r => r.category === 'code_change')).toBe(true);
        });
    });
});

/**
 * Comprehensive E2E Flow Test for Arena Relationships
 * 
 * Tests the complete relationship flow including:
 * - Entity creation
 * - Arena placement
 * - Relationship proposal (accepted/rejected)
 * - Multi-target relationships
 * - Cluster context verification
 * - Graph state verification
 * - Duplicate detection
 * - Score tracking
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Mock external API calls
const mockDirectExternalApiCall = jest.fn();
const mockTextToImageOpenAi = jest.fn();

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
    directExternalApiCall: mockDirectExternalApiCall,
}));

await jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
    textToImageOpenAi: mockTextToImageOpenAi,
}));

// Dynamic import after mocks
const { app } = await import('./server_new.js');
const {
    GeneratedContent,
    NarrativeEntity,
    NarrativeTexture,
    SessionState,
    SessionSceneState
} = await import('./storyteller/utils.js');
const { deleteSessionData } = await import('./services/neo4jService.js');
const {
    Arena,
    ChatMessage,
    NarrativeFragment,
    SessionVector,
    SessionPlayer,
    World,
    WorldElement,
    Storyteller
} = await import('./models/models.js');

const TEST_SESSION_IDS = ['relationship-flow-test', 'isolated-session-test'];
const EXTERNAL_MONGO_URI = process.env.MONGO_URI
    || process.env.MONGODB_URI
    || 'mongodb://localhost:27017/storytelling';
let mongoServer;
let consoleErrorSpy;
let consoleWarnSpy;

const DEBUG_MODE = true; // Use mock logic for deterministic tests

function logIfUnexpected(res, expectedStatus, label) {
    if (res.status !== expectedStatus) {
        console.log(`[${label}] unexpected status`, {
            status: res.status,
            body: res.body
        });
    }
}

async function cleanupTestData(sessionIds) {
    const sessionFilter = { $in: sessionIds };
    await Promise.all([
        GeneratedContent.deleteMany({ sessionId: sessionFilter }),
        Arena.deleteMany({ sessionId: sessionFilter }),
        NarrativeEntity.deleteMany({ session_id: sessionFilter }),
        NarrativeTexture.deleteMany({ session_id: sessionFilter }),
        SessionState.deleteMany({ sessionId: sessionFilter }),
        SessionSceneState.deleteMany({ sessionId: sessionFilter }),
        NarrativeFragment.deleteMany({ session_id: sessionFilter }),
        ChatMessage.deleteMany({ sessionId: sessionFilter }),
        SessionVector.deleteMany({ session_id: sessionFilter }),
        SessionPlayer.deleteMany({ sessionId: sessionFilter }),
        World.deleteMany({ sessionId: sessionFilter }),
        WorldElement.deleteMany({ sessionId: sessionFilter }),
        Storyteller.deleteMany({
            $or: [{ session_id: sessionFilter }, { sessionId: sessionFilter }]
        })
    ]);
}

beforeAll(async () => {
    const mongoUri = EXTERNAL_MONGO_URI
        ? EXTERNAL_MONGO_URI
        : (mongoServer = await MongoMemoryServer.create()).getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    process.env.OPENAI_API_KEYS_LIST = '["dummy-key"]';

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
});

afterAll(async () => {
    await cleanupTestData(TEST_SESSION_IDS);
    for (const sessionId of TEST_SESSION_IDS) {
        try {
            await deleteSessionData(sessionId);
        } catch (error) {
            console.error(`Neo4j cleanup failed for session ${sessionId}:`, error);
        }
    }
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
});

afterEach(async () => {
    jest.clearAllMocks();
});

describe('Arena Relationships Comprehensive Flow', () => {
    const sessionId = TEST_SESSION_IDS[0];
    const playerId = 'player-1';
    let entities = [];
    let cards = [];

    describe('Phase 1: Setup Entities and Arena', () => {
        it('should generate multiple entities for the arena', async () => {
            const res = await request(app)
                .post('/api/textToEntity')
                .send({
                    sessionId,
                    playerId,
                    text: 'In the ancient ruins of Kaelthros, a wandering knight encounters a mysterious oracle and discovers an enchanted blade.',
                    includeCards: true,
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(200);
            expect(res.body.entities.length).toBeGreaterThanOrEqual(3);
            expect(res.body.cards.length).toBeGreaterThanOrEqual(3);

            entities = res.body.entities;
            cards = res.body.cards;

            // Verify each entity has required fields
            entities.forEach(entity => {
                expect(entity.id || entity.externalId).toBeDefined();
                expect(entity.name).toBeDefined();
            });
        });

        it('should place all entities in the arena', async () => {
            const arenaEntities = cards.map((card, idx) => ({
                ...card,
                position: { x: idx * 150, y: 100 }
            }));

            const res = await request(app)
                .post(`/api/sessions/${sessionId}/arena`)
                .send({
                    sessionId,
                    playerId,
                    arena: { entities: arenaEntities }
                });

            expect(res.status).toBe(200);
            expect(res.body.arena.entities.length).toBe(cards.length);
        });
    });

    describe('Phase 2: Relationship Proposals', () => {
        it('should REJECT a vague relationship (too brief)', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [{ entityId: cards[1].entityId }],
                    relationship: { surfaceText: 'knows' },
                    debug: DEBUG_MODE
                });

            logIfUnexpected(res, 200, 'propose/vague');
            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('rejected');
            expect(res.body.quality.score).toBeLessThan(0.5);
            expect(res.body.quality.reasons).toContain('Relationship text is too brief');
            expect(res.body.suggestions).toBeDefined();
            expect(res.body.suggestions.length).toBeGreaterThan(0);
        });

        it('should ACCEPT a descriptive relationship', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [{ entityId: cards[1].entityId }],
                    relationship: {
                        surfaceText: 'was trained in the ancient arts by',
                        direction: 'source_to_target'
                    },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('accepted');

            // Verify edge structure
            expect(res.body.edge).toBeDefined();
            expect(res.body.edge.edgeId).toMatch(/^edge_/);
            expect(res.body.edge.fromCardId).toBe(cards[0].entityId);
            expect(res.body.edge.toCardId).toBe(cards[1].entityId);
            expect(res.body.edge.surfaceText).toBe('was trained in the ancient arts by');
            expect(res.body.edge.predicate).toBe('was_trained_in_the_ancient_arts_by');

            // Verify points awarded
            expect(res.body.points).toBeDefined();
            expect(res.body.points.awarded).toBeGreaterThan(0);
            expect(res.body.points.playerTotal).toBeGreaterThan(0);

            // Verify evolution info
            expect(res.body.evolution).toBeDefined();
            expect(res.body.evolution.affected[0].cardId).toBe(cards[1].entityId);

            // Verify cluster info is present
            expect(res.body.clusters).toBeDefined();
        });

        it('should connect to MULTIPLE targets in a single proposal', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[2].entityId },
                    targets: [
                        { entityId: cards[0].entityId },
                        { entityId: cards[1].entityId }
                    ],
                    relationship: {
                        surfaceText: 'possesses ancient knowledge sought by'
                    },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('accepted');

            // Should return array of edges for multi-target
            expect(Array.isArray(res.body.edge)).toBe(true);
            expect(res.body.edge.length).toBe(2);

            // Both targets should have edges
            const targetIds = res.body.edge.map(e => e.toCardId);
            expect(targetIds).toContain(cards[0].entityId);
            expect(targetIds).toContain(cards[1].entityId);
        });
    });

    describe('Phase 3: Graph State Verification', () => {
        it('should return correct arena state with all edges', async () => {
            const res = await request(app)
                .get(`/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`);

            expect(res.status).toBe(200);

            // Should have 3 edges total (1 from single + 2 from multi-target)
            expect(res.body.edges.length).toBe(3);

            // Verify edge data
            const predicates = res.body.edges.map(e => e.predicate);
            expect(predicates).toContain('was_trained_in_the_ancient_arts_by');
            expect(predicates).toContain('possesses_ancient_knowledge_sought_by');

            // Verify player score accumulated
            expect(res.body.scores[playerId]).toBeGreaterThan(0);

            // Verify entities are in arena
            expect(res.body.arena.entities.length).toBe(cards.length);
        });

        it('should verify score accumulation is correct', async () => {
            const res = await request(app)
                .get(`/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`);

            // Each accepted relationship adds 5-20 points based on quality (0.75 score = ~16 points)
            // We had 3 accepted edges, so score should be ~48 (3 * 16)
            expect(res.body.scores[playerId]).toBeGreaterThanOrEqual(30);
        });
    });

    describe('Phase 4: Duplicate Detection', () => {
        it('should DETECT and REJECT duplicate relationships', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [{ entityId: cards[1].entityId }],
                    relationship: {
                        surfaceText: 'was trained in the ancient arts by'
                    },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/duplicate/i);
            expect(res.body.existingEdge).toBeDefined();
            expect(res.body.existingEdge.surfaceText).toBe('was trained in the ancient arts by');
        });

        it('should ALLOW same predicate between DIFFERENT entities', async () => {
            // First create another relationship to have more data
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[1].entityId },
                    targets: [{ entityId: cards[2].entityId }],
                    relationship: {
                        surfaceText: 'was trained in the ancient arts by'
                    },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('accepted');
        });
    });

    describe('Phase 5: Validation (Dry Run)', () => {
        it('should validate a relationship without committing', async () => {
            const beforeState = await request(app)
                .get(`/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`);
            logIfUnexpected(beforeState, 200, 'state/before-validate');
            const edgeCountBefore = beforeState.body.edges.length;

            const res = await request(app)
                .post('/api/arena/relationships/validate')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [{ entityId: cards[2].entityId }],
                    relationship: {
                        surfaceText: 'discovered an ancient prophecy about'
                    },
                    debug: DEBUG_MODE
                });

            logIfUnexpected(res, 200, 'validate');
            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('accepted');
            expect(res.body.dryRun).toBe(true);

            // Verify NO new edge was created
            const afterState = await request(app)
                .get(`/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`);
            expect(afterState.body.edges.length).toBe(edgeCountBefore);
        });
    });

    describe('Phase 6: Cluster Context', () => {
        it('should include cluster information when entities have connections', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [{ entityId: cards[2].entityId }],
                    relationship: {
                        surfaceText: 'guards the sacred chamber that houses'
                    },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('accepted');

            // Response should include cluster metrics
            expect(res.body.clusters).toBeDefined();
            // Note: In mock mode without Neo4j running, cluster info may be empty
            // but the structure should exist
        });
    });

    describe('Phase 7: Edge Cases', () => {
        it('should reject missing source', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    targets: [{ entityId: cards[1].entityId }],
                    relationship: { surfaceText: 'test relationship' },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/source/i);
        });

        it('should reject empty targets array', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [],
                    relationship: { surfaceText: 'test relationship' },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/targets/i);
        });

        it('should reject missing relationship surfaceText', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { entityId: cards[0].entityId },
                    targets: [{ entityId: cards[1].entityId }],
                    relationship: {},
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/surfaceText/i);
        });

        it('should handle cardId as alternative to entityId', async () => {
            const res = await request(app)
                .post('/api/arena/relationships/propose')
                .send({
                    sessionId,
                    playerId,
                    source: { cardId: cards[1].entityId },
                    targets: [{ cardId: cards[0].entityId }],
                    relationship: { surfaceText: 'has a mysterious connection to the origins of' },
                    debug: DEBUG_MODE
                });

            expect(res.status).toBe(200);
            expect(res.body.verdict).toBe('accepted');
        });
    });
});

describe('Isolated Arena Session', () => {
    const sessionId = TEST_SESSION_IDS[1];
    const playerId = 'isolated-player';

    it('should maintain separate state per session', async () => {
        // Create entity in new session
        const entityRes = await request(app)
            .post('/api/textToEntity')
            .send({
                sessionId,
                playerId,
                text: 'A lone hermit in the mountains',
                includeCards: true,
                debug: true
            });

        expect(entityRes.status).toBe(200);

        // Get arena state - should be empty
        const stateRes = await request(app)
            .get(`/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`);

        expect(stateRes.status).toBe(200);
        expect(stateRes.body.edges).toHaveLength(0);
        expect(stateRes.body.scores).toEqual({});
    });
});

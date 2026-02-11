
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Define mocks BEFORE importing the modules that use them
const mockDirectExternalApiCall = jest.fn();
const mockTextToImageOpenAi = jest.fn();

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
    directExternalApiCall: mockDirectExternalApiCall,
}));

await jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
    textToImageOpenAi: mockTextToImageOpenAi,
}));

// Dynamic import of the app after mocks are set up
const { app } = await import('./server_new.js');
const { GeneratedContent } = await import('./storyteller/utils.js');

let mongoServer;
let consoleErrorSpy;
const DEFAULT_FLOW_DEBUG = process.env.FLOW_DEBUG !== 'false';

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // Dummy key to prevent init errors if apiService is loaded
    process.env.OPENAI_API_KEYS_LIST = '["dummy-key"]';

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    consoleErrorSpy.mockRestore();
});

afterEach(async () => {
    await GeneratedContent.deleteMany({});
    jest.clearAllMocks();
});

describe('Arena Relationships Flow (End-to-End)', () => {
    // Shared state
    const sessionId = 'arena-test-session';
    const playerId = 'player-1';
    let entity1, entity2;
    let card1, card2;

    // 1. Generate Entities (Mock Mode)
    it('Step 1: Should generate two entities', async () => {
        // Use debug: true with textToEntity to get mock entities without external calls
        const res = await request(app)
            .post('/api/textToEntity')
            .send({
                sessionId,
                playerId,
                text: 'Mocked request',
                includeCards: true,
                debug: DEFAULT_FLOW_DEBUG
            });

        expect(res.status).toBe(200);
        // textToEntity mock returns 3 entities by default
        expect(res.body.entities.length).toBeGreaterThanOrEqual(2);

        entity1 = res.body.entities[0];
        card1 = res.body.cards[0];

        entity2 = res.body.entities[1];
        card2 = res.body.cards[1];

        expect(entity1).toBeDefined();
        expect(entity2).toBeDefined();
        expect(card1).toBeDefined();
        expect(card2).toBeDefined();

        expect(card1.entityId).toBe(entity1.id);
        expect(card2.entityId).toBe(entity2.id);
    });

    // 2. Place in Arena
    it('Step 2: Should place entities in the arena', async () => {
        const payload = {
            sessionId,
            playerId,
            arena: {
                entities: [
                    { ...card1, position: { x: 0, y: 0 } },
                    { ...card2, position: { x: 100, y: 100 } }
                ]
            }
        };

        const res = await request(app)
            .post(`/api/sessions/${sessionId}/arena`)
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.arena.entities).toHaveLength(2);
    });

    // 3. Propose Rejected Relationship (Too Short)
    it('Step 3: Should reject a brief relationship', async () => {
        const payload = {
            sessionId,
            playerId,
            source: { entityId: card1.entityId },
            targets: [{ entityId: card2.entityId }],
            relationship: { surfaceText: "near" }, // Too short
            debug: DEFAULT_FLOW_DEBUG // Use deterministic mock logic
        };

        const res = await request(app)
            .post('/api/arena/relationships/propose')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.verdict).toBe('rejected');
        expect(res.body.quality.score).toBeLessThan(0.5);
        expect(res.body.suggestions).toBeDefined();
    });

    // 4. Propose Accepted Relationship
    it('Step 4: Should accept a descriptive relationship', async () => {
        const payload = {
            sessionId,
            playerId,
            source: { entityId: card1.entityId },
            targets: [{ entityId: card2.entityId }],
            relationship: { surfaceText: "sometimes seen at the summit during storms" }, // >10 chars
            debug: DEFAULT_FLOW_DEBUG
        };

        const res = await request(app)
            .post('/api/arena/relationships/propose')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.verdict).toBe('accepted');
        expect(res.body.edge).toBeDefined();
        // The edge might use the ID we passed, so checking against that
        expect(res.body.edge.fromCardId).toBe(card1.entityId);
        expect(res.body.edge.toCardId).toBe(card2.entityId);
        expect(res.body.points.awarded).toBeGreaterThan(0);
        expect(res.body.evolution.affected[0].cardId).toBe(card2.entityId); // Or entityId
    });

    // 5. Verify Graph State
    it('Step 5: Should return correct arena state with edges', async () => {
        const res = await request(app)
            .get(`/api/arena/state?sessionId=${sessionId}&playerId=${playerId}`);

        expect(res.status).toBe(200);
        expect(res.body.edges).toHaveLength(1);
        expect(res.body.edges[0].surfaceText).toBe("sometimes seen at the summit during storms");
        expect(res.body.scores[playerId]).toBeGreaterThan(0);
        expect(res.body.arena.entities).toHaveLength(2);
    });

    // 6. Duplicate Detection
    it('Step 6: Should detect duplicate edges', async () => {
        const payload = {
            sessionId,
            playerId,
            source: { entityId: card1.entityId },
            targets: [{ entityId: card2.entityId }],
            relationship: { surfaceText: "sometimes seen at the summit during storms" },
            debug: DEFAULT_FLOW_DEBUG
        };

        const res = await request(app)
            .post('/api/arena/relationships/propose')
            .send(payload);

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/duplicate/i);
    });
});

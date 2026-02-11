
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

describe('Arena Fast Validate (End-to-End)', () => {
    const sessionId = 'fast-validate-session';
    const playerId = 'player-1';
    let entity1, entity2;
    let card1, card2;

    // 1. Setup Entities
    it('Setup: Should generate two entities', async () => {
        const res = await request(app)
            .post('/api/textToEntity')
            .send({
                sessionId,
                playerId,
                text: 'Mocked request for fast validate',
                includeCards: true,
                debug: true
            });

        expect(res.status).toBe(200);
        entity1 = res.body.entities[0];
        card1 = res.body.cards[0];
        entity2 = res.body.entities[1];
        card2 = res.body.cards[1];
    });

    // 2. Fast Validate: Too Short
    it('Should fast-reject a short relationship text', async () => {
        const payload = {
            sessionId,
            playerId,
            source: { entityId: card1.entityId },
            targets: [{ entityId: card2.entityId }],
            relationship: {
                surfaceText: "no",
                fastValidate: true
            },
            options: { fastValidate: true }
        };

        const res = await request(app)
            .post('/api/arena/relationships/validate')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.verdict).toBe('rejected');
        expect(res.body.fastValidate).toBe(true);
        // Heuristic check: length < 3 is rejected
    });

    // 3. Fast Validate: Acceptable
    it('Should fast-accept a longer relationship text', async () => {
        const payload = {
            sessionId,
            playerId,
            source: { entityId: card1.entityId },
            targets: [{ entityId: card2.entityId }],
            relationship: {
                surfaceText: "connected by fate",
                fastValidate: true
            },
            options: { fastValidate: true }
        };

        const res = await request(app)
            .post('/api/arena/relationships/validate')
            .send(payload);

        expect(res.status).toBe(200);
        expect(res.body.verdict).toBe('accepted');
        expect(res.body.fastValidate).toBe(true);
        expect(res.body.quality.score).toBeGreaterThan(0.5);
    });

    // 4. Verify Fast Validate bypasses LLM (Logic Check)
    // We can check if 'directExternalApiCall' was called. It should NOT be called.
    it('Should NOT call external LLM for fast validation', async () => {
        const payload = {
            sessionId,
            playerId,
            source: { entityId: card1.entityId },
            targets: [{ entityId: card2.entityId }],
            relationship: {
                surfaceText: "another valid link",
                fastValidate: true
            },
            options: { fastValidate: true }
        };

        await request(app)
            .post('/api/arena/relationships/validate')
            .send(payload);

        expect(mockDirectExternalApiCall).not.toHaveBeenCalled();
    });
});

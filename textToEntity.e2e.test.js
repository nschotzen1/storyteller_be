
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from './server.js';
import { GeneratedContent } from './storyteller/utils.js';

// Internal module mocks
import {
    directExternalApiCall,
    generateFragmentsBeginnings
} from './ai/openai/promptsUtils.js';

// Mock textToImage to avoid calling external APIs during tests
import { textToImageOpenAi } from './ai/textToImage/api.js';

jest.mock('./ai/openai/promptsUtils.js', () => ({
    ...jest.requireActual('./ai/openai/promptsUtils.js'),
    directExternalApiCall: jest.fn(),
    generateFragmentsBeginnings: jest.fn(),
}));

jest.mock('./ai/textToImage/api.js', () => ({
    ...jest.requireActual('./ai/textToImage/api.js'),
    textToImageOpenAi: jest.fn(),
}));

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

describe('POST /api/textToEntity (End-to-End)', () => {

    // Test Mock Mode
    it('should return mock local assets in mock/debug mode', async () => {
        const response = await request(app)
            .post('/api/textToEntity')
            .send({
                sessionId: 'test-session-mock',
                playerId: 'player-1',
                text: 'A dark forest',
                includeCards: true,
                debug: true
            });

        expect(response.status).toBe(200);
        expect(response.body.mocked).toBe(true);
        expect(response.body.cards).toHaveLength(3); // Mock returns 3 entities
        expect(response.body.entities[0].playerId).toBe('player-1');

        // START: Check for PNG return requirement
        const card = response.body.cards[0];
        expect(card.front.imageUrl).toBe('/assets/1a0acb7f-ac32-40f5-8a69-5daf303fcc6b-0-1729994892.png');
        expect(card.back.imageUrl).toBe('/assets/18bbfc07-17fd-4a14-80a9-eb23af9eac2f-0-2612330651.png');
        // END: Check for PNG return requirement
    });

    // Test Production Mode (calling mocked internal services)
    it('should call textToImage and return generated URLs in production mode', async () => {
        // 1. Mock External API for Entity Generation
        directExternalApiCall.mockResolvedValueOnce([
            {
                name: 'Test Entity',
                ner_type: 'LOCATION',
                description: 'A test description',
                relevance: 'Relevant to test'
            }
        ]);
        // 2. Mock External API for Texture Generation
        directExternalApiCall.mockResolvedValueOnce([
            {
                text_for_entity: "Test Entity",
                prompt: "Texture prompt",
                font: "Font",
                card_material: "Paper",
                major_cultural_influences_references: ["Influence"]
            }
        ]);

        // 3. Mock Image Generation
        textToImageOpenAi.mockResolvedValue({
            localPath: '/tmp/assets/test-session-prod/cards/mock-file.png',
            url: 'http://test.url/image.png'
        });

        const response = await request(app)
            .post('/api/textToEntity')
            .send({
                sessionId: 'test-session-prod',
                playerId: 'player-1',
                text: 'A generated entity',
                includeCards: true,
                debug: false
            });

        expect(response.status).toBe(200);
        expect(response.body.mocked).toBe(false);
        expect(response.body.entities).toHaveLength(1);
        expect(response.body.cards).toHaveLength(1);
        expect(response.body.entities[0].playerId).toBe('player-1');

        const card = response.body.cards[0];

        // Check that textToImageOpenAi was called
        expect(textToImageOpenAi).toHaveBeenCalledTimes(2); // Front and Back

        // START: Check for PNG return requirement
        // In production mode, we construct the URL based on the session ID and entity ID
        // The UUID/ID logic in the service might vary, but assuming the service uses the entity ID:
        // We mocked the entities ID? No, generateEntitiesFromFragment adds it if missing or we check what the service does.
        // Actually, mongo adds _id.

        // We just check that imageUrl is present and follows the expected pattern relative to the response entity ID.
        const entityId = card.entityId;
        expect(card.front.imageUrl).toBe(`/assets/test-session-prod/cards/${entityId}_front.png`);
        expect(card.back.imageUrl).toBe(`/assets/test-session-prod/cards/${entityId}_back.png`);
        // END: Check for PNG return requirement
    });
});

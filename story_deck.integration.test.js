
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { app } from './server.js';
import { StoryEntity, StorySpread } from './models/story_models.js';

// Mock dependencies that might be problematic in tests if they don't exist in the environment
// (Though we are using MongoMemoryServer, so DB is fine)

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Check if already connected (server.js likely tried to connect)
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe('Story Deck API', () => {
    jest.setTimeout(30000);
    let sessionId = 'test-session-123';
    let createdSpreadId;
    let optionIds = {};

    beforeAll(async () => {
        // Seed some data for the test
        const entities = [
            { key: "p1", name: "Place 1", type: "PLACE", suit: "STONE", order: "MID", summary: "S1", universe_keys: ["u1"] },
            { key: "p2", name: "Place 2", type: "PLACE", suit: "RIVER", order: "LOW", summary: "S2", universe_keys: ["u1"] },
            { key: "p3", name: "Place 3", type: "PLACE", suit: "SKY", order: "HIGH", summary: "S3", universe_keys: ["u1"] },
            { key: "h1", name: "Hero 1", type: "HERO", suit: "STONE", order: "MID", summary: "H1", universe_keys: ["u1"] },
            { key: "h2", name: "Hero 2", type: "HERO", suit: "RIVER", order: "LOW", summary: "H2", universe_keys: ["u1"] },
            { key: "h3", name: "Hero 3", type: "HERO", suit: "SKY", order: "HIGH", summary: "H3", universe_keys: ["u1"] },
            { key: "k1", name: "Keystone 1", type: "KEYSTONE", suit: "STONE", order: "MID", summary: "K1", universe_keys: ["u1"] },
            { key: "k2", name: "Keystone 2", type: "KEYSTONE", suit: "RIVER", order: "LOW", summary: "K2", universe_keys: ["u1"] },
            { key: "k3", name: "Keystone 3", type: "KEYSTONE", suit: "SKY", order: "HIGH", summary: "K3", universe_keys: ["u1"] },
            { key: "s1", name: "Storyteller 1", type: "STORYTELLER", suit: "STONE", order: "MID", summary: "T1", universe_keys: ["u1"] },
            { key: "s2", name: "Storyteller 2", type: "STORYTELLER", suit: "RIVER", order: "LOW", summary: "T2", universe_keys: ["u1"] },
            { key: "s3", name: "Storyteller 3", type: "STORYTELLER", suit: "SKY", order: "HIGH", summary: "T3", universe_keys: ["u1"] },
        ];
        await StoryEntity.insertMany(entities);
    });

    it('POST /api/story/spread - should create a new spread', async () => {
        const res = await request(app)
            .post('/api/story/spread')
            .send({ sessionId, universeKey: 'u1' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.spread).toBeDefined();
        expect(res.body.spread.positions).toHaveLength(4);

        // Store for next step
        createdSpreadId = res.body.spread.id;

        // Verify positions
        const positions = res.body.spread.positions;
        expect(positions.find(p => p.position === 'PLACE').options).toHaveLength(3);

        // Capture valid options for choosing later
        positions.forEach(p => {
            optionIds[p.position] = p.options[0]._id; // Pick the first option for each
        });
    });

    it('POST /api/story/spread - should be idempotent (return same spread)', async () => {
        const res = await request(app)
            .post('/api/story/spread')
            .send({ sessionId, universeKey: 'u1' });

        expect(res.status).toBe(200);
        expect(res.body.spread.id).toBe(createdSpreadId);
    });

    it('POST /api/story/spread/choose - should record choices', async () => {
        const choices = {
            PLACE: optionIds['PLACE'],
            HERO: optionIds['HERO'],
            KEYSTONE: optionIds['KEYSTONE'],
            STORYTELLER: optionIds['STORYTELLER']
        };

        const res = await request(app)
            .post('/api/story/spread/choose')
            .send({
                sessionId,
                spreadId: createdSpreadId,
                choices
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify changes in response
        const p = res.body.spread.positions.find(pos => pos.position === 'PLACE');
        expect(p.chosenEntityId).toBe(choices['PLACE']);

        // Verify DB
        const dbSpread = await StorySpread.findById(createdSpreadId);
        const dbPlace = dbSpread.positions.find(pos => pos.position === 'PLACE');
        expect(dbPlace.chosen_entity_id.toString()).toBe(choices['PLACE']);
    });

    it('POST /api/story/spread/choose - should reject invalid choices', async () => {
        const choices = {
            PLACE: new mongoose.Types.ObjectId() // Random ID not in options
        };

        const res = await request(app)
            .post('/api/story/spread/choose')
            .send({
                sessionId,
                spreadId: createdSpreadId,
                choices
            });

        expect(res.status).toBe(500); // Service throws Error, caught as 500
        expect(res.body.success).toBe(false);
    });
});

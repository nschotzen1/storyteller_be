import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

let app;
let World;
let WorldElement;

jest.setTimeout(20000);

const DEFAULT_FLOW_DEBUG = process.env.FLOW_DEBUG !== 'false';

function logStep(message) {
  console.log(`[world-flow-test] ${message}`);
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ World, WorldElement } = await import('./models/models.js'));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling_test';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });

  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  if (World) {
    await World.deleteMany({});
  }
  if (WorldElement) {
    await WorldElement.deleteMany({});
  }
});

describe('Worldbuilding flow: world + elements + state', () => {
  it('creates a world and elaborates factions, locations, rumors, and lore', async () => {
    const sessionId = 'world-flow-1';
    const playerId = 'player-1';
    const seedText = 'A trade sea of salt glass, where storms rewrite maps each season.';

    logStep('POST /api/worlds');
    const worldRes = await request(app)
      .post('/api/worlds')
      .send({ sessionId, playerId, seedText, debug: DEFAULT_FLOW_DEBUG })
      .expect(201);

    const world = worldRes.body.world;
    expect(world).toBeTruthy();
    expect(world.worldId).toBeTruthy();
    expect(world.sessionId).toBe(sessionId);
    expect(world.playerId).toBe(playerId);

    const worldId = world.worldId;

    logStep('POST /api/worlds/:worldId/factions');
    const factionsRes = await request(app)
      .post(`/api/worlds/${worldId}/factions`)
      .send({ sessionId, playerId, count: 2, debug: DEFAULT_FLOW_DEBUG })
      .expect(201);

    expect(factionsRes.body.elements).toHaveLength(2);

    logStep('POST /api/worlds/:worldId/locations');
    const locationsRes = await request(app)
      .post(`/api/worlds/${worldId}/locations`)
      .send({ sessionId, playerId, count: 2, debug: DEFAULT_FLOW_DEBUG })
      .expect(201);

    expect(locationsRes.body.elements).toHaveLength(2);

    logStep('POST /api/worlds/:worldId/rumors');
    const rumorsRes = await request(app)
      .post(`/api/worlds/${worldId}/rumors`)
      .send({ sessionId, playerId, count: 2, debug: DEFAULT_FLOW_DEBUG })
      .expect(201);

    expect(rumorsRes.body.elements).toHaveLength(2);

    logStep('POST /api/worlds/:worldId/lore');
    const loreRes = await request(app)
      .post(`/api/worlds/${worldId}/lore`)
      .send({ sessionId, playerId, count: 2, debug: DEFAULT_FLOW_DEBUG })
      .expect(201);

    expect(loreRes.body.elements).toHaveLength(2);

    logStep('GET /api/worlds/:worldId/state');
    const stateRes = await request(app)
      .get(`/api/worlds/${worldId}/state`)
      .query({ sessionId, playerId })
      .expect(200);

    expect(stateRes.body.world.worldId).toBe(worldId);
    expect(stateRes.body.elements.faction?.length).toBeGreaterThan(0);
    expect(stateRes.body.elements.location?.length).toBeGreaterThan(0);
    expect(stateRes.body.elements.rumor?.length).toBeGreaterThan(0);
    expect(stateRes.body.elements.lore?.length).toBeGreaterThan(0);
  });
});

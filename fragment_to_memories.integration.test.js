import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

let app;
let FragmentMemory;

jest.setTimeout(30000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ FragmentMemory } = await import('./models/memory_models.js'));

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
  await FragmentMemory.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  if (FragmentMemory && mongoose.connection.readyState === 1) {
    await FragmentMemory.deleteMany({});
  }
});

describe('Fragment memories API integration', () => {
  it('POST /api/fragmentToMemories persists memories and returns batch metadata', async () => {
    const sessionId = 'mem-test-session-1';
    const playerId = 'mem-test-player-1';

    const response = await request(app)
      .post('/api/fragmentToMemories')
      .send({
        sessionId,
        playerId,
        text: 'The pass narrows and the wind stings like ground glass.',
        count: 3,
        debug: true
      })
      .expect(200);

    expect(response.body.sessionId).toBe(sessionId);
    expect(response.body.playerId).toBe(playerId);
    expect(response.body.batchId).toBeTruthy();
    expect(response.body.count).toBe(3);
    expect(Array.isArray(response.body.memories)).toBe(true);
    expect(response.body.memories).toHaveLength(3);

    const first = response.body.memories[0];
    expect(first).toHaveProperty('_id');
    expect(first).toHaveProperty('memory_strength');
    expect(first).toHaveProperty('short_title');
    expect(first).toHaveProperty('action_name');
    expect(first).toHaveProperty('interior/exterior');
    expect(first).toHaveProperty('estimated_duration_of_memory');

    const stored = await FragmentMemory.find({ sessionId, batchId: response.body.batchId }).lean();
    expect(stored).toHaveLength(3);
    expect(stored.every((doc) => doc.playerId === playerId)).toBe(true);
  });

  it('persists and returns memory front/back card images when includeCards is enabled', async () => {
    const sessionId = 'mem-test-session-cards';
    const playerId = 'mem-test-player-cards';

    const response = await request(app)
      .post('/api/fragmentToMemories')
      .send({
        sessionId,
        playerId,
        text: 'A frozen trail under moonlight where footsteps vanish in drifting ash.',
        count: 2,
        includeCards: true,
        includeFront: true,
        includeBack: true,
        debug: true
      })
      .expect(200);

    expect(response.body.cardOptions).toEqual({
      includeFront: true,
      includeBack: true
    });
    expect(response.body.memories).toHaveLength(2);
    expect(response.body.memories[0].front).toBeTruthy();
    expect(response.body.memories[0].back).toBeTruthy();
    expect(response.body.memories[0].front.imageUrl).toMatch(/^\/assets\//);
    expect(response.body.memories[0].back.imageUrl).toMatch(/^\/assets\//);

    const stored = await FragmentMemory.find({ sessionId, batchId: response.body.batchId }).lean();
    expect(stored).toHaveLength(2);
    expect(stored[0].front?.imageUrl).toMatch(/^\/assets\//);
    expect(stored[0].back?.imageUrl).toMatch(/^\/assets\//);
    expect(stored[0].front_image_url).toMatch(/^\/assets\//);
    expect(stored[0].back_image_url).toMatch(/^\/assets\//);
  });

  it('GET /api/memories filters by sessionId, playerId, and batchId', async () => {
    const sessionId = 'mem-test-session-2';
    const playerA = 'player-A';
    const playerB = 'player-B';

    const batchARes = await request(app)
      .post('/api/fragmentToMemories')
      .send({
        sessionId,
        playerId: playerA,
        text: 'Ash falls on the bridge stones while bells ring downstream.',
        count: 2,
        debug: true
      })
      .expect(200);

    const batchBRes = await request(app)
      .post('/api/fragmentToMemories')
      .send({
        sessionId,
        playerId: playerB,
        text: 'Torchlight drips over old masonry and dark water.',
        count: 1,
        debug: true
      })
      .expect(200);

    const allRes = await request(app)
      .get('/api/memories')
      .query({ sessionId })
      .expect(200);
    expect(allRes.body.count).toBe(3);

    const playerARes = await request(app)
      .get('/api/memories')
      .query({ sessionId, playerId: playerA })
      .expect(200);
    expect(playerARes.body.count).toBe(2);
    expect(playerARes.body.memories.every((doc) => doc.playerId === playerA)).toBe(true);

    const batchBQueryRes = await request(app)
      .get('/api/memories')
      .query({ sessionId, batchId: batchBRes.body.batchId })
      .expect(200);
    expect(batchBQueryRes.body.count).toBe(1);
    expect(batchBQueryRes.body.memories[0].batchId).toBe(batchBRes.body.batchId);
    expect(batchBQueryRes.body.memories[0].playerId).toBe(playerB);

    // Ensure different batches were created.
    expect(batchARes.body.batchId).not.toBe(batchBRes.body.batchId);
  });

  it('returns 400 for missing sessionId on POST and GET', async () => {
    await request(app)
      .post('/api/fragmentToMemories')
      .send({
        text: 'No session id',
        count: 1,
        debug: true
      })
      .expect(400);

    await request(app)
      .get('/api/memories')
      .expect(400);
  });
});

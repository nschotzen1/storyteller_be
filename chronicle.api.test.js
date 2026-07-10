import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ChronicleSessionModel } from './models/chronicleModels.js';
import { registerChronicleRoutes } from './routes/serverNew/chronicleRoutes.js';

describe('chronicle API', () => {
  let mongoServer;
  let app;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoServer.getUri(), { dbName: 'chronicle-api-test' });
    app = express();
    app.use(express.json());
    registerChronicleRoutes(app);
  });

  afterEach(async () => {
    await ChronicleSessionModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('POST /api/chronicle/early-dusk/start creates a session', async () => {
    const res = await request(app).post('/api/chronicle/early-dusk/start').send({});
    expect(res.status).toBe(201);
    expect(res.body.chronicleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.act).toBe('SOCIETY_CHAT');
  });

  test('GET /api/chronicle/:id/state returns spoiler-safe view', async () => {
    const started = await request(app).post('/api/chronicle/early-dusk/start').send({});
    const res = await request(app).get(`/api/chronicle/${started.body.chronicleId}/state`);
    expect(res.status).toBe(200);
    expect(res.body.chronicleId).toBe(started.body.chronicleId);
    expect(res.body.act).toBe('SOCIETY_CHAT');
    expect(res.body.cells.length).toBeGreaterThanOrEqual(12);
    expect(res.body.canonLocks).toBeUndefined();
    expect(res.body.pressure).toEqual({ value: 0, threshold: 6 });
  });

  test('GET state for unknown id returns 404', async () => {
    const res = await request(app).get('/api/chronicle/unknown-id/state');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });
});

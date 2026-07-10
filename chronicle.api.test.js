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

  test('POST /api/chronicle/early-dusk/start creates a session and returns the opening beats', async () => {
    const res = await request(app).post('/api/chronicle/early-dusk/start').send({});
    expect(res.status).toBe(201);
    expect(res.body.chronicleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.act).toBe('SOCIETY_CHAT');
    expect(res.body.messages.map((m) => m.beatId)).toEqual(['m_first_contact', 'm_accusation']);
    expect(res.body.messages[0].text.length).toBeGreaterThan(10);
    expect(res.body.question.beatId).toBe('q_identity');
    expect(res.body.question.options).toHaveLength(3);
    expect(res.body.question.options[0]).toEqual({ id: 'opt_am', label: 'I am.' });
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
    for (const cell of res.body.cells) {
      expect(cell.gmHooks).toBeUndefined();
    }
    expect(res.body.pendingQuestion.beatId).toBe('q_identity');
  });

  test('GET state for unknown id returns 404', async () => {
    const res = await request(app).get('/api/chronicle/unknown-id/state');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  test('POST chat/respond advances the ritual and writes facts', async () => {
    const started = await request(app).post('/api/chronicle/early-dusk/start').send({});
    const id = started.body.chronicleId;

    const identity = await request(app)
      .post(`/api/chronicle/${id}/chat/respond`)
      .send({ choiceId: 'opt_am', freeText: 'After all these years.' });
    expect(identity.status).toBe(200);
    expect(identity.body.messages.map((m) => m.beatId)).toEqual(['m_react_identity']);
    expect(identity.body.question.beatId).toBe('q_page_count');

    const pages = await request(app)
      .post(`/api/chronicle/${id}/chat/respond`)
      .send({ choiceId: 'opt_unfinished' });
    expect(pages.status).toBe(200);

    const state = await request(app).get(`/api/chronicle/${id}/state`);
    expect(state.body.recoveredFacts.pageCount).toBe('unfinished');
    expect(state.body.pendingQuestion.beatId).toBe('q_hero_stance');
    expect(state.body.ritual).toBeUndefined();
  });

  test('chat/respond rejects bad choices, unknown ids, and closed acts', async () => {
    const started = await request(app).post('/api/chronicle/early-dusk/start').send({});
    const id = started.body.chronicleId;

    const bad = await request(app).post(`/api/chronicle/${id}/chat/respond`).send({ choiceId: 'opt_nope' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/unknown choice/i);

    const missing = await request(app).post('/api/chronicle/no-such-id/chat/respond').send({ choiceId: 'opt_am' });
    expect(missing.status).toBe(404);

    await ChronicleSessionModel.updateOne({ chronicleId: id }, { $set: { act: 'RESTORATION' } });
    const closed = await request(app).post(`/api/chronicle/${id}/chat/respond`).send({ choiceId: 'opt_am' });
    expect(closed.status).toBe(409);
    expect(closed.body.error).toMatch(/act/i);
  });

  test('the full act 1 walkthrough ends in ARRIVAL_SCENE with evidence and transcript intact', async () => {
    const started = await request(app).post('/api/chronicle/early-dusk/start').send({});
    const id = started.body.chronicleId;
    let question = started.body.question;
    let act = started.body.act;
    let guard = 0;
    while (question && guard < 20) {
      const res = await request(app)
        .post(`/api/chronicle/${id}/chat/respond`)
        .send({ choiceId: question.options[0].id });
      expect(res.status).toBe(200);
      question = res.body.question;
      act = res.body.act;
      guard += 1;
    }
    expect(act).toBe('ARRIVAL_SCENE');

    const state = await request(app).get(`/api/chronicle/${id}/state`);
    expect(state.body.act).toBe('ARRIVAL_SCENE');
    expect(state.body.pendingQuestion).toBeNull();
    expect(Object.values(state.body.recoveredFacts).every((v) => typeof v === 'string')).toBe(true);
    expect(state.body.evidence.filter((e) => e.source === 'society_note')).toHaveLength(2);
    expect(state.body.transcript.filter((e) => e.role === 'society').length).toBeGreaterThanOrEqual(8);
    expect(state.body.canonLocks).toBeUndefined();
  });
});

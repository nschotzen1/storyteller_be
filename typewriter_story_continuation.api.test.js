import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let NarrativeFragment;
let mongoServer;

jest.setTimeout(30000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({ NarrativeFragment } = await import('./models/models.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  if (NarrativeFragment) {
    await NarrativeFragment.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('POST /api/send_typewriter_text world state persistence', () => {
  test('stores the continuation world state and turn metadata in the typewriter session', async () => {
    const sessionId = 'typewriter-continuation-world-state-session';
    const message = 'The clerk lifted the brass latch';
    const userBeat = 'lifted the brass latch';

    const response = await request(app)
      .post('/api/send_typewriter_text')
      .send({
        sessionId,
        message,
        userBeat,
        mocked_api_calls: true
      })
      .expect(200);

    expect(response.body.world_state).toEqual(
      expect.objectContaining({
        active_tension: expect.any(String),
        established_facts: expect.arrayContaining([expect.any(String)])
      })
    );
    expect(response.body.world_state_update).toEqual(response.body.world_state);
    expect(response.body.irreversible).toBeTruthy();
    expect(response.body.system_pressure).toBeTruthy();

    const stored = await NarrativeFragment.findOne({
      session_id: sessionId,
      turn: 0
    }).lean();

    expect(stored.fragment).toBe(response.body.fragment);
    expect(stored.worldState).toEqual(response.body.world_state);
    expect(stored.lastTypewriterTurn).toEqual(
      expect.objectContaining({
        userBeat,
        continuation: expect.any(String),
        irreversible: response.body.irreversible,
        systemPressure: response.body.system_pressure,
        mocked: true
      })
    );
    expect(stored.typewriterTurns).toEqual([
      expect.objectContaining({
        userBeat,
        mocked: true
      })
    ]);
  });
});

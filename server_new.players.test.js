import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

let app;
let SessionPlayer;

jest.setTimeout(20000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ SessionPlayer } = await import('./models/models.js'));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  if (SessionPlayer) {
    await SessionPlayer.deleteMany({});
  }
});

describe('Session players API', () => {
  it('registers two players in the same session and returns the correct count', async () => {
    const sessionId = 'players-test-1';

    const firstRes = await request(app)
      .post(`/api/sessions/${sessionId}/players`)
      .send({ playerName: 'Ada' })
      .expect(201);

    expect(firstRes.body.playerId).toBeTruthy();

    const secondRes = await request(app)
      .post(`/api/sessions/${sessionId}/players`)
      .send({ playerName: 'Byron' })
      .expect(201);

    expect(secondRes.body.playerId).toBeTruthy();

    const listRes = await request(app)
      .get(`/api/sessions/${sessionId}/players`)
      .expect(200);

    expect(listRes.body.count).toBe(2);
    expect(Array.isArray(listRes.body.players)).toBe(true);
    expect(listRes.body.players.length).toBe(2);

    const stored = await SessionPlayer.find({ sessionId }).lean();
    expect(stored.length).toBe(2);
  });
});

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

describe('POST /api/shouldAllowXerofag', () => {
  test('returns false in mock mode when the narrative does not suggest undead canines', async () => {
    const response = await request(app)
      .post('/api/shouldAllowXerofag')
      .send({
        sessionId: 'xerofag-session-1',
        currentNarrative: 'The courier crossed the salt market while the bells marked noon.',
        mocked_api_calls: true
      })
      .expect(200);

    expect(response.body.allowed).toBe(false);
    expect(response.body.runtime).toEqual(
      expect.objectContaining({
        pipeline: 'xerofag_inspection',
        mocked: true
      })
    );
  });

  test('returns true in mock mode when the narrative suggests undead canines', async () => {
    const response = await request(app)
      .post('/api/shouldAllowXerofag')
      .send({
        sessionId: 'xerofag-session-2',
        currentNarrative: 'The grave-hounds rose from the rot pit, their bare ribs clicking as they circled the gate.',
        mocked_api_calls: true
      })
      .expect(200);

    expect(response.body.allowed).toBe(true);
    expect(response.body.runtime).toEqual(
      expect.objectContaining({
        pipeline: 'xerofag_inspection',
        mocked: true
      })
    );
  });
});

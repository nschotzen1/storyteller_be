import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let Storyteller;
let NarrativeFragment;
let mongoServer;

jest.setTimeout(30000);

const buildNarrative = (wordCount) =>
  Array.from({ length: wordCount }, (_, index) => `word${index + 1}`).join(' ');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({ Storyteller, NarrativeFragment } = await import('./models/models.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  if (Storyteller) {
    await Storyteller.deleteMany({});
  }
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

describe('POST /api/shouldCreateStorytellerKey', () => {
  test('creates and assigns storyteller keys into fixed typewriter slots at the expected thresholds', async () => {
    const sessionId = 'typewriter-storyteller-session';

    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(30)
      })
      .expect(200);

    const firstResponse = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    expect(firstResponse.body.created).toBe(true);
    expect(firstResponse.body.assignedStorytellerCount).toBe(1);
    expect(firstResponse.body.slots[0]).toEqual(
      expect.objectContaining({
        slotKey: 'STORYTELLER_SLOT_HORIZONTAL',
        filled: true,
        storytellerName: expect.any(String),
        keyImageUrl: expect.stringContaining('/assets/mocks/storyteller_keys/'),
        canPress: true
      })
    );
    expect(firstResponse.body.nextThreshold).toBe(50);

    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(50)
      })
      .expect(200);

    const secondResponse = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    expect(secondResponse.body.created).toBe(true);
    expect(secondResponse.body.assignedStorytellerCount).toBe(2);
    expect(secondResponse.body.slots[1]).toEqual(
      expect.objectContaining({
        slotKey: 'STORYTELLER_SLOT_VERTICAL',
        filled: true,
        storytellerName: expect.any(String),
        keyImageUrl: expect.stringContaining('/assets/mocks/storyteller_keys/'),
        canPress: true
      })
    );
    expect(secondResponse.body.nextThreshold).toBe(100);

    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(100)
      })
      .expect(200);

    const thirdResponse = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    expect(thirdResponse.body.created).toBe(true);
    expect(thirdResponse.body.assignedStorytellerCount).toBe(3);
    expect(thirdResponse.body.slots[2]).toEqual(
      expect.objectContaining({
        slotKey: 'STORYTELLER_SLOT_RECT_HORIZONTAL',
        filled: true,
        storytellerName: expect.any(String),
        keyImageUrl: expect.stringContaining('/assets/mocks/storyteller_keys/'),
        canPress: true
      })
    );
    expect(thirdResponse.body.nextThreshold).toBeNull();

    const storedStorytellers = await Storyteller.find({ session_id: sessionId }).sort({ keySlotIndex: 1 }).lean();
    expect(storedStorytellers.map((storyteller) => storyteller.keySlotIndex)).toEqual([0, 1, 2]);
    expect(storedStorytellers.every((storyteller) => typeof storyteller.keyImageUrl === 'string' && storyteller.keyImageUrl)).toBe(true);
  });
});

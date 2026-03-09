import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let Storyteller;
let NarrativeFragment;
let NarrativeEntity;
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
  ({ NarrativeEntity } = await import('./storyteller/utils.js'));

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
  if (NarrativeEntity) {
    await NarrativeEntity.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('POST /api/send_storyteller_typewriter_text', () => {
  test('runs a storyteller intervention and saves a textual entity key in Mongo', async () => {
    const sessionId = 'storyteller-intervention-session';

    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(36)
      })
      .expect(200);

    const storytellerResponse = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    expect(storytellerResponse.body.created).toBe(true);
    expect(storytellerResponse.body.slots[0].filled).toBe(true);

    const storyteller = await Storyteller.findOne({ session_id: sessionId, keySlotIndex: 0 }).lean();
    expect(storyteller).toBeTruthy();

    const interventionResponse = await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: true
      })
      .expect(200);

    expect(interventionResponse.body).toHaveProperty('writing_sequence');
    expect(interventionResponse.body).toHaveProperty('entityKey');
    expect(interventionResponse.body.entityKey).toEqual(
      expect.objectContaining({
        entityName: expect.any(String),
        keyText: expect.any(String),
        storytellerId: String(storyteller._id),
        storytellerName: storyteller.name
      })
    );
    expect(interventionResponse.body.entityKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyText: interventionResponse.body.entityKey.keyText
        })
      ])
    );

    const updatedStoryteller = await Storyteller.findById(storyteller._id).lean();
    expect(updatedStoryteller.introducedInTypewriter).toBe(true);
    expect(updatedStoryteller.typewriterInterventionsCount).toBe(1);
    expect(updatedStoryteller.lastTypewriterInterventionAt).toBeTruthy();

    const savedEntity = await NarrativeEntity.findOne({
      session_id: sessionId,
      typewriterKeyText: interventionResponse.body.entityKey.keyText
    }).lean();
    expect(savedEntity).toEqual(
      expect.objectContaining({
        name: interventionResponse.body.entityKey.entityName,
        introducedByStorytellerName: storyteller.name,
        activeInTypewriter: true,
        typewriterSource: 'storyteller_intervention'
      })
    );

    const refreshedSlotsResponse = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    expect(refreshedSlotsResponse.body.entityKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyText: interventionResponse.body.entityKey.keyText
        })
      ])
    );
  });
});

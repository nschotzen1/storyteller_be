import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let Storyteller;
let NarrativeFragment;
let TypewriterKey;
let NarrativeEntity;
let mongoServer;

jest.setTimeout(30000);

const buildNarrative = (wordCount) =>
  Array.from({ length: wordCount }, (_, index) => `word${index + 1}`).join(' ');

const growNarrativeBeyondTenPercent = (text) => {
  const additionsNeeded = Math.max(8, Math.ceil(String(text || '').length / 20));
  const addition = Array.from({ length: additionsNeeded }, (_, index) => `tail${index + 1}`).join(' ');
  return `${text} ${addition}`.trim();
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({ Storyteller, NarrativeFragment, TypewriterKey } = await import('./models/models.js'));
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
  if (TypewriterKey) {
    await TypewriterKey.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('POST /api/send_storyteller_typewriter_text', () => {
  test('runs a storyteller intervention and saves a pressable textual typewriter key in Mongo', async () => {
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
    expect(interventionResponse.body).toHaveProperty('typewriterKey');
    expect(interventionResponse.body).toHaveProperty('typewriterKeys');
    expect(interventionResponse.body).toHaveProperty('entityKey');
    expect(interventionResponse.body.typewriterKey).toEqual(
      expect.objectContaining({
        entityId: expect.any(String),
        entityName: expect.any(String),
        keyText: expect.any(String),
        insertText: expect.any(String),
        sourceType: 'storyteller_intervention',
        storytellerId: String(storyteller._id),
        storytellerName: storyteller.name
      })
    );
    expect(interventionResponse.body.typewriterKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyText: interventionResponse.body.typewriterKey.keyText
        })
      ])
    );

    const updatedStoryteller = await Storyteller.findById(storyteller._id).lean();
    expect(updatedStoryteller.introducedInTypewriter).toBe(true);
    expect(updatedStoryteller.typewriterInterventionsCount).toBe(1);
    expect(updatedStoryteller.lastTypewriterInterventionAt).toBeTruthy();
    expect(updatedStoryteller.lastTypewriterPressAt).toBeTruthy();
    expect(updatedStoryteller.lastTypewriterPressFragmentLength).toBe(interventionResponse.body.fragment.length);
    expect(updatedStoryteller.typewriterInterventionInFlight).toBe(false);

    const savedEntity = await NarrativeEntity.findOne({
      session_id: sessionId,
      typewriterKeyText: interventionResponse.body.typewriterKey.keyText
    }).lean();
    expect(savedEntity).toEqual(
      expect.objectContaining({
        name: interventionResponse.body.typewriterKey.entityName,
        source: 'storyteller_intervention',
        sourceRoute: '/api/send_storyteller_typewriter_text',
        introducedByStorytellerName: storyteller.name,
        activeInTypewriter: true,
        typewriterSource: 'storyteller_intervention'
      })
    );

    const savedTypewriterKey = await TypewriterKey.findOne({
      session_id: sessionId,
      keyText: interventionResponse.body.typewriterKey.keyText
    }).lean();
    expect(savedTypewriterKey).toEqual(
      expect.objectContaining({
        entityId: savedEntity._id,
        entityName: interventionResponse.body.typewriterKey.entityName,
        insertText: interventionResponse.body.typewriterKey.insertText,
        sourceType: 'storyteller_intervention',
        sourceStorytellerId: String(storyteller._id),
        sourceStorytellerName: storyteller.name,
        activeInTypewriter: true
      })
    );

    const refreshedSlotsResponse = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    expect(refreshedSlotsResponse.body.typewriterKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyText: interventionResponse.body.typewriterKey.keyText
        })
      ])
    );
    expect(refreshedSlotsResponse.body.slots[0]).toEqual(
      expect.objectContaining({
        canPress: false,
        pressLockedReason: 'growth_required'
      })
    );
  });

  test('blocks repeated storyteller presses until the persisted fragment grows by more than ten percent', async () => {
    const sessionId = 'storyteller-intervention-cooldown';

    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(36)
      })
      .expect(200);

    await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId, mocked_api_calls: true })
      .expect(200);

    const storyteller = await Storyteller.findOne({ session_id: sessionId, keySlotIndex: 0 }).lean();
    expect(storyteller).toBeTruthy();

    const firstIntervention = await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: true
      })
      .expect(200);

    const immediateRetry = await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: true
      })
      .expect(409);

    expect(immediateRetry.body.code).toBe('STORYTELLER_PRESS_NOT_ALLOWED');
    expect(immediateRetry.body.slots[0]).toEqual(
      expect.objectContaining({
        canPress: false,
        pressLockedReason: 'growth_required',
        lastPressFragmentLength: firstIntervention.body.fragment.length,
        requiredFragmentLength: expect.any(Number)
      })
    );
    expect(immediateRetry.body.slots[0].requiredFragmentLength).toBeGreaterThan(firstIntervention.body.fragment.length);

    const grownFragment = growNarrativeBeyondTenPercent(firstIntervention.body.fragment);
    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: grownFragment
      })
      .expect(200);

    const retryAfterGrowth = await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: true
      })
      .expect(200);

    expect(retryAfterGrowth.body.fragment.length).toBeGreaterThan(grownFragment.length);
  });
});

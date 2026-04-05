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

describe('GET /api/entities', () => {
  test('returns canonical entity documents and supports provenance filters', async () => {
    const sessionId = 'entities-query-session';

    const entityResponse = await request(app)
      .post('/api/textToEntity')
      .send({
        sessionId,
        text: 'The watchman traced a dim line over the sea and named nothing yet.',
        debug: true,
        count: 2,
        desiredEntityCategories: ['LOCATION', 'ITEM', 'FACTION']
      })
      .expect(200);

    expect(entityResponse.body.count).toBe(2);
    expect(entityResponse.body.desiredEntityCategories).toEqual(['LOCATION', 'ITEM', 'FACTION']);

    const textEntitiesResponse = await request(app)
      .get('/api/entities')
      .query({
        sessionId,
        source: 'text_to_entity',
        type: 'LOCATION',
        limit: 1
      })
      .expect(200);

    expect(textEntitiesResponse.body.count).toBe(1);
    expect(textEntitiesResponse.body.entities).toHaveLength(1);
    expect(textEntitiesResponse.body.entities[0]).toEqual(
      expect.objectContaining({
        session_id: sessionId,
        sessionId,
        source: 'text_to_entity',
        sourceRoute: '/api/textToEntity',
        type: 'LOCATION',
        externalId: expect.any(String)
      })
    );

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

    const interventionResponse = await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: true
      })
      .expect(200);

    const storytellerEntitiesResponse = await request(app)
      .get('/api/entities')
      .query({
        sessionId,
        source: 'storyteller_intervention',
        introducedByStorytellerId: String(storyteller._id),
        activeInTypewriter: true,
        typewriterKeyText: interventionResponse.body.entityKey.keyText
      })
      .expect(200);

    expect(storytellerEntitiesResponse.body.entities).toEqual([
      expect.objectContaining({
        session_id: sessionId,
        sessionId,
        name: interventionResponse.body.entityKey.entityName,
        source: 'storyteller_intervention',
        sourceRoute: '/api/send_storyteller_typewriter_text',
        introducedByStorytellerId: String(storyteller._id),
        activeInTypewriter: true,
        typewriterKeyText: interventionResponse.body.entityKey.keyText,
        externalId: expect.any(String)
      })
    ]);

    await NarrativeEntity.insertMany([
      {
        session_id: sessionId,
        sessionId,
        playerId: '',
        name: 'North-Facing Cairn',
        description: 'A high place that sees too far.',
        type: 'LOCATION',
        subtype: 'Cairn',
        tags: ['stone', 'warning'],
        externalId: 'bank-entity-1',
        source: 'seer_claim',
        sourceRoute: '/api/seer/readings/:readingId/cards/:cardId/claim',
        worldId: 'world-entities-1',
        universeId: 'world-entities-1',
        canonicalStatus: 'candidate',
        sourceReadingIds: ['reading-entities-1'],
        claimedFromCardIds: ['card-location'],
        reuseCount: 3,
        lastUsedAt: new Date('2026-04-05T10:00:00.000Z')
      },
      {
        session_id: sessionId,
        sessionId,
        playerId: '',
        name: 'Ashward Monastery',
        description: 'A weather-cut structure of ritual stone.',
        type: 'LOCATION',
        subtype: 'Monastery',
        tags: ['stone', 'ritual'],
        externalId: 'bank-entity-2',
        source: 'seer_claim',
        sourceRoute: '/api/seer/readings/:readingId/cards/:cardId/claim',
        worldId: 'world-entities-1',
        universeId: 'world-entities-1',
        canonicalStatus: 'canonical',
        sourceReadingIds: ['reading-entities-2'],
        claimedFromCardIds: ['card-monastery'],
        reuseCount: 1,
        lastUsedAt: new Date('2026-04-04T10:00:00.000Z')
      }
    ]);

    const bankSearchResponse = await request(app)
      .get('/api/entities')
      .query({
        sessionId,
        worldId: 'world-entities-1',
        universeId: 'world-entities-1',
        name: 'cairn',
        tag: 'stone',
        canonicalStatus: 'candidate',
        linkedReadingId: 'reading-entities-1'
      })
      .expect(200);

    expect(bankSearchResponse.body.count).toBe(1);
    expect(bankSearchResponse.body.entities).toEqual([
      expect.objectContaining({
        externalId: 'bank-entity-1',
        worldId: 'world-entities-1',
        universeId: 'world-entities-1',
        canonicalStatus: 'candidate'
      })
    ]);

    const sortedByReuseResponse = await request(app)
      .get('/api/entities')
      .query({
        sessionId,
        worldId: 'world-entities-1',
        sort: 'reuse',
        limit: 2
      })
      .expect(200);

    expect(sortedByReuseResponse.body.entities[0].externalId).toBe('bank-entity-1');
  });
});

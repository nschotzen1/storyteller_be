/**
 * Persistent E2E test that leaves data in MongoDB + Neo4j for inspection.
 *
 * Session/Player identifiers (intentional, do not change unless you want new data):
 * - sessionId: persistent-relationships-test
 * - playerId: persistent-player
 *
 * Cleanup (manual):
 * - Run `npm run cleanup:persistent-relationships` to delete persisted MongoDB + Neo4j data
 *   from previous runs of this test.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';

// Mock external API calls
const mockDirectExternalApiCall = jest.fn();
const mockTextToImageOpenAi = jest.fn();
const mockListAvailableOpenAiModels = jest.fn().mockResolvedValue({
  source: 'mock',
  fetchedAt: '2026-03-03T00:00:00.000Z',
  textModels: [],
  imageModels: [],
  allModels: []
});

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  directExternalApiCall: mockDirectExternalApiCall,
  listAvailableOpenAiModels: mockListAvailableOpenAiModels
}));

await jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
  textToImageOpenAi: mockTextToImageOpenAi,
}));

// Dynamic import after mocks
const { app } = await import('./server_new.js');
const { Arena } = await import('./models/models.js');
const { closeNeo4j, getSession } = await import('./services/neo4jService.js');

const EXTERNAL_MONGO_URI = process.env.MONGO_URI
  || process.env.MONGODB_URI
  || 'mongodb://localhost:27017/storytelling';

const DEBUG_MODE = true;
const sessionId = 'persistent-relationships-test';
const playerId = 'persistent-player';

let consoleErrorSpy;
let consoleWarnSpy;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(EXTERNAL_MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  process.env.OPENAI_API_KEYS_LIST = '["dummy-key"]';

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
}, 20000);

afterAll(async () => {
  await mongoose.disconnect();
  await closeNeo4j();
  consoleErrorSpy.mockRestore();
  consoleWarnSpy.mockRestore();
});

describe('Arena Relationships Persistent Flow', () => {
  let cards = [];
  let entities = [];
  let edgeIds = [];

  it('creates entities and cards', async () => {
    const res = await request(app)
      .post('/api/textToEntity')
      .send({
        sessionId,
        playerId,
        text: 'A lighthouse keeper meets a rogue cartographer who carries a map of sleeping storms.',
        includeCards: true,
        debug: DEBUG_MODE,
      });

    expect(res.status).toBe(200);
    expect(res.body.entities.length).toBeGreaterThanOrEqual(3);
    expect(res.body.cards.length).toBeGreaterThanOrEqual(3);

    entities = res.body.entities;
    cards = res.body.cards;
  });

  it('places entities in the arena', async () => {
    const arenaEntities = cards.map((card, idx) => ({
      ...card,
      position: { x: idx * 150, y: 120 },
    }));

    const res = await request(app)
      .post(`/api/sessions/${sessionId}/arena`)
      .send({
        sessionId,
        playerId,
        arena: { entities: arenaEntities },
      });

    expect(res.status).toBe(200);
    expect(res.body.arena.entities.length).toBe(cards.length);
  });

  it('creates relationships (persisted)', async () => {
    const entityById = new Map(
      entities.map((entity) => [entity.id || entity.externalId, entity])
    );
    const sourceEntity = entityById.get(cards[0].entityId);
    const targetEntity = entityById.get(cards[1].entityId);

    const res = await request(app)
      .post('/api/arena/relationships/propose')
      .send({
        sessionId,
        playerId,
        source: {
          entityId: cards[0].entityId,
          name: sourceEntity?.name,
          description: sourceEntity?.description
        },
        targets: [
          {
            entityId: cards[1].entityId,
            name: targetEntity?.name,
            description: targetEntity?.description
          }
        ],
        relationship: {
          surfaceText: 'keeps the secrets of',
          direction: 'source_to_target',
        },
        debug: DEBUG_MODE,
      });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('accepted');
    expect(res.body.edge).toBeDefined();
    expect(res.body.edge.strength).toBe(4);
    edgeIds.push(res.body.edge.edgeId);
  });

  it('adds additional connections between existing entities', async () => {
    const entityById = new Map(
      entities.map((entity) => [entity.id || entity.externalId, entity])
    );
    const sourceEntity = entityById.get(cards[2].entityId);
    const targetEntity = entityById.get(cards[0].entityId);
    const targetEntityTwo = entityById.get(cards[1].entityId);

    const res = await request(app)
      .post('/api/arena/relationships/propose')
      .send({
        sessionId,
        playerId,
        source: {
          entityId: cards[2].entityId,
          name: sourceEntity?.name,
          description: sourceEntity?.description
        },
        targets: [
          {
            entityId: cards[0].entityId,
            name: targetEntity?.name,
            description: targetEntity?.description
          },
          {
            entityId: cards[1].entityId,
            name: targetEntityTwo?.name,
            description: targetEntityTwo?.description
          }
        ],
        relationship: {
          surfaceText: 'is connected to the forgotten map of',
        },
        debug: DEBUG_MODE,
      });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('accepted');
    expect(Array.isArray(res.body.edge)).toBe(true);
    expect(res.body.edge.length).toBe(2);
    expect(res.body.edge.every((edge) => edge.strength === 4)).toBe(true);
    edgeIds.push(...res.body.edge.map((edge) => edge.edgeId));
  });

  it('persists strength in MongoDB and Neo4j', async () => {
    const arenaDoc = await Arena.findOne({ sessionId }).lean();
    expect(arenaDoc).toBeTruthy();
    const persistedEdges = Array.isArray(arenaDoc?.arena?.edges) ? arenaDoc.arena.edges : [];
    expect(persistedEdges.length).toBeGreaterThanOrEqual(3);
    for (const edgeId of edgeIds) {
      const edge = persistedEdges.find((entry) => entry.edgeId === edgeId);
      expect(edge).toBeTruthy();
      expect(edge.strength).toBe(4);
    }

    const neo4jSession = getSession();
    try {
      const neoResult = await neo4jSession.run(
        `MATCH (:Entity {sessionId: $sessionId})-[r:RELATES_TO]->(:Entity {sessionId: $sessionId})
         WHERE r.edgeId IN $edgeIds
         RETURN r.edgeId AS edgeId, r.strength AS strength`,
        { sessionId, edgeIds }
      );

      const toNum = (value) => {
        if (!value) return 0;
        if (typeof value.toNumber === 'function') return value.toNumber();
        return Number(value);
      };

      const neoEdgeMap = new Map(
        neoResult.records.map((record) => [
          record.get('edgeId'),
          toNum(record.get('strength'))
        ])
      );

      for (const edgeId of edgeIds) {
        expect(neoEdgeMap.has(edgeId)).toBe(true);
        expect(neoEdgeMap.get(edgeId)).toBe(4);
      }
    } finally {
      await neo4jSession.close();
    }
  });
});

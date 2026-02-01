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

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  directExternalApiCall: mockDirectExternalApiCall,
}));

await jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
  textToImageOpenAi: mockTextToImageOpenAi,
}));

// Dynamic import after mocks
const { app } = await import('./server_new.js');
const { closeNeo4j } = await import('./services/neo4jService.js');

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
  });
});

import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
let app;
let NarrativeEntity;
let Storyteller;
let SessionPlayer;
let Arena;

jest.setTimeout(20000);

function logStep(message) {
  // Helps debug hangs in CI/local runs.
  console.log(`[flow-test] ${message}`);
}

beforeAll(async () => {
  logStep('beforeAll start');
  process.env.NODE_ENV = 'test';
  logStep('importing app');
  ({ app } = await import('./server_new.js'));
  logStep('importing NarrativeEntity');
  ({ NarrativeEntity } = await import('./storyteller/utils.js'));
  logStep('imported NarrativeEntity');
  logStep('importing Storyteller models');
  ({ Storyteller, SessionPlayer, Arena } = await import('./models/models.js'));
  logStep('imported Storyteller models');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling_test';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  try {
    logStep(`connecting to MongoDB: ${mongoUri}`);
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB at ${mongoUri}: ${error.message}`);
  }

  if (!mongoose.connection.db) {
    throw new Error('MongoDB connection established without a database handle.');
  }

  logStep('pinging MongoDB');
  const pingResult = await mongoose.connection.db.admin().ping();
  if (!pingResult?.ok) {
    throw new Error('MongoDB ping failed; database is not responding.');
  }
  logStep('syncing indexes');
  await Storyteller.syncIndexes();
  await NarrativeEntity.syncIndexes();
  await SessionPlayer.syncIndexes();
  await Arena.syncIndexes();
  logStep('resetting test database');
  await mongoose.connection.db.dropDatabase();
  logStep('beforeAll complete');
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  if (NarrativeEntity) {
    await NarrativeEntity.deleteMany({});
  }
  if (Storyteller) {
    await Storyteller.deleteMany({});
  }
  if (SessionPlayer) {
    await SessionPlayer.deleteMany({});
  }
  if (Arena) {
    await Arena.deleteMany({});
  }
});

describe('Mocked flow: fragment -> entities -> storyteller -> mission', () => {
  it('creates entities and a storyteller, then runs a mission with sub-entities', async () => {
    const sessionId = 'flow-test-1';
    const playerId = 'player-1';
    const fragment = 'A rusted watchtower stands above a fog-sunk river crossing.';

    logStep('flow-test: POST /api/textToEntity');
    const entityRes = await request(app)
      .post('/api/textToEntity')
      .send({ sessionId, playerId, text: fragment, debug: true })
      .expect(200);

    expect(entityRes.body.entities?.length).toBeGreaterThan(0);
    const mainEntityId = entityRes.body.entities[0].id;
    expect(mainEntityId).toBeTruthy();
    expect(entityRes.body.entities[0].playerId).toBe(playerId);

    logStep('flow-test: POST /api/textToStoryteller');
    const storytellerRes = await request(app)
      .post('/api/textToStoryteller')
      .send({ sessionId, playerId, text: fragment, count: 1, debug: true, mockImage: true })
      .expect(200);

    expect(storytellerRes.body.storytellers?.length).toBe(1);
    const storytellerId = storytellerRes.body.storytellers[0]._id;
    expect(storytellerId).toBeTruthy();
    expect(storytellerRes.body.storytellers[0].illustration).toBeTruthy();
    expect(storytellerRes.body.storytellers[0].playerId).toBe(playerId);

    logStep('flow-test: POST /api/sendStorytellerToEntity');
    const missionRes = await request(app)
      .post('/api/sendStorytellerToEntity')
      .send({
        sessionId,
        playerId,
        entityId: mainEntityId,
        storytellerId,
        storytellingPoints: 12,
        message: 'Investigate the whispering lanterns.',
        duration: 3,
        debug: true
      })
      .expect(200);

    expect(['success', 'failure', 'delayed', 'pending']).toContain(missionRes.body.outcome);
    expect(missionRes.body.subEntities?.length).toBeGreaterThan(0);

    const storedStoryteller = await Storyteller.findById(storytellerId);
    expect(storedStoryteller).toBeTruthy();
    expect(storedStoryteller.status).toBe('active');
    expect(storedStoryteller.missions.length).toBe(1);
    expect(storedStoryteller.playerId).toBe(playerId);

    const storedSubEntities = await NarrativeEntity.find({
      session_id: sessionId,
      playerId,
      mainEntityId: String(mainEntityId),
      isSubEntity: true
    });
    expect(storedSubEntities.length).toBeGreaterThan(0);

    await NarrativeEntity.deleteMany({ session_id: sessionId });
    await Storyteller.deleteMany({ session_id: sessionId });
  });
});

describe('Multiplayer arena flow: two players share session arena', () => {
  it('registers two players, generates entities/storytellers, and persists arena', async () => {
    const sessionId = 'arena-test-1';
    const fragmentOne = 'A blackened clock tower looms over the river market.';
    const fragmentTwo = 'A snow-buried shrine hums with faint blue light.';

    logStep('arena-test: GET players (health check)');
    const healthCheckRes = await request(app)
      .get(`/api/sessions/${sessionId}/players`)
      .expect(200);

    expect(healthCheckRes.body.count).toBe(0);

    logStep('arena-test: POST player one');
    const playerOneRes = await request(app)
      .post(`/api/sessions/${sessionId}/players`)
      .send({ playerName: 'Ada' })
      .expect(201);

    logStep('arena-test: POST player two');
    const playerTwoRes = await request(app)
      .post(`/api/sessions/${sessionId}/players`)
      .send({ playerName: 'Bram' })
      .expect(201);

    const playerOneId = playerOneRes.body.playerId;
    const playerTwoId = playerTwoRes.body.playerId;

    expect(playerOneId).toBeTruthy();
    expect(playerTwoId).toBeTruthy();

    logStep('arena-test: GET players (after register)');
    const playersListRes = await request(app)
      .get(`/api/sessions/${sessionId}/players`)
      .expect(200);

    expect(playersListRes.body.count).toBe(2);

    logStep('arena-test: POST /api/textToEntity (player one)');
    const playerOneEntitiesRes = await request(app)
      .post('/api/textToEntity')
      .send({ sessionId, playerId: playerOneId, text: fragmentOne, debug: true })
      .expect(200);

    logStep('arena-test: POST /api/textToEntity (player two)');
    const playerTwoEntitiesRes = await request(app)
      .post('/api/textToEntity')
      .send({ sessionId, playerId: playerTwoId, text: fragmentTwo, debug: true })
      .expect(200);

    const playerOneEntity = playerOneEntitiesRes.body.entities?.[0];
    const playerTwoEntity = playerTwoEntitiesRes.body.entities?.[0];

    expect(playerOneEntity).toBeTruthy();
    expect(playerTwoEntity).toBeTruthy();
    expect(playerOneEntity.playerId).toBe(playerOneId);
    expect(playerTwoEntity.playerId).toBe(playerTwoId);

    logStep('arena-test: POST /api/textToStoryteller (player one)');
    const playerOneStorytellerRes = await request(app)
      .post('/api/textToStoryteller')
      .send({ sessionId, playerId: playerOneId, text: fragmentOne, count: 1, debug: true, mockImage: true })
      .expect(200);

    logStep('arena-test: POST /api/textToStoryteller (player two)');
    const playerTwoStorytellerRes = await request(app)
      .post('/api/textToStoryteller')
      .send({ sessionId, playerId: playerTwoId, text: fragmentTwo, count: 1, debug: true, mockImage: true })
      .expect(200);

    const playerOneStoryteller = playerOneStorytellerRes.body.storytellers?.[0];
    const playerTwoStoryteller = playerTwoStorytellerRes.body.storytellers?.[0];

    expect(playerOneStoryteller).toBeTruthy();
    expect(playerTwoStoryteller).toBeTruthy();
    expect(playerOneStoryteller.playerId).toBe(playerOneId);
    expect(playerTwoStoryteller.playerId).toBe(playerTwoId);

    const arenaPayload = {
      entities: [playerOneEntity, playerTwoEntity],
      storytellers: [playerOneStoryteller, playerTwoStoryteller]
    };

    logStep('arena-test: POST /api/sessions/:sessionId/arena');
    const arenaPostRes = await request(app)
      .post(`/api/sessions/${sessionId}/arena`)
      .send({ sessionId, playerId: playerOneId, arena: arenaPayload })
      .expect(200);

    expect(arenaPostRes.body.arena.entities).toHaveLength(2);
    expect(arenaPostRes.body.arena.storytellers).toHaveLength(2);
    expect(arenaPostRes.body.lastUpdatedBy).toBe(playerOneId);

    const storedArena = await Arena.findOne({ sessionId });
    expect(storedArena).toBeTruthy();
    expect(storedArena.arena.entities).toHaveLength(2);

    const updatedArenaPayload = {
      entities: [playerTwoEntity],
      storytellers: [playerTwoStoryteller]
    };

    logStep('arena-test: POST /api/sessions/:sessionId/arena (update)');
    const arenaUpdateRes = await request(app)
      .post(`/api/sessions/${sessionId}/arena`)
      .send({ sessionId, playerId: playerTwoId, arena: updatedArenaPayload })
      .expect(200);

    expect(arenaUpdateRes.body.lastUpdatedBy).toBe(playerTwoId);
    expect(arenaUpdateRes.body.arena.entities).toHaveLength(1);
    expect(arenaUpdateRes.body.arena.entities[0].playerId).toBe(playerTwoId);

    logStep('arena-test: GET /api/sessions/:sessionId/arena');
    const arenaGetRes = await request(app)
      .get(`/api/sessions/${sessionId}/arena`)
      .query({ playerId: playerOneId })
      .expect(200);

    expect(arenaGetRes.body.arena.entities).toHaveLength(1);
    expect(arenaGetRes.body.arena.entities[0].playerId).toBe(playerTwoId);

    logStep('arena-test: DB counts');
    const entityCount = await NarrativeEntity.countDocuments({ session_id: sessionId });
    const storytellerCount = await Storyteller.countDocuments({ session_id: sessionId });
    const playerCount = await SessionPlayer.countDocuments({ sessionId });

    expect(entityCount).toBeGreaterThan(1);
    expect(storytellerCount).toBeGreaterThan(1);
    expect(playerCount).toBe(2);

    await NarrativeEntity.deleteMany({ session_id: sessionId });
    await Storyteller.deleteMany({ session_id: sessionId });
    await SessionPlayer.deleteMany({ sessionId });
    await Arena.deleteMany({ sessionId });

    const remainingEntities = await NarrativeEntity.countDocuments({ session_id: sessionId });
    const remainingStorytellers = await Storyteller.countDocuments({ session_id: sessionId });
    const remainingPlayers = await SessionPlayer.countDocuments({ sessionId });
    const remainingArena = await Arena.countDocuments({ sessionId });

    expect(remainingEntities).toBe(0);
    expect(remainingStorytellers).toBe(0);
    expect(remainingPlayers).toBe(0);
    expect(remainingArena).toBe(0);
  });
});

describe('Multiplayer arena flow: cards are shared between players', () => {
  it('stores cards in the arena and returns them for another player', async () => {
    const sessionId = 'arena-cards-test-1';
    const fragment = 'A tideworn observatory glows with soft brass light.';

    const playerOneRes = await request(app)
      .post(`/api/sessions/${sessionId}/players`)
      .send({ playerName: 'Ada' })
      .expect(201);

    const playerTwoRes = await request(app)
      .post(`/api/sessions/${sessionId}/players`)
      .send({ playerName: 'Bram' })
      .expect(201);

    const playerOneId = playerOneRes.body.playerId;
    const playerTwoId = playerTwoRes.body.playerId;

    const playerOneEntitiesRes = await request(app)
      .post('/api/textToEntity')
      .send({
        sessionId,
        playerId: playerOneId,
        text: fragment,
        includeCards: true,
        includeFront: true,
        includeBack: true,
        debug: true
      })
      .expect(200);

    const cards = playerOneEntitiesRes.body.cards || [];
    const entities = playerOneEntitiesRes.body.entities || [];

    expect(cards.length).toBeGreaterThan(0);
    expect(entities.length).toBeGreaterThan(0);
    expect(cards[0].front?.imageUrl).toBeTruthy();
    expect(cards[0].back?.imageUrl).toBeTruthy();

    const arenaPayload = {
      entities,
      storytellers: [],
      cards
    };

    const arenaPostRes = await request(app)
      .post(`/api/sessions/${sessionId}/arena`)
      .send({ sessionId, playerId: playerOneId, arena: arenaPayload })
      .expect(200);

    expect(arenaPostRes.body.arena.cards).toHaveLength(cards.length);
    expect(arenaPostRes.body.arena.cards[0].front?.imageUrl).toBe(cards[0].front?.imageUrl);
    expect(arenaPostRes.body.arena.cards[0].back?.imageUrl).toBe(cards[0].back?.imageUrl);

    const arenaGetRes = await request(app)
      .get(`/api/sessions/${sessionId}/arena`)
      .query({ playerId: playerTwoId })
      .expect(200);

    expect(arenaGetRes.body.arena.cards).toHaveLength(cards.length);
    expect(arenaGetRes.body.arena.cards[0].front?.imageUrl).toBe(cards[0].front?.imageUrl);
    expect(arenaGetRes.body.arena.cards[0].back?.imageUrl).toBe(cards[0].back?.imageUrl);
  });
});

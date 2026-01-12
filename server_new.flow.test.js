import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
let app;
let NarrativeEntity;
let Storyteller;

jest.setTimeout(20000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ NarrativeEntity } = await import('./storyteller/utils.js'));
  ({ Storyteller } = await import('./models/models.js'));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
  } catch (error) {
    throw new Error(`Failed to connect to MongoDB at ${mongoUri}: ${error.message}`);
  }
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
});

describe('Mocked flow: fragment -> entities -> storyteller -> mission', () => {
  it('creates entities and a storyteller, then runs a mission with sub-entities', async () => {
    const sessionId = 'flow-test-1';
    const playerId = 'player-1';
    const fragment = 'A rusted watchtower stands above a fog-sunk river crossing.';

    const entityRes = await request(app)
      .post('/api/textToEntity')
      .send({ sessionId, playerId, text: fragment, debug: true })
      .expect(200);

    expect(entityRes.body.entities?.length).toBeGreaterThan(0);
    const mainEntityId = entityRes.body.entities[0].id;
    expect(mainEntityId).toBeTruthy();
    expect(entityRes.body.entities[0].playerId).toBe(playerId);

    const storytellerRes = await request(app)
      .post('/api/textToStoryteller')
      .send({ sessionId, playerId, text: fragment, count: 1, debug: true, mockImage: true })
      .expect(200);

    expect(storytellerRes.body.storytellers?.length).toBe(1);
    const storytellerId = storytellerRes.body.storytellers[0]._id;
    expect(storytellerId).toBeTruthy();
    expect(storytellerRes.body.storytellers[0].illustration).toBeTruthy();
    expect(storytellerRes.body.storytellers[0].playerId).toBe(playerId);

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

import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let NarrativeFragment;
let OrreryAlignment;
let OrreryFigurineLevel;
let mongoServer;

jest.setTimeout(30000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({ NarrativeFragment } = await import('./models/models.js'));
  ({ OrreryAlignment, OrreryFigurineLevel } = await import('./models/orrery_models.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  await NarrativeFragment.deleteMany({});
  await OrreryAlignment.deleteMany({});
  await OrreryFigurineLevel.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('orrery page texture API', () => {
  test('resolves a curated Orrery vector and persists the texture identity into session world state', async () => {
    const sessionId = 'orrery-page-texture-session';

    const response = await request(app)
      .post('/api/typewriter/orrery/page-texture')
      .send({
        sessionId,
        vector: {
          crown: 4,
          veil: 3,
          warden: 2,
          forge: 0,
          hollow: 0,
          rift: 0,
          verdant: 0
        }
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        alignmentKey: 'crown4_veil3_warden2',
        title: 'The Haunted Border Kingdom',
        mood: expect.stringContaining('haunted monarchy'),
        materialText: expect.stringContaining('Royal archival vellum'),
        assetStatus: 'missing',
        sessionId
      })
    );
    expect(response.body.paperTexturePrompt).toContain('The upper 65% remains mostly empty and readable');
    expect(response.body.paperTexturePrompt).toContain('No readable text');
    expect(response.body.worldState).toEqual(
      expect.objectContaining({
        current_vibe: 'crown4_veil3_warden2',
        orrery_vector: expect.objectContaining({
          crown: 4,
          veil: 3,
          warden: 2
        }),
        page_texture_identity: expect.objectContaining({
          alignmentKey: 'crown4_veil3_warden2',
          assetStatus: 'missing'
        })
      })
    );

    const stored = await NarrativeFragment.findOne({
      session_id: sessionId,
      turn: 0
    }).lean();
    expect(stored.worldState.page_texture_identity.title).toBe('The Haunted Border Kingdom');
  });

  test('returns a composed identity for an uncurated vector and stores it as a new alignment', async () => {
    const response = await request(app)
      .post('/api/typewriter/orrery/page-texture')
      .send({
        vector: {
          forge: 4,
          hollow: 2
        }
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        alignmentKey: 'forge4_hollow2',
        dominantArchetype: 'forge',
        secondaryArchetype: 'hollow',
        assetStatus: 'missing'
      })
    );

    const stored = await OrreryAlignment.findOne({
      alignmentKey: 'forge4_hollow2'
    }).lean();
    expect(stored).toBeTruthy();
    expect(stored.paperTexturePrompt).toContain('The lower 35% gradually reveals');
  });

  test('rejects missing vectors', async () => {
    const response = await request(app)
      .post('/api/typewriter/orrery/page-texture')
      .send({ sessionId: 'missing-vector-session' })
      .expect(400);

    expect(response.body.error).toBe('Missing Orrery vector.');
  });
});

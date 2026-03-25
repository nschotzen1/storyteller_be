import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let Storyteller;
let NarrativeFragment;
let NarrativeEntity;
let TypewriterKey;
let mongoServer;

jest.setTimeout(30000);

const buildNarrative = (wordCount) =>
  Array.from({ length: wordCount }, (_, index) => `word${index + 1}`).join(' ');

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

describe('typewriter dynamic keys', () => {
  test('session start returns and persists the builtin Xerofag key', async () => {
    const sessionId = 'typewriter-builtin-key-session';

    const response = await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(5)
      })
      .expect(200);

    expect(response.body.typewriterKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyText: 'THE XEROFAG',
          insertText: 'The Xerofag',
          sourceType: 'builtin',
          keyImageUrl: '/textures/keys/THE_XEROFAG_1.png',
          knowledgeState: 'hidden',
          playerFacingTooltip: ''
        })
      ])
    );

    const savedKey = await TypewriterKey.findOne({
      session_id: sessionId,
      keyText: 'THE XEROFAG',
      sourceType: 'builtin'
    }).lean();
    expect(savedKey).toBeTruthy();
    expect(savedKey.insertText).toBe('The Xerofag');
    expect(savedKey.keyImageUrl).toBe('/textures/keys/THE_XEROFAG_1.png');
    expect(savedKey.knowledgeState).toBe('hidden');
    expect(savedKey.playerFacingTooltip).toBe('');
  });

  test('generic typewriter key verification allows the builtin Xerofag key in mock mode when the narrative supports it', async () => {
    const sessionId = 'typewriter-xerofag-verification-session';

    await request(app)
      .post('/api/typewriter/session/start')
      .send({ sessionId, fragment: 'The bone hound kept howling near the haunted grave.' })
      .expect(200);

    const response = await request(app)
      .post('/api/typewriter/keys/shouldAllow')
      .send({
        sessionId,
        keyText: 'THE XEROFAG',
        currentNarrative: 'The bone hound kept howling near the haunted grave.',
        mocked_api_calls: true
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        allowed: true,
        appendedText: ' The Xerofag'
      })
    );
    expect(response.body.key).toEqual(
      expect.objectContaining({
        keyText: 'THE XEROFAG',
        sourceType: 'builtin'
      })
    );
  });

  test('storyteller intervention creates a dynamic textual key that can be verified through the shared route', async () => {
    const sessionId = 'typewriter-storyteller-key-verification-session';

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

    const dynamicKey = interventionResponse.body.typewriterKey;
    expect(dynamicKey).toBeTruthy();

    const verificationResponse = await request(app)
      .post('/api/typewriter/keys/shouldAllow')
      .send({
        sessionId,
        keyId: dynamicKey.id,
        currentNarrative: 'word1 word2 word3',
        mocked_api_calls: true
      })
      .expect(200);

    expect(verificationResponse.body).toEqual(
      expect.objectContaining({
        allowed: true,
        key: expect.objectContaining({
          keyText: dynamicKey.keyText,
          sourceType: 'storyteller_intervention'
        })
      })
    );
    expect(typeof verificationResponse.body.appendedText).toBe('string');
    expect(verificationResponse.body.appendedText.trim()).toBe(dynamicKey.insertText);
  });

  test('session inspector returns fragment, storyteller slots, typewriter keys, storytellers, and linked entities together', async () => {
    const sessionId = 'typewriter-session-inspector-session';

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

    await request(app)
      .post('/api/send_storyteller_typewriter_text')
      .send({
        sessionId,
        storytellerId: String(storyteller._id),
        mocked_api_calls: true
      })
      .expect(200);

    const response = await request(app)
      .get('/api/typewriter/session/inspect')
      .query({ sessionId })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        sessionId,
        fragment: expect.any(String),
        slots: expect.any(Array),
        typewriterKeys: expect.arrayContaining([
          expect.objectContaining({
            keyText: 'THE XEROFAG',
            knowledgeState: 'hidden'
          })
        ]),
        storytellers: expect.arrayContaining([
          expect.objectContaining({
            name: storyteller.name,
            keySlotIndex: 0
          })
        ]),
        entities: expect.arrayContaining([
          expect.objectContaining({
            typewriterKeyText: expect.any(String),
            activeInTypewriter: true
          })
        ]),
        counts: expect.objectContaining({
          storytellerCount: 1,
          typewriterKeyCount: expect.any(Number),
          entityCount: expect.any(Number)
        })
      })
    );
  });
});

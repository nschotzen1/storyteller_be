import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockCallJsonLlm = jest.fn();
const mockDirectExternalApiCall = jest.fn();
const mockListAvailableOpenAiModels = jest.fn().mockResolvedValue({
  source: 'mock',
  fetchedAt: '2026-03-21T00:00:00.000Z',
  textModels: [],
  imageModels: [],
  allModels: []
});
const mockListAvailableAnthropicModels = jest.fn().mockResolvedValue({
  source: 'mock',
  fetchedAt: '2026-03-21T00:00:00.000Z',
  textModels: [],
  imageModels: [],
  allModels: []
});
const mockTextToImageOpenAi = jest.fn();

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  callJsonLlm: mockCallJsonLlm,
  directExternalApiCall: mockDirectExternalApiCall,
  listAvailableOpenAiModels: mockListAvailableOpenAiModels,
  listAvailableAnthropicModels: mockListAvailableAnthropicModels
}));

await jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
  textToImageOpenAi: mockTextToImageOpenAi
}));

const { app } = await import('./server_new.js');
const { Storyteller, NarrativeFragment } = await import('./models/models.js');

let mongoServer;

const buildNarrative = (wordCount) =>
  Array.from({ length: wordCount }, (_, index) => `word${index + 1}`).join(' ');

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  jest.clearAllMocks();
  await Storyteller.deleteMany({});
  await NarrativeFragment.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('POST /api/shouldCreateStorytellerKey', () => {
  test('backfills missing key_shape and shape_prompt_hint before schema validation', async () => {
    const sessionId = 'storyteller-schema-backfill-session';

    mockCallJsonLlm.mockResolvedValueOnce({
      storytellers: [
        {
          name: 'Elias Rhode',
          immediate_ghost_appearance: 'A narrow figure gathers in the salt mist with ink-dark cuffs.',
          typewriter_key: {
            symbol: 'storm ledger',
            description: 'A worn key face of soot-dark brass with a dim tide-polished gleam.'
          },
          influences: ['Mervyn Peake'],
          known_universes: ['Buraha Sea'],
          level: 8,
          voice_creation: {
            voice: 'measured',
            age: 'middle-aged',
            style: 'precise and haunted'
          }
        }
      ]
    });

    mockTextToImageOpenAi.mockResolvedValueOnce({
      imageUrl: null,
      localPath: '/tmp/storyteller-key-backfill.png'
    });

    await request(app)
      .post('/api/typewriter/session/start')
      .send({
        sessionId,
        fragment: buildNarrative(36)
      })
      .expect(200);

    const response = await request(app)
      .post('/api/shouldCreateStorytellerKey')
      .send({ sessionId })
      .expect(200);

    expect(response.body.created).toBe(true);
    expect(response.body.slots[0]).toEqual(
      expect.objectContaining({
        filled: true,
        storytellerName: 'Elias Rhode'
      })
    );

    const savedStoryteller = await Storyteller.findOne({
      session_id: sessionId,
      keySlotIndex: 0
    }).lean();

    expect(savedStoryteller).toBeTruthy();
    expect(savedStoryteller.typewriter_key).toEqual(
      expect.objectContaining({
        symbol: 'storm ledger',
        description: 'A worn key face of soot-dark brass with a dim tide-polished gleam.',
        key_shape: 'horizontal',
        shape_prompt_hint: expect.any(String),
        blank_shape: 'wide horizontal storyteller key slot',
        blank_texture_url: '/textures/keys/blank_horizontal_1.png'
      })
    );
  });
});

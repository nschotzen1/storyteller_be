import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

let app;
let QuestScreenGraph;

jest.setTimeout(20000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ QuestScreenGraph } = await import('./models/models.js'));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
});

afterEach(async () => {
  if (QuestScreenGraph) {
    await QuestScreenGraph.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe('Quest Screen API', () => {
  test('GET /api/quest/screens returns a scoped config payload', async () => {
    const response = await request(app)
      .get('/api/quest/screens')
      .query({ sessionId: 'quest-test-session', questId: 'quest-test-id' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        sessionId: 'quest-test-session',
        questId: 'quest-test-id',
        startScreenId: expect.any(String),
        screens: expect.any(Array),
        updatedAt: expect.any(String)
      })
    );
    expect(response.body.screens.length).toBeGreaterThan(0);
    expect(response.body.screens[0]).toEqual(
      expect.objectContaining({
        image_prompt: expect.any(String)
      })
    );
  });

  test('PUT /api/admin/quest/screens saves scoped config and GET returns it', async () => {
    const payload = {
      sessionId: 'quest-save-session',
      questId: 'quest-save-id',
      startScreenId: 'gate',
      screens: [
        {
          id: 'gate',
          title: 'Gate',
          prompt: 'You stand before a narrow gate.',
          imageUrl: '/ruin_south_a.png',
          image_prompt: 'Ruined gate at dusk, cinematic fantasy ruins atmosphere.',
          textPromptPlaceholder: 'What now?',
          directions: [
            { direction: 'north', label: 'Enter', targetScreenId: 'hall' }
          ]
        },
        {
          id: 'hall',
          title: 'Hall',
          prompt: 'A long hall filled with dust.',
          imageUrl: '/arenas/petal_hex_v1.png',
          image_prompt: 'Collapsed hall of stone columns and drifting dust motes.',
          textPromptPlaceholder: 'Speak your intent.',
          directions: [
            { direction: 'south', label: 'Back', targetScreenId: 'gate' }
          ]
        }
      ]
    };

    const saveResponse = await request(app)
      .put('/api/admin/quest/screens')
      .send(payload);

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body.sessionId).toBe(payload.sessionId);
    expect(saveResponse.body.questId).toBe(payload.questId);
    expect(saveResponse.body.startScreenId).toBe('gate');
    expect(saveResponse.body.screens).toHaveLength(2);

    const getResponse = await request(app)
      .get('/api/quest/screens')
      .query({ sessionId: payload.sessionId, questId: payload.questId });

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.startScreenId).toBe('gate');
    expect(getResponse.body.screens.map((screen) => screen.id)).toEqual(['gate', 'hall']);
    expect(getResponse.body.screens[0].image_prompt).toBeTruthy();
  });

  test('PUT /api/admin/quest/screens rejects invalid payloads', async () => {
    const response = await request(app)
      .put('/api/admin/quest/screens')
      .send({
        sessionId: 'quest-validation-session',
        questId: 'quest-validation-id',
        startScreenId: 'a',
        screens: [
          {
            id: 'a',
            title: 'A',
            prompt: 'A prompt',
            imageUrl: '',
            image_prompt: '',
            textPromptPlaceholder: 'A placeholder',
            directions: [
              { direction: 'north', label: 'Nope', targetScreenId: 'missing-screen' }
            ]
          }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid quest screen payload.');
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.join(' ')).toContain('missing-screen');
    expect(response.body.errors.join(' ')).toContain('image_prompt');
  });

  test('traversal write/read endpoints persist events in scope', async () => {
    const scope = { sessionId: 'quest-travel-session', questId: 'quest-travel-id' };

    const writeResponse = await request(app)
      .post('/api/quest/traversal')
      .send({
        ...scope,
        playerId: 'wanderer-01',
        fromScreenId: 'outer_gate_murals',
        toScreenId: 'mural_center_panel',
        direction: 'north',
        promptText: 'The stone remembers footsteps.'
      });

    expect(writeResponse.status).toBe(201);
    expect(writeResponse.body).toEqual(
      expect.objectContaining({
        sessionId: scope.sessionId,
        questId: scope.questId,
        traversalCount: 1
      })
    );
    expect(writeResponse.body.event).toEqual(
      expect.objectContaining({
        toScreenId: 'mural_center_panel',
        direction: 'north'
      })
    );

    const listResponse = await request(app)
      .get('/api/quest/traversal')
      .query(scope);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.sessionId).toBe(scope.sessionId);
    expect(listResponse.body.questId).toBe(scope.questId);
    expect(Array.isArray(listResponse.body.traversal)).toBe(true);
    expect(listResponse.body.traversal).toHaveLength(1);
    expect(listResponse.body.traversal[0].toScreenId).toBe('mural_center_panel');
  });

  test('POST /api/quest/advance creates a persistent generated child screen with runtime and mock metadata', async () => {
    const scope = { sessionId: 'quest-advance-session', questId: 'quest-advance-id' };

    const response = await request(app)
      .post('/api/quest/advance')
      .send({
        ...scope,
        playerId: 'wanderer-02',
        currentScreenId: 'outer_gate_murals',
        actionType: 'prompt',
        promptText: 'inspect the cracked lantern niche behind the center mural',
        mock: true
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        sessionId: scope.sessionId,
        questId: scope.questId,
        actionType: 'prompt',
        traversalCount: 1,
        mocked: true
      })
    );
    expect(response.body.runtime).toEqual(
      expect.objectContaining({
        pipeline: 'quest_generation',
        provider: expect.any(String),
        model: expect.any(String),
        mocked: true
      })
    );
    expect(response.body.mockedData).toEqual(
      expect.objectContaining({
        source: 'deterministic-quest-generator',
        currentScreenId: 'outer_gate_murals',
        anchorScreenId: 'outer_gate_murals',
        promptPayload: expect.any(Object),
        plan: expect.objectContaining({
          title: expect.any(String),
          direction_label: expect.any(String),
          stage_layout: expect.any(String)
        })
      })
    );
    expect(response.body.createdScreen).toEqual(
      expect.objectContaining({
        screenType: 'generated',
        parentScreenId: 'outer_gate_murals',
        anchorScreenId: 'outer_gate_murals',
        generatedByPlayerId: 'wanderer-02',
        generatedFromPrompt: expect.stringContaining('inspect the cracked lantern niche'),
        image_prompt: expect.any(String),
        expectationSummary: expect.any(String),
        continuitySummary: expect.any(String),
        stageLayout: expect.any(String),
        stageModules: expect.any(Array)
      })
    );
    expect(response.body.createdScreen.stageModules.length).toBeGreaterThan(0);
    expect(response.body.screen.id).toBe(response.body.createdScreen.id);

    const getResponse = await request(app)
      .get('/api/quest/screens')
      .query(scope);

    expect(getResponse.status).toBe(200);
    const parentScreen = getResponse.body.screens.find((screen) => screen.id === 'outer_gate_murals');
    const generatedScreen = getResponse.body.screens.find((screen) => screen.id === response.body.createdScreen.id);
    expect(parentScreen).toBeTruthy();
    expect(generatedScreen).toBeTruthy();
    expect(parentScreen.directions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'prompt',
          targetScreenId: generatedScreen.id
        })
      ])
    );
    expect(generatedScreen.stageModules.length).toBeGreaterThan(0);

    const traversalResponse = await request(app)
      .get('/api/quest/traversal')
      .query(scope);

    expect(traversalResponse.status).toBe(200);
    expect(traversalResponse.body.traversal).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromScreenId: 'outer_gate_murals',
          toScreenId: generatedScreen.id,
          direction: 'prompt',
          promptText: 'inspect the cracked lantern niche behind the center mural'
        })
      ])
    );
  });
});

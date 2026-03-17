import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';

let app;
let QuestScreenGraph;
let ChatMessage;
let MessengerSceneBrief;

jest.setTimeout(20000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ QuestScreenGraph, ChatMessage, MessengerSceneBrief } = await import('./models/models.js'));

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
  if (ChatMessage) {
    await ChatMessage.deleteMany({});
  }
  if (MessengerSceneBrief) {
    await MessengerSceneBrief.deleteMany({});
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
      authoringBrief: 'A compact authored scene about a threshold and a hidden signal.',
      phaseGuidance: 'Keep the scene constrained to the gate and hall until the player commits to entering.',
      visualStyleGuide: 'Twilight stone, tactile ruin surfaces, and a consistent windswept palette.',
      screens: [
        {
          id: 'gate',
          title: 'Gate',
          prompt: 'You stand before a narrow gate.',
          imageUrl: '/ruin_south_a.png',
          image_prompt: 'Ruined gate at dusk, cinematic fantasy ruins atmosphere.',
          referenceImagePrompt: 'Wide dusk shot of a narrow ruined gate framed by fallen stone and evening haze.',
          promptGuidance: 'Keep the player focused on the threshold and the signal hidden nearby.',
          sceneEndCondition: 'The screen ends when the player enters or deliberately retreats.',
          visualContinuityGuidance: 'Carry the same dusk stone palette into the hall beyond.',
          visualTransitionIntent: 'drift',
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
          referenceImagePrompt: 'Interior ruin hall with drifting dust, broken columns, and pale light from a collapsed roof.',
          visualTransitionIntent: 'inherit',
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
    expect(saveResponse.body.authoringBrief).toBe(payload.authoringBrief);
    expect(saveResponse.body.phaseGuidance).toBe(payload.phaseGuidance);
    expect(saveResponse.body.visualStyleGuide).toBe(payload.visualStyleGuide);
    expect(saveResponse.body.screens).toHaveLength(2);

    const getResponse = await request(app)
      .get('/api/quest/screens')
      .query({ sessionId: payload.sessionId, questId: payload.questId });

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.startScreenId).toBe('gate');
    expect(getResponse.body.authoringBrief).toBe(payload.authoringBrief);
    expect(getResponse.body.phaseGuidance).toBe(payload.phaseGuidance);
    expect(getResponse.body.visualStyleGuide).toBe(payload.visualStyleGuide);
    expect(getResponse.body.screens.map((screen) => screen.id)).toEqual(['gate', 'hall']);
    expect(getResponse.body.screens[0].image_prompt).toBeTruthy();
    expect(getResponse.body.screens[0].referenceImagePrompt).toBe(payload.screens[0].referenceImagePrompt);
    expect(getResponse.body.screens[0].promptGuidance).toBe(payload.screens[0].promptGuidance);
    expect(getResponse.body.screens[0].sceneEndCondition).toBe(payload.screens[0].sceneEndCondition);
    expect(getResponse.body.screens[0].visualContinuityGuidance).toBe(payload.screens[0].visualContinuityGuidance);
    expect(getResponse.body.screens[0].visualTransitionIntent).toBe(payload.screens[0].visualTransitionIntent);
    expect(getResponse.body.screens[1].referenceImagePrompt).toBe(payload.screens[1].referenceImagePrompt);
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

  test('POST /api/admin/quest/debug-context returns authored route diagnostics and compiled prompt data', async () => {
    const scope = { sessionId: 'quest-debug-session', questId: 'quest-debug-id' };
    const payload = {
      ...scope,
      startScreenId: 'gate',
      phaseGuidance: 'Keep the scene grounded in the gatehouse and refuse exits that do not belong to the ruin.',
      promptRoutes: [
        {
          id: 'listen-radio',
          description: 'Listening for the hidden transmission should reveal the radio niche.',
          fromScreenIds: ['gate'],
          matchMode: 'any',
          patterns: ['radio', 'signal', 'static'],
          targetScreenId: 'niche'
        }
      ],
      screens: [
        {
          id: 'gate',
          title: 'Gate',
          prompt: 'A weathered gate stands open to the dusk.',
          imageUrl: '/ruin_south_a.png',
          image_prompt: 'A weathered gate at dusk, painterly and windswept.',
          promptGuidance: 'Keep attention on the sound in the stone and the feeling that something is hidden nearby.',
          sceneEndCondition: 'The scene ends when the player locates the radio niche or deliberately leaves through the gate.',
          textPromptPlaceholder: 'What do you do?',
          directions: [
            { direction: 'north', label: 'Step inside', targetScreenId: 'niche' }
          ]
        },
        {
          id: 'niche',
          title: 'Radio Niche',
          prompt: 'A narrow recess in the wall holds the source of the static.',
          imageUrl: '/arenas/petal_hex_v1.png',
          image_prompt: 'A narrow radio niche carved into ruined stone.',
          textPromptPlaceholder: 'What do you do next?',
          directions: [
            { direction: 'south', label: 'Back to the gate', targetScreenId: 'gate' }
          ]
        }
      ]
    };

    const saveResponse = await request(app)
      .put('/api/admin/quest/screens')
      .send(payload);

    expect(saveResponse.status).toBe(200);

    const debugResponse = await request(app)
      .post('/api/admin/quest/debug-context')
      .send({
        ...scope,
        currentScreenId: 'gate',
        promptText: 'listen for the faint radio static behind the gate stones'
      });

    expect(debugResponse.status).toBe(200);
    expect(debugResponse.body).toEqual(
      expect.objectContaining({
        sessionId: scope.sessionId,
        questId: scope.questId,
        wouldBypassGeneration: true,
        compiledPrompt: expect.any(String),
        promptPayload: expect.objectContaining({
          currentScreenId: 'gate',
          currentScreenPromptGuidance: payload.screens[0].promptGuidance,
          currentScreenSceneEndCondition: payload.screens[0].sceneEndCondition,
          phaseGuidance: payload.phaseGuidance
        }),
        promptMessages: expect.any(Array),
        authoredRouteMatch: expect.objectContaining({
          id: 'listen-radio',
          targetScreenId: 'niche'
        }),
        runtime: expect.objectContaining({
          pipeline: 'quest_generation',
          provider: expect.any(String),
          model: expect.any(String)
        }),
        promptSource: expect.objectContaining({
          source: expect.any(String)
        })
      })
    );
    expect(debugResponse.body.authoredRouteDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'listen-radio',
          appliesToCurrentScreen: true,
          matched: true,
          targetScreenId: 'niche'
        })
      ])
    );
  });

  test('POST /api/admin/quest/authoring-draft returns reviewable mock changes without saving them', async () => {
    const scope = { sessionId: 'quest-authoring-session', questId: 'quest-authoring-id' };
    const response = await request(app)
      .post('/api/admin/quest/authoring-draft')
      .send({
        ...scope,
        mode: 'fill_missing',
        selectedScreenId: 'gate',
        mock: true,
        config: {
          ...scope,
          startScreenId: 'gate',
          authoringBrief: 'An authored opening scene with a gate, a hidden signal, and a hall beyond.',
          screens: [
            {
              id: 'gate',
              title: 'Gate',
              prompt: 'A weathered gate stands open to the dusk.',
              imageUrl: '/ruin_south_a.png',
              image_prompt: '',
              referenceImagePrompt: '',
              textPromptPlaceholder: 'What do you do?',
              directions: [
                { direction: 'north', label: 'Enter the hall', targetScreenId: 'hall' }
              ]
            },
            {
              id: 'hall',
              title: 'Hall',
              prompt: 'A hall waits beyond the threshold.',
              imageUrl: '/arenas/petal_hex_v1.png',
              image_prompt: 'A dusty hall beyond a gate, cinematic fantasy ruins.',
              referenceImagePrompt: '',
              textPromptPlaceholder: 'What next?',
              directions: [
                { direction: 'south', label: 'Back to the gate', targetScreenId: 'gate' }
              ]
            }
          ]
        }
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        sessionId: scope.sessionId,
        questId: scope.questId,
        mode: 'fill_missing',
        selectedScreenId: 'gate',
        mocked: true,
        summary: expect.any(String),
        changes: expect.any(Array),
        runtime: expect.objectContaining({
          pipeline: 'quest_scene_authoring',
          mocked: true
        })
      })
    );
    expect(response.body.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'set_scene_field',
          field: 'phaseGuidance'
        }),
        expect.objectContaining({
          action: 'set_screen_field',
          targetId: 'gate',
          field: 'promptGuidance'
        })
      ])
    );

    const getResponse = await request(app)
      .get('/api/quest/screens')
      .query(scope);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.authoringBrief).not.toBe('An authored opening scene with a gate, a hidden signal, and a hall beyond.');
  });

  test('rose-court materialization requires a mural choice before the inner court', async () => {
    const scope = {
      sessionId: 'rose-court-materialize-session',
      questId: 'rose_court_prologue_phase_1',
      playerId: 'rose-court-tester'
    };

    const locationReply = await request(app)
      .post('/api/messenger/chat')
      .send({
        sessionId: scope.sessionId,
        sceneId: 'rose_court_clerk_location',
        message: 'Bar Facal, Avenida 18 de Julio 1249, Montevideo, Uruguay.'
      });

    expect(locationReply.status).toBe(200);
    expect(locationReply.body.has_chat_ended).toBe(true);

    const materializeResponse = await request(app)
      .post('/api/rose-court/prologue/materialize-location')
      .send({
        ...scope,
        sceneId: 'rose_court_clerk_location',
        fromScreenId: 'phone_found'
      });

    expect(materializeResponse.status).toBe(200);
    expect(materializeResponse.body.screen.id).toBe('location_mural_gallery');

    const galleryScreen = materializeResponse.body.config.screens.find((screen) => screen.id === 'location_mural_gallery');
    const variantScreen = materializeResponse.body.config.screens.find((screen) => screen.id === 'location_mural_high_room');

    expect(galleryScreen).toBeTruthy();
    expect(galleryScreen.directions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ targetScreenId: 'location_mural_high_room' }),
        expect.objectContaining({ targetScreenId: 'location_mural_weather_cabin' }),
        expect.objectContaining({ targetScreenId: 'location_mural_quiet_cottage' })
      ])
    );
    expect(galleryScreen.directions.some((direction) => direction.targetScreenId === 'inner_court_well_approach')).toBe(false);

    expect(variantScreen).toBeTruthy();
    expect(variantScreen.directions).toHaveLength(2);
    expect(variantScreen.directions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'forward',
          targetScreenId: 'inner_court_well_approach'
        }),
        expect.objectContaining({
          direction: 'back',
          targetScreenId: 'location_mural_gallery'
        })
      ])
    );
  });
});

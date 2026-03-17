import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let MessengerSceneBrief;
let ImmersiveRpgSceneSession;
let ImmersiveRpgCharacterSheet;
let TypewriterPromptTemplate;
let mongoServer;

jest.setTimeout(30000);

function getRouteHandlers(method, routePath) {
  const stack = app?._router?.stack || [];
  const layer = stack.find((entry) =>
    entry?.route
    && entry.route.path === routePath
    && entry.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${routePath} not found.`);
  }

  return layer.route.stack.map((entry) => entry.handle);
}

async function invokeRoute(method, routePath, { body = {}, query = {}, params = {}, headers = {} } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  );
  const handlers = getRouteHandlers(method, routePath);

  return new Promise((resolve, reject) => {
    let statusCode = 200;
    let settled = false;
    let index = 0;

    const req = {
      method: method.toUpperCase(),
      path: routePath,
      originalUrl: routePath,
      body,
      query,
      params,
      headers: normalizedHeaders,
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()];
      }
    };

    const finalize = (payload) => {
      if (settled) return;
      settled = true;
      resolve({ status: statusCode, body: payload });
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        finalize(payload);
        return this;
      },
      send(payload) {
        finalize(payload);
        return this;
      }
    };

    const runNext = () => {
      if (settled) return;
      const handler = handlers[index];
      index += 1;

      if (!handler) {
        finalize(undefined);
        return;
      }

      try {
        const maybePromise = handler(req, res, (error) => {
          if (error) {
            reject(error);
            return;
          }
          runNext();
        });

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    };

    runNext();
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create({
    instance: {
      ip: '127.0.0.1',
      port: 0
    }
  });
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({
    MessengerSceneBrief,
    ImmersiveRpgSceneSession,
    ImmersiveRpgCharacterSheet,
    TypewriterPromptTemplate
  } = await import('./models/models.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  if (MessengerSceneBrief) {
    await MessengerSceneBrief.deleteMany({});
  }
  if (ImmersiveRpgSceneSession) {
    await ImmersiveRpgSceneSession.deleteMany({});
  }
  if (ImmersiveRpgCharacterSheet) {
    await ImmersiveRpgCharacterSheet.deleteMany({});
  }
  if (TypewriterPromptTemplate) {
    await TypewriterPromptTemplate.deleteMany({});
  }
  if (app) {
    await invokeRoute('post', '/api/admin/typewriter/ai-settings/reset', {
      body: {
        updatedBy: 'immersive-rpg-test-reset'
      }
    });
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('immersive RPG scene skeleton APIs', () => {
  test('returns a blocked scene envelope when required persisted context is missing', async () => {
    const response = await invokeRoute('get', '/api/immersive-rpg/scene', {
      query: {
        sessionId: 'immersive-rpg-missing-context'
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(false);
    expect(response.body.currentSceneNumber).toBe(3);
    expect(response.body.currentSceneKey).toBe('scene_3_mysterious_encounter');
    expect(response.body.missingContext).toEqual(['messenger_scene_brief']);
    expect(response.body.mockedContext).toEqual([]);
    expect(response.body.scene).toBeNull();
    expect(response.body.characterSheet).toBeNull();
  });

  test('bootstraps the first immersive scene from the messenger scene brief', async () => {
    const sessionId = 'immersive-rpg-boot';

    await MessengerSceneBrief.create({
      sessionId,
      sceneId: 'messanger',
      subject: 'Rainpath guesthouse threshold',
      placeName: 'The Rainpath Guesthouse',
      placeSummary:
        'A weather-soft guesthouse sits just above a wet path and a patch of thorny growth, with a private routine to it that makes any intrusion feel immediately intimate.',
      typewriterHidingSpot:
        'A narrow cedar recess behind the kitchen shelves where groceries can be tucked out of sight.',
      sensoryDetails: ['wet earth after drizzle', 'distant harbor metal', 'the hush of brush moving'],
      notableFeatures: ['thorny pathside nook', 'kitchen shelves', 'guesthouse eaves'],
      sceneEstablished: true,
      source: 'test'
    });

    const response = await invokeRoute('get', '/api/immersive-rpg/scene', {
      query: {
        sessionId,
        playerName: 'Iris Vale'
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.bootstrapped).toBe(true);
    expect(response.body.scene).toEqual(
      expect.objectContaining({
        sessionId,
        currentSceneNumber: 3,
        currentSceneKey: 'scene_3_mysterious_encounter',
        currentBeat: 'encounter_setup'
      })
    );
    expect(response.body.scene.transcript).toHaveLength(1);
    expect(response.body.scene.transcript[0].text).toContain('What do you do?');
    expect(response.body.scene.sourceSceneBrief.placeName).toBe('The Rainpath Guesthouse');
    expect(response.body.characterSheet.playerName).toBe('Iris Vale');
    expect(response.body.scene.notebook).toEqual(
      expect.objectContaining({
        mode: 'story_prompt',
        title: 'Scene Notes'
      })
    );
    expect(response.body.scene.stageLayout).toBe('focus-left');
    expect(response.body.scene.stageModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'illustration'
        })
      ])
    );

    const storedScene = await ImmersiveRpgSceneSession.findOne({ sessionId }).lean();
    expect(storedScene).toBeTruthy();
    expect(storedScene.transcript).toHaveLength(1);
    expect(storedScene.notebook).toBeTruthy();
    expect(storedScene.stageLayout).toBe('focus-left');
    expect(Array.isArray(storedScene.stageModules)).toBe(true);
    expect(storedScene.stageModules.length).toBeGreaterThan(0);

    const storedSheet = await ImmersiveRpgCharacterSheet.findOne({ sessionId, playerId: 'pc' }).lean();
    expect(storedSheet).toBeTruthy();
    expect(storedSheet.playerName).toBe('Iris Vale');
  });

  test('uses the saved immersive RPG admin prompt when compiling scene state', async () => {
    const sessionId = 'immersive-rpg-prompt-binding';

    await MessengerSceneBrief.create({
      sessionId,
      sceneId: 'messanger',
      subject: 'Prompt binding house',
      placeName: 'The Prompt House',
      placeSummary:
        'A carefully described house with enough concrete texture to stage the encounter and anchor the GM prompt.',
      typewriterHidingSpot:
        'A cedar nook tucked beside the pantry shelf where only the resident would think to leave provisions.',
      sensoryDetails: ['soft rain', 'cedar dust', 'cold iron'],
      notableFeatures: ['pantry shelf', 'cedar nook', 'rain-dark path'],
      sceneEstablished: true,
      source: 'test'
    });

    const savedPrompt = await invokeRoute('post', '/api/admin/typewriter/prompts/:pipelineKey', {
      params: { pipelineKey: 'immersive_rpg_gm' },
      body: {
        promptTemplate: 'ADMIN IMMERSE PROMPT HEADER\nKeep the scene tense and ask what the PC does.',
        updatedBy: 'immersive-rpg-test',
        markLatest: true
      }
    });

    expect(savedPrompt.status).toBe(201);

    const response = await invokeRoute('get', '/api/immersive-rpg/scene', {
      query: { sessionId }
    });

    expect(response.status).toBe(200);
    expect(response.body.scene.compiledPrompt).toContain('ADMIN IMMERSE PROMPT HEADER');
    expect(response.body.scene.compiledPrompt).toContain('Runtime JSON Schema');
    expect(response.body.scene.compiledPrompt).toContain('"notebook"');
    expect(response.body.scene.compiledPrompt).toContain('"stage_layout"');
    expect(response.body.scene.compiledPrompt).toContain('"stage_modules"');
  });

  test('uses mocked scene dependencies when immersive RPG mock mode is enabled', async () => {
    const sessionId = 'immersive-rpg-mocked-context';

    const updateSettings = await invokeRoute('put', '/api/admin/typewriter/ai-settings', {
      body: {
        updatedBy: 'immersive-rpg-test',
        pipelines: {
          immersive_rpg_gm: {
            useMock: true
          }
        }
      }
    });

    expect(updateSettings.status).toBe(200);

    const response = await invokeRoute('get', '/api/immersive-rpg/scene', {
      query: {
        sessionId,
        playerName: 'Iris Vale'
      }
    });

    expect(response.status).toBe(200);
    expect(response.body.ready).toBe(true);
    expect(response.body.mockedContext).toEqual(['messenger_scene_brief']);
    expect(response.body.scene).toEqual(
      expect.objectContaining({
        currentSceneNumber: 3,
        currentSceneKey: 'scene_3_mysterious_encounter'
      })
    );
    expect(response.body.scene.sourceSceneBrief).toEqual(
      expect.objectContaining({
        placeName: 'Basalt Guesthouse, Mourning Cove',
        source: 'immersive_rpg_mock'
      })
    );
  });

  test('persists chat turns, creates pending rolls, resolves roll outcomes, and saves the character sheet skeleton', async () => {
    const sessionId = 'immersive-rpg-loop';

    await MessengerSceneBrief.create({
      sessionId,
      sceneId: 'messanger',
      subject: 'Garden lane return',
      placeName: 'The Lane House',
      placeSummary:
        'A modest house stands at the end of a narrow lane with enough hedges and stone to offer privacy, and enough routine to make a stranger nearby feel immediately wrong.',
      typewriterHidingSpot:
        'A natural nook beside the path where groceries are tucked behind stone and roots.',
      sensoryDetails: ['cold greenery', 'damp stone', 'a wind from the road'],
      notableFeatures: ['lane hedges', 'stone nook', 'front step'],
      sceneEstablished: true,
      source: 'test'
    });

    const bootstrap = await invokeRoute('get', '/api/immersive-rpg/scene', {
      query: { sessionId }
    });

    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.ready).toBe(true);
    expect(bootstrap.body.scene.transcript).toHaveLength(1);

    const chat = await invokeRoute('post', '/api/immersive-rpg/chat', {
      body: {
        sessionId,
        message: 'I move for the journal and try to get it before the stranger notices me.',
        mocked_api_calls: true
      }
    });

    expect(chat.status).toBe(200);
    expect(chat.body.reply).toContain('Roll 5d6 Awareness');
    expect(chat.body.pendingRoll).toEqual(
      expect.objectContaining({
        contextKey: 'journal_retrieval',
        skill: 'awareness',
        diceNotation: '5d6'
      })
    );
    expect(chat.body.scene.notebook).toEqual(
      expect.objectContaining({
        mode: 'roll_request',
        title: 'Journal Margin Test'
      })
    );
    expect(chat.body.scene.notebook.pendingRoll).toEqual(
      expect.objectContaining({
        contextKey: 'journal_retrieval',
        diceNotation: '5d6'
      })
    );
    expect(chat.body.scene.currentBeat).toBe('journal_attempt');
    expect(chat.body.scene.transcript).toHaveLength(3);
    expect(chat.body.scene.stageLayout).toBe('focus-left');
    expect(chat.body.scene.stageModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'A Reach Too Visible'
        })
      ])
    );

    const roll = await invokeRoute('post', '/api/immersive-rpg/rolls', {
      body: { sessionId }
    });

    expect(roll.status).toBe(200);
    expect(roll.body.roll.diceNotation).toBe('5d6');
    expect(roll.body.roll.rolls).toHaveLength(5);
    expect(typeof roll.body.roll.passed).toBe('boolean');
    expect(['journal_glimpse', 'caught_at_journal']).toContain(roll.body.scene.currentBeat);
    expect(roll.body.scene.rollLog).toHaveLength(1);
    expect(roll.body.scene.pendingRoll).toBeNull();
    expect(roll.body.scene.notebook).toEqual(
      expect.objectContaining({
        mode: 'roll_result'
      })
    );
    expect(roll.body.scene.notebook.diceFaces).toHaveLength(5);
    expect(roll.body.scene.notebook.successTrack).toEqual(
      expect.objectContaining({
        successesRequired: 2
      })
    );
    expect(roll.body.scene.stageLayout).toMatch(/^(focus-left|focus-right|triptych|stacked)$/);
    expect(Array.isArray(roll.body.scene.stageModules)).toBe(true);
    expect(roll.body.scene.stageModules.length).toBeGreaterThan(0);

    const updatedSheet = await invokeRoute('put', '/api/immersive-rpg/character-sheet', {
      body: {
        sessionId,
        identity: {
          name: 'Iris Vale',
          occupation: 'Illustrator'
        },
        coreTraits: {
          drive: 'I need to know why my house was studied.'
        },
        skills: {
          awareness: 55,
          stealth: 40
        },
        inventory: ['house key', 'folding knife']
      }
    });

    expect(updatedSheet.status).toBe(200);
    expect(updatedSheet.body.characterSheet.identity.name).toBe('Iris Vale');
    expect(updatedSheet.body.characterSheet.skills.awareness).toBe(55);
    expect(updatedSheet.body.characterSheet.inventory).toEqual(['house key', 'folding knife']);

    const openApi = await invokeRoute('get', '/api/openapi.json');
    expect(openApi.status).toBe(200);
    expect(openApi.body.paths['/api/immersive-rpg/scene']).toBeDefined();
    expect(openApi.body.paths['/api/immersive-rpg/rolls']).toBeDefined();
    expect(openApi.body.paths['/api/immersive-rpg/character-sheet']).toBeDefined();
    expect(openApi.body.components.schemas.ImmersiveRpgStageModule).toBeDefined();
  });
});

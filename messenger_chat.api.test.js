import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let coerceLegacyMessengerAiResponse;
let buildMessengerPromptMessages;
let ChatMessage;
let MessengerSceneBrief;
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
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app, coerceLegacyMessengerAiResponse, buildMessengerPromptMessages } = await import('./server_new.js'));
  ({ ChatMessage, MessengerSceneBrief, TypewriterPromptTemplate } = await import('./models/models.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  if (ChatMessage) {
    await ChatMessage.deleteMany({});
  }
  if (MessengerSceneBrief) {
    await MessengerSceneBrief.deleteMany({});
  }
  if (TypewriterPromptTemplate) {
    await TypewriterPromptTemplate.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('messenger chat routes and admin exposure', () => {
  test('includes the premade messenger opener as explicit LLM context', () => {
    const prompts = buildMessengerPromptMessages(
      [
        {
          type: 'initial',
          sender: 'system',
          content: 'We are pleased to inform you that the typewriter is ready for dispatch.'
        },
        {
          type: 'user',
          sender: 'user',
          content: 'Send it to the attic above the harbor.'
        },
        {
          type: 'response',
          sender: 'system',
          content: 'Describe the room more vividly.'
        },
        {
          type: 'user',
          sender: 'user',
          content: 'There is a cedar wardrobe with a false back.'
        }
      ],
      'You are the Society courier. Return JSON only.',
      2
    );

    expect(prompts[0]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('You are the Society courier')
      })
    );
    expect(prompts[1]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('typewriter is ready for dispatch')
      })
    );
    expect(prompts.slice(2)).toEqual([
      {
        role: 'user',
        content: 'Send it to the attic above the harbor.'
      },
      {
        role: 'assistant',
        content: 'Describe the room more vividly.'
      },
      {
        role: 'user',
        content: 'There is a cedar wardrobe with a false back.'
      }
    ]);
  });

  test('coerces legacy final messenger payloads without scene_brief', () => {
    const coerced = coerceLegacyMessengerAiResponse(
      {
        has_chat_ended: true,
        message_assistant: 'Splendid. The Society has what it needs.'
      },
      {
        message: 'There is a cedar wardrobe with a false back in the attic room above the harbor.',
        historyDocs: [
          {
            sender: 'user',
            content: 'It will live in an attic room above the harbor beside a rain-marked window.'
          }
        ],
        existingSceneBrief: null
      }
    );

    expect(coerced.scene_brief).toEqual(
      expect.objectContaining({
        subject: expect.any(String),
        place_name: expect.any(String),
        place_summary: expect.any(String),
        typewriter_hiding_spot: expect.any(String)
      })
    );
  });

  test('supports canonical messenger flow, legacy alias, and reset', async () => {
    const sessionId = 'messanger-debug-flow';

    const initialHistory = await invokeRoute('get', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(initialHistory.status).toBe(200);
    expect(initialHistory.body.messages).toHaveLength(1);
    expect(initialHistory.body.messages[0]).toEqual(
      expect.objectContaining({
        sender: 'system',
        type: 'initial'
      })
    );
    expect(initialHistory.body.messages[0].text).toContain('typewriter');
    expect(initialHistory.body.sceneBrief).toBeNull();

    const firstReply = await invokeRoute('post', '/api/messenger/chat', {
      body: {
        sessionId,
        message: 'It will live in an attic room above the harbor beside a rain-marked window.',
        mocked_api_calls: true
      }
    });

    expect(firstReply.status).toBe(200);
    expect(firstReply.body.reply).toEqual(expect.any(String));
    expect(firstReply.body.runtime).toEqual(
      expect.objectContaining({
        pipeline: 'messenger_chat',
        mocked: true
      })
    );
    expect(firstReply.body.messages.filter((message) => message.sender === 'user')).toHaveLength(1);
    expect(firstReply.body.has_chat_ended).toBe(false);
    expect(firstReply.body.sceneBrief).toBeNull();

    const legacyAliasReply = await invokeRoute('post', '/api/sendMessage', {
      body: {
        sessionId,
        message: 'There is a cedar wardrobe with a false back where it can vanish without comment.',
        mocked_api_calls: true
      }
    });

    expect(legacyAliasReply.status).toBe(200);
    expect(legacyAliasReply.body.messages.filter((message) => message.type === 'initial')).toHaveLength(1);
    expect(legacyAliasReply.body.has_chat_ended).toBe(true);
    expect(legacyAliasReply.body.sceneBrief).toEqual(
      expect.objectContaining({
        subject: expect.any(String),
        typewriterHidingSpot: expect.stringMatching(/wardrobe|false back/i),
        sceneEstablished: true
      })
    );

    const storedCount = await ChatMessage.countDocuments({ sessionId, sceneId: 'messanger' });
    expect(storedCount).toBe(5);
    const sceneBriefCount = await MessengerSceneBrief.countDocuments({ sessionId, sceneId: 'messanger' });
    expect(sceneBriefCount).toBe(1);

    const deletion = await invokeRoute('delete', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(deletion.status).toBe(200);
    expect(deletion.body.deletedMessagesCount).toBe(5);
    expect(deletion.body.deletedSceneBriefCount).toBe(1);
    expect(deletion.body.deletedCount).toBe(6);

    const reloadedHistory = await invokeRoute('get', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(reloadedHistory.status).toBe(200);
    expect(reloadedHistory.body.messages).toHaveLength(1);
    expect(reloadedHistory.body.hasChatEnded).toBe(false);
    expect(reloadedHistory.body.sceneBrief).toBeNull();
  });

  test('sanitizes stale mongo messenger route configs that still require scene_brief', async () => {
    const staleConfigSave = await invokeRoute('post', '/api/admin/llm-config/:routeKey', {
      params: { routeKey: 'messenger_chat' },
      body: {
        promptMode: 'manual',
        promptTemplate: 'You are the Society courier. Return JSON only.',
        responseSchema: {
          type: 'object',
          required: ['has_chat_ended', 'message_assistant', 'scene_brief'],
          properties: {
            has_chat_ended: { type: 'boolean' },
            message_assistant: { type: 'string' },
            scene_brief: {
              type: 'object',
              required: ['subject', 'place_name', 'place_summary', 'typewriter_hiding_spot', 'sensory_details', 'notable_features', 'scene_established'],
              properties: {
                subject: { type: 'string' },
                place_name: { type: 'string' },
                place_summary: { type: 'string' },
                typewriter_hiding_spot: { type: 'string' },
                sensory_details: { type: 'array', items: { type: 'string' } },
                notable_features: { type: 'array', items: { type: 'string' } },
                scene_established: { type: 'boolean' }
              },
              additionalProperties: true
            }
          },
          additionalProperties: true
        },
        updatedBy: 'mongo-stale-config-test'
      }
    });

    expect(staleConfigSave.status).toBe(200);
    expect(staleConfigSave.body.responseSchema.required).toEqual(
      expect.arrayContaining(['has_chat_ended', 'message_assistant'])
    );
    expect(staleConfigSave.body.responseSchema.required).not.toContain('scene_brief');

    const reply = await invokeRoute('post', '/api/messenger/chat', {
      body: {
        sessionId: 'mongo-stale-schema',
        message: 'Send it to the attic room above the harbor.',
        mocked_api_calls: true
      }
    });

    expect(reply.status).toBe(200);
    expect(reply.body.has_chat_ended).toBe(false);
    expect(reply.body.sceneBrief).toBeNull();
  });

  test('exposes messenger controls through story admin and swagger', async () => {
    const aiSettings = await invokeRoute('get', '/api/admin/typewriter/ai-settings');

    expect(aiSettings.status).toBe(200);
    expect(aiSettings.body.pipelines.messenger_chat).toEqual(
      expect.objectContaining({
        key: 'messenger_chat'
      })
    );

    const seedPrompts = await invokeRoute('post', '/api/admin/typewriter/prompts/seed-current', {
      body: { updatedBy: 'messenger-test' }
    });

    expect(seedPrompts.status).toBe(200);

    const prompts = await invokeRoute('get', '/api/admin/typewriter/prompts');

    expect(prompts.status).toBe(200);
    expect(prompts.body.pipelines.messenger_chat).toEqual(
      expect.objectContaining({
        pipelineKey: 'messenger_chat',
        promptTemplate: expect.stringMatching(/storyteller(?:s)? society/i)
      })
    );

    const openApi = await invokeRoute('get', '/api/openapi.json');

    expect(openApi.status).toBe(200);
    expect(openApi.body.paths['/api/messenger/chat']).toBeDefined();
    expect(openApi.body.paths['/api/sendMessage'].post.deprecated).toBe(true);
  });
});

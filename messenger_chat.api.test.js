import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let ChatMessage;
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

  ({ app } = await import('./server_new.js'));
  ({ ChatMessage, TypewriterPromptTemplate } = await import('./models/models.js'));

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

    const storedCount = await ChatMessage.countDocuments({ sessionId, sceneId: 'messanger' });
    expect(storedCount).toBe(5);

    const deletion = await invokeRoute('delete', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(deletion.status).toBe(200);
    expect(deletion.body.deletedCount).toBe(5);

    const reloadedHistory = await invokeRoute('get', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(reloadedHistory.status).toBe(200);
    expect(reloadedHistory.body.messages).toHaveLength(1);
    expect(reloadedHistory.body.hasChatEnded).toBe(false);
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

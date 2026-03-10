import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const TEMP_DIR = path.join(os.tmpdir(), `messenger-fallback-${process.pid}-${Date.now()}`);
let app;

process.env.NODE_ENV = 'test';
process.env.MESSENGER_CONVERSATION_STORE_PATH = path.join(TEMP_DIR, 'messenger_conversations.json');
process.env.MESSENGER_SCENE_BRIEF_STORE_PATH = path.join(TEMP_DIR, 'messenger_scene_briefs.json');
process.env.TYPEWRITER_PROMPT_STORE_PATH = path.join(TEMP_DIR, 'typewriter_prompt_templates.json');
process.env.LLM_ROUTE_CONFIG_STORE_PATH = path.join(TEMP_DIR, 'llm_route_config_versions.json');

beforeAll(async () => {
  ({ app } = await import('./server_new.js'));
});

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

beforeEach(async () => {
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  delete process.env.MESSENGER_CONVERSATION_STORE_PATH;
  delete process.env.MESSENGER_SCENE_BRIEF_STORE_PATH;
  delete process.env.TYPEWRITER_PROMPT_STORE_PATH;
  delete process.env.LLM_ROUTE_CONFIG_STORE_PATH;
});

describe('messenger chat fallback without mongo', () => {
  test('serves messenger history from file storage and keeps prompt admin available', async () => {
    const sessionId = 'messenger-fallback-debug';

    const initialHistory = await invokeRoute('get', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(initialHistory.status).toBe(200);
    expect(initialHistory.body.storage).toBe('file');
    expect(initialHistory.body.messages).toHaveLength(1);
    expect(initialHistory.body.messages[0]).toEqual(
      expect.objectContaining({
        sender: 'system',
        type: 'initial'
      })
    );
    expect(initialHistory.body.sceneBrief).toBeNull();

    const promptIndex = await invokeRoute('get', '/api/admin/typewriter/prompts');

    expect(promptIndex.status).toBe(200);
    expect(promptIndex.body.pipelines.messenger_chat).toEqual(
      expect.objectContaining({
        pipelineKey: 'messenger_chat',
        version: 0
      })
    );
    expect(promptIndex.body.pipelines.messenger_chat.meta).toEqual(
      expect.objectContaining({
        fallbackFromCode: true
      })
    );

    const llmConfigIndex = await invokeRoute('get', '/api/admin/llm-config');

    expect(llmConfigIndex.status).toBe(200);
    expect(llmConfigIndex.body.messenger_chat).toEqual(
      expect.objectContaining({
        routeKey: 'messenger_chat',
        version: 0
      })
    );
    expect(llmConfigIndex.body.messenger_chat.meta).toEqual(
      expect.objectContaining({
        source: 'code-default'
      })
    );

    const savedPrompt = await invokeRoute('post', '/api/admin/typewriter/prompts/:pipelineKey', {
      params: { pipelineKey: 'messenger_chat' },
      body: {
        promptTemplate: 'You are the Storyteller Society courier. Return JSON only.',
        updatedBy: 'fallback-test'
      }
    });

    expect(savedPrompt.status).toBe(201);
    expect(savedPrompt.body).toEqual(
      expect.objectContaining({
        pipelineKey: 'messenger_chat',
        version: 1,
        createdBy: 'fallback-test',
        isLatest: true
      })
    );

    const promptVersions = await invokeRoute('get', '/api/admin/typewriter/prompts/:pipelineKey/versions', {
      params: { pipelineKey: 'messenger_chat' }
    });

    expect(promptVersions.status).toBe(200);
    expect(promptVersions.body.versions[0]).toEqual(
      expect.objectContaining({
        pipelineKey: 'messenger_chat',
        version: 1,
        promptTemplate: 'You are the Storyteller Society courier. Return JSON only.'
      })
    );

    const savedLlmConfig = await invokeRoute('post', '/api/admin/llm-config/:routeKey', {
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
        updatedBy: 'fallback-test'
      }
    });

    expect(savedLlmConfig.status).toBe(200);
    expect(savedLlmConfig.body).toEqual(
      expect.objectContaining({
        routeKey: 'messenger_chat',
        version: 1,
        promptTemplate: 'You are the Society courier. Return JSON only.'
      })
    );
    expect(savedLlmConfig.body.meta).toEqual(
      expect.objectContaining({
        source: 'file',
        updatedBy: 'fallback-test'
      })
    );

    const llmConfigVersions = await invokeRoute('get', '/api/admin/llm-config/:routeKey/versions', {
      params: { routeKey: 'messenger_chat' }
    });

    expect(llmConfigVersions.status).toBe(200);
    expect(llmConfigVersions.body.versions[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        routeKey: 'messenger_chat',
        version: 1
      })
    );

    const reply = await invokeRoute('post', '/api/messenger/chat', {
      body: {
        sessionId,
        message: 'It will live in a salt-stained room above the harbor.',
        mocked_api_calls: true
      }
    });

    expect(reply.status).toBe(200);
    expect(reply.body.runtime).toEqual(
      expect.objectContaining({
        pipeline: 'messenger_chat',
        mocked: true,
        storage: 'file'
      })
    );
    expect(reply.body.messages).toHaveLength(3);
    expect(reply.body.sceneBrief).toEqual(
      expect.objectContaining({
        subject: expect.any(String),
        placeSummary: expect.stringMatching(/harbor/i),
        sceneEstablished: false
      })
    );

    const deletion = await invokeRoute('delete', '/api/messenger/chat', {
      query: { sessionId }
    });

    expect(deletion.status).toBe(200);
    expect(deletion.body).toEqual(
      expect.objectContaining({
        deletedMessagesCount: 3,
        deletedSceneBriefCount: 1,
        deletedCount: 4,
        storage: 'file'
      })
    );
  });
});

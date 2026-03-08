import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let ChatMessage;
let TypewriterPromptTemplate;
let mongoServer;

jest.setTimeout(30000);

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

    const initialHistory = await request(app)
      .get('/api/messenger/chat')
      .query({ sessionId })
      .expect(200);

    expect(initialHistory.body.messages).toHaveLength(1);
    expect(initialHistory.body.messages[0]).toEqual(
      expect.objectContaining({
        sender: 'system',
        type: 'initial'
      })
    );
    expect(initialHistory.body.messages[0].text).toContain('typewriter');

    const firstReply = await request(app)
      .post('/api/messenger/chat')
      .send({
        sessionId,
        message: 'It will live in an attic room above the harbor beside a rain-marked window.',
        mocked_api_calls: true
      })
      .expect(200);

    expect(firstReply.body.reply).toEqual(expect.any(String));
    expect(firstReply.body.runtime).toEqual(
      expect.objectContaining({
        pipeline: 'messenger_chat',
        mocked: true
      })
    );
    expect(firstReply.body.messages.filter((message) => message.sender === 'user')).toHaveLength(1);
    expect(firstReply.body.has_chat_ended).toBe(false);

    const legacyAliasReply = await request(app)
      .post('/api/sendMessage')
      .send({
        sessionId,
        message: 'There is a cedar wardrobe with a false back where it can vanish without comment.',
        mocked_api_calls: true
      })
      .expect(200);

    expect(legacyAliasReply.body.messages.filter((message) => message.type === 'initial')).toHaveLength(1);
    expect(legacyAliasReply.body.has_chat_ended).toBe(true);

    const storedCount = await ChatMessage.countDocuments({ sessionId, sceneId: 'messanger' });
    expect(storedCount).toBe(5);

    const deletion = await request(app)
      .delete('/api/messenger/chat')
      .query({ sessionId })
      .expect(200);

    expect(deletion.body.deletedCount).toBe(5);

    const reloadedHistory = await request(app)
      .get('/api/messenger/chat')
      .query({ sessionId })
      .expect(200);

    expect(reloadedHistory.body.messages).toHaveLength(1);
    expect(reloadedHistory.body.hasChatEnded).toBe(false);
  });

  test('exposes messenger controls through story admin and swagger', async () => {
    const aiSettings = await request(app)
      .get('/api/admin/typewriter/ai-settings')
      .expect(200);

    expect(aiSettings.body.pipelines.messenger_chat).toEqual(
      expect.objectContaining({
        key: 'messenger_chat'
      })
    );

    await request(app)
      .post('/api/admin/typewriter/prompts/seed-current')
      .send({ updatedBy: 'messenger-test' })
      .expect(200);

    const prompts = await request(app)
      .get('/api/admin/typewriter/prompts')
      .expect(200);

    expect(prompts.body.pipelines.messenger_chat).toEqual(
      expect.objectContaining({
        pipelineKey: 'messenger_chat',
        promptTemplate: expect.stringMatching(/storyteller(?:s)? society/i)
      })
    );

    const openApi = await request(app)
      .get('/api/openapi.json')
      .expect(200);

    expect(openApi.body.paths['/api/messenger/chat']).toBeDefined();
    expect(openApi.body.paths['/api/sendMessage'].post.deprecated).toBe(true);
  });
});

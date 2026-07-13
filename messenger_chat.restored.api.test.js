import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

describe('restored messenger API routes', () => {
  let app;
  let mongoServer;
  let ChatMessage;
  let MessengerSceneBrief;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoServer.getUri(), { dbName: 'messenger-restored-api-test' });
    ({ app } = await import('./server_new.js'));
    ({ ChatMessage, MessengerSceneBrief } = await import('./models/models.js'));
  });

  afterEach(async () => {
    await ChatMessage.deleteMany({});
    await MessengerSceneBrief.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('GET /api/messenger/chat creates and returns the initial Society dispatch', async () => {
    const response = await request(app)
      .get('/api/messenger/chat')
      .query({ sessionId: 'session-1', sceneId: 'messanger' });

    expect(response.status).toBe(200);
    expect(response.body.sessionId).toBe('session-1');
    expect(response.body.sceneId).toBe('messanger');
    expect(response.body.count).toBe(1);
    expect(response.body.messages[0]).toEqual(expect.objectContaining({
      type: 'initial',
      sender: 'system',
      hasChatEnded: false
    }));
    expect(response.body.messages[0].text).toMatch(/Storyteller|Society|typewriter/i);
  });

  test('GET /api/messenger/chat rejects a missing session id', async () => {
    const response = await request(app).get('/api/messenger/chat');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/sessionId/i);
  });

  test('POST /api/messenger/chat supports the restored mock messenger flow', async () => {
    const response = await request(app)
      .post('/api/messenger/chat')
      .send({
        sessionId: 'session-1',
        sceneId: 'messanger',
        message: 'A narrow room above the harbor, rain on the glass, cedar wardrobe with a false back.',
        mocked_api_calls: true
      });

    expect(response.status).toBe(200);
    expect(response.body.mocked).toBe(true);
    expect(response.body.messages.map((message) => message.sender)).toEqual(['system', 'user', 'system']);
    expect(response.body.reply).toMatch(/Society|room|typewriter|hide|conceal|vanish/i);
  });
});

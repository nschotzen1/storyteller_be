import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let app;
let Task;
let TaskAssignment;
let mongoServer;

jest.setTimeout(30000);

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  ({ app } = await import('./server_new.js'));
  ({ Task, TaskAssignment } = await import('./models/models.js'));

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
});

afterEach(async () => {
  if (TaskAssignment) {
    await TaskAssignment.deleteMany({});
  }
  if (Task) {
    await Task.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('task APIs', () => {
  test('creates, lists, updates, and deletes a task', async () => {
    const createRes = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Suspect Xerofag',
        brief: 'Reveal one subtle clue and name the Xerofag once as a suspicion.',
        privacy: 'session',
        sessionId: 'task-api-session',
        target: {
          type: 'route',
          id: '/api/send_storyteller_typewriter_text',
          label: 'Storyteller intervention'
        },
        knownEntityIds: ['builtin:xerofag'],
        tags: ['xerofag', 'typewriter']
      })
      .expect(201);

    expect(createRes.body.task).toEqual(
      expect.objectContaining({
        taskId: expect.any(String),
        title: 'Suspect Xerofag',
        privacy: 'session',
        knownEntityIds: ['builtin:xerofag']
      })
    );

    const getRes = await request(app)
      .get(`/api/tasks/${createRes.body.task.taskId}`)
      .query({ sessionId: 'task-api-session' })
      .expect(200);

    expect(getRes.body.task).toEqual(
      expect.objectContaining({
        taskId: createRes.body.task.taskId,
        target: expect.objectContaining({
          type: 'route'
        })
      })
    );

    const listRes = await request(app)
      .get('/api/tasks')
      .query({ sessionId: 'task-api-session', targetType: 'route' })
      .expect(200);

    expect(listRes.body.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: createRes.body.task.taskId
        })
      ])
    );

    const updateRes = await request(app)
      .patch(`/api/tasks/${createRes.body.task.taskId}`)
      .send({
        sessionId: 'task-api-session',
        brief: 'Reveal one subtle physical clue, say "the Xerofag" once, and stay uncertain.',
        knownEntityIds: ['builtin:xerofag', 'mystery:bell-rope']
      })
      .expect(200);

    expect(updateRes.body.task.brief).toContain('the Xerofag');
    expect(updateRes.body.task.knownEntityIds).toEqual(['builtin:xerofag', 'mystery:bell-rope']);

    await request(app)
      .delete(`/api/tasks/${createRes.body.task.taskId}`)
      .query({ sessionId: 'task-api-session' })
      .expect(200);

    await request(app)
      .get(`/api/tasks/${createRes.body.task.taskId}`)
      .query({ sessionId: 'task-api-session' })
      .expect(404);
  });

  test('creates and lists task assignments', async () => {
    const taskRes = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Bell tower watch',
        brief: 'Notice the bell rope and remain unsure what moved it.',
        privacy: 'session',
        sessionId: 'assignment-session',
        target: {
          type: 'entity',
          id: 'bell-tower',
          label: 'Bell Tower'
        }
      })
      .expect(201);

    const assignmentRes = await request(app)
      .post('/api/task-assignments')
      .send({
        sessionId: 'assignment-session',
        taskId: taskRes.body.task.taskId,
        assigneeType: 'storyteller',
        assigneeId: 'storyteller-1',
        status: 'active',
        gmNote: 'Keep the evidence small and physical.'
      })
      .expect(201);

    expect(assignmentRes.body.assignment).toEqual(
      expect.objectContaining({
        assigneeType: 'storyteller',
        assigneeId: 'storyteller-1',
        status: 'active'
      })
    );

    const listRes = await request(app)
      .get('/api/task-assignments')
      .query({
        sessionId: 'assignment-session',
        taskId: taskRes.body.task.taskId,
        assigneeType: 'storyteller'
      })
      .expect(200);

    expect(listRes.body.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: assignmentRes.body.assignment._id
        })
      ])
    );
  });
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createStoryteller,
  deleteStoryteller,
  findStoryteller,
  findStorytellerByName,
  setFragment,
  updateStoryteller,
  upsertStoryteller
} from './utils.js';
import { NarrativeFragment, Storyteller } from '../models/models.js';

let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri);
});

afterEach(async () => {
  await NarrativeFragment.deleteMany({});
  await Storyteller.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('setFragment', () => {
  it('creates and updates a fragment by session and turn', async () => {
    const sessionId = 'utils-fragment-session';

    const created = await setFragment(sessionId, { text: 'Initial fragment.' }, 1);
    expect(created.session_id).toBe(sessionId);
    expect(created.fragment).toEqual({ text: 'Initial fragment.' });
    expect(created.turn).toBe(1);

    const updated = await setFragment(sessionId, { text: 'Updated fragment.' }, 1);
    expect(updated.session_id).toBe(sessionId);
    expect(updated.fragment).toEqual({ text: 'Updated fragment.' });

    const savedDocs = await NarrativeFragment.find({ session_id: sessionId, turn: 1 }).lean();
    expect(savedDocs).toHaveLength(1);
    expect(savedDocs[0].fragment).toEqual({ text: 'Updated fragment.' });
  });
});

describe('storyteller CRUD helpers', () => {
  it('creates, finds, updates, deletes, and upserts storytellers', async () => {
    const created = await createStoryteller({
      session_id: 'utils-storyteller-session',
      name: 'Ada',
      level: 10
    });
    expect(created.name).toBe('Ada');

    const foundList = await findStoryteller({ session_id: 'utils-storyteller-session' });
    expect(foundList.map((storyteller) => storyteller.name)).toEqual(['Ada']);

    const foundByName = await findStorytellerByName('Ada');
    expect(foundByName.level).toBe(10);

    const updated = await updateStoryteller('Ada', { level: 11 });
    expect(updated.level).toBe(11);

    const upserted = await upsertStoryteller({
      session_id: 'utils-storyteller-session',
      name: 'Tess',
      level: 5,
      immediate_ghost_appearance: 'A whisper'
    });
    expect(upserted.name).toBe('Tess');

    const deleted = await deleteStoryteller('Ada');
    expect(deleted.name).toBe('Ada');
    await expect(findStorytellerByName('Ada')).resolves.toBeNull();
  });
});

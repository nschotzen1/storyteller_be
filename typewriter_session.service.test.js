import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NarrativeFragment } from './models/models.js';
import {
  normalizeTypewriterWorldState,
  saveTypewriterSessionFragment,
  startTypewriterSession
} from './services/typewriterSessionService.js';

describe('typewriterSessionService', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoServer.getUri(), {
      dbName: 'typewriter-session-service-test'
    });
  });

  afterEach(async () => {
    await NarrativeFragment.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('stores well-seeded text as initialFragment without overwriting it on later saves', async () => {
    const session = await startTypewriterSession('well-session');

    expect(session.fragment).toBe('');
    expect(session.initialFragment).toBe('');

    const seeded = await saveTypewriterSessionFragment('well-session', 'one two three', {
      updateInitialFragment: true
    });

    expect(seeded.fragment).toBe('one two three');
    expect(seeded.initialFragment).toBe('one two three');

    const continued = await saveTypewriterSessionFragment('well-session', 'one two three four five');

    expect(continued.fragment).toBe('one two three four five');
    expect(continued.initialFragment).toBe('one two three');

    const stored = await NarrativeFragment.findOne({
      session_id: 'well-session',
      turn: 0
    }).lean();

    expect(stored.fragment).toBe('one two three four five');
    expect(stored.initialFragment).toBe('one two three');
  });

  test('persists typewriter world state and bounded turn metadata with the fragment', async () => {
    const worldState = normalizeTypewriterWorldState({
      entities: [{ name: 'Market Gate', status: 'closed' }],
      active_tension: 'A checkpoint has noticed the writer.',
      established_facts: ['The gate is locked.']
    });
    const typewriterTurn = {
      userBeat: 'A guard looked up.',
      continuation: 'The guard slid the bolt home.',
      irreversible: 'The gate is now locked.',
      systemPressure: 'Infrastructure pressure manifested through the locked gate.'
    };

    const saved = await saveTypewriterSessionFragment('world-state-session', 'A guard looked up. The guard slid the bolt home.', {
      worldState,
      typewriterTurn
    });

    expect(saved.worldState).toEqual(worldState);
    expect(saved.lastTypewriterTurn).toEqual(expect.objectContaining(typewriterTurn));
    expect(saved.typewriterTurns).toEqual([
      expect.objectContaining(typewriterTurn)
    ]);

    const stored = await NarrativeFragment.findOne({
      session_id: 'world-state-session',
      turn: 0
    }).lean();

    expect(stored.worldState).toEqual(worldState);
    expect(stored.lastTypewriterTurn).toEqual(expect.objectContaining(typewriterTurn));
    expect(stored.typewriterTurns).toEqual([
      expect.objectContaining(typewriterTurn)
    ]);
  });
});

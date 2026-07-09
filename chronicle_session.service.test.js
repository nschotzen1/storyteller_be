import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ChronicleSessionModel } from './models/chronicleModels.js';
import { ACTS, createChronicle, getChronicle, saveChronicle } from './services/chronicleSessionService.js';

describe('chronicleSessionService', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(mongoServer.getUri(), { dbName: 'chronicle-session-service-test' });
  });

  afterEach(async () => {
    await ChronicleSessionModel.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('createChronicle snapshots the bible into a fresh session', async () => {
    const session = await createChronicle();
    expect(session.chronicleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.act).toBe(ACTS.SOCIETY_CHAT);
    expect(session.cells.length).toBeGreaterThanOrEqual(12);
    expect(session.cells.every((c) => c.state === 'damaged')).toBe(true);
    expect(session.recoveredFacts).toEqual({
      pageCount: null, heroStance: null, chapterTitle: null, tavernDish: null, writingPlace: null
    });
    expect(session.pressure).toEqual({
      value: 0,
      threshold: 6,
      sources: { wolfInstability: 0, vossDanger: 0, societySuspicion: 0, fluteDeadline: 0 },
      lastSceneAt: null
    });
    expect(session.character.tendencies).toEqual({
      caution: 0, nerve: 0, curiosity: 0, guile: 0, empathy: 0
    });
    expect(session.canonLocks.characters).toEqual(expect.arrayContaining(['mera_venn', 'ilan_voss']));
    expect(session.evidence).toEqual([]);
    expect(session.transcript).toEqual([]);
  });

  test('two chronicles have independent cell snapshots', async () => {
    const a = await createChronicle();
    const b = await createChronicle();
    expect(a.chronicleId).not.toBe(b.chronicleId);
    a.cells[0].state = 'restored';
    await saveChronicle(a);
    const bAgain = await getChronicle(b.chronicleId);
    expect(bAgain.cells[0].state).toBe('damaged');
  });

  test('saveChronicle persists and getChronicle round-trips', async () => {
    const created = await createChronicle();
    const fetched = await getChronicle(created.chronicleId);
    fetched.recoveredFacts.writingPlace = 'kolkata_room';
    fetched.transcript.push({ role: 'system', kind: 'note', text: 'x', at: '2026-07-10T00:00:00.000Z' });
    await saveChronicle(fetched);
    const again = await getChronicle(created.chronicleId);
    expect(again.recoveredFacts.writingPlace).toBe('kolkata_room');
    expect(again.transcript).toHaveLength(1);
  });

  test('getChronicle returns null for unknown id', async () => {
    expect(await getChronicle('does-not-exist')).toBeNull();
  });
});

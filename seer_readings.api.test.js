import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

let app;
let FragmentMemory;
let SeerReading;

jest.setTimeout(30000);

function buildMemoryDoc({
  sessionId,
  playerId,
  batchId,
  shortTitle,
  temporalRelation,
  memoryStrength
}) {
  return {
    sessionId,
    playerId,
    fragmentText: 'It was almost night as they finally reached the plateau.',
    batchId,
    memory_strength: memoryStrength,
    emotional_sentiment: 'uneasy attention',
    action_name: 'Observe the sign',
    estimated_action_length: '30 seconds',
    time_within_action: 'during the approach',
    actual_result: 'A hidden connection became legible.',
    related_through_what: 'the same braided rope pattern',
    geographical_relevance: 'plateau pass above the river',
    temporal_relation: temporalRelation,
    organizational_affiliation: 'none',
    consequences: 'watchers begin to move with caution',
    distance_from_fragment_location_km: 0,
    shot_type: 'close-up',
    time_of_day: 'dusk',
    whose_eyes: 'Ashward Marrow',
    'interior/exterior': 'exterior',
    what_is_being_watched: 'a rope snapping in the wind',
    location: 'north-facing cairn',
    estimated_duration_of_memory: 1,
    memory_distance: 'immediate',
    entities_in_memory: ['Ashward Marrow', 'braided rope'],
    currently_assumed_turns_to_round: 'one turn',
    relevant_rolls: ['Perception +2'],
    action_level: 'tactical',
    short_title: shortTitle,
    dramatic_definition: 'A sign reveals a hidden thread.',
    miseenscene: 'Wind, leather, and cold stone gather into a warning.',
    front: { prompt: '', imageUrl: '' },
    back: { prompt: '', imageUrl: '' },
    front_image_url: '',
    back_image_url: ''
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  ({ app } = await import('./server_new.js'));
  ({ FragmentMemory } = await import('./models/memory_models.js'));
  ({ SeerReading } = await import('./models/models.js'));

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/storytelling_test';

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  await FragmentMemory.syncIndexes();
  await SeerReading.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  if (FragmentMemory && mongoose.connection.readyState === 1) {
    await FragmentMemory.deleteMany({});
  }
  if (SeerReading && mongoose.connection.readyState === 1) {
    await SeerReading.deleteMany({});
  }
});

describe('Seer reading API skeleton', () => {
  it('creates a persisted seer reading from a triad of memories', async () => {
    const sessionId = 'seer-session-1';
    const playerId = 'seer-player-1';
    const batchId = 'seer-batch-1';

    await FragmentMemory.insertMany([
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'River Haul',
        temporalRelation: 'minutes earlier than the fragment',
        memoryStrength: 'durable'
      }),
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'Rope on Cairn',
        temporalRelation: 'simultaneous with fragment',
        memoryStrength: 'vivid'
      }),
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'Ash Mark Signal',
        temporalRelation: 'hours later the same night',
        memoryStrength: 'faint'
      })
    ]);

    const response = await request(app)
      .post('/api/seer/readings')
      .send({
        sessionId,
        playerId,
        text: 'It was almost night as they finally reached the plateau.',
        batchId
      })
      .expect(201);

    expect(response.body.readingId).toBeTruthy();
    expect(response.body.sessionId).toBe(sessionId);
    expect(response.body.playerId).toBe(playerId);
    expect(response.body.status).toBe('active');
    expect(response.body.beat).toBe('triad_revealed');
    expect(response.body.memories).toHaveLength(3);
    expect(response.body.transcript).toHaveLength(1);
    expect(response.body.transcript[0].role).toBe('seer');
    expect(response.body.spread.layoutMode).toBe('seer_triad');

    const focused = response.body.memories.filter((memory) => memory.focusState === 'active');
    expect(focused).toHaveLength(1);
    expect(response.body.memories.map((memory) => memory.temporalSlot).sort()).toEqual(['after', 'before', 'during']);

    const stored = await SeerReading.findOne({ readingId: response.body.readingId }).lean();
    expect(stored).toBeTruthy();
    expect(stored.memories).toHaveLength(3);
  });

  it('loads an existing seer reading by readingId', async () => {
    const sessionId = 'seer-session-2';
    const reading = await SeerReading.create({
      readingId: 'reading-2',
      sessionId,
      playerId: 'seer-player-2',
      status: 'active',
      beat: 'triad_revealed',
      fragment: { text: 'A warning hangs on the rope.', anchorLabel: 'Fragment' },
      seer: { personaId: 'default-seer', voice: 'ritual witness' },
      memories: [
        { id: 'm1', temporalSlot: 'during', focusState: 'active', card: { title: 'Rope on Cairn' } }
      ],
      entities: [],
      apparitions: [],
      spread: { layoutMode: 'seer_triad', focusMemoryId: 'm1', nodes: [], edges: [] },
      transcript: [],
      unresolvedThreads: [],
      worldbuildingOutputs: [],
      metadata: { specVersion: 'seer-reading-v1-alpha' }
    });

    const response = await request(app)
      .get(`/api/seer/readings/${reading.readingId}`)
      .query({ playerId: 'seer-player-2' })
      .expect(200);

    expect(response.body.readingId).toBe('reading-2');
    expect(response.body.fragment.text).toContain('warning');
    expect(response.body.spread.focusMemoryId).toBe('m1');
    expect(response.body.composer.prompt).toBeTruthy();
  });

  it('advances a reading turn by revealing the next memory tier', async () => {
    const sessionId = 'seer-session-turn-1';
    const playerId = 'seer-player-turn-1';
    const batchId = 'seer-batch-turn-1';

    await FragmentMemory.insertMany([
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'River Haul',
        temporalRelation: 'minutes earlier than the fragment',
        memoryStrength: 'durable'
      }),
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'Rope on Cairn',
        temporalRelation: 'simultaneous with fragment',
        memoryStrength: 'vivid'
      }),
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'Ash Mark Signal',
        temporalRelation: 'hours later the same night',
        memoryStrength: 'faint'
      })
    ]);

    const created = await request(app)
      .post('/api/seer/readings')
      .send({
        sessionId,
        playerId,
        text: 'It was almost night as they finally reached the plateau.',
        batchId
      })
      .expect(201);

    const focusedBefore = created.body.memories.find((memory) => memory.focusState === 'active');
    expect(focusedBefore.revealTier).toBe(2);

    const response = await request(app)
      .post(`/api/seer/readings/${created.body.readingId}/turn`)
      .send({
        playerId,
        message: 'This feels like recognition sharpened by danger.'
      })
      .expect(200);

    const focusedAfter = response.body.memories.find((memory) => memory.focusState === 'active');
    expect(focusedAfter.revealTier).toBe(3);
    expect(focusedAfter.clarity).toBeGreaterThan(focusedBefore.clarity);
    expect(response.body.lastTurn.transitionType).toBe('reveal');
    expect(response.body.lastTurn.runtimeId).toBe('seer-agent-runtime-v1');
    expect(Array.isArray(response.body.lastTurn.toolCalls)).toBe(true);
    expect(response.body.orchestrator?.runtimeId).toBe('seer-agent-runtime-v1');
    expect(response.body.transcript[response.body.transcript.length - 2].role).toBe('player');
    expect(response.body.transcript[response.body.transcript.length - 1].role).toBe('seer');
  });

  it('creates a memory-to-entity relation after repeated attunement turns', async () => {
    const sessionId = 'seer-session-turn-2';
    const playerId = 'seer-player-turn-2';
    const batchId = 'seer-batch-turn-2';

    await FragmentMemory.insertMany([
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'River Haul',
        temporalRelation: 'minutes earlier than the fragment',
        memoryStrength: 'durable'
      }),
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'Rope on Cairn',
        temporalRelation: 'simultaneous with fragment',
        memoryStrength: 'vivid'
      }),
      buildMemoryDoc({
        sessionId,
        playerId,
        batchId,
        shortTitle: 'Ash Mark Signal',
        temporalRelation: 'hours later the same night',
        memoryStrength: 'faint'
      })
    ]);

    const created = await request(app)
      .post('/api/seer/readings')
      .send({
        sessionId,
        playerId,
        text: 'It was almost night as they finally reached the plateau.',
        batchId
      })
      .expect(201);

    await request(app)
      .post(`/api/seer/readings/${created.body.readingId}/turn`)
      .send({ playerId, message: 'The vision sharpens around the act itself.' })
      .expect(200);

    const response = await request(app)
      .post(`/api/seer/readings/${created.body.readingId}/turn`)
      .send({ playerId, message: 'It is Ashward Marrow reading the sign in the rope.' })
      .expect(200);

    const focusedAfter = response.body.memories.find((memory) => memory.focusState === 'active');
    expect(response.body.lastTurn.transitionType).toMatch(/relation|entity/);
    expect(response.body.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(focusedAfter.confirmedEntityIds)).toBe(true);
    expect(focusedAfter.confirmedEntityIds.length).toBeGreaterThan(0);
    expect(
      response.body.spread.edges.some((edge) => edge.fromId === focusedAfter.id && focusedAfter.confirmedEntityIds.includes(edge.toId))
    ).toBe(true);
  });

  it('closes a seer reading and persists closure state', async () => {
    await SeerReading.create({
      readingId: 'reading-close-1',
      sessionId: 'seer-session-3',
      playerId: 'seer-player-3',
      status: 'active',
      beat: 'triad_revealed',
      fragment: { text: 'The thread tightens.', anchorLabel: 'Fragment' },
      seer: { personaId: 'default-seer', voice: 'ritual witness' },
      memories: [],
      entities: [],
      apparitions: [],
      spread: { layoutMode: 'seer_triad', focusMemoryId: '', nodes: [], edges: [] },
      transcript: [],
      unresolvedThreads: [],
      worldbuildingOutputs: [],
      metadata: {}
    });

    const response = await request(app)
      .post('/api/seer/readings/reading-close-1/close')
      .send({
        playerId: 'seer-player-3',
        reason: 'player_completed_reading'
      })
      .expect(200);

    expect(response.body.status).toBe('closed');
    expect(response.body.beat).toBe('reading_closed');
    expect(response.body.metadata.closedReason).toBe('player_completed_reading');
    expect(response.body.transcript[response.body.transcript.length - 1].kind).toBe('closure');

    const stored = await SeerReading.findOne({ readingId: 'reading-close-1' }).lean();
    expect(stored.status).toBe('closed');
    expect(stored.beat).toBe('reading_closed');
  });
});

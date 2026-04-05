import request from 'supertest';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

let app;
let FragmentMemory;
let SeerReading;
let NarrativeEntity;
let ImmersiveRpgCharacterSheet;

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
  ({ SeerReading, ImmersiveRpgCharacterSheet } = await import('./models/models.js'));
  ({ NarrativeEntity } = await import('./storyteller/utils.js'));

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

beforeEach(async () => {
  if (FragmentMemory && mongoose.connection.readyState === 1) {
    await FragmentMemory.deleteMany({});
  }
  if (SeerReading && mongoose.connection.readyState === 1) {
    await SeerReading.deleteMany({});
  }
  if (NarrativeEntity && mongoose.connection.readyState === 1) {
    await NarrativeEntity.deleteMany({});
  }
  if (ImmersiveRpgCharacterSheet && mongoose.connection.readyState === 1) {
    await ImmersiveRpgCharacterSheet.deleteMany({});
  }
});

afterEach(async () => {
  if (FragmentMemory && mongoose.connection.readyState === 1) {
    await FragmentMemory.deleteMany({});
  }
  if (SeerReading && mongoose.connection.readyState === 1) {
    await SeerReading.deleteMany({});
  }
  if (NarrativeEntity && mongoose.connection.readyState === 1) {
    await NarrativeEntity.deleteMany({});
  }
  if (ImmersiveRpgCharacterSheet && mongoose.connection.readyState === 1) {
    await ImmersiveRpgCharacterSheet.deleteMany({});
  }
});

describe('Seer reading API skeleton', () => {
  it('creates a persisted seer reading with a seeded vision and configurable cards', async () => {
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
        batchId,
        cardCount: 4,
        preferredCardKinds: ['character', 'location', 'event', 'authority'],
        allowedCardKinds: ['character', 'location', 'event', 'item', 'authority']
      })
      .expect(201);

    expect(response.body.readingId).toBeTruthy();
    expect(response.body.sessionId).toBe(sessionId);
    expect(response.body.playerId).toBe(playerId);
    expect(response.body.status).toBe('active');
    expect(response.body.beat).toBe('cards_revealed');
    expect(response.body.vision?.sourceMemoryId).toBeTruthy();
    expect(response.body.cards).toHaveLength(4);
    expect(response.body.cards.map((card) => card.kind)).toEqual(['character', 'location', 'event', 'authority']);
    expect(response.body.memories).toHaveLength(3);
    expect(response.body.transcript).toHaveLength(1);
    expect(response.body.transcript[0].role).toBe('seer');
    expect(response.body.spread.layoutMode).toBe('seer_vision_cards');
    expect(response.body.spread.cardLayout).toHaveLength(4);
    expect(response.body.metadata?.cardConfig?.generatedCount).toBe(4);
    expect(response.body.focus?.cardId).toBeTruthy();

    const focused = response.body.memories.filter((memory) => memory.focusState === 'active');
    expect(focused).toHaveLength(1);
    expect(response.body.memories.map((memory) => memory.temporalSlot).sort()).toEqual(['after', 'before', 'during']);

    const stored = await SeerReading.findOne({ readingId: response.body.readingId }).lean();
    expect(stored).toBeTruthy();
    expect(stored.memories).toHaveLength(3);
    expect(stored.cards).toHaveLength(4);
  });

  it('loads an existing seer reading by readingId', async () => {
    const sessionId = 'seer-session-2';
    const reading = await SeerReading.create({
      readingId: 'reading-2',
      sessionId,
      playerId: 'seer-player-2',
      status: 'active',
      beat: 'cards_revealed',
      fragment: { text: 'A warning hangs on the rope.', anchorLabel: 'Fragment' },
      vision: { sourceMemoryId: 'm1', status: 'blurred', clarity: 0.2, revealTier: 1, visibleFields: [], sensoryFragments: [] },
      seer: { personaId: 'default-seer', voice: 'ritual witness' },
      memories: [
        { id: 'm1', temporalSlot: 'during', focusState: 'active', card: { title: 'Rope on Cairn' } }
      ],
      cards: [
        { id: 'card-1', kind: 'character', title: 'Ashward Marrow', focusState: 'active', status: 'back_only' }
      ],
      entities: [],
      apparitions: [],
      spread: { layoutMode: 'seer_vision_cards', focusMemoryId: 'm1', focusCardId: 'card-1', nodes: [], edges: [], cardLayout: [] },
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

  it('advances a reading turn by revealing the next card tier', async () => {
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

    const focusedCardBefore = created.body.cards.find((card) => card.focusState === 'active');
    expect(focusedCardBefore.revealTier).toBe(0);

    const response = await request(app)
      .post(`/api/seer/readings/${created.body.readingId}/turn`)
      .send({
        playerId,
        message: 'This feels like recognition sharpened by danger.'
      })
      .expect(200);

    const focusedCardAfter = response.body.cards.find((card) => card.focusState === 'active');
    expect(focusedCardAfter.revealTier).toBe(1);
    expect(focusedCardAfter.clarity).toBeGreaterThan(focusedCardBefore.clarity);
    expect(response.body.lastTurn.transitionType).toBe('card_reveal');
    expect(response.body.lastTurn.runtimeId).toBe('seer-agent-runtime-v1');
    expect(Array.isArray(response.body.lastTurn.toolCalls)).toBe(true);
    expect(response.body.orchestrator?.runtimeId).toBe('seer-agent-runtime-v1');
    expect(response.body.transcript[response.body.transcript.length - 2].role).toBe('player');
    expect(response.body.transcript[response.body.transcript.length - 1].role).toBe('seer');
  });

  it('keeps mock mode active across turn-driven entity creation when the reading was opened in demo mode', async () => {
    await SeerReading.create({
      readingId: 'reading-mock-turn-1',
      sessionId: 'seer-session-mock-turn-1',
      playerId: 'seer-player-mock-turn-1',
      worldId: 'world-mock-turn-1',
      universeId: 'world-mock-turn-1',
      status: 'active',
      beat: 'card_attunement',
      vision: {
        sourceMemoryId: 'm1',
        status: 'blurred',
        clarity: 0.36,
        revealTier: 2,
        visibleFields: ['location'],
        sensoryFragments: []
      },
      fragment: {
        text: 'The cairn held a cut in the rope where warnings were read.',
        anchorLabel: 'Fragment'
      },
      seer: { personaId: 'default-seer', voice: 'ritual witness' },
      memories: [
        {
          id: 'm1',
          temporalSlot: 'during',
          focusState: 'active',
          clarity: 0.58,
          revealTier: 2,
          visibleFields: ['location'],
          card: { title: 'Rope on Cairn' },
          confirmedEntityIds: [],
          candidateEntityIds: [],
          raw: {
            whose_eyes: '',
            location: 'North-Facing Cairn',
            emotional_sentiment: 'uneasy reverence',
            what_is_being_watched: 'a cut in the warning rope',
            related_through_what: 'storm-reading',
            entities_in_memory: []
          }
        }
      ],
      cards: [
        {
          id: 'card-location',
          kind: 'location',
          title: 'North-Facing Cairn',
          status: 'front_revealed',
          focusState: 'active',
          clarity: 0.66,
          confidence: 0.52,
          revealTier: 2,
          linkedEntityIds: [],
          back: { mood: ['warning'], motifs: ['rope', 'stone'] },
          front: { summary: 'A high place that teaches people how to read danger.', facts: [] }
        }
      ],
      entities: [],
      apparitions: [],
      spread: {
        layoutMode: 'seer_vision_cards',
        focusMemoryId: 'm1',
        focusCardId: 'card-location',
        nodes: [],
        edges: [],
        cardLayout: []
      },
      transcript: [],
      claimedCards: [],
      claimedEntityLinks: [],
      unresolvedThreads: [],
      worldbuildingOutputs: [],
      metadata: {
        demoMockMode: true
      }
    });

    const response = await request(app)
      .post('/api/seer/readings/reading-mock-turn-1/turn')
      .send({
        playerId: 'seer-player-mock-turn-1',
        message: 'It was a warning station where novices learned to read storms.'
      })
      .expect(200);

    expect(response.body.orchestrator?.pipeline?.useMock).toBe(true);
    expect(response.body.lastTurn?.createdEntityMocked).toBe(true);
    expect(response.body.lastTurn?.transitionType).toMatch(/relation|entity/);
    expect(response.body.entities.length).toBeGreaterThan(0);
    expect(response.body.cards[0].linkedEntityIds.length).toBeGreaterThan(0);
    expect(response.body.metadata?.demoMockMode).toBe(true);

    const stored = await SeerReading.findOne({ readingId: 'reading-mock-turn-1' }).lean();
    expect(stored.metadata?.demoMockMode).toBe(true);
    expect(stored.metadata?.lastTurn?.createdEntityMocked).toBe(true);
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

    await request(app)
      .post(`/api/seer/readings/${created.body.readingId}/turn`)
      .send({ playerId, message: 'The place itself is becoming legible now.' })
      .expect(200);

    const response = await request(app)
      .post(`/api/seer/readings/${created.body.readingId}/turn`)
      .send({ playerId, message: 'It is Ashward Marrow reading the sign in the rope.' })
      .expect(200);

    const focusedAfter = response.body.memories.find((memory) => memory.focusState === 'active');
    const focusedCardAfter = response.body.cards.find((card) => card.focusState === 'active');
    expect(response.body.lastTurn.transitionType).toMatch(/relation|entity/);
    expect(response.body.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(focusedAfter.confirmedEntityIds)).toBe(true);
    expect(focusedAfter.confirmedEntityIds.length).toBeGreaterThan(0);
    expect(Array.isArray(focusedCardAfter.linkedEntityIds)).toBe(true);
    expect(focusedCardAfter.linkedEntityIds.length).toBeGreaterThan(0);
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
      beat: 'cards_revealed',
      vision: { sourceMemoryId: '', status: 'blurred', clarity: 0.1, revealTier: 0, visibleFields: [], sensoryFragments: [] },
      fragment: { text: 'The thread tightens.', anchorLabel: 'Fragment' },
      seer: { personaId: 'default-seer', voice: 'ritual witness' },
      memories: [],
      cards: [],
      entities: [],
      apparitions: [],
      spread: { layoutMode: 'seer_vision_cards', focusMemoryId: '', focusCardId: '', nodes: [], edges: [], cardLayout: [] },
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

  it('claims a claimable card and persists it into the reading result set', async () => {
    await SeerReading.create({
      readingId: 'reading-claim-1',
      sessionId: 'seer-session-claim-1',
      playerId: 'seer-player-claim-1',
      worldId: 'world-claim-1',
      universeId: 'world-claim-1',
      status: 'active',
      beat: 'card_claim_available',
      vision: { sourceMemoryId: 'm1', status: 'blurred', clarity: 0.24, revealTier: 1, visibleFields: [], sensoryFragments: [] },
      fragment: { text: 'The rope hangs from the cairn.', anchorLabel: 'Fragment' },
      seer: { personaId: 'default-seer', voice: 'ritual witness' },
      memories: [
        {
          id: 'm1',
          temporalSlot: 'during',
          focusState: 'active',
          clarity: 0.62,
          revealTier: 2,
          card: { title: 'Rope on Cairn' },
          confirmedEntityIds: ['entity-1']
        }
      ],
      cards: [
        {
          id: 'card-location',
          kind: 'location',
          title: 'North-Facing Cairn',
          status: 'claimable',
          focusState: 'active',
          clarity: 0.84,
          confidence: 0.72,
          revealTier: 3,
          linkedEntityIds: ['entity-1'],
          back: { mood: ['warning'], motifs: ['stone'] },
          front: { summary: 'A high place that sees too far.', facts: [] }
        },
        {
          id: 'card-event',
          kind: 'event',
          title: 'The Sign Is Read',
          status: 'front_revealed',
          focusState: 'idle',
          clarity: 0.58,
          confidence: 0.44,
          revealTier: 2,
          linkedEntityIds: [],
          back: { mood: ['urgency'], motifs: ['rope'] },
          front: { summary: 'Recognition arrives before certainty.', facts: [] }
        }
      ],
      entities: [{ id: 'entity-1', name: 'North-Facing Cairn', externalId: 'entity-1' }],
      apparitions: [],
      spread: {
        layoutMode: 'seer_vision_cards',
        focusMemoryId: 'm1',
        focusCardId: 'card-location',
        nodes: [],
        edges: [],
        cardLayout: []
      },
      transcript: [],
      claimedCards: [],
      unresolvedThreads: [],
      worldbuildingOutputs: [],
      metadata: {}
    });

    const response = await request(app)
      .post('/api/seer/readings/reading-claim-1/cards/card-location/claim')
      .send({
        playerId: 'seer-player-claim-1'
      })
      .expect(200);

    expect(response.body.claimedCards).toHaveLength(1);
    expect(response.body.claimedCards[0].cardId).toBe('card-location');
    expect(response.body.claimedCards[0].entityExternalId).toBe('entity-1');
    expect(response.body.cards.find((card) => card.id === 'card-location').status).toBe('claimed');
    expect(response.body.cards.find((card) => card.id === 'card-location').canonicalEntityExternalId).toBe('entity-1');
    expect(response.body.cards.find((card) => card.id === 'card-event').focusState).toBe('active');
    expect(response.body.claimedEntityLinks).toHaveLength(1);
    expect(response.body.claimedEntityLinks[0]).toEqual(
      expect.objectContaining({
        cardId: 'card-location',
        entityExternalId: 'entity-1',
        readingId: 'reading-claim-1'
      })
    );
    expect(response.body.characterSheet).toEqual(
      expect.objectContaining({
        playerId: 'seer-player-claim-1',
        identity: expect.objectContaining({
          archetype: 'North-Facing Cairn'
        }),
        skills: expect.objectContaining({
          awareness: 20
        })
      })
    );
    expect(response.body.characterSheet.notes).toEqual(
      expect.arrayContaining(['location: North-Facing Cairn - A high place that sees too far.'])
    );
    expect(response.body.lastTurn.transitionType).toBe('card_claimed');
    expect(response.body.lastTurn.toolCalls[0].tool_id).toBe('claim_card');
    expect(response.body.lastTurn.toolCalls[0].input.entity_external_id).toBe('entity-1');

    const stored = await SeerReading.findOne({ readingId: 'reading-claim-1' }).lean();
    expect(stored.claimedCards).toHaveLength(1);
    expect(stored.cards.find((card) => card.id === 'card-location').status).toBe('claimed');
    expect(stored.claimedEntityLinks).toHaveLength(1);
    expect(stored.claimedEntityLinks[0].entityExternalId).toBe('entity-1');

    const storedEntity = await NarrativeEntity.findOne({ session_id: 'seer-session-claim-1', externalId: 'entity-1' }).lean();
    expect(storedEntity).toEqual(
      expect.objectContaining({
        session_id: 'seer-session-claim-1',
        sessionId: 'seer-session-claim-1',
        playerId: 'seer-player-claim-1',
        externalId: 'entity-1',
        name: 'North-Facing Cairn',
        canonicalStatus: 'candidate',
        worldId: 'world-claim-1',
        universeId: 'world-claim-1'
      })
    );
    expect(storedEntity.sourceReadingIds).toContain('reading-claim-1');
    expect(storedEntity.claimedFromCardIds).toContain('card-location');
    expect(Array.isArray(storedEntity.mediaAssets)).toBe(true);
    expect(storedEntity.mediaAssets.length).toBeGreaterThan(0);
    expect(storedEntity.reuseCount).toBeGreaterThanOrEqual(1);

    const storedCharacterSheet = await ImmersiveRpgCharacterSheet.findOne({
      sessionId: 'seer-session-claim-1',
      playerId: 'seer-player-claim-1'
    }).lean();
    expect(storedCharacterSheet).toBeTruthy();
    expect(storedCharacterSheet.identity?.archetype).toBe('North-Facing Cairn');
    expect(storedCharacterSheet.skills?.awareness).toBe(20);
  });
});

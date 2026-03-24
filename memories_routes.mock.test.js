import { jest } from '@jest/globals';

const memoryStore = [];

function buildValidMemory(overrides = {}) {
  return {
    memory_strength: 'vivid',
    emotional_sentiment: 'tense resolve',
    action_name: 'crossing unstable stone ledges above a flooded ravine',
    estimated_action_length: '20 minutes',
    time_within_action: 'middle',
    actual_result: 'a near-fall is avoided by instinct and luck',
    related_through_what: 'shared location and immediate stakes echoing the fragment',
    geographical_relevance: 'wet basalt and crosswinds make every step dangerous',
    temporal_relation: 'this moment',
    organizational_affiliation: 'none',
    consequences: 'typical danger suddenly escalates into a critical choice',
    distance_from_fragment_location_km: 0,
    shot_type: 'close-up',
    time_of_day: 'twilight',
    whose_eyes: 'the courier gripping a frayed rope line',
    'interior/exterior': 'exterior',
    what_is_being_watched: 'boots slipping at the ravine edge',
    location: 'Ravine shelf above the Yuradel run',
    estimated_duration_of_memory: 12,
    memory_distance: 'meanwhile',
    entities_in_memory: ['ravine shelf', 'rope line', 'courier', 'floodwater', 'wind shear'],
    currently_assumed_turns_to_round: '10 minutes - 1 hour',
    relevant_rolls: ['Dexterity', 'Perception', 'Resolve'],
    action_level: 'round',
    short_title: 'Stone Gives Way',
    dramatic_definition: 'Where Stone Gives Way',
    miseenscene:
      'The rope burns my palm when I jerk it tight. Wet stone slicks under my heel and the ravine yawns, loud and black, below.',
    ...overrides
  };
}

function matchesQuery(doc, query = {}) {
  return Object.entries(query).every(([key, value]) => doc?.[key] === value);
}

const mockInsertMany = jest.fn(async (docs) => {
  const now = new Date().toISOString();
  const inserted = docs.map((doc, index) => ({
    _id: `memory-${memoryStore.length + index + 1}`,
    createdAt: now,
    updatedAt: now,
    ...doc
  }));

  inserted.forEach((doc) => memoryStore.push({ ...doc }));
  return inserted.map((doc) => ({ ...doc }));
});

const mockFind = jest.fn((query) => {
  const rows = memoryStore.filter((doc) => matchesQuery(doc, query));
  const sorted = [...rows].sort((a, b) => `${b.createdAt}`.localeCompare(`${a.createdAt}`));

  return {
    sort: () => ({
      lean: async () => sorted.map((doc) => ({ ...doc }))
    }),
    lean: async () => sorted.map((doc) => ({ ...doc }))
  };
});

const mockDeleteMany = jest.fn(async (query = {}) => {
  const before = memoryStore.length;
  for (let index = memoryStore.length - 1; index >= 0; index -= 1) {
    if (matchesQuery(memoryStore[index], query)) {
      memoryStore.splice(index, 1);
    }
  }
  return { deletedCount: before - memoryStore.length };
});

const mockFindById = jest.fn((memoryId) => ({
  lean: async () => {
    const found = memoryStore.find((doc) => doc._id === memoryId);
    return found ? { ...found } : null;
  }
}));

const mockFindByIdAndUpdate = jest.fn((memoryId, update = {}) => ({
  lean: async () => {
    const index = memoryStore.findIndex((doc) => doc._id === memoryId);
    if (index === -1) {
      return null;
    }
    const patch = update?.$set || {};
    const next = {
      ...memoryStore[index],
      ...patch,
      updatedAt: new Date().toISOString()
    };
    memoryStore[index] = next;
    return { ...next };
  }
}));

const mockCallJsonLlm = jest.fn();
const mockEnsureDirectoryExists = jest.fn(async () => {});
const mockTextToImageOpenAi = jest.fn(async (prompt, samples, localPath) => ({
  revised_prompt: prompt,
  url: 'https://example.invalid/fake-image.png',
  localPath
}));
const mockGetRouteConfig = jest.fn(async () => ({
  promptTemplate: 'fragment={{fragmentText}} count={{memoryCount}}'
}));
const mockRenderPrompt = jest.fn((template, vars) =>
  template.replace('{{fragmentText}}', vars.fragmentText).replace('{{memoryCount}}', String(vars.memoryCount))
);
const mockValidatePayloadForRoute = jest.fn(async () => {});
const mockGetLatestPromptTemplate = jest.fn(async () => null);
const mockRenderPromptTemplateString = jest.fn((template, vars) =>
  template.replace('{{fragmentText}}', vars.fragmentText).replace('{{memoryCount}}', String(vars.memoryCount))
);

jest.unstable_mockModule('./models/memory_models.js', () => ({
  FragmentMemory: {
    insertMany: mockInsertMany,
    find: mockFind,
    findById: mockFindById,
    findByIdAndUpdate: mockFindByIdAndUpdate,
    deleteMany: mockDeleteMany
  }
}));

jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  callJsonLlm: mockCallJsonLlm
}));

jest.unstable_mockModule('./storyteller/utils.js', () => ({
  ensureDirectoryExists: mockEnsureDirectoryExists
}));

jest.unstable_mockModule('./ai/textToImage/api.js', () => ({
  textToImageOpenAi: mockTextToImageOpenAi
}));

jest.unstable_mockModule('./services/llmRouteConfigService.js', () => ({
  getRouteConfig: mockGetRouteConfig,
  renderPrompt: mockRenderPrompt,
  validatePayloadForRoute: mockValidatePayloadForRoute
}));

jest.unstable_mockModule('./services/typewriterPromptConfigService.js', () => ({
  getLatestPromptTemplate: mockGetLatestPromptTemplate,
  renderPromptTemplateString: mockRenderPromptTemplateString
}));

function getRouteHandler(router, method, routePath) {
  const layer = router.stack.find(
    (entry) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );
  if (!layer) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${routePath}`);
  }
  return layer.route.stack[0].handle;
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

async function invoke(handler, { body = {}, query = {}, params = {} } = {}) {
  const req = {
    body,
    query,
    params
  };
  const res = makeRes();
  await handler(req, res);
  return res;
}

let postFragmentToMemories;
let postMemoryFrontImage;
let postMemoryBackImage;
let getMemories;
let deleteMemories;

beforeAll(async () => {
  const { default: memoriesRouter } = await import('./routes/memoriesRoutes.js');
  postFragmentToMemories = getRouteHandler(memoriesRouter, 'post', '/fragmentToMemories');
  postMemoryFrontImage = getRouteHandler(memoriesRouter, 'post', '/memories/:memoryId/textToImage/front');
  postMemoryBackImage = getRouteHandler(memoriesRouter, 'post', '/memories/:memoryId/textToImage/back');
  getMemories = getRouteHandler(memoriesRouter, 'get', '/memories');
  deleteMemories = getRouteHandler(memoriesRouter, 'delete', '/memories');
});

beforeEach(() => {
  memoryStore.length = 0;
  jest.clearAllMocks();
  mockCallJsonLlm.mockResolvedValue({
    memories: [buildValidMemory()]
  });
});

describe('Memories routes - mock mode and persistence', () => {
  it.each(['debug', 'mock', 'mock_api_calls', 'mocked_api_calls'])(
    'uses mock mode for POST /api/fragmentToMemories when %s=true',
    async (flagName) => {
      const response = await invoke(postFragmentToMemories, {
        body: {
          sessionId: 'session-mock',
          playerId: 'player-mock',
          text: 'A cold pass and dangerous footing.',
          count: 2,
          includeCards: true,
          [flagName]: true
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.body.mocked).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.cardOptions).toEqual({ includeFront: true, includeBack: true });
      expect(response.body.memories[0]).toHaveProperty('memory_strength');
      expect(response.body.memories[0]).toHaveProperty('short_title');
      expect(response.body.memories[0]).toHaveProperty('dramatic_definition');
      expect(response.body.memories[0].front?.imageUrl).toMatch(/^\/assets\//);
      expect(response.body.memories[0].front?.imageUrl).toContain('/assets/mocks/memory_cards/memory_front_');
      expect(response.body.memories[0].back?.imageUrl).toMatch(/^\/assets\//);
      expect(response.body.memories[0].back?.imageUrl).toContain('/assets/mocks/memory_cards/memory_back_');
      expect(response.body.memories[0].front_image_url).toMatch(/^\/assets\//);
      expect(response.body.memories[0].back_image_url).toMatch(/^\/assets\//);

      expect(mockCallJsonLlm).not.toHaveBeenCalled();
      expect(mockTextToImageOpenAi).not.toHaveBeenCalled();

      const listResponse = await invoke(getMemories, { query: { sessionId: 'session-mock' } });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.body.count).toBe(2);
    }
  );

  it('uses non-mock LLM and image builders when mock flags are disabled', async () => {
    mockCallJsonLlm.mockResolvedValue({
      memories: [
        buildValidMemory({ dramatic_definition: 'First Echo' }),
        buildValidMemory({ dramatic_definition: 'Second Echo', distance_from_fragment_location_km: 3 })
      ]
    });

    const response = await invoke(postFragmentToMemories, {
      body: {
        sessionId: 'session-live-like',
        playerId: 'player-live-like',
        text: 'Torchlight over wet basalt.',
        count: 2,
        includeCards: true,
        includeFront: true,
        includeBack: false,
        mock: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.mocked).toBe(false);
    expect(response.body.count).toBe(2);
    expect(response.body.cardOptions).toEqual({ includeFront: true, includeBack: false });
    expect(mockGetRouteConfig).toHaveBeenCalledWith('fragment_to_memories');
    expect(mockRenderPrompt).toHaveBeenCalled();
    expect(mockCallJsonLlm).toHaveBeenCalledTimes(1);
    expect(mockValidatePayloadForRoute).toHaveBeenCalledWith('fragment_to_memories', expect.any(Object));
    expect(mockEnsureDirectoryExists).toHaveBeenCalledTimes(1);
    expect(mockTextToImageOpenAi).toHaveBeenCalledTimes(2);
    expect(response.body.memories[0].front?.imageUrl).toMatch(/^\/assets\/session-live-like\/memory_cards\//);
    expect(response.body.memories[0].back).toBeUndefined();
    expect(response.body.memories[0].back_image_url).toBe('');
  });

  it('normalizes live memory field types before schema validation and persistence', async () => {
    mockCallJsonLlm.mockResolvedValue({
      memories: [
        buildValidMemory({
          memory_strength: 7,
          estimated_duration_of_memory: '14 minutes',
          memory_distance: 3,
          currently_assumed_turns_to_round: 2,
          entities_in_memory: 'bell tower',
          relevant_rolls: 'Perception'
        })
      ]
    });

    const response = await invoke(postFragmentToMemories, {
      body: {
        sessionId: 'session-live-normalized',
        playerId: 'player-live-normalized',
        text: 'A harbor bell cuts through the fog.',
        count: 1,
        mock: false
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockValidatePayloadForRoute).toHaveBeenCalledWith('fragment_to_memories', {
      memories: [
        expect.objectContaining({
          memory_strength: '7',
          estimated_duration_of_memory: 14,
          memory_distance: '3',
          currently_assumed_turns_to_round: '2',
          entities_in_memory: ['bell tower'],
          relevant_rolls: ['Perception'],
          short_title: 'Stone Gives Way'
        })
      ]
    });
    expect(response.body.memories[0].memory_strength).toBe('7');
    expect(response.body.memories[0].estimated_duration_of_memory).toBe(14);
    expect(response.body.memories[0].memory_distance).toBe('3');
    expect(response.body.memories[0].currently_assumed_turns_to_round).toBe('2');
    expect(response.body.memories[0].entities_in_memory).toEqual(['bell tower']);
    expect(response.body.memories[0].relevant_rolls).toEqual(['Perception']);
    expect(response.body.memories[0].short_title).toBe('Stone Gives Way');
  });

  it('generates and persists a mocked front image for one memory without calling the live image model', async () => {
    const seedResponse = await invoke(postFragmentToMemories, {
      body: {
        sessionId: 'single-card-side-session',
        playerId: 'single-card-side-player',
        text: 'A bell rope shivers over black water.',
        count: 1,
        includeCards: false,
        debug: true
      }
    });

    expect(seedResponse.statusCode).toBe(200);
    const memoryId = seedResponse.body.memories[0]._id;

    const response = await invoke(postMemoryFrontImage, {
      params: { memoryId },
      body: { mock: true }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.side).toBe('front');
    expect(response.body.mocked).toBe(true);
    expect(response.body.card.prompt).toContain('Create a full-frame RPG collector card FRONT illustration');
    expect(response.body.card.imageUrl).toContain('/assets/mocks/memory_cards/memory_front_');
    expect(response.body.memory.front?.imageUrl).toContain('/assets/mocks/memory_cards/memory_front_');
    expect(response.body.memory.front_image_url).toContain('/assets/mocks/memory_cards/memory_front_');
    expect(mockTextToImageOpenAi).not.toHaveBeenCalled();
  });

  it('generates and persists a live-like back image for one memory through the image builder', async () => {
    const seedResponse = await invoke(postFragmentToMemories, {
      body: {
        sessionId: 'single-back-side-session',
        playerId: 'single-back-side-player',
        text: 'Lantern light sways between carved pylons.',
        count: 1,
        includeCards: false,
        debug: true
      }
    });

    expect(seedResponse.statusCode).toBe(200);
    const seededMemory = seedResponse.body.memories[0];

    const response = await invoke(postMemoryBackImage, {
      params: { memoryId: seededMemory._id },
      body: { mock: false }
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.side).toBe('back');
    expect(response.body.mocked).toBe(false);
    expect(response.body.card.prompt).toContain('Create a full-frame RPG collector card BACK texture');
    expect(response.body.card.imageUrl).toMatch(
      /^\/assets\/single-back-side-session\/memory_cards\//
    );
    expect(response.body.memory.back?.imageUrl).toMatch(
      /^\/assets\/single-back-side-session\/memory_cards\//
    );
    expect(response.body.memory.back_image_url).toMatch(
      /^\/assets\/single-back-side-session\/memory_cards\//
    );
    expect(mockEnsureDirectoryExists).toHaveBeenCalledTimes(1);
    expect(mockTextToImageOpenAi).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when a per-memory card image route targets a missing memory', async () => {
    const response = await invoke(postMemoryBackImage, {
      params: { memoryId: 'missing-memory-id' },
      body: { mock: true }
    });

    expect(response.statusCode).toBe(404);
  });

  it('deletes persisted memories via DELETE /api/memories', async () => {
    const writeA = await invoke(postFragmentToMemories, {
      body: {
        sessionId: 'delete-session',
        playerId: 'player-a',
        text: 'First stream of events',
        count: 3,
        debug: true
      }
    });
    expect(writeA.statusCode).toBe(200);

    const writeB = await invoke(postFragmentToMemories, {
      body: {
        sessionId: 'delete-session',
        playerId: 'player-b',
        text: 'Second stream of events',
        count: 2,
        debug: true
      }
    });
    expect(writeB.statusCode).toBe(200);

    const beforeDelete = await invoke(getMemories, { query: { sessionId: 'delete-session' } });
    expect(beforeDelete.statusCode).toBe(200);
    expect(beforeDelete.body.count).toBe(5);

    const deleteResponse = await invoke(deleteMemories, {
      query: { sessionId: 'delete-session', playerId: 'player-a' }
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(deleteResponse.body.deletedCount).toBe(3);

    const afterPartialDelete = await invoke(getMemories, { query: { sessionId: 'delete-session' } });
    expect(afterPartialDelete.statusCode).toBe(200);
    expect(afterPartialDelete.body.count).toBe(2);
    expect(afterPartialDelete.body.memories.every((doc) => doc.playerId === 'player-b')).toBe(true);

    const finalDelete = await invoke(deleteMemories, { query: { sessionId: 'delete-session' } });
    expect(finalDelete.statusCode).toBe(200);
    expect(finalDelete.body.deletedCount).toBe(2);

    const afterFinalDelete = await invoke(getMemories, { query: { sessionId: 'delete-session' } });
    expect(afterFinalDelete.statusCode).toBe(200);
    expect(afterFinalDelete.body.count).toBe(0);
  });

  it('returns 400 for DELETE /api/memories without sessionId', async () => {
    const response = await invoke(deleteMemories);
    expect(response.statusCode).toBe(400);
  });
});

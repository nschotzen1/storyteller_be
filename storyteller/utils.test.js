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

// Import generate_storyteller and Storyteller model
import { generate_storyteller, Storyteller } from './utils.js';
import mockStorytellersData from './db/mock_storytellers.json'; // Corrected path

const allMockNames = mockStorytellersData.map(s => s.name);

describe('generate_storyteller', () => {
  let originalMockMode;
  let originalEnableLlm;

  beforeEach(async () => {
    // Save original environment variables
    originalMockMode = process.env.MOCK_STORYTELLER_MODE;
    originalEnableLlm = process.env.ENABLE_LLM_STORYTELLER;
    // Clear Storyteller collection before each test in this suite
    await Storyteller.deleteMany({});
  });

  afterEach(() => {
    // Restore original environment variables
    process.env.MOCK_STORYTELLER_MODE = originalMockMode;
    process.env.ENABLE_LLM_STORYTELLER = originalEnableLlm;
    // Clear any mocks
    jest.restoreAllMocks();
  });

  describe('Mock Mode', () => {
    beforeEach(() => {
      process.env.MOCK_STORYTELLER_MODE = 'true';
      process.env.ENABLE_LLM_STORYTELLER = 'false';
    });

    it('should return a random storyteller profile in mock mode and upsert it', async () => {
      const profile = await generate_storyteller('test fragment', ['tag1'], ['influence1']);
      expect(profile).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(typeof profile.name).toBe('string');
      expect(allMockNames).toContain(profile.name);

      // Verify upsert
      const dbProfile = await Storyteller.findOne({ name: profile.name }).lean();
      expect(dbProfile).toBeDefined();
      expect(dbProfile.name).toBe(profile.name);
      expect(dbProfile.level).toBe(profile.level);
    });

    it('should exclude specified names in mock mode', async () => {
      const excludedName = "Ada the Lantern-Bearer";
      // Run multiple times to increase chance of catching non-exclusion if buggy
      for (let i = 0; i < 10; i++) {
        const profile = await generate_storyteller('test fragment', ['tag1'], ['influence1'], [excludedName]);
        expect(profile).toBeDefined();
        // If only one profile is left after exclusion, it should always be that one.
        // If multiple are left, this checks if the excluded one is NOT returned.
        if (profile) { // profile can be null if all are excluded (tested below)
             expect(profile.name).not.toBe(excludedName);
        }
      }
       // Check if the excluded name is not in the DB after this test
      const dbProfile = await Storyteller.findOne({ name: excludedName }).lean();
      const generatedProfile = await Storyteller.findOne({name: {$ne: excludedName}}).lean();
      //if only one profile was generated, it should not be the excluded one
      if(generatedProfile && (allMockNames.length - 1 === 1)){
           expect(generatedProfile.name).not.toBe(excludedName);
      }
       //The excluded name should not have been upserted.
      expect(dbProfile).toBeNull();


    });

    it('should return null if all mock profiles are excluded', async () => {
      // The function was defined to return null if no profiles are available after filtering.
      const profile = await generate_storyteller('test fragment', ['tag1'], ['influence1'], allMockNames);
      expect(profile).toBeNull();
    });
  });

  describe('LLM Mode (Stubbed)', () => {
    let consoleSpy;

    beforeEach(() => {
      process.env.ENABLE_LLM_STORYTELLER = 'true';
      process.env.MOCK_STORYTELLER_MODE = 'false';
      consoleSpy = jest.spyOn(console, 'log');
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should log a prompt and return a mock profile (due to stub) and upsert it', async () => {
      const profile = await generate_storyteller('test fragment for LLM', ['llm_tag'], ['llm_influence']);

      expect(profile).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(typeof profile.name).toBe('string');
      expect(allMockNames).toContain(profile.name);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--- LLM PROMPT ---'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Fragment context: test fragment for LLM'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Universe Tags: llm_tag'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Influences: llm_influence'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('LLM Storyteller generation is stubbed. Using mock data for now.'));

      // Verify upsert
      const dbProfile = await Storyteller.findOne({ name: profile.name }).lean();
      expect(dbProfile).toBeDefined();
      expect(dbProfile.name).toBe(profile.name);
      expect(dbProfile.level).toBe(profile.level);
    });

    it('should exclude names in stubbed LLM mode and upsert the result', async () => {
        const excludedName = "The Greasehand";
        const profile = await generate_storyteller('llm fragment', ['tag_llm'], ['inf_llm'], [excludedName]);

        expect(profile).toBeDefined();
        if (profile) {
            expect(profile.name).not.toBe(excludedName);
        }

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--- LLM PROMPT ---'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(`Excluded Names: ${excludedName}`));

        // Verify upsert (or lack thereof for excluded name)
        const dbExcludedProfile = await Storyteller.findOne({ name: excludedName }).lean();
        expect(dbExcludedProfile).toBeNull(); // Excluded should not be upserted

        if (profile) {
            const dbProfile = await Storyteller.findOne({ name: profile.name }).lean();
            expect(dbProfile).toBeDefined();
            expect(dbProfile.name).toBe(profile.name);
        }
    });
  });
});

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setFragment, NarrativeFragment } from './utils.js'; // Assuming utils.js is in the same directory

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear data from the NarrativeFragment collection after each test
  await NarrativeFragment.deleteMany({});
});

describe('setFragment', () => {
  it('should save a new fragment and return the saved document', async () => {
    const sessionId = 'test-session-1';
    const fragmentContent = { text: 'This is a test fragment.' };
    const turn = 1;

    const result = await setFragment(sessionId, fragmentContent, turn);

    // Assertions on the returned document
    expect(result).toBeDefined();
    expect(result.session_id).toBe(sessionId);
    expect(result.fragment).toEqual(fragmentContent); // Use toEqual for deep equality on objects
    expect(result.turn).toBe(turn);

    // Verify by querying the database directly
    const dbDoc = await NarrativeFragment.findOne({ session_id: sessionId, turn: turn }).lean();
    expect(dbDoc).toBeDefined();
    expect(dbDoc.fragment).toEqual(fragmentContent);
    expect(dbDoc.session_id).toBe(sessionId);
    expect(dbDoc.turn).toBe(turn);
  });

  it('should update an existing fragment (upsert behavior)', async () => {
    const sessionId = 'test-session-upsert';
    const initialFragmentContent = { text: 'Initial fragment content for upsert test.' };
    const updatedFragmentContent = { text: 'Updated fragment content for upsert test.' };
    const turn = 1;

    // First call to setFragment - should create the document
    const initialResult = await setFragment(sessionId, initialFragmentContent, turn);
    expect(initialResult.fragment).toEqual(initialFragmentContent);

    // Second call to setFragment with the same sessionId and turn - should update
    const updatedResult = await setFragment(sessionId, updatedFragmentContent, turn);

    // Assertions on the returned updated document
    expect(updatedResult).toBeDefined();
    expect(updatedResult.session_id).toBe(sessionId);
    expect(updatedResult.fragment).toEqual(updatedFragmentContent);
    expect(updatedResult.turn).toBe(turn);

    // Verify by querying the database directly
    const dbDocs = await NarrativeFragment.find({ session_id: sessionId, turn: turn }).lean();
    expect(dbDocs.length).toBe(1); // Crucial: ensure no new document was created
    expect(dbDocs[0].fragment).toEqual(updatedFragmentContent);
  });

  it('should handle different sessionIds and turns independently', async () => {
    const sessionId1 = 'test-session-multi-1';
    const fragmentContent1 = { text: 'Fragment for session 1, turn 1.' };
    const turn1 = 1;

    const sessionId2 = 'test-session-multi-2';
    const fragmentContent2 = { text: 'Fragment for session 2, turn 1.' };
    const turn2 = 1; // Same turn, different session

    const fragmentContent3 = { text: 'Fragment for session 1, turn 2.' };
    const turn3 = 2; // Same session, different turn


    await setFragment(sessionId1, fragmentContent1, turn1);
    await setFragment(sessionId2, fragmentContent2, turn2);
    await setFragment(sessionId1, fragmentContent3, turn3);

    // Verify session 1, turn 1
    const dbDoc1 = await NarrativeFragment.findOne({ session_id: sessionId1, turn: turn1 }).lean();
    expect(dbDoc1.fragment).toEqual(fragmentContent1);

    // Verify session 2, turn 1
    const dbDoc2 = await NarrativeFragment.findOne({ session_id: sessionId2, turn: turn2 }).lean();
    expect(dbDoc2.fragment).toEqual(fragmentContent2);
    
    // Verify session 1, turn 2
    const dbDoc3 = await NarrativeFragment.findOne({ session_id: sessionId1, turn: turn3 }).lean();
    expect(dbDoc3.fragment).toEqual(fragmentContent3);

    // Ensure no cross-contamination
    const allDocsForSession1 = await NarrativeFragment.find({ session_id: sessionId1 }).lean();
    expect(allDocsForSession1.length).toBe(2);
  });
});

// Test for NarrativeFragment model itself to ensure schema is applied
describe('NarrativeFragment Model', () => {
  it('should correctly save and retrieve a document', async () => {
    const data = {
      session_id: 'model-test-session',
      fragment: { title: 'Test Title', body: 'Test body content' },
      turn: 100,
    };
    const narrativeFragment = new NarrativeFragment(data);
    const savedDoc = await narrativeFragment.save();

    expect(savedDoc._id).toBeDefined();
    expect(savedDoc.session_id).toBe(data.session_id);
    expect(savedDoc.fragment).toEqual(data.fragment);
    expect(savedDoc.turn).toBe(data.turn);
    expect(savedDoc.createdAt).toBeDefined(); // Default value from schema

    const foundDoc = await NarrativeFragment.findById(savedDoc._id).lean();
    expect(foundDoc.fragment).toEqual(data.fragment);
  });

  it('should require session_id and fragment fields', async () => {
    let error;
    try {
      const narrativeFragment = new NarrativeFragment({ turn: 1 }); // Missing required fields
      await narrativeFragment.save();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(error.errors.session_id).toBeDefined();
    expect(error.errors.fragment).toBeDefined();
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

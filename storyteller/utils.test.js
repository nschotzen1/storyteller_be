import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { setFragment } from './utils.js'; // Assuming utils.js is in the same directory
import { NarrativeFragment } from '../models/models.js';

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
    // expect(savedDoc.createdAt).toBeDefined(); // NarrativeFragmentSchema does not have timestamps

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

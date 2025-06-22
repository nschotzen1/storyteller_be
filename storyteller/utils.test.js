import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  setFragment,
  NarrativeFragment,
  createStoryteller,
  findStoryteller,
  findStorytellerByName,
  updateStoryteller,
  deleteStoryteller,
  upsertStoryteller
} from './utils.js'; // Assuming utils.js is in the same directory

// Mock the Storyteller model from models/models.js
const mockStorytellerSave = jest.fn();
const mockStorytellerCreate = jest.fn();
const mockStorytellerFind = jest.fn();
const mockStorytellerFindOne = jest.fn();
const mockStorytellerFindOneAndUpdate = jest.fn();
const mockStorytellerDeleteOne = jest.fn(); // Corrected from findOneAndDelete to deleteOne if that's what's used

jest.mock('../models/models.js', () => ({
  NarrativeFragment: mongoose.model('NarrativeFragment', new mongoose.Schema({ // Real schema for NarrativeFragment
    session_id: { type: String, required: true },
    fragment: { type: mongoose.Schema.Types.Mixed, required: true },
    turn: { type: Number },
    createdAt: { type: Date, default: Date.now }
  })),
  Storyteller: jest.fn().mockImplementation(function(data) { // Mocked Storyteller
    return {
      ...data,
      save: mockStorytellerSave.mockResolvedValue(data), // Ensure save returns the data
    };
  }),
  // If ChatMessage is also used by other utility functions and needs a real model for tests:
  ChatMessage: mongoose.model('ChatMessage', new mongoose.Schema({ /* ... define schema if needed ... */ })),
}));

// Static methods for Storyteller mock
// Storyteller.create = mockStorytellerCreate; // This line was causing issues, create is not a static method of the class itself but of the model.
// Correct way to mock static methods on a class mock:
const Storyteller = require('../models/models.js').Storyteller; // get the mocked constructor
Storyteller.create = mockStorytellerCreate;
Storyteller.find = mockStorytellerFind;
Storyteller.findOne = mockStorytellerFindOne;
Storyteller.findOneAndUpdate = mockStorytellerFindOneAndUpdate;
Storyteller.deleteOne = mockStorytellerDeleteOne; // Corrected this line
Storyteller.findOneAndDelete = mockStorytellerDeleteOne; // If findOneAndDelete is preferred

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {
    // useNewUrlParser: true, // Deprecated
    // useUnifiedTopology: true, // Deprecated
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // Clear data from the NarrativeFragment collection after each test
  await NarrativeFragment.deleteMany({});
  // Clear all mock function calls after each test
  mockStorytellerSave.mockClear();
  mockStorytellerCreate.mockClear();
  mockStorytellerFind.mockClear();
  mockStorytellerFindOne.mockClear();
  mockStorytellerFindOneAndUpdate.mockClear();
  mockStorytellerDeleteOne.mockClear();
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

// Tests for Storyteller CRUD functions
describe('Storyteller CRUD operations', () => {
  const storytellerData = { name: "Ada", level: 10 };
  const storytellerName = "Ada";

  describe('createStoryteller', () => {
    it('should call Storyteller constructor and save', async () => {
      // We need to mock the result of the save() call for the instance.
      // The constructor is already mocked to return an object with a save method.
      mockStorytellerSave.mockResolvedValueOnce(storytellerData); // Mock the save method for this specific test case

      const result = await createStoryteller(storytellerData);
      expect(Storyteller).toHaveBeenCalledWith(storytellerData);
      expect(mockStorytellerSave).toHaveBeenCalled();
      expect(result).toEqual(storytellerData);
    });
  });

  describe('findStoryteller', () => {
    it('should call Storyteller.find with the query', async () => {
      const query = { level: { $gt: 5 } };
      mockStorytellerFind.mockResolvedValueOnce([storytellerData]); // Mock the static find method

      await findStoryteller(query);
      expect(Storyteller.find).toHaveBeenCalledWith(query);
    });
  });

  describe('findStorytellerByName', () => {
    it('should call Storyteller.findOne with the name query', async () => {
      mockStorytellerFindOne.mockResolvedValueOnce(storytellerData); // Mock the static findOne method

      await findStorytellerByName(storytellerName);
      expect(Storyteller.findOne).toHaveBeenCalledWith({ name: storytellerName });
    });
  });

  describe('updateStoryteller', () => {
    it('should call Storyteller.findOneAndUpdate with correct parameters', async () => {
      const updates = { level: 11 };
      const expectedOptions = { new: true };
      mockStorytellerFindOneAndUpdate.mockResolvedValueOnce({ ...storytellerData, ...updates }); // Mock the static findOneAndUpdate

      await updateStoryteller(storytellerName, updates);
      expect(Storyteller.findOneAndUpdate).toHaveBeenCalledWith({ name: storytellerName }, updates, expectedOptions);
    });
  });

  describe('deleteStoryteller', () => {
    it('should call Storyteller.findOneAndDelete with the name query', async () => {
      // Using findOneAndDelete as per the implementation, ensure mock matches
      // If the implementation uses deleteOne, this should be Storyteller.deleteOne
      Storyteller.findOneAndDelete = jest.fn().mockResolvedValueOnce(storytellerData); // Mock specifically for this test

      await deleteStoryteller(storytellerName);
      expect(Storyteller.findOneAndDelete).toHaveBeenCalledWith({ name: storytellerName });
    });
  });

  describe('upsertStoryteller', () => {
    const upsertData = { name: "Tess", level: 5, immediate_ghost_appearance: "A whisper" };

    it('should call Storyteller.findOneAndUpdate for upsertion', async () => {
      const expectedOptions = { upsert: true, new: true, setDefaultsOnInsert: true };
      mockStorytellerFindOneAndUpdate.mockResolvedValueOnce(upsertData); // Mock the static findOneAndUpdate for upsert

      await upsertStoryteller(upsertData);
      expect(Storyteller.findOneAndUpdate).toHaveBeenCalledWith({ name: upsertData.name }, upsertData, expectedOptions);
    });
  });
});

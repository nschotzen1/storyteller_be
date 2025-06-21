import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  createStoryteller,
  getAllStorytellers,
  getStorytellerByName,
  updateStoryteller,
  deleteStoryteller,
  upsertStoryteller
} from './storyteller_controller.js';
import { Storyteller, connectDB } from '../models/models.js'; // Adjust path as necessary

let mongoServer;

const mockStorytellerData1 = {
  name: "Test Oracle",
  immediate_ghost_appearance: "A test mist",
  typewriter_key: { key_name: "T", sound_effect: "test_sound.mp3" },
  influences: ["Test influence"],
  known_universes: ["Test Universe"],
  level: 1,
  voice_creation: { engine: "test_engine", voice_id: "test_voice" },
  vector: [0.1, 0.2]
};

const mockStorytellerData2 = {
  name: "Test Chronicler",
  immediate_ghost_appearance: "Test stardust",
  typewriter_key: { key_name: "C", sound_effect: "test_chronicler.wav" },
  influences: ["Test history"],
  known_universes: ["Test Galaxy"],
  level: 2,
  voice_creation: { engine: "test_engine2", voice_id: "test_voice2" },
  vector: [0.3, 0.4]
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await connectDB(mongoUri); // Use the new connectDB function
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Storyteller.deleteMany({});
});

describe('Storyteller Controller', () => {
  describe('createStoryteller', () => {
    it('should create a new storyteller', async () => {
      const created = await createStoryteller(mockStorytellerData1);
      expect(created).toBeDefined();
      expect(created.name).toBe(mockStorytellerData1.name);
      expect(created.level).toBe(mockStorytellerData1.level);
      const dbStoryteller = await Storyteller.findById(created._id);
      expect(dbStoryteller).toBeDefined();
      expect(dbStoryteller.name).toBe(mockStorytellerData1.name);
    });
  });

  describe('getAllStorytellers', () => {
    it('should return an empty array if no storytellers exist', async () => {
      const storytellers = await getAllStorytellers();
      expect(storytellers).toEqual([]);
    });

    it('should return all storytellers', async () => {
      await Storyteller.create(mockStorytellerData1);
      await Storyteller.create(mockStorytellerData2);
      const storytellers = await getAllStorytellers();
      expect(storytellers.length).toBe(2);
      expect(storytellers.some(s => s.name === mockStorytellerData1.name)).toBe(true);
      expect(storytellers.some(s => s.name === mockStorytellerData2.name)).toBe(true);
    });
  });

  describe('getStorytellerByName', () => {
    it('should return null if storyteller with the name does not exist', async () => {
      const storyteller = await getStorytellerByName("NonExistentName");
      expect(storyteller).toBeNull();
    });

    it('should return the storyteller if found by name', async () => {
      await Storyteller.create(mockStorytellerData1);
      const storyteller = await getStorytellerByName(mockStorytellerData1.name);
      expect(storyteller).toBeDefined();
      expect(storyteller.name).toBe(mockStorytellerData1.name);
    });
  });

  describe('updateStoryteller', () => {
    it('should return null if storyteller to update does not exist', async () => {
      const updated = await updateStoryteller("NonExistentName", { level: 10 });
      expect(updated).toBeNull();
    });

    it('should update an existing storyteller', async () => {
      const created = await Storyteller.create(mockStorytellerData1);
      const updates = { level: 10, influences: ["New Influence"] };
      const updated = await updateStoryteller(created.name, updates);
      expect(updated).toBeDefined();
      expect(updated.name).toBe(created.name);
      expect(updated.level).toBe(10);
      expect(updated.influences).toContain("New Influence");

      const dbStoryteller = await Storyteller.findById(created._id);
      expect(dbStoryteller.level).toBe(10);
    });
  });

  describe('deleteStoryteller', () => {
    it('should return delete count 0 if storyteller does not exist', async () => {
      const result = await deleteStoryteller("NonExistentName");
      expect(result.deletedCount).toBe(0);
    });

    it('should delete an existing storyteller', async () => {
      const created = await Storyteller.create(mockStorytellerData1);
      const result = await deleteStoryteller(created.name);
      expect(result.deletedCount).toBe(1);
      const dbStoryteller = await Storyteller.findById(created._id);
      expect(dbStoryteller).toBeNull();
    });
  });

  describe('upsertStoryteller', () => {
    it('should create a new storyteller if one does not exist (insert)', async () => {
      const upserted = await upsertStoryteller(mockStorytellerData1);
      expect(upserted).toBeDefined();
      expect(upserted.name).toBe(mockStorytellerData1.name);
      expect(upserted.level).toBe(mockStorytellerData1.level);
      const dbStorytellers = await Storyteller.find({ name: mockStorytellerData1.name });
      expect(dbStorytellers.length).toBe(1);
    });

    it('should update an existing storyteller if one exists by name (update)', async () => {
      await Storyteller.create(mockStorytellerData1); // Pre-existing
      const updates = { ...mockStorytellerData1, level: 12, immediate_ghost_appearance: "Updated mist" };
      const upserted = await upsertStoryteller(updates);

      expect(upserted).toBeDefined();
      expect(upserted.name).toBe(mockStorytellerData1.name);
      expect(upserted.level).toBe(12);
      expect(upserted.immediate_ghost_appearance).toBe("Updated mist");

      const dbStorytellers = await Storyteller.find({ name: mockStorytellerData1.name });
      expect(dbStorytellers.length).toBe(1);
      expect(dbStorytellers[0].level).toBe(12);
      expect(dbStorytellers[0].immediate_ghost_appearance).toBe("Updated mist");
    });

    it('should use default values on insert if not provided and schema has defaults', async () => {
        // This test assumes your schema has defaults, which it does for timestamps.
        // For other fields, ensure they are not 'required' or provide them.
        const partialData = { name: "Partial Test", level: 3 };
        const upserted = await upsertStoryteller(partialData);
        expect(upserted).toBeDefined();
        expect(upserted.name).toBe("Partial Test");
        expect(upserted.createdAt).toBeDefined(); // Timestamp default
        expect(upserted.updatedAt).toBeDefined(); // Timestamp default
    });
  });
});

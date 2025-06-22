import mongoose from 'mongoose';
import {
    embed_storyteller,
    search_storytellers_by_fragment,
    NarrativeEntity
} from './utils.js';
import { pipeline as actualPipeline } from '@xenova/transformers'; // Import actual to mock parts of it
import { qdrantClient } from '../db/qdrant_client.js'; // To mock its methods

// Mock @xenova/transformers
// We mock the top-level 'pipeline' function that is imported and used in utils.js
jest.mock('@xenova/transformers', () => ({
  ...jest.requireActual('@xenova/transformers'), // Retain other exports from the module
  pipeline: jest.fn(), // Mock the pipeline factory function
  env: jest.requireActual('@xenova/transformers').env, // Use actual env to allow allowLocalModels = false
}));

const mockPipelineFn = pipeline; // Alias for the mocked pipeline factory

describe('Storyteller Embedding and Search Utilities', () => {
  let originalMockMode;

  beforeAll(() => {
    originalMockMode = process.env.MOCK_MODE;
  });

  afterAll(() => {
    process.env.MOCK_MODE = originalMockMode;
    // Mongoose connection is managed globally in utils.js,
    // ideally, it should be managed per test suite or application lifecycle.
    // For now, we don't disconnect here as other tests might still run or utils.js might be imported elsewhere.
  });

  beforeEach(() => {
    delete process.env.MOCK_MODE;
    jest.clearAllMocks(); // Clear all mocks before each test
  });

  // No top-level afterEach for mockNarrativeEntityFind as it's specific to search tests in mock mode

  describe('embed_storyteller', () => {
    const sampleProfile = { name: 'Test Profile', description: 'A profile for testing.', lore: 'Some ancient lore.' };
    const target_dim = 384; // Expected dimension for Supabase/gte-small

    test('should return a random 384-dim vector in MOCK_MODE', async () => {
      process.env.MOCK_MODE = 'true';
      const embedding = await embed_storyteller(sampleProfile);
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(target_dim); // Check for 384 dimensions
      embedding.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      });
      const isAllZeros = embedding.every(v => v === 0);
      expect(isAllZeros).toBe(false); // Ensure it's not just a zero vector
    });

    test('should return a fixed 384-dim vector in REAL_MODE (mocked model)', async () => {
      process.env.MOCK_MODE = 'false';
      const fixedVector = Array.from({ length: target_dim }, (_, i) => i / 1000);
      const mockExtractor = jest.fn().mockResolvedValue({ data: new Float32Array(fixedVector) });
      mockPipelineFn.mockResolvedValue(mockExtractor); // Mock the pipeline factory to return our mockExtractor

      const embedding = await embed_storyteller(sampleProfile);

      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBe(target_dim);
      expect(embedding).toEqual(fixedVector);
      expect(mockPipelineFn).toHaveBeenCalledWith('feature-extraction', 'Xenova/Supabase-gte-small', expect.anything());
      expect(mockExtractor).toHaveBeenCalledWith(
        `${sampleProfile.name} \n\n ${sampleProfile.description} \n\n ${sampleProfile.lore}`,
        { pooling: 'mean', normalize: true }
      );
    });
    
    test('should return a 384-dim zero vector if profile has no text content in REAL_MODE (model not called)', async () => {
        process.env.MOCK_MODE = 'false';
        const emptyProfile = { name: ' ', description: null, lore: '' };
        const embedding = await embed_storyteller(emptyProfile);
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(target_dim);
        expect(embedding.every(val => val === 0)).toBe(true);
        expect(mockPipelineFn).not.toHaveBeenCalled(); // Pipeline should not be called
    });

    test('should return a 384-dim zero vector for an empty profile object in REAL_MODE (model not called)', async () => {
        process.env.MOCK_MODE = 'false';
        const embedding = await embed_storyteller({});
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(target_dim);
        expect(embedding.every(val => val === 0)).toBe(true);
        expect(mockPipelineFn).not.toHaveBeenCalled();
    });

    test('should handle error during model loading in REAL_MODE and return zero vector', async () => {
        process.env.MOCK_MODE = 'false';
        mockPipelineFn.mockRejectedValue(new Error("Model load failed"));

        const embedding = await embed_storyteller(sampleProfile);
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(target_dim);
        expect(embedding.every(val => val === 0)).toBe(true);
    });

    test('should handle error during embedding extraction in REAL_MODE and return zero vector', async () => {
        process.env.MOCK_MODE = 'false';
        const mockExtractor = jest.fn().mockRejectedValue(new Error("Extraction failed"));
        mockPipelineFn.mockResolvedValue(mockExtractor);

        const embedding = await embed_storyteller(sampleProfile);
        expect(Array.isArray(embedding)).toBe(true);
        expect(embedding.length).toBe(target_dim);
        expect(embedding.every(val => val === 0)).toBe(true);
    });

  });

  describe('search_storytellers_by_fragment', () => {
    const mockEntitiesData = [
      { _id: 'id1', name: 'Entity Alpha', universalTraits: ['fantasy', 'brave'] },
      { _id: 'id2', name: 'Entity Beta', universalTraits: ['sci-fi', 'vast'] },
      { _id: 'id3', name: 'Entity Gamma', universalTraits: ['fantasy', 'magic'] },
    ];
    const leanMock = (data) => JSON.parse(JSON.stringify(data));
    let mockNarrativeEntityFind; // Specific to mock mode tests for this describe block
    let mockQdrantSearch;      // Specific to real mode tests for this describe block

    beforeEach(() => {
        // Spy for NarrativeEntity.find (used in MOCK_MODE)
        mockNarrativeEntityFind = jest.spyOn(NarrativeEntity, 'find');
        // Spy for qdrantClient.search (used in REAL_MODE)
        mockQdrantSearch = jest.spyOn(qdrantClient, 'search');
    });

    afterEach(() => {
        if (mockNarrativeEntityFind) mockNarrativeEntityFind.mockRestore();
        if (mockQdrantSearch) mockQdrantSearch.mockRestore();
    });

    // MOCK_MODE tests remain largely the same, just ensure they still pass
    test('should return top_k random entities in MOCK_MODE with no tags', async () => {
      process.env.MOCK_MODE = 'true';
      mockNarrativeEntityFind.mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(leanMock(mockEntitiesData))
      });
      const results = await search_storytellers_by_fragment([0.1], null, 2);
      expect(results.length).toBe(2);
      expect(mockNarrativeEntityFind).toHaveBeenCalledWith({});
    });

    test('should filter entities by tags in MOCK_MODE', async () => {
      process.env.MOCK_MODE = 'true';
      mockNarrativeEntityFind.mockReturnValue({
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(leanMock(mockEntitiesData))
      });
      const results = await search_storytellers_by_fragment([], ['sci-fi'], 1);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Entity Beta');
    });

    // REAL_MODE tests
    test('should call Qdrant search and return mapped results in REAL_MODE', async () => {
      process.env.MOCK_MODE = 'false';
      const dummyEmbedding = Array.from({ length: 384 }, () => 0.1);
      const mockQdrantResults = [
        { id: 'q-id-1', score: 0.9, payload: { name: 'Qdrant Result 1', type: 'Character' } },
        { id: 'q-id-2', score: 0.85, payload: { name: 'Qdrant Result 2', type: 'Location' } },
      ];
      mockQdrantSearch.mockResolvedValue(mockQdrantResults);

      const results = await search_storytellers_by_fragment(dummyEmbedding, ['tag1'], 2);

      expect(mockQdrantSearch).toHaveBeenCalledWith(
        'storyteller_entities', // QDRANT_COLLECTION_NAME
        expect.objectContaining({
          vector: dummyEmbedding,
          limit: 2,
          with_payload: true,
          filter: {
            must: [{ key: 'universalTraits', match: { any: ['tag1'] } }]
          }
        })
      );
      expect(results).toEqual([
        { id: 'q-id-1', score: 0.9, name: 'Qdrant Result 1', type: 'Character' },
        { id: 'q-id-2', score: 0.85, name: 'Qdrant Result 2', type: 'Location' },
      ]);
      expect(mockNarrativeEntityFind).not.toHaveBeenCalled(); // Ensure MongoDB find is not called in real mode
    });

    test('should call Qdrant search without filter if no tags provided in REAL_MODE', async () => {
        process.env.MOCK_MODE = 'false';
        const dummyEmbedding = Array.from({ length: 384 }, () => 0.1);
        mockQdrantSearch.mockResolvedValue([]); // Return empty for simplicity

        await search_storytellers_by_fragment(dummyEmbedding, [], 3); // Empty tags array

        expect(mockQdrantSearch).toHaveBeenCalledWith(
          'storyteller_entities',
          expect.objectContaining({
            vector: dummyEmbedding,
            limit: 3,
            with_payload: true
            // No 'filter' property should be present or it should be undefined/empty
          })
        );
        // Check that filter is not set or is empty
        const callArgs = mockQdrantSearch.mock.calls[0][1];
        expect(callArgs.filter === undefined || callArgs.filter.must.length === 0).toBe(true);
      });

    test('should handle Qdrant search error gracefully in REAL_MODE', async () => {
      process.env.MOCK_MODE = 'false';
      mockQdrantSearch.mockRejectedValue(new Error('Qdrant unavailable'));
      const dummyEmbedding = Array.from({ length: 384 }, () => 0.1);
      const results = await search_storytellers_by_fragment(dummyEmbedding, [], 5);
      expect(results).toEqual([]);
    });
  });
});

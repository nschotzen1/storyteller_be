import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Assuming server.js exports the app instance correctly
// and handles its Mongoose connection in a way that can be overridden or managed by tests.
import { app } from './server.js'; 
import { GeneratedContent } from './storyteller/utils.js'; // Adjust path as necessary
import { SessionVector } from './models/models.js'; // Added for SessionVector tests

// Mock the promptsUtils module
// Import functions to be mocked
import {
  directExternalApiCall,
  getWorldbuildingVector,
  generateFragmentsBeginnings
} from './ai/openai/promptsUtils.js';

jest.mock('./ai/openai/promptsUtils.js', () => {
  const originalModule = jest.requireActual('./ai/openai/promptsUtils.js');
  return {
    ...originalModule,
    directExternalApiCall: jest.fn(),
    getWorldbuildingVector: jest.fn(), // Added mock for getWorldbuildingVector
    generateFragmentsBeginnings: jest.fn((contextText, count) => {
        return [{ role: "system", content: `Mocked AI prompt for: ${contextText} (requesting ${count} prefixes)` }];
    }),
  };
});

let mongoServer;
let originalPrefixMockMode;
let originalTypewriterMockMode; // Added for TYPEWRITER_MOCK_MODE
let consoleErrorSpy;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  originalPrefixMockMode = process.env.PREFIX_MOCK_MODE;
  originalTypewriterMockMode = process.env.TYPEWRITER_MOCK_MODE; // Store original TYPEWRITER_MOCK_MODE

  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();

  consoleErrorSpy.mockRestore(); // Restore console.error

  // Restore original environment variables
  if (originalPrefixMockMode === undefined) {
    delete process.env.PREFIX_MOCK_MODE;
  } else {
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode;
  }
  if (originalTypewriterMockMode === undefined) {
    delete process.env.TYPEWRITER_MOCK_MODE;
  } else {
    process.env.TYPEWRITER_MOCK_MODE = originalTypewriterMockMode;
  }
});

afterEach(async () => {
  await GeneratedContent.deleteMany({});
  await SessionVector.deleteMany({}); // Clear SessionVector data

  // Clear all mock implementations and call history
  jest.clearAllMocks();

  // Reset environment variables modified by tests (if any were set directly in tests beyond initial state)
  // This is more robustly handled by restoring original values captured in beforeAll
  if (originalPrefixMockMode === undefined) delete process.env.PREFIX_MOCK_MODE;
  else process.env.PREFIX_MOCK_MODE = originalPrefixMockMode;

  if (originalTypewriterMockMode === undefined) delete process.env.TYPEWRITER_MOCK_MODE;
  else process.env.TYPEWRITER_MOCK_MODE = originalTypewriterMockMode;
});

describe('POST /api/prefixes', () => {
  const mockPrefixesList = [
    {"fontName":"Tangerine", "prefix": "it wasn't unusual for them to see wolf tracks so close to the farm, but this one was different, its grand size imprinting a distinct story on the soft soil", "fontSize":"34px"},
    {"fontName":"Tangerine", "prefix": "It was almost dark as they finally reached", "fontSize": "34px"},
    {"fontName":"Tangerine", "prefix": "she grasped her amulet strongly, as the horses started galloping", "fontSize": "34px"},
    {"fontName":"Tangerine", "prefix": "Run! Now! and don't look back until you reach the river", "fontSize": "34px"},
    {"fontName":"Tangerine", "prefix": "I admit it, seeing the dark woods for the first time was scary", "fontSize": "34px"}
  ];

  it('should return mock prefixes when useMock is true in request body', async () => {
    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-mock-body', contextText: 'test context', useMock: true });
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockPrefixesList);

    const dbEntry = await GeneratedContent.findOne({ sessionId: 'session-mock-body' });
    expect(dbEntry).toBeDefined();
    expect(dbEntry.contentType).toBe('dynamicPrefixList_mock');
    expect(dbEntry.contentData).toEqual(mockPrefixesList);
  });

  it('should return mock prefixes when PREFIX_MOCK_MODE environment variable is true', async () => {
    process.env.PREFIX_MOCK_MODE = 'true';
    
    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-mock-env', contextText: 'another test context' });
      
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockPrefixesList);

    const dbEntry = await GeneratedContent.findOne({ sessionId: 'session-mock-env' });
    expect(dbEntry).toBeDefined();
    expect(dbEntry.contentType).toBe('dynamicPrefixList_mock');
    expect(dbEntry.contentData).toEqual(mockPrefixesList);
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode; // Reset for other tests
  });

  it('should call AI, return its response, and save to DB in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false'; // Ensure env var is not forcing mock
    
    const fakeAiPrefixes = [{ prefix: "AI generated prefix 1 from test", fontName: "TestFont", fontSize: "16px" }];
    directExternalApiCall.mockResolvedValueOnce(fakeAiPrefixes); // Mock for this specific call

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-non-mock', contextText: 'tell me a real story' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(fakeAiPrefixes);
    expect(directExternalApiCall).toHaveBeenCalledTimes(1);

    const dbEntry = await GeneratedContent.findOne({ sessionId: 'session-non-mock' });
    expect(dbEntry).toBeDefined();
    expect(dbEntry.contentType).toBe('dynamicPrefixList');
    expect(dbEntry.contentData).toEqual(fakeAiPrefixes);
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode; // Reset
  });

  // ... other /api/prefixes tests from original file ...
  it('should return 400 if sessionId is missing', async () => {
    const response = await request(app)
      .post('/api/prefixes')
      .send({ contextText: 'some context' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Session ID is required.');
  });

  it('should return 400 if contextText is missing in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false'; // Ensure non-mock mode
    
    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-no-context' });
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('contextText is required for non-mock mode.');
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode; // Reset
  });

  it('should handle AI error gracefully in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false';
    directExternalApiCall.mockRejectedValueOnce(new Error("AI API is down"));

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-ai-error', contextText: 'trigger ai error' });
    
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Server error during prefix generation.');
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode; // Reset
  });

   it('should handle AI returning non-array data in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false';
    directExternalApiCall.mockResolvedValueOnce({ message: "This is not an array" });

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-ai-bad-data', contextText: 'trigger bad ai data' });
    
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Error processing AI response for prefixes.");
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode; // Reset
  });
});


describe('POST /api/send_typewriter_text', () => {
  const mockTypewriterAIResponse = {
    writing_sequence: [{ action: "type", text: "Mock typewriter response.", style: { fontName: "Arial", fontSize: "1rem", fontColor: "black"}, delay: 0 }],
    fade_sequence: [{ action: "fade", to_text: "", style: { fontName: "Arial", fontSize: "1rem", fontColor: "black"}, delay: 0, phase: 1 }],
    metadata: { font: "Arial", font_size: "1rem", font_color: "black" }
  };

  const sampleVectorData = {
    magic_prevalence: "common",
    technology_level: "sci-fi",
    gothic_motifs: ["madness"]
  };

  const predefinedMockVectorFromImplementation = { // As defined in getWorldbuildingVector's mock path
      magic_prevalence: "rare",
      magic_system: "ritualistic",
      magic_source: "learned",
      magic_cultural_role: "feared",
      supernatural_manifestation: "subtle",
      supernatural_agency: "ambiguous",
      supernatural_integration: "peripheral",
      apocalyptic_temporal_focus: "post-apocalypse",
      apocalyptic_scope: "regional",
      apocalyptic_cause: "unknown",
      apocalyptic_tone: "grim",
      gothic_setting: "ruins",
      gothic_tone: "melancholic",
      gothic_motifs: ["decay", "haunting"],
      gothic_role_of_past: "haunting",
      technology_level: "medieval",
      technology_integration: "background",
      urbanization_settlement_type: "village",
      urbanization_density: "sparse",
      religiosity_dominant_belief: "polytheistic",
      religiosity_power: "influential",
      scale_physical: "local",
      scale_temporal: "generation",
      social_structure_system: "feudal",
      social_structure_mobility: "rigid",
      genre_tropes_style: "grimdark"
  };


  let saveSpy;

  beforeEach(() => {
    // Mock the primary AI call for typewriter response
    directExternalApiCall.mockResolvedValue(mockTypewriterAIResponse);
    // Spy on SessionVector.prototype.save
    saveSpy = jest.spyOn(SessionVector.prototype, 'save').mockResolvedValue(undefined);
  });

  afterEach(() => {
    saveSpy.mockRestore();
    // TYPEWRITER_MOCK_MODE is restored in the global afterEach
  });

  test('Successful vector generation and saving (TYPEWRITER_MOCK_MODE = false)', async () => {
    process.env.TYPEWRITER_MOCK_MODE = 'false';
    getWorldbuildingVector.mockResolvedValueOnce(sampleVectorData);

    const sessionId = 'session-vector-success';
    const message = 'Test message for vector generation.';

    const response = await request(app)
      .post('/api/send_typewriter_text')
      .send({ sessionId, message });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('writing_sequence'); // Basic check for typewriter response
    expect(response.body).toHaveProperty('metadata');

    expect(getWorldbuildingVector).toHaveBeenCalledWith(message, false); // TYPEWRITER_MOCK_MODE is false
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Check data passed to save
    const savedData = saveSpy.mock.calls[0][0]; // this refers to the instance
    // More accurately, SessionVector constructor would be called with this data
    // For a spy on `save`, `this` context of save is the document.
    // Let's check what was passed to SessionVector constructor or what the instance contains.
    // This requires a bit more setup or checking the DB directly.
    // For now, checking that save was called is a good step.
    // To check the data, we'd ideally check the DB:
    const dbVector = await SessionVector.findOne({ session_id: sessionId });
    expect(dbVector).toBeDefined();
    expect(dbVector.magic_prevalence).toBe(sampleVectorData.magic_prevalence);
    expect(dbVector.technology_level).toBe(sampleVectorData.technology_level);
    expect(dbVector.gothic_motifs).toEqual(sampleVectorData.gothic_motifs);
  });

  test('Vector generation uses internal mock when TYPEWRITER_MOCK_MODE = true', async () => {
    process.env.TYPEWRITER_MOCK_MODE = 'true';
    // getWorldbuildingVector is NOT mocked here, we want its actual implementation to run with mock=true
    // We rely on the fact that directExternalApiCall *within* getWorldbuildingVector is already mocked by the top-level mock if it were to be called.

    const sessionId = 'session-vector-mock-mode';
    const message = 'Test message for mock vector.';

    // We need to unmock getWorldbuildingVector for this specific test if we want its true implementation to run
    // or ensure our top-level mock of getWorldbuildingVector allows passthrough for this.
    // The current mock setup replaces getWorldbuildingVector with jest.fn().
    // To test its internal logic, we need to call the original one.
    const { getWorldbuildingVector: actualGetWorldbuildingVector } = jest.requireActual('./ai/openai/promptsUtils.js');
    getWorldbuildingVector.mockImplementation(actualGetWorldbuildingVector);


    const response = await request(app)
      .post('/api/send_typewriter_text')
      .send({ sessionId, message });

    expect(response.status).toBe(200);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    const dbVector = await SessionVector.findOne({ session_id: sessionId });
    expect(dbVector).toBeDefined();
    // Compare against the predefined mock vector from getWorldbuildingVector's implementation
    expect(dbVector.magic_prevalence).toBe(predefinedMockVectorFromImplementation.magic_prevalence);
    expect(dbVector.technology_level).toBe(predefinedMockVectorFromImplementation.technology_level);
    expect(dbVector.gothic_motifs).toEqual(predefinedMockVectorFromImplementation.gothic_motifs);

    // Restore general mock for getWorldbuildingVector if other tests expect it to be jest.fn()
    getWorldbuildingVector.mockImplementation(jest.fn());
  });

  test('Error in vector generation does not break main response', async () => {
    process.env.TYPEWRITER_MOCK_MODE = 'false';
    const vectorError = new Error('Vector Generation Failed');
    getWorldbuildingVector.mockRejectedValueOnce(vectorError);

    const sessionId = 'session-vector-error';
    const message = 'Test message for vector error.';

    const response = await request(app)
      .post('/api/send_typewriter_text')
      .send({ sessionId, message });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('writing_sequence'); // Main response still okay

    expect(getWorldbuildingVector).toHaveBeenCalledWith(message, false);
    expect(console.error).toHaveBeenCalledWith(`Error generating or saving worldbuilding vector for session ${sessionId}:`, vectorError);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});

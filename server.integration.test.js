import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Assuming server.js exports the app instance correctly
// and handles its Mongoose connection in a way that can be overridden or managed by tests.
// We will need to ensure server.js is modified if it immediately connects Mongoose on import
// or starts the server unconditionally.
import { app } from './server.js'; 
import { GeneratedContent } from './storyteller/utils.js'; // Adjust path as necessary
import { directExternalApiCall } from './ai/openai/promptsUtils.js'; // For mocking

// Mock the promptsUtils module
jest.mock('./ai/openai/promptsUtils.js', () => {
  const originalModule = jest.requireActual('./ai/openai/promptsUtils.js');
  return {
    ...originalModule,
    directExternalApiCall: jest.fn(),
    // Mock generateFragmentsBeginnings as it's called by the route and would otherwise run
    generateFragmentsBeginnings: jest.fn((contextText, count) => {
        // Return a structure that directExternalApiCall mock can then use
        // This mock can be simple, as directExternalApiCall is the one we control for output
        return [{ role: "system", content: `Mocked AI prompt for: ${contextText} (requesting ${count} prefixes)` }];
    }),
  };
});

let mongoServer;
let originalPrefixMockMode;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Ensure mongoose connects to the in-memory server for tests
  // This might require server.js to not auto-connect or to allow overriding the URI
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  originalPrefixMockMode = process.env.PREFIX_MOCK_MODE;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  // If app from server.js starts a listener, it should be closed here.
  // e.g. if (app && app.close) { await new Promise(resolve => app.close(resolve)); }
  // For now, assuming server.js doesn't auto-listen or manages it for tests.
});

afterEach(async () => {
  await GeneratedContent.deleteMany({});
  directExternalApiCall.mockClear();
  if (originalPrefixMockMode === undefined) {
    delete process.env.PREFIX_MOCK_MODE;
  } else {
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode;
  }
  jest.clearAllMocks(); // Clears all mocks, including generateFragmentsBeginnings
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
  });

  it('should call AI, return its response, and save to DB in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false'; // Ensure env var is not forcing mock
    
    const fakeAiPrefixes = [{ prefix: "AI generated prefix 1 from test", fontName: "TestFont", fontSize: "16px" }];
    directExternalApiCall.mockResolvedValueOnce(fakeAiPrefixes);

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-non-mock', contextText: 'tell me a real story' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(fakeAiPrefixes);
    expect(directExternalApiCall).toHaveBeenCalledTimes(1);
    // You could also check the arguments of generateFragmentsBeginnings if needed
    // expect(generateFragmentsBeginnings).toHaveBeenCalledWith('tell me a real story', 5);


    const dbEntry = await GeneratedContent.findOne({ sessionId: 'session-non-mock' });
    expect(dbEntry).toBeDefined();
    expect(dbEntry.contentType).toBe('dynamicPrefixList');
    expect(dbEntry.contentData).toEqual(fakeAiPrefixes);
  });

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
  });

  it('should handle AI error gracefully in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false';
    directExternalApiCall.mockRejectedValueOnce(new Error("AI API is down"));

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-ai-error', contextText: 'trigger ai error' });
    
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Server error during prefix generation.');
  });

   it('should handle AI returning non-array data in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false';
    directExternalApiCall.mockResolvedValueOnce({ message: "This is not an array" }); // Mocking non-array response

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-ai-bad-data', contextText: 'trigger bad ai data' });
    
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Error processing AI response for prefixes.");
  });

});

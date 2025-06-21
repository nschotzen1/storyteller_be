// Mock promptsUtils at the VERY top, before any imports
jest.mock('./ai/openai/promptsUtils.js', () => ({
  directExternalApiCall: jest.fn(),
  generateFragmentsBeginnings: jest.fn(),
  // Add any other functions from promptsUtils that might be called by server.js,
  // even if not directly by the /api/prefixes route, to avoid "is not a function" errors.
}));

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest, describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';

// Assuming server.js exports the app instance correctly
// and handles its Mongoose connection in a way that can be overridden or managed by tests.
// We will need to ensure server.js is modified if it immediately connects Mongoose on import
// or starts the server unconditionally.
import { app } from './server.js'; 
import { GeneratedContent } from './storyteller/utils.js'; // Adjust path as necessary

let mongoServer;
let originalPrefixMockMode;

// Spies for the promptsUtils functions - no longer needed with jest.mock
// let directExternalApiCallSpy;
// let generateFragmentsBeginningsSpy;

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
  // No need to mockClear directExternalApiCall if it's auto-mocked by jest.mock
  if (originalPrefixMockMode === undefined) {
    delete process.env.PREFIX_MOCK_MODE;
  } else {
    process.env.PREFIX_MOCK_MODE = originalPrefixMockMode;
  }
  // jest.restoreAllMocks(); // Not needed if not using jest.spyOn
  // jest.clearAllMocks(); // Clears all auto-mocks from jest.mock
  // To be safe and ensure mocks are reset for each test if they are modified:
  const { directExternalApiCall, generateFragmentsBeginnings } = await import('./ai/openai/promptsUtils.js');
  directExternalApiCall.mockClear();
  generateFragmentsBeginnings.mockClear();
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

    // Get the auto-mocked functions
    const { directExternalApiCall, generateFragmentsBeginnings } = await import('./ai/openai/promptsUtils.js');

    // Configure the mock for directExternalApiCall for this specific test
    // Note: generateFragmentsBeginnings in server.js will call this mocked directExternalApiCall
    directExternalApiCall.mockResolvedValueOnce(fakeAiPrefixes);

    // Since generateFragmentsBeginnings is also auto-mocked, if server.js calls it
    // and then that mock calls directExternalApiCall, we need to ensure the mock chain.
    // However, the route calls generateFragmentsBeginnings, which THEN calls directExternalApiCall.
    // So we only need to mock the ultimate directExternalApiCall.
    // The auto-mocked generateFragmentsBeginnings will use the actual implementation
    // unless we provide a .mockImplementationOnce() for it too.
    // For this test, we let the actual generateFragmentsBeginnings run, which will then hit our mocked directExternalApiCall.


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
    const { directExternalApiCall } = await import('./ai/openai/promptsUtils.js');
    directExternalApiCall.mockRejectedValueOnce(new Error("AI API is down"));

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-ai-error', contextText: 'trigger ai error' });
    
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Server error during prefix generation.');
  });

   it('should handle AI returning non-array data in non-mock mode', async () => {
    process.env.PREFIX_MOCK_MODE = 'false';
    const { directExternalApiCall } = await import('./ai/openai/promptsUtils.js');
    directExternalApiCall.mockResolvedValueOnce({ message: "This is not an array" });

    const response = await request(app)
      .post('/api/prefixes')
      .send({ sessionId: 'session-ai-bad-data', contextText: 'trigger bad ai data' });
    
    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Error processing AI response for prefixes.");
  });

});

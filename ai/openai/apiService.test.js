import { jest } from '@jest/globals';

const mockChatCompletionCreate = jest.fn();
const mockResponsesCreate = jest.fn();
const mockAnthropicMessageCreate = jest.fn();

jest.unstable_mockModule('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockChatCompletionCreate
      }
    },
    responses: {
      create: mockResponsesCreate
    },
    models: {
      list: jest.fn()
    }
  }))
}));

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicMessageCreate
    },
    models: {
      list: jest.fn()
    }
  }))
}));

const {
  directExternalApiCall,
  resolveDirectExternalApiRouteError
} = await import('./apiService.js');

describe('directExternalApiCall error propagation', () => {
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    mockChatCompletionCreate.mockReset();
    mockResponsesCreate.mockReset();
    mockAnthropicMessageCreate.mockReset();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    delete process.env.OPENAI_API_KEY;
  });

  it('throws a structured invalid-json error after retries and exposes it for routes', async () => {
    mockChatCompletionCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'not valid json'
          }
        }
      ]
    });

    let thrownError;
    try {
      await directExternalApiCall(
        [{ role: 'user', content: 'Return JSON.' }],
        { isOpenAi: true, model: 'gpt-4.1-mini' }
      );
    } catch (error) {
      thrownError = error;
    }

    expect(mockChatCompletionCreate).toHaveBeenCalledTimes(3);
    expect(thrownError).toMatchObject({
      code: 'LLM_INVALID_JSON_RESPONSE',
      statusCode: 502
    });
    expect(thrownError.message).toMatch(/OpenAI returned invalid JSON after 3 attempts/);
    expect(thrownError.message).toMatch(/Response preview: not valid json/);
    expect(resolveDirectExternalApiRouteError(thrownError, 'fallback')).toEqual({
      statusCode: 502,
      message: thrownError.message
    });
  });

  it('throws a structured upstream failure and preserves the provider error message', async () => {
    mockChatCompletionCreate.mockRejectedValue(new Error('AI API is down'));

    let thrownError;
    try {
      await directExternalApiCall(
        [{ role: 'user', content: 'Return JSON.' }],
        { isOpenAi: true, model: 'gpt-4.1-mini' }
      );
    } catch (error) {
      thrownError = error;
    }

    expect(mockChatCompletionCreate).toHaveBeenCalledTimes(3);
    expect(thrownError).toMatchObject({
      code: 'LLM_API_REQUEST_ERROR',
      statusCode: 502
    });
    expect(thrownError.message).toMatch(/AI API is down/);
    expect(resolveDirectExternalApiRouteError(thrownError, 'fallback')).toEqual({
      statusCode: 502,
      message: thrownError.message
    });
  });

  it('keeps the fallback message for non-LLM errors', () => {
    expect(resolveDirectExternalApiRouteError(new Error('plain failure'), 'fallback message')).toEqual({
      statusCode: 500,
      message: 'fallback message'
    });
  });
});

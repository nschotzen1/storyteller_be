import fs from 'fs';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals';

const mockGenerate = jest.fn();

jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  directExternalApiCall: jest.fn(),
  getOpenaiClient: () => ({
    images: {
      generate: mockGenerate
    }
  })
}));

jest.unstable_mockModule('./ai/openai/texturePrompts.js', () => ({
  generate_texture_by_fragment_and_conversation: jest.fn()
}));

jest.unstable_mockModule('./ai/openai/entityPrompts.js', () => ({
  developEntityprompt: jest.fn()
}));

jest.unstable_mockModule('./storyteller/utils.js', () => ({
  saveTextures: jest.fn(),
  getFragment: jest.fn(),
  getSessionChat: jest.fn(),
  setTexture: jest.fn(),
  generateEntitiesFromFragment: jest.fn(),
  getEntitiesForSession: jest.fn(),
  setEntitiesForSession: jest.fn(),
  ensureDirectoryExists: jest.fn(async () => {})
}));

const { textToImageOpenAi } = await import('./ai/textToImage/api.js');

function makeTempPath(filename = 'image.png') {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'text-to-image-'));
  return path.join(tempDir, filename);
}

describe('textToImageOpenAi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('omits response_format for gpt-image-1 and writes base64 output', async () => {
    const localPath = makeTempPath();
    mockGenerate.mockResolvedValue({
      data: [
        {
          b64_json: Buffer.from('gpt-image-binary').toString('base64'),
          revised_prompt: 'revised prompt'
        }
      ]
    });

    const result = await textToImageOpenAi('draw a lighthouse', 1, localPath, false, 1, 'gpt-image-1');

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(mockGenerate).toHaveBeenCalledWith({
      model: 'gpt-image-1',
      prompt: 'draw a lighthouse',
      n: 1,
      size: '1024x1024'
    });
    expect(fs.readFileSync(localPath, 'utf8')).toBe('gpt-image-binary');
    expect(result).toEqual({
      revised_prompt: 'revised prompt',
      url: null,
      localPath
    });
  });

  it('keeps response_format for dall-e models', async () => {
    const localPath = makeTempPath();
    mockGenerate.mockResolvedValue({
      data: [
        {
          b64_json: Buffer.from('dalle-binary').toString('base64'),
          url: 'https://example.invalid/image.png'
        }
      ]
    });

    await textToImageOpenAi('draw a mountain', 1, localPath, false, 1, 'dall-e-3');

    expect(mockGenerate).toHaveBeenCalledWith({
      model: 'dall-e-3',
      prompt: 'draw a mountain',
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json'
    });
    expect(fs.readFileSync(localPath, 'utf8')).toBe('dalle-binary');
  });
});

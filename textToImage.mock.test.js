import { textToImageOpenAi } from './ai/textToImage/api.js';

describe('textToImageOpenAi mock mode', () => {
  it('returns a schema-compatible mock payload when shouldMock=true', async () => {
    const localPath = '/tmp/mock-output.png';
    const result = await textToImageOpenAi('a test prompt', 1, localPath, true);

    expect(result).toEqual(
      expect.objectContaining({
        localPath,
        url: expect.any(String),
        revised_prompt: expect.any(String)
      })
    );
  });
});

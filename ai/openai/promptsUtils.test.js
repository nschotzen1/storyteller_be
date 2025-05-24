import { generateMasterStorytellerChat } from './promptsUtils.js';

describe('generateMasterStorytellerChat', () => {
  it('should return a correctly structured prompt object for a given paragraph', () => {
    const paragraph = "The old house stood on a hill overlooking the town. It had been empty for years, and locals said it was haunted.";
    const result = generateMasterStorytellerChat(paragraph);

    // Assert that the returned value is an array
    expect(Array.isArray(result)).toBe(true);

    // Assert that the array has one element
    expect(result.length).toBe(1);

    const messageObject = result[0];
    // Assert that the element is an object with role: 'system'
    expect(messageObject).toHaveProperty('role', 'system');

    // Assert that the element has a content property that is a non-empty string
    expect(messageObject).toHaveProperty('content');
    expect(typeof messageObject.content).toBe('string');
    expect(messageObject.content.length).toBeGreaterThan(0);

    // Assert that the content string includes the input paragraph
    // The prompt template wraps the paragraph in quotes and specific text
    expect(messageObject.content).toContain(`"${paragraph}"`);
  });

  it('should correctly structure the prompt when given an empty paragraph string', () => {
    const paragraph = "";
    const result = generateMasterStorytellerChat(paragraph);

    // Assert that the returned value is an array
    expect(Array.isArray(result)).toBe(true);

    // Assert that the array has one element
    expect(result.length).toBe(1);

    const messageObject = result[0];
    // Assert that the element is an object with role: 'system'
    expect(messageObject).toHaveProperty('role', 'system');

    // Assert that the element has a content property that is a non-empty string
    expect(messageObject).toHaveProperty('content');
    expect(typeof messageObject.content).toBe('string');
    expect(messageObject.content.length).toBeGreaterThan(0); // Content is the template itself

    // Assert that the content string includes the (empty) input paragraph placeholder
    expect(messageObject.content).toContain(`"${paragraph}"`); // Will look for `""`
  });

  it('should return a prompt that contains specific instruction phrases', () => {
    const paragraph = "A single raven landed on the twisted branch of a dead oak.";
    const result = generateMasterStorytellerChat(paragraph);
    const content = result[0].content;

    expect(content).toContain("You are a master storyteller detective.");
    expect(content).toContain("PARAGRAPH_START---");
    expect(content).toContain("---PARAGRAPH_END");
    expect(content).toContain("Remember it's a CHAT.");
  });
});

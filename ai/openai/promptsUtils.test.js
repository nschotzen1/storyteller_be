import { generateMasterStorytellerChat, generateTypewriterPrompt } from './promptsUtils.js';

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

describe('generateTypewriterPrompt', () => {
  const existing_text = "They slowly walked on ";
  let systemMessageContent;

  beforeAll(() => {
    const result = generateTypewriterPrompt(existing_text);
    // The prompt is an array of messages, system message is the first one.
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1); // Expecting at least system message
    expect(result[0]).toHaveProperty('role', 'system');
    expect(result[0]).toHaveProperty('content');
    systemMessageContent = result[0].content;
  });

  it('should include the word count constraint in the system message', () => {
    expect(systemMessageContent).toContain("The continuation's word count must be strictly close to $desired_length.");
  });

  it('should include the narrative style emphasis in the system message', () => {
    expect(systemMessageContent).toContain("The narrative style for the main continuation should be grounded, factual, and sensory, weaving the narrative closely with tangible details.");
  });

  it('should have updated pause durations in the example JSON within the system message', () => {
    // Check for the first updated pause
    expect(systemMessageContent).toMatch(/"action": "pause",\s*"delay": 600\s*},/);
    // Check for the second updated pause
    // This regex looks for "action": "pause", "delay": 500, followed by "action": "delete"
    // to ensure we're targeting the correct pause.
    expect(systemMessageContent).toMatch(/"action": "pause",\s*"delay": 500\s*},\s*{\s*"action": "delete",/);
  });

  it('should correctly structure the prompt with existing_text and default parameters', () => {
    const result = generateTypewriterPrompt(existing_text);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2); // System message and user message with parameters

    const userMessage = result[1];
    expect(userMessage).toHaveProperty('role', 'user');
    expect(userMessage).toHaveProperty('content');

    const userContent = JSON.parse(userMessage.content);
    expect(userContent).toHaveProperty('existing_text', existing_text);
    expect(userContent).toHaveProperty('desired_length'); // Check if property exists
    expect(userContent).toHaveProperty('number_of_fades', 4); // Default value
  });

  it('should handle null existing_text by setting wordCount to 0 for desired_length calculation', () => {
    const result = generateTypewriterPrompt(null);
    const userMessage = result[1];
    const userContent = JSON.parse(userMessage.content);
    // desired_length = parseInt(Math.max(3, 0 * 1.61)) = 3
    expect(userContent).toHaveProperty('desired_length', 3);
    expect(userContent).toHaveProperty('existing_text', null);
  });

  it('should handle empty string existing_text by setting wordCount to 0 for desired_length calculation', () => {
    const result = generateTypewriterPrompt("");
    const userMessage = result[1];
    const userContent = JSON.parse(userMessage.content);
    // desired_length = parseInt(Math.max(3, 0 * 1.61)) = 3
    expect(userContent).toHaveProperty('desired_length', 3);
    expect(userContent).toHaveProperty('existing_text', "");
  });
});

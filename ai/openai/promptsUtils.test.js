import {
  generateMasterStorytellerChat,
  generateWorldbuildingVectorPrompt,
  getWorldbuildingVector,
  // directExternalApiCall is implicitly available via the mock setup if we need to assert its calls.
  // We import it here if we need to directly manipulate its mock implementation (e.g., .mockResolvedValueOnce)
  directExternalApiCall
} from './promptsUtils.js';

// Mocking directExternalApiCall from the same module
// For functions in the same module, this is the standard way.
// We are mocking the module './promptsUtils' and then selectively mocking 'directExternalApiCall' within it.
jest.mock('./promptsUtils', () => {
  const originalModule = jest.requireActual('./promptsUtils');
  return {
    ...originalModule, // Exports actual implementations by default (like generateWorldbuildingVectorPrompt)
    directExternalApiCall: jest.fn(), // Mock this specific function
  };
});

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

describe('generateWorldbuildingVectorPrompt', () => {
  it('should generate a prompt containing key phrases and the narrative fragment', () => {
    const narrativeFragment = "The city floated among the clouds, powered by sunstones.";
    const prompt = generateWorldbuildingVectorPrompt(narrativeFragment);

    expect(prompt).toContain("Analyze the following narrative fragment and return a JSON object representing its worldbuilding \"vector.\"");
    expect(prompt).toContain("Return only the JSON object. Do not explain or summarize.");
    expect(prompt).toContain(narrativeFragment);

    // Check for some schema field names
    expect(prompt).toContain("magic_prevalence");
    expect(prompt).toContain("gothic_motifs");
    expect(prompt).toContain("technology_level");
    expect(prompt).toContain("social_structure_system");

    // Check for instructions specific to gothic_motifs
    expect(prompt).toContain("For 'gothic_motifs', return a list of up to 3 values from the options (or an empty list if none are suggested).");
    expect(prompt).toContain("If the fragment gives no hint for a property, choose 'none' (or an empty list for 'gothic_motifs').");
  });
});

describe('getWorldbuildingVector', () => {
  const sampleNarrativeFragment = "In a realm where magic was fading, a lone knight sought the last dragon.";
  const mockLLMResponse = {
    magic_prevalence: "rare",
    magic_system: "wild",
    gothic_motifs: ["haunting"],
    technology_level: "medieval",
  };

  // This is the expected structure for mock=true
  const predefinedMockVector = {
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

  beforeEach(() => {
    // Clear mock history before each test
    directExternalApiCall.mockClear();
  });

  it('should return a predefined mock JSON object when mock is true', async () => {
    const result = await getWorldbuildingVector(sampleNarrativeFragment, true);
    expect(result).toEqual(predefinedMockVector);
    // Ensure directExternalApiCall was not called in mock mode
    expect(directExternalApiCall).not.toHaveBeenCalled();
  });

  it('should call directExternalApiCall with correct parameters and return its response when mock is false', async () => {
    // Configure the mock for directExternalApiCall for this test
    directExternalApiCall.mockResolvedValueOnce(mockLLMResponse);

    const result = await getWorldbuildingVector(sampleNarrativeFragment, false);

    // 1. Check if generateWorldbuildingVectorPrompt was effectively used (by checking directExternalApiCall's first arg)
    // The actual generateWorldbuildingVectorPrompt function is called due to the mock setup.
    const expectedPrompt = generateWorldbuildingVectorPrompt(sampleNarrativeFragment);

    // 2. Assert that directExternalApiCall was called correctly
    expect(directExternalApiCall).toHaveBeenCalledTimes(1);
    expect(directExternalApiCall).toHaveBeenCalledWith(
      expectedPrompt, // The prompt generated by the real generateWorldbuildingVectorPrompt
      2500,           // max_tokens
      undefined,      // model
      undefined,      // temperature
      true,           // isOpenAi
      true            // explicitJsonObjectFormat
    );

    // 3. Assert that the function returns the (mocked) LLM response
    expect(result).toEqual(mockLLMResponse);
  });

  it('should handle errors from directExternalApiCall gracefully (if error handling were implemented inside getWorldbuildingVector)', async () => {
    const errorMessage = "API Error";
    directExternalApiCall.mockRejectedValueOnce(new Error(errorMessage));

    // Note: The current implementation of getWorldbuildingVector does not have a try-catch for directExternalApiCall.
    // If it did, we would test that it handles the error as expected (e.g., returns null, logs error).
    // For now, we just test that it propagates the error, which is the default behavior.
    await expect(getWorldbuildingVector(sampleNarrativeFragment, false)).rejects.toThrow(errorMessage);

    expect(directExternalApiCall).toHaveBeenCalledTimes(1);
  });
});

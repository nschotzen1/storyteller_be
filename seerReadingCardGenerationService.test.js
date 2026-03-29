import { jest } from '@jest/globals';

const mockCallJsonLlm = jest.fn();
const mockGetRouteConfig = jest.fn();
const mockValidatePayloadForRoute = jest.fn();
const mockGetPipelineSettings = jest.fn();
const mockGetLatestPromptTemplate = jest.fn();

await jest.unstable_mockModule('./ai/openai/apiService.js', () => ({
  callJsonLlm: mockCallJsonLlm
}));

await jest.unstable_mockModule('./services/llmRouteConfigService.js', () => ({
  getRouteConfig: mockGetRouteConfig,
  validatePayloadForRoute: mockValidatePayloadForRoute
}));

await jest.unstable_mockModule('./services/typewriterAiSettingsService.js', () => ({
  getPipelineSettings: mockGetPipelineSettings
}));

await jest.unstable_mockModule('./services/typewriterPromptConfigService.js', () => ({
  getLatestPromptTemplate: mockGetLatestPromptTemplate,
  renderPromptTemplateString: (template, variables = {}) =>
    `${template || ''}`.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, variableName) => {
      const value = variables[variableName];
      if (value === undefined || value === null) return '';
      return String(value);
    })
}));

const { generateSeerReadingCardDrafts } = await import('./services/seerReadingCardGenerationService.js');

describe('seerReadingCardGenerationService', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetPipelineSettings.mockResolvedValue({
      key: 'seer_reading_card_generation',
      provider: 'openai',
      model: 'gpt-5-mini',
      useMock: true,
      cardCount: 3
    });
    mockGetRouteConfig.mockResolvedValue({
      routePath: 'internal://seer-reading/cards/generate',
      promptTemplate: 'Generate {{card_count}} cards. Allowed {{allowed_card_kinds_json}}. Preferred {{preferred_card_kinds_json}}.'
    });
    mockGetLatestPromptTemplate.mockResolvedValue({
      version: 1,
      promptTemplate: 'Generate {{card_count}} cards. Allowed {{allowed_card_kinds_json}}. Preferred {{preferred_card_kinds_json}}.',
      meta: { source: 'test-seed' }
    });
    mockValidatePayloadForRoute.mockResolvedValue({ valid: true });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  test('returns deterministic drafts in mock mode while preserving requested kinds', async () => {
    const result = await generateSeerReadingCardDrafts({
      fragmentText: 'A runner keeps checking a hidden pouch.',
      visionMemory: {
        whose_eyes: 'Nera',
        location: 'the green ruin',
        action_name: 'Run with the kept thing',
        emotional_sentiment: 'fear, urgency'
      },
      cardCount: 4,
      cardKinds: ['character', 'location', 'event', 'authority'],
      forceMock: true
    });

    expect(result.mocked).toBe(true);
    expect(result.generationMode).toBe('mock_pipeline');
    expect(result.cards).toHaveLength(4);
    expect(result.cards.map((card) => card.kind)).toEqual(['character', 'location', 'event', 'authority']);
    expect(result.promptText).toContain('Generate 4 cards.');
    expect(mockCallJsonLlm).not.toHaveBeenCalled();
  });

  test('uses the configured llm path and validates the response schema', async () => {
    mockGetPipelineSettings.mockResolvedValue({
      key: 'seer_reading_card_generation',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      useMock: false,
      cardCount: 3
    });
    mockCallJsonLlm.mockResolvedValue({
      vision_summary: 'A woman runs through a reclaimed court, checking a pouch against her ribs.',
      cards: [
        {
          kind: 'character',
          label: 'The Runner',
          summary: 'She runs with practiced fear.',
          back_moods: ['fear'],
          back_motifs: ['mud', 'breath']
        },
        {
          kind: 'location',
          label: 'The Green Court',
          summary: 'A place overgrown after glory.',
          back_moods: ['decay'],
          back_motifs: ['stone', 'ivy']
        }
      ]
    });

    const result = await generateSeerReadingCardDrafts({
      fragmentText: 'A runner keeps checking a hidden pouch.',
      visionMemory: { location: 'the green ruin' },
      cardCount: 2,
      cardKinds: ['character', 'location'],
      forceMock: false
    });

    expect(mockCallJsonLlm).toHaveBeenCalledTimes(1);
    expect(mockValidatePayloadForRoute).toHaveBeenCalledWith(
      'seer_reading_card_generation',
      expect.objectContaining({ vision_summary: expect.any(String), cards: expect.any(Array) })
    );
    expect(result.mocked).toBe(false);
    expect(result.generationMode).toBe('llm_runtime');
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0]).toEqual(expect.objectContaining({ kind: 'character', label: 'The Runner' }));
    expect(result.cards[1]).toEqual(expect.objectContaining({ kind: 'location', label: 'The Green Court' }));
  });

  test('falls back to deterministic drafts when llm generation fails', async () => {
    mockGetPipelineSettings.mockResolvedValue({
      key: 'seer_reading_card_generation',
      provider: 'openai',
      model: 'gpt-5.4-mini',
      useMock: false,
      cardCount: 3
    });
    mockCallJsonLlm.mockRejectedValue(new Error('upstream exploded'));

    const result = await generateSeerReadingCardDrafts({
      fragmentText: 'A runner keeps checking a hidden pouch.',
      visionMemory: {
        whose_eyes: 'Nera',
        location: 'the green ruin',
        action_name: 'Run with the kept thing'
      },
      cardCount: 3,
      cardKinds: ['character', 'location', 'event'],
      forceMock: false
    });

    expect(result.mocked).toBe(false);
    expect(result.usedFallback).toBe(true);
    expect(result.generationMode).toBe('deterministic_fallback');
    expect(result.errorMessage).toContain('upstream exploded');
    expect(result.cards).toHaveLength(3);
    expect(result.cards.map((card) => card.kind)).toEqual(['character', 'location', 'event']);
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});

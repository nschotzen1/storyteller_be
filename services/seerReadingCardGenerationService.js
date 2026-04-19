import { callJsonLlm } from '../ai/openai/apiService.js';
import { getRouteConfig, validatePayloadForRoute } from './llmRouteConfigService.js';
import { getPipelineSettings } from './typewriterAiSettingsService.js';
import { getLatestPromptTemplate, renderPromptTemplateString } from './typewriterPromptConfigService.js';

function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeStringArray(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(values.map((entry) => `${entry || ''}`.trim().toLowerCase()).filter(Boolean))];
}

function normalizeCardCount(value, fallback = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(1, Math.min(10, Number(fallback) || 3));
  }
  return Math.max(1, Math.min(10, Math.floor(numeric)));
}

function buildPromptPayload({
  fragmentText = '',
  visionMemory = {},
  knownEntities = [],
  cardCount = 3,
  allowedCardKinds = [],
  preferredCardKinds = []
}) {
  return {
    fragment_text: firstDefinedString(fragmentText),
    vision_memory_json: JSON.stringify(visionMemory || {}, null, 2),
    known_entities_json: JSON.stringify(Array.isArray(knownEntities) ? knownEntities.slice(0, 12) : [], null, 2),
    card_count: normalizeCardCount(cardCount, 3),
    allowed_card_kinds_json: JSON.stringify(normalizeStringArray(allowedCardKinds)),
    preferred_card_kinds_json: JSON.stringify(normalizeStringArray(preferredCardKinds))
  };
}

function humanizeKind(kind = '') {
  return firstDefinedString(kind)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Thread';
}

function buildMockVisionSummary(visionMemory = {}, fragmentText = '') {
  return firstDefinedString(
    visionMemory?.miseenscene,
    visionMemory?.dramatic_definition,
    visionMemory?.what_is_being_watched,
    fragmentText,
    'The vision arrives in fragments before it yields its shape.'
  );
}

function buildMockCardDraft(kind = '', visionMemory = {}, index = 0) {
  const safeKind = firstDefinedString(kind, `thread-${index + 1}`);
  const humanizedKind = humanizeKind(safeKind);
  const moods = firstDefinedString(visionMemory?.emotional_sentiment)
    .split(/,|;|\bturning to\b|\band\b|\//i)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 3);
  const motifs = [
    firstDefinedString(visionMemory?.related_through_what),
    firstDefinedString(visionMemory?.what_is_being_watched),
    firstDefinedString(visionMemory?.time_of_day),
    firstDefinedString(visionMemory?.location)
  ].filter(Boolean).slice(0, 4);
  return {
    kind: safeKind,
    label: firstDefinedString(
      safeKind === 'character' ? visionMemory?.whose_eyes : '',
      safeKind === 'location' ? visionMemory?.location : '',
      safeKind === 'event' ? visionMemory?.action_name : '',
      `${humanizedKind} ${index + 1}`
    ),
    summary: firstDefinedString(
      safeKind === 'location' ? visionMemory?.geographical_relevance : '',
      safeKind === 'event' ? visionMemory?.actual_result : '',
      safeKind === 'character' ? visionMemory?.dramatic_definition : '',
      visionMemory?.dramatic_definition,
      'An interpretive lens around the still-blurred vision.'
    ),
    back_genre_signal: firstDefinedString(visionMemory?.dramatic_definition, humanizedKind),
    back_moods: moods.length ? moods : ['unease'],
    back_motifs: motifs.length ? motifs : [humanizedKind],
    likely_relation_hint: firstDefinedString(
      visionMemory?.related_through_what,
      visionMemory?.dramatic_definition,
      'The seer senses this card tightening against the vision.'
    )
  };
}

function buildMockCardDrafts({ cardKinds = [], visionMemory = {}, cardCount = 3 }) {
  const safeCount = normalizeCardCount(cardCount, 3);
  const safeKinds = normalizeStringArray(cardKinds);
  return Array.from({ length: safeCount }).map((_, index) =>
    buildMockCardDraft(safeKinds[index] || `thread-${index + 1}`, visionMemory, index)
  );
}

function normalizeCardDraft(draft = {}, index = 0, fallbackKind = '') {
  const safeKind = firstDefinedString(draft.kind, fallbackKind, `thread-${index + 1}`).toLowerCase();
  return {
    kind: safeKind,
    label: firstDefinedString(draft.label, draft.title, humanizeKind(safeKind)),
    summary: firstDefinedString(draft.summary),
    back_genre_signal: firstDefinedString(draft.back_genre_signal),
    back_moods: normalizeStringArray(draft.back_moods),
    back_motifs: normalizeStringArray(draft.back_motifs),
    likely_relation_hint: firstDefinedString(draft.likely_relation_hint)
  };
}

export async function generateSeerReadingCardDrafts({
  fragmentText = '',
  visionMemory = {},
  knownEntities = [],
  cardCount = 3,
  cardKinds = [],
  preferredCardKinds = [],
  allowedCardKinds = [],
  forceMock = null
} = {}) {
  const pipeline = await getPipelineSettings('seer_reading_card_generation');
  const routeConfig = await getRouteConfig('seer_reading_card_generation');
  const promptDoc = await getLatestPromptTemplate('seer_reading_card_generation');
  const promptTemplate = firstDefinedString(
    promptDoc?.promptTemplate,
    routeConfig?.promptCore,
    routeConfig?.promptTemplate
  );
  const promptPayload = buildPromptPayload({
    fragmentText,
    visionMemory,
    knownEntities,
    cardCount,
    allowedCardKinds,
    preferredCardKinds
  });
  const promptText = renderPromptTemplateString(promptTemplate, promptPayload);
  const safeCount = normalizeCardCount(cardCount, pipeline?.cardCount || 3);
  const shouldMock = forceMock === null ? Boolean(pipeline?.useMock) : Boolean(forceMock);

  const baseRuntime = {
    pipelineKey: 'seer_reading_card_generation',
    provider: firstDefinedString(pipeline?.provider, 'openai'),
    model: firstDefinedString(pipeline?.model),
    useMock: shouldMock,
    promptVersion: Number.isFinite(Number(promptDoc?.version)) ? Number(promptDoc.version) : null,
    promptSource: firstDefinedString(promptDoc?.meta?.source, routeConfig?.routePath)
  };

  if (shouldMock) {
    return {
      visionSummary: buildMockVisionSummary(visionMemory, fragmentText),
      cards: buildMockCardDrafts({ cardKinds, visionMemory, cardCount: safeCount }),
      mocked: true,
      usedFallback: false,
      generationMode: 'mock_pipeline',
      promptText,
      runtime: baseRuntime,
      errorMessage: ''
    };
  }

  try {
    const rawResponse = await callJsonLlm({
      prompts: [{ role: 'system', content: promptText }],
      provider: baseRuntime.provider,
      model: baseRuntime.model,
      max_tokens: 1800,
      explicitJsonObjectFormat: true
    });

    await validatePayloadForRoute('seer_reading_card_generation', rawResponse);

    const normalizedCards = (Array.isArray(rawResponse?.cards) ? rawResponse.cards : [])
      .slice(0, safeCount)
      .map((card, index) => normalizeCardDraft(card, index, normalizeStringArray(cardKinds)[index] || ''))
      .filter((card) => firstDefinedString(card.kind, card.label));

    const fallbackCards = buildMockCardDrafts({ cardKinds, visionMemory, cardCount: safeCount });
    while (normalizedCards.length < safeCount) {
      normalizedCards.push(fallbackCards[normalizedCards.length]);
    }

    return {
      visionSummary: firstDefinedString(rawResponse?.vision_summary, buildMockVisionSummary(visionMemory, fragmentText)),
      cards: normalizedCards.slice(0, safeCount),
      mocked: false,
      usedFallback: normalizedCards.some((card, index) => card.kind === fallbackCards[index]?.kind && !firstDefinedString(rawResponse?.cards?.[index]?.kind)),
      generationMode: 'llm_runtime',
      promptText,
      runtime: baseRuntime,
      errorMessage: ''
    };
  } catch (error) {
    console.warn('Seer card generation fell back to deterministic drafts:', error?.message || error);
    return {
      visionSummary: buildMockVisionSummary(visionMemory, fragmentText),
      cards: buildMockCardDrafts({ cardKinds, visionMemory, cardCount: safeCount }),
      mocked: false,
      usedFallback: true,
      generationMode: 'deterministic_fallback',
      promptText,
      runtime: baseRuntime,
      errorMessage: error?.message || 'Card generation failed.'
    };
  }
}

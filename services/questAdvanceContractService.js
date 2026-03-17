import {
  normalizeImmersiveRpgStagePayload,
  toImmersiveRpgStageContractPayload
} from './immersiveRpgService.js';

function normalizeQuestText(value, maxLength = 96) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() : trimmed;
}

function firstNonEmptyQuestString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

export function normalizeQuestAdvancePlan(rawPlan = {}, fallbackPlan = {}) {
  const source = rawPlan && typeof rawPlan === 'object' ? rawPlan : {};
  const fallback = fallbackPlan && typeof fallbackPlan === 'object' ? fallbackPlan : {};
  const normalizedStage = normalizeImmersiveRpgStagePayload({
    stage_layout: source.stage_layout || source.stageLayout || fallback.stage_layout || fallback.stageLayout,
    stage_modules: source.stage_modules || source.stageModules || fallback.stage_modules || fallback.stageModules
  });

  return {
    title: normalizeQuestText(
      firstNonEmptyQuestString(source.title, fallback.title, 'New Thread'),
      56
    ),
    prompt: normalizeQuestText(
      firstNonEmptyQuestString(source.prompt, fallback.prompt, 'The area shifts around your action.'),
      900
    ),
    image_prompt: normalizeQuestText(
      firstNonEmptyQuestString(source.image_prompt, source.imagePrompt, fallback.image_prompt, fallback.imagePrompt),
      600
    ),
    text_prompt_placeholder: firstNonEmptyQuestString(
      source.text_prompt_placeholder,
      source.textPromptPlaceholder,
      fallback.text_prompt_placeholder,
      fallback.textPromptPlaceholder,
      'What do you do next in this thread?'
    ),
    expectation_summary: firstNonEmptyQuestString(
      source.expectation_summary,
      source.expectationSummary,
      fallback.expectation_summary,
      fallback.expectationSummary,
      'A local branch opens from the current area.'
    ),
    continuity_summary: firstNonEmptyQuestString(
      source.continuity_summary,
      source.continuitySummary,
      fallback.continuity_summary,
      fallback.continuitySummary,
      'This branch grows directly from the current scene.'
    ),
    direction_label: normalizeQuestText(
      firstNonEmptyQuestString(
        source.direction_label,
        source.directionLabel,
        fallback.direction_label,
        fallback.directionLabel,
        'Pursue this thread'
      ),
      56
    ),
    stageLayout: normalizedStage.stageLayout,
    stageModules: normalizedStage.stageModules
  };
}

export function coerceQuestAdvanceContractPayload(rawResponse = {}) {
  const source = rawResponse && typeof rawResponse === 'object' ? rawResponse : {};
  const normalizedStage = toImmersiveRpgStageContractPayload({
    stage_layout: source.stage_layout || source.stageLayout,
    stage_modules: source.stage_modules || source.stageModules
  });

  return {
    title: firstNonEmptyQuestString(source.title),
    prompt: firstNonEmptyQuestString(source.prompt),
    image_prompt: firstNonEmptyQuestString(source.image_prompt, source.imagePrompt),
    text_prompt_placeholder: firstNonEmptyQuestString(source.text_prompt_placeholder, source.textPromptPlaceholder),
    expectation_summary: firstNonEmptyQuestString(source.expectation_summary, source.expectationSummary),
    continuity_summary: firstNonEmptyQuestString(source.continuity_summary, source.continuitySummary),
    direction_label: firstNonEmptyQuestString(source.direction_label, source.directionLabel),
    stage_layout: normalizedStage.stage_layout,
    stage_modules: normalizedStage.stage_modules
  };
}

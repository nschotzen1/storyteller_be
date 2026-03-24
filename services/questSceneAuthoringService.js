import { renderPromptTemplateString } from './typewriterPromptConfigService.js';

export const QUEST_SCENE_AUTHORING_PIPELINE_KEY = 'quest_scene_authoring';
export const QUEST_SCENE_AUTHORING_MODES = ['scene', 'selected_screen', 'fill_missing'];
export const QUEST_VISUAL_TRANSITION_INTENTS = ['inherit', 'drift', 'break'];

const SCENE_FIELD_ALIASES = {
  scenename: 'sceneName',
  scene_name: 'sceneName',
  scenetemplate: 'sceneTemplate',
  scene_template: 'sceneTemplate',
  scenemode: 'sceneTemplate',
  scene_mode: 'sceneTemplate',
  scenecomponents: 'sceneComponents',
  scene_components: 'sceneComponents',
  attachedcomponents: 'sceneComponents',
  attached_components: 'sceneComponents',
  authoringbrief: 'authoringBrief',
  authoring_brief: 'authoringBrief',
  masterbrief: 'authoringBrief',
  master_brief: 'authoringBrief',
  phaseguidance: 'phaseGuidance',
  phase_guidance: 'phaseGuidance',
  gmsceneguide: 'phaseGuidance',
  gm_scene_guide: 'phaseGuidance',
  visualstyleguide: 'visualStyleGuide',
  visual_style_guide: 'visualStyleGuide',
  scenevisualguide: 'visualStyleGuide',
  scene_visual_guide: 'visualStyleGuide'
};

const SCREEN_FIELD_ALIASES = {
  title: 'title',
  prompt: 'prompt',
  promptguidance: 'promptGuidance',
  prompt_guidance: 'promptGuidance',
  sceneendcondition: 'sceneEndCondition',
  scene_end_condition: 'sceneEndCondition',
  imageprompt: 'image_prompt',
  image_prompt: 'image_prompt',
  referenceimageprompt: 'referenceImagePrompt',
  reference_image_prompt: 'referenceImagePrompt',
  visualcontinuityguidance: 'visualContinuityGuidance',
  visual_continuity_guidance: 'visualContinuityGuidance',
  visualtransitionintent: 'visualTransitionIntent',
  visual_transition_intent: 'visualTransitionIntent',
  textpromptplaceholder: 'textPromptPlaceholder',
  text_prompt_placeholder: 'textPromptPlaceholder'
};

const CHANGE_LABELS = {
  sceneName: 'Scene Name',
  sceneTemplate: 'Base Scene Template',
  sceneComponents: 'Attached Components',
  authoringBrief: 'Master Scene Brief',
  phaseGuidance: 'GM Scene Guide',
  visualStyleGuide: 'Scene Visual Guide',
  title: 'Screen Title',
  prompt: 'Screen Text',
  promptGuidance: 'Extra GM Guidance',
  sceneEndCondition: 'Screen End Condition',
  image_prompt: 'Generator Image Prompt',
  referenceImagePrompt: 'Reference Text-to-Image Prompt',
  visualContinuityGuidance: 'Visual Continuity Notes',
  visualTransitionIntent: 'Transition From Nearby Screens',
  textPromptPlaceholder: 'Text Input Placeholder'
};

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asTrimmedString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function truncateText(value, maxLength = 240) {
  const source = asTrimmedString(value);
  if (!source) return '';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeSceneField(fieldName = '') {
  return SCENE_FIELD_ALIASES[String(fieldName || '').trim().toLowerCase()] || '';
}

function normalizeScreenField(fieldName = '') {
  return SCREEN_FIELD_ALIASES[String(fieldName || '').trim().toLowerCase()] || '';
}

function normalizeVisualTransitionIntent(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return QUEST_VISUAL_TRANSITION_INTENTS.includes(normalized) ? normalized : 'inherit';
}

function normalizeSceneComponentId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 64);
}

function normalizeSceneComponentList(value = []) {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(entries.map((entry) => normalizeSceneComponentId(entry)).filter(Boolean))];
}

function ensureUniqueId(baseId = '', existingIds = new Set()) {
  const safeBase = slugify(baseId) || 'screen';
  if (!existingIds.has(safeBase)) {
    existingIds.add(safeBase);
    return safeBase;
  }

  let suffix = 2;
  let candidate = `${safeBase}_${suffix}`;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${safeBase}_${suffix}`;
  }
  existingIds.add(candidate);
  return candidate;
}

function normalizeDirectionAddition(entry = {}, validIds = new Set()) {
  const source = asObject(entry);
  const fromScreenId = asTrimmedString(source.from_screen_id || source.fromScreenId);
  const targetScreenId = asTrimmedString(source.target_screen_id || source.targetScreenId);
  const direction = asTrimmedString(source.direction).toLowerCase();
  const label = asTrimmedString(source.label) || direction;

  if (!fromScreenId || !targetScreenId || !direction) {
    return null;
  }
  if (!validIds.has(fromScreenId) || !validIds.has(targetScreenId)) {
    return null;
  }

  return {
    fromScreenId,
    targetScreenId,
    direction,
    label
  };
}

function normalizePromptRouteAddition(route = {}, validIds = new Set()) {
  const source = asObject(route);
  const targetScreenId = asTrimmedString(source.target_screen_id || source.targetScreenId);
  if (!targetScreenId || !validIds.has(targetScreenId)) {
    return null;
  }

  const patterns = Array.isArray(source.patterns)
    ? source.patterns.map((pattern) => asTrimmedString(pattern)).filter(Boolean)
    : [];
  if (!patterns.length) {
    return null;
  }

  const fromScreenIds = Array.isArray(source.from_screen_ids || source.fromScreenIds)
    ? [...new Set((source.from_screen_ids || source.fromScreenIds).map((screenId) => asTrimmedString(screenId)).filter((screenId) => validIds.has(screenId)))]
    : [];

  return {
    id: asTrimmedString(source.id || source.route_id || source.routeId),
    description: asTrimmedString(source.description),
    fromScreenIds,
    matchMode: String(source.match_mode || source.matchMode || '').trim().toLowerCase() === 'all' ? 'all' : 'any',
    patterns,
    targetScreenId
  };
}

function normalizeSceneUpdates(candidate = {}) {
  if (Array.isArray(candidate)) {
    return candidate
      .map((entry) => {
        const source = asObject(entry);
        const field = normalizeSceneField(source.field || source.name || source.key);
        if (!field) return null;
        if (field === 'sceneComponents') {
          const value = normalizeSceneComponentList(source.value);
          return { field, value };
        }
        const value = asTrimmedString(source.value);
        if (!value) return null;
        return { field, value };
      })
      .filter(Boolean);
  }

  const source = asObject(candidate);
  return Object.entries(source)
    .map(([fieldName, value]) => {
      const field = normalizeSceneField(fieldName);
      if (!field) return null;
      if (field === 'sceneComponents') {
        const nextValue = normalizeSceneComponentList(value);
        return { field, value: nextValue };
      }
      const nextValue = asTrimmedString(value);
      if (!nextValue) return null;
      return { field, value: nextValue };
    })
    .filter(Boolean);
}

function normalizeScreenUpdates(candidate = {}, validIds = new Set()) {
  const updates = [];
  const pushPatchFields = (screenId, patch = {}) => {
    const safeScreenId = asTrimmedString(screenId);
    if (!safeScreenId || !validIds.has(safeScreenId)) return;
    Object.entries(asObject(patch)).forEach(([fieldName, value]) => {
      const field = normalizeScreenField(fieldName);
      if (!field) return;
      if (field === 'visualTransitionIntent') {
        updates.push({
          screenId: safeScreenId,
          field,
          value: normalizeVisualTransitionIntent(value)
        });
        return;
      }
      const nextValue = asTrimmedString(value);
      if (!nextValue) return;
      updates.push({
        screenId: safeScreenId,
        field,
        value: nextValue
      });
    });
  };

  if (Array.isArray(candidate)) {
    candidate.forEach((entry) => {
      const source = asObject(entry);
      const screenId = asTrimmedString(source.screen_id || source.screenId || source.id);
      const directField = normalizeScreenField(source.field || source.name || source.key);
      if (directField) {
        const value = directField === 'visualTransitionIntent'
          ? normalizeVisualTransitionIntent(source.value)
          : asTrimmedString(source.value);
        if (!screenId || !validIds.has(screenId)) return;
        if (!value) return;
        updates.push({ screenId, field: directField, value });
        return;
      }
      pushPatchFields(screenId, source);
    });
  } else {
    Object.entries(asObject(candidate)).forEach(([screenId, patch]) => pushPatchFields(screenId, patch));
  }

  const deduped = new Map();
  updates.forEach((update) => {
    deduped.set(`${update.screenId}:${update.field}`, update);
  });
  return Array.from(deduped.values());
}

function buildDirectionListSummary(directions = []) {
  return (Array.isArray(directions) ? directions : []).map((direction) => ({
    direction: asTrimmedString(direction?.direction),
    label: asTrimmedString(direction?.label),
    targetScreenId: asTrimmedString(direction?.targetScreenId)
  }));
}

function buildPromptRouteSummary(promptRoutes = []) {
  return (Array.isArray(promptRoutes) ? promptRoutes : []).map((route) => ({
    id: asTrimmedString(route?.id),
    description: asTrimmedString(route?.description),
    fromScreenIds: Array.isArray(route?.fromScreenIds) ? route.fromScreenIds : [],
    matchMode: route?.matchMode === 'all' ? 'all' : 'any',
    patterns: Array.isArray(route?.patterns) ? route.patterns : [],
    targetScreenId: asTrimmedString(route?.targetScreenId)
  }));
}

function buildCompactScreenSummary(screen = {}) {
  return {
    id: asTrimmedString(screen.id),
    title: asTrimmedString(screen.title),
    prompt: truncateText(screen.prompt, 320),
    image_prompt: truncateText(screen.image_prompt, 220),
    reference_image_prompt: truncateText(screen.referenceImagePrompt, 220),
    prompt_guidance: truncateText(screen.promptGuidance, 220),
    scene_end_condition: truncateText(screen.sceneEndCondition, 180),
    visual_continuity_guidance: truncateText(screen.visualContinuityGuidance, 180),
    visual_transition_intent: normalizeVisualTransitionIntent(screen.visualTransitionIntent),
    component_bindings: Array.isArray(screen.componentBindings)
      ? screen.componentBindings.map((binding) => ({
          component_id: asTrimmedString(binding?.componentId),
          slot: asTrimmedString(binding?.slot),
          props: asObject(binding?.props)
        }))
      : [],
    directions: buildDirectionListSummary(screen.directions)
  };
}

function buildSceneIdentitySummary(config = {}) {
  return {
    scene_name: asTrimmedString(config?.sceneName),
    scene_template: asTrimmedString(config?.sceneTemplate),
    scene_components: Array.isArray(config?.sceneComponents) ? config.sceneComponents : []
  };
}

function buildAdjacentVisualContext(config = {}, selectedScreenId = '') {
  const safeSelectedScreenId = asTrimmedString(selectedScreenId);
  if (!safeSelectedScreenId) {
    return { incoming: [], outgoing: [] };
  }

  const screens = Array.isArray(config?.screens) ? config.screens : [];
  const incoming = [];
  const outgoing = [];

  screens.forEach((screen) => {
    const screenSummary = {
      id: asTrimmedString(screen.id),
      title: asTrimmedString(screen.title),
      imageUrl: asTrimmedString(screen.imageUrl),
      image_prompt: truncateText(screen.image_prompt, 180),
      reference_image_prompt: truncateText(screen.referenceImagePrompt, 180),
      visual_continuity_guidance: truncateText(screen.visualContinuityGuidance, 120),
      visual_transition_intent: normalizeVisualTransitionIntent(screen.visualTransitionIntent)
    };

    const directions = Array.isArray(screen.directions) ? screen.directions : [];
    directions.forEach((direction) => {
      if (asTrimmedString(direction?.targetScreenId) === safeSelectedScreenId) {
        incoming.push({
          via: asTrimmedString(direction?.label || direction?.direction),
          screen: screenSummary
        });
      }
    });

    if (screenSummary.id === safeSelectedScreenId) {
      directions.forEach((direction) => {
        const targetScreen = screens.find((entry) => asTrimmedString(entry?.id) === asTrimmedString(direction?.targetScreenId));
        if (!targetScreen) return;
        outgoing.push({
          via: asTrimmedString(direction?.label || direction?.direction),
          screen: {
            id: asTrimmedString(targetScreen.id),
            title: asTrimmedString(targetScreen.title),
            imageUrl: asTrimmedString(targetScreen.imageUrl),
            image_prompt: truncateText(targetScreen.image_prompt, 180),
            reference_image_prompt: truncateText(targetScreen.referenceImagePrompt, 180),
            visual_continuity_guidance: truncateText(targetScreen.visualContinuityGuidance, 120),
            visual_transition_intent: normalizeVisualTransitionIntent(targetScreen.visualTransitionIntent)
          }
        });
      });
    }
  });

  return { incoming, outgoing };
}

function normalizeNewScreen(screen = {}, validIds = new Set()) {
  const source = asObject(screen);
  const id = ensureUniqueId(source.id || source.screen_id || source.title || 'new_screen', validIds);
  const title = asTrimmedString(source.title) || id;
  const prompt = asTrimmedString(source.prompt);
  const imagePrompt = asTrimmedString(source.image_prompt || source.imagePrompt);
  if (!prompt || !imagePrompt) {
    return null;
  }

  const directions = Array.isArray(source.directions)
    ? source.directions
      .map((entry) => normalizeDirectionAddition(
        { ...entry, from_screen_id: id },
        validIds
      ))
      .filter((entry) => entry?.fromScreenId === id)
      .map((entry) => ({
        direction: entry.direction,
        label: entry.label,
        targetScreenId: entry.targetScreenId
      }))
    : [];

  return {
    id,
    title,
    prompt,
    imageUrl: '',
    image_prompt: imagePrompt,
    referenceImagePrompt: asTrimmedString(source.reference_image_prompt || source.referenceImagePrompt),
    visualContinuityGuidance: asTrimmedString(source.visual_continuity_guidance || source.visualContinuityGuidance),
    visualTransitionIntent: normalizeVisualTransitionIntent(
      source.visual_transition_intent || source.visualTransitionIntent
    ),
    promptGuidance: asTrimmedString(source.prompt_guidance || source.promptGuidance),
    sceneEndCondition: asTrimmedString(source.scene_end_condition || source.sceneEndCondition),
    textPromptPlaceholder: asTrimmedString(source.text_prompt_placeholder || source.textPromptPlaceholder) || 'What do you do?',
    componentBindings: [],
    screenType: 'authored',
    directions
  };
}

function buildSuggestedSceneGuide(config = {}) {
  const brief = asTrimmedString(config?.authoringBrief);
  const screenTitles = Array.isArray(config?.screens)
    ? config.screens.map((screen) => asTrimmedString(screen?.title)).filter(Boolean).slice(0, 4).join(', ')
    : '';

  return [
    'Run the scene as a deliberate authored threshold, not an open sandbox.',
    brief ? `Anchor every reply in this brief: ${truncateText(brief, 180)}` : '',
    screenTitles ? `Keep continuity between these authored screens: ${screenTitles}.` : '',
    'Prefer existing built-in choices and authored free-text routes before inventing new branches.',
    'Only escalate the scene when the player clearly commits to discovery, movement, or contact.'
  ].filter(Boolean).join(' ');
}

function buildSuggestedVisualGuide(config = {}) {
  const brief = asTrimmedString(config?.authoringBrief);
  return [
    'Keep the scene cinematic, tactile, and legible.',
    brief ? `Let the environment answer this premise: ${truncateText(brief, 140)}` : '',
    'Preserve architecture, weather, time of day, and material continuity across neighboring screens.',
    'Use variations in mood and framing deliberately; do not let connected screens feel like unrelated locations.'
  ].filter(Boolean).join(' ');
}

function buildSuggestedScreenPatch(config = {}, selectedScreen = {}, mode = 'fill_missing') {
  const title = asTrimmedString(selectedScreen?.title) || 'This screen';
  const adjacent = buildAdjacentVisualContext(config, selectedScreen?.id);
  const outgoingTitles = adjacent.outgoing.map((entry) => entry.screen?.title).filter(Boolean).slice(0, 2).join(' and ');

  const patch = {};
  if (mode === 'selected_screen' || !asTrimmedString(selectedScreen?.promptGuidance)) {
    patch.promptGuidance = `${title} should stay concrete and authored. Resolve the player's focus through the material details already on screen before suggesting wider possibilities.`;
  }
  if (mode === 'selected_screen' || !asTrimmedString(selectedScreen?.sceneEndCondition)) {
    patch.sceneEndCondition = outgoingTitles
      ? `This screen is complete when the player has examined what matters here and can credibly commit to ${outgoingTitles}.`
      : 'This screen is complete when the player has taken in its key detail and committed to the next clear move.';
  }
  if (mode === 'selected_screen' || !asTrimmedString(selectedScreen?.image_prompt)) {
    patch.image_prompt = `${title}, cinematic quest scene, tactile environment, continuity with the surrounding authored quest screens, moody but readable composition.`;
  }
  if (mode === 'selected_screen' || !asTrimmedString(selectedScreen?.referenceImagePrompt)) {
    patch.referenceImagePrompt = `${title}. Player-view adventure-game scene with environmental storytelling, tactile materials, and visual continuity with the surrounding screens. Preserve the same world, weather, and architectural language.`;
  }
  if (mode === 'selected_screen' || !asTrimmedString(selectedScreen?.visualContinuityGuidance)) {
    patch.visualContinuityGuidance = adjacent.incoming.length || adjacent.outgoing.length
      ? 'Carry forward the same materials, light, and atmosphere from adjacent screens, then shift only the focal detail that makes this stop distinct.'
      : 'Keep the visual language aligned with the rest of the scene rather than inventing a new palette or architecture here.';
  }
  if (mode === 'selected_screen' || !asTrimmedString(selectedScreen?.visualTransitionIntent)) {
    patch.visualTransitionIntent = 'drift';
  }
  return patch;
}

export function getDefaultQuestSceneAuthoringPromptTemplate() {
  return `You are a structured content editor for a quest-scene authoring tool.

You do not rewrite the whole scene. You propose reviewable patches to the existing authored scene graph.

Your priorities:
1. Keep the scene easy for a human author to manage.
2. Reuse existing screens, built-in choices, and authored free-text routes whenever possible.
3. Add only the fields that are needed.
4. Preserve continuity across nearby screens.
5. Never delete or rename screens.
6. Never invent image URLs. Use image_prompt and reference_image_prompt instead.

Mode: {{authoringMode}}
Quest scope: {{questId}} in session {{sessionId}}

Scene identity:
{{sceneIdentity}}

Master scene brief:
{{authoringBrief}}

Current GM scene guide:
{{phaseGuidance}}

Current scene visual guide:
{{visualStyleGuide}}

Selected screen summary:
{{selectedScreenSnapshot}}

Adjacent visual context:
{{adjacentVisualContext}}

Scene outline:
{{sceneOutline}}

Existing free-text routes:
{{promptRouteSummary}}

Return JSON only with this exact shape:
{
  "summary": "short plain-language summary of the proposed draft",
  "scene_updates": [
    { "field": "sceneName|sceneTemplate|sceneComponents|authoringBrief|phaseGuidance|visualStyleGuide", "value": "..." }
  ],
  "screen_updates": [
    { "screen_id": "existing_screen_id", "field": "title|prompt|promptGuidance|sceneEndCondition|image_prompt|referenceImagePrompt|visualContinuityGuidance|visualTransitionIntent|textPromptPlaceholder", "value": "..." }
  ],
  "new_screens": [
    {
      "id": "new_screen_id",
      "title": "Screen title",
      "prompt": "Player-facing text",
      "image_prompt": "Short generator image prompt",
      "reference_image_prompt": "Richer visual brief",
      "prompt_guidance": "Optional screen-only GM guidance",
      "scene_end_condition": "Optional end condition",
      "visual_continuity_guidance": "Optional continuity note",
      "visual_transition_intent": "inherit|drift|break",
      "text_prompt_placeholder": "Optional placeholder"
    }
  ],
  "direction_additions": [
    { "from_screen_id": "existing_screen_id", "direction": "inspect_mural", "label": "Inspect the mural", "target_screen_id": "existing_or_new_screen_id" }
  ],
  "prompt_route_additions": [
    {
      "id": "optional_route_id",
      "description": "what typed intent this route captures",
      "from_screen_ids": ["existing_screen_id"],
      "match_mode": "any|all",
      "patterns": ["regex or literal pattern"],
      "target_screen_id": "existing_or_new_screen_id"
    }
  ]
}

If mode is "fill_missing", only propose fields that are missing or clearly too weak.
If mode is "selected_screen", focus mainly on the selected screen and its outgoing connections.
If mode is "scene", you may patch scene-wide guidance and add missing authored screens/routes when necessary.

Keep the draft compact and practical.`;
}

export function buildQuestSceneAuthoringRuntime(pipeline = {}, mocked = false) {
  return {
    pipeline: QUEST_SCENE_AUTHORING_PIPELINE_KEY,
    provider: typeof pipeline?.provider === 'string' ? pipeline.provider : 'openai',
    model: typeof pipeline?.model === 'string' ? pipeline.model : '',
    mocked: Boolean(mocked)
  };
}

export function buildQuestSceneAuthoringPromptPayload({
  config = {},
  selectedScreen = null,
  mode = 'fill_missing'
} = {}) {
  const safeMode = QUEST_SCENE_AUTHORING_MODES.includes(mode) ? mode : 'fill_missing';
  const screens = Array.isArray(config?.screens) ? config.screens : [];
  const adjacentContext = buildAdjacentVisualContext(config, selectedScreen?.id);

  return {
    sessionId: asTrimmedString(config?.sessionId),
    questId: asTrimmedString(config?.questId),
    authoringMode: safeMode,
    sceneIdentity: JSON.stringify(buildSceneIdentitySummary(config), null, 2),
    authoringBrief: asTrimmedString(config?.authoringBrief),
    phaseGuidance: asTrimmedString(config?.phaseGuidance),
    visualStyleGuide: asTrimmedString(config?.visualStyleGuide),
    selectedScreenId: asTrimmedString(selectedScreen?.id),
    selectedScreenSnapshot: JSON.stringify(selectedScreen ? buildCompactScreenSummary(selectedScreen) : {}, null, 2),
    adjacentVisualContext: JSON.stringify(adjacentContext, null, 2),
    sceneOutline: JSON.stringify(screens.map((screen) => buildCompactScreenSummary(screen)), null, 2),
    promptRouteSummary: JSON.stringify(buildPromptRouteSummary(config?.promptRoutes), null, 2)
  };
}

export function buildQuestSceneAuthoringPromptMessages({ promptTemplate = '', promptPayload = {} } = {}) {
  const template = asTrimmedString(promptTemplate) || getDefaultQuestSceneAuthoringPromptTemplate();
  const compiledPrompt = renderPromptTemplateString(template, promptPayload);
  return {
    compiledPrompt,
    prompts: [
      { role: 'system', content: compiledPrompt },
      { role: 'user', content: JSON.stringify(promptPayload) }
    ]
  };
}

export function buildMockQuestSceneAuthoringDraft({
  config = {},
  selectedScreen = null,
  mode = 'fill_missing'
} = {}) {
  const safeMode = QUEST_SCENE_AUTHORING_MODES.includes(mode) ? mode : 'fill_missing';
  const sceneUpdates = [];
  const screenUpdates = [];
  const directionAdditions = [];

  if (safeMode !== 'selected_screen') {
    if (safeMode === 'scene' || !asTrimmedString(config?.sceneName)) {
      sceneUpdates.push({
        field: 'sceneName',
        value: asTrimmedString(config?.sceneName) || 'New Authored Scene'
      });
    }
    if (safeMode === 'scene' || !asTrimmedString(config?.sceneTemplate)) {
      sceneUpdates.push({
        field: 'sceneTemplate',
        value: 'basic_scene'
      });
    }
    if (safeMode === 'scene' || !asTrimmedString(config?.authoringBrief)) {
      sceneUpdates.push({
        field: 'authoringBrief',
        value: asTrimmedString(config?.authoringBrief) || 'A tactile authored quest scene that should stay coherent across screens while guiding the player toward the next deliberate discovery.'
      });
    }
    if (safeMode === 'scene' || !asTrimmedString(config?.phaseGuidance)) {
      sceneUpdates.push({
        field: 'phaseGuidance',
        value: buildSuggestedSceneGuide(config)
      });
    }
    if (safeMode === 'scene' || !asTrimmedString(config?.visualStyleGuide)) {
      sceneUpdates.push({
        field: 'visualStyleGuide',
        value: buildSuggestedVisualGuide(config)
      });
    }
  }

  if (selectedScreen?.id) {
    const patch = buildSuggestedScreenPatch(config, selectedScreen, safeMode);
    Object.entries(patch).forEach(([field, value]) => {
      if (!value) return;
      screenUpdates.push({
        screen_id: selectedScreen.id,
        field,
        value
      });
    });

    if ((safeMode === 'scene' || safeMode === 'fill_missing') && Array.isArray(selectedScreen?.directions) && selectedScreen.directions.length === 0) {
      const fallbackTarget = Array.isArray(config?.screens)
        ? config.screens.find((screen) => asTrimmedString(screen?.id) !== asTrimmedString(selectedScreen?.id))
        : null;
      if (fallbackTarget?.id) {
        directionAdditions.push({
          from_screen_id: selectedScreen.id,
          direction: 'continue',
          label: `Continue toward ${asTrimmedString(fallbackTarget.title) || fallbackTarget.id}`,
          target_screen_id: fallbackTarget.id
        });
      }
    }
  }

  return {
    summary: safeMode === 'selected_screen'
      ? 'Drafted practical guidance and visual prompts for the selected screen.'
      : safeMode === 'scene'
        ? 'Drafted scene-wide guidance plus the most useful missing local fields.'
        : 'Filled the most obvious missing authoring fields without changing the scene structure.',
    scene_updates: sceneUpdates,
    screen_updates: screenUpdates,
    new_screens: [],
    direction_additions: directionAdditions,
    prompt_route_additions: []
  };
}

export function normalizeQuestSceneAuthoringDraft(rawResponse = {}, { config = {}, selectedScreenId = '', mode = 'fill_missing' } = {}) {
  const source = asObject(rawResponse);
  const screenIds = new Set(
    Array.isArray(config?.screens)
      ? config.screens.map((screen) => asTrimmedString(screen?.id)).filter(Boolean)
      : []
  );
  const newScreenIds = new Set(screenIds);
  const sceneUpdates = normalizeSceneUpdates(source.scene_updates || source.sceneUpdates || {});
  const screenUpdates = normalizeScreenUpdates(source.screen_updates || source.screenUpdates || {}, screenIds);
  const newScreens = Array.isArray(source.new_screens || source.newScreens)
    ? (source.new_screens || source.newScreens)
      .map((screen) => normalizeNewScreen(screen, newScreenIds))
      .filter(Boolean)
    : [];

  const validDirectionTargets = new Set([...screenIds, ...newScreens.map((screen) => screen.id)]);
  const directionAdditions = Array.isArray(source.direction_additions || source.directionAdditions)
    ? (source.direction_additions || source.directionAdditions)
      .map((entry) => normalizeDirectionAddition(entry, validDirectionTargets))
      .filter(Boolean)
    : [];

  const promptRouteAdditions = Array.isArray(source.prompt_route_additions || source.promptRouteAdditions)
    ? (source.prompt_route_additions || source.promptRouteAdditions)
      .map((route) => normalizePromptRouteAddition(route, validDirectionTargets))
      .filter(Boolean)
    : [];

  const summary = asTrimmedString(source.summary)
    || (QUEST_SCENE_AUTHORING_MODES.includes(mode) && mode === 'selected_screen'
      ? 'Drafted selected-screen changes.'
      : 'Drafted quest scene authoring changes.');

  return {
    summary,
    sceneUpdates,
    screenUpdates,
    newScreens,
    directionAdditions,
    promptRouteAdditions,
    meta: {
      selectedScreenId: asTrimmedString(selectedScreenId),
      mode: QUEST_SCENE_AUTHORING_MODES.includes(mode) ? mode : 'fill_missing'
    }
  };
}

export function flattenQuestSceneAuthoringChanges(draft = {}, config = {}) {
  const screenMap = new Map(
    (Array.isArray(config?.screens) ? config.screens : [])
      .map((screen) => [asTrimmedString(screen?.id), screen])
  );

  const changes = [];
  (Array.isArray(draft?.sceneUpdates) ? draft.sceneUpdates : []).forEach((update) => {
    changes.push({
      id: `scene:${update.field}`,
      action: 'set_scene_field',
      label: CHANGE_LABELS[update.field] || update.field,
      targetType: 'scene',
      targetId: update.field,
      field: update.field,
      currentValue: config?.[update.field] || '',
      proposedValue: update.value
    });
  });

  (Array.isArray(draft?.screenUpdates) ? draft.screenUpdates : []).forEach((update) => {
    const screen = screenMap.get(update.screenId) || {};
    changes.push({
      id: `screen:${update.screenId}:${update.field}`,
      action: 'set_screen_field',
      label: `${CHANGE_LABELS[update.field] || update.field} · ${asTrimmedString(screen?.title) || update.screenId}`,
      targetType: 'screen',
      targetId: update.screenId,
      field: update.field,
      currentValue: screen?.[update.field] || '',
      proposedValue: update.value
    });
  });

  (Array.isArray(draft?.newScreens) ? draft.newScreens : []).forEach((screen) => {
    changes.push({
      id: `screen:add:${screen.id}`,
      action: 'add_screen',
      label: `Add screen · ${screen.title || screen.id}`,
      targetType: 'screen',
      targetId: screen.id,
      field: 'screen',
      currentValue: null,
      proposedValue: screen
    });
  });

  (Array.isArray(draft?.directionAdditions) ? draft.directionAdditions : []).forEach((direction) => {
    changes.push({
      id: `direction:${direction.fromScreenId}:${direction.direction}:${direction.targetScreenId}`,
      action: 'add_direction',
      label: `Add built-in choice · ${direction.label || direction.direction}`,
      targetType: 'direction',
      targetId: direction.fromScreenId,
      field: 'directions',
      currentValue: null,
      proposedValue: direction
    });
  });

  (Array.isArray(draft?.promptRouteAdditions) ? draft.promptRouteAdditions : []).forEach((route, index) => {
    changes.push({
      id: `prompt-route:${route.id || `${route.targetScreenId}:${index}`}`,
      action: 'add_prompt_route',
      label: `Add free-text route · ${route.description || route.id || route.targetScreenId}`,
      targetType: 'prompt_route',
      targetId: route.id || route.targetScreenId || `route_${index + 1}`,
      field: 'promptRoutes',
      currentValue: null,
      proposedValue: route
    });
  });

  return changes;
}

import fsPromises from 'fs/promises';
import path from 'path';
import { textToImageOpenAi } from '../ai/textToImage/api.js';
import { getCanonicalProjectAssetRoot } from './projectAssetRootsService.js';

const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const GENERATED_IMAGE_SUBDIRECTORY = 'quest_scene_generations';
const MOCK_IMAGE_URL = '/ruin_south_a.png';
const ASSETS_ROOT = getCanonicalProjectAssetRoot();

function slugifySegment(value = '', fallback = 'scene') {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return normalized || fallback;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function normalizePromptBlock(value = '') {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function compactInlineText(value = '') {
  return normalizePromptBlock(value).replace(/\s+/g, ' ').trim();
}

function truncateInlineText(value = '', maxLength = 240) {
  const compact = compactInlineText(value);
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function getTransitionIntentGuidance(intent = '') {
  const normalizedIntent = compactInlineText(intent).toLowerCase();
  switch (normalizedIntent) {
    case 'break':
      return 'Break deliberately from nearby screens while still honoring the scene-wide visual guide.';
    case 'drift':
      return 'Shift gradually from nearby screens; continuity should hold, but framing, mood, or emphasis may change.';
    case 'inherit':
    default:
      return 'Keep the same visual language as the surrounding screens unless the screen-specific brief clearly requires a small shift.';
  }
}

function normalizeVisualContextEntries(entries = []) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      const screen = entry?.screen && typeof entry.screen === 'object' ? entry.screen : entry || {};
      const title = firstNonEmptyString(entry?.title, screen?.title, screen?.id);
      const via = firstNonEmptyString(entry?.via);
      const reference = firstNonEmptyString(
        entry?.referenceImagePrompt,
        screen?.referenceImagePrompt,
        screen?.image_prompt,
        screen?.prompt
      );
      const continuity = firstNonEmptyString(
        entry?.visualContinuityGuidance,
        screen?.visualContinuityGuidance
      );
      if (!title && !reference && !continuity) return null;
      return {
        title,
        via,
        reference,
        continuity
      };
    })
    .filter(Boolean);
}

function formatVisualContextSection(label, entries = []) {
  if (!entries.length) return '';
  const lines = entries.map((entry) => {
    const parts = [];
    if (entry.via) {
      parts.push(`via ${entry.via}`);
    }
    if (entry.title) {
      parts.push(`screen "${entry.title}"`);
    }
    const lead = parts.length ? `- ${parts.join(' from ')}` : '- Connected screen';
    const details = [];
    if (entry.reference) {
      details.push(`visual reference: ${truncateInlineText(entry.reference)}`);
    }
    if (entry.continuity) {
      details.push(`continuity note: ${truncateInlineText(entry.continuity, 180)}`);
    }
    return details.length ? `${lead} | ${details.join(' | ')}` : lead;
  });
  return `${label}:\n${lines.join('\n')}`;
}

export function composeQuestSceneImagePrompt(source = {}) {
  const sceneName = compactInlineText(source.sceneName || '');
  const sceneTemplate = compactInlineText(source.sceneTemplate || '');
  const sceneComponents = Array.isArray(source.sceneComponents)
    ? source.sceneComponents.map((entry) => compactInlineText(entry)).filter(Boolean)
    : [];
  const sceneBrief = normalizePromptBlock(source.authoringBrief || source.sceneBrief || '');
  const visualStyleGuide = normalizePromptBlock(source.visualStyleGuide || '');
  const screenTitle = compactInlineText(source.screenTitle || source.title || source.screenId || 'Quest scene');
  const screenPrompt = normalizePromptBlock(source.screenPrompt || source.promptText || source.screenPromptText || '');
  const referenceImagePrompt = normalizePromptBlock(
    source.referenceImagePrompt || source.reference_image_prompt || ''
  );
  const imagePrompt = normalizePromptBlock(source.image_prompt || source.imagePrompt || '');
  const visualContinuityGuidance = normalizePromptBlock(source.visualContinuityGuidance || '');
  const incomingContext = normalizeVisualContextEntries(source.incomingScreens || source.incomingContext || []);
  const outgoingContext = normalizeVisualContextEntries(source.outgoingScreens || source.outgoingContext || []);
  const sections = [
    'Create a single finished illustration for a narrative quest screen. The image must stand alone and feel like a real piece of story art, not a UI mockup. Do not include text, captions, logos, watermarks, interface, or page furniture.'
  ];

  if (sceneBrief) {
    sections.push(`Scene brief:\n${sceneBrief}`);
  }

  if (sceneName || sceneTemplate || sceneComponents.length) {
    const lines = [];
    if (sceneName) lines.push(`Scene name: ${sceneName}`);
    if (sceneTemplate) lines.push(`Base scene template: ${sceneTemplate}`);
    if (sceneComponents.length) lines.push(`Attached components: ${sceneComponents.join(', ')}`);
    sections.push(`Scene identity and wiring:\n${lines.join('\n')}`);
  }

  if (screenTitle) {
    sections.push(`Screen title:\n${screenTitle}`);
  }

  if (screenPrompt) {
    sections.push(`Narrative moment to depict:\n${screenPrompt}`);
  }

  if (visualStyleGuide) {
    sections.push(`Global visual guide:\n${visualStyleGuide}`);
  }

  if (referenceImagePrompt) {
    sections.push(`Primary image brief:\n${referenceImagePrompt}`);
  }

  if (imagePrompt) {
    sections.push(`Compact generator shorthand:\n${imagePrompt}`);
  }

  if (visualContinuityGuidance) {
    sections.push(`Screen-level visual continuity:\n${visualContinuityGuidance}`);
  }

  sections.push(`Transition intent:\n${getTransitionIntentGuidance(source.visualTransitionIntent)}`);

  const incomingSection = formatVisualContextSection('Incoming linked-screen context', incomingContext);
  if (incomingSection) {
    sections.push(incomingSection);
  }

  const outgoingSection = formatVisualContextSection('Outgoing linked-screen context', outgoingContext);
  if (outgoingSection) {
    sections.push(outgoingSection);
  }

  sections.push(
    'Output goal:\nProduce one cohesive, richly textured image that belongs to the same scene world as the connected screens and preserves the established material language.'
  );

  return sections.map(normalizePromptBlock).filter(Boolean).join('\n\n');
}

export function resolveQuestSceneImagePrompt(source = {}) {
  const explicitPrompt = firstNonEmptyString(source.prompt);
  if (explicitPrompt) {
    return explicitPrompt;
  }
  return composeQuestSceneImagePrompt(source);
}

export function buildQuestSceneGeneratedAssetPath({
  sessionId = '',
  questId = '',
  screenId = '',
  screenTitle = ''
} = {}) {
  const sessionSegment = slugifySegment(sessionId, 'session');
  const questSegment = slugifySegment(questId, 'quest');
  const screenSegment = slugifySegment(screenTitle || screenId, 'scene');
  const storedFilename = `${screenSegment}_${Date.now()}.png`;
  const relativeDirectory = path.posix.join(
    GENERATED_IMAGE_SUBDIRECTORY,
    sessionSegment,
    questSegment
  );
  const absoluteDir = path.join(ASSETS_ROOT, relativeDirectory);
  const absolutePath = path.join(absoluteDir, storedFilename);

  return {
    storedFilename,
    relativeDirectory,
    absoluteDir,
    absolutePath,
    imageUrl: `/assets/${path.posix.join(relativeDirectory, storedFilename)}`
  };
}

export async function generateQuestSceneImageAsset({
  sessionId = '',
  questId = '',
  screenId = '',
  screenTitle = '',
  prompt = '',
  referenceImagePrompt = '',
  image_prompt = '',
  imageModel = '',
  shouldMock = false
} = {}) {
  const safeScreenId = firstNonEmptyString(screenId);
  if (!safeScreenId) {
    const error = new Error('screenId is required.');
    error.statusCode = 400;
    throw error;
  }

  const promptUsed = resolveQuestSceneImagePrompt({
    prompt,
    referenceImagePrompt,
    image_prompt
  });
  if (!promptUsed) {
    const error = new Error('A Reference Text-to-Image Prompt or Generator Image Prompt is required.');
    error.statusCode = 400;
    throw error;
  }

  const model = firstNonEmptyString(imageModel) || DEFAULT_IMAGE_MODEL;

  if (shouldMock) {
    return {
      imageUrl: MOCK_IMAGE_URL,
      localPath: '',
      storedFilename: '',
      promptUsed,
      revisedPrompt: '',
      model,
      mocked: true
    };
  }

  const target = buildQuestSceneGeneratedAssetPath({
    sessionId,
    questId,
    screenId: safeScreenId,
    screenTitle
  });

  await fsPromises.mkdir(target.absoluteDir, { recursive: true });

  const imageResult = await textToImageOpenAi(promptUsed, 1, target.absolutePath, false, 3, model);
  if (!imageResult?.localPath) {
    const error = new Error('Quest scene image generation failed.');
    error.statusCode = 502;
    throw error;
  }

  return {
    imageUrl: target.imageUrl,
    localPath: imageResult.localPath,
    storedFilename: target.storedFilename,
    promptUsed,
    revisedPrompt: typeof imageResult.revised_prompt === 'string' ? imageResult.revised_prompt : '',
    model,
    mocked: false
  };
}

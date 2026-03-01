import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const SETTINGS_PATH = path.join(CONFIG_DIR, 'typewriter_ai_settings.json');

const PIPELINE_DEFINITIONS = {
  story_continuation: {
    key: 'story_continuation',
    label: 'Story Continuation',
    modelKind: 'text',
    defaultUseMock: process.env.TYPEWRITER_MOCK_MODE === 'true',
    defaultModel: process.env.TYPEWRITER_CONTINUATION_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-5'
  },
  memory_creation: {
    key: 'memory_creation',
    label: 'Memory Creation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_MEMORY_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-5'
  },
  entity_creation: {
    key: 'entity_creation',
    label: 'Entity Creation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_ENTITY_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-5'
  },
  storyteller_creation: {
    key: 'storyteller_creation',
    label: 'Storyteller Creation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_STORYTELLER_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-5'
  },
  texture_creation: {
    key: 'texture_creation',
    label: 'Texture Creation',
    modelKind: 'image',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_TEXTURE_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
  },
  illustration_creation: {
    key: 'illustration_creation',
    label: 'Illustration Creation',
    modelKind: 'image',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_ILLUSTRATION_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1'
  }
};

let cachedSettings = null;

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeModel(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function buildDefaultSettings() {
  const pipelines = {};
  for (const [key, definition] of Object.entries(PIPELINE_DEFINITIONS)) {
    pipelines[key] = {
      key,
      label: definition.label,
      modelKind: definition.modelKind,
      useMock: definition.defaultUseMock,
      model: definition.defaultModel
    };
  }
  return {
    updatedAt: '',
    updatedBy: '',
    pipelines
  };
}

function normalizeSettings(rawSettings) {
  const defaults = buildDefaultSettings();
  const source = asObject(rawSettings);
  const sourcePipelines = asObject(source.pipelines);
  const pipelines = {};

  for (const [key, definition] of Object.entries(PIPELINE_DEFINITIONS)) {
    const fallbackPipeline = defaults.pipelines[key];
    const incoming = asObject(sourcePipelines[key]);
    pipelines[key] = {
      key,
      label: definition.label,
      modelKind: definition.modelKind,
      useMock: parseBoolean(incoming.useMock, fallbackPipeline.useMock),
      model: normalizeModel(incoming.model, fallbackPipeline.model)
    };
  }

  return {
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : defaults.updatedAt,
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : defaults.updatedBy,
    pipelines
  };
}

async function readSettingsFile() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeSettingsFile(settings) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8');
}

function normalizeUpdatePayload(payload = {}) {
  const source = asObject(payload);
  const sourcePipelines = asObject(source.pipelines);
  const nextPipelines = {};

  for (const key of Object.keys(PIPELINE_DEFINITIONS)) {
    const incoming = asObject(sourcePipelines[key]);
    const hasUseMock = Object.prototype.hasOwnProperty.call(incoming, 'useMock');
    const hasModel = Object.prototype.hasOwnProperty.call(incoming, 'model');
    if (!hasUseMock && !hasModel) {
      continue;
    }
    nextPipelines[key] = {};
    if (hasUseMock) nextPipelines[key].useMock = incoming.useMock;
    if (hasModel) nextPipelines[key].model = incoming.model;
  }

  return { pipelines: nextPipelines };
}

export function getTypewriterPipelineDefinitions() {
  return Object.values(PIPELINE_DEFINITIONS).map((definition) => ({
    key: definition.key,
    label: definition.label,
    modelKind: definition.modelKind
  }));
}

export async function getTypewriterAiSettings() {
  if (cachedSettings) {
    return deepClone(cachedSettings);
  }

  const fromDisk = await readSettingsFile();
  cachedSettings = normalizeSettings(fromDisk || {});
  return deepClone(cachedSettings);
}

export function getPipelineSettingsSnapshot(settings, pipelineKey) {
  const normalized = normalizeSettings(settings || {});
  const pipeline = normalized.pipelines?.[pipelineKey];
  if (!pipeline) {
    const error = new Error(`Unknown pipeline key "${pipelineKey}".`);
    error.code = 'INVALID_PIPELINE_KEY';
    throw error;
  }
  return pipeline;
}

export async function getPipelineSettings(pipelineKey) {
  const settings = await getTypewriterAiSettings();
  return getPipelineSettingsSnapshot(settings, pipelineKey);
}

export async function updateTypewriterAiSettings(payload = {}, updatedBy = 'admin') {
  const current = await getTypewriterAiSettings();
  const normalizedPatch = normalizeUpdatePayload(payload);
  const next = deepClone(current);

  for (const [key, patch] of Object.entries(normalizedPatch.pipelines)) {
    if (!next.pipelines[key]) {
      const error = new Error(`Unknown pipeline key "${key}".`);
      error.code = 'INVALID_PIPELINE_KEY';
      throw error;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'useMock')) {
      next.pipelines[key].useMock = parseBoolean(patch.useMock, next.pipelines[key].useMock);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'model')) {
      const normalizedModel = normalizeModel(patch.model, next.pipelines[key].model);
      next.pipelines[key].model = normalizedModel;
    }
  }

  next.updatedAt = new Date().toISOString();
  next.updatedBy = typeof updatedBy === 'string' ? updatedBy : 'admin';

  cachedSettings = normalizeSettings(next);
  await writeSettingsFile(cachedSettings);
  return deepClone(cachedSettings);
}

export async function resetTypewriterAiSettings(updatedBy = 'admin') {
  const resetValue = buildDefaultSettings();
  resetValue.updatedAt = new Date().toISOString();
  resetValue.updatedBy = typeof updatedBy === 'string' ? updatedBy : 'admin';
  cachedSettings = normalizeSettings(resetValue);
  await writeSettingsFile(cachedSettings);
  return deepClone(cachedSettings);
}

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const SETTINGS_PATH = path.join(CONFIG_DIR, 'typewriter_ai_settings.json');
const DEFAULT_PROVIDER = 'openai';
const TEXT_PIPELINE_PROVIDERS = ['openai', 'anthropic'];
const OPENAI_ONLY_PROVIDERS = ['openai'];

const PIPELINE_DEFINITIONS = {
  story_continuation: {
    key: 'story_continuation',
    label: 'Story Continuation',
    modelKind: 'text',
    defaultUseMock: process.env.TYPEWRITER_MOCK_MODE === 'true',
    defaultModel: process.env.TYPEWRITER_CONTINUATION_MODEL || 'gpt-5-mini',
    supportedProviders: TEXT_PIPELINE_PROVIDERS,
    defaultProvider: process.env.TYPEWRITER_CONTINUATION_PROVIDER || DEFAULT_PROVIDER
  },
  memory_creation: {
    key: 'memory_creation',
    label: 'Memory Creation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_MEMORY_MODEL || 'gpt-5-mini',
    supportedProviders: TEXT_PIPELINE_PROVIDERS,
    defaultProvider: DEFAULT_PROVIDER,
    countProperty: 'memoryCount',
    defaultCount: Number.isFinite(Number(process.env.OPENAI_MEMORY_COUNT))
      ? Math.min(Math.max(1, Math.floor(Number(process.env.OPENAI_MEMORY_COUNT))), 10)
      : 3
  },
  entity_creation: {
    key: 'entity_creation',
    label: 'Entity Creation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_ENTITY_MODEL || 'gpt-5-mini',
    supportedProviders: TEXT_PIPELINE_PROVIDERS,
    defaultProvider: DEFAULT_PROVIDER,
    countProperty: 'entityCount',
    defaultCount: Number.isFinite(Number(process.env.OPENAI_ENTITY_COUNT))
      ? Math.min(Math.max(1, Math.floor(Number(process.env.OPENAI_ENTITY_COUNT))), 12)
      : 8
  },
  storyteller_creation: {
    key: 'storyteller_creation',
    label: 'Storyteller Creation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_STORYTELLER_MODEL || 'gpt-5-mini',
    supportedProviders: TEXT_PIPELINE_PROVIDERS,
    defaultProvider: DEFAULT_PROVIDER,
    countProperty: 'storytellerCount',
    defaultCount: Number.isFinite(Number(process.env.OPENAI_STORYTELLER_COUNT))
      ? Math.min(Math.max(1, Math.floor(Number(process.env.OPENAI_STORYTELLER_COUNT))), 10)
      : 4
  },
  relationship_evaluation: {
    key: 'relationship_evaluation',
    label: 'Relationship Evaluation',
    modelKind: 'text',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_RELATIONSHIP_MODEL || 'gpt-5-mini',
    supportedProviders: TEXT_PIPELINE_PROVIDERS,
    defaultProvider: DEFAULT_PROVIDER
  },
  texture_creation: {
    key: 'texture_creation',
    label: 'Texture Creation',
    modelKind: 'image',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_TEXTURE_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    supportedProviders: OPENAI_ONLY_PROVIDERS,
    defaultProvider: DEFAULT_PROVIDER
  },
  illustration_creation: {
    key: 'illustration_creation',
    label: 'Illustration Creation',
    modelKind: 'image',
    defaultUseMock: false,
    defaultModel: process.env.OPENAI_ILLUSTRATION_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    supportedProviders: OPENAI_ONLY_PROVIDERS,
    defaultProvider: DEFAULT_PROVIDER
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

function normalizeProvider(value, fallback = DEFAULT_PROVIDER, allowedProviders = OPENAI_ONLY_PROVIDERS) {
  const fallbackValue = allowedProviders.includes(fallback) ? fallback : allowedProviders[0] || DEFAULT_PROVIDER;
  if (typeof value !== 'string') return fallbackValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallbackValue;
  return allowedProviders.includes(normalized) ? normalized : fallbackValue;
}

function normalizeCount(value, fallback = 8, max = 12) {
  const next = Number(value);
  if (!Number.isFinite(next)) {
    return fallback;
  }
  return Math.min(Math.max(1, Math.floor(next)), max);
}

function buildDefaultSettings() {
  const pipelines = {};
  for (const [key, definition] of Object.entries(PIPELINE_DEFINITIONS)) {
    pipelines[key] = {
      key,
      label: definition.label,
      modelKind: definition.modelKind,
      useMock: definition.defaultUseMock,
      model: definition.defaultModel,
      provider: normalizeProvider(
        definition.defaultProvider,
        DEFAULT_PROVIDER,
        definition.supportedProviders || OPENAI_ONLY_PROVIDERS
      )
    };
    if (definition.countProperty && typeof definition.defaultCount === 'number') {
      pipelines[key][definition.countProperty] = normalizeCount(
        definition.defaultCount,
        definition.defaultCount,
        definition.countProperty === 'entityCount' ? 12 : 10
      );
    }
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
      model: normalizeModel(incoming.model, fallbackPipeline.model),
      provider: normalizeProvider(
        incoming.provider,
        fallbackPipeline.provider || definition.defaultProvider || DEFAULT_PROVIDER,
        definition.supportedProviders || OPENAI_ONLY_PROVIDERS
      )
    };
    if (definition.countProperty && Object.prototype.hasOwnProperty.call(fallbackPipeline, definition.countProperty)) {
      pipelines[key][definition.countProperty] = normalizeCount(
        incoming[definition.countProperty],
        fallbackPipeline[definition.countProperty],
        definition.countProperty === 'entityCount' ? 12 : 10
      );
    }
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
    const hasProvider = Object.prototype.hasOwnProperty.call(incoming, 'provider');
    const countProperty = PIPELINE_DEFINITIONS[key]?.countProperty || '';
    const hasCount = countProperty ? Object.prototype.hasOwnProperty.call(incoming, countProperty) : false;
    if (!hasUseMock && !hasModel && !hasProvider && !hasCount) {
      continue;
    }
    nextPipelines[key] = {};
    if (hasUseMock) nextPipelines[key].useMock = incoming.useMock;
    if (hasModel) nextPipelines[key].model = incoming.model;
    if (hasProvider) nextPipelines[key].provider = incoming.provider;
    if (hasCount) nextPipelines[key][countProperty] = incoming[countProperty];
  }

  return { pipelines: nextPipelines };
}

export function getTypewriterPipelineDefinitions() {
  return Object.values(PIPELINE_DEFINITIONS).map((definition) => ({
    key: definition.key,
    label: definition.label,
    modelKind: definition.modelKind,
    supportedProviders: [...(definition.supportedProviders || OPENAI_ONLY_PROVIDERS)],
    defaultProvider: normalizeProvider(
      definition.defaultProvider,
      DEFAULT_PROVIDER,
      definition.supportedProviders || OPENAI_ONLY_PROVIDERS
    ),
    countProperty: definition.countProperty || '',
    supportsCount: typeof definition.defaultCount === 'number'
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
    if (Object.prototype.hasOwnProperty.call(patch, 'provider')) {
      next.pipelines[key].provider = normalizeProvider(
        patch.provider,
        next.pipelines[key].provider || PIPELINE_DEFINITIONS[key]?.defaultProvider || DEFAULT_PROVIDER,
        PIPELINE_DEFINITIONS[key]?.supportedProviders || OPENAI_ONLY_PROVIDERS
      );
    }
    const countProperty = PIPELINE_DEFINITIONS[key]?.countProperty || '';
    if (
      countProperty
      && Object.prototype.hasOwnProperty.call(patch, countProperty)
      && Object.prototype.hasOwnProperty.call(next.pipelines[key], countProperty)
    ) {
      next.pipelines[key][countProperty] = normalizeCount(
        patch[countProperty],
        next.pipelines[key][countProperty],
        countProperty === 'entityCount' ? 12 : 10
      );
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

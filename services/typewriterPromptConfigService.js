import { TypewriterPromptTemplate } from '../models/models.js';
import { getTypewriterPromptKeys } from './typewriterPromptDefinitionsService.js';

const PIPELINE_KEYS = new Set(getTypewriterPromptKeys());
const DEFAULT_VERSION_LIMIT = 20;

function ensurePipelineKey(pipelineKey) {
  if (!PIPELINE_KEYS.has(pipelineKey)) {
    const supported = Array.from(PIPELINE_KEYS).join(', ');
    const error = new Error(`Unknown pipeline key "${pipelineKey}". Supported keys: ${supported}.`);
    error.code = 'INVALID_PIPELINE_KEY';
    throw error;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTemplateValue(templateValue) {
  if (typeof templateValue !== 'string') return '';
  return templateValue.trim();
}

function toPromptPayload(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    pipelineKey: doc.pipelineKey,
    version: doc.version,
    promptTemplate: doc.promptTemplate,
    isLatest: Boolean(doc.isLatest),
    createdBy: doc.createdBy || 'admin',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    meta: asObject(doc.meta)
  };
}

export function renderPromptTemplateString(template, variables = {}) {
  const base = typeof template === 'string' ? template : '';
  return base.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, variableName) => {
    const value = variables[variableName];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

export async function getLatestPromptTemplate(pipelineKey) {
  ensurePipelineKey(pipelineKey);
  const latest = await TypewriterPromptTemplate.findOne({ pipelineKey, isLatest: true })
    .sort({ version: -1, createdAt: -1 })
    .lean();
  return toPromptPayload(latest);
}

export async function listLatestPromptTemplates() {
  const docs = await TypewriterPromptTemplate.find({ isLatest: true }).lean();
  const byPipeline = {};
  for (const key of PIPELINE_KEYS) {
    const match = docs
      .filter((doc) => doc.pipelineKey === key)
      .sort((a, b) => (b.version || 0) - (a.version || 0))[0];
    byPipeline[key] = toPromptPayload(match);
  }
  return {
    pipelines: byPipeline
  };
}

export async function listPromptTemplateVersions(pipelineKey, limit = DEFAULT_VERSION_LIMIT) {
  ensurePipelineKey(pipelineKey);
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(100, Number(limit)))
    : DEFAULT_VERSION_LIMIT;
  const docs = await TypewriterPromptTemplate.find({ pipelineKey })
    .sort({ version: -1, createdAt: -1 })
    .limit(safeLimit)
    .lean();
  return docs.map(toPromptPayload);
}

export async function savePromptTemplateVersion(
  pipelineKey,
  promptTemplate,
  createdBy = 'admin',
  { markLatest = true, meta = {} } = {}
) {
  ensurePipelineKey(pipelineKey);
  const normalizedTemplate = normalizeTemplateValue(promptTemplate);
  if (!normalizedTemplate) {
    const error = new Error('promptTemplate must be a non-empty string.');
    error.code = 'INVALID_PROMPT_TEMPLATE';
    throw error;
  }

  const latest = await TypewriterPromptTemplate.findOne({ pipelineKey })
    .sort({ version: -1 })
    .lean();
  const nextVersion = (latest?.version || 0) + 1;

  if (markLatest) {
    await TypewriterPromptTemplate.updateMany(
      { pipelineKey, isLatest: true },
      { $set: { isLatest: false } }
    );
  }

  const doc = await TypewriterPromptTemplate.create({
    pipelineKey,
    version: nextVersion,
    promptTemplate: normalizedTemplate,
    isLatest: Boolean(markLatest),
    createdBy: typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'admin',
    meta: asObject(meta)
  });

  return toPromptPayload(doc);
}

export async function setLatestPromptTemplate(pipelineKey, { id, version } = {}) {
  ensurePipelineKey(pipelineKey);
  const query = { pipelineKey };
  if (id) {
    query._id = id;
  } else if (Number.isFinite(Number(version))) {
    query.version = Number(version);
  } else {
    const error = new Error('Provide id or version to set latest prompt template.');
    error.code = 'INVALID_PROMPT_SELECTION';
    throw error;
  }

  const selected = await TypewriterPromptTemplate.findOne(query);
  if (!selected) {
    const error = new Error('Prompt template version not found.');
    error.code = 'PROMPT_VERSION_NOT_FOUND';
    throw error;
  }

  await TypewriterPromptTemplate.updateMany(
    { pipelineKey, isLatest: true },
    { $set: { isLatest: false } }
  );
  selected.isLatest = true;
  await selected.save();
  return toPromptPayload(selected.toObject ? selected.toObject() : selected);
}

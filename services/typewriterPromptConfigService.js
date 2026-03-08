import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { TypewriterPromptTemplate } from '../models/models.js';
import { getTypewriterPromptKeys } from './typewriterPromptDefinitionsService.js';
import { ensureMongoConnection } from './mongoConnectionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const PROMPT_STORE_PATH = process.env.TYPEWRITER_PROMPT_STORE_PATH
  || path.join(CONFIG_DIR, 'typewriter_prompt_templates.json');
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
    id: String(doc._id || doc.id || ''),
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

function sortPromptDocs(docs) {
  return [...docs].sort((left, right) => {
    const versionDiff = (Number(right?.version) || 0) - (Number(left?.version) || 0);
    if (versionDiff !== 0) return versionDiff;
    return String(right?.createdAt || '').localeCompare(String(left?.createdAt || ''));
  });
}

async function shouldUseMongoPromptStore() {
  return ensureMongoConnection({ allowFailure: true });
}

async function readPromptStoreFile() {
  try {
    const raw = await fs.readFile(PROMPT_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      pipelines: asObject(parsed.pipelines)
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { pipelines: {} };
    }
    throw error;
  }
}

async function writePromptStoreFile(store) {
  await fs.mkdir(path.dirname(PROMPT_STORE_PATH), { recursive: true });
  await fs.writeFile(PROMPT_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeStoredDoc(pipelineKey, doc) {
  return {
    id: typeof doc?.id === 'string' && doc.id ? doc.id : randomUUID(),
    pipelineKey,
    version: Number(doc?.version) || 1,
    promptTemplate: typeof doc?.promptTemplate === 'string' ? doc.promptTemplate : '',
    isLatest: Boolean(doc?.isLatest),
    createdBy: typeof doc?.createdBy === 'string' && doc.createdBy.trim() ? doc.createdBy.trim() : 'admin',
    createdAt: typeof doc?.createdAt === 'string' && doc.createdAt ? doc.createdAt : new Date().toISOString(),
    updatedAt: typeof doc?.updatedAt === 'string' && doc.updatedAt ? doc.updatedAt : new Date().toISOString(),
    meta: asObject(doc?.meta)
  };
}

async function getStoredVersions(pipelineKey) {
  const store = await readPromptStoreFile();
  const docs = Array.isArray(store.pipelines[pipelineKey]) ? store.pipelines[pipelineKey] : [];
  return sortPromptDocs(docs.map((doc) => normalizeStoredDoc(pipelineKey, doc)));
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
  if (await shouldUseMongoPromptStore()) {
    const latest = await TypewriterPromptTemplate.findOne({ pipelineKey, isLatest: true })
      .sort({ version: -1, createdAt: -1 })
      .lean();
    return toPromptPayload(latest);
  }

  const versions = await getStoredVersions(pipelineKey);
  return toPromptPayload(versions.find((doc) => doc.isLatest) || versions[0] || null);
}

export async function listLatestPromptTemplates() {
  if (await shouldUseMongoPromptStore()) {
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

  const store = await readPromptStoreFile();
  const byPipeline = {};
  for (const key of PIPELINE_KEYS) {
    const docs = Array.isArray(store.pipelines[key]) ? store.pipelines[key] : [];
    const normalized = sortPromptDocs(docs.map((doc) => normalizeStoredDoc(key, doc)));
    byPipeline[key] = toPromptPayload(normalized.find((doc) => doc.isLatest) || normalized[0] || null);
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

  if (await shouldUseMongoPromptStore()) {
    const docs = await TypewriterPromptTemplate.find({ pipelineKey })
      .sort({ version: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();
    return docs.map(toPromptPayload);
  }

  const versions = await getStoredVersions(pipelineKey);
  return versions.slice(0, safeLimit).map(toPromptPayload);
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

  if (await shouldUseMongoPromptStore()) {
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

  const store = await readPromptStoreFile();
  const docs = Array.isArray(store.pipelines[pipelineKey]) ? store.pipelines[pipelineKey] : [];
  const normalizedDocs = docs.map((doc) => normalizeStoredDoc(pipelineKey, doc));
  const nextVersion = normalizedDocs.reduce((maxVersion, doc) => Math.max(maxVersion, doc.version || 0), 0) + 1;
  const now = new Date().toISOString();

  const nextDocs = normalizedDocs.map((doc) => ({
    ...doc,
    isLatest: markLatest ? false : Boolean(doc.isLatest)
  }));
  nextDocs.push({
    id: randomUUID(),
    pipelineKey,
    version: nextVersion,
    promptTemplate: normalizedTemplate,
    isLatest: Boolean(markLatest),
    createdBy: typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'admin',
    createdAt: now,
    updatedAt: now,
    meta: asObject(meta)
  });

  store.pipelines[pipelineKey] = sortPromptDocs(nextDocs);
  await writePromptStoreFile(store);
  return toPromptPayload(nextDocs[nextDocs.length - 1]);
}

export async function setLatestPromptTemplate(pipelineKey, { id, version } = {}) {
  ensurePipelineKey(pipelineKey);
  if (await shouldUseMongoPromptStore()) {
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

  const store = await readPromptStoreFile();
  const docs = Array.isArray(store.pipelines[pipelineKey]) ? store.pipelines[pipelineKey] : [];
  const normalizedDocs = docs.map((doc) => normalizeStoredDoc(pipelineKey, doc));
  const selectedIndex = normalizedDocs.findIndex((doc) =>
    (id && doc.id === id) || (!id && Number.isFinite(Number(version)) && doc.version === Number(version))
  );

  if (selectedIndex < 0) {
    const error = new Error('Prompt template version not found.');
    error.code = 'PROMPT_VERSION_NOT_FOUND';
    throw error;
  }

  const now = new Date().toISOString();
  const nextDocs = normalizedDocs.map((doc, index) => ({
    ...doc,
    isLatest: index === selectedIndex,
    updatedAt: index === selectedIndex ? now : doc.updatedAt
  }));
  store.pipelines[pipelineKey] = sortPromptDocs(nextDocs);
  await writePromptStoreFile(store);
  return toPromptPayload(nextDocs[selectedIndex]);
}

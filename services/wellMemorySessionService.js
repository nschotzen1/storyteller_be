import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import path from 'path';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { WellMemorySession } from '../models/models.js';
import { getWellTextualBank } from './wellSceneConfigService.js';

const WELL_SCENE_KEY = 'well';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WELL_MEMORY_SESSION_PATH = process.env.WELL_MEMORY_SESSION_PATH
  || path.resolve(__dirname, '..', 'config', 'well_memory_sessions.json');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeSessionId = (sessionId) => (
  typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : ''
);

const normalizePlayerId = (playerId) => (
  typeof playerId === 'string' && playerId.trim() ? playerId.trim() : ''
);

const normalizeJotText = (value) => (
  typeof value === 'string' ? value.trim() : ''
);

const isMongoReady = () => mongoose.connection?.readyState === 1;

const buildFileStoreKey = (sessionId, playerId = '') => `${sessionId}::${playerId}`;

const readWellMemoryFileStore = async () => {
  try {
    const raw = await fs.readFile(WELL_MEMORY_SESSION_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
};

const writeWellMemoryFileStore = async (store) => {
  await fs.mkdir(path.dirname(WELL_MEMORY_SESSION_PATH), { recursive: true });
  await fs.writeFile(WELL_MEMORY_SESSION_PATH, JSON.stringify(store, null, 2), 'utf8');
};

const getRequiredTextualJots = (config = {}) => {
  const value = Number(config?.completion?.required?.textual);
  if (!Number.isFinite(value)) return 3;
  return clamp(Math.round(value), 1, 12);
};

const buildSessionQuery = (sessionId, playerId = '') => ({
  session_id: sessionId,
  playerId,
  sceneKey: WELL_SCENE_KEY
});

const getWeightedRandomEntry = (entries = []) => {
  if (!entries.length) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(1, Number(entry.weight) || 1), 0);
  let needle = Math.random() * totalWeight;
  for (const entry of entries) {
    needle -= Math.max(1, Number(entry.weight) || 1);
    if (needle <= 0) return entry;
  }
  return entries[entries.length - 1];
};

export function pickNextTextualFragmentFromBank(bank = [], seenFragmentIds = []) {
  const normalizedBank = getWellTextualBank({ banks: { textual: bank } });
  const seen = new Set(Array.isArray(seenFragmentIds) ? seenFragmentIds : []);
  const unseen = normalizedBank.filter((entry) => !seen.has(entry.id));
  const pool = unseen.length ? unseen : normalizedBank;
  const selected = getWeightedRandomEntry(pool);
  if (!selected) return null;
  return {
    id: randomUUID(),
    type: 'textual',
    bankId: selected.id,
    surface: {
      text: selected.text
    },
    surfacedAt: new Date(),
    expiresAt: null
  };
}

export function buildWellMemorySessionPayload(doc = {}) {
  const requiredTextual = getRequiredTextualJots({ completion: { required: doc.required || {} } });
  const capturedTextual = clamp(Number(doc?.captured?.textual) || 0, 0, requiredTextual);
  const bundle = Array.isArray(doc.bundle) ? doc.bundle : [];
  return {
    sessionId: normalizeSessionId(doc.session_id),
    playerId: normalizePlayerId(doc.playerId),
    sceneKey: WELL_SCENE_KEY,
    status: typeof doc.status === 'string' ? doc.status : 'observing',
    required: {
      textual: requiredTextual
    },
    captured: {
      textual: capturedTextual
    },
    currentFragment: doc.currentFragment || null,
    bundle,
    readyForHandoff: capturedTextual >= requiredTextual,
    completedAt: doc.completedAt || null
  };
}

const buildDefaultSessionRecord = (sessionId, playerId = '', config = {}) => ({
  session_id: sessionId,
  playerId,
  sceneKey: WELL_SCENE_KEY,
  status: 'observing',
  required: {
    textual: getRequiredTextualJots(config)
  },
  captured: {
    textual: 0
  },
  currentFragment: null,
  seenFragmentIds: [],
  bundle: [],
  completedAt: null
});

export const buildStartWellMemorySessionUpsert = (sessionId, playerId = '', config = {}) => {
  const insertRecord = buildDefaultSessionRecord(sessionId, playerId, config);
  delete insertRecord.required;
  return {
    $setOnInsert: insertRecord,
    $set: {
      required: {
        textual: getRequiredTextualJots(config)
      }
    }
  };
};

const loadFileSessionRecord = async (sessionId, playerId = '', config = {}) => {
  const store = await readWellMemoryFileStore();
  const key = buildFileStoreKey(sessionId, playerId);
  return {
    store,
    key,
    record: store[key] ? { ...store[key] } : buildDefaultSessionRecord(sessionId, playerId, config)
  };
};

const saveFileSessionRecord = async (store, key, record) => {
  const nextStore = {
    ...store,
    [key]: record
  };
  await writeWellMemoryFileStore(nextStore);
};

export async function startWellMemorySession({ sessionId, playerId = '', config = {} } = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) {
    const error = new Error('sessionId is required.');
    error.code = 'INVALID_SESSION_ID';
    throw error;
  }

  const safePlayerId = normalizePlayerId(playerId);
  if (!isMongoReady()) {
    const requiredTextual = getRequiredTextualJots(config);
    const { store, key, record } = await loadFileSessionRecord(safeSessionId, safePlayerId, config);
    record.required = { textual: requiredTextual };
    await saveFileSessionRecord(store, key, record);
    return buildWellMemorySessionPayload(record);
  }

  const doc = await WellMemorySession.findOneAndUpdate(
    buildSessionQuery(safeSessionId, safePlayerId),
    buildStartWellMemorySessionUpsert(safeSessionId, safePlayerId, config),
    {
      new: true,
      upsert: true
    }
  ).lean();

  return buildWellMemorySessionPayload(doc);
}

export async function getWellMemorySession({ sessionId, playerId = '' } = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) return null;
  const safePlayerId = normalizePlayerId(playerId);
  if (!isMongoReady()) {
    const { store, key } = await loadFileSessionRecord(safeSessionId, safePlayerId);
    return store[key] ? buildWellMemorySessionPayload(store[key]) : null;
  }
  const doc = await WellMemorySession.findOne(buildSessionQuery(safeSessionId, safePlayerId)).lean();
  return doc ? buildWellMemorySessionPayload(doc) : null;
}

export async function drawNextWellTextualFragment({
  sessionId,
  playerId = '',
  config = {},
  replaceCurrent = false
} = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) {
    const error = new Error('sessionId is required.');
    error.code = 'INVALID_SESSION_ID';
    throw error;
  }

  const safePlayerId = normalizePlayerId(playerId);
  const existing = await startWellMemorySession({ sessionId: safeSessionId, playerId: safePlayerId, config });
  if (existing.readyForHandoff || existing.status === 'completed') {
    return existing;
  }
  if (existing.currentFragment?.id && !replaceCurrent) {
    return existing;
  }

  if (!isMongoReady()) {
    const { store, key, record } = await loadFileSessionRecord(safeSessionId, safePlayerId, config);
    const fragment = pickNextTextualFragmentFromBank(config?.banks?.textual, record?.seenFragmentIds || []);
    if (!fragment) {
      const error = new Error('The textual fragment bank is empty.');
      error.code = 'EMPTY_TEXTUAL_BANK';
      throw error;
    }
    if (!Array.isArray(record.seenFragmentIds)) {
      record.seenFragmentIds = [];
    }
    record.currentFragment = fragment;
    record.status = 'observing';
    if (fragment.bankId && !record.seenFragmentIds.includes(fragment.bankId)) {
      record.seenFragmentIds.push(fragment.bankId);
    }
    await saveFileSessionRecord(store, key, record);
    return buildWellMemorySessionPayload(record);
  }

  const doc = await WellMemorySession.findOne(buildSessionQuery(safeSessionId, safePlayerId));
  const fragment = pickNextTextualFragmentFromBank(config?.banks?.textual, doc?.seenFragmentIds || []);
  if (!fragment) {
    const error = new Error('The textual fragment bank is empty.');
    error.code = 'EMPTY_TEXTUAL_BANK';
    throw error;
  }

  if (!Array.isArray(doc.seenFragmentIds)) {
    doc.seenFragmentIds = [];
  }
  doc.currentFragment = fragment;
  doc.status = 'observing';
  if (fragment.bankId && !doc.seenFragmentIds.includes(fragment.bankId)) {
    doc.seenFragmentIds.push(fragment.bankId);
  }
  await doc.save();

  return buildWellMemorySessionPayload(doc.toObject());
}

export async function submitWellTextualJot({
  sessionId,
  playerId = '',
  fragmentId,
  rawJotText,
  config = {}
} = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) {
    const error = new Error('sessionId is required.');
    error.code = 'INVALID_SESSION_ID';
    throw error;
  }

  const safeFragmentId = normalizeSessionId(fragmentId);
  const safeJotText = normalizeJotText(rawJotText);
  if (!safeFragmentId) {
    const error = new Error('fragmentId is required.');
    error.code = 'INVALID_FRAGMENT_ID';
    throw error;
  }
  if (!safeJotText) {
    const error = new Error('Jot text is required.');
    error.code = 'INVALID_JOT_TEXT';
    throw error;
  }

  const safePlayerId = normalizePlayerId(playerId);
  if (!isMongoReady()) {
    const { store, key, record } = await loadFileSessionRecord(safeSessionId, safePlayerId, config);
    if (record.status === 'completed') {
      return buildWellMemorySessionPayload(record);
    }
    if (!record.currentFragment?.id || record.currentFragment.id !== safeFragmentId) {
      const error = new Error('That fragment is no longer active.');
      error.code = 'FRAGMENT_MISMATCH';
      throw error;
    }
    record.bundle = Array.isArray(record.bundle) ? record.bundle : [];
    record.bundle.push({
      jotId: randomUUID(),
      fragmentId: safeFragmentId,
      fragmentType: 'textual',
      rawJotText: safeJotText,
      createdAt: new Date().toISOString()
    });
    record.currentFragment = null;
    record.captured = {
      textual: record.bundle.length
    };
    record.required = {
      textual: getRequiredTextualJots(config)
    };
    record.status = record.bundle.length >= record.required.textual ? 'bundle_ready' : 'observing';
    await saveFileSessionRecord(store, key, record);
    return buildWellMemorySessionPayload(record);
  }

  const doc = await WellMemorySession.findOne(buildSessionQuery(safeSessionId, safePlayerId));
  if (!doc) {
    const error = new Error('Well session not found.');
    error.code = 'SESSION_NOT_FOUND';
    throw error;
  }
  if (doc.status === 'completed') {
    return buildWellMemorySessionPayload(doc.toObject());
  }
  if (!doc.currentFragment?.id || doc.currentFragment.id !== safeFragmentId) {
    const error = new Error('That fragment is no longer active.');
    error.code = 'FRAGMENT_MISMATCH';
    throw error;
  }

  doc.bundle.push({
    jotId: randomUUID(),
    fragmentId: safeFragmentId,
    fragmentType: 'textual',
    rawJotText: safeJotText,
    createdAt: new Date()
  });
  doc.currentFragment = null;
  doc.captured = {
    textual: doc.bundle.length
  };
  doc.required = {
    textual: getRequiredTextualJots(config)
  };
  doc.status = doc.bundle.length >= doc.required.textual ? 'bundle_ready' : 'observing';
  await doc.save();

  return buildWellMemorySessionPayload(doc.toObject());
}

export async function handoffWellMemorySession({ sessionId, playerId = '', config = {} } = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) {
    const error = new Error('sessionId is required.');
    error.code = 'INVALID_SESSION_ID';
    throw error;
  }

  const safePlayerId = normalizePlayerId(playerId);
  if (!isMongoReady()) {
    const { store, key, record } = await loadFileSessionRecord(safeSessionId, safePlayerId, config);
    record.required = {
      textual: getRequiredTextualJots(config)
    };
    if ((record.bundle?.length || 0) < record.required.textual) {
      const error = new Error('The falcon is still waiting for more gathered scraps.');
      error.code = 'HANDOFF_NOT_READY';
      throw error;
    }
    record.status = 'completed';
    record.currentFragment = null;
    record.captured = {
      textual: record.bundle.length
    };
    record.completedAt = new Date().toISOString();
    await saveFileSessionRecord(store, key, record);
    return buildWellMemorySessionPayload(record);
  }

  const doc = await WellMemorySession.findOne(buildSessionQuery(safeSessionId, safePlayerId));
  if (!doc) {
    const error = new Error('Well session not found.');
    error.code = 'SESSION_NOT_FOUND';
    throw error;
  }

  doc.required = {
    textual: getRequiredTextualJots(config)
  };
  if ((doc.bundle?.length || 0) < doc.required.textual) {
    const error = new Error('The falcon is still waiting for more gathered scraps.');
    error.code = 'HANDOFF_NOT_READY';
    throw error;
  }

  doc.status = 'completed';
  doc.currentFragment = null;
  doc.captured = {
    textual: doc.bundle.length
  };
  doc.completedAt = new Date();
  await doc.save();

  return buildWellMemorySessionPayload(doc.toObject());
}

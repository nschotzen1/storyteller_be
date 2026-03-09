import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { MessengerSceneBrief } from '../models/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const STORE_PATH = process.env.MESSENGER_SCENE_BRIEF_STORE_PATH
  || path.join(CONFIG_DIR, 'messenger_scene_briefs.json');

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maxLength = 4000) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

function normalizeStringList(value, { limit = 6, itemMaxLength = 220 } = {}) {
  if (!Array.isArray(value)) return [];
  const unique = new Set();
  const items = [];
  for (const entry of value) {
    const normalized = normalizeString(entry, itemMaxLength);
    if (!normalized) continue;
    const dedupeKey = normalized.toLowerCase();
    if (unique.has(dedupeKey)) continue;
    unique.add(dedupeKey);
    items.push(normalized);
    if (items.length >= limit) break;
  }
  return items;
}

function normalizeBriefKey(sessionId, sceneId) {
  return `${sessionId}::${sceneId}`;
}

function normalizeSubject(subject, placeName, placeSummary) {
  const direct = normalizeString(subject, 120);
  if (direct) return direct;

  const fallback = normalizeString(placeName, 120) || normalizeString(placeSummary, 120);
  if (!fallback) return '';
  return fallback
    .split(/\s+/)
    .slice(0, 6)
    .join(' ');
}

function normalizeSceneBriefDoc(sessionId, sceneId, doc = {}) {
  const placeName = normalizeString(doc.placeName, 240);
  const placeSummary = normalizeString(doc.placeSummary, 4000);
  return {
    id: typeof doc.id === 'string' && doc.id ? doc.id : String(doc._id || randomUUID()),
    sessionId,
    sceneId,
    subject: normalizeSubject(doc.subject, placeName, placeSummary),
    placeName,
    placeSummary,
    typewriterHidingSpot: normalizeString(doc.typewriterHidingSpot, 1600),
    sensoryDetails: normalizeStringList(doc.sensoryDetails),
    notableFeatures: normalizeStringList(doc.notableFeatures),
    sceneEstablished: Boolean(doc.sceneEstablished),
    assistantReply: normalizeString(doc.assistantReply, 4000),
    source: normalizeString(doc.source, 80) || 'unknown',
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    meta: asObject(doc.meta)
  };
}

function isMeaningfulSceneBrief(doc) {
  return Boolean(
    doc?.subject
    || doc?.placeName
    || doc?.placeSummary
    || doc?.typewriterHidingSpot
    || (Array.isArray(doc?.sensoryDetails) && doc.sensoryDetails.length)
    || (Array.isArray(doc?.notableFeatures) && doc.notableFeatures.length)
  );
}

async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      briefs: asObject(parsed.briefs)
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { briefs: {} };
    }
    throw error;
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function toPayload(doc, sessionId, sceneId) {
  if (!doc) return null;
  return normalizeSceneBriefDoc(
    sessionId || doc.sessionId || '',
    sceneId || doc.sceneId || '',
    doc
  );
}

export async function getMessengerSceneBrief(sessionId, sceneId, persistence = 'mongo') {
  if (persistence === 'mongo') {
    const doc = await MessengerSceneBrief.findOne({ sessionId, sceneId }).lean();
    return toPayload(doc, sessionId, sceneId);
  }

  const store = await readStore();
  const record = store.briefs[normalizeBriefKey(sessionId, sceneId)] || null;
  return toPayload(record, sessionId, sceneId);
}

export async function saveMessengerSceneBrief(sessionId, sceneId, brief, persistence = 'mongo') {
  const normalized = normalizeSceneBriefDoc(sessionId, sceneId, brief);
  if (!isMeaningfulSceneBrief(normalized)) {
    return null;
  }

  if (persistence === 'mongo') {
    const doc = await MessengerSceneBrief.findOneAndUpdate(
      { sessionId, sceneId },
      {
        $set: {
          subject: normalized.subject,
          placeName: normalized.placeName,
          placeSummary: normalized.placeSummary,
          typewriterHidingSpot: normalized.typewriterHidingSpot,
          sensoryDetails: normalized.sensoryDetails,
          notableFeatures: normalized.notableFeatures,
          sceneEstablished: normalized.sceneEstablished,
          assistantReply: normalized.assistantReply,
          source: normalized.source,
          meta: normalized.meta
        }
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();

    return toPayload(doc, sessionId, sceneId);
  }

  const store = await readStore();
  const key = normalizeBriefKey(sessionId, sceneId);
  const current = store.briefs[key] || {};
  const next = {
    ...current,
    ...normalized,
    createdAt: current.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.briefs[key] = next;
  await writeStore(store);
  return toPayload(next, sessionId, sceneId);
}

export async function deleteMessengerSceneBrief(sessionId, sceneId, persistence = 'mongo') {
  if (persistence === 'mongo') {
    const result = await MessengerSceneBrief.deleteOne({ sessionId, sceneId });
    return result.deletedCount || 0;
  }

  const store = await readStore();
  const key = normalizeBriefKey(sessionId, sceneId);
  const hadRecord = Boolean(store.briefs[key]);
  delete store.briefs[key];
  await writeStore(store);
  return hadRecord ? 1 : 0;
}

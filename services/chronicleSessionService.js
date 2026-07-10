import { randomUUID } from 'crypto';
import { ChronicleSessionModel } from '../models/chronicleModels.js';
import { loadThorbataBible, buildInitialCells, buildCanonLocks } from './thorbataBibleService.js';

export const ACTS = Object.freeze({
  SOCIETY_CHAT: 'SOCIETY_CHAT',
  ARRIVAL_SCENE: 'ARRIVAL_SCENE',
  RESTORATION: 'RESTORATION',
  COMPLETE: 'COMPLETE'
});

const INITIAL_PRESSURE = () => ({
  value: 0,
  threshold: 6,
  sources: { wolfInstability: 0, vossDanger: 0, societySuspicion: 0, fluteDeadline: 0 },
  lastSceneAt: null
});

const INITIAL_FACTS = () => ({
  pageCount: null,
  heroStance: null,
  chapterTitle: null,
  tavernDish: null,
  writingPlace: null
});

const INITIAL_CHARACTER = () => ({
  tendencies: { caution: 0, nerve: 0, curiosity: 0, guile: 0, empathy: 0 },
  notes: []
});

function toPlain(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return JSON.parse(JSON.stringify(plain));
}

export async function createChronicle() {
  const { bible, chapter } = await loadThorbataBible();
  const doc = await ChronicleSessionModel.create({
    chronicleId: randomUUID(),
    act: ACTS.SOCIETY_CHAT,
    recoveredFacts: INITIAL_FACTS(),
    canonLocks: buildCanonLocks(bible),
    character: INITIAL_CHARACTER(),
    evidence: [],
    cells: buildInitialCells(chapter),
    pressure: INITIAL_PRESSURE(),
    transcript: [],
    ritual: { cursor: 0 }
  });
  return toPlain(doc);
}

export async function getChronicle(chronicleId) {
  const doc = await ChronicleSessionModel.findOne({ chronicleId }).lean();
  return doc ? JSON.parse(JSON.stringify(doc)) : null;
}

export async function saveChronicle(session) {
  if (!session?.chronicleId) {
    throw new Error('saveChronicle requires a session with a chronicleId');
  }
  const { _id, __v, createdAt, updatedAt, ...fields } = session;
  const doc = await ChronicleSessionModel.findOneAndUpdate(
    { chronicleId: session.chronicleId },
    { $set: fields },
    { new: true }
  ).lean();
  if (!doc) {
    throw new Error(`Chronicle ${session.chronicleId} not found`);
  }
  return JSON.parse(JSON.stringify(doc));
}

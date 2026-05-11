import { randomUUID } from 'crypto';
import { NarrativeFragment } from '../models/models.js';

const TYPEWRITER_FRAGMENT_TURN = 0;
const DEFAULT_TYPEWRITER_WORLD_STATE = Object.freeze({
  entities: [],
  active_tension: '',
  established_facts: []
});
const TYPEWRITER_TURN_HISTORY_LIMIT = 50;

function normalizeSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : '';
}

function normalizeFragmentText(fragment) {
  if (typeof fragment === 'string') return fragment;
  if (fragment === undefined || fragment === null) return '';
  return String(fragment);
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function normalizeTypewriterWorldState(worldState) {
  const source = {
    ...DEFAULT_TYPEWRITER_WORLD_STATE,
    ...normalizeObject(worldState)
  };
  return {
    ...source,
    entities: source.entities === undefined ? DEFAULT_TYPEWRITER_WORLD_STATE.entities : source.entities,
    active_tension: typeof source.active_tension === 'string' ? source.active_tension : '',
    established_facts: source.established_facts === undefined
      ? DEFAULT_TYPEWRITER_WORLD_STATE.established_facts
      : source.established_facts
  };
}

function normalizeInitialFragment(doc) {
  const explicitInitialFragment = normalizeFragmentText(doc?.initialFragment);
  if (explicitInitialFragment) return explicitInitialFragment;
  return normalizeFragmentText(doc?.fragment);
}

function buildTypewriterSessionRecord(sessionId, doc = {}) {
  return {
    sessionId,
    fragment: normalizeFragmentText(doc?.fragment),
    initialFragment: normalizeInitialFragment(doc),
    worldState: normalizeTypewriterWorldState(doc?.worldState),
    lastTypewriterTurn: doc?.lastTypewriterTurn || null,
    typewriterTurns: Array.isArray(doc?.typewriterTurns) ? doc.typewriterTurns : []
  };
}

export function mergeTypewriterFragment(existingFragment, continuation) {
  const base = normalizeFragmentText(existingFragment);
  const next = normalizeFragmentText(continuation);
  if (!next) return base;
  if (!base) return next;
  const shouldInsertSpace = !/\s$/.test(base) && !/^\s/.test(next);
  return `${base}${shouldInsertSpace ? ' ' : ''}${next}`;
}

export async function startTypewriterSession(requestedSessionId = '') {
  const sessionId = normalizeSessionId(requestedSessionId) || randomUUID();
  const existing = await NarrativeFragment.findOne({
    session_id: sessionId,
    turn: TYPEWRITER_FRAGMENT_TURN
  }).lean();

  if (existing) {
    return buildTypewriterSessionRecord(sessionId, existing);
  }

  await NarrativeFragment.create({
    session_id: sessionId,
    fragment: '',
    initialFragment: '',
    worldState: normalizeTypewriterWorldState(),
    typewriterTurns: [],
    lastTypewriterTurn: null,
    turn: TYPEWRITER_FRAGMENT_TURN
  });

  return buildTypewriterSessionRecord(sessionId, {
    fragment: '',
    initialFragment: ''
  });
}

export async function getTypewriterSessionFragment(sessionId) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) return '';

  const existing = await NarrativeFragment.findOne({
    session_id: safeSessionId,
    turn: TYPEWRITER_FRAGMENT_TURN
  }).lean();

  return normalizeFragmentText(existing?.fragment);
}

export async function getTypewriterSessionWorldState(sessionId) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) return normalizeTypewriterWorldState();

  const existing = await NarrativeFragment.findOne({
    session_id: safeSessionId,
    turn: TYPEWRITER_FRAGMENT_TURN
  }).lean();

  return normalizeTypewriterWorldState(existing?.worldState);
}

export async function saveTypewriterSessionFragment(sessionId, fragment, options = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) {
    const error = new Error('sessionId is required.');
    error.code = 'INVALID_SESSION_ID';
    throw error;
  }

  const {
    updateInitialFragment = false,
    worldState,
    typewriterTurn
  } = options || {};
  const safeFragment = normalizeFragmentText(fragment);
  const update = {
    $set: {
      fragment: safeFragment
    }
  };

  if (updateInitialFragment) {
    update.$set.initialFragment = safeFragment;
  } else {
    update.$setOnInsert = {
      initialFragment: ''
    };
    if (worldState === undefined) {
      update.$setOnInsert.worldState = normalizeTypewriterWorldState();
    }
    if (!typewriterTurn) {
      update.$setOnInsert.typewriterTurns = [];
      update.$setOnInsert.lastTypewriterTurn = null;
    }
  }

  if (worldState !== undefined) {
    update.$set.worldState = normalizeTypewriterWorldState(worldState);
  }

  if (typewriterTurn && typeof typewriterTurn === 'object') {
    update.$set.lastTypewriterTurn = typewriterTurn;
    update.$push = {
      typewriterTurns: {
        $each: [typewriterTurn],
        $slice: -TYPEWRITER_TURN_HISTORY_LIMIT
      }
    };
  }

  const doc = await NarrativeFragment.findOneAndUpdate(
    {
      session_id: safeSessionId,
      turn: TYPEWRITER_FRAGMENT_TURN
    },
    update,
    {
      new: true,
      upsert: true
    }
  );

  return buildTypewriterSessionRecord(safeSessionId, doc);
}

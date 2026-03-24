import { randomUUID } from 'crypto';
import { NarrativeFragment } from '../models/models.js';

const TYPEWRITER_FRAGMENT_TURN = 0;

function normalizeSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : '';
}

function normalizeFragmentText(fragment) {
  if (typeof fragment === 'string') return fragment;
  if (fragment === undefined || fragment === null) return '';
  return String(fragment);
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
    initialFragment: normalizeInitialFragment(doc)
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

export async function saveTypewriterSessionFragment(sessionId, fragment, options = {}) {
  const safeSessionId = normalizeSessionId(sessionId);
  if (!safeSessionId) {
    const error = new Error('sessionId is required.');
    error.code = 'INVALID_SESSION_ID';
    throw error;
  }

  const { updateInitialFragment = false } = options || {};
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

import mongoose from 'mongoose';
import { TypewriterKey } from '../models/models.js';

function normalizeString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeNullableObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value.trim())) {
    return new mongoose.Types.ObjectId(value.trim());
  }
  return null;
}

function normalizeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeTypewriterKeyDocument(rawKey = {}, options = {}) {
  const sourceKey = rawKey && typeof rawKey === 'object' ? rawKey : {};
  const sessionId = normalizeString(
    sourceKey.session_id || sourceKey.sessionId || options.sessionId,
    ''
  );
  const playerId = normalizeString(sourceKey.playerId || options.playerId, '');
  const keyText = normalizeString(sourceKey.keyText || options.keyText, '');
  const insertText = normalizeString(sourceKey.insertText || options.insertText || keyText, keyText);

  return {
    session_id: sessionId,
    sessionId,
    playerId,
    entityId: normalizeNullableObjectId(sourceKey.entityId || options.entityId),
    entityName: normalizeString(sourceKey.entityName || options.entityName, ''),
    keyText,
    insertText,
    description: normalizeString(sourceKey.description || options.description, ''),
    sourceType: normalizeString(sourceKey.sourceType || options.sourceType, 'unknown'),
    sourceRoute: normalizeString(sourceKey.sourceRoute || options.sourceRoute, ''),
    sourceStorytellerId: normalizeString(
      sourceKey.sourceStorytellerId || options.sourceStorytellerId,
      ''
    ),
    sourceStorytellerName: normalizeString(
      sourceKey.sourceStorytellerName || options.sourceStorytellerName,
      ''
    ),
    sourceStorytellerKeySlot: Number.isInteger(sourceKey.sourceStorytellerKeySlot)
      ? sourceKey.sourceStorytellerKeySlot
      : Number.isInteger(options.sourceStorytellerKeySlot)
        ? options.sourceStorytellerKeySlot
        : null,
    verificationKind: normalizeString(
      sourceKey.verificationKind || options.verificationKind,
      'typewriter_key_verification'
    ),
    activeInTypewriter: Boolean(sourceKey.activeInTypewriter ?? options.activeInTypewriter ?? true),
    textureUrl: normalizeString(
      sourceKey.textureUrl || options.textureUrl,
      '/textures/keys/blank_rect_horizontal_1.png'
    ),
    sortOrder: normalizeNumber(sourceKey.sortOrder ?? options.sortOrder, 100),
    timesPressed: normalizeNumber(sourceKey.timesPressed ?? options.timesPressed, 0),
    lastPressedAt: sourceKey.lastPressedAt || options.lastPressedAt || null
  };
}

function buildTypewriterKeyLookup(document, options = {}) {
  if (options.lookup && typeof options.lookup === 'object') {
    return { ...options.lookup };
  }

  const lookup = {
    session_id: document.session_id,
    playerId: document.playerId || '',
    keyText: document.keyText
  };

  if (document.sourceType) {
    lookup.sourceType = document.sourceType;
  }
  if (document.entityId) {
    lookup.entityId = document.entityId;
  }

  return lookup;
}

export async function upsertTypewriterKey(rawKey = {}, options = {}) {
  const document = normalizeTypewriterKeyDocument(rawKey, options);
  const lookup = buildTypewriterKeyLookup(document, options);
  return TypewriterKey.findOneAndUpdate(
    lookup,
    document,
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
}

export async function listTypewriterKeysForSession(sessionId, playerId = '') {
  if (!sessionId) return [];
  return TypewriterKey.find({
    session_id: sessionId,
    playerId,
    activeInTypewriter: true
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .exec();
}

export async function findTypewriterKeyForSession({
  sessionId,
  playerId = '',
  keyId = '',
  keyText = ''
}) {
  if (!sessionId) return null;

  const lookup = {
    session_id: sessionId,
    playerId,
    activeInTypewriter: true
  };

  if (typeof keyId === 'string' && keyId.trim() && mongoose.Types.ObjectId.isValid(keyId.trim())) {
    lookup._id = new mongoose.Types.ObjectId(keyId.trim());
    return TypewriterKey.findOne(lookup).exec();
  }

  const normalizedKeyText = normalizeString(keyText, '');
  if (!normalizedKeyText) {
    return null;
  }

  lookup.keyText = normalizedKeyText;
  return TypewriterKey.findOne(lookup).exec();
}

export function buildTypewriterKeyState(typewriterKey) {
  const description = normalizeString(typewriterKey?.description, '');
  return {
    id: String(typewriterKey?._id || ''),
    entityId: typewriterKey?.entityId ? String(typewriterKey.entityId) : '',
    entityName: normalizeString(typewriterKey?.entityName, ''),
    keyText: normalizeString(typewriterKey?.keyText, ''),
    insertText: normalizeString(typewriterKey?.insertText, ''),
    description,
    summary: description,
    sourceType: normalizeString(typewriterKey?.sourceType, ''),
    storytellerId: normalizeString(typewriterKey?.sourceStorytellerId, ''),
    storytellerName: normalizeString(typewriterKey?.sourceStorytellerName, ''),
    textureUrl: normalizeString(typewriterKey?.textureUrl, '/textures/keys/blank_rect_horizontal_1.png'),
    verificationKind: normalizeString(typewriterKey?.verificationKind, 'typewriter_key_verification'),
    sortOrder: normalizeNumber(typewriterKey?.sortOrder, 100),
    createdAt: typewriterKey?.createdAt || null
  };
}

export async function markTypewriterKeyPressed(typewriterKeyId) {
  if (!typewriterKeyId || !mongoose.Types.ObjectId.isValid(typewriterKeyId)) {
    return null;
  }
  return TypewriterKey.findByIdAndUpdate(
    typewriterKeyId,
    {
      $set: { lastPressedAt: new Date() },
      $inc: { timesPressed: 1 }
    },
    { new: true }
  ).exec();
}

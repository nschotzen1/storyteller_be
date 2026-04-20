import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_NARRATIVE_ENTITY_SEED_PATH = path.join(
  __dirname,
  '..',
  'seeds',
  'public_narrative_entities.json'
);

let publicNarrativeEntitySeedCache = null;

function loadPublicNarrativeEntitySeedFile() {
  if (publicNarrativeEntitySeedCache) {
    return publicNarrativeEntitySeedCache;
  }

  const raw = fs.readFileSync(PUBLIC_NARRATIVE_ENTITY_SEED_PATH, 'utf8');
  publicNarrativeEntitySeedCache = JSON.parse(raw);
  return publicNarrativeEntitySeedCache;
}

function normalizePublicEntitySeed(entity = {}, publicSessionId = '') {
  const seed = entity && typeof entity === 'object' ? entity : {};
  return {
    ...seed,
    session_id: seed.session_id || publicSessionId,
    sessionId: seed.sessionId || publicSessionId,
    playerId: seed.playerId || '',
    privacy: 'public'
  };
}

export function getPublicNarrativeEntitySessionId() {
  const seedFile = loadPublicNarrativeEntitySeedFile();
  return typeof seedFile.publicSessionId === 'string' && seedFile.publicSessionId.trim()
    ? seedFile.publicSessionId.trim()
    : '__public__';
}

export function listPublicNarrativeEntitySeeds() {
  const seedFile = loadPublicNarrativeEntitySeedFile();
  const publicSessionId = getPublicNarrativeEntitySessionId();
  return (Array.isArray(seedFile.entities) ? seedFile.entities : [])
    .map((entity) => normalizePublicEntitySeed(entity, publicSessionId))
    .filter((entity) => typeof entity.externalId === 'string' && entity.externalId.trim());
}

export function getPublicNarrativeEntitySeed(externalId = '') {
  const normalizedExternalId = typeof externalId === 'string' ? externalId.trim() : '';
  if (!normalizedExternalId) return null;
  return listPublicNarrativeEntitySeeds()
    .find((entity) => entity.externalId === normalizedExternalId) || null;
}

export function getPublicNarrativeEntityMockInspectionSignals(externalId = '') {
  const seed = getPublicNarrativeEntitySeed(externalId);
  const signals = seed?.mockInspectionSignals && typeof seed.mockInspectionSignals === 'object'
    ? seed.mockInspectionSignals
    : {};
  return {
    canine: Array.isArray(signals.canine) ? signals.canine.filter(Boolean) : [],
    undead: Array.isArray(signals.undead) ? signals.undead.filter(Boolean) : []
  };
}

export async function upsertPublicNarrativeEntitySeeds(upsertNarrativeEntity) {
  if (typeof upsertNarrativeEntity !== 'function') {
    throw new Error('upsertPublicNarrativeEntitySeeds requires an upsertNarrativeEntity function.');
  }

  const publicSessionId = getPublicNarrativeEntitySessionId();
  const results = [];

  for (const seed of listPublicNarrativeEntitySeeds()) {
    const savedEntity = await upsertNarrativeEntity(seed, {
      sessionId: publicSessionId,
      playerId: '',
      privacy: 'public',
      source: seed.source || 'public_narrative_entity_seed',
      sourceRoute: seed.sourceRoute || 'seeds/public_narrative_entities.json',
      lookup: {
        privacy: 'public',
        externalId: seed.externalId
      }
    });
    results.push(savedEntity);
  }

  return results;
}

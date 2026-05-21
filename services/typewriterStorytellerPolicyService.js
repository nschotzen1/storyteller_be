import fs from 'fs/promises';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { TypewriterStorytellerPolicy } from '../models/models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const POLICY_CONFIG_PATH = process.env.TYPEWRITER_STORYTELLER_POLICY_PATH
  || path.join(CONFIG_DIR, 'typewriter_storyteller_policy.json');
const STORYTELLER_POLICY_KEY = 'default';

const DEFAULT_SUBSTANCE_BUDGET = Object.freeze({
  maxNewEntities: 1,
  minReusedEntities: 1,
  requireConcreteNaming: true,
  allowNewPlace: true,
  allowNewPerson: true,
  allowNewItem: true,
  allowMajorPlotChange: false
});

const DEFAULT_STAGES = Object.freeze([
  {
    id: 'signature',
    label: 'Signature Entry',
    pressNumber: 1,
    proximity: 'distant',
    narrativeAuthority: 'additive',
    firstPersonAllowed: false,
    currentSceneInterventionAllowed: false,
    outputWordMin: 45,
    outputWordMax: 80,
    instruction:
      'Let the storyteller join as a style and sensibility. Add concrete narrative substance without making the storyteller an embodied first-person actor.'
  },
  {
    id: 'pattern',
    label: 'Pattern Building',
    pressNumber: 2,
    proximity: 'aware',
    narrativeAuthority: 'interpretive',
    firstPersonAllowed: false,
    currentSceneInterventionAllowed: false,
    outputWordMin: 55,
    outputWordMax: 90,
    instruction:
      'Connect the new substance to prior details. Reveal pattern, pressure, routes, customs, or hidden relations without taking over the present scene.'
  },
  {
    id: 'witness',
    label: 'Witness Nearing',
    pressNumber: 3,
    proximity: 'witness',
    narrativeAuthority: 'witness',
    firstPersonAllowed: true,
    currentSceneInterventionAllowed: false,
    outputWordMin: 60,
    outputWordMax: 95,
    instruction:
      'Allow a restrained first-person trace. The storyteller may remember, observe, or admit proximity, but should not physically change the current scene yet.'
  },
  {
    id: 'intervention',
    label: 'Current Intervention',
    pressNumber: 4,
    proximity: 'present',
    narrativeAuthority: 'interventionist',
    firstPersonAllowed: true,
    currentSceneInterventionAllowed: true,
    outputWordMin: 65,
    outputWordMax: 105,
    instruction:
      'The storyteller is close enough to act in the current scene. Let them interrupt, reveal, redirect, or touch the present action in one focused way.'
  }
]);

const DEFAULT_ARCHETYPES = Object.freeze([
  {
    id: 'cartographer',
    label: 'The Cartographer',
    style: 'precise, spatial, archival',
    narrativeRole: 'maps routes, borders, thresholds, and forgotten jurisdictions',
    substanceBias: ['places', 'routes', 'landmarks', 'old borders'],
    interventionStyle: 'reveals a hidden spatial relation'
  },
  {
    id: 'witness',
    label: 'The Witness',
    style: 'intimate, restrained, sensory',
    narrativeRole: 'notices people, gestures, secrets, and the cost of being seen',
    substanceBias: ['people', 'gestures', 'rumors', 'social debts'],
    interventionStyle: 'names what someone in the scene tried not to show'
  },
  {
    id: 'archivist',
    label: 'The Archivist',
    style: 'textured, historical, exacting',
    narrativeRole: 'carries records of old events, artifacts, institutions, and forbidden precedents',
    substanceBias: ['events', 'items', 'institutions', 'old names'],
    interventionStyle: 'produces a remembered fact that makes the present dangerous'
  }
]);

export const DEFAULT_TYPEWRITER_STORYTELLER_POLICY = Object.freeze({
  version: 1,
  keyEmergence: {
    checkIntervalWords: 5,
    wordThresholds: [30, 50, 100]
  },
  progression: {
    mode: 'per_storyteller',
    repressGrowthFactor: 1.1,
    stages: DEFAULT_STAGES
  },
  substanceBudget: DEFAULT_SUBSTANCE_BUDGET,
  archetypes: DEFAULT_ARCHETYPES
});

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function normalizeNumber(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeWordThresholds(value, fallback) {
  const thresholds = Array.isArray(value) ? value : fallback;
  return thresholds
    .map((entry) => normalizeInteger(entry, 0, { min: 1, max: 100000 }))
    .filter((entry) => entry > 0)
    .sort((left, right) => left - right);
}

function normalizeSubstanceBudget(value = {}, fallback = DEFAULT_SUBSTANCE_BUDGET) {
  const source = isPlainObject(value) ? value : {};
  return {
    maxNewEntities: normalizeInteger(source.maxNewEntities, fallback.maxNewEntities, { min: 0, max: 5 }),
    minReusedEntities: normalizeInteger(source.minReusedEntities, fallback.minReusedEntities, { min: 0, max: 5 }),
    requireConcreteNaming: Boolean(source.requireConcreteNaming ?? fallback.requireConcreteNaming),
    allowNewPlace: Boolean(source.allowNewPlace ?? fallback.allowNewPlace),
    allowNewPerson: Boolean(source.allowNewPerson ?? fallback.allowNewPerson),
    allowNewItem: Boolean(source.allowNewItem ?? fallback.allowNewItem),
    allowMajorPlotChange: Boolean(source.allowMajorPlotChange ?? fallback.allowMajorPlotChange)
  };
}

function normalizeStage(stage = {}, index = 0) {
  const fallback = DEFAULT_STAGES[index] || DEFAULT_STAGES[DEFAULT_STAGES.length - 1];
  const outputWordMin = normalizeInteger(stage.outputWordMin, fallback.outputWordMin, { min: 20, max: 240 });
  const outputWordMax = normalizeInteger(stage.outputWordMax, fallback.outputWordMax, {
    min: Math.max(outputWordMin, 20),
    max: 280
  });
  return {
    id: firstString(stage.id, fallback.id, `stage_${index + 1}`),
    label: firstString(stage.label, fallback.label, `Stage ${index + 1}`),
    pressNumber: normalizeInteger(stage.pressNumber, fallback.pressNumber || index + 1, { min: 1, max: 20 }),
    proximity: firstString(stage.proximity, fallback.proximity, 'distant'),
    narrativeAuthority: firstString(stage.narrativeAuthority, fallback.narrativeAuthority, 'additive'),
    firstPersonAllowed: Boolean(stage.firstPersonAllowed ?? fallback.firstPersonAllowed),
    currentSceneInterventionAllowed: Boolean(
      stage.currentSceneInterventionAllowed ?? fallback.currentSceneInterventionAllowed
    ),
    outputWordMin,
    outputWordMax,
    instruction: firstString(stage.instruction, fallback.instruction),
    substanceBudget: isPlainObject(stage.substanceBudget)
      ? normalizeSubstanceBudget(stage.substanceBudget)
      : null
  };
}

function normalizeArchetype(archetype = {}, index = 0) {
  const fallback = DEFAULT_ARCHETYPES[index % DEFAULT_ARCHETYPES.length];
  return {
    id: firstString(archetype.id, fallback.id, `archetype_${index + 1}`),
    label: firstString(archetype.label, fallback.label, `Storyteller ${index + 1}`),
    style: firstString(archetype.style, fallback.style),
    narrativeRole: firstString(archetype.narrativeRole, fallback.narrativeRole),
    substanceBias: normalizeStringArray(archetype.substanceBias, fallback.substanceBias),
    interventionStyle: firstString(archetype.interventionStyle, fallback.interventionStyle)
  };
}

export function normalizeTypewriterStorytellerPolicyConfig(config = {}) {
  const source = isPlainObject(config) ? config : {};
  const keyEmergence = isPlainObject(source.keyEmergence) ? source.keyEmergence : {};
  const progression = isPlainObject(source.progression) ? source.progression : {};
  const configuredStages = Array.isArray(progression.stages) && progression.stages.length
    ? progression.stages
    : DEFAULT_STAGES;
  const configuredArchetypes = Array.isArray(source.archetypes) && source.archetypes.length
    ? source.archetypes
    : DEFAULT_ARCHETYPES;
  const substanceBudget = normalizeSubstanceBudget(source.substanceBudget);

  return {
    version: normalizeInteger(source.version, DEFAULT_TYPEWRITER_STORYTELLER_POLICY.version, { min: 1, max: 100000 }),
    keyEmergence: {
      checkIntervalWords: normalizeInteger(
        keyEmergence.checkIntervalWords,
        DEFAULT_TYPEWRITER_STORYTELLER_POLICY.keyEmergence.checkIntervalWords,
        { min: 1, max: 200 }
      ),
      wordThresholds: normalizeWordThresholds(
        keyEmergence.wordThresholds,
        DEFAULT_TYPEWRITER_STORYTELLER_POLICY.keyEmergence.wordThresholds
      )
    },
    progression: {
      mode: firstString(progression.mode, DEFAULT_TYPEWRITER_STORYTELLER_POLICY.progression.mode),
      repressGrowthFactor: normalizeNumber(
        progression.repressGrowthFactor,
        DEFAULT_TYPEWRITER_STORYTELLER_POLICY.progression.repressGrowthFactor,
        { min: 1, max: 3 }
      ),
      stages: configuredStages.map(normalizeStage)
    },
    substanceBudget,
    archetypes: configuredArchetypes.map(normalizeArchetype)
  };
}

export async function loadTypewriterStorytellerPolicyConfig() {
  if (mongoose.connection.readyState === 1) {
    const policyDoc = await TypewriterStorytellerPolicy.findOne({
      key: STORYTELLER_POLICY_KEY,
      isLatest: true
    })
      .sort({ version: -1, createdAt: -1 })
      .lean();
    if (policyDoc?.policy) {
      return normalizeTypewriterStorytellerPolicyConfig(policyDoc.policy);
    }
  }

  try {
    const raw = await fs.readFile(POLICY_CONFIG_PATH, 'utf8');
    const normalized = normalizeTypewriterStorytellerPolicyConfig(JSON.parse(raw));
    if (mongoose.connection.readyState === 1) {
      await saveTypewriterStorytellerPolicyConfig(normalized, {
        updatedBy: 'file-migration',
        meta: { source: POLICY_CONFIG_PATH }
      });
    }
    return normalized;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return normalizeTypewriterStorytellerPolicyConfig(DEFAULT_TYPEWRITER_STORYTELLER_POLICY);
    }
    throw error;
  }
}

export async function saveTypewriterStorytellerPolicyConfig(config = {}, options = {}) {
  const normalized = normalizeTypewriterStorytellerPolicyConfig(config);
  if (mongoose.connection.readyState === 1) {
    const latest = await TypewriterStorytellerPolicy.findOne({ key: STORYTELLER_POLICY_KEY })
      .sort({ version: -1 })
      .lean();
    const nextVersion = Math.max(Number(latest?.version) || 0, 0) + 1;
    await TypewriterStorytellerPolicy.updateMany(
      { key: STORYTELLER_POLICY_KEY, isLatest: true },
      { $set: { isLatest: false } }
    );
    await TypewriterStorytellerPolicy.create({
      key: STORYTELLER_POLICY_KEY,
      version: nextVersion,
      policy: normalized,
      isLatest: true,
      createdBy: firstString(options.updatedBy, options.createdBy, 'admin'),
      meta: options.meta || {}
    });
    return normalized;
  }

  await fs.mkdir(path.dirname(POLICY_CONFIG_PATH), { recursive: true });
  await fs.writeFile(POLICY_CONFIG_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export function getTypewriterStorytellerCheckIntervalWords(config = DEFAULT_TYPEWRITER_STORYTELLER_POLICY) {
  const normalized = normalizeTypewriterStorytellerPolicyConfig(config);
  return normalized.keyEmergence.checkIntervalWords;
}

export function getTypewriterStorytellerWordThresholds(config = DEFAULT_TYPEWRITER_STORYTELLER_POLICY) {
  const normalized = normalizeTypewriterStorytellerPolicyConfig(config);
  return normalized.keyEmergence.wordThresholds;
}

export function getTypewriterStorytellerRepressGrowthFactor(config = DEFAULT_TYPEWRITER_STORYTELLER_POLICY) {
  const normalized = normalizeTypewriterStorytellerPolicyConfig(config);
  return normalized.progression.repressGrowthFactor;
}

export function getTypewriterStorytellerArchetypeForSlot(slotIndex = 0, config = DEFAULT_TYPEWRITER_STORYTELLER_POLICY) {
  const normalized = normalizeTypewriterStorytellerPolicyConfig(config);
  const archetypes = normalized.archetypes.length ? normalized.archetypes : DEFAULT_ARCHETYPES;
  const safeIndex = Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : 0;
  return archetypes[safeIndex % archetypes.length];
}

export function buildStorytellerArchetypeState(archetype = {}) {
  const normalized = normalizeArchetype(archetype);
  return {
    id: normalized.id,
    label: normalized.label,
    style: normalized.style,
    narrativeRole: normalized.narrativeRole,
    substanceBias: normalized.substanceBias,
    interventionStyle: normalized.interventionStyle
  };
}

export function resolveTypewriterStorytellerPressPolicy(
  storyteller = {},
  config = DEFAULT_TYPEWRITER_STORYTELLER_POLICY
) {
  const normalized = normalizeTypewriterStorytellerPolicyConfig(config);
  const pressCount = normalizeInteger(storyteller?.typewriterInterventionsCount, 0, { min: 0, max: 1000 });
  const pressNumber = pressCount + 1;
  const stages = normalized.progression.stages.length ? normalized.progression.stages : DEFAULT_STAGES;
  const stageIndex = Math.min(pressNumber - 1, stages.length - 1);
  const stage = stages[stageIndex];
  const slotArchetype = getTypewriterStorytellerArchetypeForSlot(Number(storyteller?.keySlotIndex) || 0, normalized);
  const archetype = isPlainObject(storyteller?.typewriterArchetype)
    ? normalizeArchetype(storyteller.typewriterArchetype, Number(storyteller?.keySlotIndex) || 0)
    : {
        ...slotArchetype,
        id: firstString(storyteller?.typewriterArchetypeId) || slotArchetype.id,
        label: firstString(storyteller?.typewriterArchetypeLabel) || slotArchetype.label
      };
  const budget = normalizeSubstanceBudget(stage.substanceBudget || normalized.substanceBudget);

  return {
    configVersion: normalized.version,
    mode: normalized.progression.mode,
    pressCount,
    pressNumber,
    stageIndex,
    stageId: stage.id,
    stageLabel: stage.label,
    proximity: stage.proximity,
    narrativeAuthority: stage.narrativeAuthority,
    firstPersonAllowed: stage.firstPersonAllowed,
    currentSceneInterventionAllowed: stage.currentSceneInterventionAllowed,
    outputWordMin: stage.outputWordMin,
    outputWordMax: stage.outputWordMax,
    stageInstruction: stage.instruction,
    substanceBudget: budget,
    archetype: buildStorytellerArchetypeState(archetype)
  };
}

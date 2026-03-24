import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const WELL_SCENE_CONFIG_PATH = process.env.WELL_SCENE_CONFIG_PATH
  || path.join(CONFIG_DIR, 'well_scene_config.json');

const DEFAULT_FRAGMENT_LINES = [
  'It was almost night as she',
  'Nothing could prepare them for such weather',
  'Elionda was observing herself in the golden embroidered mirror',
  'The house remembered every vow spoken under rain',
  'Someone had written the answer before the question existed',
  'When the bell failed, the birds continued the ceremony',
  'No one noticed the garden leaning closer to hear',
  'By dawn the map had changed its mind again',
  'She kept the key because the lock still dreamed of it',
  'The sea withdrew only long enough to listen'
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const buildDefaultTextualBank = () => DEFAULT_FRAGMENT_LINES.map((text, index) => ({
  id: `txt_${index + 1}`,
  text,
  weight: 1,
  tags: []
}));

const DEFAULT_WELL_SCENE_CONFIG = Object.freeze({
  component: {
    backgroundSrc: '/well/well_background.png',
    wordLimit: 10,
    promptDelayMs: 5200,
    fragmentSpawnMs: 2200,
    fragmentLifetimeMs: 7600,
    departureDurationMs: 3600,
    promptDock: 'side'
  },
  copy: {
    sceneEyebrow: 'Direct Debug View',
    sceneTitle: 'Well of Fragments',
    promptLabel: 'What words do you remember?',
    promptHint: 'Jot down what you caught before the well swallows it again.',
    promptPlaceholder: 'A remembered line, name, or place...',
    departureStatus: 'The falcon folds the gathered bundle into its satchel and rises toward the dovecot.',
    footerWaiting: 'The well waits for the next line to surface.',
    footerReadyPrefix: 'Gathered so far:',
    footerLatestPrefix: 'Latest fragment:',
    footerLastSubmittedPrefix: 'Latest jot:',
    handoffLabel: 'Hand the bundle to the falcon',
    impatienceStatus: 'The falcon grows impatient. It wants the gathered bundle now.',
    observingHint: 'A scrap hangs in the water. Catch it before it slips your memory.',
    jotActionLabel: 'Jot this scrap'
  },
  completion: {
    required: {
      textual: 3
    }
  },
  runtime: {
    sourceMode: 'bank'
  },
  banks: {
    textual: buildDefaultTextualBank()
  },
  fragments: DEFAULT_FRAGMENT_LINES,
  updatedAt: '',
  updatedBy: ''
});

const WELL_SCENE_CONFIG_META = Object.freeze({
  routes: {
    publicConfig: '/api/well/config',
    adminConfig: '/api/admin/well/config',
    adminReset: '/api/admin/well/config/reset'
  },
  consumers: [
    {
      label: 'Standalone editor',
      route: '/?view=well'
    },
    {
      label: 'Rose Court prologue',
      questId: 'rose_court_prologue_phase_1',
      screenId: 'inner_court_well'
    }
  ]
});

const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const clampNumber = (value, fallback, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(Math.max(min, Math.round(numeric)), max);
};

const normalizeString = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.trim() ? value : fallback;
};

const normalizeCopyString = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  return value.length ? value : fallback;
};

const normalizeTags = (value = []) => (
  Array.isArray(value)
    ? value.map((entry) => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
    : []
);

export function normalizeTextualBankEntry(value, index = 0) {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    return {
      id: `txt_${index + 1}`,
      text,
      weight: 1,
      tags: []
    };
  }

  if (!value || typeof value !== 'object') return null;

  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!text) return null;

  return {
    id: normalizeString(value.id, `txt_${index + 1}`),
    text,
    weight: clampNumber(value.weight, 1, 1, 10),
    tags: normalizeTags(value.tags)
  };
}

export function normalizeTextualBank(value = [], fallbackBank = buildDefaultTextualBank()) {
  const source = Array.isArray(value) ? value : [];
  const normalized = source
    .map((entry, index) => normalizeTextualBankEntry(entry, index))
    .filter(Boolean);
  return normalized.length ? normalized : clone(fallbackBank);
}

export function getWellTextualBank(config = {}) {
  const source = asObject(config);
  const legacyFragments = Array.isArray(source.fragments) ? source.fragments : [];
  const fallbackBank = legacyFragments.length
    ? legacyFragments.map((entry, index) => normalizeTextualBankEntry(entry, index)).filter(Boolean)
    : buildDefaultTextualBank();
  return normalizeTextualBank(source?.banks?.textual, fallbackBank);
}

export function normalizeWellSceneConfig(value = {}) {
  const source = asObject(value);
  const component = asObject(source.component);
  const copy = asObject(source.copy);
  const completion = asObject(source.completion);
  const required = asObject(completion.required);
  const runtime = asObject(source.runtime);
  const textualBank = getWellTextualBank(source);
  const textualLines = textualBank.map((entry) => entry.text);

  return {
    component: {
      backgroundSrc: normalizeString(
        component.backgroundSrc,
        DEFAULT_WELL_SCENE_CONFIG.component.backgroundSrc
      ),
      wordLimit: clampNumber(
        component.wordLimit,
        DEFAULT_WELL_SCENE_CONFIG.component.wordLimit,
        1,
        30
      ),
      promptDelayMs: clampNumber(
        component.promptDelayMs,
        DEFAULT_WELL_SCENE_CONFIG.component.promptDelayMs,
        0,
        30000
      ),
      fragmentSpawnMs: clampNumber(
        component.fragmentSpawnMs,
        DEFAULT_WELL_SCENE_CONFIG.component.fragmentSpawnMs,
        200,
        30000
      ),
      fragmentLifetimeMs: clampNumber(
        component.fragmentLifetimeMs,
        DEFAULT_WELL_SCENE_CONFIG.component.fragmentLifetimeMs,
        800,
        45000
      ),
      departureDurationMs: clampNumber(
        component.departureDurationMs,
        DEFAULT_WELL_SCENE_CONFIG.component.departureDurationMs,
        600,
        30000
      ),
      promptDock: component.promptDock === 'bottom' ? 'bottom' : DEFAULT_WELL_SCENE_CONFIG.component.promptDock
    },
    copy: {
      sceneEyebrow: normalizeCopyString(
        copy.sceneEyebrow,
        DEFAULT_WELL_SCENE_CONFIG.copy.sceneEyebrow
      ),
      sceneTitle: normalizeCopyString(
        copy.sceneTitle,
        DEFAULT_WELL_SCENE_CONFIG.copy.sceneTitle
      ),
      promptLabel: normalizeCopyString(
        copy.promptLabel,
        DEFAULT_WELL_SCENE_CONFIG.copy.promptLabel
      ),
      promptHint: normalizeCopyString(
        copy.promptHint,
        DEFAULT_WELL_SCENE_CONFIG.copy.promptHint
      ),
      promptPlaceholder: normalizeCopyString(
        copy.promptPlaceholder,
        DEFAULT_WELL_SCENE_CONFIG.copy.promptPlaceholder
      ),
      departureStatus: normalizeCopyString(
        copy.departureStatus,
        DEFAULT_WELL_SCENE_CONFIG.copy.departureStatus
      ),
      footerWaiting: normalizeCopyString(
        copy.footerWaiting,
        DEFAULT_WELL_SCENE_CONFIG.copy.footerWaiting
      ),
      footerReadyPrefix: normalizeCopyString(
        copy.footerReadyPrefix,
        DEFAULT_WELL_SCENE_CONFIG.copy.footerReadyPrefix
      ),
      footerLatestPrefix: normalizeCopyString(
        copy.footerLatestPrefix,
        DEFAULT_WELL_SCENE_CONFIG.copy.footerLatestPrefix
      ),
      footerLastSubmittedPrefix: normalizeCopyString(
        copy.footerLastSubmittedPrefix,
        DEFAULT_WELL_SCENE_CONFIG.copy.footerLastSubmittedPrefix
      ),
      handoffLabel: normalizeCopyString(
        copy.handoffLabel,
        DEFAULT_WELL_SCENE_CONFIG.copy.handoffLabel
      ),
      impatienceStatus: normalizeCopyString(
        copy.impatienceStatus,
        DEFAULT_WELL_SCENE_CONFIG.copy.impatienceStatus
      ),
      observingHint: normalizeCopyString(
        copy.observingHint,
        DEFAULT_WELL_SCENE_CONFIG.copy.observingHint
      ),
      jotActionLabel: normalizeCopyString(
        copy.jotActionLabel,
        DEFAULT_WELL_SCENE_CONFIG.copy.jotActionLabel
      )
    },
    completion: {
      required: {
        textual: clampNumber(
          required.textual,
          DEFAULT_WELL_SCENE_CONFIG.completion.required.textual,
          1,
          12
        )
      }
    },
    runtime: {
      sourceMode: runtime.sourceMode === 'hybrid' ? 'hybrid' : DEFAULT_WELL_SCENE_CONFIG.runtime.sourceMode
    },
    banks: {
      textual: textualBank
    },
    fragments: textualLines,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : ''
  };
}

async function readWellSceneConfigFile() {
  try {
    const raw = await fs.readFile(WELL_SCENE_CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return clone(DEFAULT_WELL_SCENE_CONFIG);
    }
    throw error;
  }
}

async function writeWellSceneConfigFile(config) {
  await fs.mkdir(path.dirname(WELL_SCENE_CONFIG_PATH), { recursive: true });
  await fs.writeFile(WELL_SCENE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export async function loadWellSceneConfig() {
  const stored = await readWellSceneConfigFile();
  return normalizeWellSceneConfig(stored);
}

export async function saveWellSceneConfig(config = {}, updatedBy = 'admin') {
  const normalized = normalizeWellSceneConfig(config);
  const nextConfig = {
    ...normalized,
    updatedAt: new Date().toISOString(),
    updatedBy: typeof updatedBy === 'string' && updatedBy.trim() ? updatedBy.trim() : 'admin'
  };
  await writeWellSceneConfigFile(nextConfig);
  return nextConfig;
}

export async function resetWellSceneConfig(updatedBy = 'admin') {
  return saveWellSceneConfig(DEFAULT_WELL_SCENE_CONFIG, updatedBy);
}

export function getWellSceneConfigMeta() {
  return clone(WELL_SCENE_CONFIG_META);
}

export function getDefaultWellSceneConfig() {
  return clone(DEFAULT_WELL_SCENE_CONFIG);
}

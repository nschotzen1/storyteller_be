import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const THORBATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'thorbata');

const ajv = new Ajv({ allErrors: true });

const BIBLE_SCHEMA = {
  type: 'object',
  required: ['chronicle', 'book', 'characters', 'locations', 'organizations', 'fixedEvents', 'forbiddenClaims'],
  properties: {
    chronicle: { type: 'string' },
    characters: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'description'],
        properties: { id: { type: 'string' }, locked: { type: 'boolean' } }
      }
    },
    forbiddenClaims: {
      type: 'array',
      items: { type: 'object', required: ['id', 'pattern', 'note'] }
    }
  }
};

const CHAPTER_SCHEMA = {
  type: 'object',
  required: ['chapterId', 'title', 'softLimit', 'routeCondition', 'cells'],
  properties: {
    routeCondition: {
      type: 'object',
      required: ['requiredRestored', 'playerLinkAmong']
    },
    cells: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'label', 'text', 'links', 'gmHooks'],
        properties: {
          links: {
            type: 'array',
            items: { type: 'object', required: ['toCellId', 'predicate'] }
          }
        }
      }
    }
  }
};

const validateBible = ajv.compile(BIBLE_SCHEMA);
const validateChapter = ajv.compile(CHAPTER_SCHEMA);

let cache = null;

async function readJson(fileName) {
  const raw = await readFile(path.join(THORBATA_DIR, fileName), 'utf8');
  return JSON.parse(raw);
}

function assertValid(validator, data, label) {
  if (!validator(data)) {
    const detail = (validator.errors || []).map((e) => `${e.instancePath} ${e.message}`).join('; ');
    throw new Error(`Invalid ${label}: ${detail}`);
  }
}

function assertLinkTargetsExist(chapter) {
  const ids = new Set(chapter.cells.map((c) => c.id));
  for (const cell of chapter.cells) {
    for (const link of cell.links) {
      if (!ids.has(link.toCellId)) {
        throw new Error(`Cell ${cell.id} links to unknown cell ${link.toCellId}`);
      }
    }
  }
}

export async function loadThorbataBible() {
  if (cache) return cache;
  const [bible, chapter] = await Promise.all([
    readJson('bible.json'),
    readJson('act3_chapter_eel_and_seagull.json')
  ]);
  assertValid(validateBible, bible, 'thorbata bible');
  assertValid(validateChapter, chapter, 'thorbata chapter');
  assertLinkTargetsExist(chapter);
  cache = { bible, chapter };
  return cache;
}

export function buildInitialCells(chapter) {
  return chapter.cells.map((cell) => ({
    id: cell.id,
    label: cell.label,
    state: 'damaged',
    text: cell.text,
    playerContributions: [],
    links: cell.links.map((link) => ({ ...link, createdBy: 'author' })),
    gmHooks: { ...cell.gmHooks }
  }));
}

export function buildCanonLocks(bible) {
  return {
    characters: bible.characters.filter((c) => c.locked).map((c) => c.id),
    locations: bible.locations.filter((l) => l.locked).map((l) => l.id),
    fixedEvents: bible.fixedEvents.map((e) => ({ id: e.id, text: e.text })),
    forbiddenClaims: bible.forbiddenClaims.map((f) => ({ id: f.id, pattern: f.pattern, note: f.note }))
  };
}

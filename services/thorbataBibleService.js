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

const RITUAL_SCHEMA = {
  type: 'object',
  required: ['ritualId', 'beats'],
  properties: {
    ritualId: { type: 'string', minLength: 1 },
    beats: {
      type: 'array',
      minItems: 3,
      items: {
        type: 'object',
        required: ['id', 'kind'],
        properties: {
          id: { type: 'string', minLength: 1 },
          kind: { type: 'string', enum: ['message', 'question', 'act_transition'] },
          intent: { type: 'string' },
          fallbackText: { type: 'string' },
          text: { type: 'string' },
          factKey: { type: ['string', 'null'] },
          allowFreeText: { type: 'boolean' },
          toAct: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'label'],
              properties: {
                id: { type: 'string', minLength: 1 },
                label: { type: 'string', minLength: 1 },
                factValue: { type: 'string', minLength: 1 }
              }
            }
          },
          writeEvidence: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'reliability', 'textTemplate'],
              properties: {
                source: { type: 'string', enum: ['damaged_page', 'society_note', 'field_report', 'player_restoration', 'marginalia'] },
                reliability: { type: 'string', enum: ['confirmed', 'suspect', 'contradicted'] },
                textTemplate: { type: 'string', minLength: 1 }
              }
            }
          }
        }
      }
    }
  }
};

const validateBible = ajv.compile(BIBLE_SCHEMA);
const validateChapter = ajv.compile(CHAPTER_SCHEMA);
const validateRitual = ajv.compile(RITUAL_SCHEMA);

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

const RECOVERED_FACT_KEYS = new Set(['pageCount', 'heroStance', 'chapterTitle', 'tavernDish', 'writingPlace']);

function assertRitualIntegrity(ritual) {
  const seenIds = new Set();
  for (const beat of ritual.beats) {
    if (seenIds.has(beat.id)) throw new Error(`Duplicate ritual beat id: ${beat.id}`);
    seenIds.add(beat.id);
    if (beat.kind === 'message' && (!beat.intent?.trim() || !beat.fallbackText?.trim())) {
      throw new Error(`Message beat ${beat.id} requires intent and fallbackText`);
    }
    if (beat.kind === 'question') {
      if (!beat.text?.trim()) throw new Error(`Question beat ${beat.id} requires text`);
      if (!Array.isArray(beat.options) || beat.options.length < 2 || beat.options.length > 4) {
        throw new Error(`Question beat ${beat.id} requires 2-4 options`);
      }
      if (beat.factKey) {
        if (!RECOVERED_FACT_KEYS.has(beat.factKey)) {
          throw new Error(`Question beat ${beat.id} writes unknown fact: ${beat.factKey}`);
        }
        for (const option of beat.options) {
          if (!option.factValue?.trim()) {
            throw new Error(`Question beat ${beat.id} option ${option.id} requires factValue`);
          }
        }
      }
    }
    if (beat.kind === 'act_transition' && beat.toAct !== 'ARRIVAL_SCENE') {
      throw new Error(`Act transition beat ${beat.id} must target ARRIVAL_SCENE, got: ${beat.toAct}`);
    }
  }
  const last = ritual.beats[ritual.beats.length - 1];
  if (last.kind !== 'act_transition') throw new Error('Ritual must end on an act_transition beat');
}

function assertForbiddenClaimsCompile(bible) {
  for (const claim of bible.forbiddenClaims) {
    try {
      new RegExp(claim.pattern, 'i');
    } catch (error) {
      throw new Error(`Forbidden claim ${claim.id} has an uncompilable pattern: ${error.message}`);
    }
  }
}

export async function loadThorbataBible() {
  if (cache) return cache;
  const [bible, chapter, ritual] = await Promise.all([
    readJson('bible.json'),
    readJson('act3_chapter_eel_and_seagull.json'),
    readJson('act1_ritual.json')
  ]);
  assertValid(validateBible, bible, 'thorbata bible');
  assertValid(validateChapter, chapter, 'thorbata chapter');
  assertValid(validateRitual, ritual, 'thorbata act 1 ritual');
  assertLinkTargetsExist(chapter);
  assertRitualIntegrity(ritual);
  assertForbiddenClaimsCompile(bible);
  cache = { bible, chapter, ritual };
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

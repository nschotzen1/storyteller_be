import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const OVERRIDES_PATH = path.join(CONFIG_DIR, 'llm_route_overrides.json');

const ajv = new Ajv({ allErrors: true, strict: false });
const validatorCache = new Map();

const DEFAULT_ROUTE_CONFIGS = {
  worlds_create: {
    routeKey: 'worlds_create',
    routePath: '/api/worlds',
    method: 'POST',
    description: 'Create a world from a seed fragment.',
    promptTemplate: `You are a worldbuilding designer. Return JSON only.
Create a setting for a cooperative narrative game.
Seed: "{{seedText}}"
World name hint: "{{name}}"
Return JSON with keys:
name, summary (1-2 sentences), tone (3-6 words), pillars (3-5), themes (3-5), palette (3-5 evocative color or texture phrases).`,
    responseSchema: {
      type: 'object',
      required: ['name', 'summary'],
      properties: {
        name: { type: 'string', minLength: 1 },
        summary: { type: 'string', minLength: 1 },
        tone: { type: 'string' },
        pillars: { type: 'array', items: { type: 'string' } },
        themes: { type: 'array', items: { type: 'string' } },
        palette: { type: 'array', items: { type: 'string' } }
      },
      additionalProperties: true
    }
  },
  worlds_elements: {
    routeKey: 'worlds_elements',
    routePath: '/api/worlds/:worldId/(factions|locations|rumors|lore)',
    method: 'POST',
    description: 'Generate world elements for a world.',
    promptTemplate: `You are a worldbuilding designer. Return JSON only.
World name: "{{worldName}}"
World tone: "{{worldTone}}"
World summary: "{{worldSummary}}"
Seed: "{{seedText}}"
Element type: "{{elementType}}"
Generate {{count}} entries.
Return JSON object with key "elements". Each item should include:
name, description, tags (array), traits (array), hooks (array).`,
    responseSchema: {
      type: 'object',
      required: ['elements'],
      properties: {
        elements: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name', 'description'],
            properties: {
              name: { type: 'string', minLength: 1 },
              description: { type: 'string', minLength: 1 },
              tags: { type: 'array', items: { type: 'string' } },
              traits: { type: 'array', items: { type: 'string' } },
              hooks: { type: 'array', items: { type: 'string' } }
            },
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
    }
  },
  text_to_storyteller: {
    routeKey: 'text_to_storyteller',
    routePath: '/api/textToStoryteller',
    method: 'POST',
    description: 'Generate storyteller personas from a fragment.',
    promptTemplate: `You are the keeper of the Storyteller Society.
Summon {{storytellerCount}} distinct storytellers for this fragment:
"{{fragmentText}}"

Return JSON object with key "storytellers" containing {{storytellerCount}} entries.
Each storyteller must include:
- name
- immediate_ghost_appearance
- typewriter_key { symbol, description }
- influences (array)
- known_universes (array)
- level (1-20)
- voice_creation { voice, age, style }

Output JSON only.`,
    responseSchema: {
      type: 'object',
      required: ['storytellers'],
      properties: {
        storytellers: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1 },
              immediate_ghost_appearance: { type: 'string' },
              typewriter_key: {
                type: 'object',
                properties: {
                  symbol: { type: 'string' },
                  description: { type: 'string' }
                },
                additionalProperties: true
              },
              influences: { type: 'array', items: { type: 'string' } },
              known_universes: { type: 'array', items: { type: 'string' } },
              level: { type: 'number' },
              voice_creation: {
                type: 'object',
                properties: {
                  voice: { type: 'string' },
                  age: { type: 'string' },
                  style: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            additionalProperties: true
          }
        }
      },
      additionalProperties: true
    }
  },
  storyteller_mission: {
    routeKey: 'storyteller_mission',
    routePath: '/api/sendStorytellerToEntity',
    method: 'POST',
    description: 'Generate mission outcome for a storyteller/entity assignment.',
    promptTemplate: `You are the Storyteller Society mission desk.
Assign "{{storytellerName}}" to investigate "{{entityName}}".

Mission context:
- Entity type: {{entityType}} / {{entitySubtype}}
- Entity description: {{entityDescription}}
- Entity lore: {{entityLore}}
- Storytelling points budget: {{storytellingPoints}}
- Expected duration: {{durationDays}}
- Message to the storyteller: "{{message}}"

Return JSON object with keys:
outcome, userText, gmNote, subEntitySeed.
Rules:
- outcome must be one of: success, failure, delayed, pending
- userText and gmNote should be concise
- always include subEntitySeed
Output JSON only.`,
    responseSchema: {
      type: 'object',
      required: ['outcome', 'userText', 'gmNote', 'subEntitySeed'],
      properties: {
        outcome: { type: 'string', enum: ['success', 'failure', 'delayed', 'pending'] },
        userText: { type: 'string' },
        gmNote: { type: 'string' },
        subEntitySeed: { type: 'string' }
      },
      additionalProperties: true
    }
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mergeConfig(defaultConfig, overrideConfig) {
  const merged = deepClone(defaultConfig);
  if (typeof overrideConfig?.promptTemplate === 'string') {
    merged.promptTemplate = overrideConfig.promptTemplate;
  }
  if (overrideConfig?.responseSchema && typeof overrideConfig.responseSchema === 'object') {
    merged.responseSchema = overrideConfig.responseSchema;
  }
  if (overrideConfig?.meta && typeof overrideConfig.meta === 'object') {
    merged.meta = overrideConfig.meta;
  }
  return merged;
}

async function readOverridesFile() {
  try {
    const raw = await fs.readFile(OVERRIDES_PATH, 'utf8');
    return asObject(JSON.parse(raw));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeOverridesFile(overrides) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(OVERRIDES_PATH, JSON.stringify(overrides, null, 2), 'utf8');
}

function ensureRouteKey(routeKey) {
  if (!DEFAULT_ROUTE_CONFIGS[routeKey]) {
    const supported = Object.keys(DEFAULT_ROUTE_CONFIGS).join(', ');
    const error = new Error(`Unknown routeKey "${routeKey}". Supported keys: ${supported}.`);
    error.code = 'INVALID_ROUTE_KEY';
    throw error;
  }
}

export function getSupportedRouteKeys() {
  return Object.keys(DEFAULT_ROUTE_CONFIGS);
}

export async function listRouteConfigs() {
  const overrides = await readOverridesFile();
  const merged = {};
  for (const routeKey of getSupportedRouteKeys()) {
    merged[routeKey] = mergeConfig(DEFAULT_ROUTE_CONFIGS[routeKey], overrides[routeKey]);
  }
  return merged;
}

export async function getRouteConfig(routeKey) {
  ensureRouteKey(routeKey);
  const overrides = await readOverridesFile();
  return mergeConfig(DEFAULT_ROUTE_CONFIGS[routeKey], overrides[routeKey]);
}

async function updateOverride(routeKey, patch) {
  ensureRouteKey(routeKey);
  const overrides = await readOverridesFile();
  const current = asObject(overrides[routeKey]);
  overrides[routeKey] = {
    ...current,
    ...patch,
    meta: {
      ...asObject(current.meta),
      ...asObject(patch.meta),
      updatedAt: new Date().toISOString()
    }
  };
  await writeOverridesFile(overrides);
  return getRouteConfig(routeKey);
}

export async function updateRoutePrompt(routeKey, promptTemplate, updatedBy = 'admin') {
  if (typeof promptTemplate !== 'string' || !promptTemplate.trim()) {
    const error = new Error('promptTemplate must be a non-empty string.');
    error.code = 'INVALID_PROMPT_TEMPLATE';
    throw error;
  }
  return updateOverride(routeKey, {
    promptTemplate,
    meta: { updatedBy }
  });
}

export async function updateRouteSchema(routeKey, responseSchema, updatedBy = 'admin') {
  if (!responseSchema || typeof responseSchema !== 'object' || Array.isArray(responseSchema)) {
    const error = new Error('responseSchema must be a JSON object.');
    error.code = 'INVALID_RESPONSE_SCHEMA';
    throw error;
  }
  try {
    ajv.compile(responseSchema);
  } catch (schemaError) {
    const error = new Error(`Invalid JSON Schema: ${schemaError.message}`);
    error.code = 'INVALID_RESPONSE_SCHEMA';
    throw error;
  }
  return updateOverride(routeKey, {
    responseSchema,
    meta: { updatedBy }
  });
}

export async function resetRouteConfig(routeKey) {
  ensureRouteKey(routeKey);
  const overrides = await readOverridesFile();
  if (overrides[routeKey]) {
    delete overrides[routeKey];
    await writeOverridesFile(overrides);
  }
  return getRouteConfig(routeKey);
}

function normalizeTokenValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

export function renderPrompt(template, tokens = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => normalizeTokenValue(tokens[key]));
}

function buildValidator(schema) {
  const cacheKey = JSON.stringify(schema);
  if (!validatorCache.has(cacheKey)) {
    validatorCache.set(cacheKey, ajv.compile(schema));
  }
  return validatorCache.get(cacheKey);
}

function formatAjvErrors(errors = []) {
  return errors.map((err) => {
    const pathLabel = err.instancePath || '(root)';
    return `${pathLabel} ${err.message}`.trim();
  });
}

export async function validatePayloadForRoute(routeKey, payload) {
  const config = await getRouteConfig(routeKey);
  const schema = config.responseSchema;
  if (!schema) {
    return { valid: true };
  }
  const validate = buildValidator(schema);
  const valid = validate(payload);
  if (!valid) {
    const details = formatAjvErrors(validate.errors);
    const error = new Error(`Schema validation failed for ${routeKey}.`);
    error.code = 'LLM_SCHEMA_VALIDATION_ERROR';
    error.details = details;
    throw error;
  }
  return { valid: true };
}

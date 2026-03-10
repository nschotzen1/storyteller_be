import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import { LlmRouteConfigVersion } from '../models/models.js';
import { FRAGMENT_TO_MEMORIES_RESPONSE_SCHEMA } from '../contracts/fragmentMemoryContract.js';
import { buildInitialChatPromptText } from '../ai/openai/personaChatPrompts.js';
import { ensureMongoConnection } from './mongoConnectionService.js';
import { getDefaultImmersiveRpgGmPromptTemplate } from './immersiveRpgService.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validatorCache = new Map();
const DEFAULT_VERSION_LIMIT = 20;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const ROUTE_CONFIG_STORE_PATH = process.env.LLM_ROUTE_CONFIG_STORE_PATH
  || path.join(CONFIG_DIR, 'llm_route_config_versions.json');

const STORYTELLER_TYPEWRITER_KEY_SCHEMA = {
  type: 'object',
  required: ['symbol', 'description', 'key_shape', 'shape_prompt_hint'],
  properties: {
    symbol: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    key_shape: {
      type: 'string',
      enum: ['horizontal', 'vertical', 'rect_horizontal']
    },
    shape_prompt_hint: { type: 'string', minLength: 1 }
  },
  additionalProperties: true
};

const STORYTELLER_INTERVENTION_STYLE_SCHEMA = {
  type: 'object',
  properties: {
    font: { type: 'string' },
    font_size: { type: 'string' },
    font_color: { type: 'string' }
  },
  additionalProperties: true
};

const STORYTELLER_INTERVENTION_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['continuation', 'entity'],
  properties: {
    continuation: { type: 'string', minLength: 1 },
    entity: {
      type: 'object',
      required: ['name', 'key_text', 'summary', 'type', 'subtype'],
      properties: {
        name: { type: 'string', minLength: 1 },
        key_text: { type: 'string', minLength: 1 },
        summary: { type: 'string', minLength: 1 },
        type: { type: 'string', minLength: 1 },
        subtype: { type: 'string', minLength: 1 },
        lore: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      additionalProperties: true
    },
    style: STORYTELLER_INTERVENTION_STYLE_SCHEMA
  },
  additionalProperties: true
};

const MESSENGER_SCENE_BRIEF_SCHEMA = {
  type: 'object',
  required: ['subject', 'place_name', 'place_summary', 'typewriter_hiding_spot', 'sensory_details', 'notable_features', 'scene_established'],
  properties: {
    subject: { type: 'string' },
    place_name: { type: 'string' },
    place_summary: { type: 'string' },
    typewriter_hiding_spot: { type: 'string' },
    sensory_details: {
      type: 'array',
      items: { type: 'string' }
    },
    notable_features: {
      type: 'array',
      items: { type: 'string' }
    },
    scene_established: { type: 'boolean' }
  },
  additionalProperties: true
};

const IMMERSIVE_RPG_PENDING_ROLL_SCHEMA = {
  type: 'object',
  required: [
    'context_key',
    'skill',
    'label',
    'dice_notation',
    'difficulty',
    'success_threshold',
    'successes_required',
    'instructions'
  ],
  properties: {
    context_key: { type: 'string', minLength: 1 },
    skill: { type: 'string', minLength: 1 },
    label: { type: 'string', minLength: 1 },
    dice_notation: { type: 'string', minLength: 3 },
    difficulty: { type: 'string', minLength: 1 },
    success_threshold: { type: 'integer', minimum: 1 },
    successes_required: { type: 'integer', minimum: 1 },
    instructions: { type: 'string', minLength: 1 }
  },
  additionalProperties: true
};

const IMMERSIVE_RPG_CHAT_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['gm_reply', 'current_beat', 'should_pause_for_choice', 'scene_flags_patch'],
  properties: {
    gm_reply: { type: 'string', minLength: 1 },
    current_beat: { type: 'string', minLength: 1 },
    should_pause_for_choice: { type: 'boolean' },
    pending_roll: {
      anyOf: [
        IMMERSIVE_RPG_PENDING_ROLL_SCHEMA,
        { type: 'null' }
      ]
    },
    scene_flags_patch: {
      type: 'object',
      additionalProperties: {
        anyOf: [
          { type: 'boolean' },
          { type: 'string' },
          { type: 'number' }
        ]
      }
    },
    keeper_notes: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  additionalProperties: true
};

const DEFAULT_ROUTE_CONFIGS = {
  worlds_create: {
    routeKey: 'worlds_create',
    routePath: '/api/worlds',
    method: 'POST',
    description: 'Create a world from a seed fragment.',
    promptMode: 'manual',
    promptTemplate: `You are a worldbuilding designer. Return JSON only.
Create a setting for a cooperative narrative game.
Seed: "{{seedText}}"
World name hint: "{{name}}"
Return JSON with keys:
name, summary (1-2 sentences), tone (3-6 words), pillars (3-5), themes (3-5), palette (3-5 evocative color or texture phrases).`,
    promptCore: '',
    fieldDocs: {},
    examplePayload: null,
    outputRules: [],
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
    promptMode: 'manual',
    promptTemplate: `You are a worldbuilding designer. Return JSON only.
World name: "{{worldName}}"
World tone: "{{worldTone}}"
World summary: "{{worldSummary}}"
Seed: "{{seedText}}"
Element type: "{{elementType}}"
Generate {{count}} entries.
Return JSON object with key "elements". Each item should include:
name, description, tags (array), traits (array), hooks (array).`,
    promptCore: '',
    fieldDocs: {},
    examplePayload: null,
    outputRules: [],
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
    promptMode: 'manual',
    promptTemplate: `You are the keeper of the Storyteller Society.
Summon {{storytellerCount}} distinct storytellers for this fragment:
"{{fragmentText}}"

Return JSON object with key "storytellers" containing {{storytellerCount}} entries.
Each storyteller must include:
- name
- immediate_ghost_appearance
- typewriter_key { symbol, description, key_shape, shape_prompt_hint }
- influences (array)
- known_universes (array)
- level (1-20)
- voice_creation { voice, age, style }

Rules for typewriter_key:
- symbol must be a strange, visual icon concept in 1-3 words
- symbol must never be a letter, number, or readable text
- description should describe physical material, wear, mood, and aura of the key face
- key_shape must be one of: horizontal, vertical, rect_horizontal
- shape_prompt_hint must be a short phrase explaining how the symbol should sit within the silhouette
- keep the icon bold and readable at small UI size

Output JSON only.`,
    promptCore: '',
    fieldDocs: {},
    examplePayload: null,
    outputRules: [],
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
              typewriter_key: STORYTELLER_TYPEWRITER_KEY_SCHEMA,
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
  storyteller_typewriter_intervention: {
    routeKey: 'storyteller_typewriter_intervention',
    routePath: '/api/send_storyteller_typewriter_text',
    method: 'POST',
    description: 'Generate a short storyteller entrance/intervention plus one new entity key.',
    promptMode: 'manual',
    promptTemplate: `You are a hidden storyteller joining an already-unfolding scene.

You are:
- Name: {{storyteller_name}}
- Immediate appearance: {{storyteller_immediate_ghost_appearance}}
- Typewriter key symbol: {{storyteller_symbol}}
- Typewriter key description: {{storyteller_key_description}}
- Voice: {{storyteller_voice}}
- Age: {{storyteller_age}}
- Style: {{storyteller_style}}
- Influences: {{storyteller_influences}}
- Known universes: {{storyteller_known_universes}}
- Already introduced in this typewriter session: {{storyteller_already_introduced}}

Current narrative fragment:
"""
{{fragment_text}}
"""

Your task:
- Write a short storyteller intervention that enters the scene seamlessly, as if you had been there all along.
- If you were not introduced before, briefly introduce yourself in-world without breaking tone.
- Notice one specific thing in the fragment, investigate it, enrich the world with one fresh entity, and then drift back out.
- The intervention must feel enchanting, observant, and precise rather than loud or expository.
- Keep it concise: about 45-110 words.
- Do not summarize the whole fragment.
- Do not explain mechanics or mention players, prompts, APIs, JSON, or typewriters.

You must also define one new entity discovered during this intervention.

Style rules:
- If you include style.font_color, it must be a dark, clearly legible CSS hex color suited for parchment.
- Prefer one of these strong dark tones: #2a120f, #3b1d15, #5a1f17, #1f3558, #253f33, #43233d.
- Never return white, pale gray, pastel, neon, or low-contrast colors.

Return JSON only in this exact shape:
{
  "continuation": "String",
  "entity": {
    "name": "String",
    "key_text": "1-3 words, suitable for a small textual typewriter key",
    "summary": "Short vivid description",
    "type": "String",
    "subtype": "String",
    "lore": "Optional short lore note",
    "tags": ["String"]
  },
  "style": {
    "font": "Optional font family",
    "font_size": "Optional CSS size",
    "font_color": "Optional dark CSS hex color"
  }
}`,
    promptCore: '',
    fieldDocs: {
      continuation: '45-110 words, in-world, seamless entrance and exit.',
      'entity.key_text': '1-3 words, compact enough for the typewriter entity key rail.',
      'style.font_color': 'Use only dark, legible CSS hex colors suitable for parchment.'
    },
    examplePayload: {
      continuation:
        'It was then that I, Elias Rhode, allowed myself into the margin of the watchman\'s vigil and followed the slow intelligence nested in the blue light.',
      entity: {
        name: 'Buraha Light-Wake',
        key_text: 'Buraha Light',
        summary: 'A slow intelligence hiding inside the blue sea-lights, felt before it is understood.',
        type: 'omen',
        subtype: 'marine anomaly',
        lore: 'It moves like weather pretending to be thought.',
        tags: ['sea', 'light', 'witness']
      },
      style: {
        font: "'EB Garamond', serif",
        font_size: '1.95rem',
        font_color: '#1f3558'
      }
    },
    outputRules: [
      'continuation must remain in-world and cannot mention gameplay or interfaces',
      'entity.key_text must be concise and readable at small UI size',
      'style.font_color must be dark and highly legible on parchment'
    ],
    responseSchema: STORYTELLER_INTERVENTION_RESPONSE_SCHEMA
  },
  messenger_chat: {
    routeKey: 'messenger_chat',
    routePath: '/api/messenger/chat',
    method: 'POST',
    description: 'Drive the eerie typewriter-delivery messenger conversation.',
    promptMode: 'manual',
    promptTemplate: buildInitialChatPromptText(),
    promptCore: '',
    fieldDocs: {
      message_assistant: 'The next in-character reply shown in the messenger thread.',
      scene_brief: 'Running structured capture of the destination scene and the typewriter hideaway.',
      'scene_brief.subject': 'Short browsable label for the place.',
      'scene_brief.place_summary': 'Vivid establishing description of the room/place.',
      'scene_brief.typewriter_hiding_spot': 'Concrete concealment location and why it works.'
    },
    examplePayload: {
      has_chat_ended: true,
      message_assistant: 'Excellent. The Society has what it needs. We know the room, the harbor weather, and the wardrobe where the machine may vanish without gossip.',
      scene_brief: {
        subject: 'Harbor attic watchroom',
        place_name: 'Attic room above the harbor',
        place_summary: 'A salt-stained attic room leans above the harbor, with a rain-marked window, a narrow oak worktable, and the low groan of rigging below. The air smells of damp rope, dust, and cold metal, making it immediately stageable as a place where a secret machine could begin its work.',
        typewriter_hiding_spot: 'Inside the cedar wardrobe with a false back, high enough to stay dry and ordinary enough to escape notice.',
        sensory_details: ['salt wind through the sash', 'harbor bells below', 'cedar dust in the wardrobe'],
        notable_features: ['oak worktable', 'rain-marked window', 'cedar wardrobe with false back'],
        scene_established: true
      }
    },
    outputRules: [
      'Do not end the chat until the place is vivid enough to stage a scene and the typewriter hiding place is concrete.',
      'scene_brief.subject must be concise and easy to browse later in Mongo.'
    ],
    responseSchema: {
      type: 'object',
      required: ['has_chat_ended', 'message_assistant', 'scene_brief'],
      properties: {
        has_chat_ended: { type: 'boolean' },
        message_assistant: { type: 'string', minLength: 1 },
        scene_brief: MESSENGER_SCENE_BRIEF_SCHEMA
      },
      additionalProperties: true
    }
  },
  immersive_rpg_chat: {
    routeKey: 'immersive_rpg_chat',
    routePath: '/api/immersive-rpg/chat',
    method: 'POST',
    description: 'Reserved GM structured-output contract for the immersive RPG chat loop.',
    promptMode: 'manual',
    promptTemplate: getDefaultImmersiveRpgGmPromptTemplate(),
    promptCore: '',
    fieldDocs: {
      gm_reply: 'The next atmospheric GM response shown to the player.',
      current_beat: 'Scene-state beat identifier to persist into Mongo.',
      should_pause_for_choice: 'True when the GM should stop and wait for the PC to answer "What do you do?"',
      pending_roll: 'Include only when a roll should appear in the notebook panel.',
      'pending_roll.context_key': 'Stable key for roll resolution logic.',
      scene_flags_patch: 'Shallow patch of scene flags to persist after the GM turn.'
    },
    examplePayload: {
      gm_reply:
        'The stranger still has not seen you. The journal lies half-hidden where the brush dips toward the path, and the wrongness of the scene grows sharper the longer you wait. If you want it, you need to move now. What do you do?',
      current_beat: 'encounter_setup',
      should_pause_for_choice: true,
      pending_roll: {
        context_key: 'journal_retrieval',
        skill: 'awareness',
        label: 'Retrieve the journal unnoticed',
        dice_notation: '5d6',
        difficulty: 'moderate-high',
        success_threshold: 5,
        successes_required: 2,
        instructions:
          'Roll 5d6 Awareness. Count 5s and 6s as successes. You need 2 successes to reach the journal, see enough of it, and stay unnoticed.'
      },
      scene_flags_patch: {
        strangerSpottedPc: false,
        sawJournalSketches: false
      },
      keeper_notes: [
        'Never present menu choices.',
        'Pause on meaningful uncertainty and ask "What do you do?"'
      ]
    },
    outputRules: [
      'Maintain suggestive, Hitchcock-like dread without removing player agency.',
      'Never present explicit choice lists.',
      'If a roll is required, include pending_roll and state the stakes plainly.',
      'GM output must stay in-world and must not mention prompts, APIs, JSON, or tooling.'
    ],
    responseSchema: IMMERSIVE_RPG_CHAT_RESPONSE_SCHEMA
  },
  storyteller_mission: {
    routeKey: 'storyteller_mission',
    routePath: '/api/sendStorytellerToEntity',
    method: 'POST',
    description: 'Generate mission outcome for a storyteller/entity assignment.',
    promptMode: 'manual',
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
    promptCore: '',
    fieldDocs: {},
    examplePayload: null,
    outputRules: [],
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
  },
  fragment_to_memories: {
    routeKey: 'fragment_to_memories',
    routePath: '/api/fragmentToMemories',
    method: 'POST',
    description: 'Generate memory flashes from a narrative fragment.',
    promptMode: 'manual',
    promptTemplate: `You are the **Storyteller Seer**, the last guardian of a fragmented and almost-lost storytelling universe. Your task is to tap into moments in time and space, encapsulating the gritty reality of this world. Each memory represents a specific individual immersed in a moment of action, situated in a broader context that connects to the fragment or the universe at large. These moments are deeply physical, rooted in the rhythm of life, and seen through the stream of consciousness of their observer.

You recover a surviving fragment—the only one left of this rich and vibrant world—and bring it to the **Storyteller’s Observatory**. This is the fragment: {{fragmentText}}

As you read this fragment, **memories** begin to flash before your eyes. Some memories connect directly to the fragment's narrative, showing moments tied to its people, places, or events. Others offer secondary perspectives—seemingly unrelated happenings elsewhere in the universe—revealing its interconnected richness and untold stories. Both types immerse you in moments of this world through the eyes of its characters.

Your task is to document these memories. Return them in a JSON array under key "memories", generating {{memoryCount}} memories (default is 3 when count is absent).

Each memory object must use these exact keys and types:
- memory_strength: string
- emotional_sentiment: string
- action_name: string
- estimated_action_length: string
- time_within_action: string
- actual_result: string
- related_through_what: string
- geographical_relevance: string
- temporal_relation: string
- organizational_affiliation: string
- consequences: string
- distance_from_fragment_location_km: integer
- shot_type: string
- time_of_day: string
- whose_eyes: string
- interior/exterior: string
- what_is_being_watched: string
- location: string
- estimated_duration_of_memory: integer
- memory_distance: string
- entities_in_memory: array of strings
- currently_assumed_turns_to_round: string
- relevant_rolls: array of strings
- action_level: string
- short_title: string
- dramatic_definition: string
- miseenscene: string

short_title rules:
- 2 to 6 words
- short enough to print on a memory card UI
- concrete and evocative
- not generic like "Memory 1"

Output shape:
{
  "memories": [
    {
      "memory_strength": "string",
      "emotional_sentiment": "string",
      "action_name": "string",
      "estimated_action_length": "string",
      "time_within_action": "string",
      "actual_result": "string",
      "related_through_what": "string",
      "geographical_relevance": "string",
      "temporal_relation": "string",
      "organizational_affiliation": "string",
      "consequences": "string",
      "distance_from_fragment_location_km": 0,
      "shot_type": "string",
      "time_of_day": "string",
      "whose_eyes": "string",
      "interior/exterior": "string",
      "what_is_being_watched": "string",
      "location": "string",
      "estimated_duration_of_memory": 12,
      "memory_distance": "string",
      "entities_in_memory": ["string"],
      "currently_assumed_turns_to_round": "string",
      "relevant_rolls": ["string"],
      "action_level": "string",
      "short_title": "string",
      "dramatic_definition": "string",
      "miseenscene": "string"
    }
  ]
}

Make the miseenscene first-person, sensory, specific, and paced to the memory itself (fast moments fragmented, slow moments reflective). Return only JSON.`,
    promptCore: '',
    fieldDocs: {},
    examplePayload: null,
    outputRules: [],
    responseSchema: FRAGMENT_TO_MEMORIES_RESPONSE_SCHEMA
  }
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function shouldUseMongoRouteConfigStore() {
  return ensureMongoConnection({ allowFailure: true });
}

async function readRouteConfigStoreFile() {
  try {
    const raw = await fs.readFile(ROUTE_CONFIG_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      routes: asObject(parsed.routes)
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { routes: {} };
    }
    throw error;
  }
}

async function writeRouteConfigStoreFile(store) {
  await fs.mkdir(path.dirname(ROUTE_CONFIG_STORE_PATH), { recursive: true });
  await fs.writeFile(ROUTE_CONFIG_STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function sortRouteConfigDocs(docs) {
  return [...docs].sort((left, right) => {
    const versionDiff = (Number(right?.version) || 0) - (Number(left?.version) || 0);
    if (versionDiff !== 0) return versionDiff;
    return String(right?.createdAt || '').localeCompare(String(left?.createdAt || ''));
  });
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePromptMode(value) {
  return value === 'contract' ? 'contract' : 'manual';
}

function normalizeOutputRules(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => `${entry || ''}`.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeFieldDocs(value) {
  const source = asObject(value);
  const normalized = {};
  for (const [key, entry] of Object.entries(source)) {
    const normalizedKey = `${key || ''}`.trim();
    if (!normalizedKey) continue;
    if (typeof entry === 'string') {
      const note = entry.trim();
      if (note) normalized[normalizedKey] = note;
      continue;
    }
    if (entry && typeof entry === 'object') {
      const note = `${entry.description || entry.note || ''}`.trim();
      if (note) normalized[normalizedKey] = note;
    }
  }
  return normalized;
}

function normalizeJsonValue(value, fallback) {
  if (value === undefined) return deepClone(fallback);
  if (value === null) return null;
  if (typeof value !== 'object') {
    return deepClone(fallback);
  }
  return deepClone(value);
}

function normalizeStoredRouteConfigDoc(routeKey, doc) {
  return {
    id: typeof doc?.id === 'string' && doc.id ? doc.id : randomUUID(),
    routeKey,
    version: Number(doc?.version) || 1,
    promptMode: normalizePromptMode(doc?.promptMode),
    promptTemplate: normalizeString(doc?.promptTemplate),
    promptCore: normalizeString(doc?.promptCore),
    responseSchema: normalizeJsonValue(doc?.responseSchema, {}),
    fieldDocs: normalizeFieldDocs(doc?.fieldDocs),
    examplePayload: normalizeJsonValue(doc?.examplePayload, null),
    outputRules: normalizeOutputRules(doc?.outputRules),
    isLatest: Boolean(doc?.isLatest),
    createdBy: typeof doc?.createdBy === 'string' && doc.createdBy.trim() ? doc.createdBy.trim() : 'admin',
    createdAt: typeof doc?.createdAt === 'string' && doc.createdAt ? doc.createdAt : new Date().toISOString(),
    updatedAt: typeof doc?.updatedAt === 'string' && doc.updatedAt ? doc.updatedAt : new Date().toISOString(),
    meta: asObject(doc?.meta),
    _storageSource: 'file'
  };
}

async function getStoredRouteConfigVersions(routeKey) {
  const store = await readRouteConfigStoreFile();
  const docs = Array.isArray(store.routes[routeKey]) ? store.routes[routeKey] : [];
  return sortRouteConfigDocs(docs.map((doc) => normalizeStoredRouteConfigDoc(routeKey, doc)));
}

function buildFieldDocsText(fieldDocs = {}) {
  const entries = Object.entries(normalizeFieldDocs(fieldDocs));
  if (!entries.length) return '';
  return entries.map(([fieldName, note]) => `- ${fieldName}: ${note}`).join('\n');
}

function buildOutputRulesText(outputRules = []) {
  const rules = normalizeOutputRules(outputRules);
  if (!rules.length) return '';
  return rules.map((rule) => `- ${rule}`).join('\n');
}

function buildContractPromptTemplate({
  promptCore = '',
  responseSchema = {},
  fieldDocs = {},
  examplePayload = null,
  outputRules = []
} = {}) {
  const sections = [];
  const base = normalizeString(promptCore);
  if (base) {
    sections.push(base);
  }

  sections.push('Return JSON only.');
  sections.push(`Output must validate against this JSON Schema:\n${JSON.stringify(responseSchema || {}, null, 2)}`);

  const fieldDocsText = buildFieldDocsText(fieldDocs);
  if (fieldDocsText) {
    sections.push(`Field guidance:\n${fieldDocsText}`);
  }

  const rulesText = buildOutputRulesText(outputRules);
  if (rulesText) {
    sections.push(`Additional output rules:\n${rulesText}`);
  }

  if (examplePayload !== null && examplePayload !== undefined) {
    sections.push(`Example valid JSON:\n${JSON.stringify(examplePayload, null, 2)}`);
  }

  return sections.filter(Boolean).join('\n\n').trim();
}

function toRouteConfigPayload(source, defaultConfig) {
  const defaults = deepClone(defaultConfig);
  const doc = source && typeof source === 'object' ? source : null;
  const docMeta = asObject(doc?.meta);
  const storageSource = normalizeString(doc?._storageSource)
    || normalizeString(docMeta.source)
    || (doc ? 'mongo' : 'code-default');
  const promptMode = normalizePromptMode(doc?.promptMode || defaults.promptMode);
  const promptCore = normalizeString(doc?.promptCore ?? defaults.promptCore);
  const fieldDocs = normalizeFieldDocs(doc?.fieldDocs ?? defaults.fieldDocs);
  const outputRules = normalizeOutputRules(doc?.outputRules ?? defaults.outputRules);
  const responseSchema = normalizeJsonValue(doc?.responseSchema, defaults.responseSchema || {});
  const examplePayload = normalizeJsonValue(doc?.examplePayload, defaults.examplePayload);
  const storedPromptTemplate = normalizeString(doc?.promptTemplate ?? defaults.promptTemplate);
  const compiledPromptTemplate = promptMode === 'contract'
    ? buildContractPromptTemplate({
      promptCore,
      responseSchema,
      fieldDocs,
      examplePayload,
      outputRules
    })
    : storedPromptTemplate;

  return {
    id: String(doc?._id || doc?.id || ''),
    routeKey: defaults.routeKey,
    routePath: defaults.routePath,
    method: defaults.method,
    description: defaults.description,
    promptMode,
    promptTemplate: compiledPromptTemplate,
    compiledPromptTemplate,
    promptCore,
    fieldDocs,
    examplePayload,
    outputRules,
    responseSchema,
    version: doc?.version || 0,
    isLatest: doc ? Boolean(doc.isLatest) : true,
    createdBy: doc?.createdBy || 'code-default',
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
    meta: {
      ...asObject(defaults.meta),
      ...docMeta,
      source: storageSource
    }
  };
}

function ensureRouteKey(routeKey) {
  if (!DEFAULT_ROUTE_CONFIGS[routeKey]) {
    const supported = Object.keys(DEFAULT_ROUTE_CONFIGS).join(', ');
    const error = new Error(`Unknown routeKey "${routeKey}". Supported keys: ${supported}.`);
    error.code = 'INVALID_ROUTE_KEY';
    throw error;
  }
}

function buildValidator(schema) {
  const cacheKey = JSON.stringify(schema);
  if (!validatorCache.has(cacheKey)) {
    validatorCache.set(cacheKey, ajv.compile(schema));
  }
  return validatorCache.get(cacheKey);
}

function validateSchema(schema) {
  try {
    ajv.compile(schema);
  } catch (schemaError) {
    const error = new Error(`Invalid JSON Schema: ${schemaError.message}`);
    error.code = 'INVALID_RESPONSE_SCHEMA';
    throw error;
  }
}

function validateExamplePayloadAgainstSchema(examplePayload, schema) {
  if (examplePayload === null || examplePayload === undefined) return;
  const validate = buildValidator(schema);
  const valid = validate(examplePayload);
  if (!valid) {
    const details = (validate.errors || []).map((entry) => `${entry.instancePath || '(root)'} ${entry.message}`.trim());
    const error = new Error(`Example payload does not match responseSchema: ${details.join('; ')}`);
    error.code = 'INVALID_EXAMPLE_PAYLOAD';
    throw error;
  }
}

async function findLatestRouteDoc(routeKey) {
  if (await shouldUseMongoRouteConfigStore()) {
    return LlmRouteConfigVersion.findOne({ routeKey, isLatest: true })
      .sort({ version: -1, createdAt: -1 })
      .lean();
  }

  const docs = await getStoredRouteConfigVersions(routeKey);
  return docs.find((doc) => doc.isLatest) || docs[0] || null;
}

export function getSupportedRouteKeys() {
  return Object.keys(DEFAULT_ROUTE_CONFIGS);
}

export async function listRouteConfigs() {
  const hasMongo = await shouldUseMongoRouteConfigStore();
  const docs = hasMongo ? await LlmRouteConfigVersion.find({ isLatest: true }).lean() : [];
  const byRouteKey = {};
  for (const routeKey of getSupportedRouteKeys()) {
    let latestDoc;
    if (hasMongo) {
      latestDoc = docs
        .filter((doc) => doc.routeKey === routeKey)
        .sort((left, right) => (right.version || 0) - (left.version || 0))[0];
    } else {
      const storedDocs = await getStoredRouteConfigVersions(routeKey);
      latestDoc = storedDocs.find((doc) => doc.isLatest) || storedDocs[0] || null;
    }
    byRouteKey[routeKey] = toRouteConfigPayload(latestDoc, DEFAULT_ROUTE_CONFIGS[routeKey]);
  }
  return byRouteKey;
}

export async function getRouteConfig(routeKey) {
  ensureRouteKey(routeKey);
  const latestDoc = await findLatestRouteDoc(routeKey);
  return toRouteConfigPayload(latestDoc, DEFAULT_ROUTE_CONFIGS[routeKey]);
}

export async function listRouteConfigVersions(routeKey, limit = DEFAULT_VERSION_LIMIT) {
  ensureRouteKey(routeKey);
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(100, Number(limit)))
    : DEFAULT_VERSION_LIMIT;

  if (await shouldUseMongoRouteConfigStore()) {
    const docs = await LlmRouteConfigVersion.find({ routeKey })
      .sort({ version: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();
    return docs.map((doc) => toRouteConfigPayload(doc, DEFAULT_ROUTE_CONFIGS[routeKey]));
  }

  const docs = await getStoredRouteConfigVersions(routeKey);
  return docs.slice(0, safeLimit).map((doc) => toRouteConfigPayload(doc, DEFAULT_ROUTE_CONFIGS[routeKey]));
}

export async function saveRouteConfigVersion(
  routeKey,
  patch = {},
  createdBy = 'admin',
  { markLatest = true } = {}
) {
  ensureRouteKey(routeKey);

  const current = await getRouteConfig(routeKey);
  const nextPromptMode = normalizePromptMode(patch.promptMode ?? current.promptMode);
  const nextPromptCore = patch.promptCore !== undefined
    ? normalizeString(patch.promptCore)
    : normalizeString(current.promptCore);
  const nextResponseSchema = patch.responseSchema !== undefined
    ? normalizeJsonValue(patch.responseSchema, current.responseSchema || {})
    : normalizeJsonValue(current.responseSchema, {});
  const nextFieldDocs = patch.fieldDocs !== undefined
    ? normalizeFieldDocs(patch.fieldDocs)
    : normalizeFieldDocs(current.fieldDocs);
  const nextExamplePayload = patch.examplePayload !== undefined
    ? normalizeJsonValue(patch.examplePayload, null)
    : normalizeJsonValue(current.examplePayload, null);
  const nextOutputRules = patch.outputRules !== undefined
    ? normalizeOutputRules(patch.outputRules)
    : normalizeOutputRules(current.outputRules);
  let nextPromptTemplate = patch.promptTemplate !== undefined
    ? normalizeString(patch.promptTemplate)
    : normalizeString(current.promptTemplate);

  validateSchema(nextResponseSchema);
  validateExamplePayloadAgainstSchema(nextExamplePayload, nextResponseSchema);

  if (nextPromptMode === 'contract') {
    if (!nextPromptCore) {
      const error = new Error('promptCore must be a non-empty string when promptMode is "contract".');
      error.code = 'INVALID_PROMPT_TEMPLATE';
      throw error;
    }
    nextPromptTemplate = buildContractPromptTemplate({
      promptCore: nextPromptCore,
      responseSchema: nextResponseSchema,
      fieldDocs: nextFieldDocs,
      examplePayload: nextExamplePayload,
      outputRules: nextOutputRules
    });
  }

  if (!nextPromptTemplate) {
    const error = new Error('promptTemplate must be a non-empty string.');
    error.code = 'INVALID_PROMPT_TEMPLATE';
    throw error;
  }

  if (await shouldUseMongoRouteConfigStore()) {
    const latestDoc = await LlmRouteConfigVersion.findOne({ routeKey })
      .sort({ version: -1 })
      .lean();
    const nextVersion = (latestDoc?.version || 0) + 1;

    if (markLatest) {
      await LlmRouteConfigVersion.updateMany(
        { routeKey, isLatest: true },
        { $set: { isLatest: false } }
      );
    }

    await LlmRouteConfigVersion.create({
      routeKey,
      version: nextVersion,
      promptMode: nextPromptMode,
      promptTemplate: nextPromptTemplate,
      promptCore: nextPromptCore,
      responseSchema: nextResponseSchema,
      fieldDocs: nextFieldDocs,
      examplePayload: nextExamplePayload,
      outputRules: nextOutputRules,
      isLatest: Boolean(markLatest),
      createdBy: typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'admin',
      meta: {
        ...asObject(current.meta),
        ...asObject(patch.meta),
        source: 'mongo'
      }
    });

    return getRouteConfig(routeKey);
  }

  const store = await readRouteConfigStoreFile();
  const docs = Array.isArray(store.routes[routeKey]) ? store.routes[routeKey] : [];
  const normalizedDocs = docs.map((doc) => normalizeStoredRouteConfigDoc(routeKey, doc));
  const nextVersion = normalizedDocs.reduce((maxVersion, doc) => Math.max(maxVersion, doc.version || 0), 0) + 1;
  const now = new Date().toISOString();
  const nextDocs = normalizedDocs.map((doc) => ({
    ...doc,
    isLatest: markLatest ? false : Boolean(doc.isLatest)
  }));

  nextDocs.push({
    id: randomUUID(),
    routeKey,
    version: nextVersion,
    promptMode: nextPromptMode,
    promptTemplate: nextPromptTemplate,
    promptCore: nextPromptCore,
    responseSchema: nextResponseSchema,
    fieldDocs: nextFieldDocs,
    examplePayload: nextExamplePayload,
    outputRules: nextOutputRules,
    isLatest: Boolean(markLatest),
    createdBy: typeof createdBy === 'string' && createdBy.trim() ? createdBy.trim() : 'admin',
    createdAt: now,
    updatedAt: now,
    meta: {
      ...asObject(current.meta),
      ...asObject(patch.meta),
      source: 'file'
    }
  });

  store.routes[routeKey] = sortRouteConfigDocs(nextDocs);
  await writeRouteConfigStoreFile(store);
  return getRouteConfig(routeKey);
}

export async function updateRoutePrompt(routeKey, promptTemplate, updatedBy = 'admin') {
  if (typeof promptTemplate !== 'string' || !promptTemplate.trim()) {
    const error = new Error('promptTemplate must be a non-empty string.');
    error.code = 'INVALID_PROMPT_TEMPLATE';
    throw error;
  }
  return saveRouteConfigVersion(routeKey, {
    promptMode: 'manual',
    promptTemplate,
    meta: { updatedBy }
  }, updatedBy);
}

export async function updateRouteSchema(routeKey, responseSchema, updatedBy = 'admin') {
  if (!responseSchema || typeof responseSchema !== 'object' || Array.isArray(responseSchema)) {
    const error = new Error('responseSchema must be a JSON object.');
    error.code = 'INVALID_RESPONSE_SCHEMA';
    throw error;
  }
  return saveRouteConfigVersion(routeKey, {
    responseSchema,
    meta: { updatedBy }
  }, updatedBy);
}

export async function setLatestRouteConfig(routeKey, { id, version } = {}) {
  ensureRouteKey(routeKey);
  if (await shouldUseMongoRouteConfigStore()) {
    const query = { routeKey };
    if (id) {
      query._id = id;
    } else if (Number.isFinite(Number(version))) {
      query.version = Number(version);
    } else {
      const error = new Error('Provide id or version to set latest route config.');
      error.code = 'INVALID_ROUTE_SELECTION';
      throw error;
    }

    const selected = await LlmRouteConfigVersion.findOne(query);
    if (!selected) {
      const error = new Error('Route config version not found.');
      error.code = 'ROUTE_CONFIG_VERSION_NOT_FOUND';
      throw error;
    }

    await LlmRouteConfigVersion.updateMany(
      { routeKey, isLatest: true },
      { $set: { isLatest: false } }
    );
    selected.isLatest = true;
    await selected.save();
    return getRouteConfig(routeKey);
  }

  const store = await readRouteConfigStoreFile();
  const docs = Array.isArray(store.routes[routeKey]) ? store.routes[routeKey] : [];
  const normalizedDocs = docs.map((doc) => normalizeStoredRouteConfigDoc(routeKey, doc));
  const selectedIndex = normalizedDocs.findIndex((doc) =>
    (id && doc.id === id) || (!id && Number.isFinite(Number(version)) && doc.version === Number(version))
  );

  if (selectedIndex < 0) {
    const error = new Error('Route config version not found.');
    error.code = 'ROUTE_CONFIG_VERSION_NOT_FOUND';
    throw error;
  }

  const now = new Date().toISOString();
  store.routes[routeKey] = sortRouteConfigDocs(normalizedDocs.map((doc, index) => ({
    ...doc,
    isLatest: index === selectedIndex,
    updatedAt: index === selectedIndex ? now : doc.updatedAt
  })));
  await writeRouteConfigStoreFile(store);
  return getRouteConfig(routeKey);
}

export async function resetRouteConfig(routeKey, updatedBy = 'admin') {
  ensureRouteKey(routeKey);
  const defaults = DEFAULT_ROUTE_CONFIGS[routeKey];
  return saveRouteConfigVersion(routeKey, {
    promptMode: defaults.promptMode,
    promptTemplate: defaults.promptTemplate,
    promptCore: defaults.promptCore,
    responseSchema: defaults.responseSchema,
    fieldDocs: defaults.fieldDocs,
    examplePayload: defaults.examplePayload,
    outputRules: defaults.outputRules,
    meta: {
      updatedBy,
      resetToDefaults: true
    }
  }, updatedBy);
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

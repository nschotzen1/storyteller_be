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

const TYPEWRITER_KEY_VERIFICATION_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['allowed'],
  properties: {
    allowed: { type: 'boolean' },
    reason: { type: 'string' }
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

const IMMERSIVE_RPG_NOTEBOOK_SCHEMA = {
  type: 'object',
  required: [
    'mode',
    'title',
    'prompt',
    'instruction',
    'scratch_lines',
    'focus_tags',
    'pending_roll',
    'dice_faces',
    'success_track',
    'result_summary',
    'updated_at'
  ],
  properties: {
    mode: {
      type: 'string',
      enum: ['idle', 'story_prompt', 'roll_request', 'roll_result', 'discovery']
    },
    title: { type: 'string', minLength: 1 },
    prompt: { type: 'string' },
    instruction: { type: 'string' },
    scratch_lines: {
      type: 'array',
      items: { type: 'string' }
    },
    focus_tags: {
      type: 'array',
      items: { type: 'string' }
    },
    pending_roll: {
      anyOf: [
        IMMERSIVE_RPG_PENDING_ROLL_SCHEMA,
        { type: 'null' }
      ]
    },
    dice_faces: {
      type: 'array',
      items: { type: 'integer', minimum: 1 }
    },
    success_track: {
      anyOf: [
        {
          type: 'object',
          required: ['successes', 'successes_required', 'passed'],
          properties: {
            successes: { type: 'integer', minimum: 0 },
            successes_required: { type: 'integer', minimum: 1 },
            passed: {
              anyOf: [
                { type: 'boolean' },
                { type: 'null' }
              ]
            }
          },
          additionalProperties: true
        },
        { type: 'null' }
      ]
    },
    result_summary: { type: 'string' },
    updated_at: { type: 'string', minLength: 1 }
  },
  additionalProperties: true
};

const IMMERSIVE_RPG_TURN_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['gm_reply', 'current_beat', 'should_pause_for_choice', 'notebook', 'stage_layout', 'stage_modules', 'scene_flags_patch'],
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
    notebook: IMMERSIVE_RPG_NOTEBOOK_SCHEMA,
    stage_layout: {
      type: 'string',
      enum: ['focus-left', 'focus-right', 'triptych', 'stacked']
    },
    stage_modules: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        required: ['module_id', 'type', 'variant', 'title', 'caption', 'image_url', 'alt_text', 'emphasis', 'rotate_deg', 'tone', 'body', 'meta'],
        properties: {
          module_id: { type: 'string', minLength: 1 },
          type: {
            type: 'string',
            enum: ['illustration', 'evidence_note', 'quote_panel']
          },
          variant: { type: 'string', minLength: 1 },
          title: { type: 'string' },
          caption: { type: 'string' },
          image_url: { type: 'string' },
          alt_text: { type: 'string' },
          emphasis: { type: 'string' },
          rotate_deg: { type: 'number', minimum: -12, maximum: 12 },
          tone: { type: 'string' },
          body: { type: 'string' },
          meta: {
            type: 'object',
            additionalProperties: true
          }
        },
        additionalProperties: true
      }
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

const SEER_ORCHESTRATOR_TOOL_CALL_SCHEMA = {
  type: 'object',
  required: ['tool_id', 'input'],
  properties: {
    tool_id: { type: 'string', minLength: 1 },
    reason: { type: 'string' },
    input: {
      type: 'object',
      additionalProperties: true
    }
  },
  additionalProperties: true
};

const SEER_ORCHESTRATOR_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['spoken_message', 'transition_type', 'beat', 'tool_calls', 'ui', 'state_patch'],
  properties: {
    spoken_message: { type: 'string', minLength: 1 },
    transition_type: {
      type: 'string',
      enum: [
        'reveal',
        'focus_shift',
        'relation_proposed',
        'relation_strengthened',
        'relation_rejected',
        'new_entity_created',
        'new_entity_suggested',
        'synthesis',
        'dead_end',
        'apparition_offer',
        'closure'
      ]
    },
    beat: { type: 'string', minLength: 1 },
    tool_calls: {
      type: 'array',
      items: SEER_ORCHESTRATOR_TOOL_CALL_SCHEMA
    },
    ui: {
      type: 'object',
      properties: {
        focus_memory_id: { type: 'string' },
        reveal_fields: {
          type: 'array',
          items: { type: 'string' }
        },
        suggested_entity_labels: {
          type: 'array',
          items: { type: 'string' }
        },
        composer_mode: { type: 'string' },
        suggestions: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      additionalProperties: true
    },
    state_patch: {
      type: 'object',
      properties: {
        clarity_delta: { type: 'number' },
        reveal_tier_delta: { type: 'number' },
        focus_memory_id: { type: 'string' },
        unresolved_threads: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      additionalProperties: true
    }
  },
  additionalProperties: true
};

const ROUTE_KEY_ALIASES = Object.freeze({
  immersive_rpg_turn: Object.freeze(['immersive_rpg_chat'])
});

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
    description: 'Generate a short storyteller entrance/intervention plus one new pressable textual typewriter key.',
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

Your role in this intervention:
- Enter as an added observer with your own narrative voice, as if you had been nearby all along.
- If you were not introduced before, introduce yourself briefly and naturally in-world.
- Notice one precise detail in the current fragment.
- Something about that detail should trouble, remind, or alert you because of what you already know about this storytelling universe.
- From that realization, introduce exactly one new entity that is NOT explicitly mentioned in the current fragment.
- That entity may be any broad NER-like thing: item, location, person, flora, fauna, event, creature, relic, force, ritual, sign, etc.
- Say what you already know or suspect about that entity.
- Then leave the scene, allowing the original narrative to continue after you withdraw.

Narrative rules:
- Do not retell or summarize the whole fragment.
- Do not take over the main narrative for long.
- Do not explain mechanics or mention players, prompts, APIs, JSON, or typewriters.
- Do not make the intervention feel like exposition notes; it must feel like living prose.
- The new entity must feel specifically connected to something in the fragment, not randomly inserted.
- The storyteller should sound observant, precise, slightly haunted, and already familiar with the wider world.
- The intervention should begin with presence, move to recognition, then to the new entity, then to withdrawal.

Length:
- Keep it concise: about 55-120 words.

Writing guidance:
- Prefer first-person voice for the storyteller.
- Ground the intervention in one concrete sensory or visual cue from the fragment.
- Introduce only one fresh entity.
- Give that entity one memorable, concrete association or danger.
- End with a graceful exit, not a cliffhanger speech.

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
    "key_text": "1-3 words, suitable for a small pressable textual typewriter key",
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
      continuation: '55-120 words, in-world, seamless entrance and exit.',
      'entity.key_text': '1-3 words, compact enough for a pressable typewriter text key.',
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
      'entity.key_text must be concise and readable at small typewriter key size',
      'style.font_color must be dark and highly legible on parchment'
    ],
    responseSchema: STORYTELLER_INTERVENTION_RESPONSE_SCHEMA
  },
  typewriter_key_verification: {
    routeKey: 'typewriter_key_verification',
    routePath: '/api/typewriter/keys/shouldAllow',
    method: 'POST',
    description: 'Judge whether a saved textual typewriter key may be appended to the current narrative.',
    promptMode: 'manual',
    promptTemplate: `You are judging whether a saved textual typewriter key may be appended to a live narrative.

Current narrative:
"""
{{current_narrative}}
"""

Candidate narrative after appending the key text:
"""
{{candidate_narrative}}
"""

Key label shown on the keyboard: "{{key_text}}"
Exact text to append: "{{insert_text}}"
Source type: "{{source_type}}"

Entity context:
- Name: {{entity_name}}
- Description: {{entity_description}}
- Lore: {{entity_lore}}
- Type: {{entity_type}}
- Subtype: {{entity_subtype}}

Return JSON only in this exact shape:
{
  "allowed": true,
  "reason": "Optional short explanation"
}

Rules:
- Approve only when appending the key text at the end feels natural, supported, and tonally coherent.
- Reject when the addition feels abrupt, redundant, contradictory, or unsupported by the current fragment.
- Prefer restraint. This is an insertion check, not a worldbuilding opportunity.
- The entity context is background guidance only. Do not force the key in just because the entity is interesting.
- Keep reason short and practical if provided.`,
    promptCore: '',
    fieldDocs: {
      allowed: 'Boolean verdict for whether the key may append its insert_text to the current narrative.',
      reason: 'Optional short explanation for debugging or admin visibility.'
    },
    examplePayload: {
      allowed: true,
      reason: 'The sea-light anomaly is already present, so the key extends the sentence naturally.'
    },
    outputRules: [
      'allowed must be a boolean',
      'reason is optional and should stay short if present'
    ],
    responseSchema: TYPEWRITER_KEY_VERIFICATION_RESPONSE_SCHEMA
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
      scene_brief: 'Only return on the final turn, once the destination scene is complete and the chat is ending.',
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
      'Only include scene_brief on the final turn when has_chat_ended is true.',
      'scene_brief.subject must be concise and easy to browse later in Mongo.'
    ],
    responseSchema: {
      type: 'object',
      required: ['has_chat_ended', 'message_assistant'],
      properties: {
        has_chat_ended: { type: 'boolean' },
        message_assistant: { type: 'string', minLength: 1 },
        scene_brief: MESSENGER_SCENE_BRIEF_SCHEMA
      },
      additionalProperties: true
    }
  },
  immersive_rpg_turn: {
    routeKey: 'immersive_rpg_turn',
    routePath: '/api/immersive-rpg/chat',
    method: 'POST',
    description: 'Reserved GM structured-output contract for the immersive RPG turn loop.',
    promptMode: 'manual',
    promptTemplate: getDefaultImmersiveRpgGmPromptTemplate(),
    promptCore: '',
    fieldDocs: {
      gm_reply: 'The next atmospheric GM response shown to the player.',
      current_beat: 'Scene-state beat identifier to persist into Mongo.',
      should_pause_for_choice: 'True when the GM should stop and wait for the PC to answer "What do you do?"',
      pending_roll: 'Include when a roll must be persisted for mechanical resolution. Keep it aligned with notebook.pending_roll.',
      'pending_roll.context_key': 'Stable key for roll resolution logic.',
      notebook: 'Structured notebook state for the square paper panel in the UI. Always include it.',
      'notebook.mode': 'Use story_prompt for atmosphere, roll_request when a roll is pending, and roll_result after a roll has been resolved.',
      'notebook.pending_roll': 'Duplicate the active roll request here when notebook.mode is roll_request.',
      'notebook.scratch_lines': 'Short handwritten-style notes or stakes to draw on the notebook.',
      'notebook.dice_faces': 'Leave empty until a roll result exists.',
      'notebook.success_track': 'Show current successes and required successes; passed can be null before a roll.',
      stage_layout: 'Pick a supported visual layout for the stage module area: focus-left, focus-right, triptych, or stacked.',
      stage_modules: 'Return 1-4 stage modules that the UI can render in the scene collage. Favor 1-3 illustration modules plus optional note/quote support.',
      'stage_modules[].type': 'Use illustration for pictures, evidence_note for handwritten inserts, and quote_panel for typed or quoted atmospheric fragments.',
      'stage_modules[].image_url': 'For illustration modules, provide an image or mock asset URL. Leave blank for non-image modules.',
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
      notebook: {
        mode: 'roll_request',
        title: 'Journal Margin Test',
        prompt: 'The journal is within reach, but only for a moment.',
        instruction:
          'Roll 5d6 Awareness. Count 5s and 6s as successes. You need 2 successes to reach the journal, see enough of it, and stay unnoticed.',
        scratch_lines: [
          'Failure means the stranger catches the movement.',
          'Success buys only a few seconds with the pages.'
        ],
        focus_tags: ['awareness', 'speed', 'concealment'],
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
        dice_faces: [],
        success_track: {
          successes: 0,
          successes_required: 2,
          passed: null
        },
        result_summary: 'Awaiting roll.',
        updated_at: '2026-03-10T10:00:00.000Z'
      },
      stage_layout: 'focus-left',
      stage_modules: [
        {
          module_id: 'opening-terrain',
          type: 'illustration',
          variant: 'landscape',
          title: 'Approach to Home',
          caption: 'The house is close enough to promise safety, which makes the stranger’s presence worse.',
          image_url: '/assets/mocks/memory_cards/memory_front_01.png',
          alt_text: 'Atmospheric illustration of the path leading toward home.',
          emphasis: 'primary',
          rotate_deg: -2,
          tone: 'uneasy',
          body: '',
          meta: {}
        },
        {
          module_id: 'opening-journal',
          type: 'illustration',
          variant: 'polaroid',
          title: 'Fallen Journal',
          caption: 'Half-screened by brush, better seen from the PC angle than the stranger’s.',
          image_url: '/assets/mocks/memory_cards/memory_front_02.png',
          alt_text: 'Close view of a journal lying partly hidden near the path.',
          emphasis: 'secondary',
          rotate_deg: 3,
          tone: 'watchful',
          body: '',
          meta: {}
        },
        {
          module_id: 'opening-note',
          type: 'evidence_note',
          variant: 'scribble',
          title: 'Keeper Margin',
          caption: 'Pace the dread.',
          image_url: '',
          alt_text: '',
          emphasis: 'secondary',
          rotate_deg: -1,
          tone: 'gaslight',
          body: 'The place is ordinary enough to be intimate. The intrusion must arrive by degrees, not all at once.',
          meta: {}
        }
      ],
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
      'If a roll is required, include pending_roll and set notebook.mode to roll_request with matching notebook.pending_roll.',
      'If no roll is required, notebook should still carry atmospheric handwritten notes for the current state.',
      'Always choose a supported stage_layout and provide stage_modules that visually reinforce the current beat.',
      'Stage modules are declarative UI instructions, not prose comments. Keep them renderable by the client without code execution.',
      'GM output must stay in-world and must not mention prompts, APIs, JSON, or tooling.'
    ],
    responseSchema: IMMERSIVE_RPG_TURN_RESPONSE_SCHEMA
  },
  seer_reading_orchestrator: {
    routeKey: 'seer_reading_orchestrator',
    routePath: '/api/seer/readings/:readingId/turn',
    method: 'POST',
    description: 'Reserved tool-using orchestrator contract for Seer Reading turns.',
    promptMode: 'manual',
    promptTemplate: `You are the Seer Reading Orchestrator.

You are not merely narrating. You are deciding one ritual move for a single turn.

You receive:
- the current reading state
- the focused memory
- the player reply
- the currently available tools

Your job:
- make exactly one primary consequence happen this turn
- keep the seer voice specific, ritual, and world-facing
- prefer precision over verbosity
- preserve ambiguity when it is dramatically stronger than certainty
- use only tools that are actually available

Potential tools may include:
- focus_memory
- reveal_memory_tier
- create_entity
- propose_relation
- invoke_storyteller
- create_world_truth
- close_reading
- roll_dice

Rules:
- one turn, one dominant consequence
- do not reveal everything at once
- if you create a new entity, make it reusable in later worldbuilding
- if no tool should fire, return an intentional dead_end with a sharper spoken question

Return JSON only in the configured schema.`,
    promptCore: '',
    fieldDocs: {
      spoken_message: 'What the seer says aloud to the player for this turn.',
      transition_type: 'The single dominant ritual consequence.',
      tool_calls: 'Explicit tool invocations the runtime should execute.',
      ui: 'Minimal UI directives for focus, reveal, and composer hints.',
      state_patch: 'Small deterministic state changes implied by the turn.'
    },
    examplePayload: {
      spoken_message: 'The rope is not merely seen. It is recognized. The glimpse leans toward Maris Kest.',
      transition_type: 'relation_strengthened',
      beat: 'seer_question_pending',
      tool_calls: [
        {
          tool_id: 'propose_relation',
          reason: 'The player identified the actor behind the sign.',
          input: {
            memory_id: 'memory-during',
            entity_label: 'Maris Kest',
            rationale: 'The rope is recognized as hers.'
          }
        }
      ],
      ui: {
        focus_memory_id: 'memory-during',
        suggested_entity_labels: ['Maris Kest', 'braided rope'],
        composer_mode: 'tagged_inference',
        suggestions: ['recognition', 'warning', 'concealment']
      },
      state_patch: {
        clarity_delta: 0.12,
        reveal_tier_delta: 0,
        focus_memory_id: 'memory-during',
        unresolved_threads: []
      }
    },
    outputRules: [
      'Return JSON only.',
      'Choose exactly one dominant transition_type.',
      'tool_calls must only reference tools that the runtime made available.',
      'spoken_message should sound like an authored seer, not a generic assistant.'
    ],
    responseSchema: SEER_ORCHESTRATOR_RESPONSE_SCHEMA
  },
  quest_advance: {
    routeKey: 'quest_advance',
    routePath: '/api/quest/advance',
    method: 'POST',
    description: 'Generate a persistent quest child screen and matching GM surface for a player prompt.',
    promptMode: 'manual',
    promptTemplate: `You are a quest scene designer for a King's Quest-like adventure. Return JSON only.
The quest uses a stable authored map with local generated child scenes.

Current screen:
- id: {{currentScreenId}}
- title: {{currentScreenTitle}}
- screen_type: {{currentScreenType}}
- prompt: {{currentScreenPrompt}}
- image_prompt: {{currentScreenImagePrompt}}
- expectation_summary: {{currentScreenExpectationSummary}}
- continuity_summary: {{currentScreenContinuitySummary}}
- directions: {{currentDirections}}

Anchor screen:
- id: {{anchorScreenId}}
- title: {{anchorScreenTitle}}
- prompt: {{anchorScreenPrompt}}
- image_prompt: {{anchorScreenImagePrompt}}

Recent traversal:
{{recentTraversal}}

Player action:
{{playerPrompt}}

Return one JSON object with these exact keys:
- title
- prompt
- image_prompt
- text_prompt_placeholder
- expectation_summary
- continuity_summary
- direction_label
- stage_layout
- stage_modules

Rules:
- Keep continuity with the current screen and anchor area.
- This is a local discovery or branch, not a teleport to a different region.
- Preserve architecture, weather, time of day, and mood from the current area in image_prompt.
- direction_label should read like a short UI button label.
- stage_layout must be one of: focus-left, focus-right, triptych, stacked.
- stage_modules must be 1 to 4 declarative modules that the existing client can render directly.
- Do not mention JSON, APIs, prompts, schemas, tools, or models in player-facing text.
Output JSON only.`,
    promptCore: '',
    fieldDocs: {
      title: 'Short title for the generated child scene.',
      prompt: 'Main scene text shown on the quest screen.',
      image_prompt: 'Text-to-image prompt for the generated scene; preserve area continuity.',
      text_prompt_placeholder: 'Prompt-box helper text for the next action.',
      expectation_summary: 'Short summary of what the player can expect in this branch.',
      continuity_summary: 'Short continuity note connecting this branch to the current and anchor screen.',
      direction_label: 'Label for the new prompt-created direction button on the parent screen.',
      stage_layout: 'Supported layout for the GM surface: focus-left, focus-right, triptych, or stacked.',
      stage_modules: 'Declarative 1-4 item stage module array for the existing immersive RPG renderer.'
    },
    examplePayload: {
      title: 'Lantern Niche',
      prompt:
        'Behind the cracked mural niche, the lantern has collapsed into a bed of cold brass petals and soot. A draft moves through the stonework from somewhere deeper in the wall, carrying dust, old wax, and the sense that this recess was opened and closed many times before you found it.',
      image_prompt:
        'Cinematic fantasy ruined rose-court mural wall at dusk, same weathered stone and twilight mood as the parent scene, but now revealing a cracked lantern niche with collapsed brass petals, soot, drifting dust, and a hidden draft in the wall, tactile realism, moody continuity.',
      text_prompt_placeholder: 'What do you do with the niche?',
      expectation_summary: 'A close discovery nested inside the mural wall, with evidence of hidden use and a possible further opening.',
      continuity_summary: 'This branch remains inside the same gate mural chamber and extends the player’s inspection into a newly revealed recess.',
      direction_label: 'Inspect the lantern niche',
      stage_layout: 'focus-left',
      stage_modules: [
        {
          module_id: 'lantern-niche-illustration',
          type: 'illustration',
          variant: 'landscape',
          title: 'Lantern Niche',
          caption: 'A hidden recess opens behind the mural stones.',
          image_url: '/assets/mocks/memory_cards/memory_front_01.png',
          alt_text: 'A hidden lantern niche revealed behind ruined mural stone.',
          emphasis: 'primary',
          rotate_deg: -1,
          tone: 'dusty',
          body: '',
          meta: {}
        },
        {
          module_id: 'lantern-niche-note',
          type: 'evidence_note',
          variant: 'scribble',
          title: 'GM Note',
          caption: 'Local branch',
          image_url: '',
          alt_text: '',
          emphasis: 'secondary',
          rotate_deg: 1,
          tone: 'quest',
          body: 'The discovery stays inside the same geography and suggests a further opening.',
          meta: {}
        }
      ]
    },
    outputRules: [
      'Favor local discoveries, hidden recesses, overheard traces, or tight scene extensions over remote location changes.',
      'Expectation and continuity summaries should be brief and legible in UI.',
      'Stage modules are UI instructions, not internal commentary.'
    ],
    responseSchema: {
      type: 'object',
      required: [
        'title',
        'prompt',
        'image_prompt',
        'text_prompt_placeholder',
        'expectation_summary',
        'continuity_summary',
        'direction_label',
        'stage_layout',
        'stage_modules'
      ],
      properties: {
        title: { type: 'string', minLength: 1 },
        prompt: { type: 'string', minLength: 1 },
        image_prompt: { type: 'string', minLength: 1 },
        text_prompt_placeholder: { type: 'string', minLength: 1 },
        expectation_summary: { type: 'string', minLength: 1 },
        continuity_summary: { type: 'string', minLength: 1 },
        direction_label: { type: 'string', minLength: 1 },
        stage_layout: IMMERSIVE_RPG_TURN_RESPONSE_SCHEMA.properties.stage_layout,
        stage_modules: IMMERSIVE_RPG_TURN_RESPONSE_SCHEMA.properties.stage_modules
      },
      additionalProperties: true
    }
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

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((entry) => `${entry || ''}`.trim())
      .filter(Boolean)
  )];
}

function normalizeMessengerChatResponseSchema(responseSchema, fallbackSchema) {
  const schema = normalizeJsonValue(responseSchema, fallbackSchema || {});
  const fallback = normalizeJsonValue(fallbackSchema, {});
  const schemaProperties = asObject(schema?.properties);
  const fallbackProperties = asObject(fallback?.properties);
  const required = normalizeStringList(schema?.required).filter((key) => key !== 'scene_brief');

  return {
    ...schema,
    type: 'object',
    required: normalizeStringList(['has_chat_ended', 'message_assistant', ...required]),
    properties: {
      ...fallbackProperties,
      ...schemaProperties,
      has_chat_ended: normalizeJsonValue(
        schemaProperties.has_chat_ended,
        fallbackProperties.has_chat_ended || { type: 'boolean' }
      ),
      message_assistant: normalizeJsonValue(
        schemaProperties.message_assistant,
        fallbackProperties.message_assistant || { type: 'string', minLength: 1 }
      ),
      scene_brief: normalizeJsonValue(
        schemaProperties.scene_brief,
        fallbackProperties.scene_brief
      )
    },
    additionalProperties: schema?.additionalProperties !== undefined ? schema.additionalProperties : true
  };
}

function normalizeMessengerChatFieldDocs(fieldDocs, fallbackFieldDocs = {}) {
  const normalized = normalizeFieldDocs(fieldDocs);
  return {
    ...normalized,
    message_assistant: fallbackFieldDocs.message_assistant || normalized.message_assistant || '',
    scene_brief: fallbackFieldDocs.scene_brief || normalized.scene_brief || '',
    'scene_brief.subject': fallbackFieldDocs['scene_brief.subject'] || normalized['scene_brief.subject'] || '',
    'scene_brief.place_summary': fallbackFieldDocs['scene_brief.place_summary'] || normalized['scene_brief.place_summary'] || '',
    'scene_brief.typewriter_hiding_spot':
      fallbackFieldDocs['scene_brief.typewriter_hiding_spot']
      || normalized['scene_brief.typewriter_hiding_spot']
      || ''
  };
}

function normalizeMessengerChatOutputRules(outputRules, fallbackOutputRules = []) {
  const rules = normalizeOutputRules(outputRules)
    .filter((rule) => !/scene_brief|has_chat_ended/i.test(rule));
  return normalizeStringList([...rules, ...normalizeOutputRules(fallbackOutputRules)]);
}

function applyRouteConfigCompatibility(routeKey, config = {}, defaultConfig = {}) {
  if (routeKey !== 'messenger_chat') {
    return config;
  }

  return {
    ...config,
    responseSchema: normalizeMessengerChatResponseSchema(
      config.responseSchema,
      defaultConfig.responseSchema || {}
    ),
    fieldDocs: normalizeMessengerChatFieldDocs(
      config.fieldDocs,
      defaultConfig.fieldDocs || {}
    ),
    outputRules: normalizeMessengerChatOutputRules(
      config.outputRules,
      defaultConfig.outputRules || []
    )
  };
}

function getRouteKeyCandidates(routeKey) {
  return [routeKey, ...(ROUTE_KEY_ALIASES[routeKey] || [])];
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
  const compatibleConfig = applyRouteConfigCompatibility(defaults.routeKey, {
    responseSchema: normalizeJsonValue(doc?.responseSchema, defaults.responseSchema || {}),
    fieldDocs: normalizeFieldDocs(doc?.fieldDocs ?? defaults.fieldDocs),
    outputRules: normalizeOutputRules(doc?.outputRules ?? defaults.outputRules)
  }, defaults);
  const fieldDocs = compatibleConfig.fieldDocs;
  const outputRules = compatibleConfig.outputRules;
  const responseSchema = compatibleConfig.responseSchema;
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
  const routeKeys = getRouteKeyCandidates(routeKey);
  if (await shouldUseMongoRouteConfigStore()) {
    const docs = await LlmRouteConfigVersion.find({
      routeKey: { $in: routeKeys },
      isLatest: true
    }).lean();

    return sortRouteConfigDocs(docs).sort((left, right) => {
      const leftPriority = routeKeys.indexOf(left.routeKey);
      const rightPriority = routeKeys.indexOf(right.routeKey);
      return leftPriority - rightPriority;
    })[0] || null;
  }

  const docs = [];
  for (const candidate of routeKeys) {
    docs.push(...(await getStoredRouteConfigVersions(candidate)));
  }

  return sortRouteConfigDocs(docs).sort((left, right) => {
    const leftPriority = routeKeys.indexOf(left.routeKey);
    const rightPriority = routeKeys.indexOf(right.routeKey);
    return leftPriority - rightPriority;
  }).find((doc) => doc.isLatest) || sortRouteConfigDocs(docs)[0] || null;
}

export function getSupportedRouteKeys() {
  return Object.keys(DEFAULT_ROUTE_CONFIGS);
}

export async function listRouteConfigs() {
  const byRouteKey = {};
  for (const routeKey of getSupportedRouteKeys()) {
    const latestDoc = await findLatestRouteDoc(routeKey);
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

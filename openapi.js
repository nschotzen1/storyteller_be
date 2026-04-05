import {
  FRAGMENT_MEMORY_JSON_SCHEMA,
  FRAGMENT_TO_MEMORIES_RESPONSE_SCHEMA
} from './contracts/fragmentMemoryContract.js';
import {
  NARRATIVE_ENTITY_JSON_SCHEMA,
  NARRATIVE_ENTITY_LIST_RESPONSE_SCHEMA
} from './contracts/narrativeEntityContract.js';
import {
  TYPEWRITER_KEY_JSON_SCHEMA,
  TYPEWRITER_KEY_LIST_RESPONSE_SCHEMA
} from './contracts/typewriterKeyContract.js';

const pathParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description
});

const queryParam = (name, required, description) => ({
  name,
  in: 'query',
  required,
  schema: { type: 'string' },
  description
});

const STORYTELLER_PROMPT_EXAMPLE = `You are the keeper of the Storyteller Society.
Summon {{storytellerCount}} distinct storytellers for this fragment:
"{{fragmentText}}"`;

const LLM_ROUTE_CONFIG_EXAMPLE = {
  id: '67ce00000000000000000001',
  routeKey: 'text_to_storyteller',
  routePath: '/api/textToStoryteller',
  method: 'POST',
  description: 'Generate storyteller personas from a fragment.',
  promptMode: 'contract',
  promptTemplate: `${STORYTELLER_PROMPT_EXAMPLE}\n\nReturn JSON only.`,
  compiledPromptTemplate: `${STORYTELLER_PROMPT_EXAMPLE}\n\nReturn JSON only.`,
  promptCore: STORYTELLER_PROMPT_EXAMPLE,
  fieldDocs: {
    'storytellers[].name': 'Distinct, evocative name.'
  },
  examplePayload: {
    storytellers: [
      {
        name: 'The Veil Cartographer'
      }
    ]
  },
  outputRules: ['Do not use readable text in typewriter_key.symbol.'],
  responseSchema: {
    type: 'object',
    required: ['storytellers'],
    properties: {
      storytellers: { type: 'array' }
    }
  },
  version: 4,
  isLatest: true,
  createdBy: 'story-admin-ui',
  createdAt: '2026-03-08T12:00:00.000Z',
  updatedAt: '2026-03-08T12:00:00.000Z',
  meta: {
    source: 'mongo',
    updatedBy: 'story-admin-ui',
    updatedAt: '2026-03-08T12:00:00.000Z'
  }
};

const SEER_TRANSCRIPT_ENTRY_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    role: { type: 'string', example: 'seer' },
    kind: { type: 'string', example: 'invocation' },
    content: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: true
};

const SEER_CARD_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    kind: { type: 'string', example: 'event' },
    title: { type: 'string', example: 'The Flight With The Kept Thing' },
    label: { type: 'string', example: 'The Flight With The Kept Thing' },
    status: { type: 'string', example: 'sharpening' },
    focusState: { type: 'string', example: 'active' },
    clarity: { type: 'number', minimum: 0, maximum: 1 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    revealTier: { type: 'integer', minimum: 0 },
    likelyRelationHint: { type: 'string' },
    linkedEntityIds: {
      type: 'array',
      items: { type: 'string' }
    },
    back: {
      type: 'object',
      additionalProperties: true
    },
    front: {
      type: 'object',
      additionalProperties: true
    }
  },
  additionalProperties: true
};

const SEER_MEMORY_EVIDENCE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    sourceMemoryId: { type: 'string' },
    temporalSlot: { type: 'string', example: 'during' },
    strength: { type: 'string', example: 'vivid' },
    clarity: { type: 'number', minimum: 0, maximum: 1 },
    revealTier: { type: 'integer', minimum: 0 },
    focusState: { type: 'string', example: 'idle' },
    visibleFields: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  additionalProperties: true
};

const SEER_CLAIMED_ENTITY_LINK_SCHEMA = {
  type: 'object',
  properties: {
    cardId: { type: 'string' },
    cardKind: { type: 'string' },
    cardTitle: { type: 'string' },
    entityId: { type: 'string' },
    entityExternalId: { type: 'string' },
    worldId: { type: 'string' },
    universeId: { type: 'string' },
    claimedAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: true
};

const TEXT_TO_ENTITY_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sessionId', 'count', 'requestedCount', 'desiredEntityCategories', 'entities', 'mocked', 'mockedEntities', 'mockedTextures', 'runtime'],
  properties: {
    sessionId: { type: 'string' },
    count: { type: 'integer', minimum: 0 },
    requestedCount: { type: 'integer', minimum: 1 },
    desiredEntityCategories: {
      type: 'array',
      items: { type: 'string' }
    },
    entities: {
      type: 'array',
      items: NARRATIVE_ENTITY_JSON_SCHEMA
    },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    },
    cardOptions: {
      type: 'object',
      properties: {
        includeFront: { type: 'boolean' },
        includeBack: { type: 'boolean' }
      },
      additionalProperties: true
    },
    mocked: { type: 'boolean' },
    mockedEntities: { type: 'boolean' },
    mockedTextures: { type: 'boolean' },
    runtime: {
      type: 'object',
      additionalProperties: true
    }
  },
  additionalProperties: true
};

const STORYTELLER_MISSION_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sessionId', 'storytellerId', 'outcome', 'entity', 'subEntities', 'characterSheet', 'runtime'],
  properties: {
    sessionId: { type: 'string' },
    storytellerId: { type: 'string' },
    outcome: { type: 'string', enum: ['success', 'failure', 'delayed', 'pending'] },
    userText: { type: 'string' },
    gmNote: { type: 'string' },
    entity: NARRATIVE_ENTITY_JSON_SCHEMA,
    subEntities: {
      type: 'array',
      items: NARRATIVE_ENTITY_JSON_SCHEMA
    },
    characterSheet: { $ref: '#/components/schemas/ImmersiveRpgCharacterSheet' },
    runtime: {
      type: 'object',
      additionalProperties: true
    }
  },
  additionalProperties: true
};

const SEER_READING_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['readingId', 'sessionId', 'status', 'beat', 'cards', 'transcript'],
  properties: {
    readingId: { type: 'string' },
    sessionId: { type: 'string' },
    playerId: { type: 'string' },
    worldId: { type: 'string' },
    universeId: { type: 'string' },
    status: { type: 'string', example: 'active' },
    beat: { type: 'string', example: 'card_attunement' },
    fragment: {
      type: 'object',
      additionalProperties: true
    },
    vision: {
      type: 'object',
      additionalProperties: true
    },
    seer: {
      type: 'object',
      additionalProperties: true
    },
    memories: {
      type: 'array',
      items: SEER_MEMORY_EVIDENCE_SCHEMA
    },
    cards: {
      type: 'array',
      items: SEER_CARD_SCHEMA
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    },
    apparitions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    },
    spread: {
      type: 'object',
      additionalProperties: true
    },
    transcript: {
      type: 'array',
      items: SEER_TRANSCRIPT_ENTRY_SCHEMA
    },
    subjectDialog: {
      type: 'array',
      items: SEER_TRANSCRIPT_ENTRY_SCHEMA
    },
    claimedCards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    },
    claimedEntityLinks: {
      type: 'array',
      items: SEER_CLAIMED_ENTITY_LINK_SCHEMA
    },
    unresolvedThreads: {
      type: 'array',
      items: { type: 'string' }
    },
    worldbuildingOutputs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    },
    metadata: {
      type: 'object',
      additionalProperties: true
    },
    focus: {
      type: 'object',
      additionalProperties: true
    },
    composer: {
      type: 'object',
      additionalProperties: true
    },
    orchestrator: {
      type: 'object',
      additionalProperties: true
    },
    lastTurn: {
      type: 'object',
      additionalProperties: true
    },
    characterSheet: { $ref: '#/components/schemas/ImmersiveRpgCharacterSheet' },
    version: { type: 'integer', minimum: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: true
};

const SEER_READING_CREATE_REQUEST_SCHEMA = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: { type: 'string' },
    playerId: { type: 'string' },
    text: { type: 'string' },
    readingId: { type: 'string' },
    batchId: { type: 'string' },
    worldId: { type: 'string' },
    universeId: { type: 'string' },
    cardCount: { type: 'integer', minimum: 1, maximum: 10 },
    cardKinds: { type: 'array', items: { type: 'string' } },
    preferredCardKinds: { type: 'array', items: { type: 'string' } },
    allowedCardKinds: { type: 'array', items: { type: 'string' } },
    visionMemoryId: { type: 'string' },
    mock: { type: 'boolean' },
    mock_api_calls: { type: 'boolean' },
    mocked_api_calls: { type: 'boolean' }
  },
  additionalProperties: true
};

const SEER_READING_TURN_REQUEST_SCHEMA = {
  type: 'object',
  required: ['action'],
  properties: {
    playerId: { type: 'string' },
    action: {
      type: 'string',
      enum: ['answer', 'focus_card', 'focus_memory']
    },
    message: { type: 'string' },
    focusCardId: { type: 'string' },
    focusMemoryId: { type: 'string' },
    entityId: { type: 'string' }
  },
  additionalProperties: true
};

const SEER_READING_CLOSE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    playerId: { type: 'string' },
    reason: { type: 'string' }
  },
  additionalProperties: true
};

const op = ({ summary, importance, flow, ...rest }) => ({
  summary,
  description: `Importance: ${importance}. Used in flow: ${flow}.`,
  'x-importance': importance,
  'x-flow': flow,
  ...rest
});

const jsonResponse = (schema) => ({
  content: {
    'application/json': {
      schema
    }
  }
});

export function buildOpenApiSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Storyteller API',
      version: '1.1.0',
      description:
        'Operational API map with route importance and where each endpoint is used in gameplay flow.'
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'Docs', description: 'API documentation endpoints.' },
      { name: 'Admin', description: 'LLM prompt/schema management for important generation routes.' },
      { name: 'Sessions', description: 'Session lifecycle and shared arena persistence.' },
      { name: 'Seer Reading', description: 'Single-screen seer reading orchestration, card claiming, and closure.' },
      { name: 'Messenger', description: 'Messenger intake flow used to place the typewriter delivery.' },
      { name: 'Immersive RPG', description: 'Mongo-backed scene, chat, roll, and character-sheet APIs for the immersive GM/PC flow.' },
      { name: 'Quest', description: 'Quest scene graph and directional screen editing APIs.' },
      { name: 'Worldbuilding', description: 'World creation and element generation.' },
      { name: 'Generation', description: 'Entity/storyteller generation and missions.' },
      { name: 'Arena', description: 'Relationship graph and arena state.' },
      { name: 'Brewing', description: 'Multiplayer brewing mini-game and real-time events.' }
    ],
    components: {
      securitySchemes: {
        AdminApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-key'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            error: { type: 'string' }
          }
        },
        SessionPlayer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            playerId: { type: 'string' },
            playerName: { type: 'string' }
          }
        },
        ArenaEnvelope: {
          type: 'object',
          properties: {
            entities: { type: 'array', items: { type: 'object', additionalProperties: true } },
            storytellers: { type: 'array', items: { type: 'object', additionalProperties: true } },
            edges: { type: 'array', items: { type: 'object', additionalProperties: true } },
            scores: { type: 'object', additionalProperties: { type: 'number' } }
          }
        },
        LlmRouteConfig: {
          type: 'object',
          required: ['routeKey', 'routePath', 'method', 'description', 'promptTemplate', 'responseSchema'],
          properties: {
            id: { type: 'string' },
            routeKey: { type: 'string' },
            routePath: { type: 'string' },
            method: { type: 'string' },
            description: { type: 'string' },
            promptMode: { type: 'string', enum: ['manual', 'contract'] },
            promptTemplate: {
              type: 'string',
              description: 'Route-level LLM system prompt template with {{token}} placeholders.',
              example: STORYTELLER_PROMPT_EXAMPLE
            },
            compiledPromptTemplate: { type: 'string' },
            promptCore: { type: 'string' },
            fieldDocs: { type: 'object', additionalProperties: { type: 'string' } },
            examplePayload: { type: 'object', additionalProperties: true },
            outputRules: { type: 'array', items: { type: 'string' } },
            responseSchema: { type: 'object', additionalProperties: true },
            version: { type: 'number' },
            isLatest: { type: 'boolean' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
            meta: { type: 'object', additionalProperties: true }
          },
          example: LLM_ROUTE_CONFIG_EXAMPLE
        },
        SeerReadingCreateRequest: SEER_READING_CREATE_REQUEST_SCHEMA,
        SeerReadingTurnRequest: SEER_READING_TURN_REQUEST_SCHEMA,
        SeerReadingCloseRequest: SEER_READING_CLOSE_REQUEST_SCHEMA,
        SeerTranscriptEntry: SEER_TRANSCRIPT_ENTRY_SCHEMA,
        SeerCard: SEER_CARD_SCHEMA,
        SeerMemoryEvidence: SEER_MEMORY_EVIDENCE_SCHEMA,
        SeerReadingResponse: SEER_READING_RESPONSE_SCHEMA,
        FragmentMemory: FRAGMENT_MEMORY_JSON_SCHEMA,
        NarrativeEntity: NARRATIVE_ENTITY_JSON_SCHEMA,
        NarrativeEntityListResponse: NARRATIVE_ENTITY_LIST_RESPONSE_SCHEMA,
        QuestDirection: {
          type: 'object',
          required: ['direction', 'label', 'targetScreenId'],
          properties: {
            direction: { type: 'string', example: 'north' },
            label: { type: 'string', example: 'Follow the path to the arch' },
            targetScreenId: { type: 'string', example: 'broken_arch' }
          }
        },
        QuestPromptRoute: {
          type: 'object',
          required: ['targetScreenId', 'patterns'],
          properties: {
            id: { type: 'string', example: 'listen_for_signal' },
            description: { type: 'string', example: 'Typed actions about the signal should resolve to the rock screen.' },
            fromScreenIds: { type: 'array', items: { type: 'string' } },
            matchMode: { type: 'string', enum: ['any', 'all'] },
            patterns: { type: 'array', items: { type: 'string' } },
            targetScreenId: { type: 'string', example: 'rock_scatter' }
          }
        },
        QuestScreenComponentBinding: {
          type: 'object',
          required: ['componentId', 'slot'],
          properties: {
            id: { type: 'string' },
            componentId: { type: 'string', example: 'messenger' },
            slot: { type: 'string', example: 'action_button' },
            props: { type: 'object', additionalProperties: true }
          }
        },
        QuestScreen: {
          type: 'object',
          required: ['id', 'title', 'prompt', 'imageUrl', 'image_prompt', 'textPromptPlaceholder', 'directions'],
          properties: {
            id: { type: 'string', example: 'cliff_path' },
            title: { type: 'string', example: 'Ivy Pass' },
            prompt: { type: 'string', example: 'The cliff path narrows beside ruined masonry.' },
            imageUrl: { type: 'string', example: '/ruin_south_a.png' },
            image_prompt: {
              type: 'string',
              example: 'Cinematic fantasy cliff path along ruined rose-court wall at sunset, weathered stones and moody atmosphere.'
            },
            referenceImagePrompt: { type: 'string' },
            promptGuidance: { type: 'string' },
            sceneEndCondition: { type: 'string' },
            visualContinuityGuidance: { type: 'string' },
            visualTransitionIntent: { type: 'string', enum: ['inherit', 'drift', 'break'] },
            textPromptPlaceholder: { type: 'string', example: 'What do you say into the dusk?' },
            componentBindings: { type: 'array', items: { $ref: '#/components/schemas/QuestScreenComponentBinding' } },
            directions: { type: 'array', items: { $ref: '#/components/schemas/QuestDirection' } },
            screenType: { type: 'string', enum: ['authored', 'generated'] },
            parentScreenId: { type: 'string' },
            anchorScreenId: { type: 'string' },
            expectationSummary: { type: 'string' },
            continuitySummary: { type: 'string' },
            generatedFromPrompt: { type: 'string' },
            generatedByPlayerId: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
            stageLayout: {
              type: 'string',
              enum: ['focus-left', 'focus-right', 'triptych', 'stacked']
            },
            stageModules: {
              type: 'array',
              items: { $ref: '#/components/schemas/ImmersiveRpgStageModule' }
            }
          }
        },
        QuestScreensConfig: {
          type: 'object',
          required: ['sessionId', 'questId', 'startScreenId', 'screens', 'updatedAt'],
          properties: {
            sessionId: { type: 'string', example: 'scene-authoring-demo' },
            questId: { type: 'string', example: 'scene_authoring_starter' },
            sceneName: { type: 'string', example: 'Scene Authoring Starter' },
            sceneTemplate: { type: 'string', example: 'basic_scene' },
            sceneComponents: { type: 'array', items: { type: 'string' } },
            startScreenId: { type: 'string', example: 'cliff_path' },
            authoringBrief: { type: 'string' },
            phaseGuidance: { type: 'string' },
            visualStyleGuide: { type: 'string' },
            promptRoutes: { type: 'array', items: { $ref: '#/components/schemas/QuestPromptRoute' } },
            screens: { type: 'array', items: { $ref: '#/components/schemas/QuestScreen' } },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        QuestScreenLookupResponse: {
          type: 'object',
          required: ['sessionId', 'questId', 'screen', 'startScreenId', 'updatedAt'],
          properties: {
            sessionId: { type: 'string' },
            questId: { type: 'string' },
            screen: { $ref: '#/components/schemas/QuestScreen' },
            startScreenId: { type: 'string' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        QuestTraversalEvent: {
          type: 'object',
          required: ['toScreenId', 'createdAt'],
          properties: {
            playerId: { type: 'string', example: 'wanderer-01' },
            fromScreenId: { type: 'string', example: 'opening_tableau' },
            toScreenId: { type: 'string', example: 'mural_center_panel' },
            direction: { type: 'string', example: 'north' },
            promptText: { type: 'string', example: 'I trace the lone traveler with my fingertips.' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        QuestTraversalLogResponse: {
          type: 'object',
          required: ['sessionId', 'questId', 'traversal'],
          properties: {
            sessionId: { type: 'string' },
            questId: { type: 'string' },
            traversal: { type: 'array', items: { $ref: '#/components/schemas/QuestTraversalEvent' } }
          }
        },
        QuestTraversalWriteResponse: {
          type: 'object',
          required: ['sessionId', 'questId', 'event', 'traversalCount'],
          properties: {
            sessionId: { type: 'string' },
            questId: { type: 'string' },
            event: { $ref: '#/components/schemas/QuestTraversalEvent' },
            traversalCount: { type: 'integer', minimum: 0 }
          }
        },
        QuestRuntime: {
          type: 'object',
          required: ['pipeline', 'provider', 'model', 'mocked'],
          properties: {
            pipeline: { type: 'string', example: 'quest_generation' },
            provider: { type: 'string', example: 'openai' },
            model: { type: 'string', example: 'gpt-5-mini' },
            mocked: { type: 'boolean' }
          },
          additionalProperties: true
        },
        QuestAdvanceResponse: {
          type: 'object',
          required: ['sessionId', 'questId', 'actionType', 'screen', 'traversalCount', 'mocked'],
          properties: {
            sessionId: { type: 'string' },
            questId: { type: 'string' },
            actionType: { type: 'string', enum: ['direction', 'prompt'] },
            config: { $ref: '#/components/schemas/QuestScreensConfig' },
            screen: { $ref: '#/components/schemas/QuestScreen' },
            createdScreen: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/QuestScreen' }]
            },
            event: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/QuestTraversalEvent' }]
            },
            traversalCount: { type: 'integer', minimum: 0 },
            mocked: { type: 'boolean' },
            runtime: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/QuestRuntime' }]
            },
            mockedData: {
              nullable: true,
              type: 'object',
              additionalProperties: true
            }
          }
        },
        FragmentToMemoriesResponse: {
          ...FRAGMENT_TO_MEMORIES_RESPONSE_SCHEMA,
          required: ['sessionId', 'memories', 'count', 'mocked'],
          properties: {
            sessionId: { type: 'string' },
            playerId: { type: 'string' },
            batchId: { type: 'string' },
            memories: { type: 'array', items: { $ref: '#/components/schemas/FragmentMemory' } },
            count: { type: 'integer' },
            mocked: { type: 'boolean' },
            cardOptions: {
              type: 'object',
              properties: {
                includeFront: { type: 'boolean' },
                includeBack: { type: 'boolean' }
              }
            }
          }
        },
        MessengerChatMessage: {
          type: 'object',
          required: ['id', 'order', 'type', 'sender', 'text', 'hasChatEnded'],
          properties: {
            id: { type: 'string' },
            order: { type: 'number' },
            type: { type: 'string', enum: ['initial', 'response', 'user'] },
            sender: { type: 'string', enum: ['system', 'user'] },
            text: { type: 'string' },
            hasChatEnded: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        MessengerSceneBrief: {
          type: 'object',
          required: ['subject', 'placeSummary', 'typewriterHidingSpot', 'sensoryDetails', 'notableFeatures', 'sceneEstablished'],
          properties: {
            id: { type: 'string' },
            subject: { type: 'string', example: 'Harbor attic watchroom' },
            placeName: { type: 'string', example: 'Attic room above the harbor' },
            placeSummary: {
              type: 'string',
              example: 'A salt-stained attic room leans above the harbor with a rain-marked window, a narrow oak worktable, and the low groan of rigging below.'
            },
            typewriterHidingSpot: {
              type: 'string',
              example: 'Inside the cedar wardrobe with a false back, high enough to stay dry and ordinary enough to escape notice.'
            },
            sensoryDetails: {
              type: 'array',
              items: { type: 'string' }
            },
            notableFeatures: {
              type: 'array',
              items: { type: 'string' }
            },
            sceneEstablished: { type: 'boolean' },
            assistantReply: { type: 'string' },
            source: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
            meta: { type: 'object', additionalProperties: true }
          }
        },
        MessengerConversationResponse: {
          type: 'object',
          required: ['sessionId', 'sceneId', 'count', 'hasChatEnded', 'messages', 'storage'],
          properties: {
            sessionId: { type: 'string' },
            sceneId: { type: 'string' },
            count: { type: 'integer', minimum: 0 },
            hasChatEnded: { type: 'boolean' },
            storage: { type: 'string', enum: ['mongo', 'file'] },
            messages: {
              type: 'array',
              items: { $ref: '#/components/schemas/MessengerChatMessage' }
            },
            sceneBrief: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/MessengerSceneBrief' }]
            }
          }
        },
        MessengerSendResponse: {
          allOf: [
            { $ref: '#/components/schemas/MessengerConversationResponse' },
            {
              type: 'object',
              required: ['reply', 'has_chat_ended', 'mocked'],
              properties: {
                reply: { type: 'string' },
                has_chat_ended: { type: 'boolean' },
                mocked: { type: 'boolean' },
                runtime: {
                  type: 'object',
                  properties: {
                    pipeline: { type: 'string' },
                    provider: { type: 'string' },
                    model: { type: 'string' },
                    mocked: { type: 'boolean' },
                    storage: { type: 'string', enum: ['mongo', 'file'] }
                  },
                  additionalProperties: true
                }
              }
            }
          ]
        },
        ImmersiveRpgTranscriptEntry: {
          type: 'object',
          required: ['entryId', 'role', 'kind', 'text'],
          properties: {
            entryId: { type: 'string' },
            role: { type: 'string', enum: ['gm', 'pc', 'system'] },
            kind: { type: 'string', example: 'opening' },
            text: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            meta: { type: 'object', additionalProperties: true }
          }
        },
        ImmersiveRpgPendingRoll: {
          type: 'object',
          required: ['contextKey', 'skill', 'diceNotation', 'difficulty', 'successThreshold', 'successesRequired'],
          properties: {
            contextKey: { type: 'string', example: 'journal_retrieval' },
            skill: { type: 'string', example: 'awareness' },
            label: { type: 'string', example: 'Retrieve the journal unnoticed' },
            diceNotation: { type: 'string', example: '5d6' },
            difficulty: { type: 'string', example: 'moderate-high' },
            successThreshold: { type: 'integer', example: 5 },
            successesRequired: { type: 'integer', example: 2 },
            instructions: { type: 'string' }
          }
        },
        ImmersiveRpgNotebook: {
          type: 'object',
          required: ['mode', 'title', 'prompt', 'instruction', 'scratchLines', 'focusTags', 'diceFaces', 'resultSummary'],
          properties: {
            mode: {
              type: 'string',
              enum: ['idle', 'story_prompt', 'roll_request', 'roll_result', 'discovery']
            },
            title: { type: 'string' },
            prompt: { type: 'string' },
            instruction: { type: 'string' },
            scratchLines: { type: 'array', items: { type: 'string' } },
            focusTags: { type: 'array', items: { type: 'string' } },
            pendingRoll: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/ImmersiveRpgPendingRoll' }]
            },
            diceFaces: { type: 'array', items: { type: 'integer', minimum: 1 } },
            successTrack: {
              nullable: true,
              type: 'object',
              properties: {
                successes: { type: 'integer', minimum: 0 },
                successesRequired: { type: 'integer', minimum: 1 },
                passed: { type: 'boolean', nullable: true }
              },
              additionalProperties: true
            },
            resultSummary: { type: 'string' },
            updatedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        ImmersiveRpgStageModule: {
          type: 'object',
          required: ['moduleId', 'type', 'variant', 'title', 'caption', 'imageUrl', 'altText', 'emphasis', 'rotateDeg', 'tone', 'body', 'meta'],
          properties: {
            moduleId: { type: 'string' },
            type: { type: 'string', enum: ['illustration', 'evidence_note', 'quote_panel'] },
            variant: { type: 'string' },
            title: { type: 'string' },
            caption: { type: 'string' },
            imageUrl: { type: 'string' },
            altText: { type: 'string' },
            emphasis: { type: 'string' },
            rotateDeg: { type: 'number', minimum: -12, maximum: 12 },
            tone: { type: 'string' },
            body: { type: 'string' },
            meta: { type: 'object', additionalProperties: true }
          }
        },
        ImmersiveRpgRollResult: {
          type: 'object',
          required: ['rollId', 'diceNotation', 'rolls', 'successes', 'passed'],
          properties: {
            rollId: { type: 'string' },
            contextKey: { type: 'string' },
            skill: { type: 'string' },
            label: { type: 'string' },
            diceNotation: { type: 'string', example: '5d6' },
            diceCount: { type: 'integer', minimum: 1 },
            sides: { type: 'integer', minimum: 2 },
            difficulty: { type: 'string' },
            successThreshold: { type: 'integer', minimum: 1 },
            successesRequired: { type: 'integer', minimum: 1 },
            rolls: { type: 'array', items: { type: 'integer', minimum: 1 } },
            successes: { type: 'integer', minimum: 0 },
            passed: { type: 'boolean' },
            summary: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            meta: { type: 'object', additionalProperties: true }
          }
        },
        ImmersiveRpgCharacterSheet: {
          type: 'object',
          required: ['sessionId', 'playerId', 'playerName', 'identity', 'coreTraits', 'attributes', 'skills', 'inventory', 'notes'],
          properties: {
            id: { type: 'string' },
            sessionId: { type: 'string' },
            playerId: { type: 'string', example: 'pc' },
            playerName: { type: 'string', example: 'Player Character' },
            identity: { type: 'object', additionalProperties: true },
            coreTraits: { type: 'object', additionalProperties: true },
            attributes: { type: 'object', additionalProperties: true },
            skills: { type: 'object', additionalProperties: true },
            inventory: { type: 'array', items: { type: 'string' } },
            notes: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        ImmersiveRpgScene: {
          type: 'object',
          required: ['sessionId', 'playerId', 'currentSceneNumber', 'currentSceneKey', 'sceneTitle', 'currentBeat', 'status', 'transcript', 'rollLog', 'notebook', 'stageLayout', 'stageModules'],
          properties: {
            id: { type: 'string' },
            sessionId: { type: 'string' },
            playerId: { type: 'string' },
            messengerSceneId: { type: 'string', example: 'messanger' },
            currentSceneNumber: { type: 'integer', example: 3 },
            currentSceneKey: { type: 'string', example: 'scene_3_mysterious_encounter' },
            sceneTitle: { type: 'string', example: 'Scene 3: The Mysterious Encounter' },
            currentBeat: { type: 'string', example: 'encounter_setup' },
            status: { type: 'string', enum: ['draft', 'active', 'paused', 'completed'] },
            promptKey: { type: 'string' },
            sourceSceneBrief: { $ref: '#/components/schemas/MessengerSceneBrief' },
            compiledPrompt: { type: 'string' },
            transcript: { type: 'array', items: { $ref: '#/components/schemas/ImmersiveRpgTranscriptEntry' } },
            rollLog: { type: 'array', items: { $ref: '#/components/schemas/ImmersiveRpgRollResult' } },
            pendingRoll: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/ImmersiveRpgPendingRoll' }]
            },
            notebook: { $ref: '#/components/schemas/ImmersiveRpgNotebook' },
            stageLayout: {
              type: 'string',
              enum: ['focus-left', 'focus-right', 'triptych', 'stacked']
            },
            stageModules: {
              type: 'array',
              items: { $ref: '#/components/schemas/ImmersiveRpgStageModule' }
            },
            sceneFlags: { type: 'object', additionalProperties: true },
            notes: { type: 'array', items: { type: 'string' } },
            characterSheet: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/ImmersiveRpgCharacterSheet' }]
            },
            createdAt: { type: 'string', format: 'date-time', nullable: true },
            updatedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        ImmersiveRpgSceneEnvelope: {
          type: 'object',
          required: ['scene', 'characterSheet'],
          properties: {
            sessionId: { type: 'string' },
            ready: { type: 'boolean' },
            currentSceneNumber: { type: 'integer', example: 3 },
            currentSceneKey: { type: 'string', example: 'scene_3_mysterious_encounter' },
            missingContext: { type: 'array', items: { type: 'string' } },
            mockedContext: { type: 'array', items: { type: 'string' } },
            messengerSceneId: { type: 'string' },
            bootstrapped: { type: 'boolean' },
            messengerReady: { type: 'boolean' },
            storage: { type: 'string', example: 'mongo' },
            sourceStorage: { type: 'string', enum: ['mongo', 'file', 'mock'] },
            reply: { type: 'string' },
            pendingRoll: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/ImmersiveRpgPendingRoll' }]
            },
            roll: { $ref: '#/components/schemas/ImmersiveRpgRollResult' },
            resolution: {
              type: 'object',
              properties: {
                currentBeat: { type: 'string' },
                message: { type: 'string' }
              }
            },
            scene: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/ImmersiveRpgScene' }]
            },
            characterSheet: {
              nullable: true,
              allOf: [{ $ref: '#/components/schemas/ImmersiveRpgCharacterSheet' }]
            }
          }
        },
        TypewriterAiPipelineSetting: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            modelKind: { type: 'string', enum: ['text', 'image'] },
            useMock: { type: 'boolean' },
            model: { type: 'string' },
            provider: { type: 'string', enum: ['openai', 'anthropic'] },
            supportedProviders: { type: 'array', items: { type: 'string' } },
            defaultProvider: { type: 'string' },
            countProperty: { type: 'string' },
            supportsCount: { type: 'boolean' },
            countLabel: { type: 'string' },
            minCount: { type: 'integer' },
            maxCount: { type: 'integer' },
            defaultCount: { type: 'integer' }
          },
          additionalProperties: true
        },
        TypewriterAiSettingsResponse: {
          type: 'object',
          properties: {
            updatedAt: { type: 'string', format: 'date-time' },
            updatedBy: { type: 'string' },
            pipelines: {
              type: 'object',
              additionalProperties: { $ref: '#/components/schemas/TypewriterAiPipelineSetting' }
            },
            pipelinesMeta: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterAiPipelineSetting' }
            }
          }
        },
        TypewriterPromptDefinition: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            settingsKey: { type: 'string' }
          }
        },
        TypewriterPromptVersion: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            pipelineKey: { type: 'string' },
            version: { type: 'integer' },
            promptTemplate: { type: 'string' },
            isLatest: { type: 'boolean' },
            createdBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            meta: { type: 'object', additionalProperties: true }
          }
        },
        TypewriterPromptCollection: {
          type: 'object',
          properties: {
            pipelines: {
              type: 'object',
              additionalProperties: {
                anyOf: [
                  { $ref: '#/components/schemas/TypewriterPromptVersion' },
                  { type: 'null' }
                ]
              }
            },
            pipelinesMeta: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterPromptDefinition' }
            }
          }
        },
        TypewriterModelListResponse: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            fetchedAt: { type: 'string', format: 'date-time' },
            textModels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            imageModels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' }
                },
                additionalProperties: true
              }
            },
            providers: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                additionalProperties: true
              }
            }
          }
        },
        TypewriterSessionResponse: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            fragment: { type: 'string' },
            initialFragment: { type: 'string' },
            typewriterKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterKey' }
            },
            entityKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterKey' }
            }
          }
        },
        TypewriterSessionInspectResponse: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            playerId: { type: 'string' },
            fragment: { type: 'string' },
            initialFragment: { type: 'string' },
            narrativeWordCount: { type: 'integer' },
            slots: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterStorytellerSlot' }
            },
            typewriterKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterKey' }
            },
            entityKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterKey' }
            },
            storytellers: {
              type: 'array',
              items: { type: 'object', additionalProperties: true }
            },
            entities: {
              type: 'array',
              items: { $ref: '#/components/schemas/NarrativeEntity' }
            },
            counts: {
              type: 'object',
              properties: {
                storytellerCount: { type: 'integer' },
                slotFilledCount: { type: 'integer' },
                typewriterKeyCount: { type: 'integer' },
                entityCount: { type: 'integer' }
              },
              additionalProperties: true
            }
          }
        },
        TypewriterKey: TYPEWRITER_KEY_JSON_SCHEMA,
        TypewriterStoryEntityKey: {
          allOf: [{ $ref: '#/components/schemas/TypewriterKey' }]
        },
        TypewriterStorytellerSlot: {
          type: 'object',
          properties: {
            slotIndex: { type: 'integer' },
            slotKey: { type: 'string' },
            keyShape: { type: 'string' },
            blankTextureUrl: { type: 'string' },
            blankShape: { type: 'string' },
            filled: { type: 'boolean' },
            storytellerId: { type: 'string' },
            storytellerName: { type: 'string' },
            keyImageUrl: { type: 'string' },
            symbol: { type: 'string' },
            description: { type: 'string' }
          }
        },
        TypewriterStorytellerKeyCheckResponse: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
            narrativeWordCount: { type: 'integer' },
            checkIntervalWords: { type: 'integer' },
            shouldCreate: { type: 'boolean' },
            created: { type: 'boolean' },
            createdStoryteller: { type: 'object', additionalProperties: true },
            assignedStorytellerCount: { type: 'integer' },
            nextThreshold: { type: 'integer', nullable: true },
            slots: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterStorytellerSlot' }
            },
            typewriterKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterKey' }
            },
            entityKeys: {
              type: 'array',
              items: { $ref: '#/components/schemas/TypewriterKey' }
            }
          }
        },
        TypewriterStorytellerInterventionResponse: {
          allOf: [
            { $ref: '#/components/schemas/TypewriterResponse' },
            {
              type: 'object',
              properties: {
                sessionId: { type: 'string' },
                fragment: { type: 'string' },
                storyteller: { type: 'object', additionalProperties: true },
                typewriterKey: { $ref: '#/components/schemas/TypewriterKey' },
                typewriterKeys: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TypewriterKey' }
                },
                entityKey: { $ref: '#/components/schemas/TypewriterKey' },
                entityKeys: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TypewriterKey' }
                },
                mocked: { type: 'boolean' },
                runtime: {
                  type: 'object',
                  properties: {
                    pipeline: { type: 'string' },
                    provider: { type: 'string' },
                    model: { type: 'string' },
                    mocked: { type: 'boolean' }
                  },
                  additionalProperties: true
                }
              }
            }
          ]
        },
        TypewriterKeyVerificationResponse: {
          type: 'object',
          properties: {
            allowed: { type: 'boolean' },
            appendedText: { type: 'string' },
            candidateNarrative: { type: 'string' },
            reason: { type: 'string' },
            key: { $ref: '#/components/schemas/TypewriterKey' },
            mocked: { type: 'boolean' },
            runtime: {
              type: 'object',
              properties: {
                pipeline: { type: 'string' },
                provider: { type: 'string' },
                model: { type: 'string' },
                mocked: { type: 'boolean' }
              },
              additionalProperties: true
            }
          }
        }
      }
    },
    paths: {
      '/api/openapi.json': {
        get: op({
          tags: ['Docs'],
          summary: 'Get OpenAPI JSON',
          importance: 'Medium',
          flow: 'Used during integration and debugging; source for Swagger UI.',
          responses: {
            '200': { description: 'OpenAPI document returned.' }
          }
        })
      },
      '/api/docs': {
        get: op({
          tags: ['Docs'],
          summary: 'Swagger UI page',
          importance: 'Medium',
          flow: 'Used by developers/QA to inspect and execute routes manually.',
          responses: {
            '200': { description: 'Swagger UI HTML.' }
          }
        })
      },
      '/api/admin/llm-config': {
        get: op({
          tags: ['Admin'],
          summary: 'List editable LLM route configs',
          importance: 'High',
          flow: 'Admin maintenance path before changing generation behavior.',
          security: [{ AdminApiKey: [] }],
          responses: {
            '200': {
              description: 'Route config map.',
              ...jsonResponse({
                type: 'object',
                additionalProperties: { $ref: '#/components/schemas/LlmRouteConfig' },
                example: {
                  text_to_storyteller: LLM_ROUTE_CONFIG_EXAMPLE
                }
              })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/llm-config/{routeKey}': {
        get: op({
          tags: ['Admin'],
          summary: 'Get route config',
          importance: 'High',
          flow: 'Inspect prompt/schema before editing or validating behavior drift.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('routeKey', 'Configured route key (for example worlds_create).')],
          responses: {
            '200': {
              description: 'Route config returned.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LlmRouteConfig' },
                  example: LLM_ROUTE_CONFIG_EXAMPLE
                }
              }
            },
            '400': { description: 'Unknown routeKey.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        post: op({
          tags: ['Admin'],
          summary: 'Save full route config version',
          importance: 'Critical',
          flow: 'Primary structured-output contract save path used by Story Admin.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('routeKey', 'Configured route key.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    promptMode: { type: 'string', enum: ['manual', 'contract'] },
                    promptTemplate: { type: 'string' },
                    promptCore: { type: 'string' },
                    responseSchema: { type: 'object', additionalProperties: true },
                    fieldDocs: { type: 'object', additionalProperties: { type: 'string' } },
                    examplePayload: { type: 'object', additionalProperties: true },
                    outputRules: { type: 'array', items: { type: 'string' } },
                    updatedBy: { type: 'string' },
                    markLatest: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Structured route config version saved.', ...jsonResponse({ $ref: '#/components/schemas/LlmRouteConfig' }) },
            '400': { description: 'Invalid request.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/llm-config/{routeKey}/versions': {
        get: op({
          tags: ['Admin'],
          summary: 'List route config versions',
          importance: 'High',
          flow: 'Used by Story Admin to inspect structured-contract history before rollback.',
          security: [{ AdminApiKey: [] }],
          parameters: [
            pathParam('routeKey', 'Configured route key.'),
            queryParam('limit', false, 'Maximum number of versions to return.')
          ],
          responses: {
            '200': {
              description: 'Version list returned.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  routeKey: { type: 'string' },
                  versions: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/LlmRouteConfig' }
                  }
                }
              })
            }
          }
        })
      },
      '/api/admin/llm-config/{routeKey}/prompt': {
        put: op({
          tags: ['Admin'],
          summary: 'Update prompt template',
          importance: 'Critical',
          flow: 'Primary control surface to tune generation outputs without redeploy.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('routeKey', 'Configured route key.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['promptTemplate'],
                  properties: {
                    promptTemplate: {
                      type: 'string',
                      example: STORYTELLER_PROMPT_EXAMPLE
                    },
                    updatedBy: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Prompt updated.', ...jsonResponse({ $ref: '#/components/schemas/LlmRouteConfig' }) },
            '400': { description: 'Invalid request.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/llm-config/{routeKey}/schema': {
        put: op({
          tags: ['Admin'],
          summary: 'Update response JSON schema',
          importance: 'Critical',
          flow: 'Used to enforce output contracts and catch LLM drift at runtime.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('routeKey', 'Configured route key.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['responseSchema'],
                  properties: {
                    responseSchema: { type: 'object', additionalProperties: true },
                    updatedBy: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Schema updated.', ...jsonResponse({ $ref: '#/components/schemas/LlmRouteConfig' }) },
            '400': { description: 'Schema invalid.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/llm-config/{routeKey}/latest': {
        post: op({
          tags: ['Admin'],
          summary: 'Set latest route config version',
          importance: 'High',
          flow: 'Story Admin rollback control for structured-output contracts stored in Mongo.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('routeKey', 'Configured route key.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    version: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Selected version promoted to latest.', ...jsonResponse({ $ref: '#/components/schemas/LlmRouteConfig' }) },
            '400': { description: 'Invalid request.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/llm-config/{routeKey}/reset': {
        post: op({
          tags: ['Admin'],
          summary: 'Reset route config to defaults',
          importance: 'High',
          flow: 'Rollback path when an edited prompt/schema breaks generation.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('routeKey', 'Configured route key.')],
          responses: {
            '200': { description: 'Config reset.', ...jsonResponse({ $ref: '#/components/schemas/LlmRouteConfig' }) }
          }
        })
      },
      '/api/admin/openai/models': {
        get: op({
          tags: ['Admin'],
          summary: 'List available admin-selectable models',
          importance: 'High',
          flow: 'Story Admin uses this to populate OpenAI/Anthropic model dropdowns for narrative pipelines.',
          security: [{ AdminApiKey: [] }],
          parameters: [queryParam('forceRefresh', false, 'Refresh provider model caches before responding.')],
          responses: {
            '200': {
              description: 'Model inventory returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterModelListResponse' })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/ai-settings': {
        get: op({
          tags: ['Admin'],
          summary: 'Load Story Admin runtime AI settings',
          importance: 'Critical',
          flow: 'Story Admin hydration for provider/model/mock defaults across story pipelines.',
          security: [{ AdminApiKey: [] }],
          responses: {
            '200': {
              description: 'Runtime AI settings returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterAiSettingsResponse' })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        put: op({
          tags: ['Admin'],
          summary: 'Save Story Admin runtime AI settings',
          importance: 'Critical',
          flow: 'Admin control surface for toggling mock/live mode and choosing provider/model per story pipeline.',
          security: [{ AdminApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    updatedBy: { type: 'string' },
                    pipelines: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          useMock: { type: 'boolean' },
                          model: { type: 'string' },
                          provider: { type: 'string', enum: ['openai', 'anthropic'] }
                        },
                        additionalProperties: true
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Updated runtime AI settings returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterAiSettingsResponse' })
            },
            '400': { description: 'Invalid pipeline key or payload.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/ai-settings/reset': {
        post: op({
          tags: ['Admin'],
          summary: 'Reset Story Admin runtime AI settings',
          importance: 'High',
          flow: 'Rollback path when experimental model/mock settings break story generation.',
          security: [{ AdminApiKey: [] }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    updatedBy: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Default runtime AI settings returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterAiSettingsResponse' })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/prompts': {
        get: op({
          tags: ['Admin'],
          summary: 'Load latest Story Admin prompts',
          importance: 'Critical',
          flow: 'Story Admin hydration for prompt editors backed by Mongo latest-version selection.',
          security: [{ AdminApiKey: [] }],
          responses: {
            '200': {
              description: 'Latest prompt versions plus prompt metadata returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterPromptCollection' })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/prompts/seed-current': {
        post: op({
          tags: ['Admin'],
          summary: 'Seed in-code story prompts into Mongo',
          importance: 'High',
          flow: 'One-time bootstrap to capture current code prompts as versioned Mongo prompt templates.',
          security: [{ AdminApiKey: [] }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    updatedBy: { type: 'string' },
                    overwrite: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Seed result returned.' },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/prompts/{pipelineKey}': {
        post: op({
          tags: ['Admin'],
          summary: 'Save a new prompt version for one story pipeline',
          importance: 'Critical',
          flow: 'Primary prompt-editing save path for Story Admin.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('pipelineKey', 'Prompt pipeline key (for example storyteller_creation).')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['promptTemplate'],
                  properties: {
                    promptTemplate: { type: 'string' },
                    updatedBy: { type: 'string' },
                    markLatest: { type: 'boolean' },
                    meta: { type: 'object', additionalProperties: true }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Prompt version saved.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterPromptVersion' })
            },
            '400': { description: 'Invalid pipeline or prompt template.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/prompts/{pipelineKey}/versions': {
        get: op({
          tags: ['Admin'],
          summary: 'List prompt versions for one story pipeline',
          importance: 'High',
          flow: 'Story Admin version picker used before promoting an older prompt to latest.',
          security: [{ AdminApiKey: [] }],
          parameters: [
            pathParam('pipelineKey', 'Prompt pipeline key.'),
            queryParam('limit', false, 'Maximum number of versions to return.')
          ],
          responses: {
            '200': {
              description: 'Prompt version list returned.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  pipelineKey: { type: 'string' },
                  versions: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TypewriterPromptVersion' }
                  }
                }
              })
            },
            '400': { description: 'Invalid pipeline key.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/typewriter/prompts/{pipelineKey}/latest': {
        post: op({
          tags: ['Admin'],
          summary: 'Promote an existing prompt version to latest',
          importance: 'High',
          flow: 'Story Admin rollback/selection control for Mongo-backed prompt versions.',
          security: [{ AdminApiKey: [] }],
          parameters: [pathParam('pipelineKey', 'Prompt pipeline key.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    version: { type: 'integer' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Selected latest prompt version returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterPromptVersion' })
            },
            '400': { description: 'Invalid prompt version selection.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/shouldGenerateContinuation': {
        post: op({
          tags: ['Generation'],
          summary: 'Check whether the typewriter should auto-generate continuation',
          importance: 'High',
          flow: 'Front-end pause detector uses this before calling the live continuation route.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentText', 'latestAddition', 'latestPauseSeconds', 'lastGhostwriterWordCount'],
                  properties: {
                    currentText: { type: 'string' },
                    latestAddition: { type: 'string' },
                    latestPauseSeconds: { type: 'number' },
                    lastGhostwriterWordCount: { type: 'number' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Continuation heuristic result.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  shouldGenerate: { type: 'boolean' }
                }
              })
            }
          }
        })
      },
      '/api/shouldAllowXerofag': {
        post: op({
          tags: ['Generation'],
          summary: 'Check whether the Xerofag term can be appended to the current narrative',
          importance: 'High',
          flow: 'The Xerofag key calls this before inserting the term into the typewriter narrative.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'currentNarrative'],
                  properties: {
                    sessionId: { type: 'string' },
                    currentNarrative: { type: 'string' },
                    candidateNarrative: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Verdict returned for the Xerofag insertion attempt.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  allowed: { type: 'boolean' },
                  mocked: { type: 'boolean' },
                  runtime: {
                    type: 'object',
                    properties: {
                      pipeline: { type: 'string' },
                      provider: { type: 'string' },
                      model: { type: 'string' },
                      mocked: { type: 'boolean' }
                    }
                  }
                }
              })
            },
            '400': { description: 'Missing sessionId or currentNarrative.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'LLM Xerofag inspection failed.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/typewriter/keys/shouldAllow': {
        post: op({
          tags: ['Generation'],
          summary: 'Check whether a saved textual typewriter key may be appended to the current narrative',
          importance: 'High',
          flow: 'Dynamic textual keys such as Xerofag and storyteller-created keys call this before inserting text into the live typewriter narrative.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'currentNarrative'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    keyId: { type: 'string' },
                    keyText: { type: 'string' },
                    currentNarrative: { type: 'string' },
                    candidateNarrative: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Verdict returned for the textual key insertion attempt.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterKeyVerificationResponse' })
            },
            '400': { description: 'Missing sessionId, currentNarrative, or key target.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Key not found for the session.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'LLM key verification failed.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/typewriter/session/start': {
        post: op({
          tags: ['Sessions'],
          summary: 'Create or hydrate a typewriter session',
          importance: 'High',
          flow: 'Used by Story Admin and the typewriter UI to bootstrap or seed a session fragment.',
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string' },
                    fragment: { type: 'string' },
                    playerId: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Session returned or created.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterSessionResponse' })
            }
          }
        })
      },
      '/api/typewriter/session/inspect': {
        get: op({
          tags: ['Sessions'],
          summary: 'Inspect a typewriter session',
          importance: 'High',
          flow: 'Used by Story Admin and QA to inspect fragment, storyteller slots, textual keys, and linked entities for one live session.',
          parameters: [
            queryParam('sessionId', true, 'Typewriter session identifier.'),
            queryParam('playerId', false, 'Optional player scope for session overlays.')
          ],
          responses: {
            '200': {
              description: 'Typewriter session inspection payload.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterSessionInspectResponse' })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Typewriter session not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/shouldCreateStorytellerKey': {
        post: op({
          tags: ['Generation'],
          summary: 'Check whether the narrative should unlock a new storyteller key',
          importance: 'High',
          flow: 'Typewriter keyboard polls this after narrative word-count checkpoints to expand storyteller slots.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Threshold check result and slot state returned.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterStorytellerKeyCheckResponse' })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/send_storyteller_typewriter_text': {
        post: op({
          tags: ['Generation'],
          summary: 'Let a storyteller enter the page and briefly continue the narrative',
          importance: 'High',
          flow: 'Pressed storyteller keys trigger this route to perform a short intervention and surface one new textual entity key.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' },
                    storytellerId: { type: 'string' },
                    slotIndex: { type: 'integer' },
                    playerId: { type: 'string' },
                    fadeTimingScale: { type: 'number' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Storyteller intervention sequence plus the newly surfaced entity key.',
              ...jsonResponse({ $ref: '#/components/schemas/TypewriterStorytellerInterventionResponse' })
            },
            '400': { description: 'Missing storyteller target.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Storyteller not found for session.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/messenger/chat': {
        get: op({
          tags: ['Messenger'],
          summary: 'Load messenger conversation history',
          importance: 'High',
          flow: 'Debug and hydration route for the eerie Society messenger UI.',
          parameters: [
            queryParam('sessionId', true, 'Messenger session identifier.'),
            queryParam('sceneId', false, 'Optional messenger scene identifier. Defaults to "messanger".')
          ],
          responses: {
            '200': {
              description: 'Conversation history returned.',
              ...jsonResponse({ $ref: '#/components/schemas/MessengerConversationResponse' })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        post: op({
          tags: ['Messenger'],
          summary: 'Send a messenger reply to the Society',
          importance: 'Critical',
          flow: 'Primary intake conversation for describing where the typewriter should be delivered and hidden.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'message'],
                  properties: {
                    sessionId: { type: 'string' },
                    message: { type: 'string' },
                    sceneId: { type: 'string' },
                    maxHistoryMessages: { type: 'integer', minimum: 4, maximum: 40 },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Assistant reply plus synchronized conversation state returned.',
              ...jsonResponse({ $ref: '#/components/schemas/MessengerSendResponse' })
            },
            '400': { description: 'Missing sessionId or message.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'LLM/schema mismatch.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        delete: op({
          tags: ['Messenger'],
          summary: 'Clear messenger conversation history',
          importance: 'High',
          flow: 'Debug reset route for restarting the messenger intake flow from a clean slate.',
          parameters: [
            queryParam('sessionId', true, 'Messenger session identifier.'),
            queryParam('sceneId', false, 'Optional messenger scene identifier. Defaults to "messanger".')
          ],
          responses: {
            '200': {
              description: 'Conversation history deleted.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  sceneId: { type: 'string' },
                  deletedCount: { type: 'integer', minimum: 0 }
                }
              })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/sendMessage': {
        post: op({
          tags: ['Messenger'],
          summary: 'Legacy messenger alias',
          importance: 'Medium',
          flow: 'Backward-compatible alias for older messenger clients while the new UI uses /api/messenger/chat.',
          deprecated: true,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'message'],
                  properties: {
                    sessionId: { type: 'string' },
                    message: { type: 'string' },
                    sceneId: { type: 'string' },
                    maxHistoryMessages: { type: 'integer', minimum: 4, maximum: 40 },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Assistant reply plus synchronized conversation state returned.',
              ...jsonResponse({ $ref: '#/components/schemas/MessengerSendResponse' })
            },
            '400': { description: 'Missing sessionId or message.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'LLM/schema mismatch.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/immersive-rpg/scene': {
        get: op({
          tags: ['Immersive RPG'],
          summary: 'Load the current immersive RPG scene for a session',
          importance: 'Critical',
          flow: 'Resolves the active immersive RPG scene from persisted session state and lazily loads the scene dependencies required by that scene.',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', false, 'Optional player character id. Defaults to "pc".'),
            queryParam('playerName', false, 'Optional player character display name.')
          ],
          responses: {
            '200': {
              description: 'Current immersive RPG scene envelope. If required persisted context is missing, `ready` is false and `missingContext` explains what is blocking the scene.',
              ...jsonResponse({ $ref: '#/components/schemas/ImmersiveRpgSceneEnvelope' })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/immersive-rpg/chat': {
        post: op({
          tags: ['Immersive RPG'],
          summary: 'Append a PC action and get the next scaffolded GM beat',
          importance: 'High',
          flow: 'Persists the free-text GM/PC transcript and advances the first scene using the deterministic skeleton until a fuller LLM loop replaces it.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'message'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    playerName: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Updated immersive RPG scene envelope with the next GM reply.',
              ...jsonResponse({ $ref: '#/components/schemas/ImmersiveRpgSceneEnvelope' })
            },
            '400': { description: 'Missing sessionId or message.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '409': { description: 'Messenger brief missing or insufficient.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/immersive-rpg/rolls': {
        post: op({
          tags: ['Immersive RPG'],
          summary: 'Resolve a notebook-style dice pool roll for the current scene',
          importance: 'High',
          flow: 'Simulates rolls and successes for the square notebook panel and applies the consequence back into persisted scene state.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    playerName: { type: 'string' },
                    contextKey: { type: 'string' },
                    skill: { type: 'string' },
                    label: { type: 'string' },
                    diceNotation: { type: 'string', example: '5d6' },
                    difficulty: { type: 'string', example: 'moderate-high' },
                    successThreshold: { type: 'integer', minimum: 1 },
                    successesRequired: { type: 'integer', minimum: 1 }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Roll result plus updated scene envelope.',
              ...jsonResponse({ $ref: '#/components/schemas/ImmersiveRpgSceneEnvelope' })
            },
            '400': { description: 'Missing sessionId or invalid dice notation.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '409': { description: 'Messenger brief missing or insufficient.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/immersive-rpg/character-sheet': {
        get: op({
          tags: ['Immersive RPG'],
          summary: 'Load the PC character-sheet skeleton',
          importance: 'High',
          flow: 'Hydrates the editable PC skeleton that will later feed deeper RPG mechanics and scene generation.',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', false, 'Optional player character id. Defaults to "pc".'),
            queryParam('playerName', false, 'Optional player character display name.')
          ],
          responses: {
            '200': {
              description: 'Character-sheet envelope.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  playerId: { type: 'string' },
                  characterSheet: { $ref: '#/components/schemas/ImmersiveRpgCharacterSheet' }
                }
              })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        put: op({
          tags: ['Immersive RPG'],
          summary: 'Save the PC character-sheet skeleton',
          importance: 'High',
          flow: 'Persists the editable PC scaffold so later GM turns and mechanics can consume stable session state from Mongo.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    playerName: { type: 'string' },
                    messengerSceneId: { type: 'string' },
                    identity: { type: 'object', additionalProperties: true },
                    coreTraits: { type: 'object', additionalProperties: true },
                    attributes: { type: 'object', additionalProperties: true },
                    skills: { type: 'object', additionalProperties: true },
                    inventory: { type: 'array', items: { type: 'string' } },
                    notes: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Character-sheet envelope.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  playerId: { type: 'string' },
                  characterSheet: { $ref: '#/components/schemas/ImmersiveRpgCharacterSheet' }
                }
              })
            },
            '400': { description: 'Missing sessionId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/send_typewriter_text': {
        post: op({
          tags: ['Generation'],
          summary: 'Generate typewriter continuation text',
          importance: 'Critical',
          flow: 'Core continuation route that turns the current typed fragment into the next narrative beat.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'message'],
                  properties: {
                    sessionId: { type: 'string' },
                    message: { type: 'string' },
                    fadeTimingScale: { type: 'number' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Continuation payload returned.' },
            '400': { description: 'Missing sessionId or message.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'LLM continuation failed.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/sessions/{sessionId}/players': {
        get: op({
          tags: ['Sessions'],
          summary: 'List players in a session',
          importance: 'High',
          flow: 'Login/lobby step to show current participants before gameplay.',
          parameters: [pathParam('sessionId', 'Session identifier.')],
          responses: {
            '200': {
              description: 'Player list.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  count: { type: 'number' },
                  players: { type: 'array', items: { $ref: '#/components/schemas/SessionPlayer' } }
                }
              })
            }
          }
        }),
        post: op({
          tags: ['Sessions'],
          summary: 'Register player in session',
          importance: 'Critical',
          flow: 'Entry gate for a user before they can act in arena/gameplay routes.',
          parameters: [pathParam('sessionId', 'Session identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['playerName'],
                  properties: {
                    playerName: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Player created.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  playerId: { type: 'string' },
                  id: { type: 'string' }
                }
              })
            },
            '400': { description: 'Bad request.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/sessions/{sessionId}/arena': {
        get: op({
          tags: ['Sessions'],
          summary: 'Get shared arena snapshot',
          importance: 'Critical',
          flow: 'Hydration step after login and whenever clients resync state.',
          parameters: [
            pathParam('sessionId', 'Session identifier.'),
            queryParam('playerId', true, 'Current player identifier.')
          ],
          responses: {
            '200': {
              description: 'Arena state.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  playerId: { type: 'string' },
                  arena: { $ref: '#/components/schemas/ArenaEnvelope' }
                }
              })
            }
          }
        }),
        post: op({
          tags: ['Sessions'],
          summary: 'Persist shared arena snapshot',
          importance: 'Critical',
          flow: 'Commit step whenever players mutate shared arena board state.',
          parameters: [pathParam('sessionId', 'Session identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['playerId'],
                  properties: {
                    playerId: { type: 'string' },
                    arena: { $ref: '#/components/schemas/ArenaEnvelope' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Arena updated.' },
            '400': { description: 'Bad request.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/quest/screens': {
        get: op({
          tags: ['Quest'],
          summary: 'Get full quest screen graph',
          importance: 'Critical',
          flow: 'Primary quest UI hydration route for loading all screens, directions, and start screen.',
          parameters: [
            queryParam('sessionId', false, 'Quest session scope. Defaults to scene-authoring-demo.'),
            queryParam('questId', false, 'Quest graph identifier. Defaults to scene_authoring_starter.')
          ],
          responses: {
            '200': {
              description: 'Quest screens config returned.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestScreensConfig' })
            },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/quest/screens/{screenId}': {
        get: op({
          tags: ['Quest'],
          summary: 'Get one quest screen',
          importance: 'High',
          flow: 'Used for direct screen lookups, debugging, and editor-specific checks.',
          parameters: [
            pathParam('screenId', 'Quest screen identifier.'),
            queryParam('sessionId', false, 'Quest session scope. Defaults to scene-authoring-demo.'),
            queryParam('questId', false, 'Quest graph identifier. Defaults to scene_authoring_starter.')
          ],
          responses: {
            '200': {
              description: 'Quest screen returned.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestScreenLookupResponse' })
            },
            '404': { description: 'Quest screen not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/quest/screens': {
        put: op({
          tags: ['Quest', 'Admin'],
          summary: 'Save full quest screen graph',
          importance: 'Critical',
          flow: 'Primary admin authoring route to persist the complete quest screen + direction graph.',
          security: [{ AdminApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['startScreenId', 'screens'],
                  properties: {
                    sessionId: { type: 'string', example: 'scene-authoring-demo' },
                    questId: { type: 'string', example: 'scene_authoring_starter' },
                    sceneName: { type: 'string' },
                    sceneTemplate: { type: 'string', example: 'basic_scene' },
                    sceneComponents: { type: 'array', items: { type: 'string' } },
                    startScreenId: { type: 'string' },
                    authoringBrief: { type: 'string' },
                    phaseGuidance: { type: 'string' },
                    visualStyleGuide: { type: 'string' },
                    promptRoutes: { type: 'array', items: { $ref: '#/components/schemas/QuestPromptRoute' } },
                    screens: { type: 'array', items: { $ref: '#/components/schemas/QuestScreen' } }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Quest screens saved.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestScreensConfig' })
            },
            '400': { description: 'Invalid quest graph payload.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/quest/authoring-draft': {
        post: op({
          tags: ['Quest', 'Admin'],
          summary: 'Generate reviewable quest-scene authoring patches',
          importance: 'High',
          flow: 'Optional AI-assisted authoring route that proposes structured changes to the in-editor quest scene without saving them.',
          security: [{ AdminApiKey: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', example: 'scene-authoring-demo' },
                    questId: { type: 'string', example: 'scene_authoring_starter' },
                    selectedScreenId: { type: 'string', example: 'outer_wall_plateau' },
                    mode: { type: 'string', enum: ['scene', 'selected_screen', 'fill_missing'] },
                    config: { $ref: '#/components/schemas/QuestScreensConfig' },
                    mock: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Draft authoring patch generated.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  questId: { type: 'string' },
                  mode: { type: 'string' },
                  selectedScreenId: { type: 'string' },
                  mocked: { type: 'boolean' },
                  runtime: { $ref: '#/components/schemas/QuestRuntime' },
                  summary: { type: 'string' },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: true
                    }
                  }
                }
              })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/admin/quest/screens/reset': {
        post: op({
          tags: ['Quest', 'Admin'],
          summary: 'Reset quest graph to defaults',
          importance: 'High',
          flow: 'Admin rollback path to recover a broken or experimental quest graph.',
          security: [{ AdminApiKey: [] }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    sessionId: { type: 'string', example: 'scene-authoring-demo' },
                    questId: { type: 'string', example: 'scene_authoring_starter' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Quest screens reset.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestScreensConfig' })
            },
            '401': { description: 'Unauthorized.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/quest/traversal': {
        get: op({
          tags: ['Quest'],
          summary: 'List quest traversal events',
          importance: 'High',
          flow: 'Used by quest UI to render player traversal history for the active session + quest scope.',
          parameters: [
            queryParam('sessionId', false, 'Quest session scope. Defaults to scene-authoring-demo.'),
            queryParam('questId', false, 'Quest graph identifier. Defaults to scene_authoring_starter.')
          ],
          responses: {
            '200': {
              description: 'Traversal log returned.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestTraversalLogResponse' })
            },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        post: op({
          tags: ['Quest'],
          summary: 'Append quest traversal event',
          importance: 'High',
          flow: 'Called whenever a player moves between screens or submits a prompt to persist run history.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['toScreenId'],
                  properties: {
                    sessionId: { type: 'string', example: 'scene-authoring-demo' },
                    questId: { type: 'string', example: 'scene_authoring_starter' },
                    playerId: { type: 'string', example: 'wanderer-01' },
                    fromScreenId: { type: 'string', example: 'opening_tableau' },
                    toScreenId: { type: 'string', example: 'mural_center_panel' },
                    direction: { type: 'string', example: 'north' },
                    promptText: { type: 'string', example: 'I run my hand across the faded mural.' }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Traversal event stored.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestTraversalWriteResponse' })
            },
            '400': { description: 'Invalid traversal event payload.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/quest/advance': {
        post: op({
          tags: ['Quest'],
          summary: 'Advance quest state',
          importance: 'Critical',
          flow: 'Primary quest play route for following directions or generating persistent child screens from prompts.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['currentScreenId', 'actionType'],
                  properties: {
                    sessionId: { type: 'string', example: 'scene-authoring-demo' },
                    questId: { type: 'string', example: 'scene_authoring_starter' },
                    playerId: { type: 'string', example: 'wanderer-01' },
                    currentScreenId: { type: 'string', example: 'opening_tableau' },
                    actionType: { type: 'string', enum: ['direction', 'prompt'] },
                    direction: { type: 'string', example: 'north' },
                    targetScreenId: { type: 'string', example: 'mural_center_panel' },
                    promptText: { type: 'string', example: 'Inspect the cracked lantern niche behind the center mural.' },
                    mock: { type: 'boolean' },
                    debug: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Quest state advanced.',
              ...jsonResponse({ $ref: '#/components/schemas/QuestAdvanceResponse' })
            },
            '400': { description: 'Invalid request.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Screen or direction not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'Generation or schema failure.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '500': { description: 'Server error.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/worlds': {
        post: op({
          tags: ['Worldbuilding'],
          summary: 'Create world from seed text',
          importance: 'Critical',
          flow: 'First worldbuilding generation action for a session.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId', 'seedText'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    seedText: { type: 'string' },
                    name: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'World created.' },
            '502': { description: 'LLM/schema failure.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        get: op({
          tags: ['Worldbuilding'],
          summary: 'List worlds',
          importance: 'High',
          flow: 'Selection step when player revisits existing world instances.',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', true, 'Player identifier.')
          ],
          responses: {
            '200': { description: 'World list.' }
          }
        })
      },
      '/api/worlds/{worldId}': {
        get: op({
          tags: ['Worldbuilding'],
          summary: 'Get world details',
          importance: 'High',
          flow: 'Used after world selection to load the base world object.',
          parameters: [
            pathParam('worldId', 'World identifier.'),
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', true, 'Player identifier.')
          ],
          responses: {
            '200': { description: 'World found.' },
            '404': { description: 'World not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/worlds/{worldId}/state': {
        get: op({
          tags: ['Worldbuilding'],
          summary: 'Get world with grouped elements',
          importance: 'High',
          flow: 'Hydration step for world view including factions/locations/rumors/lore.',
          parameters: [
            pathParam('worldId', 'World identifier.'),
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', true, 'Player identifier.')
          ],
          responses: {
            '200': { description: 'World state payload.' }
          }
        })
      },
      '/api/worlds/{worldId}/factions': {
        post: op({
          tags: ['Worldbuilding'],
          summary: 'Generate factions',
          importance: 'High',
          flow: 'World expansion phase for faction generation.',
          parameters: [pathParam('worldId', 'World identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    count: { type: 'number' },
                    seedText: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'Factions generated.' }
          }
        })
      },
      '/api/worlds/{worldId}/locations': {
        post: op({
          tags: ['Worldbuilding'],
          summary: 'Generate locations',
          importance: 'High',
          flow: 'World expansion phase for locations generation.',
          parameters: [pathParam('worldId', 'World identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    count: { type: 'number' },
                    seedText: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'Locations generated.' }
          }
        })
      },
      '/api/worlds/{worldId}/rumors': {
        post: op({
          tags: ['Worldbuilding'],
          summary: 'Generate rumors',
          importance: 'Medium',
          flow: 'Flavor/plot-hook generation phase after core world exists.',
          parameters: [pathParam('worldId', 'World identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    count: { type: 'number' },
                    seedText: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'Rumors generated.' }
          }
        })
      },
      '/api/worlds/{worldId}/lore': {
        post: op({
          tags: ['Worldbuilding'],
          summary: 'Generate lore entries',
          importance: 'Medium',
          flow: 'Deepening phase for world history and themes.',
          parameters: [pathParam('worldId', 'World identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    count: { type: 'number' },
                    seedText: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '201': { description: 'Lore generated.' }
          }
        })
      },
      '/api/storytellers': {
        get: op({
          tags: ['Generation'],
          summary: 'List storytellers in session',
          importance: 'High',
          flow: 'Storyteller panel hydration after generation or mission updates.',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', true, 'Player identifier.')
          ],
          responses: {
            '200': { description: 'Storyteller list.' }
          }
        })
      },
      '/api/storytellers/{id}': {
        get: op({
          tags: ['Generation'],
          summary: 'Get one storyteller',
          importance: 'Medium',
          flow: 'Detail drill-down for storyteller state and mission history.',
          parameters: [
            pathParam('id', 'Storyteller identifier.'),
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', true, 'Player identifier.')
          ],
          responses: {
            '200': { description: 'Storyteller details.' },
            '404': { description: 'Not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/entities': {
        get: op({
          tags: ['Generation'],
          summary: 'List entities',
          importance: 'High',
          flow: 'Entity gallery hydration for world/arena interactions.',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', false, 'Optional player identifier.'),
            queryParam('mainEntityId', false, 'Filter by parent entity.'),
            queryParam('isSubEntity', false, 'Filter by sub-entity flag.'),
            queryParam('source', false, 'Filter by provenance source such as text_to_entity or storyteller_intervention.'),
            queryParam('type', false, 'Filter by canonical entity type.'),
            queryParam('subtype', false, 'Filter by canonical entity subtype.'),
            queryParam('externalId', false, 'Filter by canonical external entity id.'),
            queryParam('worldId', false, 'Filter by persistent world id.'),
            queryParam('universeId', false, 'Filter by persistent universe id.'),
            queryParam('name', false, 'Case-insensitive entity-name search.'),
            queryParam('tag', false, 'Case-insensitive tag search.'),
            queryParam('canonicalStatus', false, 'Filter by bank canonical status such as candidate or canonical.'),
            queryParam('linkedReadingId', false, 'Filter by seer reading linkage.'),
            queryParam('introducedByStorytellerId', false, 'Filter by storyteller origin id.'),
            queryParam('activeInTypewriter', false, 'Filter by active typewriter presence.'),
            queryParam('typewriterKeyText', false, 'Filter by the entity key label shown on the typewriter.'),
            queryParam('sort', false, 'Optional sort mode. Use "reuse" for highest reuse count first.'),
            queryParam('limit', false, 'Optional cap on returned results (1-200).')
          ],
          responses: {
            '200': {
              description: 'Entity list.',
              ...jsonResponse({ $ref: '#/components/schemas/NarrativeEntityListResponse' })
            }
          }
        })
      },
      '/api/entities/{id}/refresh': {
        post: op({
          tags: ['Generation'],
          summary: 'Refresh sub-entities for one entity',
          importance: 'High',
          flow: 'Investigation/expansion step to branch new entities from an existing node.',
          parameters: [pathParam('id', 'Entity identifier or externalId.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    note: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Refresh complete.' },
            '404': { description: 'Entity not found.' }
          }
        })
      },
      '/api/textToEntity': {
        post: op({
          tags: ['Generation'],
          summary: 'Generate entities from text',
          importance: 'Critical',
          flow: 'Main generation route that seeds cards/entities from player fragment.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    text: { type: 'string' },
                    count: { type: 'number' },
                    numberOfEntities: { type: 'number' },
                    desiredEntityCategories: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    includeCards: { type: 'boolean' },
                    includeFront: { type: 'boolean' },
                    includeBack: { type: 'boolean' },
                    mockImage: { type: 'boolean' },
                    mockTextures: { type: 'boolean' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Entity payload returned.',
              ...jsonResponse(TEXT_TO_ENTITY_RESPONSE_SCHEMA)
            }
          }
        })
      },
      '/api/textToStoryteller': {
        post: op({
          tags: ['Generation'],
          summary: 'Generate storytellers from text',
          importance: 'Critical',
          flow: 'Persona generation phase after or alongside entity generation.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    text: { type: 'string' },
                    count: { type: 'number' },
                    numberOfStorytellers: { type: 'number' },
                    generateKeyImages: { type: 'boolean' },
                    mockImage: { type: 'boolean' },
                    mockIllustrations: { type: 'boolean' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Storytellers returned.' },
            '502': { description: 'LLM/schema mismatch.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/seer/readings': {
        post: op({
          tags: ['Seer Reading'],
          summary: 'Create a seer reading',
          importance: 'Critical',
          flow: 'Seer setup route that seeds a blurred vision, opening cards, and the normalized reading payload from a session fragment.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SeerReadingCreateRequest' }
              }
            }
          },
          responses: {
            '201': { description: 'Reading created.', ...jsonResponse({ $ref: '#/components/schemas/SeerReadingResponse' }) },
            '400': { description: 'Missing required parameters.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '409': { description: 'No eligible memories found for this session.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/seer/readings/{readingId}': {
        get: op({
          tags: ['Seer Reading'],
          summary: 'Load a seer reading',
          importance: 'Critical',
          flow: 'Hydrates an existing seer reading so the client can resume the ritual state.',
          parameters: [
            pathParam('readingId', 'Persisted seer reading identifier.'),
            queryParam('playerId', false, 'Optional player identifier.')
          ],
          responses: {
            '200': { description: 'Reading returned.', ...jsonResponse({ $ref: '#/components/schemas/SeerReadingResponse' }) },
            '400': { description: 'Missing required path params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Reading not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/seer/readings/{readingId}/turn': {
        post: op({
          tags: ['Seer Reading'],
          summary: 'Advance one seer turn',
          importance: 'Critical',
          flow: 'Core Seer orchestration turn that applies one dominant ritual consequence and returns the next normalized reading state.',
          parameters: [pathParam('readingId', 'Persisted seer reading identifier.')],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SeerReadingTurnRequest' }
              }
            }
          },
          responses: {
            '200': { description: 'Reading advanced.', ...jsonResponse({ $ref: '#/components/schemas/SeerReadingResponse' }) },
            '400': { description: 'Missing turn payload fields.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Reading not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '409': { description: 'Reading already closed.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/seer/readings/{readingId}/cards/{cardId}/claim': {
        post: op({
          tags: ['Seer Reading'],
          summary: 'Claim a revealed seer card',
          importance: 'High',
          flow: 'Seals a claimable card into the reading, updates focus, and returns the updated reading state.',
          parameters: [
            pathParam('readingId', 'Persisted seer reading identifier.'),
            pathParam('cardId', 'Claimable card identifier.')
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    playerId: { type: 'string' }
                  },
                  additionalProperties: true
                }
              }
            }
          },
          responses: {
            '200': { description: 'Card claimed.', ...jsonResponse({ $ref: '#/components/schemas/SeerReadingResponse' }) },
            '400': { description: 'Missing required path params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Reading or card not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '409': { description: 'Card is not claimable or reading is closed.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/seer/readings/{readingId}/close': {
        post: op({
          tags: ['Seer Reading'],
          summary: 'Close a seer reading',
          importance: 'High',
          flow: 'Closes the reading, records closure metadata, and returns the final normalized reading payload.',
          parameters: [pathParam('readingId', 'Persisted seer reading identifier.')],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SeerReadingCloseRequest' }
              }
            }
          },
          responses: {
            '200': { description: 'Reading closed.', ...jsonResponse({ $ref: '#/components/schemas/SeerReadingResponse' }) },
            '400': { description: 'Missing required path params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Reading not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/fragmentToMemories': {
        post: op({
          tags: ['Generation'],
          summary: 'Generate memories from a fragment',
          importance: 'Critical',
          flow: 'Memory-generation route that expands a single fragment into moment-focused memory flashes.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    text: { type: 'string' },
                    count: { type: 'number' },
                    numberOfMemories: { type: 'number' },
                    includeCards: { type: 'boolean' },
                    includeFront: { type: 'boolean' },
                    includeBack: { type: 'boolean' },
                    mockImage: { type: 'boolean' },
                    mockTextures: { type: 'boolean' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Memories returned.', ...jsonResponse({ $ref: '#/components/schemas/FragmentToMemoriesResponse' }) },
            '400': { description: 'Missing required payload fields.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '502': { description: 'LLM/schema mismatch.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/memories/{memoryId}/textToImage/front': {
        post: op({
          tags: ['Generation'],
          summary: 'Generate a memory card front image',
          importance: 'High',
          flow: 'Regenerate the front card image for one persisted memory from Memory Spread admin or recovery tools.',
          parameters: [pathParam('memoryId', 'Persisted memory document identifier.')],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Memory front image generated.' },
            '400': { description: 'Missing required path params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Memory not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/memories/{memoryId}/textToImage/back': {
        post: op({
          tags: ['Generation'],
          summary: 'Generate a memory card back image',
          importance: 'High',
          flow: 'Regenerate the back card image for one persisted memory from Memory Spread admin or recovery tools.',
          parameters: [pathParam('memoryId', 'Persisted memory document identifier.')],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    text: { type: 'string' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Memory back image generated.' },
            '400': { description: 'Missing required path params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '404': { description: 'Memory not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/memories': {
        get: op({
          tags: ['Generation'],
          summary: 'List memories by session',
          importance: 'High',
          flow: 'Load previously generated memories for a session (optionally filtered by player or batch).',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', false, 'Optional player identifier.'),
            queryParam('batchId', false, 'Optional generation batch identifier.')
          ],
          responses: {
            '200': { description: 'Memories returned.' },
            '400': { description: 'Missing required query params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        }),
        delete: op({
          tags: ['Generation'],
          summary: 'Delete memories by session',
          importance: 'High',
          flow: 'Delete previously generated memories for a session (optionally filtered by player or batch).',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', false, 'Optional player identifier.'),
            queryParam('batchId', false, 'Optional generation batch identifier.')
          ],
          responses: {
            '200': { description: 'Memories deleted.' },
            '400': { description: 'Missing required query params.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/sendStorytellerToEntity': {
        post: op({
          tags: ['Generation'],
          summary: 'Run storyteller mission on entity',
          importance: 'Critical',
          flow: 'Mission execution step that can mutate world with newly derived sub-entities.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId', 'entityId', 'storytellerId', 'storytellingPoints', 'message'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    entityId: { type: 'string' },
                    storytellerId: { type: 'string' },
                    storytellingPoints: { type: 'number' },
                    message: { type: 'string' },
                    duration: { type: 'number' },
                    debug: { type: 'boolean' },
                    mock: { type: 'boolean' },
                    mock_api_calls: { type: 'boolean' },
                    mocked_api_calls: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Mission response.',
              ...jsonResponse(STORYTELLER_MISSION_RESPONSE_SCHEMA)
            },
            '502': { description: 'LLM/schema mismatch.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/arena/relationships/propose': {
        post: op({
          tags: ['Arena'],
          summary: 'Propose or commit relationship edge(s)',
          importance: 'Critical',
          flow: 'Core collaborative graph mutation route used during arena play.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId', 'source', 'targets', 'relationship'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    source: { type: 'object', additionalProperties: true },
                    targets: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    relationship: { type: 'object', additionalProperties: true },
                    options: { type: 'object', additionalProperties: true }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Accepted/rejected relationship result.' },
            '409': { description: 'Duplicate edge conflict.' }
          }
        })
      },
      '/api/arena/relationships/validate': {
        post: op({
          tags: ['Arena'],
          summary: 'Dry-run relationship validation',
          importance: 'High',
          flow: 'Pre-commit check path for UI before mutating graph.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId', 'playerId', 'source', 'targets', 'relationship'],
                  properties: {
                    sessionId: { type: 'string' },
                    playerId: { type: 'string' },
                    source: { type: 'object', additionalProperties: true },
                    targets: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    relationship: { type: 'object', additionalProperties: true },
                    options: { type: 'object', additionalProperties: true }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Dry-run verdict.' }
          }
        })
      },
      '/api/arena/state': {
        get: op({
          tags: ['Arena'],
          summary: 'Get full arena state',
          importance: 'Critical',
          flow: 'State hydration route for graph, scores, and cluster overlays.',
          parameters: [
            queryParam('sessionId', true, 'Session identifier.'),
            queryParam('playerId', true, 'Player identifier.'),
            queryParam('arenaId', false, 'Optional arena identifier.')
          ],
          responses: {
            '200': { description: 'Arena snapshot.' }
          }
        })
      },
      '/api/brewing/rooms': {
        post: op({
          tags: ['Brewing'],
          summary: 'Create brewing room',
          importance: 'Medium',
          flow: 'Mini-game lobby initialization step.',
          responses: {
            '200': {
              description: 'Room created.',
              ...jsonResponse({
                type: 'object',
                properties: {
                  roomId: { type: 'string' }
                }
              })
            }
          }
        })
      },
      '/api/brewing/rooms/{roomId}': {
        get: op({
          tags: ['Brewing'],
          summary: 'Get brewing room state',
          importance: 'Medium',
          flow: 'Lobby state refresh and reconnection route.',
          parameters: [pathParam('roomId', 'Brewing room identifier.')],
          responses: {
            '200': { description: 'Room state returned.' },
            '404': { description: 'Room not found.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/brewing/rooms/{roomId}/join': {
        post: op({
          tags: ['Brewing'],
          summary: 'Join brewing room',
          importance: 'High',
          flow: 'Player joins mini-game before ready/start cycle.',
          parameters: [pathParam('roomId', 'Brewing room identifier.')],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    maskId: { type: 'string' },
                    displayName: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Joined room.' }
          }
        })
      },
      '/api/brewing/rooms/{roomId}/players/{playerId}/ready': {
        post: op({
          tags: ['Brewing'],
          summary: 'Toggle player ready state',
          importance: 'High',
          flow: 'Lobby readiness gate before brewing round starts.',
          parameters: [
            pathParam('roomId', 'Brewing room identifier.'),
            pathParam('playerId', 'Player identifier.')
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ready'],
                  properties: {
                    ready: { type: 'boolean' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Ready state updated.' },
            '400': { description: 'Invalid ready payload.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/brewing/rooms/{roomId}/start': {
        post: op({
          tags: ['Brewing'],
          summary: 'Start brewing game',
          importance: 'High',
          flow: 'Transitions room from lobby to active brewing phase.',
          parameters: [pathParam('roomId', 'Brewing room identifier.')],
          responses: {
            '200': { description: 'Brewing started.' },
            '400': { description: 'Cannot start.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      },
      '/api/brewing/rooms/{roomId}/turn/submit': {
        post: op({
          tags: ['Brewing'],
          summary: 'Submit ingredient for active turn',
          importance: 'Critical',
          flow: 'Primary turn action route in brewing gameplay loop.',
          parameters: [
            pathParam('roomId', 'Brewing room identifier.'),
            {
              name: 'x-player-id',
              in: 'header',
              required: true,
              schema: { type: 'string' },
              description: 'Active player identifier for turn ownership check.'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ingredient'],
                  properties: {
                    ingredient: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Ingredient accepted.' },
            '400': { description: 'Missing header or invalid payload.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) },
            '403': { description: 'Not active player.' }
          }
        })
      },
      '/api/brewing/events': {
        get: op({
          tags: ['Brewing'],
          summary: 'Subscribe to brewing SSE stream',
          importance: 'High',
          flow: 'Real-time synchronization channel for brewing events.',
          parameters: [queryParam('roomId', true, 'Brewing room identifier.')],
          responses: {
            '200': {
              description: 'SSE stream connected.',
              content: {
                'text/event-stream': {
                  schema: { type: 'string' }
                }
              }
            },
            '400': { description: 'Missing roomId.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
          }
        })
      }
    }
  };
}

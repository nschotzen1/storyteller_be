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
          properties: {
            routeKey: { type: 'string' },
            routePath: { type: 'string' },
            method: { type: 'string' },
            description: { type: 'string' },
            promptTemplate: { type: 'string' },
            responseSchema: { type: 'object', additionalProperties: true },
            meta: { type: 'object', additionalProperties: true }
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
                additionalProperties: { $ref: '#/components/schemas/LlmRouteConfig' }
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
            '200': { description: 'Route config returned.', ...jsonResponse({ $ref: '#/components/schemas/LlmRouteConfig' }) },
            '400': { description: 'Unknown routeKey.', ...jsonResponse({ $ref: '#/components/schemas/ErrorResponse' }) }
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
                    promptTemplate: { type: 'string' },
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
            queryParam('playerId', true, 'Player identifier.'),
            queryParam('mainEntityId', false, 'Filter by parent entity.'),
            queryParam('isSubEntity', false, 'Filter by sub-entity flag.')
          ],
          responses: {
            '200': { description: 'Entity list.' }
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
                    userText: { type: 'string' },
                    fragment: { type: 'string' },
                    includeCards: { type: 'boolean' },
                    includeFront: { type: 'boolean' },
                    includeBack: { type: 'boolean' },
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
            '200': { description: 'Entity payload returned.' }
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
                    userText: { type: 'string' },
                    fragment: { type: 'string' },
                    count: { type: 'number' },
                    numberOfStorytellers: { type: 'number' },
                    generateKeyImages: { type: 'boolean' },
                    mockImage: { type: 'boolean' },
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
            '200': { description: 'Mission response.' },
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

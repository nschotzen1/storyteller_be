# storyteller_be

## Overview

Node/Express backend for Storyteller game services. The primary entrypoint is `server_new.js` (ESM).
Assets are served from `/assets` (local `assets/`). MongoDB is required at
`mongodb://localhost:27017/storytelling`.

## Quick Start

```bash
npm install
node server_new.js
```

Default port: `5001`.

## API Docs (Swagger)

- Swagger UI: `GET /api/docs`
- OpenAPI JSON: `GET /api/openapi.json`

These focus on the important gameplay/worldbuilding/admin routes so the route surface is easier to audit.

## Admin LLM Config

The backend now supports versioned structured-output contracts for key LLM-backed routes.

- List configs: `GET /api/admin/llm-config`
- Get one route config: `GET /api/admin/llm-config/:routeKey`
- Save full contract version: `POST /api/admin/llm-config/:routeKey`
- List contract versions: `GET /api/admin/llm-config/:routeKey/versions`
- Set latest contract version: `POST /api/admin/llm-config/:routeKey/latest`
- Update prompt template: `PUT /api/admin/llm-config/:routeKey/prompt`
- Update response schema: `PUT /api/admin/llm-config/:routeKey/schema`
- Reset route config to defaults: `POST /api/admin/llm-config/:routeKey/reset`

Route config keys currently available:

- `worlds_create`
- `worlds_elements`
- `text_to_storyteller`
- `storyteller_mission`
- `fragment_to_memories`

Persistence:

- Defaults are in code (`services/llmRouteConfigService.js`)
- Versioned overrides are stored in Mongo (`LlmRouteConfigVersion`)
- Each contract can store `promptMode`, `promptCore`, `responseSchema`, `fieldDocs`, `examplePayload`, and `outputRules`

Optional admin auth:

- Set `ADMIN_API_KEY` in env.
- Send `x-admin-key: <your-key>` header for `/api/admin/*` routes.

## Request Conventions

- Most routes require `sessionId` and `playerId`.
- `debug`, `mock`, or `mocked_api_calls` returns mocked outputs and skips external API calls.
- Use `text` as the canonical input field for narrative/fragment payloads.

## Immersive RPG Skeleton

The first immersive RPG pass is now scaffolded around persisted session state plus scene-specific dependencies.

- `GET /api/immersive-rpg/scene?sessionId=...`
  Resolves the active scene for the session, lazily bootstraps it if dependencies are present, and returns `ready: false` plus `missingContext` when the scene is blocked.
- `POST /api/immersive-rpg/chat`
  Appends free-text PC actions and returns the next scaffolded GM beat.
- `POST /api/immersive-rpg/rolls`
  Resolves notebook-style dice pool rolls (`XdY`, successes on threshold or higher).
- `GET /api/immersive-rpg/character-sheet`
  Loads the PC character-sheet skeleton for the session/player.
- `PUT /api/immersive-rpg/character-sheet`
  Persists the editable character-sheet skeleton.

Current scope:
- The client only needs `sessionId`; the server resolves the current scene and its dependencies.
- Scene 3 currently depends on the messenger-derived place brief already being stored for the session.
- If Story Admin sets `immersive_rpg_gm.useMock=true`, missing scene dependencies can be mocked internally instead of requiring setup routes.
- The Scene 3 master prompt is currently stored in code and mirrored into the scene payload as `compiledPrompt`.
- Scene progression, transcript, pending rolls, roll history, and character sheet all persist in Mongo.

## Core Routes

### POST `/api/textToEntity`

Generates entities from text and can optionally return card prompts for front/back sides.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "text": "A wind-scoured pass with a rusted watchtower and a lone courier arriving at dusk.",
  "includeCards": true,
  "includeFront": true,
  "includeBack": true,
  "debug": false,
  "mocked_api_calls": false
}
```

Notes:
- Use `text` for the input narrative.
- `includeCards` defaults to `false`.
- `includeFront` and `includeBack` default to `true` when cards are requested.
- `debug`, `mock`, or `mocked_api_calls` returns mock entities/cards without external API calls.

Response (cards included):
```json
{
  "sessionId": "demo-1",
  "entities": [
    {
      "id": "abc123",
      "name": "Emberline Waystation",
      "ner_type": "LOCATION",
      "ner_subtype": "Border Outpost",
      "description": "A soot-stained refuge of iron and red stone...",
      "relevance": "A waypoint rumored to sit on the edge..."
    }
  ],
  "cards": [
    {
      "entityId": "abc123",
      "entityName": "Emberline Waystation",
      "front": {
        "prompt": "Create a highly detailed RPG collector card front illustration...",
        "imageUrl": "/assets/demo-1/cards/abc123_front.png"
      },
      "back": {
        "prompt": "Card texture: A worn, full-frame RPG card back...",
        "texture": {
          "text_for_entity": "Emberline Waystation",
          "font": "Cormorant Garamond",
          "font_size": "22px",
          "font_color": "weathered silver",
          "card_material": "aged parchment",
          "major_cultural_influences_references": [
            "Numenera",
            "The Broken Earth Trilogy",
            "Dark Crystal",
            "Moebius"
          ]
        },
        "imageUrl": "/assets/demo-1/cards/abc123_back.png"
      }
    }
  ],
  "mocked": false,
  "cardOptions": {
    "includeFront": true,
    "includeBack": true
  }
}
```

### POST `/api/worlds`

Creates a world from a seed fragment and stores it for the session/player.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "seedText": "A trade sea of salt glass, where storms rewrite maps each season.",
  "name": "The Shale Meridian",
  "debug": true
}
```

Response:
```json
{
  "world": {
    "worldId": "e1a2b3c4-d5f6-7890-1234-56789abcdeff",
    "sessionId": "demo-1",
    "playerId": "player-1",
    "seedText": "A trade sea of salt glass, where storms rewrite maps each season.",
    "name": "The Shale Meridian",
    "summary": "A salt-crusted inland sea holds the last trade routes...",
    "tone": "weathered, luminous, quietly political",
    "pillars": ["scarcity-driven diplomacy", "ancient machines waking with the tides"],
    "themes": ["oaths and debt", "memory as currency"],
    "palette": ["ash white", "oxidized copper", "glacier blue"]
  },
  "mocked": true
}
```

### POST `/api/worlds/:worldId/factions|locations|rumors|lore`

Generates world elements for a given world and stores them.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "count": 2,
  "debug": true
}
```

Response:
```json
{
  "worldId": "e1a2b3c4-d5f6-7890-1234-56789abcdeff",
  "type": "faction",
  "elements": [
    {
      "name": "The Tide Ledger",
      "description": "A merchant synod that writes contracts...",
      "tags": ["trade", "ritual", "law"],
      "traits": ["meticulous", "soft-spoken"],
      "hooks": ["They need an oathbreaker retrieved..."]
    }
  ],
  "mocked": true
}
```

### GET `/api/worlds?sessionId=...&playerId=...`

Lists worlds for the session/player.

### GET `/api/worlds/:worldId?sessionId=...&playerId=...`

Fetches a single world.

### GET `/api/worlds/:worldId/state?sessionId=...&playerId=...`

Returns the world plus grouped elements by type.

### POST `/api/textToStoryteller`

Generates storyteller personas from a fragment and saves them.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "text": "A wind-scoured pass with a rusted watchtower and a lone courier arriving at dusk.",
  "count": 3,
  "generateKeyImages": false,
  "mocked_api_calls": false
}
```

Notes:
- `count` (or `numberOfStorytellers`) defaults to `3` and is clamped to 1–10.
- `debug`, `mock`, or `mocked_api_calls` returns mock storytellers without external API calls.
- Set `generateKeyImages` to `true` to create typewriter key images (requires image service).
- An illustration for each storyteller is automatically generated and saved.

Response:
```json
{
  "sessionId": "demo-1",
  "storytellers": [
    {
      "_id": "66c9e9f0b5a5c7d123456789",
      "session_id": "demo-1",
      "name": "Aster Vell",
      "immediate_ghost_appearance": "A ripple of ink and smoke...",
      "typewriter_key": {
        "symbol": "ink moth",
        "description": "A tarnished brass key with..."
      },
      "influences": ["Obsidian Canticles", "Wasteland Noir"],
      "known_universes": ["The Riven Orrery"],
      "level": 12,
      "voice_creation": {
        "voice": "female",
        "age": "ageless",
        "style": "measured, smoky"
      },
      "illustration": "/assets/demo-1/storyteller_illustrations/Aster_Vell_illustration.png"
    }
  ],
  "keyImages": [],
  "count": 1
}
```

### POST `/api/fragmentToMemories`

Generates memory flashes from a fragment and persists each memory in MongoDB.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "text": "It was getting dark, and the pass had no rail, only wet stone and wind.",
  "count": 3,
  "includeCards": true,
  "includeFront": true,
  "includeBack": true,
  "mocked_api_calls": false
}
```

Notes:
- `sessionId` is required.
- Use `text` for source narrative.
- `count` (or `numberOfMemories`) defaults to `3` and is clamped to 1–10.
- `includeCards` defaults to `false`.
- `includeFront` and `includeBack` default to `true` when cards are requested.
- `debug`, `mock`, or `mocked_api_calls` returns mock memories.

Response:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "batchId": "f14f11ee-4f41-4df1-9b31-2c351f2f0ee6",
  "memories": [
    {
      "_id": "67ab6cb1f1f3dd4f005a0a55",
      "memory_strength": "vivid",
      "emotional_sentiment": "tense resolve",
      "action_name": "crossing unstable stone ledges above a flooded ravine",
      "estimated_action_length": "20 minutes",
      "time_within_action": "middle",
      "actual_result": "a near-fall is avoided by instinct and luck",
      "related_through_what": "shared location and immediate stakes echoing the fragment",
      "geographical_relevance": "wet basalt and crosswinds make every step dangerous",
      "temporal_relation": "this moment",
      "organizational_affiliation": "none",
      "consequences": "typical danger suddenly escalates into a critical choice",
      "distance_from_fragment_location_km": 0,
      "shot_type": "close-up",
      "time_of_day": "twilight",
      "whose_eyes": "the courier gripping a frayed rope line",
      "interior/exterior": "exterior",
      "what_is_being_watched": "boots slipping at the ravine edge",
      "location": "Ravine shelf above the Yuradel run",
      "estimated_duration_of_memory": 12,
      "memory_distance": "meanwhile",
      "entities_in_memory": ["ravine shelf", "rope line", "courier"],
      "currently_assumed_turns_to_round": "10 minutes - 1 hour",
      "relevant_rolls": ["Dexterity", "Perception", "Resolve"],
      "action_level": "round",
      "dramatic_definition": "Where Stone Gives Way",
      "miseenscene": "The rope burns my palm...",
      "front": {
        "prompt": "Create a full-frame RPG collector card FRONT illustration...",
        "imageUrl": "/assets/demo-1/memory_cards/f14f11ee-4f41-4df1-9b31-2c351f2f0ee6/01_where_stone_gives_way_front.png"
      },
      "back": {
        "prompt": "Create a full-frame RPG collector card BACK texture...",
        "imageUrl": "/assets/demo-1/memory_cards/f14f11ee-4f41-4df1-9b31-2c351f2f0ee6/01_where_stone_gives_way_back.png"
      }
    }
  ],
  "count": 1,
  "mocked": false,
  "cardOptions": {
    "includeFront": true,
    "includeBack": true
  }
}
```

### GET `/api/memories?sessionId=...&playerId=...&batchId=...`

Returns persisted memories for a session from MongoDB.

Notes:
- `sessionId` is required.
- `playerId` is optional (filters to one player).
- `batchId` is optional (filters to one generation batch).

### DELETE `/api/memories?sessionId=...&playerId=...&batchId=...`

Deletes persisted memories for a session from MongoDB.

Notes:
- `sessionId` is required.
- `playerId` is optional (deletes only one player's memories).
- `batchId` is optional (deletes only one generation batch).

### POST `/api/sendStorytellerToEntity`

Assigns a storyteller to an entity, records the outcome, and generates sub-entities.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "entityId": "abc123",
  "storytellerId": "66c9e9f0b5a5c7d123456789",
  "storytellingPoints": 12,
  "message": "Investigate the source of the whispering lanterns.",
  "duration": 3,
  "debug": false,
  "mocked_api_calls": false
}
```

Response (shape):
```json
{
  "sessionId": "demo-1",
  "storytellerId": "66c9e9f0b5a5c7d123456789",
  "outcome": "success",
  "userText": "The mission concludes...",
  "gmNote": "Lean into the sensory details...",
  "entity": { "name": "Emberline Waystation" },
  "subEntities": []
}
```

Notes:
- `debug`, `mock`, or `mocked_api_calls` returns a mocked mission outcome and mocked sub-entities.

### GET `/api/storytellers?sessionId=...&playerId=...`

Returns storytellers with status and last mission summary.

Response:
```json
{
  "sessionId": "demo-1",
  "storytellers": [
    {
      "id": "66c9e9f0b5a5c7d123456789",
      "name": "Aster Vell",
      "status": "active",
      "level": 12,
      "lastMission": {
        "outcome": "success",
        "message": "Investigate the lanterns.",
        "entityExternalId": "mock-entity-1",
        "createdAt": "2025-03-01T12:00:00.000Z"
      }
    }
  ]
}
```

### GET `/api/storytellers/:id?sessionId=...&playerId=...`

Returns a single storyteller with mission history.

Response:
```json
{
  "storyteller": {
    "_id": "66c9e9f0b5a5c7d123456789",
    "name": "Aster Vell",
    "status": "active",
    "missions": []
  }
}
```

### GET `/api/entities?sessionId=...&playerId=...`

Returns entities for a session.

Optional filters:
- `mainEntityId=...`
- `isSubEntity=true|false`

Response:
```json
{
  "sessionId": "demo-1",
  "entities": [
    {
      "_id": "66c9e9f0b5a5c7d123456790",
      "name": "Emberline Waystation",
      "externalId": "mock-entity-1",
      "isSubEntity": false
    }
  ]
}
```

### POST `/api/entities/:id/refresh`

Generates new sub-entities for an existing entity.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "note": "Focus on hidden dangers or secret factions.",
  "debug": false,
  "mocked_api_calls": false
}
```

Response:
```json
{
  "sessionId": "demo-1",
  "entity": { "name": "Emberline Waystation" },
  "subEntities": [],
  "mocked": false
}
```

### GET `/api/sessions/:sessionId/players`

Returns the players registered for a session.

Response:
```json
{
  "count": 2,
  "players": [
    {
      "id": "player-uuid",
      "playerId": "player-uuid",
      "playerName": "Ada"
    }
  ]
}
```

### POST `/api/sessions/:sessionId/players`

Registers a new player.

Request body:
```json
{
  "playerName": "Ada"
}
```

Response:
```json
{
  "playerId": "player-uuid",
  "id": "player-uuid"
}
```

### GET `/api/sessions/:sessionId/arena?playerId=...`

Loads the shared arena for a session.

Response:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "arena": { "entities": [], "storytellers": [] },
  "lastUpdatedBy": "player-1",
  "updatedAt": "2025-03-01T12:00:00.000Z"
}
```

### POST `/api/sessions/:sessionId/arena`

Persists the shared arena for a session.

Request body:
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "arena": { "entities": [], "storytellers": [] }
}
```

## 5 Pillar Architecture (v100)

The system is designed for maximum maintainability and clarity, organized into 5 functional layers:

1.  **Engine** (`scenarioRunnerService.js`): Orchestrates session lifecycles and narrative steps.
2.  **Brain** (`mockLLMService.js`): Simulates LLM responses with context-aware grounding logic.
3.  **Contract** (`llmModuleSchemas.js`): Enforces strict JSON schemas (including mandatory **Slugs**).
4.  **Voice** (`llmPromptService.js`): Translates context into human-readable LLM instructions.
5.  **Memory** (`agentReflectionService.js`): Analyzes past sessions to evolve agent understanding.

---

## Technical Rigor: The Slug System

Entities are identified by three layers of identity:
- **UUID**: Primary database key (e.g., `ent_123_abc`).
- **Slug**: Technical, human-readable reference (e.g., `the-obsidian-hound`). **Required in all scripts.**
- **Name**: Human-readable display text (e.g., "The Obsidian Hound").

The system automatically resolves references in the order: `UUID` -> `Slug` -> `Name`.

---

## Execution Pipeline

We have consolidated all experimental logic into three core entry points:

### 1. `scripts/master_runner.js`
The primary tool for running world scenarios. Supports multiple "Lore Cycles" (e.g., Desert Watch, Threshold).
```bash
# Run the Desert Watch scenario
NODE_ENV=test node scripts/master_runner.js desert_watch
```

### 2. `scripts/seed_world.js`
Rapidly seeds a world with initial entities and memories based on a fragment.
```bash
NODE_ENV=test node scripts/seed_world.js "A silent forest where the trees whisper secrets."
```

### 3. `scripts/teach_agent.js`
Injects new narrative principles or themes into the Agent's brain.

---

## Development & Persistence

- **MongoDB**: Stores the rich state (Sensory Profiles, Dynamic States, Lore).
- **Neo4j**: Stores the spatial graph (Entity relationships and clusters).
- **Brain (Locus)**: The `.gemini/brain` directory contains the task list, achievement reports, and architecture plans.

Running locally requires Docker for Neo4j:
```bash
docker-compose up -d
```

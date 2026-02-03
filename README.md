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

## Request Conventions

- Most routes require `sessionId` and `playerId`.
- `debug`, `mock`, or `mocked_api_calls` returns mocked outputs and skips external API calls.
- `text`, `userText`, or `fragment` are accepted for text input.

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
- Use `text`, `userText`, or `fragment` for the input text (the route picks the first provided).
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

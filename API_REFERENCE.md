# Storyteller Backend API Reference

Comprehensive documentation for the Storyteller game backend.

## Base URL
Local: `http://localhost:5001`

## Authentication & Context
Most endpoints require the following identifiers in the request body or query params:
- `sessionId`: Unique string for the game session (e.g., "demo-1").
- `playerId`: Unique string for the player (e.g., "player-uuid").

## Development Tools
### Mock Mode
Add any of these flags to `true` in your request body to bypass external APIs (OpenAI/Replicate) and get instant deterministic responses:
- `debug`
- `mock`
- `mocked_api_calls`

---

# 1. Entity & Card Generation

### POST `/api/textToEntity`
Generates entities and optional card visuals from a text fragment.

**Request:**
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "text": "A wind-scoured pass with a rusted watchtower and a lone courier.",
  "includeCards": true,
  "includeFront": true,  // Default: true
  "includeBack": true,   // Default: true
  "debug": false         // Set true for instant mock response
}
```

**Response:**
```typescript
interface TextToEntityResponse {
  sessionId: string;
  entities: Entity[];
  cards: CardAsset[];
  mocked: boolean;
}

interface CardAsset {
  entityId: string;
  entityName: string;
  front: { prompt: string; imageUrl: string }; // URL to /assets/...
  back: { prompt: string; texture: any; imageUrl: string };
}
```

---

# 2. Arena Management

### GET `/api/sessions/:sessionId/arena`
Loads the current card placements.

**Query:** `?playerId=...`

**Response:**
```json
{
  "sessionId": "demo-1",
  "arena": {
    "entities": [
      {
        "cardId": "card_123",
        "entityId": "ent_456",
        "position": { "x": 100, "y": 200 },
        "rotation": 0
      }
    ],
    "storytellers": []
  },
  "lastUpdatedBy": "player-1"
}
```

### POST `/api/sessions/:sessionId/arena`
Saves card placements.

**Request:**
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "arena": {
    "entities": [
      { "cardId": "...", "position": { "x": 100, "y": 200 } }
    ]
  }
}
```

---

# 3. Connect Entities (Relationships)

### POST `/api/arena/relationships/propose`
Proposes a connection between two cards. The system acts as a "judge" to accept or reject it based on quality.

**Request:**
```json
{
  "sessionId": "demo-1",
  "playerId": "player-1",
  "source": { "entityId": "ent_1" }, // Or { "cardId": "c1" }
  "targets": [{ "entityId": "ent_2" }],
  "relationship": {
    "surfaceText": "sometimes seen at the summit during storms"
  },
  "debug": false
}
```

**Response (Accepted):**
```json
{
  "verdict": "accepted",
  "edge": {
    "edgeId": "edge_new_123",
    "fromCardId": "ent_1",
    "toCardId": "ent_2",
    "surfaceText": "sometimes seen at the summit during storms",
    "quality": { "score": 0.75, "reasons": ["Specific and evocative"] }
  },
  "points": { "awarded": 16, "playerTotal": 32 }
}
```

**Response (Rejected):**
```json
{
  "verdict": "rejected",
  "quality": { "score": 0.35, "reasons": ["Too brief"] },
  "suggestions": [{ "surfaceText": "connected to" }]
}
```

### POST `/api/arena/relationships/validate`
Same as `/propose` but only checks quality (dry run). Use for UI previews.

### GET `/api/arena/state`
Returns the full graph state: entities, existing edges, and scores.

**Query:** `?sessionId=...&playerId=...`

**Response:**
```json
{
  "sessionId": "...,"
  "arena": { "entities": [...] },
  "edges": [
    { "edgeId": "...", "fromCardId": "...", "toCardId": "...", "surfaceText": "..." }
  ],
  "scores": { "player-1": 32 }
}
```

---

# 4. Storytellers (Personas)

### POST `/api/textToStoryteller`
Generates storyteller personas (NPCs/Narrators).

**Request:**
```json
{
  "sessionId": "demo-1",
  "text": "Context for generation...",
  "count": 3
}
```

**Response:**
```json
{
  "storytellers": [
    {
      "_id": "st_123",
      "name": "Aster Vell",
      "illustration": "/assets/.../illustration.png"
    }
  ]
}
```

### POST `/api/sendStorytellerToEntity`
Sends a storyteller on a mission to an entity card.

**Request:**
```json
{
  "sessionId": "demo-1",
  "storytellerId": "st_123",
  "entityId": "ent_456",
  "message": "Investigate the ruins.",
  "storytellingPoints": 5
}
```

**Response:**
```json
{
  "outcome": "success",
  "userText": "Aster reports that...",
  "subEntities": [] // New entities discovered during mission
}
```

---

# Frontend Implementation Guide

## Typical User Flow: "World Building"

1. **Text Prompt**: User enters text "A misty valley...".
2. **Generate**: Frontend calls `POST /api/textToEntity` with `includeCards: true`.
3. **Display**: Frontend displays draggable cards using the returned `imageUrl`s.
4. **Place**: User drags a card to the board. Frontend calls `POST /api/sessions/:sessionId/arena` to save position.
5. **Connect**:
   - User draws a line between Card A and Card B.
   - Frontend opens text input for relationship.
   - User types "secretly guarding".
   - (Optional) Frontend debounces calls to `/validate` for live feedback.
   - User submits. Frontend calls `/propose`.
   - If accepted: Frontend draws the edge and plays particle effect (+Points).
   - If rejected: Frontend shakes input and shows suggestions.

## Handling Images
- All images are returned as relative paths starting with `/assets/...`.
- Prepend the backend base URL (e.g., `http://localhost:5001`) to render them.
- In `mock/debug` mode, images are pre-generated plac-holders but fully functional.

## Error Handling
- **400 Bad Request**: Missing fields. Check console.
- **409 Conflict**: Duplicate relationship (edge already exists).
- **500 Server Error**: AI service failure (or network). Retry button recommended.

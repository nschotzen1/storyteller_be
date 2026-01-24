# Arena Relationships API — Frontend Specification

Complete API reference for building the Connect Entities UI.

---

## Endpoints Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/arena/relationships/propose` | Create relationship (judge + commit) |
| POST | `/api/arena/relationships/validate` | Preview validation (no commit) |
| GET | `/api/arena/state` | Get full arena graph |

---

## Types

```typescript
interface Card {
  cardId: string;      // Either cardId or entityId required
  entityId?: string;
}

interface Relationship {
  surfaceText: string;              // Required - the relationship phrase
  predicateHint?: string;           // Optional - suggested predicate slug
  direction?: 'source_to_target' | 'target_to_source' | 'bidirectional';
}

interface Quality {
  score: number;       // 0-1, higher is better
  confidence: number;  // 0-1, model confidence
  reasons: string[];   // Human-readable explanations
}

interface Edge {
  edgeId: string;
  fromCardId: string;
  toCardId: string;
  surfaceText: string;
  predicate: string;           // Normalized slug
  direction: string;
  quality: Quality;
  createdBy: string;           // playerId
  createdAt: string;           // ISO timestamp
}

interface Points {
  awarded: number;             // Points for this action
  playerTotal: number;         // Running total
  breakdown: string[];         // Scoring explanation
}

interface EvolutionDelta {
  cardId: string;
  delta: number;               // 1-2 typically
  changeSummary: string;
}
```

---

## POST /api/arena/relationships/propose

### Request

```typescript
interface ProposeRequest {
  // Required
  sessionId: string;
  playerId: string;
  source: Card;
  targets: Card[];              // 1+ target cards
  relationship: Relationship;
  
  // Optional
  arenaId?: string;             // Defaults to "default"
  context?: {
    turnId?: string;
    recentNarrativeExcerpt?: string;
    playerIntent?: string;      // Why player thinks this is true
  };
  options?: {
    dryRun?: boolean;           // If true, don't commit
    allowMultiTarget?: boolean;
    allowRewrite?: boolean;
  };
  
  // Debug flags (any of these enables mock mode)
  debug?: boolean;
  mock?: boolean;
  mocked_api_calls?: boolean;
}
```

### Request Example (Minimal)

```json
{
  "sessionId": "session-abc123",
  "playerId": "player-1",
  "source": { "cardId": "card_miri_lights" },
  "targets": [{ "cardId": "card_oak_plateau" }],
  "relationship": {
    "surfaceText": "sometimes seen at the summit during storms"
  }
}
```

### Request Example (Full)

```json
{
  "sessionId": "session-abc123",
  "playerId": "player-1",
  "arenaId": "default",
  "source": { 
    "cardId": "card_miri_lights",
    "entityId": "ent_miri_lights"
  },
  "targets": [
    { "cardId": "card_oak_plateau", "entityId": "ent_oak_plateau" }
  ],
  "relationship": {
    "surfaceText": "sometimes seen at the summit during storms",
    "predicateHint": "sometimes_seen_at",
    "direction": "source_to_target"
  },
  "context": {
    "turnId": "turn_19",
    "playerIntent": "Anchor phenomenon to a windswept location"
  },
  "options": {
    "dryRun": false,
    "allowMultiTarget": true
  },
  "debug": false
}
```

---

### Response: Accepted (200)

```typescript
interface AcceptedResponse {
  verdict: 'accepted';
  edge: Edge | Edge[];         // Single edge or array if multi-target
  points: Points;
  evolution: {
    affected: EvolutionDelta[];
    regenSuggested: Array<{
      cardId: string;
      fields: string[];        // e.g. ["front.prompt", "front.imageUrl"]
    }>;
  };
  clusters: {
    touched: string[];         // Cluster IDs affected
    metrics: Array<{
      clusterId: string;
      cohesion: number;
      keywords: string[];
    }>;
  };
  existingEdgesCount: number;  // Context edges found
  mocked: boolean;
}
```

```json
{
  "verdict": "accepted",
  "edge": {
    "edgeId": "edge_a67e9337",
    "fromCardId": "card_miri_lights",
    "toCardId": "card_oak_plateau",
    "surfaceText": "sometimes seen at the summit during storms",
    "predicate": "sometimes_seen_at_the_summit_during_storms",
    "direction": "source_to_target",
    "quality": {
      "score": 0.75,
      "confidence": 0.8,
      "reasons": [
        "Relationship text is descriptive and specific"
      ]
    },
    "createdBy": "player-1",
    "createdAt": "2026-01-23T00:48:21.814Z"
  },
  "points": {
    "awarded": 16,
    "playerTotal": 32,
    "breakdown": [
      "Base quality score: 0.75 → 16 points"
    ]
  },
  "evolution": {
    "affected": [
      {
        "cardId": "card_oak_plateau",
        "delta": 2,
        "changeSummary": "Connection established: \"sometimes seen at the summit during storms\""
      }
    ],
    "regenSuggested": []
  },
  "clusters": {
    "touched": [],
    "metrics": []
  },
  "existingEdgesCount": 1,
  "mocked": false
}
```

---

### Response: Rejected (200)

```typescript
interface RejectedResponse {
  verdict: 'rejected';
  quality: Quality;
  suggestions: Array<{
    predicate: string;
    surfaceText: string;
  }>;
}
```

```json
{
  "verdict": "rejected",
  "quality": {
    "score": 0.35,
    "confidence": 0.6,
    "reasons": [
      "Relationship text is too brief"
    ]
  },
  "suggestions": [
    { "predicate": "sometimes_seen_at", "surfaceText": "sometimes seen at" },
    { "predicate": "connected_to", "surfaceText": "connected to" }
  ]
}
```

---

### Response: Duplicate Edge (409)

```json
{
  "message": "Duplicate edge already exists.",
  "existingEdge": {
    "edgeId": "edge_a67e9337",
    "fromCardId": "card_miri_lights",
    "toCardId": "card_oak_plateau",
    "predicate": "sometimes_seen_at_the_summit_during_storms",
    "createdBy": "player-1",
    "createdAt": "2026-01-23T00:48:21.814Z"
  }
}
```

---

### Response: Dry Run (200)

When `options.dryRun: true`:

```json
{
  "verdict": "accepted",
  "dryRun": true,
  "quality": {
    "score": 0.75,
    "confidence": 0.8,
    "reasons": ["Relationship text is descriptive and specific"]
  },
  "predicate": "mysteriously_connected_to",
  "message": "Relationship would be accepted (dry run, not committed)."
}
```

---

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Missing sessionId, playerId, source, targets, or surfaceText |
| 409 | Duplicate edge exists |
| 500 | Server error |

```json
{
  "message": "Missing required parameters: sessionId or playerId."
}
```

---

## POST /api/arena/relationships/validate

Identical to `/propose` but always runs in dry-run mode. Use for "preview" UI before committing.

### Request
Same as `/propose`

### Response
Same as `/propose` with `dryRun: true`

---

## GET /api/arena/state

### Request (Query Params)

| Param | Required | Description |
|-------|----------|-------------|
| sessionId | Yes | Session identifier |
| playerId | Yes | Player identifier |
| arenaId | No | Defaults to "default" |

```
GET /api/arena/state?sessionId=session-abc&playerId=player-1
```

### Response

```typescript
interface ArenaStateResponse {
  sessionId: string;
  playerId: string;
  arenaId: string;
  arena: {
    entities: any[];       // Card placements
    storytellers: any[];
  };
  edges: Edge[];
  clusters: Array<{
    clusterId: string;
    cardIds: string[];
    cohesion: number;
    keywords: string[];
  }>;
  scores: Record<string, number>;  // playerId → total points
  lastUpdatedBy?: string;
  updatedAt?: string;
}
```

```json
{
  "sessionId": "session-abc123",
  "playerId": "player-1",
  "arenaId": "default",
  "arena": {
    "entities": [],
    "storytellers": []
  },
  "edges": [
    {
      "edgeId": "edge_a67e9337",
      "fromCardId": "card_miri_lights",
      "toCardId": "card_oak_plateau",
      "surfaceText": "sometimes seen at the summit during storms",
      "predicate": "sometimes_seen_at_the_summit_during_storms",
      "direction": "source_to_target",
      "quality": {
        "score": 0.75,
        "confidence": 0.8,
        "reasons": ["Relationship text is descriptive and specific"]
      },
      "createdBy": "player-1",
      "createdAt": "2026-01-23T00:48:21.814Z"
    }
  ],
  "clusters": [],
  "scores": {
    "player-1": 16
  },
  "lastUpdatedBy": "player-1",
  "updatedAt": "2026-01-23T00:48:21.816Z"
}
```

---

## Frontend Usage Patterns

### 1. Preview Before Commit
```javascript
// User drags connection line, show preview
const preview = await fetch('/api/arena/relationships/validate', {
  method: 'POST',
  body: JSON.stringify({ ...payload, debug: true })
});
const { verdict, quality } = await preview.json();
// Show green/red indicator based on verdict
```

### 2. Commit Relationship
```javascript
const result = await fetch('/api/arena/relationships/propose', { ... });
const data = await result.json();

if (data.verdict === 'accepted') {
  // Animate edge creation
  // Update score display: data.points.playerTotal
  // Trigger evolution animations: data.evolution.affected
} else {
  // Show rejection reason: data.quality.reasons
  // Offer suggestions: data.suggestions
}
```

### 3. Load Arena Graph
```javascript
const state = await fetch('/api/arena/state?sessionId=...&playerId=...');
const { arena, edges, scores } = await state.json();
// Render cards from arena.entities
// Draw edges between cards
// Display leaderboard from scores
```

### 4. Handle Duplicate
```javascript
if (response.status === 409) {
  const { existingEdge } = await response.json();
  // Highlight the existing edge
  // Show "This connection already exists"
}
```

---

## Mock Mode

You can enable mock mode by setting any of the following to `true` in the request body:
- `debug`
- `mock`
- `mock_api_calls`
- `mocked_api_calls`

**Behavior in Mock Mode:**
- Deterministic responses (no LLM calls)
- Fast response for UI development
- Scoring logic:
  - If `surfaceText.length > 10`: Accepted (Score 0.75)
  - If `surfaceText.length <= 10`: Rejected (Score 0.35)

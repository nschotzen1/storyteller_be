# Seer Reading Spec

## Companion Docs

- `storyteller_be/docs/seer_reading_onboarding.md` for design principles, architecture boundaries, and developer/designer onboarding

## Purpose

`Seer Reading` reframes Memory Spread as a single-screen ritual:

- the seer perceives
- the player character remembers
- the player interprets
- the spread records what the reading made legible

This document defines the implementation baseline for the first observable milestones.

## Observable Objectives

- A reading can be created from an existing session fragment plus at least three memories.
- The create response returns exactly one focused memory and a visible triad.
- Memory reveal is deterministic and field-tiered.
- The spread persists as reading state and can be resumed.
- The reading can be explicitly closed and persisted.

## Milestone Scope

### M0

Contract freeze:

- reading state shape
- reveal tiers
- public route surface
- observable acceptance criteria

### M1

Backend skeleton:

- `POST /api/seer/readings`
- `GET /api/seer/readings/:readingId`
- `POST /api/seer/readings/:readingId/close`

No turn-loop orchestration yet. No seer-driven entity creation yet.

## Public API Surface

### POST `/api/seer/readings`

Creates or upserts a persisted seer reading skeleton.

Request:

```json
{
  "sessionId": "demo-session",
  "playerId": "memory-spread-player",
  "text": "Optional explicit fragment text override.",
  "batchId": "optional-memory-batch-id",
  "readingId": "optional-stable-id"
}
```

Behavior:

- resolves fragment text from `text` or the current stored typewriter session fragment
- finds the latest memory batch for the session/player unless `batchId` is supplied
- requires at least 3 memories
- selects a triad mapped to `before`, `during`, and `after`
- returns one focused memory

### GET `/api/seer/readings/:readingId`

Returns the persisted reading state for resume or reload.

### POST `/api/seer/readings/:readingId/close`

Marks the reading as closed and appends a closure transcript event.

Request:

```json
{
  "playerId": "memory-spread-player",
  "reason": "player_completed_reading"
}
```

## Reading State

```ts
type ReadingBeat =
  | 'invocation'
  | 'triad_revealed'
  | 'memory_in_focus'
  | 'seer_question_pending'
  | 'player_answer_received'
  | 'memory_deepening'
  | 'cross_memory_synthesis'
  | 'apparition_offer'
  | 'reading_closed';
```

```ts
interface SeerReading {
  readingId: string;
  sessionId: string;
  playerId?: string;
  status: 'active' | 'closed';
  beat: ReadingBeat;
  fragment: {
    text: string;
    anchorLabel: string;
  };
  seer: {
    personaId: string;
    voice: string;
  };
  memories: ReadingMemory[];
  entities: ReadingEntity[];
  apparitions: ReadingApparition[];
  spread: ReadingSpread;
  transcript: ReadingTurn[];
  unresolvedThreads: string[];
  worldbuildingOutputs: WorldbuildingOutput[];
  metadata: Record<string, unknown>;
  version: number;
}
```

## Reveal Tiers

Reveal tiers are fixed and deterministic.

- Tier 0: no structured reveal yet
- Tier 1: `short_title`, `whose_eyes`, `time_of_day`, `location`, `emotional_sentiment`
- Tier 2: `what_is_being_watched`, `entities_in_memory`, `temporal_relation`, `related_through_what`
- Tier 3: `action_name`, `dramatic_definition`, `actual_result`, `organizational_affiliation`
- Tier 4: `miseenscene`
- Tier 5: `consequences`, `relevant_rolls`, `estimated_action_length`, `action_level`

Initial reveal by `memory_strength`:

- `vivid` -> Tier 2
- `durable` -> Tier 1
- `faint` -> Tier 0

## Visual Semantics

The frontend should keep these dimensions separate:

- temporal slot: `before`, `during`, `after`
- relational pull: distance on the spread
- confidence: certainty of a relation or reading
- clarity: how much of a memory has been revealed

## Next-Step Contract For Turns

M2+ will add:

- `POST /api/seer/readings/:readingId/turn`
- one-question-one-consequence interaction loop
- seer-authored relation updates
- seer-driven entity generation via internal `textToEntity` orchestration

Planned response-shaping fields:

- `spokenMessage`
- `responseMode`
- `allowedResponses`
- `transitionType`
- `focusMemoryId`
- `focusEntityIds`
- `revealFields`
- `edgePatches`
- `newEntities`
- `clarityDelta`
- `confidenceDelta`

## Acceptance Criteria

M0 is done when:

- this spec is committed
- backend and frontend teams can point to one agreed contract

M1 is done when:

- create returns a persisted reading with 3 memories and 1 focused memory
- get returns the same persisted reading
- close flips the status to `closed` and the beat to `reading_closed`
- automated tests cover create, resume, and close

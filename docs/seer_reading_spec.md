# Seer Reading Spec

## Companion Docs

- `storyteller_be/docs/seer_reading_onboarding.md` for design principles, architecture boundaries, and developer/designer onboarding

## Purpose

`Seer Reading` reframes Memory Spread as a single-screen ritual:

- the seer perceives
- the player character remembers
- the player interprets
- the reading yields collectible cards and world evidence

This document defines the implementation baseline for the first observable milestones.

## Observable Objectives

- A reading can be created from an existing session fragment plus a single seeded memory vision.
- The create response returns one blurred vision plus a configurable number of interpretive cards.
- Card count is configurable for the reading and via Story Admin defaults.
- Card kinds are dynamic:
  - the caller may constrain them
  - the caller may bias them
  - the orchestrator/card-generator may choose them creatively
- Card backs reveal tone before facts.
- The player can progressively sharpen the vision and the cards through interpretation.
- The reading can unlock a short subject chat when the vision becomes sufficiently vivid.
- Cards can be claimed into the player result set for this reading.
- The reading can be explicitly closed and persisted.

## Milestone Scope

### M0

Contract freeze:

- reading state shape
- vision and card reveal tiers
- public route surface
- observable acceptance criteria

### M1

Backend skeleton:

- `POST /api/seer/readings`
- `POST /api/seer/readings/:readingId/turn`
- `POST /api/seer/readings/:readingId/cards/:cardId/claim`
- `GET /api/seer/readings/:readingId`
- `POST /api/seer/readings/:readingId/close`

Phase 1 keeps the runtime intentionally narrow:

- one active vision
- one active question
- a configurable opening card spread
- no multiplayer contention yet
- no full deck metagame yet

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
  "readingId": "optional-stable-id",
  "visionMemoryId": "optional-seeded-memory-id",
  "cardCount": 4,
  "cardKinds": ["character", "location", "event", "authority"],
  "preferredCardKinds": ["character", "location", "event", "omen"],
  "allowedCardKinds": ["character", "location", "event", "item", "authority", "omen"]
}
```

Behavior:

- resolves fragment text from `text` or the current stored typewriter session fragment
- resolves one seeded memory vision from `visionMemoryId` or the latest relevant memory
- derives a configurable spread of interpretive cards around that vision
- resolves card kinds from:
  - explicit `cardKinds` when provided
  - otherwise `preferredCardKinds`
  - otherwise `allowedCardKinds`
  - otherwise runtime heuristics and default card-kind pool
- cards begin on their back side with mood/genre/motif signals
- returns one focused card or vision prompt target

### GET `/api/seer/readings/:readingId`

Returns the persisted reading state for resume or reload.

### POST `/api/seer/readings/:readingId/turn`

Processes one interpretive move.

The orchestrator may:

- sharpen the vision
- sharpen one or more cards
- propose or strengthen a relation
- generate or refine a typed card through internal entity tooling
- offer or unlock subject chat
- surface a storyteller/apparition

### POST `/api/seer/readings/:readingId/cards/:cardId/claim`

Claims a sufficiently resolved card into the player’s reading result set.

Request:

```json
{
  "playerId": "memory-spread-player"
}
```

Behavior:

- validates the card is claimable
- marks it as claimed within the reading
- returns updated reading state
- later phases may also mirror this into a persistent player deck service

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
  | 'cards_revealed'
  | 'vision_attunement'
  | 'card_attunement'
  | 'seer_question_pending'
  | 'player_answer_received'
  | 'vision_deepening'
  | 'relation_testing'
  | 'subject_chat_unlocked'
  | 'card_claim_available'
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
  vision: ReadingVision;
  seer: {
    personaId: string;
    voice: string;
  };
  cards: ReadingCard[];
  entities: ReadingEntity[];
  apparitions: ReadingApparition[];
  spread: ReadingSpread;
  transcript: ReadingTurn[];
  subjectDialog: ReadingTurn[];
  claimedCards: ClaimedReadingCard[];
  unresolvedThreads: string[];
  worldbuildingOutputs: WorldbuildingOutput[];
  metadata: Record<string, unknown>;
  version: number;
}
```

```ts
interface ReadingVision {
  sourceMemoryId?: string;
  status: 'blurred' | 'sharpening' | 'vivid' | 'speaking';
  clarity: number;
  revealTier: 0 | 1 | 2 | 3 | 4;
  visibleFields: string[];
  sensoryFragments: string[];
  currentSubjectLabel?: string;
}
```

```ts
interface ReadingCard {
  id: string;
  kind: string;
  title: string;
  status: 'back_only' | 'sharpening' | 'front_revealed' | 'claimable' | 'claimed' | 'faded';
  focusState: 'active' | 'idle' | 'resolved';
  clarity: number;
  confidence: number;
  revealTier: 0 | 1 | 2 | 3;
  back: {
    imageUrl?: string;
    texturePrompt?: string;
    mood: string[];
    motifs: string[];
    genreSignal?: string;
  };
  front?: {
    imageUrl?: string;
    summary?: string;
    facts?: string[];
  };
  relatedEntityIds: string[];
  evidenceTurnIds: string[];
}
```

```ts
interface ClaimedReadingCard {
  cardId: string;
  kind: string;
  claimedAt: string;
  sourceReadingId: string;
  frontRevealed: boolean;
}
```

## Reveal Tiers

Phase 1 has two progressive reveal ladders.

### Vision Reveal Tiers

- Tier 0: blurred fragments only
- Tier 1: feeling, motion, isolated image, witness pressure
- Tier 2: partial context, apparent relation to one card
- Tier 3: coherent scene, stronger causal thread
- Tier 4: vivid enough for short subject chat

### Card Reveal Tiers

- Tier 0: back only, mood/texture/motif
- Tier 1: suggestive inference from the seer
- Tier 2: partial front reveal, provisional fact
- Tier 3: front revealed and claimable if relation threshold is met

Initial card state:

- all cards begin at Tier 0
- one or more cards sharpen depending on player interpretation quality
- cards may fade if the reading never substantiates them

## Visual Semantics

The frontend should keep these dimensions separate:

- card kind: dynamic label such as `character`, `location`, `event`, `item`, `faction`, `omen`, `authority`, `ritual`
- relational pull: distance or tension on the spread
- confidence: certainty of a relation or reading
- clarity: how much of the vision or card has been revealed
- claim state: whether a card is collectible, claimed, or fading

## Next-Step Contract For Turns

Phase 1 turn handling centers on:

- `POST /api/seer/readings/:readingId/turn`
- one-question-one-consequence interaction loop
- card-aware relation updates
- seer-driven card generation/refinement via internal entity tooling
- optional subject chat unlock

Planned response-shaping fields:

- `spokenMessage`
- `responseMode`
- `allowedResponses`
- `transitionType`
- `focusVision`
- `focusCardId`
- `focusEntityIds`
- `revealFields`
- `cardPatches`
- `edgePatches`
- `newCards`
- `newEntities`
- `clarityDelta`
- `confidenceDelta`

Recommended Phase 1 transition types:

- `vision_reveal`
- `card_reveal`
- `relation_strengthened`
- `relation_rejected`
- `new_card_created`
- `subject_chat_unlocked`
- `card_claim_available`
- `card_claimed`
- `apparition_offer`
- `dead_end`
- `closure`

## Orchestrator Tools

The runtime should be able to expose tools such as:

- `focus_vision`
- `focus_card`
- `reveal_vision_tier`
- `reveal_card_tier`
- `generate_cards`
- `create_entity`
- `propose_relation`
- `unlock_subject_chat`
- `claim_card`
- `invoke_storyteller`
- `close_reading`

## Acceptance Criteria

M0 is done when:

- this spec is committed
- backend and frontend teams can point to one agreed contract

M1 is done when:

- create returns a persisted reading with 1 vision and a configurable card spread
- get returns the same persisted reading
- turn can be reasoned about in terms of one question and one consequence
- claim-card is defined as a public contract even if implemented with placeholders first
- close flips the status to `closed` and the beat to `reading_closed`
- automated tests cover create, resume, and close

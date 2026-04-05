# Seer Entity Bank POC M0

## Purpose

This document freezes the smallest useful proof of concept for the Seer Reading + entity-bank direction.

It is intentionally reuse-first:

- reuse existing routes before adding new ones
- extend existing schemas before creating parallel models
- keep the seer ritual as the primary player-facing flow
- treat the entity bank as the durable asset layer behind that ritual

## Product Thesis

The POC is not "AI generates cards."

The POC is:

1. a seer-guided memory reading produces structured world evidence
2. that evidence becomes reusable narrative entities
3. those entities can be deepened, searched, and reused later
4. the same loop also produces a playable character-sheet seed

Character creation and worldbuilding are the same act.

## Non-Goals

M0 explicitly does not attempt:

- multiplayer contention or shared live turn-taking
- a full deck metagame
- a second top-level entity system parallel to `NarrativeEntity`
- a second character-sheet system parallel to `ImmersiveRpgCharacterSheet`
- graph-editor-first UX
- full vector-search implementation across universes
- audio or video generation workflows

## Reuse Rules

These are non-negotiable for the first implementation pass.

### 1. Keep `SeerReading` as ritual state

`SeerReading` already owns:

- reading beat
- transcript
- cards
- memories
- claimed cards
- spread state

It should stay session/ritual state, not become the durable entity bank.

### 2. Keep `NarrativeEntity` as the reusable bank record

Do not create a separate `EntityBankRecord` or similar model in M0.

`NarrativeEntity` already owns:

- entity identity
- classification
- reuse-oriented metadata such as `reusabilityLevel`
- storytelling point cost
- sub-entity lineage via `mainEntityId` and `isSubEntity`

M0 extends this model instead of replacing it.

### 3. Keep `World` as the universe seed in M0

The repo already has `World` and `WorldElement`.

For M0:

- `worldId` is the effective universe identifier
- `NarrativeEntity.universeId` may be added as an alias or mirror of `worldId`
- do not introduce a second top-level `Universe` collection yet

### 4. Keep the graph layer as evidence

Neo4j and arena relationships remain the relationship and cluster layer.

The graph is not the primary authoring surface.
The graph is the evidence left behind by the seer flow.

### 5. Keep the existing character-sheet pipeline

`ImmersiveRpgCharacterSheet` is the POC target for synthesized PC output.

Do not create a separate "character creation sheet" model in M0.

## Existing Reuse Map

| Concern | Existing code | M0 role | M0 action |
|---|---|---|---|
| Seer ritual state | `SeerReading`, `/api/seer/readings*` | Primary player flow | Reuse |
| Entity persistence | `NarrativeEntity` | Durable bank record | Extend |
| Entity generation | `textToEntityFromText`, `/api/textToEntity` | Create bank candidates | Reuse |
| Entity deepening | `/api/entities/:id/refresh` | Expand related sub-entities | Reuse |
| Storyteller investigation | `/api/sendStorytellerToEntity` | Spend points to deepen an entity | Reuse |
| World seed | `World`, `WorldElement`, `/api/worlds*` | Universe seed record | Reuse |
| Relationship graph | `neo4jService`, `/api/arena/relationships*` | Cluster evidence layer | Reuse |
| Character sheet | `ImmersiveRpgCharacterSheet`, `/api/immersive-rpg/character-sheet` | PC output sink | Reuse |
| Seer frontend | `SeerReadingPage.jsx` | Main ritual UI | Reuse |
| Character-sheet frontend | `ImmersiveRpgPage.jsx` | Editable sheet host | Reuse |

## POC Demo Loop

This is the smallest convincing demo.

1. Seed or select a `World`.
2. Start a `SeerReading` from an existing fragment and memory batch.
3. The player answers 2-4 seer prompts.
4. The reading either:
   - reuses an existing `NarrativeEntity`, or
   - creates a new `NarrativeEntity` candidate.
5. The player claims one resolved card.
6. Claiming the card persists or binds that card to a durable bank entity.
7. The player spends storytelling points through `/api/sendStorytellerToEntity`.
8. The mission returns deeper facts and sub-entities.
9. The reading projects a character-sheet seed into `ImmersiveRpgCharacterSheet`.

If this loop works end to end, the POC is valid.

## What Good Looks Like

A good M0 result is not "the demo has pretty generated art."

A good M0 result is that a skeptical observer can watch one short flow and understand all three of these claims:

1. the seer ritual is a compelling character-creation entrypoint
2. the output of that ritual becomes durable world assets instead of disposable text
3. those assets can immediately affect the emerging player character

## Success Definition

### Player-visible success

At the end of one short demo, the player should be able to say:

- I started from a fragment and a memory ritual, not a spreadsheet form
- I revealed and claimed at least one card that felt like a real part of the world
- that claimed card became a persistent entity, not just a temporary reading artifact
- I spent storytelling points to deepen that entity through a storyteller mission
- my character sheet now reflects something discovered during the reading

### Technical success

At the end of one short demo, we should be able to prove:

- the flow runs on existing route families, with extensions rather than parallel systems
- at least one claimed card is attached to a durable `NarrativeEntity`
- that entity is queryable through `GET /api/entities`
- that entity can be deepened through an existing deepen route
- the resulting discoveries can be written into `ImmersiveRpgCharacterSheet`
- the same flow works in mock mode for a stable demonstration

### Product success

At the end of one short demo, the product thesis should be legible:

- expensive generation creates reusable assets
- worldbuilding and character creation are the same loop
- the system gets more valuable as the entity bank grows
- reuse is visible enough that future cross-session or cross-universe expansion feels credible

## What We Should Expect From M0

We should expect:

- one convincing end-to-end demo loop, not a complete game
- one character-sheet seed, not a fully balanced RPG system
- one bank-search surface, not a finished discovery product
- lightweight canonicalization, not perfect entity matching
- cached or reused assets where possible, not polished media orchestration

We should not expect:

- multiplayer proof
- final economy tuning
- perfect art consistency
- final merge or dedupe quality
- vector search as a finished player-facing feature

## Core Data Boundaries

### Reading State

Belongs in `SeerReading`.

Examples:

- current beat
- current focus card
- current focus memory
- temporary reveal tiers
- claimed-card history within the reading
- transcript and turn traces

### Bank State

Belongs in `NarrativeEntity` plus graph/media metadata.

Examples:

- canonical or candidate entity identity
- reusable description and lore
- bank-level media references
- bank-level evidence records
- reuse counts and last-used metadata
- universe/world membership

### Character Output

Belongs in `ImmersiveRpgCharacterSheet`.

Examples:

- identity
- core traits
- attributes
- skills
- inventory
- notes

## Required M0 Schema Extensions

Extend `NarrativeEntity` with only the fields needed for the first demo.

Recommended additions:

- `worldId: String`
- `universeId: String`
- `canonicalStatus: 'suggested' | 'candidate' | 'canonical'`
- `bankSource: { readingId, memoryId, cardId, sourceType }`
- `mediaAssets: []`
- `evidence: []`
- `generationCosts: []`
- `reuseCount: Number`
- `lastUsedAt: Date`

Notes:

- `mediaAssets` should store prompts, urls, and asset kind such as `card_back` and `card_front`.
- `generationCosts` should store actual service cost metadata, not just player-facing points.
- Player-facing storytelling points stay a game rule, not a mirror of raw API cost.

## Required M0 Route Behavior

M0 should prefer changing behavior behind existing routes.

### Reuse without new route families

Keep using:

- `POST /api/seer/readings`
- `POST /api/seer/readings/:readingId/turn`
- `POST /api/seer/readings/:readingId/cards/:cardId/claim`
- `GET /api/entities`
- `POST /api/entities/:id/refresh`
- `POST /api/sendStorytellerToEntity`
- `GET/PUT /api/immersive-rpg/character-sheet`

### Behavior changes needed

#### 1. Card claim must bridge into the entity bank

`POST /api/seer/readings/:readingId/cards/:cardId/claim` already exists.

M0 should extend it so claim can:

- bind the card to an existing `NarrativeEntity`, or
- upsert a new `NarrativeEntity` candidate, and
- persist card media metadata into bank state

This is the main persistence bridge for the POC.

#### 2. Entity listing must become bank search

`GET /api/entities` already exists with filters.

M0 should extend it with:

- `worldId`
- `universeId`
- `name`
- `tag`
- `canonicalStatus`
- `linkedReadingId`

This should remain the main query surface for the first demo.

#### 3. Character-sheet projection should reuse the existing sheet route

M0 should add a backend helper that maps claimed cards and entity evidence into the existing `ImmersiveRpgCharacterSheet` shape.

This may be triggered by:

- seer close, or
- explicit synthesis action

But it should write into the existing sheet model and route family.

## Canonicalization Rules

M0 needs lightweight, deterministic rules before any heavy matching system.

When the reading surfaces or creates an entity:

1. try exact or near-exact reuse within the same `worldId`
2. fall back to entity type + normalized name
3. only create a new candidate if reuse is not credible

Do not solve full fuzzy merge or vector similarity in M0.

## Media Rules

M0 card media rules:

- card back mood/texture may remain reading-native until claimed
- claimed cards must persist their front/back media references into `NarrativeEntity.mediaAssets`
- if art already exists for a reused entity, surface it instead of regenerating it
- if art does not exist, generation should be lazy and cached

## Cost Rules

Store two different things:

### System cost

Actual generation metadata such as:

- provider
- model
- asset kind
- prompt key
- estimated cost
- created at

### Game cost

Player-facing storytelling points such as:

- claim cost
- deepen cost
- reveal discount
- reuse discount

These must not be the same field.

## Acceptance Criteria

M0 is complete when all of these are true:

1. A single reading can produce at least one durable bank entity.
2. Claiming a seer card can persist or bind an entity without creating a new model family.
3. `GET /api/entities` can retrieve that entity through bank-style filters.
4. `/api/sendStorytellerToEntity` can deepen that entity and return follow-up sub-entities.
5. A character-sheet seed can be written into `ImmersiveRpgCharacterSheet`.
6. The frontend can show the reading ritual and a resulting character sheet without adding a brand-new page family.
7. The demo can run in mock mode.

## Failure Conditions

M0 should be considered unsuccessful if any of these are true:

- the reading still produces only session-local artifacts with no durable bank output
- a claimed card cannot be traced to a persistent entity record
- the character sheet still has to be authored manually after the reading
- the implementation introduces a second parallel entity or sheet model
- the demo requires live external generation to work at all
- the value of reuse is not visible to an observer by the end of the flow

## Explicit Gaps To Fill

These are the real gaps after reuse.

### Gap 1

Claimed seer cards do not yet persist their resolved entity/media into the bank.

### Gap 2

`NarrativeEntity` does not yet have first-class bank metadata for universe/world membership, evidence, media, and cost history.

### Gap 3

`GET /api/entities` is still a list/filter route, not yet a bank-search route.

### Gap 4

There is no explicit synthesis helper from seer outputs into `ImmersiveRpgCharacterSheet`.

## Freeze Point For Subagents

Subagents should start after this document is accepted as the implementation boundary.

The first safe split is:

1. Backend schema and entity-bank query extension
2. Seer claim bridge and character-sheet synthesis
3. Frontend seer-to-sheet demo wiring

Do not split earlier than this, because schema names and route ownership would still be unstable.

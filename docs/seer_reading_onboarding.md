# Seer Reading Onboarding

## Why This Exists

This document is the working guide for developers and designers touching `Seer Reading`.

It extends the project-wide defaults in `ENGINEERING_AND_DESIGN_PRINCIPLES.md`.
If this document and the project charter ever disagree, tighten the implementation to the stricter rule.

It should answer four questions quickly:

- what the feature is trying to be
- which design principles are non-negotiable
- where the code lives
- how to change it without breaking the ritual

## Product Frame

`Seer Reading` is not a graph editor with mystical styling.

It is now the default experience behind the existing `memory-spread` app route.
The legacy spread remains available only through an explicit mode override.

Phase 1 is a single-screen ritual where:

- the seer perceives
- the player character remembers
- the player interprets
- one blurred vision is tested through a configurable spread of interpretive cards
- the spread records what the reading made legible

The graph is not the input surface.
The graph is the evidence left behind by interpretation.

## Design Principles

These are the principles to preserve in future tasks.

### 1. One Screen, Many Beats

The player experience stays on one screen.
Internal flow changes through reading beats, not route changes.

Why this scales:

- fewer navigation states
- easier persistence and resume
- simpler mental model for the player

### 2. The Seer Leads, The Client Renders

The frontend should not script the ritual beat-by-beat.

The backend decides:

- what the seer says
- what changed this turn
- which part of the vision is in focus
- which card is in focus
- which fields are now visible
- which tools were used

The frontend should primarily render returned state.

Why this scales:

- behavior lives in one place
- persona changes do not require frontend rewrites
- debugging is easier because the source of truth is server-authored

### 3. One Question, One Consequence

Each turn should have exactly one dominant outcome:

- reveal memory detail
- reveal a card
- form or strengthen a relation
- reject a relation
- create or surface an entity
- shift focus
- enter synthesis

Why this scales:

- the ritual stays sharp
- the chat stays concise
- QA can verify turn outcomes deterministically

### 4. One Primary Lens Hot At A Time

Phase 1 should keep one primary interpretive lens active at a time:

- the vision itself
- one card

The other cards should remain present, dimmed, and legible as context.

Why this scales:

- avoids cognitive overload
- makes the spread readable
- keeps the chat and card focus aligned

### 5. Reveal Tiers Are Fixed

Memory reveal is progressive but not arbitrary.

Do not let the seer randomly dump fields.
Field exposure should follow explicit tiers.

Why this scales:

- makes the experience feel authored
- reduces prompt drift
- makes regression testing possible

### 6. Keep Visual Dimensions Separate

These concepts should never collapse into one visual channel:

- temporal slot
- relational pull
- confidence
- clarity

Why this scales:

- keeps the spread understandable
- prevents visual ambiguity
- gives design room for refinement without breaking meaning

### 7. The Orchestrator Is An Agent Runtime, Not A God Object

The orchestrator should act like an agent with:

- persona definition
- allowed tools
- turn context
- tool-call trace
- structured turn result

Avoid inheritance-heavy base classes.
Prefer composition and registries.

Why this scales:

- new personas can share the same runtime
- tools can be added without rewriting the whole system
- logging and replay become straightforward

### 8. Prefer Cheap Deterministic Work Before Heavy Generation

If the runtime can satisfy a turn from existing state, do that first.

Examples:

- reuse an existing entity
- synthesize a local entity from vision or card labels
- advance a reveal tier without calling an LLM

Use heavier generation only when the reading truly needs new structure.

Why this scales:

- faster turns
- cheaper development
- easier tests
- fewer brittle dependencies

### 9. Observability Is A Feature

Every meaningful turn should be inspectable.

A developer should be able to see:

- current beat
- focus vision
- focus card
- transition type
- available tools
- tool calls
- resulting state patch

Why this scales:

- easier debugging
- easier onboarding
- easier trust in the orchestrator

### 10. Worldbuilding Output Must Be Structured

Emergent truths should not exist only as prose.

Store reusable structure for:

- relations
- generated entities
- unresolved threads
- world truths

Why this scales:

- future missions can reuse the data
- later readings can build on previous evidence
- design iteration does not throw away canon

## Architecture Map

### Backend

- Spec: `storyteller_be/docs/seer_reading_spec.md`
- Runtime: `storyteller_be/services/seerReadingRuntimeService.js`
- Card generation: `storyteller_be/services/seerReadingCardGenerationService.js`
- Route surface: `storyteller_be/server_new.js`
- Persistence: `storyteller_be/models/models.js`
- Story Admin prompt/settings plumbing:
  - `storyteller_be/services/typewriterAiSettingsService.js`
  - `storyteller_be/services/typewriterPromptDefinitionsService.js`
  - `storyteller_be/services/typewriterDefaultPromptSeedService.js`
  - `storyteller_be/services/llmRouteConfigService.js`

### Frontend

- Entry shell: `storyteller-vite-tailwind/src/pages/SeerReadingPage.jsx`
- Styles: `storyteller-vite-tailwind/src/pages/SeerReadingPage.css`
- Mode entry from Memory Spread: `storyteller-vite-tailwind/src/pages/MemorySpreadPage.jsx`

### Tests

- Backend API coverage: `storyteller_be/seer_readings.api.test.js`
- Backend card-generation unit coverage: `storyteller_be/seerReadingCardGenerationService.test.js`
- Frontend shell coverage: `storyteller-vite-tailwind/src/pages/SeerReadingPage.test.jsx`

## Current Runtime Shape

Today the runtime is agent-shaped but policy-driven.

That means:

- tools are explicit
- persona metadata exists
- tool calls are recorded
- the route delegates to the runtime
- turn policy is still deterministic
- cards are now the primary focus objects for turn prompts and reveal progression
- memories remain supporting vision evidence and entity context

This is intentional.
The next step is not a rewrite.
The next step is swapping deterministic planning for model-driven tool selection inside the same runtime contract.

## Safe Change Zones

### Safe For Designers

- seer copy and tone
- reveal wording
- persona framing
- debug labels
- visual styling of clarity, focus, confidence, and pull

### Safe For Backend Engineers

- add tools to the registry
- refine tool availability rules
- improve world truth persistence
- replace planner logic with prompt-driven tool selection

### Safe For Frontend Engineers

- improve spread rendering
- improve composer modes
- improve debug presentation
- add richer relation/confidence visuals

### Needs Cross-Discipline Review

- changing reveal tier contents
- changing the one-question-one-consequence rule
- moving logic from backend to frontend
- introducing new route/screen transitions
- collapsing clarity/confidence/pull into one visual signal

## Debug Workflow

### Normal Ritual View

Use:

- `?view=memory-spread&mode=seer`
- `?view=memory-spread`

The bare `memory-spread` route should be treated as canonical.

### Legacy Spread View

Use:

- `?view=memory-spread&mode=legacy`

### Developer Trace View

Use:

- `?view=memory-spread&mode=seer&memoryDebug=1`
- `?view=memory-spread&memoryDebug=1`

Expected trace information:

- runtime id
- persona id
- available tools
- last tool calls
- transition type

### Seeded Reading URLs

Use query params on the real route to shape the opening spread without introducing a separate fixture-only UI.

- `seerFixture=triad|authority|omens`
- `seerCardCount=<n>`
- `seerCardKinds=a,b,c`
- `seerPreferredCardKinds=a,b,c`
- `seerAllowedCardKinds=a,b,c`
- `seerBatchId=<batchId>`
- `seerVisionMemoryId=<memoryId>`

Example:

- `?view=memory-spread&memoryDebug=1&seerFixture=authority`
- `?view=memory-spread&seerCardCount=4&seerPreferredCardKinds=character,location,event,authority`

These only affect the create request. Once a reading exists, `readingId` remains the stable way to reload it.

### Hands-On Checkpoint

The first worthwhile manual playtest should include:

- reading creation
- at least one card reveal
- at least one relation or entity binding
- one `claimable -> claimed` card transition
- developer trace visibility

Do not block first playtesting on subject chat, dice, apparition depth, or multiplayer behavior.

## Test Workflow

### Backend

Run:

```bash
cd storyteller_be && npm test -- seer_readings.api.test.js
```

### Frontend

Run:

```bash
cd storyteller-vite-tailwind && npx vitest run src/pages/SeerReadingPage.test.jsx src/pages/TypewriterAdminPage.test.jsx src/pages/MemorySpreadPage.test.jsx
```

## Checklist For New Tasks

Before starting work, ask:

- is this a ritual behavior change, a UI change, or an orchestration/tooling change?
- should this logic live in the runtime or only in rendering?
- does this preserve one-question-one-consequence?
- does this keep one primary lens hot at a time?
- does this respect reveal tiers?
- does this improve or harm observability?
- can this be tested without a live model call?

If the answer weakens those principles, stop and redesign before coding.

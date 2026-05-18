# Typewriter Entity Key Validation

## Summary

Entity typewriter keys are now optimistic but provisional.

When the player presses an entity key, the frontend inserts the key text immediately so the typewriter keeps its physical feel. That inserted text starts an entity-key transaction. The transaction stays open while the player adds nearby text, then the backend validates whether the whole provisional phrase fits the current narrative context.

If the backend approves, the transaction disappears and the text becomes normal page text. If the backend rejects, the whole transaction span fades out and is removed from the page.

## User Flow

1. User types normal text.
2. User presses an entity key such as `THE XEROFAG` or a dynamically generated entity key.
3. Frontend inserts the entity text immediately and marks a provisional span.
4. Additional typed characters after the key extend the same provisional span until validation starts.
5. Validation starts after an idle pause, or quickly after sentence/phrase punctuation.
6. Backend checks the key/entity against the surrounding narrative context.
7. Approved text remains. Rejected text fades away and is removed.

## Transaction Scope

The transaction intentionally covers more than the bare entity name.

The frontend starts the span at the nearest previous sentence or phrase boundary, then extends it through the key text and any immediate user text typed after it. This makes rejection coherent: if the user writes a phrase around an entity and the entity does not fit, the whole provisional phrase is removed rather than leaving broken text behind.

Example:

```text
Before key:  The dust lifted
Key text:    The Xerofag
After text:  over the well.

Transaction sent for validation:
The dust lifted The Xerofag over the well.
```

If rejected, that whole span fades out.

## Frontend Implementation

Primary files:

- `storyteller-vite-tailwind/src/TypewriterFramework.jsx`
- `storyteller-vite-tailwind/src/components/typewriter/PaperDisplay.jsx`
- `storyteller-vite-tailwind/src/TypeWriter.css`
- `storyteller-vite-tailwind/src/apiService.js`

Key behavior:

- `TypewriterFramework.jsx` owns `entityKeyTransactions`.
- Each transaction tracks `id`, `keyId`, `keyText`, `entityId`, `pageIndex`, `start`, `end`, and `status`.
- Status values are `pending`, `validating`, and `rejected`.
- Pending transactions can grow as the user types.
- Validating and rejected transactions block conflicting input, page navigation, persistence, and ghostwriter continuation until resolved.
- `PaperDisplay.jsx` renders transaction spans with lightweight visual states.
- `TypeWriter.css` handles the provisional underline and rejected fade animation.

The feature is deliberately local to the typewriter component. It does not introduce a global editor model or shared transaction system.

## Backend Implementation

Primary files:

- `storyteller_be/routes/serverNew/typewriterRoutes.js`
- `storyteller_be/server_new.js`
- `storyteller_be/services/llmRouteConfigService.js`
- `storyteller_be/services/typewriterDefaultPromptSeedService.js`

Endpoint:

```http
POST /api/typewriter/keys/shouldAllow
```

The endpoint still supports the older bare-key append flow, but now also accepts transaction context:

```json
{
  "sessionId": "session-id",
  "keyId": "typewriter-key-id",
  "keyText": "THE XEROFAG",
  "currentNarrative": "current visible narrative",
  "candidateNarrative": "candidate visible narrative",
  "transactionId": "entity-key-...",
  "transactionText": "The dust lifted The Xerofag over the well.",
  "beforeContext": "short text before the transaction",
  "afterContext": "short text after the transaction"
}
```

Backend validation:

- Loads the `TypewriterKey`.
- Loads the linked `NarrativeEntity` from Mongo when `entityId` exists.
- Uses the existing `typewriter_key_verification` AI pipeline.
- Sends `transaction_text`, `before_context`, and `after_context` into the prompt.
- Returns `allowed`, `appendedText`, `transactionText`, `candidateNarrative`, key state, runtime metadata, and optional reason.

## Prompt Contract

The verification prompt now asks the model to judge the provisional phrase in place when transaction context exists. The entity metadata is supporting context only; it should not force approval.

Important prompt variables:

- `current_narrative`
- `candidate_narrative`
- `transaction_text`
- `before_context`
- `after_context`
- `transaction_id`
- `key_text`
- `insert_text`
- `entity_*`

The prompt resolver only trusts the latest stored `typewriter_key_verification` prompt if it includes the transaction variables. Otherwise it falls back to the current code template so older saved prompts do not silently ignore transaction context.

## Failure and Race Handling

- If validation rejects or errors, the transaction is marked `rejected`, faded, then removed.
- Session persistence pauses while a transaction is pending, validating, or rejected.
- Ghostwriter continuation pauses while a transaction is pending, validating, or rejected.
- Page navigation validates pending transactions first and otherwise waits for validation/fade completion.
- Backspace can shrink a pending transaction before validation starts.

## Tests

Focused coverage lives in:

- `storyteller-vite-tailwind/src/TypewriterFramework.integration.test.jsx`
- `storyteller_be/typewriter_dynamic_keys.api.test.js`

Expected checks:

```bash
cd storyteller-vite-tailwind
npx vitest run src/TypewriterFramework.integration.test.jsx
npm run build

cd ../storyteller_be
npm test -- typewriter_dynamic_keys.api.test.js --runInBand
```

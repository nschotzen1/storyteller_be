# Typewriter Component Summary

This file summarizes the typewriter component, supporting APIs, current mechanics, and desired behavior targets.

## 1) Frontend Component

Primary component:
- `storyteller-vite-tailwind/src/TypewriterFramework.jsx`

Render surface:
- `storyteller-vite-tailwind/src/components/typewriter/PaperDisplay.jsx`

Core frontend responsibilities:
- Capture user typing and page text state.
- Detect idle windows and request continuation eligibility from backend.
- Trigger ghostwriter sequence when backend allows it.
- Render writing + fade sequences.
- Preserve manual user takeover during ghostwriting.
- Render continuation insights panel ("Last Ghostwrite").
- Provide a compact debug overlay (toggleable) for visibility/tuning controls.

## 2) API Endpoints Used

1. `POST /api/typewriter/session/start`
- Starts/loads session.
- Optionally stores current fragment.

2. `POST /api/shouldGenerateContinuation`
- Decides if ghostwriter should take over now.
- Inputs:
  - `currentText`
  - `latestAddition`
  - `latestPauseSeconds`
  - `lastGhostwriterWordCount`
- Output:
  - `{ "shouldGenerate": boolean }`

3. `POST /api/send_typewriter_text`
- Generates continuation and sequence payload.
- Inputs:
  - `sessionId`
  - `message`
  - optional `fadeTimingScale` (debug/tuning override)
  - optional mock flags
- Output includes:
  - `writing_sequence`, `fade_sequence`, `sequence`
  - `metadata`
  - `timing`
  - `continuation_insights`
  - `sessionId`, `fragment`, `mocked`, `runtime`

4. `POST /api/next_film_image`
- Returns next page background image.

## 3) Current Mechanics

### Trigger mechanics
- Frontend polls on an interval.
- It computes `addition = fullText - lastGeneratedLength`.
- It asks `/api/shouldGenerateContinuation` only when:
  - not already processing a sequence,
  - no pending API request,
  - user has actually added text.

### Pause and writing-spree protection
- `/api/shouldGenerateContinuation` now uses:
  - word threshold tied to previous ghostwriter size (golden-ratio style),
  - hard minimum pause,
  - extra protection for likely writing sprees (bigger additions require longer pauses),
  - dynamic required pause using narrative length + addition size/density.

### Fade mechanics
- Fade timing scales with narrative word count.
- Fade steps auto-scale by narrative length (`2 / 3 / 4` tiers).
- Longer narratives fade slower/more gradually.

### Font mechanics
- Prompt payload now includes `preferred_font_size_px` to steer model style choices.
- Backend normalizes ghostwriter font size to avoid tiny outputs.
- Frontend applies a final minimum clamp for ghost text rendering safety.

## 4) Desired Behavior Targets

1. Ghost text should be visually comparable to user text size.
2. Ghostwriter should not interrupt short pauses during active user writing flow.
3. Continuation should begin only after a meaningful pause and enough user-added words.
4. Fade should feel cinematic and proportional to narrative length.
5. Post-fade retrigger should still require API approval.

## 5) Tuning Knobs

Backend knobs:
- `hardMinimumPauseSeconds`
- spree guard thresholds (`wordCount` + pause windows)
- dynamic pause factors (`basePause`, narrative/addition/density factors)
- fade timing profile and step thresholds
- `TYPEWRITER_PREFERRED_FONT_SIZE_PX`
- minimum font-size clamps

Frontend knobs:
- ghostwriter polling interval
- first fade handoff delay
- ghost font-size clamp floor
- debug panel visibility
- insights panel visibility
- timing chip visibility
- request-level `fadeTimingScale`

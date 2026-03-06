# Typewriter Flow Mechanics

This document describes how ghostwriting, fade timing, and continuation schema flow through backend and frontend.

## 1) Trigger and Gating Flow

1. User types on the current page.
2. Frontend tracks:
- `lastGeneratedLength`: how much text has already been acknowledged by ghostwriter.
- `lastGhostwriterWordCount`: previous ghostwriter continuation size.
- `lastUserInputTime`: latest user input timestamp.
3. Frontend computes `addition = fullText.slice(lastGeneratedLength)`.
4. Frontend calls `POST /api/shouldGenerateContinuation` only when:
- no active ghostwriter sequence,
- input buffer is empty,
- `addition` is non-empty,
- no in-flight API call.
5. Backend `shouldGenerateContinuation` decides using:
- minimum threshold based on previous ghostwriter size:
  `goldenThreshold = max(3, floor(lastGhostwriterWordCount / 1.61))`
- hard minimum pause gate.
- writing-spree guards for larger additions.
- dynamic pause requirement based on total length + addition words + addition density.
6. If `shouldGenerate=false`, no ghostwriter takeover.
7. If `shouldGenerate=true`, frontend starts ghostwriter takeover (`/api/send_typewriter_text`).

Result: after fade completion, ghostwriter does not retrigger until the user adds enough text for `/api/shouldGenerateContinuation` to allow it.

## 2) `/api/send_typewriter_text` Mechanics

### Prompt payload

`buildTypewriterPromptPayload(currentNarrative)` computes bounds once and passes a single canonical contract:

```json
{
  "current_narrative": "...",
  "min_words": 5,
  "max_words": 80,
  "word_count": 42,
  "preferred_font_size_px": 30
}
```

This payload is used in both:
- rendered prompt template variables (`{{current_narrative}}`, `{{min_words}}`, `{{max_words}}`, `{{word_count}}`, `{{preferred_font_size_px}}`), and
- user JSON payload sent to the model.

### Response shaping

Backend returns:
- `writing_sequence`
- `fade_sequence`
- `sequence`
- `metadata`
- `timing`
- `continuation_insights`
- session/runtime fields (`sessionId`, `fragment`, `mocked`, `runtime`)

Optional request override:
- `fadeTimingScale` (number) can be sent to `/api/send_typewriter_text` to slow down or speed up fade timings for debugging/tuning.

## 3) Fade Timing Model (Narrative-Length Aware)

Fade pacing is computed from the current narrative length (`message` word count from request):

- `narrative_word_count`
- dynamic `fade_steps`:
  - `<=6` words: 2 steps
  - `7-40` words: 3 steps
  - `>40` words: 4 steps
- delays scale with narrative length:
  - `first_pause_delay`
  - `phase_pause_delay`
  - `final_pause_delay`
  - `fade_interval_ms` (alias of `fade_phase_delay`, easier for UI consumption)
  - `fade_phase_delay`
  - plus `estimated_total_duration_ms`
  - `timing_scale`

Longer narratives fade more gradually and slower; shorter narratives complete fading faster.

## 4) Continuation Insights Schema

Backend normalizes live/mock model output into `continuation_insights`:

```json
{
  "meaning": ["..."],
  "contextual_strengthening": "...",
  "continuation_word_count": 7,
  "current_storytelling_points_pool": 35,
  "points_earned": 0,
  "Entities": [
    {
      "entity_name": "Monastery kitchen chimney",
      "ner_category": "STRUCTURE",
      "ascope_pmesii": "Infrastructure",
      "storytelling_points": 4,
      "reuse": false
    }
  ],
  "style": {
    "font": "'Cardo', serif",
    "font_size": "18px",
    "font_color": "#e6e0c9"
  }
}
```

Notes:
- Accepts either `Entities` or `entities` from model output.
- Normalizes numeric fields to finite numbers or `null`.
- Falls back to continuation-derived word count when missing.

## 5) UI Representation

Frontend displays `continuation_insights` in a dedicated "Last Ghostwrite" panel:
- words (`continuation_word_count`)
- points pool (`current_storytelling_points_pool`)
- delta (`points_earned`)
- entity count (`Entities.length`)
- optional timing chips (fade interval, estimated total fade, scales)
- `contextual_strengthening`
- first 3 `meaning` lines

This is implemented in:
- `storyteller-vite-tailwind/src/TypewriterFramework.jsx`
- `storyteller-vite-tailwind/src/TypeWriter.css`

## 6) Practical Contract Notes

- `timing` is now surfaced in both a toggleable debug panel and optional "Last Ghostwrite" timing chips.
- `continuation_insights` is safe for both live and mock responses.
- `word_count` is now explicit in the story continuation prompt payload contract.

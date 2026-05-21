# Storyteller Typewriter Backend

This branch is scoped to the typewriter/storyteller component backend.

## Entrypoint

```bash
npm install
node server_new.js
```

Default port: `5001`.

## Registered Routes

The server now registers only:

- Typewriter runtime routes in `routes/serverNew/typewriterRoutes.js`
- Typewriter admin routes in `routes/serverNew/typewriterAdminRoutes.js`

The active runtime surface includes:

- `POST /api/typewriter/session/start`
- `GET /api/typewriter/session/inspect`
- `POST /api/typewriter/session/vibe`
- `POST /api/typewriter/orrery/page-texture`
- `POST /api/next_film_image`
- `POST /api/shouldGenerateContinuation`
- `POST /api/send_typewriter_text`
- `POST /api/shouldAllowXerofag`
- `POST /api/typewriter/keys/shouldAllow`
- `GET|POST /api/typewriter/storyteller-policy`
- `POST /api/typewriter/storyteller-prompt/preview`
- `POST /api/shouldCreateStorytellerKey`
- `POST /api/send_storyteller_typewriter_text`

The active admin surface includes:

- `GET|PUT|POST /api/admin/typewriter/ai-settings`
- `GET /api/admin/openai/models`
- `GET|POST /api/admin/typewriter/prompts`
- `GET|POST /api/admin/llm-config`

## Notes

`server_new.js` still contains shared helper code from earlier components. This branch stops registering those routes and removes their route modules/tests; a later extraction pass can move the remaining typewriter helpers into smaller services.

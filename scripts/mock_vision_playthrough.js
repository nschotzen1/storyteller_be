import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(BACKEND_ROOT, 'outputs');

async function invokeRoute(app, method, routePath, { body = {}, query = {}, params = {}, headers = {} } = {}) {
  const resolvedPath = Object.entries(params).reduce((currentPath, [key, value]) => (
    currentPath.replace(`:${key}`, encodeURIComponent(String(value)))
  ), routePath);

  let testRequest = request(app)[method](resolvedPath);

  if (query && Object.keys(query).length > 0) {
    testRequest = testRequest.query(query);
  }

  for (const [headerName, headerValue] of Object.entries(headers)) {
    testRequest = testRequest.set(headerName, headerValue);
  }

  if (body && Object.keys(body).length > 0) {
    testRequest = testRequest.send(body);
  }

  const response = await testRequest;
  return {
    status: response.status,
    body: response.body
  };
}

function ensureString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function excerpt(value, max = 220) {
  const normalized = ensureString(value);
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function quoteBlock(value) {
  const normalized = ensureString(value);
  if (!normalized) return '> (empty)';
  return normalized
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toPromptPreview(template, max = 360) {
  return excerpt(ensureString(template).replace(/\s+/g, ' '), max);
}

function getPromptInfo(promptPayload, aiSettings, pipelineKey) {
  const promptDoc = promptPayload?.pipelines?.[pipelineKey] || null;
  const runtime = aiSettings?.pipelines?.[pipelineKey] || {};

  return {
    pipelineKey,
    provider: ensureString(runtime.provider, 'unknown'),
    model: ensureString(runtime.model, 'unknown'),
    useMock: Boolean(runtime.useMock),
    promptPreview: toPromptPreview(promptDoc?.promptTemplate || '')
  };
}

function buildBeatTableRows(promptPayload, aiSettings) {
  const rows = [
    {
      beat: 'Messenger intake',
      component: 'Messanger.jsx',
      api: 'GET/POST /api/messenger/chat',
      pipelineKey: 'messenger_chat'
    },
    {
      beat: 'Immersive intrusion scene',
      component: 'ImmersiveRpgPage.jsx',
      api: 'GET /api/immersive-rpg/scene; POST /api/immersive-rpg/chat; POST /api/immersive-rpg/rolls',
      pipelineKey: 'immersive_rpg_gm'
    },
    {
      beat: 'Ghostwriter typewriter',
      component: 'TypewriterFramework.jsx',
      api: 'POST /api/typewriter/session/start; POST /api/shouldGenerateContinuation; POST /api/send_typewriter_text',
      pipelineKey: 'story_continuation'
    },
    {
      beat: 'Storyteller key emergence',
      component: 'TypewriterFramework.jsx',
      api: 'POST /api/shouldCreateStorytellerKey; POST /api/send_storyteller_typewriter_text',
      pipelineKey: 'storyteller_intervention'
    },
    {
      beat: 'Tactical branch stand-in',
      component: 'RoseCourtProloguePage.jsx',
      api: 'GET /api/quest/screens; POST /api/quest/advance',
      pipelineKey: 'quest_generation'
    },
    {
      beat: 'Satchel / cards stand-in',
      component: 'MemorySpreadPage.jsx',
      api: 'POST /api/fragmentToMemories; POST /api/textToEntity',
      pipelineKey: 'memory_creation'
    }
  ];

  return rows.map((row) => ({
    ...row,
    runtime: getPromptInfo(promptPayload, aiSettings, row.pipelineKey)
  }));
}

function buildReportMarkdown({
  sessionId,
  outDir,
  componentRows,
  messengerInitial,
  messengerFirst,
  messengerFinal,
  immersiveScene,
  immersiveChat1,
  immersiveRoll,
  immersiveChat2,
  typewriterStart,
  shouldGenerate,
  typewriterSend,
  storytellerKeyCheck,
  storytellerIntervention,
  questScreens,
  questAdvance,
  memories,
  entities
}) {
  const questStartScreen = ensureString(questScreens?.startScreenId);
  const questGeneratedScreen = questAdvance?.createdScreen || questAdvance?.screen || {};
  const memoryTitles = safeArray(memories?.memories).slice(0, 3).map((memory) => ensureString(memory?.short_title)).filter(Boolean);
  const entityNames = safeArray(entities?.entities).slice(0, 5).map((entity) => ensureString(entity?.name)).filter(Boolean);
  const storytellerName = ensureString(storytellerIntervention?.storyteller?.name, 'Unnamed storyteller');
  const storytellerEntityKey = ensureString(storytellerIntervention?.entityKey?.keyText, 'Unknown key');

  return `# Mock Vision Playthrough

Session: \`${sessionId}\`

Raw payloads: [${outDir}](${outDir})

## Component Map

| Beat | Current component | API surface | Prompt pipeline | Runtime |
| --- | --- | --- | --- | --- |
${componentRows.map((row) => `| ${row.beat} | \`${row.component}\` | \`${row.api}\` | \`${row.runtime.pipelineKey}\` | ${row.runtime.provider}/${row.runtime.model}${row.runtime.useMock ? ' (default mock on)' : ''} |`).join('\n')}

## Playthrough

### 1. Messenger: "Where can the machine disappear?"

PC move:
- Opens the messenger thread and answers with a harbor attic room.
- Reveals a believable hiding place inside a cedar wardrobe with a false back.

APIs touched:
- \`GET /api/messenger/chat\`
- \`POST /api/messenger/chat\` twice

Current mock reply, turn 1:
${quoteBlock(messengerFirst?.reply)}

Current mock reply, final turn:
${quoteBlock(messengerFinal?.reply)}

Structured scene brief persisted for the next scene:
- Subject: ${ensureString(messengerFinal?.sceneBrief?.subject, 'n/a')}
- Place: ${ensureString(messengerFinal?.sceneBrief?.placeName, 'n/a')}
- Hiding spot: ${ensureString(messengerFinal?.sceneBrief?.typewriterHidingSpot, 'n/a')}
- Sensory anchors: ${safeArray(messengerFinal?.sceneBrief?.sensoryDetails).join(', ') || 'n/a'}

Why this fits your vision:
- This component already does the exact "cunning Society extracts the home layout" beat.
- It persists a scene brief that the immersive RPG scene can consume.

### 2. Immersive RPG: the stranger, the journal, the intrusion

PC move:
- Stays low and tries to retrieve the fallen journal unnoticed.
- Resolves the pending roll.
- Returns home and inspects the damaged space plus the hidden nook.

APIs touched:
- \`GET /api/immersive-rpg/scene\`
- \`POST /api/immersive-rpg/chat\`
- \`POST /api/immersive-rpg/rolls\`
- \`POST /api/immersive-rpg/chat\`

Bootstrapped opener:
${quoteBlock(safeArray(immersiveScene?.scene?.transcript)[0]?.text || '')}

After the journal attempt:
${quoteBlock(immersiveChat1?.reply)}

Roll resolution:
${quoteBlock(immersiveRoll?.resolution?.message)}

Home inspection follow-up:
${quoteBlock(immersiveChat2?.reply)}

Notebook / stage evidence:
- Current beat after first chat: \`${ensureString(immersiveChat1?.scene?.currentBeat)}\`
- Pending roll label: ${ensureString(immersiveChat1?.scene?.pendingRoll?.label, 'none')}
- Stage modules in opener: ${safeArray(immersiveScene?.scene?.stageModules).length}

Why this fits your vision:
- Scene 3 is already very close to your described home-return / stranger / journal / package sequence.
- The GM prompt explicitly encodes the hidden nook, the journal, the pen, and the blank cards.

### 3. Typewriter: ghost text, fade logic, and the first intrusion

PC move:
- Seeds the typewriter with: "${excerpt(typewriterStart?.fragment || '', 140)}"
- Pauses long enough for the ghostwriter gate to evaluate.
- Triggers a mock continuation.

APIs touched:
- \`POST /api/typewriter/session/start\`
- \`POST /api/shouldGenerateContinuation\`
- \`POST /api/send_typewriter_text\`

Ghostwriter gate:
- shouldGenerate: \`${String(shouldGenerate?.shouldGenerate)}\`

Mock continuation:
${quoteBlock(typewriterSend?.writing_sequence?.[0]?.text || '')}

Ghostwriter insights:
- Words added: ${typewriterSend?.continuation_insights?.continuation_word_count ?? 'n/a'}
- Meaning: ${(safeArray(typewriterSend?.continuation_insights?.meaning).join(' | ')) || 'n/a'}

Important current mechanic note:
- The UI does ask the backend before ghostwriting.
- The fade sequence and timing payload already exist.
- The dedicated \`THE XEROFAG\` key is present in the keyboard UI, but today it inserts text unconditionally rather than only when context permits it.

### 4. Storyteller key emergence: the "other observer" stand-in

PC move:
- Writes enough text to cross the storyteller threshold.
- A storyteller slot is checked and filled.
- The storyteller key is activated to inject a new observer voice.

APIs touched:
- \`POST /api/shouldCreateStorytellerKey\`
- \`POST /api/send_storyteller_typewriter_text\`

Storyteller slot check:
- Created: \`${String(storytellerKeyCheck?.created)}\`
- Narrative word count: ${storytellerKeyCheck?.narrativeWordCount ?? 'n/a'}
- Assigned storyteller count: ${storytellerKeyCheck?.assignedStorytellerCount ?? 'n/a'}

Intervention summary:
- Storyteller: ${storytellerName}
- New entity key: ${storytellerEntityKey}
- Continuation excerpt: "${excerpt(storytellerIntervention?.writing_sequence?.[0]?.text || storytellerIntervention?.continuation || '', 220)}"

Why this is the closest current stand-in for your "new character writes in another voice" beat:
- The observer does arrive as a separate narrative voice.
- The intervention also creates a new entity/key for later use.
- What is still missing is your exact "glyph key flips the page into first-person investigator mode" presentation.

### 5. Tactical quest stand-in: branch generation exists, but continuity does not

PC move:
- Uses the quest prompt box to improvise an escape branch.

APIs touched:
- \`GET /api/quest/screens\`
- \`POST /api/quest/advance\`

Quest state:
- Start screen id: \`${questStartScreen}\`
- Mock runtime: ${ensureString(questAdvance?.runtime?.provider, 'n/a')}/${ensureString(questAdvance?.runtime?.model, 'n/a')}
- Generated branch title: ${ensureString(questGeneratedScreen?.title, 'n/a')}
- Generated direction label: ${ensureString(questAdvance?.mockedData?.plan?.direction_label, 'n/a')}

What this means:
- The quest component can already turn freeform prompt input into a persistent branch.
- It is not yet seeded from the messenger brief / home scene / Xerofag chase, so it behaves like a generic authored adventure shell rather than your escape sequence.

### 6. Satchel / cards stand-in: memory spread is the nearest future-facing component

PC move:
- Feeds the same fragment into memory extraction and entity extraction.
- Receives card-ready memories and entity cards.

APIs touched:
- \`POST /api/fragmentToMemories\`
- \`POST /api/textToEntity\`

Memory outputs:
- Memory titles: ${memoryTitles.join(', ') || 'n/a'}
- Mocked: \`${String(memories?.mocked)}\`

Entity outputs:
- Entity names: ${entityNames.join(', ') || 'n/a'}
- Mocked: \`${String(entities?.mocked)}\`

Why this matters for your later observatory / seer vision:
- The repo already has a memory spread page, entity-card generation, and a seer-card prototype.
- These are not yet narratively tied to the satchel of blank cards or the observatory rescue scene, but the component family already exists.

## What Already Matches Well

- Messenger -> immersive RPG handoff is real. The messenger scene brief is the bridge.
- The immersive home-intrusion scene is already unusually close to your intended second scene.
- The typewriter already has ghostwriting, fade pacing, storyteller emergence, and an observer-like intervention mechanic.
- The memory/card stack already exists as a later-phase content surface.

## Where The Current Game Breaks Against Your Vision

- There is no top-level phase orchestrator. Components exist side by side in nav, not as one guided story flow.
- The immersive scene and the typewriter scene are not automatically chained by game state.
- The \`THE XEROFAG\` key is not context-gated yet.
- The "glyph key switches to first-person investigator witness mode" is approximated by storyteller interventions, not implemented as its own UX/state.
- The quest component is mechanically ready, but its authored world is still a separate fantasy shell instead of the PC's home-and-harbor escape.
- The travel box, 4-digit code inference, journey journal, Defiler chase, rescue by the seer, and observatory card draw are not yet represented as connected game states.

## Task Candidates

1. Build a story-phase orchestrator that moves a shared session through \`messenger -> immersive-rpg -> typewriter -> quest -> travel-journal -> seer\`.
2. Add persistent "package state" to the immersive RPG output so scene 3 can unlock the typewriter, travel box, satchel, and journal as actual inventory objects.
3. Make \`THE XEROFAG\` key context-aware: rejected in the wrong context, accepted only when the narrative supports it, with dedicated feedback.
4. Add a true "observer glyph" mechanic on top of the storyteller intervention system so a second voice can annotate the page in a visibly distinct mode.
5. Seed quest generation from the messenger scene brief and immersive scene flags so the tactical escape is rooted in the PC's actual house and surrounding area.
6. Turn the 4-digit code into a first-class mechanic: surfaced through storyteller intervention text, inferred by the player, and validated against a travel-box component.
7. Re-skin memory spread / seer work so blank satchel cards become the same objects later used in the observatory draw.
`;
}

async function writeFile(filePath, value) {
  await fs.writeFile(filePath, value, 'utf8');
}

async function main() {
  process.env.NODE_ENV = 'test';

  const sessionId = `vision-flow-${Date.now()}`;
  const outDir = path.join(OUTPUT_ROOT, sessionId);
  await fs.mkdir(outDir, { recursive: true });
  let mongoServer = null;
  const hadExplicitMongoUri = Boolean(process.env.MONGODB_URI);
  const preferredMongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/storytelling';

  process.env.MONGODB_URI = preferredMongoUri;
  const [{ app }] = await Promise.all([import('../server_new.js')]);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  try {
    await mongoose.connect(preferredMongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
  } catch (error) {
    if (hadExplicitMongoUri) {
      throw error;
    }
    mongoServer = await MongoMemoryServer.create({
      instance: {
        ip: '127.0.0.1',
        port: 0
      }
    });
    process.env.MONGODB_URI = mongoServer.getUri();
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
  }

  const aiSettings = (await invokeRoute(app, 'get', '/api/admin/typewriter/ai-settings')).body;
  const promptPayload = (await invokeRoute(app, 'get', '/api/admin/typewriter/prompts')).body;

  const messengerInitial = (await invokeRoute(app, 'get', '/api/messenger/chat', {
    query: { sessionId }
  })).body;

  const messengerFirst = (await invokeRoute(app, 'post', '/api/messenger/chat', {
    body: {
      sessionId,
      sceneId: 'messanger',
      message: 'An attic room above the harbor with a rain-marked window, a narrow oak table, cold bells from the quay, and salt coming in through the sash.',
      mock: true
    }
  })).body;

  const messengerFinal = (await invokeRoute(app, 'post', '/api/messenger/chat', {
    body: {
      sessionId,
      sceneId: 'messanger',
      message: 'If it had to vanish, I would hide it inside the cedar wardrobe with the false back, high and dry behind old coats where nobody looks twice.',
      mock: true
    }
  })).body;

  const immersiveScene = (await invokeRoute(app, 'get', '/api/immersive-rpg/scene', {
    query: {
      sessionId,
      playerName: 'PC'
    }
  })).body;

  const immersiveChat1 = (await invokeRoute(app, 'post', '/api/immersive-rpg/chat', {
    body: {
      sessionId,
      playerName: 'PC',
      message: 'I stay low, creep toward the fallen journal, and try to snatch it without being seen.',
      mock: true
    }
  })).body;

  const immersiveRoll = (await invokeRoute(app, 'post', '/api/immersive-rpg/rolls', {
    body: {
      sessionId,
      playerName: 'PC'
    }
  })).body;

  const immersiveChat2 = (await invokeRoute(app, 'post', '/api/immersive-rpg/chat', {
    body: {
      sessionId,
      playerName: 'PC',
      message: 'I go home, inspect the rooms, and check the hidden nook by the back steps.',
      mock: true
    }
  })).body;

  const typewriterSeed = 'It was almost night as I set the typewriter on the scarred oak table, the page already fed, harbor bells below the attic window speaking to something just outside the room.';
  const typewriterStart = (await invokeRoute(app, 'post', '/api/typewriter/session/start', {
    body: {
      sessionId,
      fragment: typewriterSeed
    }
  })).body;

  const shouldGenerate = (await invokeRoute(app, 'post', '/api/shouldGenerateContinuation', {
    body: {
      currentText: typewriterSeed,
      latestAddition: 'harbor bells below the attic window speaking to something just outside the room',
      latestPauseSeconds: 10,
      lastGhostwriterWordCount: 0
    }
  })).body;

  const typewriterSend = (await invokeRoute(app, 'post', '/api/send_typewriter_text', {
    body: {
      sessionId,
      message: typewriterSeed,
      mock: true
    }
  })).body;

  const storytellerKeyCheck = (await invokeRoute(app, 'post', '/api/shouldCreateStorytellerKey', {
    body: {
      sessionId,
      mock: true
    }
  })).body;

  const storytellerIntervention = (await invokeRoute(app, 'post', '/api/send_storyteller_typewriter_text', {
    body: {
      sessionId,
      slotIndex: 0,
      mock: true
    }
  })).body;

  const questScreens = (await invokeRoute(app, 'get', '/api/quest/screens', {
    query: {
      sessionId,
      questId: 'vision_escape'
    }
  })).body;

  const questAdvance = (await invokeRoute(app, 'post', '/api/quest/advance', {
    body: {
      sessionId,
      questId: 'vision_escape',
      playerId: 'pc',
      currentScreenId: questScreens.startScreenId,
      actionType: 'prompt',
      promptText: 'Vault through the back steps, slip past the pantry nook, and lose the Xerofag among the harbor sheds.',
      mock: true
    }
  })).body;

  const memories = (await invokeRoute(app, 'post', '/api/fragmentToMemories', {
    body: {
      sessionId,
      text: typewriterSeed,
      includeCards: true,
      includeFront: false,
      includeBack: true,
      mock: true
    }
  })).body;

  const entities = (await invokeRoute(app, 'post', '/api/textToEntity', {
    body: {
      sessionId,
      text: typewriterSeed,
      includeCards: true,
      includeFront: true,
      includeBack: true,
      mock: true
    }
  })).body;

  const componentRows = buildBeatTableRows(promptPayload, aiSettings);

  const rawPayloads = {
    sessionId,
    promptInfo: componentRows,
    messengerInitial,
    messengerFirst,
    messengerFinal,
    immersiveScene,
    immersiveChat1,
    immersiveRoll,
    immersiveChat2,
    typewriterStart,
    shouldGenerate,
    typewriterSend,
    storytellerKeyCheck,
    storytellerIntervention,
    questScreens,
    questAdvance,
    memories,
    entities
  };

  const markdown = buildReportMarkdown({
    sessionId,
    outDir,
    componentRows,
    messengerInitial,
    messengerFirst,
    messengerFinal,
    immersiveScene,
    immersiveChat1,
    immersiveRoll,
    immersiveChat2,
    typewriterStart,
    shouldGenerate,
    typewriterSend,
    storytellerKeyCheck,
    storytellerIntervention,
    questScreens,
    questAdvance,
    memories,
    entities
  });

  await writeFile(path.join(outDir, 'raw_payloads.json'), `${JSON.stringify(rawPayloads, null, 2)}\n`);
  await writeFile(path.join(outDir, 'vision_mock_playthrough.md'), markdown);

  console.log(JSON.stringify({
    sessionId,
    outDir,
    reportPath: path.join(outDir, 'vision_mock_playthrough.md'),
    rawPayloadPath: path.join(outDir, 'raw_payloads.json')
  }, null, 2));

  if (mongoServer) {
    await mongoServer.stop();
  }
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
    try {
      await mongoose.disconnect();
    } catch {}
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });

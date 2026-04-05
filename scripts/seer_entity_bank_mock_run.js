import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { renderPromptTemplateString } from '../services/typewriterPromptConfigService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(BACKEND_ROOT, 'outputs');

async function invokeRoute(app, method, routePath, { body = {}, query = {}, params = {} } = {}) {
  const resolvedPath = Object.entries(params).reduce((currentPath, [key, value]) => (
    currentPath.replace(`:${key}`, encodeURIComponent(String(value)))
  ), routePath);

  let testRequest = request(app)[method](resolvedPath);
  if (query && Object.keys(query).length > 0) {
    testRequest = testRequest.query(query);
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

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function excerpt(value, max = 1200) {
  const normalized = ensureString(value);
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function asJson(value) {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function mapCardGenerationPayload(reading = {}) {
  return {
    vision_summary: ensureString(reading?.vision?.summary, 'No vision summary returned.'),
    cards: safeArray(reading?.cards).map((card) => ({
      kind: ensureString(card?.kind),
      label: ensureString(card?.title),
      summary: ensureString(card?.front?.summary),
      back_moods: safeArray(card?.back?.mood),
      back_motifs: safeArray(card?.back?.motifs),
      likely_relation_hint: ensureString(card?.likelyRelationHint, card?.front?.summary)
    }))
  };
}

function mapEntityCreationPayload(entity = {}, overrides = {}) {
  return {
    entities: [
      {
        familiarity_level: 3,
        reusability_level: 'reading anchor',
        ner_type: ensureString(entity?.type || entity?.ner_type, 'LOCATION'),
        ner_subtype: ensureString(entity?.subtype || entity?.ner_subtype, 'Watchpoint'),
        description: ensureString(entity?.description, 'No description returned.'),
        name: ensureString(entity?.name, 'Unnamed entity'),
        relevance: ensureString(entity?.relevance, 'No relevance returned.'),
        impact: ensureString(overrides.impact, 'Can anchor future readings, missions, and character-sheet updates.'),
        skills_and_rolls: safeArray(overrides.skills_and_rolls).length
          ? safeArray(overrides.skills_and_rolls)
          : ['Awareness', 'Lore', 'Instinct'],
        development_cost: ensureString(overrides.development_cost, '5, 10, 15, 20'),
        storytelling_points_cost: ensureString(overrides.storytelling_points_cost, '12'),
        urgency: ensureString(overrides.urgency, 'Near Future'),
        connections: safeArray(entity?.connections),
        tile_distance: Number.isFinite(Number(overrides.tile_distance)) ? Number(overrides.tile_distance) : 1,
        evolution_state: ensureString(overrides.evolution_state, 'New'),
        evolution_notes: ensureString(overrides.evolution_notes, 'Generated during mock-mode seer demo.')
      }
    ]
  };
}

function mapSubEntityCreationPayload(subEntities = []) {
  return {
    entities: safeArray(subEntities).map((entity, index) => ({
      familiarity_level: 2,
      reusability_level: 'mission follow-up',
      ner_type: ensureString(entity?.type || entity?.ner_type, index === 2 ? 'SKILL' : index === 1 ? 'PERSON' : 'ITEM'),
      ner_subtype: ensureString(entity?.subtype || entity?.ner_subtype, index === 2 ? 'Weather Reading' : index === 1 ? 'Keeper' : 'Field Notes'),
      description: ensureString(entity?.description, 'No description returned.'),
      name: ensureString(entity?.name, `Sub-entity ${index + 1}`),
      relevance: ensureString(entity?.relevance, 'Created by storyteller mission follow-up.'),
      impact: 'Adds reusable downstream hooks to the parent entity.',
      skills_and_rolls: index === 2 ? ['Lore', 'Instinct'] : ['Awareness', 'Inquiry'],
      development_cost: '4, 8, 12, 16',
      storytelling_points_cost: String(6 + index * 2),
      urgency: index === 2 ? 'Near Future' : 'Delayed',
      connections: safeArray(entity?.connections),
      tile_distance: 1,
      evolution_state: 'New',
      evolution_notes: 'Generated during storyteller mission in mock mode.'
    }))
  };
}

function buildMissionMockResponse(storyteller = {}, entity = {}) {
  return {
    outcome: 'success',
    userText: `The mission concludes. ${storyteller.name} returns with a focused insight about ${entity.name}.`,
    gmNote: `Lean into the sensory details of ${entity.name}; highlight a single, striking detail that hints at hidden layers.`,
    subEntitySeed: `New sub-entities emerge around ${entity.name}: a revealing clue, a minor witness, and a tangible relic tied to the mission.`
  };
}

function buildRouteLog({
  storytellerList,
  readingResponse,
  turnResponses,
  claimResponse,
  bankResponse,
  missionResponse,
  sheetResponse
}) {
  const focusCard = safeArray(readingResponse?.body?.cards)[0] || {};
  const claimedLink = safeArray(claimResponse?.body?.claimedEntityLinks)[0] || {};
  const claimStep = 3 + turnResponses.length;
  const bankStep = claimStep + 1;
  const missionStep = bankStep + 1;
  const sheetStep = missionStep + 1;
  return [
    {
      step: 1,
      route: 'GET /api/storytellers',
      result: {
        status: storytellerList?.status,
        visibleStorytellers: safeArray(storytellerList?.body?.storytellers).map((storyteller) => storyteller.name)
      }
    },
    {
      step: 2,
      route: 'POST /api/seer/readings',
      result: {
        status: readingResponse?.status,
        readingId: readingResponse?.body?.readingId,
        focusCard: ensureString(focusCard?.title),
        cardKinds: safeArray(readingResponse?.body?.cards).map((card) => card.kind)
      }
    },
    ...turnResponses.map((turnResponse, index) => ({
      step: 3 + index,
      route: `POST /api/seer/readings/${readingResponse?.body?.readingId}/turn`,
      result: {
        status: turnResponse?.status,
        transitionType: turnResponse?.body?.lastTurn?.transitionType,
        spokenMessage: turnResponse?.body?.lastTurn?.spokenMessage,
        createdEntityPromptText: turnResponse?.body?.lastTurn?.createdEntityPromptText || ''
      }
    })),
    {
      step: claimStep,
      route: `POST /api/seer/readings/${readingResponse?.body?.readingId}/cards/${focusCard?.id}/claim`,
      result: {
        status: claimResponse?.status,
        claimedCard: claimResponse?.body?.claimedCards?.[0]?.title,
        canonicalEntity: claimedLink.entityExternalId || claimedLink.entityId
      }
    },
    {
      step: bankStep,
      route: 'GET /api/entities?linkedReadingId=...',
      result: {
        status: bankResponse?.status,
        entityNames: safeArray(bankResponse?.body?.entities).map((entity) => entity.name)
      }
    },
    {
      step: missionStep,
      route: 'POST /api/sendStorytellerToEntity',
      result: {
        status: missionResponse?.status,
        outcome: missionResponse?.body?.outcome,
        subEntities: safeArray(missionResponse?.body?.subEntities).map((entity) => entity.name)
      }
    },
    {
      step: sheetStep,
      route: 'GET /api/immersive-rpg/character-sheet',
      result: {
        status: sheetResponse?.status,
        drive: sheetResponse?.body?.characterSheet?.coreTraits?.drive || '',
        burden: sheetResponse?.body?.characterSheet?.coreTraits?.burden || '',
        notes: safeArray(sheetResponse?.body?.characterSheet?.notes).slice(0, 4)
      }
    }
  ];
}

function buildReportMarkdown({
  sessionId,
  playerId,
  fragmentText,
  readingResponse,
  turnResponses,
  claimResponse,
  bankResponse,
  missionResponse,
  sheetResponse,
  mockedMemoryPayload,
  fragmentConfig,
  seerCardConfig,
  storytellerMissionConfig,
  entityPromptTemplate,
  storyteller,
  routeLog
}) {
  const createdEntityTurn = turnResponses.find((entry) => ensureString(entry?.body?.lastTurn?.createdEntityPromptText));
  const createdEntity = safeArray(createdEntityTurn?.body?.entities)[0] || safeArray(claimResponse?.body?.entities)[0] || {};
  const claimedEntity = safeArray(bankResponse?.body?.entities)[0] || {};
  const missionEntity = missionResponse?.body?.entity || claimedEntity;
  const missionMockResponse = buildMissionMockResponse(storyteller, missionEntity);
  const readingCardPayload = mapCardGenerationPayload(readingResponse?.body);
  const entityCreationPayload = mapEntityCreationPayload(createdEntity, {
    storytelling_points_cost: String(createdEntity?.storytellingPointsCost || 12)
  });
  const subEntityPayload = mapSubEntityCreationPayload(missionResponse?.body?.subEntities);
  const missionPrompt = renderPromptTemplateString(storytellerMissionConfig?.body?.promptTemplate || '', {
    storytellerName: storyteller?.name || '',
    entityName: missionEntity?.name || '',
    entityType: missionEntity?.type || missionEntity?.ner_type || 'ENTITY',
    entitySubtype: missionEntity?.subtype || missionEntity?.ner_subtype || 'General',
    entityDescription: missionEntity?.description || '',
    entityLore: missionEntity?.lore || '',
    storytellingPoints: 14,
    message: 'Learn what this place taught me before I knew it was shaping me.',
    durationDays: '3 days'
  });

  return `# Seer Entity Bank Mock Run

Session: \`${sessionId}\`
Player: \`${playerId}\`

## Invented Input

${fragmentText}

## Mocked Memory Extraction Seed

This run seeds the seer reading from a handcrafted mock \`fragment_to_memories\` response so the route simulation stays coherent with the monastery premise.

## Route Log

${routeLog.map((entry) => `### ${entry.step}. \`${entry.route}\`\n${asJson(entry.result)}`).join('\n\n')}

## Important LLM Calls

### A. \`fragment_to_memories\`

Prompt source:
- [llmRouteConfigService.js](${path.join(BACKEND_ROOT, 'services/llmRouteConfigService.js')})

Prompt preview:

\`\`\`text
${excerpt(fragmentConfig?.body?.promptTemplate || '', 1800)}
\`\`\`

Response schema:
${asJson(fragmentConfig?.body?.responseSchema || {})}

Mocked response example:
${asJson(mockedMemoryPayload)}

### B. \`seer_reading_card_generation\`

Rendered prompt used by \`POST /api/seer/readings\`:

\`\`\`text
${excerpt(readingResponse?.body?.metadata?.cardConfig?.promptText || '', 1800)}
\`\`\`

Response schema:
${asJson(seerCardConfig?.body?.responseSchema || {})}

Mocked response example:
${asJson(readingCardPayload)}

### C. \`entity_creation\` from the seer turn

Entity-creation template preview:

\`\`\`text
${excerpt(entityPromptTemplate || '', 1800)}
\`\`\`

Seer-derived input fed into that template:

\`\`\`text
${excerpt(createdEntityTurn?.body?.lastTurn?.createdEntityPromptText || '', 1800)}
\`\`\`

Mocked response example:
${asJson(entityCreationPayload)}

### D. \`storyteller_mission\`

Rendered prompt:

\`\`\`text
${excerpt(missionPrompt, 1800)}
\`\`\`

Response schema:
${asJson(storytellerMissionConfig?.body?.responseSchema || {})}

Mocked response example:
${asJson(missionMockResponse)}

### E. \`entity_creation\` for mission follow-up sub-entities

Sub-entity seed:

\`\`\`text
${missionMockResponse.subEntitySeed}
\`\`\`

Mocked response example:
${asJson(subEntityPayload)}

## Current Verdict

- The loop now demonstrates the intended product shape: fragment -> memories -> seer reading -> claim -> entity bank -> mission -> character sheet.
- Mock mode is coherent enough to demo end-to-end, and the reading keeps the mock flag across later turns.
- The current mocked outputs are satisfactory for route flow and UI proof, but not yet for final tone: they are deterministic and structurally correct, but still more functional than atmospheric.
- The strongest proof in this run is that claiming a card produced a persistent entity, the entity was queryable, and a later mission produced reusable follow-up entities plus sheet updates.

## Files To Inspect

- [server_new.js](${path.join(BACKEND_ROOT, 'server_new.js')})
- [seerReadingRuntimeService.js](${path.join(BACKEND_ROOT, 'services/seerReadingRuntimeService.js')})
- [textToEntityService.js](${path.join(BACKEND_ROOT, 'services/textToEntityService.js')})
- [SeerReadingPage.jsx](${path.join(BACKEND_ROOT, '..', 'storyteller-vite-tailwind', 'src/pages/SeerReadingPage.jsx')})
`;
}

async function writeFile(filePath, value) {
  await fs.writeFile(filePath, value, 'utf8');
}

async function main() {
  process.env.NODE_ENV = 'test';

  const sessionId = `seer-entity-bank-run-${Date.now()}`;
  const playerId = 'seer-demo-player';
  const fragmentText = 'Rain worried the shutters of the cliffside monastery while the boy watched two monks cross the flooded courtyard without seeming to touch the stone.';
  const outDir = path.join(OUTPUT_ROOT, sessionId);
  await fs.mkdir(outDir, { recursive: true });

  let mongoServer = null;
  const hadExplicitMongoUri = Boolean(process.env.MONGODB_URI);
  const preferredMongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/storytelling';
  process.env.MONGODB_URI = preferredMongoUri;

  const [{ app }, { Storyteller, SeerReading }, { FragmentMemory }] = await Promise.all([
    import('../server_new.js'),
    import('../models/models.js'),
    import('../models/memory_models.js')
  ]);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  try {
    await mongoose.connect(preferredMongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    });
  } catch (error) {
    if (hadExplicitMongoUri) throw error;
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

  const promptPayload = (await invokeRoute(app, 'get', '/api/admin/typewriter/prompts')).body;
  const fragmentConfig = await invokeRoute(app, 'get', '/api/admin/llm-config/fragment_to_memories');
  const seerCardConfig = await invokeRoute(app, 'get', '/api/admin/llm-config/seer_reading_card_generation');
  const storytellerMissionConfig = await invokeRoute(app, 'get', '/api/admin/llm-config/storyteller_mission');
  const entityPromptTemplate = promptPayload?.pipelines?.entity_creation?.promptTemplate || '';

  const storyteller = await Storyteller.create({
    session_id: sessionId,
    sessionId,
    playerId,
    name: 'Velis of the Reed Ledger',
    immediate_ghost_appearance: 'A narrow archivist with rain-dark sleeves and a ribbon of brass keys.',
    influences: ['monastic archives', 'storm divination'],
    known_universes: ['cliffside monastery'],
    voice_creation: {
      voice: 'measured, patient',
      age: 'middle-aged',
      style: 'ritual investigator'
    },
    keySlotIndex: 0,
    status: 'active'
  });

  const storytellerList = await invokeRoute(app, 'get', '/api/storytellers', {
    query: { sessionId, playerId }
  });

  const batchId = `seer-batch-${Date.now()}`;
  const seededMemories = await FragmentMemory.insertMany([
    {
      sessionId,
      playerId,
      batchId,
      fragmentText,
      memory_strength: 'vivid',
      emotional_sentiment: 'awed, cold, attentive',
      action_name: 'Watch the courtyard lesson',
      estimated_action_length: 'less than a minute',
      time_within_action: 'while the rain comes hard',
      actual_result: 'The child understands that discipline can look like weather-reading.',
      related_through_what: 'storm-reading',
      geographical_relevance: 'cliffside monastery above a flooded ravine',
      temporal_relation: 'the first memory in the chain',
      organizational_affiliation: 'Monastery of Saint Vey',
      consequences: 'The place becomes a root image for later caution and ritual.',
      distance_from_fragment_location_km: 0,
      shot_type: 'medium wide',
      time_of_day: 'dawn under heavy rain',
      whose_eyes: 'the child at the window',
      'interior/exterior': 'interior looking out',
      what_is_being_watched: 'two monks crossing a flooded courtyard without breaking form',
      location: 'Flood Court of Saint Vey',
      estimated_duration_of_memory: 2,
      memory_distance: 'distant past',
      entities_in_memory: [],
      currently_assumed_turns_to_round: 'one turn',
      relevant_rolls: ['Awareness', 'Lore'],
      action_level: 'personal',
      short_title: 'Window Over the Flood Court',
      dramatic_definition: 'A first lesson in discipline, seen before its meaning is understood.',
      miseenscene: 'Rain on shutters, cold stone, a boy at a high window, and two monks moving as if the courtyard itself is a text.',
      front: { prompt: '', imageUrl: '' },
      back: { prompt: '', imageUrl: '' },
      front_image_url: '',
      back_image_url: ''
    },
    {
      sessionId,
      playerId,
      batchId,
      fragmentText,
      memory_strength: 'durable',
      emotional_sentiment: 'hungry, reverent',
      action_name: 'Carry coal before the bell',
      estimated_action_length: 'ten minutes',
      time_within_action: 'before first bell',
      actual_result: 'The boy learns the monastery notices labor before speech.',
      related_through_what: 'obedience',
      geographical_relevance: 'service stairs behind the cliff kitchens',
      temporal_relation: 'earlier that same season',
      organizational_affiliation: 'Monastery of Saint Vey',
      consequences: 'Work becomes tangled with belonging.',
      distance_from_fragment_location_km: 0,
      shot_type: 'close-up',
      time_of_day: 'pre-dawn',
      whose_eyes: 'the novice porter',
      'interior/exterior': 'interior',
      what_is_being_watched: 'blackened hands lifting coal into brass trays',
      location: 'Kitchen stairs of Saint Vey',
      estimated_duration_of_memory: 3,
      memory_distance: 'distant past',
      entities_in_memory: ['coal trays', 'first bell'],
      currently_assumed_turns_to_round: 'one turn',
      relevant_rolls: ['Endurance', 'Discipline'],
      action_level: 'personal',
      short_title: 'Before Dawn Bell',
      dramatic_definition: 'Belonging is earned by labor before it is ever named.',
      miseenscene: 'Ash on the wrists, breath in the stairwell, brass trays, and a bell waiting above.',
      front: { prompt: '', imageUrl: '' },
      back: { prompt: '', imageUrl: '' },
      front_image_url: '',
      back_image_url: ''
    },
    {
      sessionId,
      playerId,
      batchId,
      fragmentText,
      memory_strength: 'faint',
      emotional_sentiment: 'fear held inside composure',
      action_name: 'Answer the weather master',
      estimated_action_length: 'a few seconds',
      time_within_action: 'after the lesson ends',
      actual_result: 'A single wrong answer marks the boy for later correction.',
      related_through_what: 'judgment',
      geographical_relevance: 'covered walk beside the flood court',
      temporal_relation: 'later the same day',
      organizational_affiliation: 'Monastery of Saint Vey',
      consequences: 'The memory of being watched becomes sharper than the words exchanged.',
      distance_from_fragment_location_km: 0,
      shot_type: 'over-shoulder',
      time_of_day: 'grey morning',
      whose_eyes: 'the weather master',
      'interior/exterior': 'exterior',
      what_is_being_watched: 'the child trying not to shiver while answering',
      location: 'Covered walk of Saint Vey',
      estimated_duration_of_memory: 1,
      memory_distance: 'distant past',
      entities_in_memory: ['weather master', 'rain staff'],
      currently_assumed_turns_to_round: 'one turn',
      relevant_rolls: ['Composure', 'Lore'],
      action_level: 'personal',
      short_title: 'Master Under Rain',
      dramatic_definition: 'Instruction turns personal when the watcher finally speaks.',
      miseenscene: 'Wet stone, measured footsteps, a staff tapping water, and a child holding his answer too tightly.',
      front: { prompt: '', imageUrl: '' },
      back: { prompt: '', imageUrl: '' },
      front_image_url: '',
      back_image_url: ''
    }
  ]);
  const mockedMemoryPayload = {
    memories: seededMemories.map((memory) => ({
      memory_strength: memory.memory_strength,
      emotional_sentiment: memory.emotional_sentiment,
      action_name: memory.action_name,
      estimated_action_length: memory.estimated_action_length,
      time_within_action: memory.time_within_action,
      actual_result: memory.actual_result,
      related_through_what: memory.related_through_what,
      geographical_relevance: memory.geographical_relevance,
      temporal_relation: memory.temporal_relation,
      organizational_affiliation: memory.organizational_affiliation,
      consequences: memory.consequences,
      distance_from_fragment_location_km: memory.distance_from_fragment_location_km,
      shot_type: memory.shot_type,
      time_of_day: memory.time_of_day,
      whose_eyes: memory.whose_eyes,
      'interior/exterior': memory['interior/exterior'],
      what_is_being_watched: memory.what_is_being_watched,
      location: memory.location,
      estimated_duration_of_memory: memory.estimated_duration_of_memory,
      memory_distance: memory.memory_distance,
      entities_in_memory: memory.entities_in_memory,
      currently_assumed_turns_to_round: memory.currently_assumed_turns_to_round,
      relevant_rolls: memory.relevant_rolls,
      action_level: memory.action_level,
      short_title: memory.short_title,
      dramatic_definition: memory.dramatic_definition,
      miseenscene: memory.miseenscene
    }))
  };

  const readingResponse = await invokeRoute(app, 'post', '/api/seer/readings', {
    body: {
      sessionId,
      playerId,
      text: fragmentText,
      batchId,
      visionMemoryId: String(seededMemories[0]?._id || ''),
      cardCount: 3,
      preferredCardKinds: ['location', 'skill', 'character'],
      allowedCardKinds: ['location', 'skill', 'character', 'event', 'ritual'],
      mock: true
    }
  });

  const readingId = readingResponse?.body?.readingId;
  const focusCardId = safeArray(readingResponse?.body?.cards).find((card) => card.focusState === 'active')?.id
    || safeArray(readingResponse?.body?.cards)[0]?.id;
  const focusMemoryId = readingResponse?.body?.focus?.memoryId
    || safeArray(readingResponse?.body?.memories).find((memory) => memory.focusState === 'active')?.id
    || safeArray(readingResponse?.body?.memories)[0]?.id;

  if (readingId && focusMemoryId) {
    const readingDoc = await SeerReading.findOne({ readingId, playerId });
    if (readingDoc) {
      readingDoc.memories = safeArray(readingDoc.memories).map((memory) => {
        if (`${memory?.id || ''}` !== `${focusMemoryId}`) {
          return memory;
        }
        return {
          ...memory,
          witness: '',
          raw: {
            ...(memory?.raw || {}),
            whose_eyes: '',
            entities_in_memory: []
          }
        };
      });
      await readingDoc.save();
    }
  }

  const turnReplies = [
    'It feels like a place built to train obedience long before comfort.',
    'The rain matters. This memory is about learning to read danger in weather and posture.',
    'It is the monastery itself. The boy is learning that the courtyard is a school for storm-reading.',
    'I know enough now to keep this place as one of my first shaping memories.'
  ];

  const turnResponses = [];
  for (const message of turnReplies) {
    turnResponses.push(await invokeRoute(app, 'post', '/api/seer/readings/:readingId/turn', {
      params: { readingId },
      body: {
        playerId,
        message,
        mock: true
      }
    }));
  }

  const latestTurnReading = turnResponses[turnResponses.length - 1]?.body || readingResponse?.body;
  const claimCardId = safeArray(latestTurnReading?.cards).find((card) => card.status === 'claimable')?.id || focusCardId;

  const claimResponse = await invokeRoute(app, 'post', '/api/seer/readings/:readingId/cards/:cardId/claim', {
    params: { readingId, cardId: claimCardId },
    body: { playerId }
  });

  const claimedEntityRef = claimResponse?.body?.claimedEntityLinks?.[0]?.entityExternalId
    || claimResponse?.body?.claimedEntityLinks?.[0]?.entityId;

  const bankResponse = await invokeRoute(app, 'get', '/api/entities', {
    query: {
      sessionId,
      playerId,
      linkedReadingId: readingId,
      sort: 'reuse',
      limit: 8
    }
  });

  const missionResponse = await invokeRoute(app, 'post', '/api/sendStorytellerToEntity', {
    body: {
      sessionId,
      playerId,
      entityId: claimedEntityRef,
      storytellerId: String(storyteller._id),
      storytellingPoints: 14,
      duration: 3,
      message: 'Learn what this place taught me before I knew it was shaping me.',
      mock: true
    }
  });

  const sheetResponse = await invokeRoute(app, 'get', '/api/immersive-rpg/character-sheet', {
    query: { sessionId, playerId }
  });

  const routeLog = buildRouteLog({
    storytellerList,
    readingResponse,
    turnResponses,
    claimResponse,
    bankResponse,
    missionResponse,
    sheetResponse
  });

  const rawPayloads = {
    sessionId,
    playerId,
    fragmentText,
    storyteller,
    routeLog,
    configs: {
      fragment_to_memories: fragmentConfig?.body || {},
      seer_reading_card_generation: seerCardConfig?.body || {},
      storyteller_mission: storytellerMissionConfig?.body || {},
      entity_creation_template: entityPromptTemplate
    },
    mockedMemoryPayload,
    responses: {
      storytellerList: storytellerList?.body,
      readingResponse: readingResponse?.body,
      turnResponses,
      claimResponse,
      bankResponse,
      missionResponse,
      sheetResponse
    }
  };

  const markdown = buildReportMarkdown({
    sessionId,
    playerId,
    fragmentText,
    readingResponse,
    turnResponses,
    claimResponse,
    bankResponse,
    missionResponse,
    sheetResponse,
    mockedMemoryPayload,
    fragmentConfig,
    seerCardConfig,
    storytellerMissionConfig,
    entityPromptTemplate,
    storyteller,
    routeLog
  });

  const rawPayloadPath = path.join(outDir, 'seer_entity_bank_mock_run.json');
  const reportPath = path.join(outDir, 'seer_entity_bank_mock_run.md');
  await writeFile(rawPayloadPath, `${JSON.stringify(rawPayloads, null, 2)}\n`);
  await writeFile(reportPath, markdown);

  console.log(JSON.stringify({
    sessionId,
    playerId,
    outDir,
    reportPath,
    rawPayloadPath
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

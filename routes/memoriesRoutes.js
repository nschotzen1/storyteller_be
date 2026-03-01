import express from 'express';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { directExternalApiCall } from '../ai/openai/apiService.js';
import { FragmentMemory } from '../models/memory_models.js';
import { ensureDirectoryExists } from '../storyteller/utils.js';
import { textToImageOpenAi } from '../ai/textToImage/api.js';
import {
  getRouteConfig,
  renderPrompt,
  validatePayloadForRoute
} from '../services/llmRouteConfigService.js';
import {
  FRAGMENT_MEMORY_REQUIRED_FIELDS,
  FRAGMENT_MEMORY_PROPERTIES_JSON_SCHEMA
} from '../contracts/fragmentMemoryContract.js';
import { getPipelineSettings } from '../services/typewriterAiSettingsService.js';
import {
  getLatestPromptTemplate,
  renderPromptTemplateString
} from '../services/typewriterPromptConfigService.js';
import { getTypewriterSessionFragment } from '../services/typewriterSessionService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_CARD_MOCK_FRONT_IMAGES = [
  '/assets/mocks/memory_cards/memory_front_01.png',
  '/assets/mocks/memory_cards/memory_front_02.png',
  '/assets/mocks/memory_cards/memory_front_03.png'
];

const MEMORY_CARD_MOCK_BACK_IMAGES = [
  '/assets/mocks/memory_cards/memory_back_01.png',
  '/assets/mocks/memory_cards/memory_back_02.png',
  '/assets/mocks/memory_cards/memory_back_03.png'
];

function getFragmentText(body) {
  return body?.text || body?.userText || body?.fragment || '';
}

async function resolveFragmentText(body) {
  const fragmentText = getFragmentText(body);
  if (fragmentText) {
    return fragmentText;
  }
  if (!body?.sessionId) {
    return '';
  }
  return getTypewriterSessionFragment(body.sessionId);
}

function normalizeMemoryCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return 3;
  }
  return Math.min(Math.max(1, Math.floor(count)), 10);
}

function parseBooleanFlag(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function resolveExplicitMockOverride(body = {}) {
  const flags = [body.mock, body.debug, body.mock_api_calls, body.mocked_api_calls];
  for (const flag of flags) {
    const parsed = parseBooleanFlag(flag);
    if (parsed !== null) return parsed;
  }
  return null;
}

function resolveMockMode(body = {}, fallback = false) {
  const explicit = resolveExplicitMockOverride(body);
  if (explicit !== null) return explicit;
  return Boolean(fallback);
}

function resolveSchemaErrorMessage(error, fallback) {
  if (!error?.details || !Array.isArray(error.details) || error.details.length === 0) {
    return fallback;
  }
  return `${fallback} ${error.details.join('; ')}`;
}

function resolvePersistenceErrorMessage(error, fallback) {
  if (!error?.details || !Array.isArray(error.details) || error.details.length === 0) {
    return fallback;
  }
  return `${fallback} ${error.details.join('; ')}`;
}

function buildMockMemories(count) {
  const base = {
    memory_strength: 'vivid',
    emotional_sentiment: 'tense resolve',
    action_name: 'crossing unstable stone ledges above a flooded ravine',
    estimated_action_length: '20 minutes',
    time_within_action: 'middle',
    actual_result: 'a near-fall is avoided by instinct and luck',
    related_through_what: 'shared location and immediate stakes echoing the fragment',
    geographical_relevance: 'wet basalt and crosswinds make every step dangerous',
    temporal_relation: 'this moment',
    organizational_affiliation: 'none',
    consequences: 'typical danger suddenly escalates into a critical choice',
    distance_from_fragment_location_km: 0,
    shot_type: 'close-up',
    time_of_day: 'twilight',
    whose_eyes: 'the courier gripping a frayed rope line',
    'interior/exterior': 'exterior',
    what_is_being_watched: 'boots slipping at the ravine edge',
    location: 'Ravine shelf above the Yuradel run',
    estimated_duration_of_memory: 12,
    memory_distance: 'meanwhile',
    entities_in_memory: ['ravine shelf', 'rope line', 'courier', 'floodwater', 'wind shear'],
    currently_assumed_turns_to_round: '10 minutes - 1 hour',
    relevant_rolls: ['Dexterity', 'Perception', 'Resolve'],
    action_level: 'round',
    dramatic_definition: 'Where Stone Gives Way',
    miseenscene:
      'The rope burns my palm when I jerk it tight. Wet stone slicks under my heel and the ravine yawns, loud and black, below.'
  };

  return Array.from({ length: count }).map((_, idx) => ({
    ...base,
    dramatic_definition: idx === 0 ? base.dramatic_definition : `Memory ${idx + 1}: Fractured Trace`,
    distance_from_fragment_location_km: idx === 0 ? 0 : idx * 3,
    memory_distance: idx === 0 ? 'meanwhile' : `${idx + 1} hours prior`
  }));
}

const PERSISTED_MEMORY_FIELDS = Object.keys(FRAGMENT_MEMORY_PROPERTIES_JSON_SCHEMA);

function sanitizeFileSegment(value, fallback) {
  const raw = typeof value === 'string' ? value : '';
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  if (!cleaned) return fallback;
  return cleaned;
}

function buildMemoryFrontPrompt(memory, fragmentText) {
  const title = memory?.dramatic_definition || memory?.action_name || 'Untitled memory';
  const scene = memory?.miseenscene || memory?.actual_result || memory?.what_is_being_watched || fragmentText;
  const location = memory?.location || 'unknown location';
  const mood = memory?.emotional_sentiment || 'tense silence';
  const viewpoint = memory?.whose_eyes || 'an involved witness';

  return `Create a full-frame RPG collector card FRONT illustration titled "${title}".
Memory viewpoint: "${viewpoint}".
Scene location: "${location}".
Emotional tone: "${mood}".
Memory scene details: "${scene}".
Visual style: cinematic, tactile, grainy, with collector-card embellishments and subtle filigree.
No visible text except the title "${title}".`;
}

function buildMemoryFrontPromptWithTemplate(memory, fragmentText, promptTemplate = '') {
  if (!promptTemplate || !promptTemplate.trim()) {
    return buildMemoryFrontPrompt(memory, fragmentText);
  }
  return renderPromptTemplateString(promptTemplate, {
    dramatic_definition: memory?.dramatic_definition || memory?.action_name || 'Untitled memory',
    action_name: memory?.action_name || '',
    miseenscene: memory?.miseenscene || '',
    actual_result: memory?.actual_result || '',
    watched: memory?.what_is_being_watched || '',
    location: memory?.location || 'unknown location',
    emotional_sentiment: memory?.emotional_sentiment || 'tense silence',
    viewpoint: memory?.whose_eyes || 'an involved witness',
    fragmentText: fragmentText || ''
  });
}

function buildMemoryBackPrompt(memory, fragmentText) {
  const title = memory?.dramatic_definition || memory?.action_name || 'Untitled memory';
  const temporal = memory?.memory_distance || memory?.temporal_relation || 'echoing in uncertain time';
  const environment = memory?.geographical_relevance || fragmentText;
  const sentiment = memory?.emotional_sentiment || 'ambiguous';

  return `Create a full-frame RPG collector card BACK texture for memory "${title}".
Theme: memory residue, archival symbolism, layered weathered materials.
Temporal cue: "${temporal}".
Environmental cue: "${environment}".
Emotional undertone: "${sentiment}".
Visual style: abstract-symbolic, worn, cinematic, grainy, richly textured with card-back motifs and ornate flourishes.
No readable text.`;
}

function buildMemoryBackPromptWithTemplate(memory, fragmentText, promptTemplate = '') {
  if (!promptTemplate || !promptTemplate.trim()) {
    return buildMemoryBackPrompt(memory, fragmentText);
  }
  return renderPromptTemplateString(promptTemplate, {
    dramatic_definition: memory?.dramatic_definition || memory?.action_name || 'Untitled memory',
    action_name: memory?.action_name || '',
    memory_distance: memory?.memory_distance || '',
    temporal_relation: memory?.temporal_relation || '',
    geographical_relevance: memory?.geographical_relevance || '',
    emotional_sentiment: memory?.emotional_sentiment || 'ambiguous',
    fragmentText: fragmentText || ''
  });
}

function pickMockMemoryImageUrl(index, side) {
  const options = side === 'back' ? MEMORY_CARD_MOCK_BACK_IMAGES : MEMORY_CARD_MOCK_FRONT_IMAGES;
  if (!options.length) return '';
  return options[index % options.length];
}

async function buildMemoryCardPayload({
  memory,
  index,
  sessionId,
  batchId,
  cardsDirAbs,
  includeFront,
  includeBack,
  shouldMock,
  fragmentText,
  imageModel,
  frontPromptTemplate,
  backPromptTemplate
}) {
  const card = {};
  const baseName = sanitizeFileSegment(
    memory?.dramatic_definition || memory?.action_name,
    `memory_${index + 1}`
  );

  if (includeFront) {
    const prompt = buildMemoryFrontPromptWithTemplate(memory, fragmentText, frontPromptTemplate);
    let imageUrl = '';
    if (shouldMock) {
      imageUrl = pickMockMemoryImageUrl(index, 'front');
    } else {
      const filename = `${String(index + 1).padStart(2, '0')}_${baseName}_front.png`;
      const localPath = path.join(cardsDirAbs, filename);
      const result = await textToImageOpenAi(prompt, 1, localPath, false, 3, imageModel);
      if (result?.localPath) {
        imageUrl = `/assets/${sessionId}/memory_cards/${batchId}/${filename}`;
      }
    }
    card.front = { prompt, imageUrl };
  }

  if (includeBack) {
    const prompt = buildMemoryBackPromptWithTemplate(memory, fragmentText, backPromptTemplate);
    let imageUrl = '';
    if (shouldMock) {
      imageUrl = pickMockMemoryImageUrl(index, 'back');
    } else {
      const filename = `${String(index + 1).padStart(2, '0')}_${baseName}_back.png`;
      const localPath = path.join(cardsDirAbs, filename);
      const result = await textToImageOpenAi(prompt, 1, localPath, false, 3, imageModel);
      if (result?.localPath) {
        imageUrl = `/assets/${sessionId}/memory_cards/${batchId}/${filename}`;
      }
    }
    card.back = { prompt, imageUrl };
  }

  return card;
}

function toPersistenceMemory(memory) {
  const projected = {};
  for (const field of PERSISTED_MEMORY_FIELDS) {
    projected[field] = memory?.[field];
  }
  return projected;
}

function ensurePersistableMemory(memory) {
  const projected = toPersistenceMemory(memory);
  const missing = [];
  for (const field of FRAGMENT_MEMORY_REQUIRED_FIELDS) {
    if (projected[field] === undefined || projected[field] === null) {
      missing.push(field);
    }
  }
  if (missing.length > 0) {
    const error = new Error('Memory payload is missing required fields for persistence.');
    error.code = 'MEMORY_PERSISTENCE_VALIDATION_ERROR';
    error.details = missing.map((field) => `missing field "${field}"`);
    throw error;
  }
  return projected;
}

router.post('/fragmentToMemories', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      sessionId,
      playerId,
      count,
      numberOfMemories,
      includeCards,
      includeFront,
      includeBack,
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = body;
    const fragmentText = await resolveFragmentText(body);

    if (!sessionId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or text.' });
    }

    const memoryCount = normalizeMemoryCount(count ?? numberOfMemories);
    const memorySettings = await getPipelineSettings('memory_creation');
    const textureSettings = await getPipelineSettings('texture_creation');
    const shouldMock = resolveMockMode(body, memorySettings.useMock);
    const shouldMockTextures = resolveMockMode(body, textureSettings.useMock);
    const memoryFrontPrompt = await getLatestPromptTemplate('memory_card_front');
    const memoryBackPrompt = await getLatestPromptTemplate('memory_card_back');
    const shouldIncludeCards = includeCards === undefined ? false : Boolean(includeCards);
    const shouldIncludeFront = includeFront === undefined ? true : Boolean(includeFront);
    const shouldIncludeBack = includeBack === undefined ? true : Boolean(includeBack);
    let memoriesPayload;

    if (shouldMock) {
      memoriesPayload = { memories: buildMockMemories(memoryCount) };
    } else {
      const latestPrompt = await getLatestPromptTemplate('memory_creation');
      let prompt = '';
      if (latestPrompt?.promptTemplate) {
        prompt = renderPromptTemplateString(latestPrompt.promptTemplate, {
          fragmentText,
          memoryCount
        });
      } else {
        const routeConfig = await getRouteConfig('fragment_to_memories');
        prompt = renderPrompt(routeConfig.promptTemplate, {
          fragmentText,
          memoryCount
        });
      }
      const llmResult = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        3000,
        undefined,
        undefined,
        true,
        true,
        memorySettings.model
      );
      memoriesPayload = Array.isArray(llmResult) ? { memories: llmResult } : llmResult;
    }

    await validatePayloadForRoute('fragment_to_memories', memoriesPayload);

    const batchId = randomUUID();
    const cardsDirAbs = path.resolve(process.cwd(), 'assets', sessionId, 'memory_cards', batchId);
    if (shouldIncludeCards && !shouldMockTextures && (shouldIncludeFront || shouldIncludeBack)) {
      await ensureDirectoryExists(cardsDirAbs);
    }

    const docsToInsert = [];
    for (let index = 0; index < memoriesPayload.memories.length; index += 1) {
      const memory = memoriesPayload.memories[index];
      const projected = ensurePersistableMemory(memory);
      const doc = {
        sessionId,
        playerId,
        fragmentText,
        batchId,
        ...projected
      };

      if (shouldIncludeCards) {
        const card = await buildMemoryCardPayload({
          memory,
          index,
          sessionId,
          batchId,
          cardsDirAbs,
          includeFront: shouldIncludeFront,
          includeBack: shouldIncludeBack,
          shouldMock: shouldMockTextures,
          fragmentText,
          imageModel: textureSettings.model,
          frontPromptTemplate: memoryFrontPrompt?.promptTemplate || '',
          backPromptTemplate: memoryBackPrompt?.promptTemplate || ''
        });
        if (card.front) doc.front = card.front;
        if (card.back) doc.back = card.back;
        doc.front_image_url = card.front?.imageUrl || '';
        doc.back_image_url = card.back?.imageUrl || '';
      }

      docsToInsert.push(doc);
    }

    const saved = await FragmentMemory.insertMany(docsToInsert, { ordered: true });

    const response = {
      sessionId,
      playerId,
      batchId,
      memories: saved,
      count: saved.length,
      mocked: shouldMock || shouldMockTextures,
      mockedMemories: shouldMock,
      mockedTextures: shouldMockTextures
    };

    if (shouldIncludeCards) {
      response.cardOptions = {
        includeFront: shouldIncludeFront,
        includeBack: shouldIncludeBack
      };
    }

    return res.status(200).json(response);
  } catch (err) {
    if (err.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolveSchemaErrorMessage(err, 'Fragment-to-memories schema validation failed.')
      });
    }
    if (err.code === 'MEMORY_PERSISTENCE_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolvePersistenceErrorMessage(err, 'Fragment-to-memories persistence validation failed.')
      });
    }
    console.error('Error in /api/fragmentToMemories:', err);
    return res.status(500).json({ message: 'Server error during fragment-to-memories generation.' });
  }
});

router.get('/memories', async (req, res) => {
  try {
    const { sessionId, playerId, batchId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const query = { sessionId };
    if (playerId) query.playerId = playerId;
    if (batchId) query.batchId = batchId;

    const memories = await FragmentMemory.find(query).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      sessionId,
      playerId: playerId || undefined,
      batchId: batchId || undefined,
      count: memories.length,
      memories
    });
  } catch (error) {
    console.error('Error in /api/memories:', error);
    return res.status(500).json({ message: 'Server error during memories fetch.' });
  }
});

router.delete('/memories', async (req, res) => {
  try {
    const { sessionId, playerId, batchId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const query = { sessionId };
    if (playerId) query.playerId = playerId;
    if (batchId) query.batchId = batchId;

    const deletionResult = await FragmentMemory.deleteMany(query);
    return res.status(200).json({
      sessionId,
      playerId: playerId || undefined,
      batchId: batchId || undefined,
      deletedCount: Number(deletionResult?.deletedCount || 0)
    });
  } catch (error) {
    console.error('Error in DELETE /api/memories:', error);
    return res.status(500).json({ message: 'Server error during memories delete.' });
  }
});

export default router;

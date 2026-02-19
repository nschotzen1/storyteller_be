import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { BrewRoom } from './models/brewing_models.js';
import { directExternalApiCall } from './ai/openai/apiService.js';
import { Storyteller, SessionPlayer, Arena, World, WorldElement, QuestScreenGraph } from './models/models.js';
import {
  createStoryTellerKey,
  createStorytellerIllustration
} from './services/storytellerService.js';
import { NarrativeEntity } from './storyteller/utils.js';
import { textToEntityFromText } from './services/textToEntityService.js';
import {
  normalizePredicate,
  getExistingEdgesForEntities,
  checkDuplicateEdge,
  evaluateRelationship,
  calculatePoints
} from './services/arenaService.js';
import {
  getClusterForEntities,
  createRelationship,
  syncEntityNode,
  buildClusterContext
} from './services/neo4jService.js';
import { buildOpenApiSpec } from './openapi.js';
import {
  listRouteConfigs,
  getRouteConfig,
  updateRoutePrompt,
  updateRouteSchema,
  resetRouteConfig,
  renderPrompt,
  validatePayloadForRoute
} from './services/llmRouteConfigService.js';
import memoriesRouter from './routes/memoriesRoutes.js';
import { generateTypewriterPrompt } from './ai/openai/promptsUtils.js';


const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_ROOT_CANDIDATES = [
  path.resolve(process.cwd(), 'assets'),
  path.resolve(process.cwd(), '../assets'),
  path.resolve(__dirname, 'assets'),
  path.resolve(__dirname, '../assets')
];
const ASSETS_ROOTS = Array.from(new Set(ASSETS_ROOT_CANDIDATES)).filter((candidatePath) =>
  fs.existsSync(candidatePath)
);
if (ASSETS_ROOTS.length === 0) {
  ASSETS_ROOTS.push(path.resolve(process.cwd(), 'assets'));
}
const DEFAULT_QUEST_ID = 'ruined_rose_court';
const DEFAULT_QUEST_SESSION_ID = 'rose-court-demo';
const MOCK_STORYTELLER_ILLUSTRATION_URL = '/assets/mocks/storyteller_illustrations/stormwright_weather_speaker.png';
const OPEN_API_SPEC = buildOpenApiSpec();
const TYPEWRITER_MOCK_MODE = process.env.TYPEWRITER_MOCK_MODE === 'true';
const TYPEWRITER_FALLBACK_BACKGROUNDS = [
  '/textures/decor/film_frame_desert.png',
  '/well/well_background.png',
  '/ruin_south_a.png',
  '/arenas/petal_hex_v1.png'
];
const TYPEWRITER_DEFAULT_FONTS = [
  { font: "'Uncial Antiqua', serif", font_size: '1.8rem', font_color: '#3b1d15' },
  { font: "'IM Fell English SC', serif", font_size: '1.9rem', font_color: '#2a120f' },
  { font: "'EB Garamond', serif", font_size: '2rem', font_color: '#1f0e08' }
];
const DEFAULT_QUEST_CONFIG = {
  sessionId: DEFAULT_QUEST_SESSION_ID,
  questId: DEFAULT_QUEST_ID,
  startScreenId: 'outer_gate_murals',
  screens: [
    {
      id: 'outer_gate_murals',
      title: 'Outer Wall Murals',
      prompt: 'You stand outside the ruined rose court as sunset stains the dust. Three shattered murals stare back from the wall, and beyond them the distant rosebud of pale obsidian catches the last light.',
      imageUrl: '/ruin_south_a.png',
      image_prompt: 'Wide cinematic view of the ruined rose court outer wall at sunset, three eroded murals, crumbling petal-like stonework, distant pale-obsidian rosebud tower, moody fantasy archaeology style.',
      textPromptPlaceholder: 'Which mural do you inspect first?',
      directions: [
        { direction: 'west', label: 'Approach left mural panel', targetScreenId: 'mural_left_panel' },
        { direction: 'north', label: 'Approach center mural panel', targetScreenId: 'mural_center_panel' },
        { direction: 'east', label: 'Approach right mural panel', targetScreenId: 'mural_right_panel' },
        { direction: 'south', label: 'Circle the western periphery', targetScreenId: 'west_periphery_path' }
      ]
    },
    {
      id: 'mural_left_panel',
      title: 'Mural of the Drowned Citadel',
      prompt: 'The left mural shows a drowned city under constellations that do not match the current sky.',
      imageUrl: '/arenas/petal_hex_v1.png',
      image_prompt: 'Ruined stone mural depicting a drowned citadel under alien stars, mosaic fragments missing, warm sunset light and dust in the air.',
      textPromptPlaceholder: 'What detail from the drowned city stands out?',
      directions: [
        { direction: 'east', label: 'Return to mural forecourt', targetScreenId: 'outer_gate_murals' },
        { direction: 'inside', label: 'Slip through cracked arch nearby', targetScreenId: 'west_breach_b2' }
      ]
    },
    {
      id: 'mural_center_panel',
      title: 'Mural of the Solitary Walker',
      prompt: 'The center mural shows a lone figure with a staff, walking toward a rosebud-shaped shrine.',
      imageUrl: '/ruin_south_a.png',
      image_prompt: 'Ancient mural of a solitary traveler with staff heading toward rosebud shrine, heavy weathering, cracked plaster, melancholic sunset tones.',
      textPromptPlaceholder: 'What do you whisper to the solitary walker?',
      directions: [
        { direction: 'west', label: 'Return to mural forecourt', targetScreenId: 'outer_gate_murals' },
        { direction: 'north', label: 'Follow the path hinted in mural', targetScreenId: 'north_periphery_walk' }
      ]
    },
    {
      id: 'mural_right_panel',
      title: 'Mural of the Procession',
      prompt: 'The right mural depicts a masked procession carrying lanterns toward an underground door.',
      imageUrl: '/textures/decor/film_frame_desert.png',
      image_prompt: 'Fragmented mural of masked lantern procession moving toward subterranean doorway, ceremonial atmosphere, worn fresco textures.',
      textPromptPlaceholder: 'What omen do you draw from the procession?',
      directions: [
        { direction: 'west', label: 'Return to mural forecourt', targetScreenId: 'outer_gate_murals' },
        { direction: 'east', label: 'Walk the eastern wall trail', targetScreenId: 'east_periphery_walk' }
      ]
    },
    {
      id: 'west_periphery_path',
      title: 'Western Periphery',
      prompt: 'You follow the wall where stones peel like dead petals. The wind carries a damp echo, as if water hides nearby.',
      imageUrl: '/ruin_south_a.png',
      image_prompt: 'Periphery path along crumbling rose-petal wall stones, twilight wind, hints of hidden water source, sparse ruined columns.',
      textPromptPlaceholder: 'How cautiously do you move along the wall?',
      directions: [
        { direction: 'north', label: 'Inspect low breach marked B2', targetScreenId: 'west_breach_b2' },
        { direction: 'east', label: 'Continue toward south wall', targetScreenId: 'south_periphery_walk' },
        { direction: 'back', label: 'Return to outer mural gate', targetScreenId: 'outer_gate_murals' }
      ]
    },
    {
      id: 'west_breach_b2',
      title: 'Breach B2',
      prompt: 'A narrow fracture in the wall opens into a ring of fallen pillars just inside the court.',
      imageUrl: '/arenas/petal_hex_v1.png',
      image_prompt: 'Close ruined breach in circular wall opening to interior fallen pillar ring, dusty ancient stone textures, late sunset glow.',
      textPromptPlaceholder: 'Do you squeeze through or hold position?',
      directions: [
        { direction: 'inside', label: 'Enter through the breach', targetScreenId: 'inner_west_ambulatory' },
        { direction: 'outside', label: 'Return to western periphery', targetScreenId: 'west_periphery_path' }
      ]
    },
    {
      id: 'north_periphery_walk',
      title: 'Northern Periphery',
      prompt: 'At the northern arc, the wall curves around collapsed niches. The rosebud is clearer from here, cracked but upright.',
      imageUrl: '/ruin_south_a.png',
      image_prompt: 'Northern arc of ruined rose court wall with collapsed niches, distant cracked rosebud structure, cinematic dusk lighting.',
      textPromptPlaceholder: 'What catches your attention along the northern wall?',
      directions: [
        { direction: 'east', label: 'Continue toward eastern slope', targetScreenId: 'east_periphery_walk' },
        { direction: 'inside', label: 'Use narrow gap into inner ring', targetScreenId: 'inner_north_ambulatory' },
        { direction: 'back', label: 'Return to center mural panel', targetScreenId: 'mural_center_panel' }
      ]
    },
    {
      id: 'east_periphery_walk',
      title: 'Eastern Periphery',
      prompt: 'The eastern wall is jagged and half-collapsed. Traces of footprints lead toward a cracked stair descending beneath rubble.',
      imageUrl: '/ruin_south_a.png',
      image_prompt: 'Eastern ruined wall with broken stair descending under rubble, faint footprints in dust, dramatic fantasy ruins at dusk.',
      textPromptPlaceholder: 'Do you follow the footprints?',
      directions: [
        { direction: 'down', label: 'Descend cracked stair', targetScreenId: 'well_approach_gallery' },
        { direction: 'south', label: 'Continue to southern wall', targetScreenId: 'south_periphery_walk' },
        { direction: 'back', label: 'Return to right mural panel', targetScreenId: 'mural_right_panel' }
      ]
    },
    {
      id: 'well_approach_gallery',
      title: 'Well Approach Gallery',
      prompt: 'A gallery of broken arches opens to a circular shaft: the rumored well along the periphery.',
      imageUrl: '/well/well_background.png',
      image_prompt: 'Subterranean gallery near ruined wall with broken arches opening to ancient deep well shaft, dim amber sunset spill, ominous atmosphere.',
      textPromptPlaceholder: 'What do you test near the well rim?',
      directions: [
        { direction: 'down', label: 'Peer into the well', targetScreenId: 'periphery_well_rim' },
        { direction: 'up', label: 'Climb back to eastern periphery', targetScreenId: 'east_periphery_walk' }
      ]
    },
    {
      id: 'periphery_well_rim',
      title: 'Well of Rings',
      prompt: 'Iron rings hang beside the shaft. Far below, water reflects a faint script: almost words.',
      imageUrl: '/well/well_background.png',
      image_prompt: 'Ancient stone well with hanging iron rings, dark water reflecting ghostly script, high detail fantasy ruin close-up.',
      textPromptPlaceholder: 'What message do you think the water is trying to speak?',
      directions: [
        { direction: 'inside', label: 'Follow hidden side tunnel', targetScreenId: 'well_side_tunnel' },
        { direction: 'up', label: 'Back to well approach gallery', targetScreenId: 'well_approach_gallery' }
      ]
    },
    {
      id: 'well_side_tunnel',
      title: 'Well Side Tunnel',
      prompt: 'A cramped tunnel curves beneath the wall and rises toward the inner court, bypassing the open breaches.',
      imageUrl: '/well/well_background.png',
      image_prompt: 'Narrow tunnel branching from ancient well beneath ruined wall, damp stones, faint bioluminescent marks guiding inward.',
      textPromptPlaceholder: 'How do you keep your bearings in the tunnel?',
      directions: [
        { direction: 'forward', label: 'Climb toward inner ring', targetScreenId: 'inner_south_ambulatory' },
        { direction: 'back', label: 'Return to well rim', targetScreenId: 'periphery_well_rim' }
      ]
    },
    {
      id: 'south_periphery_walk',
      title: 'Southern Periphery',
      prompt: 'The southern wall holds deep scars and collapsed reliefs. A larger breach marked B3 opens inward.',
      imageUrl: '/ruin_south_a.png',
      image_prompt: 'Southern wall of ruined rose court with heavy scarring and large breach marker, rubble and long shadows in sunset.',
      textPromptPlaceholder: 'Do you risk the larger breach?',
      directions: [
        { direction: 'inside', label: 'Enter through breach B3', targetScreenId: 'south_breach_b3' },
        { direction: 'west', label: 'Return to western periphery', targetScreenId: 'west_periphery_path' },
        { direction: 'north', label: 'Return to eastern periphery', targetScreenId: 'east_periphery_walk' }
      ]
    },
    {
      id: 'south_breach_b3',
      title: 'Breach B3',
      prompt: 'Past B3 the ground dips into an inner ambulatory lined with toppled columns and pale stone petals.',
      imageUrl: '/arenas/petal_hex_v1.png',
      image_prompt: 'Large breach opening to inner ambulatory with toppled columns and petal-like pale stone fragments, dramatic fantasy ruins.',
      textPromptPlaceholder: 'What do you examine first inside B3?',
      directions: [
        { direction: 'north', label: 'Move along inner southern ring', targetScreenId: 'inner_south_ambulatory' },
        { direction: 'outside', label: 'Exit to southern periphery', targetScreenId: 'south_periphery_walk' }
      ]
    },
    {
      id: 'inner_west_ambulatory',
      title: 'Inner West Ambulatory',
      prompt: 'Inside the court, the wall murals are only ghosts of pigment. The rosebud looms larger, petals split by time.',
      imageUrl: '/arenas/petal_hex_v1.png',
      image_prompt: 'Interior west ambulatory of ruined circular court, faded mural traces, looming cracked rosebud center, atmospheric dust.',
      textPromptPlaceholder: 'How do you mark your route inside the court?',
      directions: [
        { direction: 'east', label: 'Circle toward inner north', targetScreenId: 'inner_north_ambulatory' },
        { direction: 'south', label: 'Circle toward inner south', targetScreenId: 'inner_south_ambulatory' },
        { direction: 'outside', label: 'Retreat through B2', targetScreenId: 'west_breach_b2' }
      ]
    },
    {
      id: 'inner_north_ambulatory',
      title: 'Inner North Ambulatory',
      prompt: 'A ring of cracked paving stones encircles the rosebud. Here, tiny obsidian flakes sparkle like frost.',
      imageUrl: '/arenas/petal_hex_v1.png',
      image_prompt: 'Inner north ring with cracked paving and sparkling obsidian flakes around central rosebud ruin, twilight fantasy realism.',
      textPromptPlaceholder: 'What do the obsidian flakes suggest to you?',
      directions: [
        { direction: 'south', label: 'Continue to inner south ring', targetScreenId: 'inner_south_ambulatory' },
        { direction: 'center', label: 'Approach rosebud base', targetScreenId: 'rosebud_outer_threshold' },
        { direction: 'outside', label: 'Slip back to north periphery', targetScreenId: 'north_periphery_walk' }
      ]
    },
    {
      id: 'inner_south_ambulatory',
      title: 'Inner South Ambulatory',
      prompt: 'The ambulatory floor is fractured by radial seams leading directly into the rosebud foundation.',
      imageUrl: '/arenas/petal_hex_v1.png',
      image_prompt: 'Inner south ring of ruined court with radial seams converging toward central rosebud foundation, eerie golden dusk.',
      textPromptPlaceholder: 'Which seam do you choose to follow?',
      directions: [
        { direction: 'center', label: 'Follow seam to rosebud threshold', targetScreenId: 'rosebud_outer_threshold' },
        { direction: 'west', label: 'Cross to inner west ring', targetScreenId: 'inner_west_ambulatory' },
        { direction: 'outside', label: 'Exit through B3', targetScreenId: 'south_breach_b3' }
      ]
    },
    {
      id: 'rosebud_outer_threshold',
      title: 'Rosebud Threshold',
      prompt: 'At the base of the rosebud, petals of pale obsidian form a jagged crown around a sealed iris seam.',
      imageUrl: '/textures/decor/film_frame_desert.png',
      image_prompt: 'Close view of central rosebud ruin built from pale obsidian-like petals, jagged crown, sealed iris seam entrance, mystical ruin lighting.',
      textPromptPlaceholder: 'How do you test the seam between stone petals?',
      directions: [
        { direction: 'down', label: 'Search lower fissure for entry', targetScreenId: 'rosebud_lower_fissure' },
        { direction: 'back', label: 'Return to inner north ring', targetScreenId: 'inner_north_ambulatory' },
        { direction: 'south', label: 'Return to inner south ring', targetScreenId: 'inner_south_ambulatory' }
      ]
    },
    {
      id: 'rosebud_lower_fissure',
      title: 'Lower Fissure',
      prompt: 'A narrow fissure opens between petals. The air inside smells of wet stone and old incense.',
      imageUrl: '/textures/decor/film_frame_desert.png',
      image_prompt: 'Narrow fissure between giant rosebud stone petals, faint interior glow, damp ancient air, cinematic fantasy close-up.',
      textPromptPlaceholder: 'Do you force the fissure or listen first?',
      directions: [
        { direction: 'inside', label: 'Enter the fissure passage', targetScreenId: 'rosebud_entry_passage' },
        { direction: 'back', label: 'Back to rosebud threshold', targetScreenId: 'rosebud_outer_threshold' }
      ]
    },
    {
      id: 'rosebud_entry_passage',
      title: 'Rosebud Entry Passage',
      prompt: 'You crawl into a petal-shaped corridor of fragile obsidian stone. This is the first true entrance.',
      imageUrl: '/textures/decor/film_frame_desert.png',
      image_prompt: 'Interior passage inside rosebud-shaped ruin, petal-like obsidian walls, dim amber guidance light, sacred ruin atmosphere.',
      textPromptPlaceholder: 'What do you leave as a marker at the entrance?',
      directions: [
        { direction: 'forward', label: 'Descend to inner antechamber', targetScreenId: 'rosebud_inner_antechamber' },
        { direction: 'back', label: 'Retreat to lower fissure', targetScreenId: 'rosebud_lower_fissure' }
      ]
    },
    {
      id: 'rosebud_inner_antechamber',
      title: 'Inner Antechamber',
      prompt: 'An antechamber opens beneath the rosebud. Four carved rings encircle a final sealed iris gate.',
      imageUrl: '/textures/decor/film_frame_desert.png',
      image_prompt: 'Hidden antechamber beneath ruined rosebud, four carved rings around a sealed iris gate, sacred subterranean fantasy architecture.',
      textPromptPlaceholder: 'What do you do before touching the iris gate?',
      directions: [
        { direction: 'back', label: 'Return to entry passage', targetScreenId: 'rosebud_entry_passage' }
      ]
    }
  ]
};

for (const assetsRoot of ASSETS_ROOTS) {
  app.use('/assets', express.static(assetsRoot));
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

function resolveTypewriterMockMode(body = {}) {
  const explicitFlags = [body.mock, body.debug, body.mock_api_calls, body.mocked_api_calls];
  for (const flag of explicitFlags) {
    const parsed = parseBooleanFlag(flag);
    if (parsed !== null) return parsed;
  }
  return TYPEWRITER_MOCK_MODE;
}

function pickRandomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeTypewriterMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const font = metadata.font || metadata.fontName || metadata.font_family || metadata.fontFamily;
  const fontSize = metadata.font_size || metadata.fontSize || metadata.size;
  const fontColor = metadata.font_color || metadata.fontColor || metadata.color;
  if (!font && !fontSize && !fontColor) return null;
  return {
    font: font || pickRandomItem(TYPEWRITER_DEFAULT_FONTS).font,
    font_size: typeof fontSize === 'number' ? `${fontSize}px` : (fontSize || '1.9rem'),
    font_color: fontColor || '#2a120f'
  };
}

function createTypewriterResponse(fullText, metadata, fadeSteps = 3) {
  const style = normalizeTypewriterMetadata(metadata) || pickRandomItem(TYPEWRITER_DEFAULT_FONTS);
  const narrative = typeof fullText === 'string' ? fullText.trim() : '';
  const safeNarrative = narrative || 'The wind caught the page and held its breath.';

  const writing_sequence = [
    { action: 'type', text: safeNarrative, style, delay: 0 },
    { action: 'pause', delay: 1200 }
  ];

  const fade_sequence = [];
  const fadeDelay = Math.floor(14000 / (fadeSteps + 1));
  for (let i = 0; i < fadeSteps; i += 1) {
    const cutoff = Math.round(safeNarrative.length * (1 - (i + 1) / (fadeSteps + 1)));
    fade_sequence.push({ action: 'pause', delay: i === 0 ? 2200 : 1000 });
    fade_sequence.push({
      action: 'fade',
      phase: i + 1,
      to_text: safeNarrative.slice(0, cutoff).trim(),
      style,
      delay: fadeDelay
    });
  }
  fade_sequence.push({ action: 'pause', delay: 900 });
  fade_sequence.push({ action: 'fade', phase: fadeSteps + 1, to_text: '', style, delay: fadeDelay });

  return {
    metadata: style,
    writing_sequence,
    fade_sequence,
    sequence: [...writing_sequence, ...fade_sequence]
  };
}

function buildMockContinuation(message) {
  const words = String(message || '').trim().split(/\s+/).filter(Boolean).length;
  if (words <= 5) return 'while a lantern blinked once in the ravine wind.';
  if (words <= 12) return 'and the trail answered with bells buried under ash.';
  return 'as the pass fell quiet and every footstep sounded borrowed.';
}

app.post('/api/next_film_image', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const background = pickRandomItem(TYPEWRITER_FALLBACK_BACKGROUNDS) || TYPEWRITER_FALLBACK_BACKGROUNDS[0];
    const fontStyle = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
    return res.status(200).json({ image_url: background, ...fontStyle });
  } catch (error) {
    console.error('Error in /api/next_film_image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/shouldGenerateContinuation', async (req, res) => {
  try {
    const goldenRatio = 1.61;
    const minWords = 3;
    const { currentText, latestAddition, latestPauseSeconds, lastGhostwriterWordCount } = req.body || {};

    if (!currentText || !latestAddition || typeof latestPauseSeconds !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const wordCount = latestAddition.trim().split(/\s+/).filter(Boolean).length;
    const goldenThreshold = Math.max(minWords, Math.floor((lastGhostwriterWordCount || 1) / goldenRatio));
    if (wordCount < goldenThreshold) {
      return res.status(200).json({ shouldGenerate: false });
    }

    const totalLength = currentText.trim().split(/\s+/).filter(Boolean).length;
    const basePause = 1.8;
    const scaleFactor = Math.min(3, totalLength * 0.05);
    const additionFactor = Math.min(1.5, wordCount * 0.2);
    const randomness = Math.random() * 0.7 - 0.3;
    const requiredPause = basePause + scaleFactor + additionFactor + randomness;

    return res.status(200).json({ shouldGenerate: latestPauseSeconds > requiredPause });
  } catch (error) {
    console.error('Error in /api/shouldGenerateContinuation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/send_typewriter_text', async (req, res) => {
  try {
    const { sessionId, message } = req.body || {};
    if (!sessionId || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }

    const shouldMock = resolveTypewriterMockMode(req.body);
    if (shouldMock) {
      const mockMetadata = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
      return res.status(200).json(createTypewriterResponse(buildMockContinuation(message), mockMetadata, 3));
    }

    try {
      const prompt = generateTypewriterPrompt(message);
      const aiResponse = await directExternalApiCall(prompt, 2500, undefined, undefined, true, true);
      const continuation = typeof aiResponse?.continuation === 'string' && aiResponse.continuation.trim()
        ? aiResponse.continuation.trim()
        : buildMockContinuation(message);
      const metadata = normalizeTypewriterMetadata(aiResponse?.style || aiResponse?.metadata)
        || pickRandomItem(TYPEWRITER_DEFAULT_FONTS)
        || TYPEWRITER_DEFAULT_FONTS[0];

      return res.status(200).json(createTypewriterResponse(continuation, metadata, 3));
    } catch (aiError) {
      console.error('Error in non-mock /api/send_typewriter_text call. Falling back to mock response:', aiError);
      const fallbackMetadata = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
      return res.status(200).json(createTypewriterResponse(buildMockContinuation(message), fallbackMetadata, 3));
    }
  } catch (error) {
    console.error('Error in /api/send_typewriter_text:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/openapi.json', (req, res) => {
  return res.status(200).json(OPEN_API_SPEC);
});

app.get('/api/docs', (req, res) => {
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Storyteller API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #f3f5f8; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      .topbar { background: #ffffff; border-bottom: 1px solid #d9e0ea; }
      .swagger-ui .scheme-container { background: #ffffff; box-shadow: none; border-bottom: 1px solid #e4e8ef; }
      .swagger-ui .opblock.opblock-post { border-color: #5c8ef3; background: rgba(92, 142, 243, 0.06); }
      .swagger-ui .opblock.opblock-get { border-color: #35a56a; background: rgba(53, 165, 106, 0.06); }
      .swagger-ui .opblock.opblock-put,
      .swagger-ui .opblock.opblock-patch { border-color: #d39a2f; background: rgba(211, 154, 47, 0.06); }
      .swagger-ui .opblock.opblock-delete { border-color: #d9534f; background: rgba(217, 83, 79, 0.06); }
      .swagger-ui .opblock-tag { border-bottom: 1px solid #e4e8ef; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
  return res.status(200).type('html').send(html);
});

const MOCK_STORYTELLER = {
  name: 'The Pass-Archivist of Yuradel',
  fragmentText: `it was getting dark. they have been going for almost 6 hours, no stop. none! she thought to herself. their morning began waking up at one of the empty halls in  the desolate monastery. it was the first nights in many, that they slept under any sort of roof, she much preferred ll the stern, straight pines. the empty halls made her shiver. she was so happy when they went back on the trail, up, climbing up, along the ravine, where the Yuradel was flowing to the Baruuya bay, like a glittering silver line. yes, they climbed up. to the pass. where they would finally reach the plateau. and maybe there the last monastery would still stand, and won't be desolate. where they finally might learn what happened, and what is to be expected.`,
  immediate_ghost_appearance:
    'A faint shimmer condenses into a travel-worn figure: wind-scoured cloak, pale hands stained with ink, edges of the body translucent like smoke in cold air.',
  voice_creation: {
    style: 'measured',
    voice: 'low, smoky, almost whispered',
    age: 'ageless'
  },
  influences: [
    'Ashen Cantos',
    'Voyager Myths'
  ],
  illustration: MOCK_STORYTELLER_ILLUSTRATION_URL
};

// --- State Management ---
// Map<roomId, Set<Response>> for SSE clients (still needed for push)
const roomClients = new Map();

// --- Constants ---
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// --- Helpers ---
function generateRoomId() {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return result;
}

function broadcastToRoom(roomId, eventName, payload) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const data = JSON.stringify({ type: eventName, payload });
  const message = `data: ${data}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

function sanitizeRoomForPublic(room) {
  // room is a Mongoose document. Convert to object.
  const clone = room.toObject ? room.toObject() : JSON.parse(JSON.stringify(room));
  if (clone.brew && clone.brew.vials) {
    clone.brew.vials.forEach(v => {
      delete v.privateIngredient;
    });
  }
  return clone;
}

function getFragmentText(body) {
  return body?.text || body?.userText || body?.fragment || '';
}

function resolveSchemaErrorMessage(error, fallback) {
  if (!error?.details || !Array.isArray(error.details) || error.details.length === 0) {
    return fallback;
  }
  return `${fallback} ${error.details.join('; ')}`;
}

function requireAdmin(req, res, next) {
  const requiredKey = process.env.ADMIN_API_KEY;
  if (!requiredKey) {
    return next();
  }
  const provided = req.get('x-admin-key');
  if (!provided || provided !== requiredKey) {
    return res.status(401).json({ message: 'Unauthorized admin access.' });
  }
  return next();
}

function cloneDefaultQuestConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_QUEST_CONFIG));
}

function normalizeQuestScope(payload = {}, fallback = {}) {
  const sessionId = typeof payload.sessionId === 'string' && payload.sessionId.trim()
    ? payload.sessionId.trim()
    : (typeof fallback.sessionId === 'string' && fallback.sessionId.trim()
      ? fallback.sessionId.trim()
      : DEFAULT_QUEST_SESSION_ID);
  const questId = typeof payload.questId === 'string' && payload.questId.trim()
    ? payload.questId.trim()
    : (typeof fallback.questId === 'string' && fallback.questId.trim()
      ? fallback.questId.trim()
      : DEFAULT_QUEST_ID);
  return { sessionId, questId };
}

function normalizeQuestDirection(direction) {
  if (!direction || typeof direction !== 'object') {
    return null;
  }
  const normalizedDirection = typeof direction.direction === 'string'
    ? direction.direction.trim().toLowerCase()
    : '';
  const targetScreenId = typeof direction.targetScreenId === 'string'
    ? direction.targetScreenId.trim()
    : '';
  if (!normalizedDirection || !targetScreenId) {
    return null;
  }
  const label = typeof direction.label === 'string' && direction.label.trim()
    ? direction.label.trim()
    : normalizedDirection;
  return {
    direction: normalizedDirection,
    label,
    targetScreenId
  };
}

function normalizeQuestScreen(screen) {
  if (!screen || typeof screen !== 'object') {
    return null;
  }
  const id = typeof screen.id === 'string' ? screen.id.trim() : '';
  if (!id) {
    return null;
  }
  const title = typeof screen.title === 'string' && screen.title.trim()
    ? screen.title.trim()
    : id;
  const prompt = typeof screen.prompt === 'string' ? screen.prompt : '';
  const imageUrl = typeof screen.imageUrl === 'string' ? screen.imageUrl.trim() : '';
  const image_prompt = typeof screen.image_prompt === 'string' ? screen.image_prompt.trim() : '';
  const textPromptPlaceholder = typeof screen.textPromptPlaceholder === 'string' && screen.textPromptPlaceholder.trim()
    ? screen.textPromptPlaceholder.trim()
    : 'What do you do?';
  const directions = Array.isArray(screen.directions)
    ? screen.directions.map(normalizeQuestDirection).filter(Boolean)
    : [];
  return {
    id,
    title,
    prompt,
    imageUrl,
    image_prompt,
    textPromptPlaceholder,
    directions
  };
}

function sanitizeQuestConfig(payload, { preserveUpdatedAt = false, fallbackScope = {} } = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const scope = normalizeQuestScope(source, fallbackScope);
  const normalizedScreens = Array.isArray(source.screens)
    ? source.screens.map(normalizeQuestScreen).filter(Boolean)
    : [];

  if (!normalizedScreens.length) {
    const fallback = cloneDefaultQuestConfig();
    return {
      ...fallback,
      sessionId: scope.sessionId,
      questId: scope.questId,
      updatedAt: new Date().toISOString()
    };
  }

  const dedupedScreens = [];
  const seenIds = new Set();
  for (const screen of normalizedScreens) {
    if (seenIds.has(screen.id)) {
      continue;
    }
    seenIds.add(screen.id);
    dedupedScreens.push(screen);
  }

  const validIds = new Set(dedupedScreens.map((screen) => screen.id));
  const screens = dedupedScreens.map((screen) => ({
    ...screen,
    directions: screen.directions.filter((direction) => validIds.has(direction.targetScreenId))
  }));

  const requestedStartScreenId = typeof source.startScreenId === 'string'
    ? source.startScreenId.trim()
    : '';
  const startScreenId = validIds.has(requestedStartScreenId)
    ? requestedStartScreenId
    : screens[0].id;

  const updatedAt = preserveUpdatedAt && typeof source.updatedAt === 'string'
    ? source.updatedAt
    : new Date().toISOString();

  return {
    sessionId: scope.sessionId,
    questId: scope.questId,
    startScreenId,
    screens,
    updatedAt
  };
}

function validateQuestConfigPayload(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object') {
    return ['Payload must be an object.'];
  }

  if (!Array.isArray(payload.screens) || payload.screens.length === 0) {
    errors.push('screens must be a non-empty array.');
    return errors;
  }

  const screenIds = new Set();
  payload.screens.forEach((screen, index) => {
    const id = typeof screen?.id === 'string' ? screen.id.trim() : '';
    if (!id) {
      errors.push(`screens[${index}].id is required.`);
      return;
    }
    if (screenIds.has(id)) {
      errors.push(`Duplicate screen id "${id}".`);
      return;
    }
    screenIds.add(id);

    const imagePrompt = typeof screen?.image_prompt === 'string' ? screen.image_prompt.trim() : '';
    if (!imagePrompt) {
      errors.push(`screens[${index}].image_prompt is required.`);
    }
  });

  payload.screens.forEach((screen, index) => {
    if (!Array.isArray(screen?.directions)) {
      return;
    }
    screen.directions.forEach((direction, directionIndex) => {
      const targetScreenId = typeof direction?.targetScreenId === 'string'
        ? direction.targetScreenId.trim()
        : '';
      if (!targetScreenId) {
        errors.push(`screens[${index}].directions[${directionIndex}].targetScreenId is required.`);
        return;
      }
      if (!screenIds.has(targetScreenId)) {
        errors.push(`screens[${index}].directions[${directionIndex}] points to unknown screen "${targetScreenId}".`);
      }
    });
  });

  const startScreenId = typeof payload.startScreenId === 'string' ? payload.startScreenId.trim() : '';
  if (!startScreenId) {
    errors.push('startScreenId is required.');
  } else if (!screenIds.has(startScreenId)) {
    errors.push(`startScreenId "${startScreenId}" must match one of the screen ids.`);
  }

  return errors;
}

function normalizeTraversalEvent(payload = {}) {
  const toScreenId = typeof payload.toScreenId === 'string' ? payload.toScreenId.trim() : '';
  if (!toScreenId) {
    return null;
  }
  return {
    playerId: typeof payload.playerId === 'string' ? payload.playerId.trim() : '',
    fromScreenId: typeof payload.fromScreenId === 'string' ? payload.fromScreenId.trim() : '',
    toScreenId,
    direction: typeof payload.direction === 'string' ? payload.direction.trim().toLowerCase() : '',
    promptText: typeof payload.promptText === 'string' ? payload.promptText.trim() : '',
    createdAt: new Date()
  };
}

function toQuestResponse(doc, fallbackScope = {}) {
  return sanitizeQuestConfig(
    {
      sessionId: doc?.sessionId,
      questId: doc?.questId,
      startScreenId: doc?.startScreenId,
      screens: doc?.screens || [],
      updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined
    },
    { preserveUpdatedAt: true, fallbackScope }
  );
}

async function ensureQuestConfig(scopePayload = {}) {
  const scope = normalizeQuestScope(scopePayload);
  const existing = await QuestScreenGraph.findOne({
    sessionId: scope.sessionId,
    questId: scope.questId
  }).lean();

  if (existing) {
    return toQuestResponse(existing, scope);
  }

  const seedSource = {
    ...cloneDefaultQuestConfig(),
    sessionId: scope.sessionId,
    questId: scope.questId
  };
  const seed = sanitizeQuestConfig(seedSource, { fallbackScope: scope });
  await QuestScreenGraph.findOneAndUpdate(
    { sessionId: scope.sessionId, questId: scope.questId },
    {
      $set: {
        sessionId: scope.sessionId,
        questId: scope.questId,
        startScreenId: seed.startScreenId,
        screens: seed.screens
      },
      $setOnInsert: { traversalLog: [] }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return seed;
}

async function saveQuestConfig(payload = {}, scopePayload = {}) {
  const scope = normalizeQuestScope(payload, scopePayload);
  const nextConfig = sanitizeQuestConfig(payload, { fallbackScope: scope });

  const saved = await QuestScreenGraph.findOneAndUpdate(
    { sessionId: scope.sessionId, questId: scope.questId },
    {
      $set: {
        sessionId: scope.sessionId,
        questId: scope.questId,
        startScreenId: nextConfig.startScreenId,
        screens: nextConfig.screens
      },
      $setOnInsert: { traversalLog: [] }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return toQuestResponse(saved, scope);
}

async function resetQuestConfig(scopePayload = {}) {
  const scope = normalizeQuestScope(scopePayload);
  const resetSource = {
    ...cloneDefaultQuestConfig(),
    sessionId: scope.sessionId,
    questId: scope.questId
  };
  const resetConfig = sanitizeQuestConfig(resetSource, { fallbackScope: scope });
  const saved = await QuestScreenGraph.findOneAndUpdate(
    { sessionId: scope.sessionId, questId: scope.questId },
    {
      $set: {
        sessionId: scope.sessionId,
        questId: scope.questId,
        startScreenId: resetConfig.startScreenId,
        screens: resetConfig.screens,
        traversalLog: []
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return toQuestResponse(saved, scope);
}

async function appendQuestTraversalEvent(payload = {}) {
  const scope = normalizeQuestScope(payload);
  await ensureQuestConfig(scope);
  const event = normalizeTraversalEvent(payload);
  if (!event) {
    return null;
  }

  const updated = await QuestScreenGraph.findOneAndUpdate(
    { sessionId: scope.sessionId, questId: scope.questId },
    {
      $push: {
        traversalLog: {
          $each: [event],
          $slice: -400
        }
      }
    },
    { new: true }
  ).lean();

  return {
    sessionId: scope.sessionId,
    questId: scope.questId,
    event,
    traversalCount: Array.isArray(updated?.traversalLog) ? updated.traversalLog.length : 0
  };
}

async function getQuestTraversal(scopePayload = {}) {
  const scope = normalizeQuestScope(scopePayload);
  const doc = await QuestScreenGraph.findOne({
    sessionId: scope.sessionId,
    questId: scope.questId
  }).lean();

  return {
    sessionId: scope.sessionId,
    questId: scope.questId,
    traversal: Array.isArray(doc?.traversalLog) ? doc.traversalLog : []
  };
}


function buildLastMissionSummary(storyteller) {
  const missions = Array.isArray(storyteller?.missions) ? storyteller.missions : [];
  if (missions.length === 0) {
    return null;
  }
  const last = missions[missions.length - 1];
  return {
    outcome: last.outcome,
    message: last.message,
    entityExternalId: last.entityExternalId,
    createdAt: last.createdAt
  };
}

function normalizeStorytellerCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return 3;
  }
  return Math.min(Math.max(1, Math.floor(count)), 10);
}

function buildMockStorytellers(count, fragmentText) {
  const baseStoryteller = {
    ...MOCK_STORYTELLER,
    fragmentText: MOCK_STORYTELLER.fragmentText || fragmentText
  };

  const fallbackStorytellers = Array.from({ length: Math.max(0, count - 1) }).map((_, idx) => ({
    name: `Mock Storyteller ${idx + 1}`,
    immediate_ghost_appearance: 'A soft shimmer resolves into a figure with ink-stained hands.',
    typewriter_key: {
      symbol: 'ink moth',
      description: 'A tarnished brass key with a faint glow.'
    },
    influences: ['Ashen Cantos', 'Voyager Myths'],
    known_universes: ['The Riven Orrery'],
    level: 5 + idx,
    voice_creation: {
      voice: 'neutral',
      age: 'ageless',
      style: 'measured and smoky'
    },
    fragmentText
  }));

  return [baseStoryteller, ...fallbackStorytellers].slice(0, count);
}

function buildMockWorld(seedText, name) {
  return {
    name: name || 'The Shale Meridian',
    summary: 'A salt-crusted inland sea holds the last trade routes between cliffside cities and drifting shrine-islands.',
    tone: 'weathered, luminous, quietly political',
    pillars: [
      'scarcity-driven diplomacy',
      'ancient machines waking with the tides',
      'ritual navigation through living storms'
    ],
    themes: [
      'oaths and debt',
      'memory as currency',
      'survival through fragile alliances'
    ],
    palette: ['ash white', 'oxidized copper', 'glacier blue']
  };
}

function buildMockElements(type, count) {
  const templates = {
    faction: [
      {
        name: 'The Tide Ledger',
        description: 'A merchant synod that writes contracts into barnacle-shell tablets.',
        tags: ['trade', 'ritual', 'law'],
        traits: ['meticulous', 'soft-spoken', 'ruthless on debt'],
        hooks: ['They need an oathbreaker retrieved from a storm-tower.']
      },
      {
        name: 'Basilisk Pilgrims',
        description: 'Nomadic archivists who follow the footsteps of a petrified sea-god.',
        tags: ['nomads', 'faith', 'relics'],
        traits: ['patient', 'cryptic', 'unyielding'],
        hooks: ['They offer a relic if you translate a forbidden tide-script.']
      }
    ],
    location: [
      {
        name: 'Redwake Steps',
        description: 'Terraced docks carved into a canyon, glowing with bioluminescent kelp.',
        tags: ['port', 'ritual', 'market'],
        traits: ['crowded', 'humid', 'whispering'],
        hooks: ['A storm-gate opens here for one night each season.']
      },
      {
        name: 'The Glass Brine',
        description: 'A mirror-slick salt flat where ancient machines rise at dusk.',
        tags: ['ruins', 'mystery', 'hazard'],
        traits: ['silent', 'reflective', 'electric'],
        hooks: ['A lost convoy is frozen inside the salt.']
      }
    ],
    rumor: [
      {
        name: 'The Ninth Tide',
        description: 'A storm cycle returns that erases written contracts from stone.',
        tags: ['omen', 'storms'],
        traits: ['urgent', 'contested'],
        hooks: ['Find the missing contract before the Ninth Tide hits.']
      },
      {
        name: 'Salt-Sworn Ghosts',
        description: 'Sailors report a choir singing coordinates from beneath the sea.',
        tags: ['ghosts', 'navigation'],
        traits: ['haunting', 'specific'],
        hooks: ['Follow the coordinates to a buried vault.']
      }
    ],
    lore: [
      {
        name: 'The First Beacon Pact',
        description: 'The cliff cities keep a living beacon fueled by the last emberwood grove.',
        tags: ['history', 'pact'],
        traits: ['solemn', 'foundational'],
        hooks: ['The grove is dying; who broke the pact?']
      },
      {
        name: 'The Brine Alphabet',
        description: 'A script etched into saltglass that only appears at low tide.',
        tags: ['language', 'mystery'],
        traits: ['fragile', 'cyclical'],
        hooks: ['Decode a message before the tide returns.']
      }
    ]
  };

  const source = templates[type] || [];
  const results = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    results.push(source[i % source.length]);
  }
  return results;
}

async function findWorldForPlayer(sessionId, playerId, worldId) {
  return World.findOne({ worldId, sessionId, playerId });
}

function normalizeArenaPayload(arena) {
  const payload = arena && typeof arena === 'object' ? arena : {};
  return {
    ...payload,
    entities: Array.isArray(payload.entities) ? payload.entities : [],
    storytellers: Array.isArray(payload.storytellers) ? payload.storytellers : []
  };
}

async function findEntityById(sessionId, playerId, entityId) {
  if (!entityId) {
    return null;
  }

  const byExternalId = await NarrativeEntity.findOne({
    session_id: sessionId,
    playerId,
    externalId: String(entityId)
  });
  if (byExternalId) {
    return byExternalId;
  }

  return NarrativeEntity.findOne({ _id: entityId, session_id: sessionId, playerId });
}

// --- Admin LLM Route Config ---
app.get('/api/admin/llm-config', requireAdmin, async (req, res) => {
  try {
    const configs = await listRouteConfigs();
    return res.status(200).json(configs);
  } catch (error) {
    console.error('Error in GET /api/admin/llm-config:', error);
    return res.status(500).json({ message: 'Server error while listing LLM route configs.' });
  }
});

app.get('/api/admin/llm-config/:routeKey', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const config = await getRouteConfig(routeKey);
    return res.status(200).json(config);
  } catch (error) {
    if (error.code === 'INVALID_ROUTE_KEY') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in GET /api/admin/llm-config/:routeKey:', error);
    return res.status(500).json({ message: 'Server error while fetching LLM route config.' });
  }
});

app.put('/api/admin/llm-config/:routeKey/prompt', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const { promptTemplate, updatedBy } = req.body || {};
    const config = await updateRoutePrompt(routeKey, promptTemplate, updatedBy || 'admin');
    return res.status(200).json(config);
  } catch (error) {
    if (error.code === 'INVALID_ROUTE_KEY' || error.code === 'INVALID_PROMPT_TEMPLATE') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in PUT /api/admin/llm-config/:routeKey/prompt:', error);
    return res.status(500).json({ message: 'Server error while updating prompt template.' });
  }
});

app.put('/api/admin/llm-config/:routeKey/schema', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const { responseSchema, updatedBy } = req.body || {};
    const config = await updateRouteSchema(routeKey, responseSchema, updatedBy || 'admin');
    return res.status(200).json(config);
  } catch (error) {
    if (error.code === 'INVALID_ROUTE_KEY' || error.code === 'INVALID_RESPONSE_SCHEMA') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in PUT /api/admin/llm-config/:routeKey/schema:', error);
    return res.status(500).json({ message: 'Server error while updating response schema.' });
  }
});

app.post('/api/admin/llm-config/:routeKey/reset', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const config = await resetRouteConfig(routeKey);
    return res.status(200).json(config);
  } catch (error) {
    if (error.code === 'INVALID_ROUTE_KEY') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in POST /api/admin/llm-config/:routeKey/reset:', error);
    return res.status(500).json({ message: 'Server error while resetting route config.' });
  }
});

// --- Quest Screen Routes ---
app.get('/api/quest/screens', async (req, res) => {
  try {
    const scope = normalizeQuestScope(req.query || {});
    const config = await ensureQuestConfig(scope);
    return res.status(200).json(config);
  } catch (error) {
    console.error('Error in GET /api/quest/screens:', error);
    return res.status(500).json({ message: 'Server error while loading quest screens.' });
  }
});

app.get('/api/quest/screens/:screenId', async (req, res) => {
  try {
    const { screenId } = req.params;
    const scope = normalizeQuestScope(req.query || {});
    const config = await ensureQuestConfig(scope);
    const screen = config.screens.find((item) => item.id === screenId);
    if (!screen) {
      return res.status(404).json({ message: 'Quest screen not found.' });
    }
    return res.status(200).json({
      sessionId: config.sessionId,
      questId: config.questId,
      screen,
      startScreenId: config.startScreenId,
      updatedAt: config.updatedAt
    });
  } catch (error) {
    console.error('Error in GET /api/quest/screens/:screenId:', error);
    return res.status(500).json({ message: 'Server error while loading quest screen.' });
  }
});

app.put('/api/admin/quest/screens', requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const validationErrors = validateQuestConfigPayload(payload);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Invalid quest screen payload.',
        errors: validationErrors
      });
    }

    const saved = await saveQuestConfig(payload, payload);
    return res.status(200).json(saved);
  } catch (error) {
    console.error('Error in PUT /api/admin/quest/screens:', error);
    return res.status(500).json({ message: 'Server error while saving quest screens.' });
  }
});

app.post('/api/admin/quest/screens/reset', requireAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const saved = await resetQuestConfig(payload);
    return res.status(200).json(saved);
  } catch (error) {
    console.error('Error in POST /api/admin/quest/screens/reset:', error);
    return res.status(500).json({ message: 'Server error while resetting quest screens.' });
  }
});

app.post('/api/quest/traversal', async (req, res) => {
  try {
    const payload = req.body || {};
    const eventResult = await appendQuestTraversalEvent(payload);
    if (!eventResult) {
      return res.status(400).json({ message: 'Missing required parameter: toScreenId.' });
    }
    return res.status(201).json(eventResult);
  } catch (error) {
    console.error('Error in POST /api/quest/traversal:', error);
    return res.status(500).json({ message: 'Server error while saving traversal event.' });
  }
});

app.get('/api/quest/traversal', async (req, res) => {
  try {
    const traversalPayload = await getQuestTraversal(req.query || {});
    return res.status(200).json(traversalPayload);
  } catch (error) {
    console.error('Error in GET /api/quest/traversal:', error);
    return res.status(500).json({ message: 'Server error while loading traversal events.' });
  }
});

// Memory generation/persistence routes are split into a dedicated router.
app.use('/api', memoriesRouter);

// --- Routes ---

// Session Players
app.get('/api/sessions/:sessionId/players', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const players = await SessionPlayer.find({ sessionId }).sort({ createdAt: 1 }).lean();
    const responsePlayers = players.map((player) => ({
      id: player.playerId,
      playerId: player.playerId,
      playerName: player.playerName
    }));

    return res.status(200).json({
      count: responsePlayers.length,
      players: responsePlayers
    });
  } catch (error) {
    console.error('Error in /api/sessions/:sessionId/players:', error);
    return res.status(500).json({ message: 'Server error during session player listing.' });
  }
});

app.post('/api/sessions/:sessionId/players', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { playerName } = req.body || {};

    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerName.' });
    }

    const playerId = randomUUID();
    const newPlayer = new SessionPlayer({ sessionId, playerId, playerName });
    await newPlayer.save();

    return res.status(201).json({ playerId, id: playerId });
  } catch (error) {
    console.error('Error in /api/sessions/:sessionId/players (POST):', error);
    return res.status(500).json({ message: 'Server error during session player registration.' });
  }
});

// Session Arena
app.get('/api/sessions/:sessionId/arena', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { playerId } = req.query;

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const arenaDoc = await Arena.findOne({ sessionId }).lean();
    const arena = normalizeArenaPayload(arenaDoc?.arena);

    return res.status(200).json({
      sessionId,
      playerId,
      arena,
      lastUpdatedBy: arenaDoc?.lastUpdatedBy,
      updatedAt: arenaDoc?.updatedAt
    });
  } catch (error) {
    console.error('Error in /api/sessions/:sessionId/arena (GET):', error);
    return res.status(500).json({ message: 'Server error during arena fetch.' });
  }
});

app.post('/api/sessions/:sessionId/arena', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { playerId } = req.body || {};

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const body = req.body || {};
    const arenaPayload = body.arena || { entities: body.entities, storytellers: body.storytellers };
    const arena = normalizeArenaPayload(arenaPayload);

    const updatedArena = await Arena.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          arena,
          lastUpdatedBy: playerId
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      sessionId,
      playerId,
      arena: normalizeArenaPayload(updatedArena?.arena),
      lastUpdatedBy: updatedArena?.lastUpdatedBy,
      updatedAt: updatedArena?.updatedAt
    });
  } catch (error) {
    console.error('Error in /api/sessions/:sessionId/arena (POST):', error);
    return res.status(500).json({ message: 'Server error during arena update.' });
  }
});

// Worldbuilding Routes
app.post('/api/worlds', async (req, res) => {
  try {
    const { sessionId, playerId, seedText, name, debug, mock, mock_api_calls, mocked_api_calls } = req.body || {};

    if (!sessionId || !playerId || !seedText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, or seedText.' });
    }

    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    let worldData;

    if (shouldMock) {
      worldData = buildMockWorld(seedText, name);
    } else {
      const routeConfig = await getRouteConfig('worlds_create');
      const prompt = renderPrompt(routeConfig.promptTemplate, {
        seedText,
        name: name || ''
      });
      worldData = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        1200,
        undefined,
        undefined,
        true,
        true
      );
    }

    if (!worldData || typeof worldData !== 'object') {
      return res.status(502).json({ message: 'World generation failed.' });
    }

    await validatePayloadForRoute('worlds_create', worldData);

    const world = await World.create({
      worldId: randomUUID(),
      sessionId,
      playerId,
      seedText,
      name: worldData.name || name || 'Untitled World',
      summary: worldData.summary || '',
      tone: worldData.tone || '',
      pillars: Array.isArray(worldData.pillars) ? worldData.pillars : [],
      themes: Array.isArray(worldData.themes) ? worldData.themes : [],
      palette: Array.isArray(worldData.palette) ? worldData.palette : []
    });

    return res.status(201).json({ world, mocked: shouldMock });
  } catch (error) {
    if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolveSchemaErrorMessage(error, 'World generation schema validation failed.')
      });
    }
    console.error('Error in /api/worlds:', error);
    return res.status(500).json({ message: 'Server error during world creation.' });
  }
});

app.get('/api/worlds', async (req, res) => {
  try {
    const { sessionId, playerId } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
    }

    const worlds = await World.find({ sessionId, playerId }).sort({ createdAt: 1 });
    return res.status(200).json({ sessionId, worlds });
  } catch (error) {
    console.error('Error in /api/worlds (GET):', error);
    return res.status(500).json({ message: 'Server error during world listing.' });
  }
});

app.get('/api/worlds/:worldId', async (req, res) => {
  try {
    const { worldId } = req.params;
    const { sessionId, playerId } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
    }

    const world = await findWorldForPlayer(sessionId, playerId, worldId);
    if (!world) {
      return res.status(404).json({ message: 'World not found.' });
    }

    return res.status(200).json({ world });
  } catch (error) {
    console.error('Error in /api/worlds/:worldId (GET):', error);
    return res.status(500).json({ message: 'Server error during world fetch.' });
  }
});

app.get('/api/worlds/:worldId/state', async (req, res) => {
  try {
    const { worldId } = req.params;
    const { sessionId, playerId } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
    }

    const world = await findWorldForPlayer(sessionId, playerId, worldId);
    if (!world) {
      return res.status(404).json({ message: 'World not found.' });
    }

    const elements = await WorldElement.find({ worldId, sessionId, playerId }).sort({ createdAt: 1 });
    const grouped = elements.reduce((acc, element) => {
      acc[element.type] = acc[element.type] || [];
      acc[element.type].push(element);
      return acc;
    }, {});

    return res.status(200).json({ world, elements: grouped });
  } catch (error) {
    console.error('Error in /api/worlds/:worldId/state:', error);
    return res.status(500).json({ message: 'Server error during world state fetch.' });
  }
});

async function handleWorldElements(req, res, type) {
  try {
    const { worldId } = req.params;
    const { sessionId, playerId, count, seedText, debug, mock, mock_api_calls, mocked_api_calls } = req.body || {};

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
    }

    const world = await findWorldForPlayer(sessionId, playerId, worldId);
    if (!world) {
      return res.status(404).json({ message: 'World not found.' });
    }

    const requestedCount = Number.isFinite(Number(count)) ? Math.max(1, Math.min(6, Number(count))) : 3;
    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    let elementsData;

    if (shouldMock) {
      elementsData = buildMockElements(type, requestedCount);
    } else {
      const routeConfig = await getRouteConfig('worlds_elements');
      const prompt = renderPrompt(routeConfig.promptTemplate, {
        worldName: world.name || '',
        worldTone: world.tone || '',
        worldSummary: world.summary || '',
        seedText: seedText || world.seedText || '',
        elementType: type,
        count: requestedCount
      });
      const result = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        1400,
        undefined,
        undefined,
        true,
        true
      );
      elementsData = Array.isArray(result) ? result : result?.elements;
    }

    if (!Array.isArray(elementsData) || elementsData.length === 0) {
      return res.status(502).json({ message: 'World element generation failed.' });
    }

    await validatePayloadForRoute('worlds_elements', { elements: elementsData });

    const payloads = elementsData.slice(0, requestedCount).map((element) => ({
      worldId,
      sessionId,
      playerId,
      type,
      name: element?.name || `${type} ${randomUUID().slice(0, 4)}`,
      description: element?.description || '',
      tags: Array.isArray(element?.tags) ? element.tags : [],
      traits: Array.isArray(element?.traits) ? element.traits : [],
      hooks: Array.isArray(element?.hooks) ? element.hooks : []
    }));

    const saved = await WorldElement.insertMany(payloads);

    return res.status(201).json({ worldId, type, elements: saved, mocked: shouldMock });
  } catch (error) {
    if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolveSchemaErrorMessage(error, 'World elements schema validation failed.')
      });
    }
    console.error(`Error in /api/worlds/:worldId/${type}:`, error);
    return res.status(500).json({ message: 'Server error during world element generation.' });
  }
}

app.post('/api/worlds/:worldId/factions', (req, res) => handleWorldElements(req, res, 'faction'));
app.post('/api/worlds/:worldId/locations', (req, res) => handleWorldElements(req, res, 'location'));
app.post('/api/worlds/:worldId/rumors', (req, res) => handleWorldElements(req, res, 'rumor'));
app.post('/api/worlds/:worldId/lore', (req, res) => handleWorldElements(req, res, 'lore'));

// List Storytellers
app.get('/api/storytellers', async (req, res) => {
  try {
    const { sessionId, playerId } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const storytellers = await Storyteller.find({ session_id: sessionId, playerId }).sort({ createdAt: 1 });
    const response = storytellers.map((storyteller) => ({
      id: storyteller._id,
      name: storyteller.name,
      status: storyteller.status,
      level: storyteller.level,
      lastMission: buildLastMissionSummary(storyteller)
    }));

    return res.status(200).json({ sessionId, storytellers: response });
  } catch (error) {
    console.error('Error in /api/storytellers:', error);
    return res.status(500).json({ message: 'Server error during storyteller listing.' });
  }
});

// Get Storyteller by ID
app.get('/api/storytellers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, playerId } = req.query;

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }
    const storyteller = await Storyteller.findById(id);
    if (!storyteller) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }
    if (storyteller.session_id !== sessionId || storyteller.playerId !== playerId) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }

    return res.status(200).json({ storyteller });
  } catch (error) {
    console.error('Error in /api/storytellers/:id:', error);
    return res.status(500).json({ message: 'Server error during storyteller fetch.' });
  }
});

// List Entities
app.get('/api/entities', async (req, res) => {
  try {
    const { sessionId, playerId, mainEntityId, isSubEntity } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const query = { session_id: sessionId, playerId };
    if (mainEntityId) {
      query.mainEntityId = mainEntityId;
    }
    if (isSubEntity !== undefined) {
      query.isSubEntity = String(isSubEntity) === 'true';
    }

    const entities = await NarrativeEntity.find(query).sort({ createdAt: 1 });
    return res.status(200).json({ sessionId, entities });
  } catch (error) {
    console.error('Error in /api/entities:', error);
    return res.status(500).json({ message: 'Server error during entity listing.' });
  }
});

// Refresh Entity (Generate Sub-Entities)
app.post('/api/entities/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { sessionId, playerId, note, debug, mock, mock_api_calls, mocked_api_calls } = body;

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const entity = await findEntityById(sessionId, playerId, id);
    if (!entity || entity.session_id !== sessionId || entity.playerId !== playerId) {
      return res.status(404).json({ message: 'Entity not found.' });
    }

    const promptText = [
      `Expand sub-entities related to "${entity.name}".`,
      entity.description ? `Description: ${entity.description}` : '',
      entity.lore ? `Lore: ${entity.lore}` : '',
      note ? `GM note: ${note}` : ''
    ].filter(Boolean).join('\n');

    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    const subEntityResult = await textToEntityFromText({
      sessionId,
      playerId,
      text: promptText,
      includeCards: false,
      debug: shouldMock,
      mainEntityId: entity.externalId || String(entity._id),
      isSubEntity: true
    });

    const subEntityExternalIds = (subEntityResult?.entities || [])
      .map((subEntity) => subEntity.externalId || subEntity.id)
      .filter(Boolean)
      .map((value) => String(value));

    const savedSubEntities = subEntityExternalIds.length
      ? await NarrativeEntity.find({
        session_id: sessionId,
        playerId,
        externalId: { $in: subEntityExternalIds },
        mainEntityId: entity.externalId || String(entity._id)
      })
      : [];

    return res.status(200).json({
      sessionId,
      entity,
      subEntities: savedSubEntities,
      mocked: shouldMock
    });
  } catch (error) {
    console.error('Error in /api/entities/:id/refresh:', error);
    return res.status(500).json({ message: 'Server error during entity refresh.' });
  }
});

// Text to Entity
app.post('/api/textToEntity', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      sessionId,
      playerId,
      text,
      userText,
      fragment,
      includeCards,
      includeFront,
      includeBack,
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = body;

    const fragmentText = text || userText || fragment;

    if (!sessionId || !playerId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, or text.' });
    }

    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    const options = {
      sessionId,
      playerId,
      text: fragmentText,
      includeCards: includeCards === undefined ? false : Boolean(includeCards),
      includeFront: includeFront === undefined ? true : Boolean(includeFront),
      includeBack: includeBack === undefined ? true : Boolean(includeBack),
      debug: shouldMock
    };

    const result = await textToEntityFromText(options);

    const response = {
      sessionId,
      entities: result.entities,
      mocked: result.mocked
    };

    if (options.includeCards) {
      response.cards = result.cards || [];
      response.cardOptions = {
        includeFront: options.includeFront,
        includeBack: options.includeBack
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error in /api/textToEntity:', error);
    res.status(500).json({ message: 'Server error during text-to-entity generation.' });
  }
});

// Text to Storyteller
app.post('/api/textToStoryteller', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      sessionId,
      playerId,
      count,
      numberOfStorytellers,
      generateKeyImages,
      mockImage,
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = body;
    const fragmentText = getFragmentText(body);

    if (!sessionId || !playerId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, or text.' });
    }

    const storytellerCount = normalizeStorytellerCount(count ?? numberOfStorytellers);
    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    let storytellerDataArray;

    if (shouldMock) {
      storytellerDataArray = buildMockStorytellers(storytellerCount, fragmentText);
    } else {
      const routeConfig = await getRouteConfig('text_to_storyteller');
      const prompt = renderPrompt(routeConfig.promptTemplate, {
        fragmentText,
        storytellerCount
      });
      storytellerDataArray = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        2500,
        undefined,
        undefined,
        true,
        true
      );
    }

    const normalizedStorytellers = Array.isArray(storytellerDataArray)
      ? storytellerDataArray
      : Array.isArray(storytellerDataArray?.storytellers)
        ? storytellerDataArray.storytellers
        : [];

    if (!Array.isArray(normalizedStorytellers) || normalizedStorytellers.length === 0) {
      return res.status(502).json({ message: 'Storyteller generation failed.' });
    }

    await validatePayloadForRoute('text_to_storyteller', { storytellers: normalizedStorytellers });

    storytellerDataArray = normalizedStorytellers;

    const savedStorytellers = [];
    const keyImages = [];

    for (const storytellerData of storytellerDataArray) {
      if (!storytellerData || typeof storytellerData !== 'object') {
        continue;
      }

      const payload = {
        session_id: sessionId,
        sessionId,
        playerId,
        fragmentText,
        ...storytellerData
      };
      if (shouldMock && !payload.illustration) {
        payload.illustration = MOCK_STORYTELLER_ILLUSTRATION_URL;
      }

      const savedStoryteller = await Storyteller.findOneAndUpdate(
        { session_id: sessionId, playerId, name: payload.name },
        payload,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      savedStorytellers.push(savedStoryteller);

      if (!shouldMock && generateKeyImages && payload.typewriter_key?.symbol) {
        const keyImageResult = await createStoryTellerKey(
          payload.typewriter_key,
          sessionId,
          payload.name,
          Boolean(mockImage)
        );
        if (keyImageResult?.localPath) {
          const localUrl = `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_keys/${path.basename(keyImageResult.localPath)}`;
          keyImages.push({
            storytellerId: savedStoryteller._id,
            name: savedStoryteller.name,
            imageUrl: keyImageResult.imageUrl || localUrl,
            localUrl,
            localPath: keyImageResult.localPath
          });
        }
      }

      if (!shouldMock) {
        // Generate Illustration
        const illustrationResult = await createStorytellerIllustration(
          payload,
          sessionId,
          Boolean(mockImage)
        );

        if (illustrationResult?.localPath) {
          const illustrationUrl = `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_illustrations/${path.basename(illustrationResult.localPath)}`;

          await Storyteller.findByIdAndUpdate(savedStoryteller._id, {
            illustration: illustrationUrl
          });

          // Update the object in the list for response
          savedStoryteller.illustration = illustrationUrl;
        }
      }
    }

    res.status(200).json({
      sessionId,
      storytellers: savedStorytellers,
      keyImages,
      count: savedStorytellers.length
    });
  } catch (err) {
    if (err.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolveSchemaErrorMessage(err, 'Storyteller generation schema validation failed.')
      });
    }
    console.error('Error in /api/textToStoryteller:', err);
    res.status(500).json({ message: 'Server error during storyteller generation.' });
  }
});

// Send Storyteller to Entity
app.post('/api/sendStorytellerToEntity', async (req, res) => {
  let storytellerDocIdForReset = null;
  let missionActivated = false;
  try {
    const body = req.body || {};
    const {
      sessionId,
      playerId,
      entityId,
      storytellerId,
      storytellingPoints,
      message,
      duration,
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = body;

    if (!sessionId || !playerId || !entityId || !storytellerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, entityId, storytellerId.' });
    }
    if (!Number.isInteger(storytellingPoints)) {
      return res.status(400).json({ message: 'Missing or invalid storytellingPoints (int required).' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid message (string required).' });
    }

    const entity = await findEntityById(sessionId, playerId, entityId);
    if (!entity || entity.session_id !== sessionId || entity.playerId !== playerId) {
      return res.status(404).json({ message: 'Entity not found.' });
    }

    let storyteller = await Storyteller.findById(storytellerId);
    if (!storyteller) {
      storyteller = await Storyteller.findOne({ name: storytellerId, session_id: sessionId, playerId });
    }
    if (!storyteller || storyteller.session_id !== sessionId || storyteller.playerId !== playerId) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }
    storytellerDocIdForReset = storyteller._id;

    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    const durationDays = Number.isFinite(Number(duration)) ? Number(duration) : undefined;

    await Storyteller.findByIdAndUpdate(
      storyteller._id,
      { $set: { status: 'in_mission' } }
    );
    missionActivated = true;

    let missionResult;
    if (shouldMock) {
      missionResult = {
        outcome: 'success',
        userText: `The mission concludes. ${storyteller.name} returns with a focused insight about ${entity.name}.`,
        gmNote: `Lean into the sensory details of ${entity.name}; highlight a single, striking detail that hints at hidden layers.`,
        subEntitySeed: `New sub-entities emerge around ${entity.name}: a revealing clue, a minor witness, and a tangible relic tied to the mission.`
      };
    } else {
      const routeConfig = await getRouteConfig('storyteller_mission');
      const prompt = renderPrompt(routeConfig.promptTemplate, {
        storytellerName: storyteller?.name || '',
        entityName: entity?.name || '',
        entityType: entity?.type || entity?.ner_type || 'ENTITY',
        entitySubtype: entity?.subtype || entity?.ner_subtype || 'General',
        entityDescription: entity?.description || '',
        entityLore: entity?.lore || '',
        storytellingPoints,
        message,
        durationDays: Number.isFinite(durationDays) ? `${durationDays} days` : 'unknown'
      });
      missionResult = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        1200,
        undefined,
        undefined,
        true,
        true
      );
    }

    await validatePayloadForRoute('storyteller_mission', missionResult);

    const outcome = missionResult?.outcome;
    const userText = missionResult?.userText || '';
    const gmNote = missionResult?.gmNote || '';
    const subEntitySeed = missionResult?.subEntitySeed || `Sub-entities tied to ${entity.name} and ${message}.`;

    const subEntityResult = await textToEntityFromText({
      sessionId,
      playerId,
      text: subEntitySeed,
      includeCards: false,
      debug: shouldMock,
      mainEntityId: entity.externalId || String(entity._id),
      isSubEntity: true
    });

    const subEntities = Array.isArray(subEntityResult?.entities) ? subEntityResult.entities : [];
    const subEntityExternalIds = subEntities
      .map((subEntity) => subEntity.externalId || subEntity.id)
      .filter(Boolean)
      .map((id) => String(id));
    const savedSubEntities = subEntityExternalIds.length
      ? await NarrativeEntity.find({
        session_id: sessionId,
        playerId,
        externalId: { $in: subEntityExternalIds },
        mainEntityId: entity.externalId || String(entity._id)
      })
      : [];
    const missionRecord = {
      entityId: entity._id,
      entityExternalId: entity.externalId || String(entity._id),
      playerId,
      storytellingPoints,
      message,
      durationDays,
      outcome: outcome || 'pending',
      userText: userText || undefined,
      gmNote: gmNote || undefined,
      subEntityExternalIds: savedSubEntities.map((subEntity) => subEntity.externalId).filter(Boolean)
    };

    await Storyteller.findByIdAndUpdate(
      storyteller._id,
      {
        $set: { status: 'active' },
        $push: { missions: missionRecord }
      },
      { new: true }
    );
    missionActivated = false;

    return res.status(200).json({
      sessionId,
      storytellerId: storyteller._id,
      outcome: missionRecord.outcome,
      userText: userText || undefined,
      gmNote: gmNote || undefined,
      entity,
      subEntities: savedSubEntities
    });
  } catch (err) {
    if (missionActivated && storytellerDocIdForReset) {
      try {
        await Storyteller.findByIdAndUpdate(storytellerDocIdForReset, { $set: { status: 'active' } });
      } catch (resetError) {
        console.error('Failed to restore storyteller status after mission error:', resetError);
      }
    }
    if (err.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolveSchemaErrorMessage(err, 'Storyteller mission schema validation failed.')
      });
    }
    console.error('Error in /api/sendStorytellerToEntity:', err);
    return res.status(500).json({ message: 'Server error during storyteller mission.' });
  }
});



// --- Arena Relationships Routes ---

async function handleArenaRelationship(req, res, { forceDryRun = false } = {}) {
  try {
    const {
      sessionId,
      playerId,
      arenaId,
      source,
      targets,
      relationship,
      options,
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = req.body || {};

    const relationshipPayload = {
      ...(relationship || {}),
      fastValidate: Boolean(relationship?.fastValidate || options?.fastValidate)
    };

    // Validate required parameters
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
    }
    if (!source || (!source.cardId && !source.entityId)) {
      return res.status(400).json({ message: 'Missing required parameter: source (cardId or entityId).' });
    }
    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ message: 'Missing required parameter: targets array.' });
    }
    if (!relationshipPayload.surfaceText) {
      return res.status(400).json({ message: 'Missing required parameter: relationship.surfaceText.' });
    }

    const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
    const dryRun = forceDryRun || Boolean(options?.dryRun);

    // Load Arena doc
    const arenaDoc = await Arena.findOne({ sessionId });
    const arena = arenaDoc?.arena || { entities: [], storytellers: [], edges: [], scores: {} };

    // Normalize predicate
    const predicate = relationshipPayload.predicateHint
      ? normalizePredicate(relationshipPayload.predicateHint)
      : normalizePredicate(relationshipPayload.surfaceText);

    // Collect all entity IDs involved
    const involvedEntityIds = [
      source.cardId || source.entityId,
      ...targets.map(t => t.cardId || t.entityId)
    ].filter(Boolean);

    // Get existing edges for context
    const existingEdges = getExistingEdgesForEntities(arena, involvedEntityIds);

    // Query Neo4j for cluster context (graceful fallback if Neo4j unavailable)
    let clusterContext = null;
    let cluster = null;
    try {
      cluster = await getClusterForEntities(sessionId, involvedEntityIds);
      clusterContext = buildClusterContext(cluster);
    } catch (neo4jError) {
      console.warn('Neo4j cluster query failed (continuing without cluster context):', neo4jError.message);
    }

    // Check for duplicate edge
    const fromId = source.cardId || source.entityId;
    for (const target of targets) {
      const toId = target.cardId || target.entityId;
      const duplicate = checkDuplicateEdge(existingEdges, fromId, toId, predicate);
      if (duplicate) {
        return res.status(409).json({
          message: 'Duplicate edge already exists.',
          existingEdge: duplicate
        });
      }
    }

    // Evaluate relationship (with cluster context)
    const evaluation = await evaluateRelationship(
      source,
      targets,
      relationshipPayload,
      existingEdges,
      shouldMock,
      clusterContext
    );

    // Handle rejection
    if (evaluation.verdict !== 'accepted') {
      return res.status(200).json({
        verdict: 'rejected',
        quality: evaluation.quality,
        suggestions: evaluation.suggestions || [],
        fastValidate: evaluation.fastValidate
      });
    }

    // If dryRun, return without committing
    if (dryRun) {
      return res.status(200).json({
        verdict: 'accepted',
        dryRun: true,
        quality: evaluation.quality,
        predicate,
        message: 'Relationship would be accepted (dry run, not committed).',
        fastValidate: evaluation.fastValidate
      });
    }

    // Commit edges
    const createdEdges = [];
    const edgesArray = Array.isArray(arena.edges) ? arena.edges : [];

    for (const target of targets) {
      const edge = {
        edgeId: `edge_${randomUUID().slice(0, 8)}`,
        fromCardId: source.cardId || source.entityId,
        toCardId: target.cardId || target.entityId,
        surfaceText: relationshipPayload.surfaceText,
        predicate,
        direction: relationshipPayload.direction || 'source_to_target',
        quality: evaluation.quality,
        createdBy: playerId,
        createdAt: new Date().toISOString()
      };
      edgesArray.push(edge);
      createdEdges.push(edge);
    }

    // Calculate and update points
    const pointsAwarded = calculatePoints(evaluation.quality.score);
    const scores = arena.scores || {};
    const previousTotal = scores[playerId] || 0;
    scores[playerId] = previousTotal + pointsAwarded;

    // Save Arena to MongoDB
    await Arena.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          'arena.edges': edgesArray,
          'arena.scores': scores,
          lastUpdatedBy: playerId
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Sync to Neo4j (graceful fallback if unavailable)
    try {
      // Sync source entity node
      await syncEntityNode(sessionId, source);
      // Sync target entity nodes
      for (const target of targets) {
        await syncEntityNode(sessionId, target);
      }
      // Create relationships in Neo4j
      for (const edge of createdEdges) {
        await createRelationship(sessionId, edge);
      }
    } catch (neo4jError) {
      console.warn('Neo4j sync failed (MongoDB updated successfully):', neo4jError.message);
    }

    // Build response
    const response = {
      verdict: 'accepted',
      edge: createdEdges.length === 1 ? createdEdges[0] : createdEdges,
      points: {
        awarded: pointsAwarded,
        playerTotal: scores[playerId],
        breakdown: [`Base quality score: ${evaluation.quality.score.toFixed(2)} → ${pointsAwarded} points`]
      },
      evolution: {
        affected: targets.map(t => ({
          cardId: t.cardId || t.entityId,
          delta: Math.ceil(evaluation.quality.score * 2),
          changeSummary: `Connection established: "${relationshipPayload.surfaceText}"`
        })),
        regenSuggested: []
      },
      clusters: {
        touched: cluster?.entities?.map(e => e.entityId) || [],
        metrics: cluster ? [{ entitiesInCluster: cluster.entities?.length || 0, relationshipsInCluster: cluster.relationships?.length || 0 }] : []
      },
      existingEdgesCount: existingEdges.length,
      mocked: shouldMock,
      fastValidate: evaluation.fastValidate
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Error in /api/arena/relationships/propose:', error);
    return res.status(500).json({ message: 'Server error during relationship proposal.' });
  }
}

// Propose Relationship
app.post('/api/arena/relationships/propose', async (req, res) =>
  handleArenaRelationship(req, res)
);

// Validate Relationship (dry run only)
app.post('/api/arena/relationships/validate', async (req, res) =>
  handleArenaRelationship(req, res, { forceDryRun: true })
);

// Get Arena State (full graph snapshot)
app.get('/api/arena/state', async (req, res) => {
  try {
    const { sessionId, playerId, arenaId } = req.query;

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
    }

    const arenaDoc = await Arena.findOne({ sessionId }).lean();
    const arena = arenaDoc?.arena || { entities: [], storytellers: [], edges: [], scores: {}, clusters: [] };

    return res.status(200).json({
      sessionId,
      playerId,
      arenaId: arenaId || 'default',
      arena: {
        entities: Array.isArray(arena.entities) ? arena.entities : [],
        storytellers: Array.isArray(arena.storytellers) ? arena.storytellers : []
      },
      edges: Array.isArray(arena.edges) ? arena.edges : [],
      clusters: Array.isArray(arena.clusters) ? arena.clusters : [],
      scores: arena.scores || {},
      lastUpdatedBy: arenaDoc?.lastUpdatedBy,
      updatedAt: arenaDoc?.updatedAt
    });
  } catch (error) {
    console.error('Error in /api/arena/state:', error);
    return res.status(500).json({ message: 'Server error during arena state fetch.' });
  }
});

// 1. Create Room
app.post('/api/brewing/rooms', async (req, res) => {
  try {
    const roomId = generateRoomId();
    // Need to handle strict uniqueness in production loop, but simple here
    const newRoom = new BrewRoom({ roomId });
    await newRoom.save();
    console.log(`[Room Created] ${roomId}`);
    res.json({ roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// 2. Get Room
app.get('/api/brewing/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await BrewRoom.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(sanitizeRoomForPublic(room));
  } catch (err) {
    res.status(500).json({ error: 'Server fatal' });
  }
});

// 3. Join Room
app.post('/api/brewing/rooms/:roomId/join', async (req, res) => {
  const { roomId } = req.params;
  const body = req.body || {};
  const rawMaskId = typeof body.maskId === 'string' ? body.maskId.trim() : '';
  const rawDisplayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const maskId = rawMaskId || 'unknown';
  const displayName = rawDisplayName || `Mask ${maskId}`;

  try {
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const playerId = randomUUID();
    const newPlayer = {
      playerId,
      maskId,
      maskName: displayName,
      displayName,
      status: 'not_ready',
      isBot: false
    };

    room.players.push(newPlayer);
    await room.save();

    broadcastToRoom(roomId, 'PLAYER_JOINED', { player: newPlayer, roomState: sanitizeRoomForPublic(room) });

    res.json({ playerId, roomState: sanitizeRoomForPublic(room) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Join failed' });
  }
});

// 4. Toggle Ready
app.post('/api/brewing/rooms/:roomId/players/:playerId/ready', async (req, res) => {
  const { roomId, playerId } = req.params;
  const body = req.body || {};
  const { ready } = body;

  try {
    if (typeof ready !== 'boolean') {
      return res.status(400).json({ error: 'ready must be a boolean' });
    }

    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const player = room.players.find(p => p.playerId === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    player.status = ready ? 'ready' : 'not_ready';
    await room.save(); // Mongoose subdoc update

    broadcastToRoom(roomId, 'PLAYER_READY_CHANGED', {
      playerId,
      status: player.status,
      roomState: sanitizeRoomForPublic(room)
    });

    res.json(sanitizeRoomForPublic(room));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ready failed' });
  }
});

// 5. Start Brew (Host)
app.post('/api/brewing/rooms/:roomId/start', async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.players.length === 0) return res.status(400).json({ error: 'No players' });

    room.phase = 'brewing';
    room.players.forEach(p => p.status = 'active');

    // Setup First Turn
    room.turn.activePlayerId = room.players[0].playerId;
    room.turn.round = 1;
    room.turn.index = 0;

    await room.save();

    broadcastToRoom(roomId, 'PHASE_CHANGED', { phase: 'brewing', roomState: sanitizeRoomForPublic(room) });
    broadcastToRoom(roomId, 'TURN_STARTED', { turn: room.turn });

    res.json(sanitizeRoomForPublic(room));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Start failed' });
  }
});

// 6. Submit Ingredient (Active Player)
app.post('/api/brewing/rooms/:roomId/turn/submit', async (req, res) => {
  const { roomId } = req.params;
  const activePlayerId = req.header('x-player-id');
  const body = req.body || {};
  const ingredient = typeof body.ingredient === 'string' ? body.ingredient.trim() : '';

  try {
    if (!activePlayerId || typeof activePlayerId !== 'string') {
      return res.status(400).json({ error: 'x-player-id header is required' });
    }

    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (!ingredient) {
      return res.status(400).json({ error: 'Ingredient is required' });
    }

    if (room.turn.activePlayerId !== activePlayerId) {
      return res.status(403).json({ error: 'Not your turn' });
    }

    broadcastToRoom(roomId, 'INGREDIENT_ACCEPTED', { playerId: activePlayerId, text: ingredient });

    res.json({ ok: true });

    // Trigger Async Logic
    handleBrewmasterTurn(roomId, activePlayerId, ingredient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submit failed' });
  }
});

async function handleBrewmasterTurn(roomId, playerId, ingredient) {
  console.log(`[Brewmaster] Processing ingredient '${ingredient}' from ${playerId} in ${roomId}...`);

  await new Promise(r => setTimeout(r, 3000));

  try {
    // Re-fetch room to avoid race conditions (naive lock)
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return;

    const vialId = randomUUID();
    const newVial = {
      id: vialId,
      title: `Essence of ${ingredient}`,
      containerDescription: "A twisted glass bottle emitting faint smoke.",
      substanceDescription: `A glowing liquid derived from ${ingredient}.`,
      pourEffect: "The universe shudders slightly.",
      timestamp: Date.now(),
      addedByMaskId: room.players.find(p => p.playerId === playerId)?.maskId || 'unknown',
      privateIngredient: ingredient
    };

    room.brew.vials.push(newVial);

    room.brew.summaryLines.push(`Someone added ${ingredient} to the mix.`);
    if (room.brew.summaryLines.length > 3) room.brew.summaryLines.shift();

    // Broadcast VIAL_REVEALED
    const publicVial = { ...newVial };
    delete publicVial.privateIngredient;

    broadcastToRoom(roomId, 'VIAL_REVEALED', { vial: publicVial });
    broadcastToRoom(roomId, 'BREW_SUMMARY_UPDATED', { summaryLines: room.brew.summaryLines });

    // Advance Turn
    const currentPlayerIdx = room.players.findIndex(p => p.playerId === room.turn.activePlayerId);
    const nextPlayerIdx = (currentPlayerIdx + 1) % room.players.length;
    room.turn.activePlayerId = room.players[nextPlayerIdx].playerId;
    room.turn.index++;

    if (nextPlayerIdx === 0) {
      room.turn.round++;
    }

    if (room.turn.round > room.turn.totalRounds) {
      room.phase = 'complete';
      broadcastToRoom(roomId, 'BREW_COMPLETED', { brew: room.brew });
    } else {
      broadcastToRoom(roomId, 'TURN_ENDED', {});
      broadcastToRoom(roomId, 'TURN_STARTED', { turn: room.turn });
    }

    await room.save();

  } catch (err) {
    console.error("Brewmaster error:", err);
  }
}

// --- Real-time Events (SSE) ---
app.get('/api/brewing/events', (req, res) => {
  const { roomId } = req.query;

  if (!roomId || typeof roomId !== 'string') {
    return res.status(400).json({ error: 'roomId is required' });
  }

  // Note: We don't necessarily check DB *existence* strictly here on connection 
  // to save a read, but arguably we should.

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  if (!roomClients.has(roomId)) {
    roomClients.set(roomId, new Set());
  }
  roomClients.get(roomId).add(res);

  console.log(`[SSE] Client connected to room ${roomId}`);

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { roomId } })}\n\n`);

  req.on('close', () => {
    console.log(`[SSE] Client disconnected from room ${roomId}`);
    const clients = roomClients.get(roomId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        roomClients.delete(roomId);
      }
    }
  });
});


if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`Multiplayer Universe Brewing Server running on port ${PORT}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing process or run with a different port (for example: PORT=5002 node server_new.js).`);
      process.exit(1);
    }

    console.error('Server startup error:', err);
    process.exit(1);
  });
}

export { app };

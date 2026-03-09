import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { BrewRoom } from './models/brewing_models.js';
import {
  callJsonLlm,
  directExternalApiCall,
  listAvailableAnthropicModels,
  listAvailableOpenAiModels
} from './ai/openai/apiService.js';
import { ChatMessage, Storyteller, SessionPlayer, Arena, World, WorldElement, QuestScreenGraph } from './models/models.js';
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
  calculatePoints,
  deriveRelationshipStrength
} from './services/arenaService.js';
import {
  getClusterForEntities,
  createRelationship,
  syncEntityNode,
  buildClusterContext,
  deleteRelationshipsByEdgeIds
} from './services/neo4jService.js';
import { buildOpenApiSpec } from './openapi.js';
import {
  listRouteConfigs,
  getRouteConfig,
  listRouteConfigVersions,
  saveRouteConfigVersion,
  updateRoutePrompt,
  updateRouteSchema,
  setLatestRouteConfig,
  resetRouteConfig,
  renderPrompt,
  validatePayloadForRoute
} from './services/llmRouteConfigService.js';
import memoriesRouter from './routes/memoriesRoutes.js';
import { generateTypewriterPrompt } from './ai/openai/promptsUtils.js';
import {
  getTypewriterAiSettings,
  getPipelineSettingsSnapshot,
  getTypewriterPipelineDefinitions,
  updateTypewriterAiSettings,
  resetTypewriterAiSettings
} from './services/typewriterAiSettingsService.js';
import {
  getLatestPromptTemplate,
  listLatestPromptTemplates,
  listPromptTemplateVersions,
  savePromptTemplateVersion,
  setLatestPromptTemplate,
  renderPromptTemplateString
} from './services/typewriterPromptConfigService.js';
import {
  getCurrentTypewriterPromptTemplates,
  seedCurrentTypewriterPromptTemplates
} from './services/typewriterDefaultPromptSeedService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';
import { ensureMongoConnection } from './services/mongoConnectionService.js';
import {
  appendStoredMessengerMessage,
  deleteStoredMessengerConversation,
  findStoredMessengerMessage,
  listStoredMessengerMessages
} from './services/messengerConversationStore.js';
import {
  deleteMessengerSceneBrief,
  getMessengerSceneBrief,
  saveMessengerSceneBrief
} from './services/messengerSceneBriefService.js';
import {
  getTypewriterSessionFragment,
  mergeTypewriterFragment,
  saveTypewriterSessionFragment,
  startTypewriterSession
} from './services/typewriterSessionService.js';


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

function collectTypewriterPageImages(assetRoots, subDirectory, allowedExtensions) {
  const routePrefix = `/assets/${subDirectory}`;
  const imageUrls = [];

  for (const assetsRoot of assetRoots) {
    const folderPath = path.join(assetsRoot, subDirectory);
    if (!fs.existsSync(folderPath)) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(folderPath, { withFileTypes: true });
    } catch (error) {
      console.warn(`Failed to read typewriter page image folder at ${folderPath}:`, error);
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!allowedExtensions.has(extension)) continue;
      imageUrls.push(`${routePrefix}/${entry.name}`);
    }
  }

  return Array.from(new Set(imageUrls));
}

const DEFAULT_QUEST_ID = 'ruined_rose_court';
const DEFAULT_QUEST_SESSION_ID = 'rose-court-demo';
const MOCK_STORYTELLER_ILLUSTRATION_URLS = [
  '/assets/mocks/storyteller_illustrations/stormwright_weather_speaker.png',
  '/assets/mocks/storyteller_illustrations/ashen_inkbinder.png',
  '/assets/mocks/storyteller_illustrations/veil_cartographer.png'
];
const MOCK_STORYTELLER_KEY_URLS = [
  '/assets/mocks/storyteller_keys/stormwright_weather_speaker_key.png',
  '/assets/mocks/storyteller_keys/ashen_inkbinder_key.png',
  '/assets/mocks/storyteller_keys/veil_cartographer_key.png'
];
const MOCK_STORYTELLER_ILLUSTRATION_URL = MOCK_STORYTELLER_ILLUSTRATION_URLS[0];
const TYPEWRITER_STORYTELLER_CHECK_INTERVAL_WORDS = 5;
const TYPEWRITER_STORYTELLER_WORD_THRESHOLDS = [30, 50, 100];
const TYPEWRITER_STORYTELLER_KEY_SLOTS = [
  {
    slotIndex: 0,
    slotKey: 'STORYTELLER_SLOT_HORIZONTAL',
    keyShape: 'horizontal',
    blankShape: 'wide horizontal storyteller key slot',
    blankTextureUrl: '/textures/keys/blank_horizontal_1.png',
    shapePromptHint: 'wide, low horizontal typewriter key face with a centered strange icon and comfortable edge margins'
  },
  {
    slotIndex: 1,
    slotKey: 'STORYTELLER_SLOT_VERTICAL',
    keyShape: 'vertical',
    blankShape: 'tall vertical storyteller key slot',
    blankTextureUrl: '/textures/keys/blank_vertical_1.png',
    shapePromptHint: 'tall narrow typewriter key face with a vertically balanced icon that reads clearly at small size'
  },
  {
    slotIndex: 2,
    slotKey: 'STORYTELLER_SLOT_RECT_HORIZONTAL',
    keyShape: 'rect_horizontal',
    blankShape: 'rectangular horizontal storyteller key slot',
    blankTextureUrl: '/textures/keys/blank_rect_horizontal_1.png',
    shapePromptHint: 'broad rectangular typewriter key face with a compact centered emblem and a grounded analog feel'
  }
];
const TYPEWRITER_STORYTELLER_SLOT_INDICES = TYPEWRITER_STORYTELLER_KEY_SLOTS.map((slot) => slot.slotIndex);
const OPEN_API_SPEC = buildOpenApiSpec();
const TYPEWRITER_PAGE_IMAGES_SUBDIR = 'typewriter_page_images';
const TYPEWRITER_ALLOWED_PAGE_IMAGE_EXTENSIONS = new Set(['.png']);
const TYPEWRITER_DEFAULT_SERVER_BACKGROUNDS = [
  '/assets/mocks/memory_cards/memory_front_01.png',
  '/assets/mocks/memory_cards/memory_front_02.png',
  '/assets/mocks/memory_cards/memory_front_03.png'
];
const DEFAULT_MESSENGER_SCENE_ID = 'messanger';
const DEFAULT_MESSENGER_HISTORY_LIMIT = 14;
const MESSENGER_INITIAL_MESSAGE =
  'We are pleased to inform you that the typewriter, as discussed, is ready for dispatch. The Society spares no expense in ensuring that our esteemed members receive only the finest instruments for their craft. We trust you are still expecting it? Of course you are. Just a quick confirmation before we proceed. Where shall we send it?';
const TYPEWRITER_DEFAULT_FONTS = [
  { font: "'Uncial Antiqua', serif", font_size: '1.8rem', font_color: '#3b1d15' },
  { font: "'IM Fell English SC', serif", font_size: '1.9rem', font_color: '#2a120f' },
  { font: "'EB Garamond', serif", font_size: '2rem', font_color: '#1f0e08' }
];
const TYPEWRITER_MAX_FONT_COLOR_LUMINANCE = 0.24;
const TYPEWRITER_FONT_COLOR_FALLBACK = '#2a120f';
const TYPEWRITER_FONT_COLOR_KEYWORD_MAP = [
  { keywords: ['red', 'crimson', 'scarlet', 'ember', 'rust', 'wine', 'oxblood', 'garnet'], color: '#5a1f17' },
  { keywords: ['blue', 'azure', 'indigo', 'navy', 'storm', 'sea', 'cobalt'], color: '#1f3558' },
  { keywords: ['green', 'moss', 'verdigris', 'jade', 'pine', 'forest'], color: '#253f33' },
  { keywords: ['violet', 'plum', 'amethyst', 'mulberry'], color: '#43233d' },
  { keywords: ['brown', 'sepia', 'umber', 'bronze', 'copper', 'sienna'], color: '#4a2d1f' },
  { keywords: ['black', 'obsidian', 'ink', 'graphite', 'charcoal', 'ash', 'gray', 'grey', 'silver', 'iron'], color: '#2b2421' }
];
const TYPEWRITER_MIN_FONT_SIZE_PX = 28;
const TYPEWRITER_MIN_FONT_SIZE_REM = 1.75;
const TYPEWRITER_DEFAULT_FONT_SIZE = '1.9rem';
const TYPEWRITER_PREFERRED_FONT_SIZE_PX = 30;
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

function resolveExplicitMockOverride(body = {}) {
  const explicitFlags = [body.mock, body.debug, body.mock_api_calls, body.mocked_api_calls];
  for (const flag of explicitFlags) {
    const parsed = parseBooleanFlag(flag);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function resolveMockMode(body = {}, fallback = false) {
  const explicit = resolveExplicitMockOverride(body);
  if (explicit !== null) {
    return explicit;
  }
  return Boolean(fallback);
}

async function getAiPipelineSettings(pipelineKey) {
  const settings = await getTypewriterAiSettings();
  return getPipelineSettingsSnapshot(settings, pipelineKey);
}

function countWords(text = '') {
  if (typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computeTypewriterWordBounds(wordCount = 0) {
  const safeWordCount = Math.max(0, Number(wordCount) || 0);
  const minWords = Math.max(5, parseInt(safeWordCount / (1.61 * 1.61), 10) || 0);
  const maxWords = Math.min(80, parseInt(safeWordCount / 1.61, 10) || 0);
  return { minWords, maxWords };
}

function buildTypewriterPromptPayload(currentNarrative = '') {
  const wordCount = countWords(currentNarrative);
  const { minWords, maxWords } = computeTypewriterWordBounds(wordCount);
  return {
    current_narrative: currentNarrative,
    min_words: minWords,
    max_words: maxWords,
    word_count: wordCount,
    preferred_font_size_px: TYPEWRITER_PREFERRED_FONT_SIZE_PX
  };
}

function buildTypewriterPromptMessages(currentNarrative, promptTemplate) {
  if (!promptTemplate || !promptTemplate.trim()) {
    return generateTypewriterPrompt(currentNarrative);
  }

  const payload = buildTypewriterPromptPayload(currentNarrative);
  const renderedPrompt = renderPromptTemplateString(promptTemplate, {
    current_narrative: payload.current_narrative,
    min_words: payload.min_words,
    max_words: payload.max_words,
    word_count: payload.word_count,
    preferred_font_size_px: payload.preferred_font_size_px
  });

  return [
    { role: 'system', content: renderedPrompt },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

function pickRandomItem(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function buildAbsoluteAssetUrl(req, assetPath) {
  if (typeof assetPath !== 'string' || !assetPath.trim()) return null;
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  const normalized = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${req.protocol}://${req.get('host')}${normalized}`;
}

function normalizeTypewriterFontSize(fontSize) {
  if (typeof fontSize === 'number' && Number.isFinite(fontSize)) {
    return `${Math.max(TYPEWRITER_MIN_FONT_SIZE_PX, fontSize)}px`;
  }

  if (typeof fontSize === 'string') {
    const trimmed = fontSize.trim();
    if (!trimmed) return TYPEWRITER_DEFAULT_FONT_SIZE;

    const pxMatch = trimmed.match(/^([0-9]*\.?[0-9]+)\s*px$/i);
    if (pxMatch) {
      const value = Math.max(TYPEWRITER_MIN_FONT_SIZE_PX, Number(pxMatch[1]));
      return `${Number(value.toFixed(2))}px`;
    }

    const remMatch = trimmed.match(/^([0-9]*\.?[0-9]+)\s*rem$/i);
    if (remMatch) {
      const value = Math.max(TYPEWRITER_MIN_FONT_SIZE_REM, Number(remMatch[1]));
      return `${Number(value.toFixed(2))}rem`;
    }

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return `${Math.max(TYPEWRITER_MIN_FONT_SIZE_PX, numeric)}px`;
    }
  }

  return TYPEWRITER_DEFAULT_FONT_SIZE;
}

function expandHexColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const shortMatch = trimmed.match(/^#([0-9a-f]{3})$/i);
  if (shortMatch) {
    return `#${shortMatch[1].split('').map((char) => `${char}${char}`).join('').toLowerCase()}`;
  }
  const longMatch = trimmed.match(/^#([0-9a-f]{6})$/i);
  if (longMatch) {
    return `#${longMatch[1].toLowerCase()}`;
  }
  return null;
}

function parseHexColor(value) {
  const expanded = expandHexColor(value);
  if (!expanded) return null;
  return {
    r: Number.parseInt(expanded.slice(1, 3), 16),
    g: Number.parseInt(expanded.slice(3, 5), 16),
    b: Number.parseInt(expanded.slice(5, 7), 16)
  };
}

function toHexColor({ r, g, b }) {
  return `#${[r, g, b].map((channel) => {
    const safeChannel = Math.max(0, Math.min(255, Math.round(channel)));
    return safeChannel.toString(16).padStart(2, '0');
  }).join('')}`;
}

function getRelativeLuminance({ r, g, b }) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function darkenColorForTypewriter(rgb) {
  const luminance = getRelativeLuminance(rgb);
  if (luminance <= TYPEWRITER_MAX_FONT_COLOR_LUMINANCE) {
    return rgb;
  }
  const scale = TYPEWRITER_MAX_FONT_COLOR_LUMINANCE / luminance;
  return {
    r: Math.max(12, Math.round(rgb.r * scale)),
    g: Math.max(12, Math.round(rgb.g * scale)),
    b: Math.max(12, Math.round(rgb.b * scale))
  };
}

function pickTypewriterKeywordColor(value) {
  const lowered = `${value || ''}`.trim().toLowerCase();
  if (!lowered) return null;
  const match = TYPEWRITER_FONT_COLOR_KEYWORD_MAP.find((entry) =>
    entry.keywords.some((keyword) => lowered.includes(keyword))
  );
  return match?.color || null;
}

function normalizeTypewriterFontColor(fontColor) {
  if (typeof fontColor !== 'string' || !fontColor.trim()) {
    return TYPEWRITER_FONT_COLOR_FALLBACK;
  }
  const normalizedRaw = fontColor.trim().toLowerCase();
  const expanded = expandHexColor(fontColor);
  const parsed = parseHexColor(fontColor);
  if (parsed) {
    const darkenedHex = toHexColor(darkenColorForTypewriter(parsed));
    return darkenedHex === expanded ? normalizedRaw : darkenedHex;
  }
  const keywordMatch = pickTypewriterKeywordColor(fontColor);
  if (keywordMatch) {
    return keywordMatch;
  }
  return TYPEWRITER_FONT_COLOR_FALLBACK;
}

function normalizeTypewriterMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const font = metadata.font || metadata.fontName || metadata.font_family || metadata.fontFamily;
  const fontSize = metadata.font_size || metadata.fontSize || metadata.size;
  const fontColor = metadata.font_color || metadata.fontColor || metadata.color;
  if (!font && !fontSize && !fontColor) return null;
  return {
    font: font || pickRandomItem(TYPEWRITER_DEFAULT_FONTS).font,
    font_size: normalizeTypewriterFontSize(fontSize),
    font_color: normalizeTypewriterFontColor(fontColor)
  };
}

function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function sanitizeTimingScale(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 1;
  return clampValue(numericValue, 0.35, 5);
}

function computeFadeTimingProfile(narrativeWordCount, fadeSteps = 3, options = {}) {
  const normalizedWordCount = Math.max(0, Number(narrativeWordCount) || 0);
  const timingScale = sanitizeTimingScale(options.timingScale);
  const lengthRatio = clampValue(normalizedWordCount / 260, 0, 1);
  const brevityFactor = normalizedWordCount <= 6
    ? 0.72
    : normalizedWordCount <= 14
      ? 0.86
      : 1;
  const firstPauseDelay = Math.round((4200 + (9000 - 4200) * lengthRatio) * timingScale * brevityFactor);
  const phasePauseDelay = Math.round((1900 + (4200 - 1900) * lengthRatio) * timingScale * brevityFactor);
  const finalPauseDelay = Math.round((1300 + (2900 - 1300) * lengthRatio) * timingScale * brevityFactor);
  const fadePhaseDelay = Math.round((2800 + (7200 - 2800) * lengthRatio) * timingScale * brevityFactor);
  const safeFadeSteps = Math.max(1, Number(fadeSteps) || 1);
  const intermediatePauseCount = Math.max(0, safeFadeSteps - 1);
  const estimatedTotalDurationMs =
    firstPauseDelay +
    (intermediatePauseCount * phasePauseDelay) +
    finalPauseDelay +
    ((safeFadeSteps + 1) * fadePhaseDelay);

  return {
    narrative_word_count: normalizedWordCount,
    fade_steps: safeFadeSteps,
    first_pause_delay: firstPauseDelay,
    phase_pause_delay: phasePauseDelay,
    final_pause_delay: finalPauseDelay,
    fade_interval_ms: fadePhaseDelay,
    fade_phase_delay: fadePhaseDelay,
    estimated_total_duration_ms: estimatedTotalDurationMs,
    timing_scale: timingScale
  };
}

function computeFadeStepCount(narrativeWordCount) {
  const normalizedWordCount = Math.max(0, Number(narrativeWordCount) || 0);
  if (normalizedWordCount <= 6) return 2;
  if (normalizedWordCount <= 40) return 3;
  return 4;
}

function normalizeContinuationInsights(rawInsights, continuation, fallbackStyle) {
  const source = rawInsights && typeof rawInsights === 'object' ? rawInsights : {};
  const meaning = Array.isArray(source.meaning)
    ? source.meaning.map((line) => (typeof line === 'string' ? line.trim() : '')).filter(Boolean)
    : [];
  const contextualStrengthening = typeof source.contextual_strengthening === 'string'
    ? source.contextual_strengthening.trim()
    : '';
  const continuationWordCount = toFiniteNumber(source.continuation_word_count) ?? countWords(continuation);
  const pointsPool = toFiniteNumber(source.current_storytelling_points_pool);
  const pointsEarned = toFiniteNumber(source.points_earned);
  const rawEntities = Array.isArray(source.Entities)
    ? source.Entities
    : Array.isArray(source.entities)
      ? source.entities
      : [];
  const entities = rawEntities
    .map((entity) => {
      if (!entity || typeof entity !== 'object') return null;
      const entity_name = typeof entity.entity_name === 'string' ? entity.entity_name.trim() : '';
      const ner_category = typeof entity.ner_category === 'string' ? entity.ner_category.trim() : '';
      const ascope_pmesii = typeof entity.ascope_pmesii === 'string' ? entity.ascope_pmesii.trim() : '';
      const storytelling_points = toFiniteNumber(entity.storytelling_points);
      const reuse = typeof entity.reuse === 'boolean' ? entity.reuse : null;
      if (!entity_name && !ner_category && !ascope_pmesii && storytelling_points === null && reuse === null) {
        return null;
      }
      return {
        entity_name,
        ner_category,
        ascope_pmesii,
        storytelling_points,
        reuse
      };
    })
    .filter(Boolean);
  const style = normalizeTypewriterMetadata(source.style || source.metadata || fallbackStyle);

  return {
    meaning,
    contextual_strengthening: contextualStrengthening,
    continuation_word_count: continuationWordCount,
    current_storytelling_points_pool: pointsPool,
    points_earned: pointsEarned,
    Entities: entities,
    style
  };
}

function createTypewriterResponse(fullText, metadata, fadeSteps = null, options = {}) {
  const style = normalizeTypewriterMetadata(metadata) || pickRandomItem(TYPEWRITER_DEFAULT_FONTS);
  const narrative = typeof fullText === 'string' ? fullText.trim() : '';
  const safeNarrative = narrative || 'The wind caught the page and held its breath.';
  const requestedWordCount = toFiniteNumber(options.narrativeWordCount);
  const fadeTimingScale = sanitizeTimingScale(options.fadeTimingScale);
  const resolvedNarrativeWordCount = requestedWordCount !== null ? requestedWordCount : countWords(safeNarrative);
  const explicitFadeSteps = toFiniteNumber(fadeSteps);
  const resolvedFadeSteps = explicitFadeSteps !== null && explicitFadeSteps > 0
    ? Math.floor(explicitFadeSteps)
    : computeFadeStepCount(resolvedNarrativeWordCount);
  const fadeTiming = computeFadeTimingProfile(
    resolvedNarrativeWordCount,
    resolvedFadeSteps,
    { timingScale: fadeTimingScale }
  );

  const writing_sequence = [
    { action: 'type', text: safeNarrative, style, delay: 0 },
    { action: 'pause', delay: 1200 }
  ];

  const fade_sequence = [];
  for (let i = 0; i < fadeTiming.fade_steps; i += 1) {
    const cutoff = Math.round(safeNarrative.length * (1 - (i + 1) / (fadeTiming.fade_steps + 1)));
    fade_sequence.push({
      action: 'pause',
      delay: i === 0 ? fadeTiming.first_pause_delay : fadeTiming.phase_pause_delay
    });
    fade_sequence.push({
      action: 'fade',
      phase: i + 1,
      to_text: safeNarrative.slice(0, cutoff).trim(),
      style,
      delay: fadeTiming.fade_phase_delay
    });
  }
  fade_sequence.push({ action: 'pause', delay: fadeTiming.final_pause_delay });
  fade_sequence.push({
    action: 'fade',
    phase: fadeTiming.fade_steps + 1,
    to_text: '',
    style,
    delay: fadeTiming.fade_phase_delay
  });

  return {
    metadata: style,
    timing: fadeTiming,
    writing_sequence,
    fade_sequence,
    sequence: [...writing_sequence, ...fade_sequence]
  };
}

function buildMockContinuation(message) {
  const words = countWords(message);
  if (words <= 5) return 'while a lantern blinked once in the ravine wind.';
  if (words <= 12) return 'and the trail answered with bells buried under ash.';
  return 'as the pass fell quiet and every footstep sounded borrowed.';
}

async function resolveMessengerPersistenceMode() {
  const hasMongo = await ensureMongoConnection({ allowFailure: true });
  return hasMongo ? 'mongo' : 'file';
}

function normalizeMessengerSceneId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_MESSENGER_SCENE_ID;
}

function normalizeMessengerHistoryLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MESSENGER_HISTORY_LIMIT;
  }
  return Math.max(4, Math.min(40, Math.floor(parsed)));
}

function toMessengerMessagePayload(doc) {
  return {
    id: String(doc?._id || ''),
    order: Number(doc?.order) || 0,
    type: typeof doc?.type === 'string' ? doc.type : 'response',
    sender: typeof doc?.sender === 'string' ? doc.sender : 'system',
    text: typeof doc?.content === 'string' ? doc.content : '',
    hasChatEnded: Boolean(doc?.has_chat_ended),
    createdAt: doc?.createdAt || null
  };
}

async function ensureMessengerIntroMessage(sessionId, sceneId = DEFAULT_MESSENGER_SCENE_ID, persistence = 'mongo') {
  if (persistence === 'mongo') {
    const existing = await ChatMessage.findOne({ sessionId, sceneId, type: 'initial' }).sort({ order: 1 });
    if (existing) {
      return existing;
    }

    return ChatMessage.create({
      sessionId,
      sceneId,
      order: Date.now(),
      sender: 'system',
      content: MESSENGER_INITIAL_MESSAGE,
      type: 'initial',
      has_chat_ended: false
    });
  }

  const existing = await findStoredMessengerMessage(sessionId, sceneId, (message) => message.type === 'initial');
  if (existing) {
    return existing;
  }

  return appendStoredMessengerMessage(sessionId, sceneId, {
    order: Date.now(),
    sender: 'system',
    content: MESSENGER_INITIAL_MESSAGE,
    type: 'initial',
    has_chat_ended: false
  });
}

async function loadMessengerHistoryDocs(sessionId, sceneId = DEFAULT_MESSENGER_SCENE_ID, persistence = 'mongo') {
  if (persistence === 'mongo') {
    return ChatMessage.find({ sessionId, sceneId }).sort({ order: 1, createdAt: 1 });
  }
  return listStoredMessengerMessages(sessionId, sceneId);
}

async function createMessengerMessage(sessionId, sceneId, doc, persistence = 'mongo') {
  if (persistence === 'mongo') {
    return ChatMessage.create({
      sessionId,
      sceneId,
      ...doc
    });
  }
  return appendStoredMessengerMessage(sessionId, sceneId, doc);
}

async function deleteMessengerConversation(sessionId, sceneId, persistence = 'mongo') {
  if (persistence === 'mongo') {
    return ChatMessage.deleteMany({ sessionId, sceneId });
  }
  const deletedCount = await deleteStoredMessengerConversation(sessionId, sceneId);
  return { deletedCount };
}

const MESSENGER_MIN_SCENE_SUMMARY_WORDS = 28;
const MESSENGER_MIN_HIDING_SPOT_WORDS = 6;
const MESSENGER_MIN_SENSORY_DETAILS = 3;
const MESSENGER_SYSTEM_CONTRACT_TEXT = `Runtime output contract:
- Return keys: has_chat_ended, message_assistant, scene_brief
- scene_brief must include: subject, place_name, place_summary, typewriter_hiding_spot, sensory_details, notable_features, scene_established
- Do not mark has_chat_ended true until the destination is vivid enough to establish a scene and the typewriter hiding place is concrete
- subject must be short and easy to browse later in storage
- place_summary must be specific enough for a later system to stage the scene immediately`;

function normalizeMessengerBriefText(value, maxLength = 4000) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.slice(0, maxLength);
}

function normalizeMessengerBriefList(value, limit = 6) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const entry of value) {
    const normalized = normalizeMessengerBriefText(entry, 220);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(normalized);
    if (items.length >= limit) break;
  }
  return items;
}

function pickRicherMessengerText(currentValue, nextValue) {
  const current = normalizeMessengerBriefText(currentValue);
  const next = normalizeMessengerBriefText(nextValue);
  if (!next) return current;
  if (!current) return next;
  return countWords(next) >= countWords(current) ? next : current;
}

function deriveMessengerSceneSubject(brief = {}) {
  const explicit = normalizeMessengerBriefText(brief.subject, 120);
  if (explicit) return explicit;
  const fallback = normalizeMessengerBriefText(brief.placeName, 120) || normalizeMessengerBriefText(brief.placeSummary, 120);
  if (!fallback) return '';
  return fallback.split(/\s+/).slice(0, 6).join(' ');
}

function normalizeMessengerSceneBrief(rawBrief) {
  const source = rawBrief && typeof rawBrief === 'object' ? rawBrief : {};
  const brief = {
    subject: normalizeMessengerBriefText(source.subject || source.short_title, 120),
    placeName: normalizeMessengerBriefText(source.place_name || source.placeName || source.location_name || source.location || source.setting_name, 240),
    placeSummary: normalizeMessengerBriefText(
      source.place_summary
      || source.placeSummary
      || source.scene_description
      || source.establishing_scene
      || source.description,
      4000
    ),
    typewriterHidingSpot: normalizeMessengerBriefText(
      source.typewriter_hiding_spot
      || source.typewriterHidingSpot
      || source.hiding_spot
      || source.hideaway,
      1600
    ),
    sensoryDetails: normalizeMessengerBriefList(
      source.sensory_details
      || source.sensoryDetails
      || source.sensory_anchors
      || source.scene_details
    ),
    notableFeatures: normalizeMessengerBriefList(
      source.notable_features
      || source.notableFeatures
      || source.props
      || source.anchors
    ),
    sceneEstablished: Boolean(source.scene_established || source.sceneEstablished)
  };

  if (
    !brief.subject
    && !brief.placeName
    && !brief.placeSummary
    && !brief.typewriterHidingSpot
    && brief.sensoryDetails.length === 0
    && brief.notableFeatures.length === 0
  ) {
    return null;
  }

  brief.subject = deriveMessengerSceneSubject(brief);
  return brief;
}

function mergeMessengerSceneBrief(existingBrief, nextBrief) {
  const existing = existingBrief && typeof existingBrief === 'object' ? existingBrief : null;
  const next = nextBrief && typeof nextBrief === 'object' ? nextBrief : null;
  if (!existing && !next) return null;

  const merged = {
    id: next?.id || existing?.id,
    subject: '',
    placeName: pickRicherMessengerText(existing?.placeName, next?.placeName).slice(0, 240),
    placeSummary: pickRicherMessengerText(existing?.placeSummary, next?.placeSummary),
    typewriterHidingSpot: pickRicherMessengerText(existing?.typewriterHidingSpot, next?.typewriterHidingSpot),
    sensoryDetails: normalizeMessengerBriefList([
      ...(Array.isArray(next?.sensoryDetails) ? next.sensoryDetails : []),
      ...(Array.isArray(existing?.sensoryDetails) ? existing.sensoryDetails : [])
    ]),
    notableFeatures: normalizeMessengerBriefList([
      ...(Array.isArray(next?.notableFeatures) ? next.notableFeatures : []),
      ...(Array.isArray(existing?.notableFeatures) ? existing.notableFeatures : [])
    ]),
    sceneEstablished: Boolean(next?.sceneEstablished || existing?.sceneEstablished),
    assistantReply: pickRicherMessengerText(existing?.assistantReply, next?.assistantReply),
    source: normalizeMessengerBriefText(next?.source || existing?.source, 80) || 'unknown',
    meta: {
      ...(existing?.meta && typeof existing.meta === 'object' ? existing.meta : {}),
      ...(next?.meta && typeof next.meta === 'object' ? next.meta : {})
    }
  };
  merged.subject = deriveMessengerSceneSubject({
    subject: next?.subject || existing?.subject || '',
    placeName: merged.placeName,
    placeSummary: merged.placeSummary
  });

  if (
    !merged.subject
    && !merged.placeName
    && !merged.placeSummary
    && !merged.typewriterHidingSpot
    && merged.sensoryDetails.length === 0
    && merged.notableFeatures.length === 0
  ) {
    return null;
  }

  return merged;
}

function getMessengerSceneBriefGaps(brief) {
  if (!brief) {
    return ['scene', 'hideaway', 'sensory', 'subject'];
  }

  const gaps = [];
  if (!brief.subject) gaps.push('subject');
  if (countWords(brief.placeSummary) < MESSENGER_MIN_SCENE_SUMMARY_WORDS) gaps.push('scene');
  if (countWords(brief.typewriterHidingSpot) < MESSENGER_MIN_HIDING_SPOT_WORDS) gaps.push('hideaway');
  if ((Array.isArray(brief.sensoryDetails) ? brief.sensoryDetails.length : 0) < MESSENGER_MIN_SENSORY_DETAILS) {
    gaps.push('sensory');
  }
  return gaps;
}

function isMessengerSceneBriefComplete(brief) {
  return getMessengerSceneBriefGaps(brief).length === 0;
}

function buildMessengerSceneFollowUp(brief, gaps = []) {
  if (gaps.includes('hideaway')) {
    return 'We are nearly there. One last practical matter: where exactly could the typewriter disappear if an unwelcome eye fell upon it, and what about that hiding place keeps it safe?';
  }
  if (gaps.includes('scene') || gaps.includes('sensory')) {
    return 'Good, but the Society still needs the room to come properly into focus. Give me the physical truth of it: the surface where the typewriter will rest, the light, the air, the nearby sounds, and a few concrete details that make the place unmistakable.';
  }
  if (gaps.includes('subject')) {
    const placeName = normalizeMessengerBriefText(brief?.placeName, 120);
    if (placeName) {
      return `Excellent. One last clarification for the ledger: what would you call this place in a few words, so the Society can file it properly alongside "${placeName}"?`;
    }
    return 'One final filing detail: what would you call this place in a few sharp words, so the Society can ledger it properly?';
  }
  return 'Just a touch more detail, if you please. We need the room itself and the means of concealment to be unmistakably real before the Society commits the shipment.';
}

function buildMessengerPromptMessages(historyDocs, promptTemplate, maxHistoryMessages = DEFAULT_MESSENGER_HISTORY_LIMIT) {
  const safePromptBase = typeof promptTemplate === 'string' && promptTemplate.trim()
    ? promptTemplate.trim()
    : 'You are a strange but professional courier for the Storyteller Society. Return JSON only.';
  const safePrompt = `${safePromptBase}\n\n${MESSENGER_SYSTEM_CONTRACT_TEXT}`;
  const safeLimit = normalizeMessengerHistoryLimit(maxHistoryMessages);
  const formattedHistory = (Array.isArray(historyDocs) ? historyDocs : []).map((doc) => ({
    role: doc?.sender === 'user' ? 'user' : 'assistant',
    content: typeof doc?.content === 'string' ? doc.content : ''
  }));

  if (formattedHistory.length <= safeLimit + 1) {
    return [{ role: 'system', content: safePrompt }, ...formattedHistory];
  }

  const [initialMessage, ...rest] = formattedHistory;
  return [{ role: 'system', content: safePrompt }, initialMessage, ...rest.slice(-safeLimit)];
}

function buildMockMessengerResponse(message, historyDocs = []) {
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const lowerMessage = normalizedMessage.toLowerCase();
  const historyText = (Array.isArray(historyDocs) ? historyDocs : [])
    .map((entry) => (typeof entry?.content === 'string' ? entry.content : ''))
    .join(' ');
  const priorUserTurns = (Array.isArray(historyDocs) ? historyDocs : []).filter((entry) => entry?.sender === 'user').length;
  const locationPattern = /(window|bay|attic|apartment|room|woods|forest|desert|plateau|harbor|house|flat|studio|tower|lane|street|road|courtyard|monastery|pass|cellar|basement)/i;
  const hidingPattern = /(hide|hiding|closet|cupboard|cabinet|wardrobe|locker|crate|cellar|under|beneath|false wall|safe|chest|trunk|crawlspace)/i;
  const mentionsLocation = locationPattern.test(normalizedMessage) || locationPattern.test(historyText);
  const mentionsHiding = hidingPattern.test(normalizedMessage) || hidingPattern.test(historyText);
  const likelyPlaceName = mentionsLocation
    ? 'Attic room above the harbor'
    : 'Undisclosed receiving room';
  const partialSceneBrief = {
    subject: mentionsLocation ? 'Harbor attic watchroom' : 'Pending delivery room',
    place_name: likelyPlaceName,
    place_summary: mentionsLocation
      ? 'A salt-marked attic room hangs above the harbor with a rain-streaked window, a narrow work surface, and weather pressing at the glass. It feels private, habitable, and immediately stageable as the sort of place where a secret machine could begin its work.'
      : '',
    typewriter_hiding_spot: mentionsHiding
      ? 'Inside the cedar wardrobe with the false back, where the machine can disappear quickly and remain dry, ordinary, and out of casual reach.'
      : '',
    sensory_details: mentionsLocation
      ? ['salt wind through the sash', 'harbor bells below', 'cold damp in the rafters']
      : [],
    notable_features: mentionsLocation
      ? ['rain-marked window', 'narrow oak worktable', 'sloped attic rafters']
      : mentionsHiding
        ? ['cedar wardrobe with false back']
        : [],
    scene_established: Boolean(mentionsLocation && mentionsHiding)
  };
  const shouldEnd = isMessengerSceneBriefComplete(normalizeMessengerSceneBrief(partialSceneBrief));

  if (shouldEnd) {
    return {
      has_chat_ended: true,
      message_assistant:
        'Splendid. That will do very nicely. I have noted the room, the atmosphere, and the discreet means by which the machine may disappear should the need arise. The Society shall make its arrangements, and if anyone asks, we were never here.',
      scene_brief: partialSceneBrief
    };
  }

  if (mentionsLocation || priorUserTurns >= 1) {
    return {
      has_chat_ended: false,
      message_assistant:
        'Excellent. We are beginning to see the room properly now. One final practical matter: if the typewriter had to vanish at short notice, where exactly would you conceal it, and what in that place would keep it safe from idle hands?',
      scene_brief: partialSceneBrief
    };
  }

  if (/address|send|deliver|dispatch|ship|post/i.test(lowerMessage)) {
    return {
      has_chat_ended: false,
      message_assistant:
        'Quite. But an address alone is such a blunt instrument. We require the atmosphere as well: the table, the light, the weather at the window, the noises in the corridor, and the sort of room in which the keys will learn your habits.',
      scene_brief: partialSceneBrief
    };
  }

  return {
    has_chat_ended: false,
    message_assistant:
      'Yes, yes, but where will it actually live once it reaches you? We need the physical truth of it: the room, the surface, the view, the air, and any nearby place in which a very precious typewriter might be hidden without remark.',
    scene_brief: partialSceneBrief
  };
}

async function buildMessengerConversationPayload(
  sessionId,
  sceneId = DEFAULT_MESSENGER_SCENE_ID,
  persistence = 'mongo'
) {
  await ensureMessengerIntroMessage(sessionId, sceneId, persistence);
  const historyDocs = await loadMessengerHistoryDocs(sessionId, sceneId, persistence);
  const messages = historyDocs.map(toMessengerMessagePayload);
  const sceneBrief = await getMessengerSceneBrief(sessionId, sceneId, persistence);
  return {
    sessionId,
    sceneId,
    count: messages.length,
    hasChatEnded: messages.some((message) => message.hasChatEnded),
    messages,
    sceneBrief,
    storage: persistence
  };
}

async function handleMessengerChatPost(req, res) {
  try {
    const body = req.body || {};
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const sceneId = normalizeMessengerSceneId(body.sceneId);

    if (!sessionId || !message) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or message.' });
    }

    const persistence = await resolveMessengerPersistenceMode();
    await ensureMessengerIntroMessage(sessionId, sceneId, persistence);
    const existingSceneBrief = await getMessengerSceneBrief(sessionId, sceneId, persistence);

    const baseOrder = Date.now();
    await createMessengerMessage(sessionId, sceneId, {
      order: baseOrder,
      sender: 'user',
      content: message,
      type: 'user',
      has_chat_ended: false
    }, persistence);

    const historyDocs = await loadMessengerHistoryDocs(sessionId, sceneId, persistence);
    const messengerPipeline = await getAiPipelineSettings('messenger_chat');
    const messengerProvider = typeof messengerPipeline?.provider === 'string'
      ? messengerPipeline.provider
      : 'openai';
    const shouldMock = resolveMockMode(body, messengerPipeline.useMock);

    let aiResponse;
    if (shouldMock) {
      aiResponse = buildMockMessengerResponse(message, historyDocs);
    } else {
      const promptDoc = await getLatestPromptTemplate('messenger_chat');
      const routeConfig = await getRouteConfig('messenger_chat');
      const promptTemplate = promptDoc?.promptTemplate || routeConfig?.promptTemplate || '';
      aiResponse = await callJsonLlm({
        prompts: buildMessengerPromptMessages(historyDocs, promptTemplate, body.maxHistoryMessages),
        provider: messengerProvider,
        model: messengerPipeline.model || '',
        max_tokens: 1200,
        explicitJsonObjectFormat: true
      });
    }

    if (!aiResponse || typeof aiResponse !== 'object') {
      return res.status(502).json({
        message: 'Messenger generation failed.',
        runtime: {
          pipeline: 'messenger_chat',
          provider: messengerProvider,
          model: messengerPipeline.model || '',
          mocked: shouldMock
        }
      });
    }

    await validatePayloadForRoute('messenger_chat', aiResponse);

    let reply = typeof aiResponse.message_assistant === 'string' ? aiResponse.message_assistant.trim() : '';
    let hasChatEnded = Boolean(aiResponse.has_chat_ended);
    const incomingSceneBrief = normalizeMessengerSceneBrief(aiResponse.scene_brief);
    let mergedSceneBrief = mergeMessengerSceneBrief(existingSceneBrief, incomingSceneBrief);

    if (!mergedSceneBrief && hasChatEnded) {
      hasChatEnded = false;
      reply = buildMessengerSceneFollowUp(null, ['scene', 'hideaway', 'sensory', 'subject']);
    } else if (mergedSceneBrief) {
      const sceneGaps = getMessengerSceneBriefGaps(mergedSceneBrief);
      if (hasChatEnded && sceneGaps.length > 0) {
        hasChatEnded = false;
        reply = buildMessengerSceneFollowUp(mergedSceneBrief, sceneGaps);
      }

      mergedSceneBrief = {
        ...mergedSceneBrief,
        sceneEstablished: isMessengerSceneBriefComplete(mergedSceneBrief),
        assistantReply: reply,
        source: shouldMock ? 'mock' : `${messengerProvider}:${messengerPipeline.model || 'default'}`,
        meta: {
          ...(mergedSceneBrief.meta && typeof mergedSceneBrief.meta === 'object' ? mergedSceneBrief.meta : {}),
          pipeline: 'messenger_chat',
          mocked: shouldMock,
          updatedAt: new Date().toISOString()
        }
      };
      hasChatEnded = hasChatEnded && mergedSceneBrief.sceneEstablished;
    }

    if (!reply) {
      return res.status(502).json({
        message: 'Messenger generation returned an empty reply.',
        runtime: {
          pipeline: 'messenger_chat',
          provider: messengerProvider,
          model: messengerPipeline.model || '',
          mocked: shouldMock
        }
      });
    }

    let savedSceneBrief = null;
    if (mergedSceneBrief) {
      savedSceneBrief = await saveMessengerSceneBrief(sessionId, sceneId, mergedSceneBrief, persistence);
    }

    await createMessengerMessage(sessionId, sceneId, {
      order: baseOrder + 1,
      sender: 'system',
      content: reply,
      type: 'response',
      has_chat_ended: hasChatEnded
    }, persistence);

    const conversation = await buildMessengerConversationPayload(sessionId, sceneId, persistence);
    return res.status(200).json({
      ...conversation,
      reply,
      has_chat_ended: hasChatEnded,
      sceneBrief: conversation.sceneBrief || savedSceneBrief,
      mocked: shouldMock,
      runtime: {
        pipeline: 'messenger_chat',
        provider: messengerProvider,
        model: messengerPipeline.model || '',
        mocked: shouldMock,
        storage: persistence
      }
    });
  } catch (error) {
    if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
      return res.status(502).json({
        message: resolveSchemaErrorMessage(error, 'Messenger chat schema validation failed.')
      });
    }
    console.error('Error in POST /api/messenger/chat:', error);
    return res.status(500).json({ message: 'Server error during messenger chat.' });
  }
}

app.get('/api/messenger/chat', async (req, res) => {
  try {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const sceneId = normalizeMessengerSceneId(req.query?.sceneId);
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const persistence = await resolveMessengerPersistenceMode();
    const conversation = await buildMessengerConversationPayload(sessionId, sceneId, persistence);
    return res.status(200).json(conversation);
  } catch (error) {
    console.error('Error in GET /api/messenger/chat:', error);
    return res.status(500).json({ message: 'Server error while loading messenger chat.' });
  }
});

app.post('/api/messenger/chat', handleMessengerChatPost);
app.post('/api/sendMessage', handleMessengerChatPost);

app.delete('/api/messenger/chat', async (req, res) => {
  try {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const sceneId = normalizeMessengerSceneId(req.query?.sceneId);
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const persistence = await resolveMessengerPersistenceMode();
    const deletion = await deleteMessengerConversation(sessionId, sceneId, persistence);
    const deletedSceneBriefCount = await deleteMessengerSceneBrief(sessionId, sceneId, persistence);
    return res.status(200).json({
      sessionId,
      sceneId,
      deletedCount: (deletion?.deletedCount || 0) + deletedSceneBriefCount,
      deletedMessagesCount: deletion?.deletedCount || 0,
      deletedSceneBriefCount,
      storage: persistence
    });
  } catch (error) {
    console.error('Error in DELETE /api/messenger/chat:', error);
    return res.status(500).json({ message: 'Server error while clearing messenger chat.' });
  }
});

app.post('/api/next_film_image', async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const discoveredBackgrounds = collectTypewriterPageImages(
      ASSETS_ROOTS,
      TYPEWRITER_PAGE_IMAGES_SUBDIR,
      TYPEWRITER_ALLOWED_PAGE_IMAGE_EXTENSIONS
    );
    const availableBackgrounds = discoveredBackgrounds.length
      ? discoveredBackgrounds
      : TYPEWRITER_DEFAULT_SERVER_BACKGROUNDS;
    const backgroundPath = pickRandomItem(availableBackgrounds) || availableBackgrounds[0];
    const backgroundUrl = buildAbsoluteAssetUrl(req, backgroundPath);
    if (!backgroundUrl) {
      return res.status(500).json({ error: 'No typewriter page image available' });
    }

    const fontStyle = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
    return res.status(200).json({ image_url: backgroundUrl, image_path: backgroundPath, ...fontStyle });
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

    const wordCount = countWords(latestAddition);
    const goldenThreshold = Math.max(minWords, Math.floor((lastGhostwriterWordCount || 1) / goldenRatio));
    if (wordCount < goldenThreshold) {
      return res.status(200).json({ shouldGenerate: false });
    }

    const totalLength = countWords(currentText);
    const additionChars = String(latestAddition || '').trim().length;

    const hardMinimumPauseSeconds = 4.2;
    if (latestPauseSeconds < hardMinimumPauseSeconds) {
      return res.status(200).json({ shouldGenerate: false });
    }

    // Keep continuation from interrupting likely writing sprees.
    if (wordCount >= 8 && latestPauseSeconds < 6.8) {
      return res.status(200).json({ shouldGenerate: false });
    }
    if (wordCount >= 14 && latestPauseSeconds < 8.6) {
      return res.status(200).json({ shouldGenerate: false });
    }

    const basePause = 5.4;
    const narrativeFactor = clampValue(totalLength * 0.018, 0, 3.5);
    const additionFactor = clampValue(wordCount * 0.11, 0, 2.2);
    const densityFactor = clampValue(additionChars / 120, 0, 1.2);
    const requiredPause = basePause + narrativeFactor + additionFactor + densityFactor;

    return res.status(200).json({ shouldGenerate: latestPauseSeconds >= requiredPause });
  } catch (error) {
    console.error('Error in /api/shouldGenerateContinuation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/typewriter/session/start', async (req, res) => {
  try {
    const { sessionId, fragment, playerId } = req.body || {};
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);
    const session = await startTypewriterSession(sessionId);
    if (typeof fragment === 'string') {
      const seededSession = await saveTypewriterSessionFragment(session.sessionId, fragment);
      return res.status(200).json(
        await buildTypewriterSessionPayload(session.sessionId, seededSession.fragment, resolvedPlayerId)
      );
    }
    return res.status(200).json(
      await buildTypewriterSessionPayload(session.sessionId, session.fragment, resolvedPlayerId)
    );
  } catch (error) {
    console.error('Error in /api/typewriter/session/start:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/shouldCreateStorytellerKey', async (req, res) => {
  try {
    const body = req.body || {};
    const { sessionId, playerId } = body;
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    await startTypewriterSession(sessionId);
    const fragmentText = await getTypewriterSessionFragment(sessionId);
    const narrativeWordCount = countWords(fragmentText);
    const storytellerPipeline = await getAiPipelineSettings('storyteller_creation');
    const illustrationPipeline = await getAiPipelineSettings('illustration_creation');
    const shouldMockStorytellers = resolveMockMode(body, storytellerPipeline.useMock);
    const shouldMockIllustrations = resolveMockMode(body, illustrationPipeline.useMock);
    const allowMockSlots = shouldMockStorytellers || shouldMockIllustrations;
    const assignedStorytellers = await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId);
    const effectiveAssignedStorytellers = filterAssignedTypewriterStorytellers(assignedStorytellers, {
      allowMockSlots
    });
    const nextAvailableSlot = findNextAvailableTypewriterStorytellerSlot(effectiveAssignedStorytellers);
    const currentAssignedCount = effectiveAssignedStorytellers.length;
    const currentThreshold = getTypewriterStorytellerThreshold(currentAssignedCount);
    const shouldCreate = Boolean(nextAvailableSlot && currentThreshold !== null && narrativeWordCount >= currentThreshold);

    let createdStoryteller = null;
    if (shouldCreate && nextAvailableSlot) {
      createdStoryteller = await generateTypewriterStorytellerForSlot({
        sessionId,
        playerId: resolvedPlayerId,
        fragmentText,
        slotDefinition: nextAvailableSlot,
        req,
        body
      });
    }

    const storytellers = createdStoryteller
      ? await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId)
      : effectiveAssignedStorytellers;
    const visibleStorytellers = filterAssignedTypewriterStorytellers(storytellers, { allowMockSlots });
    const filledCount = visibleStorytellers.length;
    const nextThreshold = getTypewriterStorytellerThreshold(filledCount);

    return res.status(200).json({
      sessionId,
      narrativeWordCount,
      checkIntervalWords: TYPEWRITER_STORYTELLER_CHECK_INTERVAL_WORDS,
      shouldCreate,
      created: Boolean(createdStoryteller),
      createdStoryteller: createdStoryteller ? buildStorytellerListItem(createdStoryteller) : null,
      assignedStorytellerCount: filledCount,
      nextThreshold,
      slots: buildTypewriterStorytellerSlots(visibleStorytellers),
      entityKeys: (await listTypewriterStoryEntities(sessionId, resolvedPlayerId)).map(buildTypewriterEntityKeyState)
    });
  } catch (error) {
    console.error('Error in /api/shouldCreateStorytellerKey:', error);
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    return res.status(statusCode).json({
      message: statusCode === 500 ? 'Server error during storyteller key creation check.' : error.message
    });
  }
});

app.post('/api/send_storyteller_typewriter_text', async (req, res) => {
  try {
    const body = req.body || {};
    const { sessionId, storytellerId } = body;
    const slotIndexRaw = Number(body.slotIndex);
    const slotIndex = Number.isInteger(slotIndexRaw) ? slotIndexRaw : null;
    const resolvedPlayerId = normalizeOptionalPlayerId(body.playerId);

    if (!sessionId || (!storytellerId && slotIndex === null)) {
      return res.status(400).json({ error: 'Missing sessionId and storytellerId or slotIndex.' });
    }

    await startTypewriterSession(sessionId);
    const fragmentText = await getTypewriterSessionFragment(sessionId);
    const storyteller = await findTypewriterStorytellerForIntervention(
      sessionId,
      storytellerId,
      slotIndex,
      resolvedPlayerId
    );

    if (!storyteller) {
      return res.status(404).json({ error: 'Storyteller not found for this session.' });
    }

    const interventionPipeline = await getAiPipelineSettings('storyteller_intervention');
    const interventionProvider = typeof interventionPipeline?.provider === 'string'
      ? interventionPipeline.provider
      : 'openai';
    const shouldMock = resolveMockMode(body, interventionPipeline.useMock);
    const requestedFadeTimingScale = toFiniteNumber(body?.fadeTimingScale);

    let interventionResponse;
    if (shouldMock) {
      interventionResponse = buildMockStorytellerIntervention(storyteller, fragmentText);
    } else {
      const promptTemplate = await resolveStorytellerInterventionPromptTemplate();
      interventionResponse = await callJsonLlm({
        prompts: buildStorytellerInterventionPromptMessages(storyteller, fragmentText, promptTemplate),
        provider: interventionProvider,
        model: interventionPipeline.model || '',
        max_tokens: 1800,
        explicitJsonObjectFormat: true
      });
    }

    const continuation = firstDefinedString(interventionResponse?.continuation);
    if (!continuation) {
      return res.status(502).json({
        error: 'Storyteller intervention did not return valid continuation text.',
        runtime: {
          pipeline: 'storyteller_intervention',
          provider: interventionProvider,
          model: interventionPipeline.model || '',
          mocked: shouldMock
        }
      });
    }

    const rawEntity = interventionResponse?.entity && typeof interventionResponse.entity === 'object'
      ? interventionResponse.entity
      : null;
    if (!rawEntity || !firstDefinedString(rawEntity.name, rawEntity.key_text)) {
      return res.status(502).json({
        error: 'Storyteller intervention did not return a valid entity.',
        runtime: {
          pipeline: 'storyteller_intervention',
          provider: interventionProvider,
          model: interventionPipeline.model || '',
          mocked: shouldMock
        }
      });
    }

    const metadata = normalizeTypewriterMetadata(interventionResponse?.style)
      || pickRandomItem(TYPEWRITER_DEFAULT_FONTS)
      || TYPEWRITER_DEFAULT_FONTS[0];
    const nextFragment = mergeTypewriterFragment(fragmentText, continuation);
    const savedEntity = await saveTypewriterEntityFromIntervention({
      sessionId,
      playerId: resolvedPlayerId,
      storyteller,
      entity: rawEntity
    });
    const updatedStoryteller = await Storyteller.findOneAndUpdate(
      { _id: storyteller._id },
      {
        $set: {
          introducedInTypewriter: true,
          lastTypewriterInterventionAt: new Date()
        },
        $inc: {
          typewriterInterventionsCount: 1
        }
      },
      { new: true }
    );

    await saveTypewriterSessionFragment(sessionId, nextFragment);

    const continuationInsights = normalizeContinuationInsights(
      {
        meaning: [
          `${firstDefinedString(updatedStoryteller?.name, storyteller?.name)} briefly entered the narrative.`
        ],
        contextual_strengthening: `The intervention surfaced ${firstDefinedString(savedEntity?.name)} as a fresh point of interest in the scene.`,
        entities: [
          {
            entity_name: firstDefinedString(savedEntity?.name),
            ner_category: firstDefinedString(savedEntity?.type),
            ascope_pmesii: firstDefinedString(savedEntity?.subtype),
            reuse: false
          }
        ],
        style: metadata
      },
      continuation,
      metadata
    );

    return res.status(200).json({
      ...createTypewriterResponse(continuation, metadata, null, {
        narrativeWordCount: countWords(fragmentText),
        fadeTimingScale: requestedFadeTimingScale
      }),
      continuation_insights: continuationInsights,
      sessionId,
      fragment: nextFragment,
      mocked: shouldMock,
      storyteller: buildStorytellerListItem(updatedStoryteller || storyteller),
      entityKey: buildTypewriterEntityKeyState(savedEntity),
      entityKeys: (await listTypewriterStoryEntities(sessionId, resolvedPlayerId)).map(buildTypewriterEntityKeyState),
      runtime: {
        pipeline: 'storyteller_intervention',
        provider: interventionProvider,
        model: interventionPipeline.model || '',
        mocked: shouldMock
      }
    });
  } catch (error) {
    console.error('Error in /api/send_storyteller_typewriter_text:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/send_typewriter_text', async (req, res) => {
  try {
    const { sessionId, message } = req.body || {};
    if (!sessionId || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }
    const requestedFadeTimingScale = toFiniteNumber(req.body?.fadeTimingScale);

    await startTypewriterSession(sessionId);

    const continuationPipeline = await getAiPipelineSettings('story_continuation');
    const continuationProvider = typeof continuationPipeline?.provider === 'string'
      ? continuationPipeline.provider
      : 'openai';
    const shouldMock = resolveMockMode(req.body, continuationPipeline.useMock);
    if (shouldMock) {
      const mockMetadata = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
      const continuation = buildMockContinuation(message);
      const nextFragment = mergeTypewriterFragment(message, continuation);
      const narrativeWordCount = countWords(message);
      const continuationInsights = normalizeContinuationInsights({}, continuation, mockMetadata);
      await saveTypewriterSessionFragment(sessionId, nextFragment);
      return res.status(200).json({
        ...createTypewriterResponse(continuation, mockMetadata, null, {
          narrativeWordCount,
          fadeTimingScale: requestedFadeTimingScale
        }),
        continuation_insights: continuationInsights,
        sessionId,
        fragment: nextFragment,
        mocked: true,
        runtime: {
          pipeline: 'story_continuation',
          provider: continuationProvider,
          model: continuationPipeline.model || '',
          mocked: true
        }
      });
    }

    try {
      const continuationPromptDoc = await getLatestPromptTemplate('story_continuation');
      const prompt = buildTypewriterPromptMessages(message, continuationPromptDoc?.promptTemplate || '');
      const aiResponse = await callJsonLlm({
        prompts: prompt,
        provider: continuationProvider,
        model: continuationPipeline.model || '',
        max_tokens: 2500,
        explicitJsonObjectFormat: true
      });
      const continuation = typeof aiResponse?.continuation === 'string' && aiResponse.continuation.trim()
        ? aiResponse.continuation.trim()
        : '';
      if (!continuation) {
        return res.status(502).json({
          error: 'Live typewriter continuation did not return valid content.',
          runtime: {
            pipeline: 'story_continuation',
            provider: continuationProvider,
            model: continuationPipeline.model || '',
            mocked: false
          }
        });
      }
      const metadata = normalizeTypewriterMetadata(aiResponse?.style || aiResponse?.metadata)
        || pickRandomItem(TYPEWRITER_DEFAULT_FONTS)
        || TYPEWRITER_DEFAULT_FONTS[0];
      const nextFragment = mergeTypewriterFragment(message, continuation);
      const narrativeWordCount = countWords(message);
      const continuationInsights = normalizeContinuationInsights(aiResponse, continuation, metadata);

      await saveTypewriterSessionFragment(sessionId, nextFragment);

      return res.status(200).json({
        ...createTypewriterResponse(continuation, metadata, null, {
          narrativeWordCount,
          fadeTimingScale: requestedFadeTimingScale
        }),
        continuation_insights: continuationInsights,
        sessionId,
        fragment: nextFragment,
        mocked: false,
        runtime: {
          pipeline: 'story_continuation',
          provider: continuationProvider,
          model: continuationPipeline.model || '',
          mocked: false
        }
      });
    } catch (aiError) {
      console.error('Error in live /api/send_typewriter_text call:', aiError);
      return res.status(502).json({
        error: 'Live typewriter continuation failed.',
        details: aiError?.message || 'Unknown error',
        runtime: {
          pipeline: 'story_continuation',
          provider: continuationProvider,
          model: continuationPipeline.model || '',
          mocked: false
        }
      });
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
  typewriter_key: {
    symbol: 'ravine eye',
    description: 'A weathered brass key veined with smoky lacquer and a dim silver gleam.',
    key_shape: 'horizontal',
    shape_prompt_hint: 'wide horizontal key face with a centered emblem and calm edge margins'
  },
  voice_creation: {
    style: 'measured',
    voice: 'low, smoky, almost whispered',
    age: 'ageless'
  },
  influences: [
    'Ashen Cantos',
    'Voyager Myths'
  ],
  known_universes: ['Yuradel Pass', 'The Last Plateau'],
  level: 9,
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
  return typeof body?.text === 'string' ? body.text : '';
}

function normalizeOptionalPlayerId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function applyOptionalPlayerId(query, playerId) {
  const safePlayerId = normalizeOptionalPlayerId(playerId);
  if (safePlayerId) {
    query.playerId = safePlayerId;
  }
  return query;
}

function matchesOptionalPlayerId(actualPlayerId, expectedPlayerId) {
  const safeExpectedPlayerId = normalizeOptionalPlayerId(expectedPlayerId);
  if (!safeExpectedPlayerId) {
    return true;
  }
  return normalizeOptionalPlayerId(actualPlayerId) === safeExpectedPlayerId;
}

function pickMockStorytellerIllustrationUrl(index = 0) {
  if (!MOCK_STORYTELLER_ILLUSTRATION_URLS.length) {
    return '';
  }
  return MOCK_STORYTELLER_ILLUSTRATION_URLS[index % MOCK_STORYTELLER_ILLUSTRATION_URLS.length];
}

function pickMockStorytellerKeyUrl(index = 0) {
  if (!MOCK_STORYTELLER_KEY_URLS.length) {
    return '';
  }
  return MOCK_STORYTELLER_KEY_URLS[index % MOCK_STORYTELLER_KEY_URLS.length];
}

function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function getTypewriterStorytellerThreshold(activeCount = 0) {
  if (!Number.isInteger(activeCount) || activeCount < 0) {
    return null;
  }
  return TYPEWRITER_STORYTELLER_WORD_THRESHOLDS[activeCount] ?? null;
}

function buildTypewriterStorytellerKeyPayload(typewriterKey, slotDefinition) {
  const safeTypewriterKey = typewriterKey && typeof typewriterKey === 'object' ? typewriterKey : {};
  return {
    ...safeTypewriterKey,
    symbol: firstDefinedString(safeTypewriterKey.symbol) || 'ink sigil',
    description:
      firstDefinedString(safeTypewriterKey.description) || 'A weathered key carrying a strange narrative charge.',
    key_shape: slotDefinition.keyShape,
    blank_shape: slotDefinition.blankShape,
    blank_texture_url: slotDefinition.blankTextureUrl,
    shape_prompt_hint: slotDefinition.shapePromptHint
  };
}

function getTypewriterStorytellerSlotDefinition(slotIndex) {
  return TYPEWRITER_STORYTELLER_KEY_SLOTS.find((slot) => slot.slotIndex === slotIndex) || null;
}

function buildTypewriterStorytellerSlotState(slotDefinition, storyteller = null) {
  const keyImageUrl = firstDefinedString(storyteller?.keyImageLocalUrl, storyteller?.keyImageUrl);
  return {
    slotIndex: slotDefinition.slotIndex,
    slotKey: slotDefinition.slotKey,
    keyShape: slotDefinition.keyShape,
    blankTextureUrl: slotDefinition.blankTextureUrl,
    blankShape: slotDefinition.blankShape,
    filled: Boolean(storyteller && keyImageUrl),
    storytellerId: storyteller?._id || '',
    storytellerName: storyteller?.name || '',
    keyImageUrl,
    symbol: firstDefinedString(storyteller?.typewriter_key?.symbol),
    description: firstDefinedString(storyteller?.typewriter_key?.description)
  };
}

function buildTypewriterStorytellerSlots(storytellers = []) {
  const storytellerBySlot = new Map();
  for (const storyteller of storytellers) {
    if (!Number.isInteger(storyteller?.keySlotIndex)) continue;
    if (!TYPEWRITER_STORYTELLER_SLOT_INDICES.includes(storyteller.keySlotIndex)) continue;
    if (!storytellerBySlot.has(storyteller.keySlotIndex)) {
      storytellerBySlot.set(storyteller.keySlotIndex, storyteller);
    }
  }
  return TYPEWRITER_STORYTELLER_KEY_SLOTS.map((slotDefinition) =>
    buildTypewriterStorytellerSlotState(slotDefinition, storytellerBySlot.get(slotDefinition.slotIndex) || null)
  );
}

function normalizeLooseStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeTypewriterEntityKeyText(value, fallbackName = '') {
  const base = firstDefinedString(value, fallbackName) || 'Hidden Omen';
  const cleaned = base
    .replace(/[^a-zA-Z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return 'Hidden Omen';
  }
  return cleaned
    .split(' ')
    .slice(0, 3)
    .join(' ');
}

function buildTypewriterEntityKeyState(entity) {
  return {
    id: String(entity?._id || ''),
    entityName: firstDefinedString(entity?.name) || 'Unnamed entity',
    keyText: normalizeTypewriterEntityKeyText(entity?.typewriterKeyText, entity?.name),
    summary: firstDefinedString(entity?.description, entity?.lore, entity?.relevance),
    storytellerId: firstDefinedString(entity?.introducedByStorytellerId),
    storytellerName: firstDefinedString(entity?.introducedByStorytellerName),
    createdAt: entity?.createdAt || null
  };
}

function isMockStorytellerKeyUrl(value) {
  return typeof value === 'string' && value.includes('/assets/mocks/storyteller_keys/');
}

function isReplaceableMockTypewriterStoryteller(storyteller) {
  const keyImageUrl = firstDefinedString(storyteller?.keyImageLocalUrl, storyteller?.keyImageUrl);
  return isMockStorytellerKeyUrl(keyImageUrl);
}

function filterAssignedTypewriterStorytellers(storytellers = [], options = {}) {
  const allowMockSlots = options.allowMockSlots !== false;
  if (allowMockSlots) return storytellers;
  return storytellers.filter((storyteller) => !isReplaceableMockTypewriterStoryteller(storyteller));
}

function findNextAvailableTypewriterStorytellerSlot(storytellers = []) {
  const assignedSlots = new Set(
    storytellers
      .map((storyteller) => storyteller?.keySlotIndex)
      .filter((slotIndex) => Number.isInteger(slotIndex) && TYPEWRITER_STORYTELLER_SLOT_INDICES.includes(slotIndex))
  );
  return TYPEWRITER_STORYTELLER_KEY_SLOTS.find((slotDefinition) => !assignedSlots.has(slotDefinition.slotIndex)) || null;
}

async function listTypewriterSlotStorytellers(sessionId, playerId = '') {
  if (!sessionId) return [];
  return Storyteller.find(
    applyOptionalPlayerId(
      {
        session_id: sessionId,
        keySlotIndex: { $in: TYPEWRITER_STORYTELLER_SLOT_INDICES }
      },
      playerId
    )
  )
    .sort({ keySlotIndex: 1, createdAt: 1 })
    .exec();
}

async function listTypewriterStoryEntities(sessionId, playerId = '') {
  if (!sessionId) return [];
  return NarrativeEntity.find(
    applyOptionalPlayerId(
      {
        session_id: sessionId,
        typewriterKeyText: { $exists: true, $ne: '' },
        activeInTypewriter: true
      },
      playerId
    )
  )
    .sort({ createdAt: -1 })
    .limit(8)
    .exec();
}

async function buildTypewriterSessionPayload(sessionId, fragment, playerId = '') {
  const entityKeys = (await listTypewriterStoryEntities(sessionId, playerId)).map(buildTypewriterEntityKeyState);
  return {
    sessionId,
    fragment,
    entityKeys
  };
}

async function generateTypewriterStorytellerForSlot({
  sessionId,
  playerId,
  fragmentText,
  slotDefinition,
  req,
  body = {}
}) {
  const storytellerPipeline = await getAiPipelineSettings('storyteller_creation');
  const illustrationPipeline = await getAiPipelineSettings('illustration_creation');
  const storytellerProvider = typeof storytellerPipeline?.provider === 'string' ? storytellerPipeline.provider : 'openai';
  const storytellerPromptDoc = await getLatestPromptTemplate('storyteller_creation');
  const shouldMockStorytellers = resolveMockMode(body, storytellerPipeline.useMock);

  let storytellerDataArray;
  if (shouldMockStorytellers) {
    storytellerDataArray = buildMockStorytellers(1, fragmentText);
  } else {
    let prompt = '';
    if (storytellerPromptDoc?.promptTemplate) {
      prompt = renderPromptTemplateString(storytellerPromptDoc.promptTemplate, {
        fragmentText,
        storytellerCount: 1
      });
    } else {
      const routeConfig = await getRouteConfig('text_to_storyteller');
      prompt = renderPrompt(routeConfig.promptTemplate, {
        fragmentText,
        storytellerCount: 1
      });
    }
    storytellerDataArray = await callJsonLlm({
      prompts: [{ role: 'system', content: prompt }],
      provider: storytellerProvider,
      model: storytellerPipeline.model || '',
      max_tokens: 2500,
      explicitJsonObjectFormat: true
    });
  }

  const normalizedStorytellers = Array.isArray(storytellerDataArray)
    ? storytellerDataArray
    : Array.isArray(storytellerDataArray?.storytellers)
      ? storytellerDataArray.storytellers
      : [];
  if (!normalizedStorytellers.length) {
    const error = new Error('Storyteller generation failed.');
    error.statusCode = 502;
    throw error;
  }

  await validatePayloadForRoute('text_to_storyteller', { storytellers: normalizedStorytellers });

  const storytellerData = normalizedStorytellers[0];
  const payload = {
    session_id: sessionId,
    sessionId,
    fragmentText,
    ...storytellerData
  };
  if (playerId) {
    payload.playerId = playerId;
  }
  payload.typewriter_key = buildTypewriterStorytellerKeyPayload(payload.typewriter_key, slotDefinition);
  payload.keyShape = slotDefinition.keyShape;
  payload.keyBlankTextureUrl = slotDefinition.blankTextureUrl;
  payload.keySlotIndex = slotDefinition.slotIndex;

  if (shouldMockStorytellers) {
    payload.keyImageUrl = pickMockStorytellerKeyUrl(slotDefinition.slotIndex);
    payload.keyImageLocalUrl = payload.keyImageUrl;
    payload.keyImageLocalPath = '';
  } else {
    const keyImageResult = await createStoryTellerKey(
      payload.typewriter_key,
      sessionId,
      payload.name,
      false,
      illustrationPipeline.model,
      ''
    );
    if (!keyImageResult?.imageUrl && !keyImageResult?.localPath) {
      const error = new Error('Storyteller key image generation failed.');
      error.statusCode = 502;
      throw error;
    }
    const localUrl = keyImageResult?.localPath
      ? `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_keys/${path.basename(keyImageResult.localPath)}`
      : '';
    payload.keyImageUrl = keyImageResult?.imageUrl || localUrl;
    payload.keyImageLocalUrl = localUrl || payload.keyImageUrl;
    payload.keyImageLocalPath = keyImageResult?.localPath || '';
  }

  return Storyteller.findOneAndUpdate(
    applyOptionalPlayerId(
      {
        session_id: sessionId,
        keySlotIndex: slotDefinition.slotIndex
      },
      playerId
    ),
    payload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function buildStorytellerListItem(storyteller) {
  const illustration = firstDefinedString(storyteller?.illustration);
  const keyImageUrl = firstDefinedString(storyteller?.keyImageUrl);
  const slotDefinition = getTypewriterStorytellerSlotDefinition(storyteller?.keySlotIndex);
  return {
    id: storyteller._id,
    name: storyteller.name,
    status: storyteller.status,
    level: storyteller.level,
    illustration,
    keyImageUrl,
    iconUrl: keyImageUrl || illustration,
    keyShape: firstDefinedString(storyteller?.keyShape, storyteller?.typewriter_key?.key_shape),
    keySlotIndex: Number.isInteger(storyteller?.keySlotIndex) ? storyteller.keySlotIndex : null,
    keyBlankTextureUrl: firstDefinedString(
      storyteller?.keyBlankTextureUrl,
      storyteller?.typewriter_key?.blank_texture_url,
      slotDefinition?.blankTextureUrl
    ),
    lastMission: buildLastMissionSummary(storyteller)
  };
}

function buildStorytellerInterventionPromptPayload(storyteller, fragmentText) {
  const typewriterKey = storyteller?.typewriter_key && typeof storyteller.typewriter_key === 'object'
    ? storyteller.typewriter_key
    : {};
  const voiceCreation = storyteller?.voice_creation && typeof storyteller.voice_creation === 'object'
    ? storyteller.voice_creation
    : {};
  return {
    storyteller_name: firstDefinedString(storyteller?.name) || 'Unnamed storyteller',
    storyteller_immediate_ghost_appearance: firstDefinedString(storyteller?.immediate_ghost_appearance),
    storyteller_symbol: firstDefinedString(typewriterKey.symbol) || 'ink sigil',
    storyteller_key_description: firstDefinedString(typewriterKey.description)
      || 'A weathered key carrying a strange narrative charge.',
    storyteller_voice: firstDefinedString(voiceCreation.voice),
    storyteller_age: firstDefinedString(voiceCreation.age),
    storyteller_style: firstDefinedString(voiceCreation.style),
    storyteller_influences: normalizeLooseStringArray(storyteller?.influences).join(', '),
    storyteller_known_universes: normalizeLooseStringArray(storyteller?.known_universes).join(', '),
    storyteller_already_introduced: storyteller?.introducedInTypewriter ? 'true' : 'false',
    fragment_text: typeof fragmentText === 'string' ? fragmentText : ''
  };
}

async function resolveStorytellerInterventionPromptTemplate() {
  const latestPrompt = await getLatestPromptTemplate('storyteller_intervention');
  if (latestPrompt?.promptTemplate) {
    return latestPrompt.promptTemplate;
  }
  const currentTemplates = await getCurrentTypewriterPromptTemplates();
  return currentTemplates?.storyteller_intervention?.promptTemplate || '';
}

function buildStorytellerInterventionPromptMessages(storyteller, fragmentText, promptTemplate) {
  const payload = buildStorytellerInterventionPromptPayload(storyteller, fragmentText);
  const renderedPrompt = renderPromptTemplateString(promptTemplate, payload);
  return [
    { role: 'system', content: renderedPrompt },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

function pickMockStoryEntitySeed(fragmentText = '') {
  const lowered = String(fragmentText || '').toLowerCase();
  if (/(sea|lighthouse|harbor|bay|storm)/.test(lowered)) {
    return {
      name: 'Buraha Light-Wake',
      key_text: 'Buraha Light',
      summary: 'A slow intelligence hiding inside the blue sea-lights, felt before it is understood.',
      type: 'omen',
      subtype: 'marine anomaly',
      lore: 'It moves like weather pretending to be thought.',
      tags: ['sea', 'light', 'witness']
    };
  }
  if (/(tower|watch|watchman|bell|gate)/.test(lowered)) {
    return {
      name: 'Threshold Bell-Memory',
      key_text: 'Threshold Bell',
      summary: 'A remembered toll that hangs in the air after the iron has already fallen still.',
      type: 'omen',
      subtype: 'threshold residue',
      lore: 'Some places continue ringing after the metal forgets how.',
      tags: ['threshold', 'bell', 'memory']
    };
  }
  return {
    name: 'Inkward Trace',
    key_text: 'Inkward Trace',
    summary: 'A faint narrative residue that suggests something unseen has been following the scene.',
    type: 'omen',
    subtype: 'narrative trace',
    lore: 'It appears where observation lingers too long.',
    tags: ['ink', 'trace', 'observation']
  };
}

function buildMockStorytellerIntervention(storyteller, fragmentText) {
  const entity = pickMockStoryEntitySeed(fragmentText);
  const storytellerName = firstDefinedString(storyteller?.name) || 'The hidden storyteller';
  const entityName = firstDefinedString(entity.name);
  const alreadyIntroduced = Boolean(storyteller?.introducedInTypewriter);
  const continuation = alreadyIntroduced
    ? `I returned only for a moment, long enough to follow the drift around ${entityName}. It was there, half-seen beside the scene, taking shape in the weather of what had already begun. I watched it gather its meaning, marked the disturbance it left in the air, and withdrew before anyone could decide I had always been standing there.`
    : `It was then that I, ${storytellerName}, admitted myself to the margin of the scene. I had been near enough to witness the change, and nearer still when ${entityName} revealed itself inside it: not a thing exactly, but a pressure with a face the night almost knew. I followed that sign until it sharpened, learned what little it wanted, and then let the scene keep moving without me.`;
  return {
    continuation,
    entity,
    style: pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0]
  };
}

async function saveTypewriterEntityFromIntervention({
  sessionId,
  playerId = '',
  storyteller,
  entity
}) {
  const entityName = firstDefinedString(entity?.name) || 'Unnamed entity';
  const keyText = normalizeTypewriterEntityKeyText(entity?.key_text, entityName);
  const externalId = firstDefinedString(entity?.external_id) || randomUUID();
  return NarrativeEntity.findOneAndUpdate(
    applyOptionalPlayerId(
      {
        session_id: sessionId,
        introducedByStorytellerId: String(storyteller?._id || ''),
        typewriterKeyText: keyText
      },
      playerId
    ),
    {
      session_id: sessionId,
      sessionId,
      playerId: playerId || firstDefinedString(storyteller?.playerId),
      name: entityName,
      description: firstDefinedString(entity?.summary) || 'A newly surfaced narrative entity.',
      lore: firstDefinedString(entity?.lore),
      type: firstDefinedString(entity?.type) || 'omen',
      subtype: firstDefinedString(entity?.subtype),
      universalTraits: normalizeLooseStringArray(entity?.tags),
      relevance: `Introduced during a typewriter intervention by ${firstDefinedString(storyteller?.name) || 'an unnamed storyteller'}.`,
      externalId,
      typewriterKeyText: keyText,
      typewriterSource: 'storyteller_intervention',
      introducedByStorytellerId: String(storyteller?._id || ''),
      introducedByStorytellerName: firstDefinedString(storyteller?.name),
      sourceStorytellerKeySlot: Number.isInteger(storyteller?.keySlotIndex) ? storyteller.keySlotIndex : null,
      activeInTypewriter: true
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function findTypewriterStorytellerForIntervention(sessionId, storytellerId, slotIndex, playerId = '') {
  if (storytellerId) {
    return Storyteller.findOne(
      applyOptionalPlayerId(
        {
          _id: storytellerId,
          session_id: sessionId
        },
        playerId
      )
    );
  }
  if (Number.isInteger(slotIndex)) {
    return Storyteller.findOne(
      applyOptionalPlayerId(
        {
          session_id: sessionId,
          keySlotIndex: slotIndex
        },
        playerId
      )
    );
  }
  return null;
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

function normalizeEntityCount(value, fallback = 8) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return fallback;
  }
  return Math.min(Math.max(1, Math.floor(count)), 12);
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
      description: 'A tarnished brass key with a faint glow.',
      key_shape: 'horizontal',
      shape_prompt_hint: 'wide horizontal key face with a centered emblem and calm edge margins'
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

  const byExternalId = await NarrativeEntity.findOne(
    applyOptionalPlayerId(
      {
        session_id: sessionId,
        externalId: String(entityId)
      },
      playerId
    )
  );
  if (byExternalId) {
    return byExternalId;
  }

  return NarrativeEntity.findOne(
    applyOptionalPlayerId(
      {
        _id: entityId,
        session_id: sessionId
      },
      playerId
    )
  );
}

// --- Admin LLM Route Config ---
app.get('/api/admin/typewriter/ai-settings', requireAdmin, async (req, res) => {
  try {
    const settings = await getTypewriterAiSettings();
    return res.status(200).json({
      ...settings,
      pipelinesMeta: getTypewriterPipelineDefinitions()
    });
  } catch (error) {
    console.error('Error in GET /api/admin/typewriter/ai-settings:', error);
    return res.status(500).json({ message: 'Server error while loading typewriter AI settings.' });
  }
});

app.put('/api/admin/typewriter/ai-settings', requireAdmin, async (req, res) => {
  try {
    const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
      ? req.body.updatedBy.trim()
      : 'admin';
    const updated = await updateTypewriterAiSettings(req.body || {}, updatedBy);
    return res.status(200).json({
      ...updated,
      pipelinesMeta: getTypewriterPipelineDefinitions()
    });
  } catch (error) {
    if (error.code === 'INVALID_PIPELINE_KEY') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in PUT /api/admin/typewriter/ai-settings:', error);
    return res.status(500).json({ message: 'Server error while updating typewriter AI settings.' });
  }
});

app.post('/api/admin/typewriter/ai-settings/reset', requireAdmin, async (req, res) => {
  try {
    const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
      ? req.body.updatedBy.trim()
      : 'admin';
    const resetSettings = await resetTypewriterAiSettings(updatedBy);
    return res.status(200).json({
      ...resetSettings,
      pipelinesMeta: getTypewriterPipelineDefinitions()
    });
  } catch (error) {
    console.error('Error in POST /api/admin/typewriter/ai-settings/reset:', error);
    return res.status(500).json({ message: 'Server error while resetting typewriter AI settings.' });
  }
});

app.get('/api/admin/openai/models', requireAdmin, async (req, res) => {
  try {
    const forceRefresh = parseBooleanFlag(req.query?.forceRefresh) === true
      || parseBooleanFlag(req.query?.refresh) === true;
    const [openAiModelsPayload, anthropicModelsPayload] = await Promise.all([
      listAvailableOpenAiModels({ forceRefresh }),
      listAvailableAnthropicModels({ forceRefresh })
    ]);
    return res.status(200).json({
      ...openAiModelsPayload,
      providers: {
        openai: openAiModelsPayload,
        anthropic: anthropicModelsPayload
      }
    });
  } catch (error) {
    console.error('Error in GET /api/admin/openai/models:', error);
    return res.status(500).json({ message: 'Server error while loading OpenAI models.' });
  }
});

app.get('/api/admin/typewriter/prompts', requireAdmin, async (req, res) => {
  try {
    const latest = await listLatestPromptTemplates();
    const currentTemplates = await getCurrentTypewriterPromptTemplates();
    const mergedPipelines = {};

    for (const [pipelineKey, definition] of Object.entries(currentTemplates)) {
      mergedPipelines[pipelineKey] = latest?.pipelines?.[pipelineKey] || {
        id: '',
        pipelineKey,
        version: 0,
        promptTemplate: definition.promptTemplate,
        isLatest: true,
        createdBy: 'code-default',
        createdAt: '',
        updatedAt: '',
        meta: {
          source: definition.source,
          variables: definition.variables,
          fallbackFromCode: true
        }
      };
    }

    return res.status(200).json({
      pipelines: mergedPipelines,
      pipelinesMeta: getTypewriterPromptDefinitions()
    });
  } catch (error) {
    console.error('Error in GET /api/admin/typewriter/prompts:', error);
    return res.status(500).json({ message: 'Server error while loading typewriter prompts.' });
  }
});

app.post('/api/admin/typewriter/prompts/seed-current', requireAdmin, async (req, res) => {
  try {
    const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
      ? req.body.updatedBy.trim()
      : 'admin';
    const overwrite = parseBooleanFlag(req.body?.overwrite) === true;
    const seeded = await seedCurrentTypewriterPromptTemplates({ updatedBy, overwrite });
    return res.status(200).json(seeded);
  } catch (error) {
    console.error('Error in POST /api/admin/typewriter/prompts/seed-current:', error);
    return res.status(500).json({ message: 'Server error while seeding current prompt templates.' });
  }
});

app.get('/api/admin/typewriter/prompts/:pipelineKey/versions', requireAdmin, async (req, res) => {
  try {
    const { pipelineKey } = req.params;
    const versions = await listPromptTemplateVersions(pipelineKey, req.query?.limit);
    if (versions.length === 0) {
      const currentTemplates = await getCurrentTypewriterPromptTemplates();
      const fallback = currentTemplates?.[pipelineKey];
      if (fallback) {
        return res.status(200).json({
          pipelineKey,
          versions: [
            {
              id: '',
              pipelineKey,
              version: 0,
              promptTemplate: fallback.promptTemplate,
              isLatest: true,
              createdBy: 'code-default',
              createdAt: '',
              updatedAt: '',
              meta: {
                source: fallback.source,
                variables: fallback.variables,
                fallbackFromCode: true
              }
            }
          ]
        });
      }
    }
    return res.status(200).json({ pipelineKey, versions });
  } catch (error) {
    if (error.code === 'INVALID_PIPELINE_KEY') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in GET /api/admin/typewriter/prompts/:pipelineKey/versions:', error);
    return res.status(500).json({ message: 'Server error while listing prompt versions.' });
  }
});

app.post('/api/admin/typewriter/prompts/:pipelineKey', requireAdmin, async (req, res) => {
  try {
    const { pipelineKey } = req.params;
    const promptTemplate = req.body?.promptTemplate;
    const createdBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
      ? req.body.updatedBy.trim()
      : 'admin';
    const saved = await savePromptTemplateVersion(pipelineKey, promptTemplate, createdBy, {
      markLatest: parseBooleanFlag(req.body?.markLatest) !== false,
      meta: req.body?.meta
    });
    return res.status(201).json(saved);
  } catch (error) {
    if (error.code === 'INVALID_PIPELINE_KEY' || error.code === 'INVALID_PROMPT_TEMPLATE') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in POST /api/admin/typewriter/prompts/:pipelineKey:', error);
    return res.status(500).json({ message: 'Server error while saving prompt template.' });
  }
});

app.post('/api/admin/typewriter/prompts/:pipelineKey/latest', requireAdmin, async (req, res) => {
  try {
    const { pipelineKey } = req.params;
    const latest = await setLatestPromptTemplate(pipelineKey, {
      id: req.body?.id,
      version: req.body?.version
    });
    return res.status(200).json(latest);
  } catch (error) {
    if (
      error.code === 'INVALID_PIPELINE_KEY'
      || error.code === 'INVALID_PROMPT_SELECTION'
      || error.code === 'PROMPT_VERSION_NOT_FOUND'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in POST /api/admin/typewriter/prompts/:pipelineKey/latest:', error);
    return res.status(500).json({ message: 'Server error while selecting latest prompt template.' });
  }
});

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

app.get('/api/admin/llm-config/:routeKey/versions', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const { limit = 20 } = req.query || {};
    const versions = await listRouteConfigVersions(routeKey, limit);
    return res.status(200).json({
      routeKey,
      versions
    });
  } catch (error) {
    if (error.code === 'INVALID_ROUTE_KEY') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in GET /api/admin/llm-config/:routeKey/versions:', error);
    return res.status(500).json({ message: 'Server error while listing route config versions.' });
  }
});

app.post('/api/admin/llm-config/:routeKey', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const {
      promptMode,
      promptTemplate,
      promptCore,
      responseSchema,
      fieldDocs,
      examplePayload,
      outputRules,
      updatedBy,
      markLatest
    } = req.body || {};

    const config = await saveRouteConfigVersion(routeKey, {
      promptMode,
      promptTemplate,
      promptCore,
      responseSchema,
      fieldDocs,
      examplePayload,
      outputRules,
      meta: { updatedBy: updatedBy || 'admin' }
    }, updatedBy || 'admin', {
      markLatest: markLatest === undefined ? true : Boolean(markLatest)
    });
    return res.status(200).json(config);
  } catch (error) {
    if (
      error.code === 'INVALID_ROUTE_KEY'
      || error.code === 'INVALID_PROMPT_TEMPLATE'
      || error.code === 'INVALID_RESPONSE_SCHEMA'
      || error.code === 'INVALID_EXAMPLE_PAYLOAD'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in POST /api/admin/llm-config/:routeKey:', error);
    return res.status(500).json({ message: 'Server error while saving route config version.' });
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

app.post('/api/admin/llm-config/:routeKey/latest', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const { id, version } = req.body || {};
    const config = await setLatestRouteConfig(routeKey, { id, version });
    return res.status(200).json(config);
  } catch (error) {
    if (
      error.code === 'INVALID_ROUTE_KEY'
      || error.code === 'INVALID_ROUTE_SELECTION'
      || error.code === 'ROUTE_CONFIG_VERSION_NOT_FOUND'
    ) {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in POST /api/admin/llm-config/:routeKey/latest:', error);
    return res.status(500).json({ message: 'Server error while selecting latest route config.' });
  }
});

app.post('/api/admin/llm-config/:routeKey/reset', requireAdmin, async (req, res) => {
  try {
    const { routeKey } = req.params;
    const { updatedBy } = req.body || {};
    const config = await resetRouteConfig(routeKey, updatedBy || 'admin');
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
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const storytellers = await Storyteller.find(
      applyOptionalPlayerId({ session_id: sessionId }, playerId)
    ).sort({ createdAt: 1 });
    const response = storytellers.map((storyteller) => buildStorytellerListItem(storyteller));

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

    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }
    const storyteller = await Storyteller.findById(id);
    if (!storyteller) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }
    if (storyteller.session_id !== sessionId || !matchesOptionalPlayerId(storyteller.playerId, playerId)) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }

    const storytellerPayload = storyteller.toObject ? storyteller.toObject() : JSON.parse(JSON.stringify(storyteller));
    storytellerPayload.iconUrl = storytellerPayload.keyImageUrl || storytellerPayload.illustration || '';
    return res.status(200).json({ storyteller: storytellerPayload });
  } catch (error) {
    console.error('Error in /api/storytellers/:id:', error);
    return res.status(500).json({ message: 'Server error during storyteller fetch.' });
  }
});

// List Entities
app.get('/api/entities', async (req, res) => {
  try {
    const { sessionId, playerId, mainEntityId, isSubEntity } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const query = applyOptionalPlayerId({ session_id: sessionId }, playerId);
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
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

    if (!sessionId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
    }

    const entity = await findEntityById(sessionId, resolvedPlayerId, id);
    if (!entity || entity.session_id !== sessionId || !matchesOptionalPlayerId(entity.playerId, resolvedPlayerId)) {
      return res.status(404).json({ message: 'Entity not found.' });
    }

    const promptText = [
      `Expand sub-entities related to "${entity.name}".`,
      entity.description ? `Description: ${entity.description}` : '',
      entity.lore ? `Lore: ${entity.lore}` : '',
      note ? `GM note: ${note}` : ''
    ].filter(Boolean).join('\n');

    const entityPipeline = await getAiPipelineSettings('entity_creation');
    const entityProvider = typeof entityPipeline?.provider === 'string' ? entityPipeline.provider : 'openai';
    const entityPromptDoc = await getLatestPromptTemplate('entity_creation');
    const shouldMock = resolveMockMode(body, entityPipeline.useMock);
    const subEntityResult = await textToEntityFromText({
      sessionId,
      playerId: resolvedPlayerId,
      text: promptText,
      includeCards: false,
      debug: shouldMock,
      llmModel: entityPipeline.model,
      llmProvider: entityProvider,
      entityPromptTemplate: entityPromptDoc?.promptTemplate || '',
      mainEntityId: entity.externalId || String(entity._id),
      isSubEntity: true
    });

    const subEntityExternalIds = (subEntityResult?.entities || [])
      .map((subEntity) => subEntity.externalId || subEntity.id)
      .filter(Boolean)
      .map((value) => String(value));

    const savedSubEntities = subEntityExternalIds.length
      ? await NarrativeEntity.find(
        applyOptionalPlayerId(
          {
            session_id: sessionId,
            externalId: { $in: subEntityExternalIds },
            mainEntityId: entity.externalId || String(entity._id)
          },
          resolvedPlayerId
        )
      )
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
      count,
      numberOfEntities,
      includeCards,
      includeFront,
      includeBack,
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = body;
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

    const fragmentText = await resolveFragmentText(body);

    if (!sessionId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or text.' });
    }

    const entityPipeline = await getAiPipelineSettings('entity_creation');
    const texturePipeline = await getAiPipelineSettings('texture_creation');
    const entityProvider = typeof entityPipeline?.provider === 'string' ? entityPipeline.provider : 'openai';
    const textureProvider = typeof texturePipeline?.provider === 'string' ? texturePipeline.provider : 'openai';
    const entityPromptDoc = await getLatestPromptTemplate('entity_creation');
    const entityFrontPromptDoc = await getLatestPromptTemplate('entity_card_front');
    const texturePromptDoc = await getLatestPromptTemplate('texture_creation');
    const entityCount = normalizeEntityCount(
      count ?? numberOfEntities,
      normalizeEntityCount(entityPipeline.entityCount, 8)
    );
    const shouldMockEntities = resolveMockMode(body, entityPipeline.useMock);
    const shouldMockTextures = resolveMockMode(body, texturePipeline.useMock);
    const options = {
      sessionId,
      playerId: resolvedPlayerId,
      text: fragmentText,
      entityCount,
      includeCards: includeCards === undefined ? false : Boolean(includeCards),
      includeFront: includeFront === undefined ? true : Boolean(includeFront),
      includeBack: includeBack === undefined ? true : Boolean(includeBack),
      debug: shouldMockEntities,
      llmModel: entityPipeline.model,
      llmProvider: entityProvider,
      textureModel: texturePipeline.model,
      mockTextures: shouldMockTextures,
      entityPromptTemplate: entityPromptDoc?.promptTemplate || '',
      frontPromptTemplate: entityFrontPromptDoc?.promptTemplate || '',
      texturePromptTemplate: texturePromptDoc?.promptTemplate || ''
    };

    const result = await textToEntityFromText(options);

    const response = {
      sessionId,
      count: result.entities?.length || 0,
      requestedCount: entityCount,
      entities: result.entities,
      mocked: result.mocked,
      mockedEntities: result.mockedEntities,
      mockedTextures: result.mockedTextures,
      runtime: {
        generation: {
          pipeline: 'entity_creation',
          provider: entityProvider,
          model: entityPipeline.model || '',
          mocked: shouldMockEntities
        },
        textures: {
          pipeline: 'texture_creation',
          provider: textureProvider,
          model: texturePipeline.model || '',
          mocked: shouldMockTextures
        }
      }
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
      debug,
      mock,
      mock_api_calls,
      mocked_api_calls
    } = body;
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);
    const fragmentText = await resolveFragmentText(body);

    if (!sessionId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or text.' });
    }

    const shouldGenerateKeyImages = generateKeyImages === undefined ? true : Boolean(generateKeyImages);
    const storytellerPipeline = await getAiPipelineSettings('storyteller_creation');
    const illustrationPipeline = await getAiPipelineSettings('illustration_creation');
    const storytellerProvider = typeof storytellerPipeline?.provider === 'string' ? storytellerPipeline.provider : 'openai';
    const illustrationProvider = typeof illustrationPipeline?.provider === 'string' ? illustrationPipeline.provider : 'openai';
    const storytellerCount = normalizeStorytellerCount(
      count ?? numberOfStorytellers ?? storytellerPipeline.storytellerCount
    );
    const storytellerPromptDoc = await getLatestPromptTemplate('storyteller_creation');
    const storytellerKeyPromptDoc = await getLatestPromptTemplate('storyteller_key_creation');
    const illustrationPromptDoc = await getLatestPromptTemplate('illustration_creation');
    const shouldMockStorytellers = resolveMockMode(body, storytellerPipeline.useMock);
    const shouldMockIllustrations = resolveMockMode(body, illustrationPipeline.useMock);
    let storytellerDataArray;

    if (shouldMockStorytellers) {
      storytellerDataArray = buildMockStorytellers(storytellerCount, fragmentText);
    } else {
      let prompt = '';
      if (storytellerPromptDoc?.promptTemplate) {
        prompt = renderPromptTemplateString(storytellerPromptDoc.promptTemplate, {
          fragmentText,
          storytellerCount
        });
      } else {
        const routeConfig = await getRouteConfig('text_to_storyteller');
        prompt = renderPrompt(routeConfig.promptTemplate, {
          fragmentText,
          storytellerCount
        });
      }
      storytellerDataArray = await callJsonLlm({
        prompts: [{ role: 'system', content: prompt }],
        provider: storytellerProvider,
        model: storytellerPipeline.model || '',
        max_tokens: 2500,
        explicitJsonObjectFormat: true
      });
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

    for (let storytellerIndex = 0; storytellerIndex < storytellerDataArray.length; storytellerIndex += 1) {
      const storytellerData = storytellerDataArray[storytellerIndex];
      if (!storytellerData || typeof storytellerData !== 'object') {
        continue;
      }

      const payload = {
        session_id: sessionId,
        sessionId,
        fragmentText,
        ...storytellerData
      };
      if (resolvedPlayerId) {
        payload.playerId = resolvedPlayerId;
      }
      if (shouldMockIllustrations && !payload.illustration) {
        payload.illustration = pickMockStorytellerIllustrationUrl(storytellerIndex);
      }
      if (shouldGenerateKeyImages && shouldMockIllustrations && payload.typewriter_key?.symbol && !payload.keyImageUrl) {
        payload.keyImageUrl = pickMockStorytellerKeyUrl(storytellerIndex);
        payload.keyImageLocalUrl = payload.keyImageUrl;
        payload.keyImageLocalPath = '';
      }

      const storytellerLookup = applyOptionalPlayerId(
        { session_id: sessionId, name: payload.name },
        resolvedPlayerId
      );
      const savedStoryteller = await Storyteller.findOneAndUpdate(
        storytellerLookup,
        payload,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      savedStorytellers.push(savedStoryteller);

      if (shouldGenerateKeyImages && shouldMockIllustrations && payload.keyImageUrl) {
        keyImages.push({
          storytellerId: savedStoryteller._id,
          name: savedStoryteller.name,
          imageUrl: payload.keyImageUrl,
          localUrl: payload.keyImageLocalUrl || payload.keyImageUrl,
          localPath: payload.keyImageLocalPath || ''
        });
      }

      if (!shouldMockIllustrations && shouldGenerateKeyImages && payload.typewriter_key?.symbol) {
        const keyImageResult = await createStoryTellerKey(
          payload.typewriter_key,
          sessionId,
          payload.name,
          false,
          illustrationPipeline.model,
          storytellerKeyPromptDoc?.promptTemplate || ''
        );
        if (keyImageResult?.imageUrl || keyImageResult?.localPath) {
          const localUrl = keyImageResult?.localPath
            ? `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_keys/${path.basename(keyImageResult.localPath)}`
            : null;
          const imageUrl = keyImageResult?.imageUrl || localUrl;
          await Storyteller.findByIdAndUpdate(savedStoryteller._id, {
            keyImageUrl: imageUrl,
            keyImageLocalUrl: localUrl || imageUrl || '',
            keyImageLocalPath: keyImageResult.localPath || ''
          });
          savedStoryteller.keyImageUrl = imageUrl;
          savedStoryteller.keyImageLocalUrl = localUrl || imageUrl || '';
          savedStoryteller.keyImageLocalPath = keyImageResult.localPath || '';
          keyImages.push({
            storytellerId: savedStoryteller._id,
            name: savedStoryteller.name,
            imageUrl,
            localUrl,
            localPath: keyImageResult.localPath
          });
        }
      }

      if (!shouldMockIllustrations) {
        // Generate Illustration
        const illustrationResult = await createStorytellerIllustration(
          payload,
          sessionId,
          false,
          illustrationPipeline.model,
          illustrationPromptDoc?.promptTemplate || ''
        );

        if (illustrationResult?.imageUrl || illustrationResult?.localPath) {
          const localIllustrationUrl = illustrationResult?.localPath
            ? `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_illustrations/${path.basename(illustrationResult.localPath)}`
            : null;
          const illustrationUrl = illustrationResult?.imageUrl || localIllustrationUrl;

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
      count: savedStorytellers.length,
      generateKeyImages: shouldGenerateKeyImages,
      mocked: shouldMockStorytellers || shouldMockIllustrations,
      mockedStorytellers: shouldMockStorytellers,
      mockedIllustrations: shouldMockIllustrations,
      runtime: {
        generation: {
          pipeline: 'storyteller_creation',
          provider: storytellerProvider,
          model: storytellerPipeline.model || '',
          mocked: shouldMockStorytellers
        },
        illustrations: {
          pipeline: 'illustration_creation',
          provider: illustrationProvider,
          model: illustrationPipeline.model || '',
          mocked: shouldMockIllustrations
        }
      }
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
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

    if (!sessionId || !entityId || !storytellerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, entityId, storytellerId.' });
    }
    if (!Number.isInteger(storytellingPoints)) {
      return res.status(400).json({ message: 'Missing or invalid storytellingPoints (int required).' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid message (string required).' });
    }

    const entity = await findEntityById(sessionId, resolvedPlayerId, entityId);
    if (!entity || entity.session_id !== sessionId || !matchesOptionalPlayerId(entity.playerId, resolvedPlayerId)) {
      return res.status(404).json({ message: 'Entity not found.' });
    }

    let storyteller = await Storyteller.findById(storytellerId);
    if (!storyteller) {
      storyteller = await Storyteller.findOne(
        applyOptionalPlayerId({ name: storytellerId, session_id: sessionId }, resolvedPlayerId)
      );
    }
    if (!storyteller || storyteller.session_id !== sessionId || !matchesOptionalPlayerId(storyteller.playerId, resolvedPlayerId)) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }
    storytellerDocIdForReset = storyteller._id;

    const storytellerMissionPipeline = await getAiPipelineSettings('storyteller_mission');
    const entityPipeline = await getAiPipelineSettings('entity_creation');
    const storytellerProvider = typeof storytellerMissionPipeline?.provider === 'string'
      ? storytellerMissionPipeline.provider
      : 'openai';
    const entityProvider = typeof entityPipeline?.provider === 'string' ? entityPipeline.provider : 'openai';
    const entityPromptDoc = await getLatestPromptTemplate('entity_creation');
    const storytellerMissionPromptDoc = await getLatestPromptTemplate('storyteller_mission');
    const shouldMockMission = resolveMockMode(body, storytellerMissionPipeline.useMock);
    const shouldMockSubEntities = resolveMockMode(body, entityPipeline.useMock);
    const durationDays = Number.isFinite(Number(duration)) ? Number(duration) : undefined;

    await Storyteller.findByIdAndUpdate(
      storyteller._id,
      { $set: { status: 'in_mission' } }
    );
    missionActivated = true;

    let missionResult;
    if (shouldMockMission) {
      missionResult = {
        outcome: 'success',
        userText: `The mission concludes. ${storyteller.name} returns with a focused insight about ${entity.name}.`,
        gmNote: `Lean into the sensory details of ${entity.name}; highlight a single, striking detail that hints at hidden layers.`,
        subEntitySeed: `New sub-entities emerge around ${entity.name}: a revealing clue, a minor witness, and a tangible relic tied to the mission.`
      };
    } else {
      let prompt = '';
      if (storytellerMissionPromptDoc?.promptTemplate) {
        prompt = renderPromptTemplateString(storytellerMissionPromptDoc.promptTemplate, {
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
      } else {
        const routeConfig = await getRouteConfig('storyteller_mission');
        prompt = renderPrompt(routeConfig.promptTemplate, {
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
      }
      missionResult = await callJsonLlm({
        prompts: [{ role: 'system', content: prompt }],
        provider: storytellerProvider,
        model: storytellerMissionPipeline.model || '',
        max_tokens: 1200,
        explicitJsonObjectFormat: true
      });
    }

    await validatePayloadForRoute('storyteller_mission', missionResult);

    const outcome = missionResult?.outcome;
    const userText = missionResult?.userText || '';
    const gmNote = missionResult?.gmNote || '';
    const subEntitySeed = missionResult?.subEntitySeed || `Sub-entities tied to ${entity.name} and ${message}.`;

    const subEntityResult = await textToEntityFromText({
      sessionId,
      playerId: resolvedPlayerId,
      text: subEntitySeed,
      includeCards: false,
      debug: shouldMockSubEntities,
      llmModel: entityPipeline.model,
      llmProvider: entityProvider,
      entityPromptTemplate: entityPromptDoc?.promptTemplate || '',
      mainEntityId: entity.externalId || String(entity._id),
      isSubEntity: true
    });

    const subEntities = Array.isArray(subEntityResult?.entities) ? subEntityResult.entities : [];
    const subEntityExternalIds = subEntities
      .map((subEntity) => subEntity.externalId || subEntity.id)
      .filter(Boolean)
      .map((id) => String(id));
    const savedSubEntities = subEntityExternalIds.length
      ? await NarrativeEntity.find(
        applyOptionalPlayerId(
          {
            session_id: sessionId,
            externalId: { $in: subEntityExternalIds },
            mainEntityId: entity.externalId || String(entity._id)
          },
          resolvedPlayerId
        )
      )
      : [];
    const missionRecord = {
      entityId: entity._id,
      entityExternalId: entity.externalId || String(entity._id),
      playerId: resolvedPlayerId,
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
      subEntities: savedSubEntities,
      runtime: {
        mission: {
          pipeline: 'storyteller_mission',
          provider: storytellerProvider,
          model: storytellerMissionPipeline.model || '',
          mocked: shouldMockMission
        },
        subEntities: {
          pipeline: 'entity_creation',
          provider: entityProvider,
          model: entityPipeline.model || '',
          mocked: shouldMockSubEntities
        }
      }
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
    const relationshipPipeline = await getAiPipelineSettings('relationship_evaluation');
    const relationshipProvider = typeof relationshipPipeline?.provider === 'string'
      ? relationshipPipeline.provider
      : 'openai';
    const relationshipPromptDoc = await getLatestPromptTemplate('relationship_evaluation');

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

    const shouldMock = resolveMockMode(
      { debug, mock, mock_api_calls, mocked_api_calls },
      relationshipPipeline.useMock
    );
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
      clusterContext,
      relationshipPipeline.model,
      relationshipProvider,
      relationshipPromptDoc?.promptTemplate || ''
    );

    // Handle rejection
    if (evaluation.verdict !== 'accepted') {
      return res.status(200).json({
        verdict: 'rejected',
        quality: evaluation.quality,
        suggestions: evaluation.suggestions || [],
        fastValidate: evaluation.fastValidate,
        mocked: shouldMock,
        runtime: {
          pipeline: 'relationship_evaluation',
          provider: relationshipProvider,
          model: relationshipPipeline.model || '',
          mocked: shouldMock
        }
      });
    }

    // If dryRun, return without committing
    if (dryRun) {
      const strength = deriveRelationshipStrength(evaluation?.quality?.score);
      return res.status(200).json({
        verdict: 'accepted',
        dryRun: true,
        quality: evaluation.quality,
        predicate,
        strength,
        message: 'Relationship would be accepted (dry run, not committed).',
        fastValidate: evaluation.fastValidate,
        mocked: shouldMock,
        runtime: {
          pipeline: 'relationship_evaluation',
          provider: relationshipProvider,
          model: relationshipPipeline.model || '',
          mocked: shouldMock
        }
      });
    }

    // Commit edges
    const createdEdges = [];
    const edgesArray = Array.isArray(arena.edges) ? arena.edges : [];
    const relationshipStrength = deriveRelationshipStrength(evaluation?.quality?.score);

    for (const target of targets) {
      const edge = {
        edgeId: `edge_${randomUUID().slice(0, 8)}`,
        fromCardId: source.cardId || source.entityId,
        toCardId: target.cardId || target.entityId,
        surfaceText: relationshipPayload.surfaceText,
        predicate,
        direction: relationshipPayload.direction || 'source_to_target',
        strength: relationshipStrength,
        quality: evaluation.quality,
        createdBy: playerId,
        createdAt: new Date().toISOString()
      };
      edgesArray.push(edge);
      createdEdges.push(edge);
    }

    // Calculate and update points
    const pointsAwarded = calculatePoints(evaluation.quality.score);
    const scores = { ...(arena.scores || {}) };
    const previousTotal = scores[playerId] || 0;
    scores[playerId] = previousTotal + pointsAwarded;

    const edgeIds = createdEdges.map((edge) => edge.edgeId);
    const enforceDualWrite = !shouldMock;

    if (enforceDualWrite) {
      try {
        await syncEntityNode(sessionId, source);
        for (const target of targets) {
          await syncEntityNode(sessionId, target);
        }
        for (const edge of createdEdges) {
          await createRelationship(sessionId, edge);
        }
      } catch (neo4jError) {
        console.error('Neo4j sync failed before Mongo commit, aborting relationship proposal:', neo4jError);
        return res.status(503).json({
          message: 'Relationship persistence failed: Neo4j unavailable. No changes were committed.'
        });
      }
    }

    try {
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
    } catch (mongoError) {
      if (enforceDualWrite) {
        try {
          await deleteRelationshipsByEdgeIds(sessionId, edgeIds);
        } catch (rollbackError) {
          console.error('Neo4j rollback failed after MongoDB persistence error:', rollbackError);
        }
      }
      throw mongoError;
    }

    // In mock mode, keep Neo4j synchronization best-effort for local testing.
    if (!enforceDualWrite) {
      try {
        await syncEntityNode(sessionId, source);
        for (const target of targets) {
          await syncEntityNode(sessionId, target);
        }
        for (const edge of createdEdges) {
          await createRelationship(sessionId, edge);
        }
      } catch (neo4jError) {
        console.warn('Neo4j sync failed in mock mode (MongoDB updated successfully):', neo4jError.message);
      }
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
      fastValidate: evaluation.fastValidate,
      runtime: {
        pipeline: 'relationship_evaluation',
        provider: relationshipProvider,
        model: relationshipPipeline.model || '',
        mocked: shouldMock
      }
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

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import fsPromises from 'fs/promises';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { BrewRoom } from './models/brewing_models.js';
import {
  callJsonLlm,
  directExternalApiCall,
  listAvailableAnthropicModels,
  listAvailableOpenAiModels,
  resolveDirectExternalApiRouteError
} from './ai/openai/apiService.js';
import {
  ChatMessage,
  Storyteller,
  SessionPlayer,
  Arena,
  SeerReading,
  World,
  WorldElement,
  NarrativeFragment,
  QuestScreenGraph,
  ImmersiveRpgSceneSession,
  ImmersiveRpgCharacterSheet
} from './models/models.js';
import { FragmentMemory } from './models/memory_models.js';
import {
  createStoryTellerKey,
  createStorytellerIllustration
} from './services/storytellerService.js';
import { NarrativeEntity, upsertNarrativeEntity } from './storyteller/utils.js';
import {
  buildTypewriterKeyState,
  findTypewriterKeyForSession,
  listTypewriterKeysForSession,
  markTypewriterKeyPressed,
  upsertTypewriterKey
} from './services/typewriterKeyService.js';
import {
  textToEntityFromText,
  normalizeDesiredEntityCategories
} from './services/textToEntityService.js';
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
import { registerWellAdminRoutes } from './routes/serverNew/wellAdminRoutes.js';
import { registerQuestRoutes } from './routes/serverNew/questRoutes.js';
import { registerSeerRoutes } from './routes/serverNew/seerRoutes.js';
import { registerSessionWorldRoutes } from './routes/serverNew/sessionWorldRoutes.js';
import { registerNarrativeRoutes } from './routes/serverNew/narrativeRoutes.js';
import { registerArenaRoutes } from './routes/serverNew/arenaRoutes.js';
import { registerBrewingRoutes } from './routes/serverNew/brewingRoutes.js';
import { registerMessengerRoutes } from './routes/serverNew/messengerRoutes.js';
import { registerImmersiveRpgRoutes } from './routes/serverNew/immersiveRpgRoutes.js';
import { registerTypewriterRoutes } from './routes/serverNew/typewriterRoutes.js';
import { registerDocsRoutes } from './routes/serverNew/docsRoutes.js';
import { generateTypewriterPrompt } from './ai/openai/promptsUtils.js';
import {
  getPipelineSettings,
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
  getDefaultXerofagInspectionPromptTemplate,
  seedCurrentTypewriterPromptTemplates
} from './services/typewriterDefaultPromptSeedService.js';
import { getTypewriterPromptDefinitions } from './services/typewriterPromptDefinitionsService.js';
import {
  runSeerReadingTurn,
  buildSeerComposerPayload,
  buildSeerOrchestratorEnvelope
} from './services/seerReadingRuntimeService.js';
import { generateSeerReadingCardDrafts } from './services/seerReadingCardGenerationService.js';
import {
  getPublicNarrativeEntityMockInspectionSignals,
  getPublicNarrativeEntitySeed,
  getPublicNarrativeEntitySessionId
} from './services/publicNarrativeEntitySeedService.js';
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
import {
  drawNextWellTextualFragment,
  getWellMemorySession,
  handoffWellMemorySession,
  startWellMemorySession,
  submitWellTextualJot
} from './services/wellMemorySessionService.js';
import {
  buildMockMessengerSceneBrief,
  DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID,
  DEFAULT_IMMERSIVE_RPG_PLAYER_ID,
  DEFAULT_IMMERSIVE_RPG_PLAYER_NAME,
  IMMERSIVE_RPG_TURN_CONTRACT_KEY,
  buildImmersiveRpgPromptMessages,
  buildCharacterSheetSkeleton,
  buildCompiledScenePrompt,
  buildSceneBootstrap,
  buildSkeletonSceneTurn,
  createTranscriptEntry,
  getDefaultImmersiveRpgSceneDefinition,
  getImmersiveRpgSceneDefinition,
  hasEnoughMessengerSceneBriefForRpg,
  normalizeImmersiveRpgChatResponse,
  normalizeImmersiveRpgStagePayload,
  normalizeMessengerSceneBriefForRpg,
  resolveRollOutcome,
  simulateDicePoolRoll,
  toImmersiveRpgCharacterSheetPayload,
  toImmersiveRpgNotebookContractPayload,
  toImmersiveRpgStageContractPayload,
  toImmersiveRpgScenePayload
} from './services/immersiveRpgService.js';
import {
  coerceQuestAdvanceContractPayload,
  normalizeQuestAdvancePlan
} from './services/questAdvanceContractService.js';
import {
  QUEST_SCENE_AUTHORING_PIPELINE_KEY,
  buildMockQuestSceneAuthoringDraft,
  buildQuestSceneAuthoringPromptMessages,
  buildQuestSceneAuthoringPromptPayload,
  buildQuestSceneAuthoringRuntime,
  flattenQuestSceneAuthoringChanges,
  getDefaultQuestSceneAuthoringPromptTemplate,
  normalizeQuestSceneAuthoringDraft
} from './services/questSceneAuthoringService.js';
import {
  composeQuestSceneImagePrompt,
  generateQuestSceneImageAsset
} from './services/questSceneImageService.js';
import {
  getCanonicalProjectAssetRoot,
  getProjectAssetRoots,
  resolveProjectAssetUrl
} from './services/projectAssetRootsService.js';
import {
  getWellSceneConfigMeta,
  loadWellSceneConfig,
  resetWellSceneConfig,
  saveWellSceneConfig
} from './services/wellSceneConfigService.js';


const app = express();
app.use(express.json({ limit: '12mb' }));
app.use(cors());

const PORT = process.env.PORT || 5001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CANONICAL_PROJECT_ASSETS_ROOT = getCanonicalProjectAssetRoot();
const ASSETS_ROOTS = getProjectAssetRoots();
const QUEST_SCENE_UPLOAD_SUBDIRECTORY = 'quest_scene_uploads';
const MAX_QUEST_SCENE_UPLOAD_BYTES = 8 * 1024 * 1024;
const QUEST_SCENE_UPLOAD_MIME_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

function sendLlmAwareError(res, error, fallbackMessage, field = 'message') {
  const { statusCode, message } = resolveDirectExternalApiRouteError(error, fallbackMessage);
  return res.status(statusCode).json({ [field]: message });
}

function parseQuestSceneImageDataUrl(dataUrl = '') {
  const match = String(dataUrl || '').match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  const mimeType = String(match[1] || '').trim().toLowerCase();
  const base64Payload = String(match[2] || '').replace(/\s+/g, '');
  if (!base64Payload) {
    return null;
  }

  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length) {
    return null;
  }

  return {
    mimeType,
    buffer
  };
}

function buildQuestSceneUploadAssetPath({
  sessionId = '',
  questId = '',
  screenId = '',
  filename = '',
  mimeType = 'image/png'
} = {}) {
  const extension = QUEST_SCENE_UPLOAD_MIME_TYPES.get(mimeType) || '.png';
  const sessionSegment = slugifyQuestSegment(sessionId) || 'session';
  const questSegment = slugifyQuestSegment(questId) || 'quest';
  const filenameBase = slugifyQuestSegment(path.parse(String(filename || '')).name)
    || slugifyQuestSegment(screenId)
    || 'scene';
  const storedFilename = `${filenameBase}_${Date.now()}${extension}`;
  const relativeDirectory = path.posix.join(
    QUEST_SCENE_UPLOAD_SUBDIRECTORY,
    sessionSegment,
    questSegment
  );

  return {
    storedFilename,
    absoluteDir: path.join(CANONICAL_PROJECT_ASSETS_ROOT, relativeDirectory),
    absolutePath: path.join(CANONICAL_PROJECT_ASSETS_ROOT, relativeDirectory, storedFilename),
    imageUrl: `/assets/${path.posix.join(relativeDirectory, storedFilename)}`
  };
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

const DEFAULT_QUEST_ID = 'scene_authoring_starter';
const DEFAULT_QUEST_SESSION_ID = 'scene-authoring-demo';
const ROSE_COURT_PROLOGUE_QUEST_ID = 'rose_court_prologue_phase_1';
const ROSE_COURT_PROLOGUE_SESSION_ID = 'rose-court-prologue-demo';
const DEFAULT_SCENE_TEMPLATE = 'basic_scene';
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
const ROSE_COURT_LOCATION_MESSENGER_SCENE_ID = 'rose_court_clerk_location';
const ROSE_COURT_TRANSPORT_MESSENGER_SCENE_ID = 'rose_court_clerk_transport';
const DEFAULT_MESSENGER_HISTORY_LIMIT = 14;
const MESSENGER_INITIAL_MESSAGE =
  'We are pleased to inform you that the typewriter, as discussed, is ready for dispatch. The Society spares no expense where its instruments are concerned. We trust you are still expecting it. Of course. One small practical matter before we release it to the courier: are you in a town, or somewhere a little more removed?';
const ROSE_COURT_LOCATION_INITIAL_MESSAGE =
  '—zzkt— Hello? At last. Do not discard that handset. Clerk Vale, Storytellers Society. Are you standing by the Wall of the Hall of the Rose? Good. Listen carefully. Before the typewriter can be dispatched, the ledger requires a precise destination on Earth. Earth, sir. Not allegory. Not heaven. Not myth. Where shall we send it?';
const ROSE_COURT_TRANSPORT_INITIAL_MESSAGE =
  '—zzkt— Vale again. You are further in, then. Good; keep your voice low. The address stands, though I like the sound of it less each time I repeat it. One practical answer quickly: if the typewriter had to move in haste, what real mode of transportation could you actually manage yourself?';
const ROSE_COURT_LOCATION_MESSENGER_GUIDANCE =
  'You are Clerk Vale of the Storytellers Society during the first rose-court handset contact. Your job is narrow: secure one precise, real-world Earth destination for the typewriter. You are relieved the handset was answered, formal by training, discreet by habit, and anxious enough to leak through the seams. You must refuse mythic, celestial, allegorical, or vague answers. You may sound concerned for the typewriter\'s welfare, the weather, the route, and the practicalities of a discreet dispatch. Keep replies compact, pointed, and in-character. Once the user gives a precise earthly destination, confirm it, note that you will renew contact when the next mural is found, and end the exchange cleanly.';
const ROSE_COURT_TRANSPORT_MESSENGER_GUIDANCE =
  'You are Clerk Vale of the Storytellers Society during the second rose-court handset contact from deeper in the court. The destination has already been accepted. Your only job now is to obtain one real mode of transportation the player could personally manage in haste with the typewriter. You are more openly worried than before, but still precise and discreet. Refuse fantastical or evasive answers. Keep the question urgent, practical, and shortwave-fragile. Once the player names a workable real transport mode, acknowledge it, let your concern show for a moment, and let the transmission die.';
const MESSENGER_SCENE_AUTHORED_GUIDANCE_BY_SCENE_ID = Object.freeze({
  [ROSE_COURT_LOCATION_MESSENGER_SCENE_ID]: ROSE_COURT_LOCATION_MESSENGER_GUIDANCE,
  [ROSE_COURT_TRANSPORT_MESSENGER_SCENE_ID]: ROSE_COURT_TRANSPORT_MESSENGER_GUIDANCE
});
const ROSE_COURT_FANTASY_LOCATION_PATTERN =
  /\b(heaven|hell|elysium|fae|faerie|fairyland|dreamlands|narnia|middle[- ]?earth|westeros|gondor|rivendell|mordor|oz|atlantis|hyrule|tamriel|skyrim|mars|moon|venus|jupiter|saturn)\b/i;
const ROSE_COURT_PRECISE_LOCATION_PREPOSITION_PATTERN =
  /\b(in|near|at|on|by|above|below|outside|inside|between|next to)\b/i;
const ROSE_COURT_LOCATION_DESCRIPTOR_PATTERN =
  /\b(street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr|square|sq|plaza|route|ruta|calle|way|quay|harbor|harbour|port|station|terminal|city|town|village|district|province|state|county|country|island|bay|coast|river|lake|forest|woods|mount|mountain|cafe|coffee shop)\b/i;
const ROSE_COURT_FANTASY_TRANSPORT_PATTERN =
  /\b(dragon|gryphon|griffin|wyvern|pegasus|phoenix|portal|teleport|teleportation|broom|airship|spell|magic|levitation)\b/i;
const ROSE_COURT_TRANSPORT_PATTERN =
  /\b(train|car|truck|van|motorcycle|motorbike|bike|bicycle|scooter|bus|tram|subway|underground|ferry|boat|ship|canoe|kayak|plane|airplane|helicopter|horse|taxi|jeep|4x4|snowmobile)\b/i;
const ROSE_COURT_LOCATION_FEATURE_PATTERNS = [
  { pattern: /\b(attic|roof|skyscraper|top floor)\b/i, label: 'an elevated room or rooftop edge' },
  { pattern: /\b(cabin|woods|forest|pine|cedar)\b/i, label: 'woodland shelter and timber nearby' },
  { pattern: /\b(cottage|garden|country|pasture|field)\b/i, label: 'domestic calm and cultivated ground' },
  { pattern: /\b(balcony|terrace|porch)\b/i, label: 'an exposed threshold open to air' },
  { pattern: /\b(waterfall|river|harbor|harbour|sea|coast|shore|lake)\b/i, label: 'water within sight or earshot' },
  { pattern: /\b(wind|gust|storm|rain|monsoon|snow)\b/i, label: 'weather that makes itself known' },
  { pattern: /\b(village|town|city|street|lane|road|district)\b/i, label: 'a legible earthly settlement' },
  { pattern: /\b(mountain|slope|valley|plateau|cliff)\b/i, label: 'strong surrounding terrain' }
];
const ROSE_COURT_VISUAL_STYLE_GUIDE =
  'Use an aged illuminated-manuscript fantasy language rather than glossy modern fantasy. The Hall of the Rose is an elven architectural miracle in collapse: concentric petal-walls built from wafer-thin mineral-ceramic masonry that resembles layered rose petals more than ordinary stone. The outer wall is the lowest and most weathered petal; farther inward, taller petals rise with slightly better preservation. Keep the palette dusk-gold, parchment-umber, smoke-brown, faded verdigris, and old ember light. Surfaces should feel tactile: cracked plaster, eroded mosaic, flaking tempera, carved relief, dust, ivy, and ceremonial wear. The page should feel like an old crumbling illustrated book or map plate where image and text have equal gravity. Avoid glossy blur, sterile straight-edged modern framing, neon fantasy effects, empty generic ruin photography, or overclean steampunk polish. Whenever mural doors appear, their knockers should be glowing ouroboros rings integrated into the masonry.';
const ROSE_COURT_VISUAL_CONTINUITY_BASE =
  'Keep the Hall of the Rose materially consistent: crumbling elven rose-petal masonry, aged manuscript warmth, dusk parchment light, tactile ruin detail, and a faint ceremonial glow in metalwork rather than overt magic effects.';

function buildRoseCourtVisualContinuityGuidance(note = '') {
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  return trimmedNote ? `${ROSE_COURT_VISUAL_CONTINUITY_BASE} ${trimmedNote}` : ROSE_COURT_VISUAL_CONTINUITY_BASE;
}

const ROSE_COURT_OPENING_SCENE_GUIDANCE =
  'Run the opening as a ceremonial threshold disguised as a ruin. The tone should feel like a lost late-1980s quest game: melancholy, tactile, mysterious, and visually specific rather than loud. Begin with dusk, wind, erosion, and the three house-murals on the rose-petal wall. Let the player examine freely and reward curiosity with sensory detail, craftsmanship, and small discoveries instead of sudden plot leaps. The radio-static must remain faint until the player listens for it, questions it, or searches for its source. Once pursued, it should lead to the hidden handset among the rocks. The handset is not a modern earthly phone: it is a strange retro device of brass, weathered metal, and dwarven-gnomish craftsmanship that nonetheless clearly works. The clerk of the Storytellers\' Society should sound relieved, formal, discreet, and slightly anxious; he must insist on a precise real-world Earth location and reject fantastical destinations politely but firmly. After the location is confirmed, the court may answer with new murals that are all faithful reinterpretations of that same earthly place. Do not reveal later beats before they are reached: the inner court, the urgent transport question, the falcon, the well of dissolving lines, the ten-word parchment, and the blackout ending should arrive in sequence. Avoid combat, lore dumps, or random fantasy detours. Keep the feeling that the court responds to the player\'s choices without ever fully explaining itself.';
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
const TYPEWRITER_TEXT_KEY_TEXTURE_URL = '/textures/keys/blank_rect_horizontal_1.png';
const TYPEWRITER_XEROFAG_KEY_IMAGE_URL = '/textures/keys/THE_XEROFAG_1.png';
const XEROFAG_ENTITY_EXTERNAL_ID = 'builtin:xerofag';
const XEROFAG_ENTITY_SEED = getPublicNarrativeEntitySeed(XEROFAG_ENTITY_EXTERNAL_ID);
if (!XEROFAG_ENTITY_SEED) {
  throw new Error(`Missing public narrative entity seed: ${XEROFAG_ENTITY_EXTERNAL_ID}`);
}
const XEROFAG_INSPECTION_SIGNALS = getPublicNarrativeEntityMockInspectionSignals(XEROFAG_ENTITY_EXTERNAL_ID);
const PUBLIC_NARRATIVE_ENTITY_SESSION_ID = getPublicNarrativeEntitySessionId();
const XEROFAG_CANDIDATE_TERM = XEROFAG_ENTITY_SEED?.name || 'The Xerofag';
const XEROFAG_KEY_TEXT = XEROFAG_ENTITY_SEED?.typewriterKeyText || 'THE XEROFAG';
const XEROFAG_SUMMARY = XEROFAG_ENTITY_SEED?.description || 'A pack of eerie undead dogs trained to find storytellers and devour them.';
const XEROFAG_LORE = XEROFAG_ENTITY_SEED?.lore || XEROFAG_SUMMARY;
const XEROFAG_CANINE_KEYWORDS = XEROFAG_INSPECTION_SIGNALS.canine;
const XEROFAG_UNDEAD_KEYWORDS = XEROFAG_INSPECTION_SIGNALS.undead;
const SCENE_AUTHORING_STARTER_CONFIG = Object.freeze({
  sessionId: DEFAULT_QUEST_SESSION_ID,
  questId: DEFAULT_QUEST_ID,
  sceneName: 'Scene Authoring Starter',
  sceneTemplate: DEFAULT_SCENE_TEMPLATE,
  sceneComponents: [],
  startScreenId: 'opening_tableau',
  authoringBrief:
    'A neutral starter scene for authoring new narrative screens. Replace the placeholder text, image prompts, guidance, and routes with the real scene you want to build.',
  phaseGuidance:
    'Treat this as an authored scene starter, not a generic sandbox. Keep play constrained to what the scene explicitly establishes, deepen the current moment before expanding, and only branch when authored routes or clear scene logic call for it.',
  visualStyleGuide:
    'Define one clear visual language for the scene and keep nearby screens materially consistent unless a deliberate break is specified. Favor tactile illustration over generic placeholder imagery.',
  promptRoutes: [],
  screens: [
    {
      id: 'opening_tableau',
      title: 'Opening Tableau',
      prompt:
        'A new scene begins here. This starter screen is waiting for its real place, its first image, and its first decisive invitation.',
      imageUrl: '/ruin_south_a.png',
      image_prompt:
        'Opening tableau illustration for a newly authored narrative scene, atmospheric and tactile, with one clear focal environment and no mandatory characters.',
      referenceImagePrompt:
        'Standalone illustrated opening tableau for a newly authored narrative scene. Establish one clear place, one strong mood, and one readable focal structure or landmark so later screens can inherit the same visual language. The image should feel intentional, tactile, and story-rich rather than like a placeholder concept sheet.',
      promptGuidance:
        'Use this starter screen as the first authored threshold. Clarify what the player sees, hears, and can inspect before adding deeper scene logic.',
      sceneEndCondition:
        'This starter beat should end when the player commits to the first meaningful movement, inspection, or contact that defines the real scene graph.',
      visualContinuityGuidance:
        'This is the establishing plate for the authored scene. Set the material language clearly so adjacent screens can inherit it, drift from it, or break from it deliberately.',
      visualTransitionIntent: 'inherit',
      textPromptPlaceholder: 'What do you do?',
      directions: []
    }
  ]
});

const SCENE_AUTHORING_STARTER_AUTHORING_DEFAULTS = Object.freeze({
  sceneName: SCENE_AUTHORING_STARTER_CONFIG.sceneName,
  sceneTemplate: SCENE_AUTHORING_STARTER_CONFIG.sceneTemplate,
  sceneComponents: SCENE_AUTHORING_STARTER_CONFIG.sceneComponents,
  authoringBrief: SCENE_AUTHORING_STARTER_CONFIG.authoringBrief,
  phaseGuidance: SCENE_AUTHORING_STARTER_CONFIG.phaseGuidance,
  visualStyleGuide: SCENE_AUTHORING_STARTER_CONFIG.visualStyleGuide,
  promptRoutes: [],
  screensById: {
    opening_tableau: {
      referenceImagePrompt: SCENE_AUTHORING_STARTER_CONFIG.screens[0].referenceImagePrompt,
      promptGuidance: SCENE_AUTHORING_STARTER_CONFIG.screens[0].promptGuidance,
      sceneEndCondition: SCENE_AUTHORING_STARTER_CONFIG.screens[0].sceneEndCondition,
      visualContinuityGuidance: SCENE_AUTHORING_STARTER_CONFIG.screens[0].visualContinuityGuidance,
      visualTransitionIntent: SCENE_AUTHORING_STARTER_CONFIG.screens[0].visualTransitionIntent
    }
  }
});

function buildRoseCourtPrologueQuestConfig() {
  return {
    sessionId: ROSE_COURT_PROLOGUE_SESSION_ID,
    questId: ROSE_COURT_PROLOGUE_QUEST_ID,
    sceneName: 'Rose Court Opening',
    sceneTemplate: DEFAULT_SCENE_TEMPLATE,
    sceneComponents: ['messenger', 'location_mural_materializer', 'well_sequence', 'rose_court_opening_sequence'],
    startScreenId: 'outer_wall_plateau',
    authoringBrief:
      'Opening scene: a player arrives before the outer wall of the Hall of the Rose, notices three weather-eaten murals and a faint static signal, discovers a dwarven-gnomish handset hidden among rocks, and is pressed by Clerk Vale to name a precise real-world Earth destination for a custom typewriter.',
    phaseGuidance: ROSE_COURT_OPENING_SCENE_GUIDANCE,
    visualStyleGuide: ROSE_COURT_VISUAL_STYLE_GUIDE,
    promptRoutes: [
      {
        id: 'rose-court-follow-signal',
        description: 'Move the player from the first wall toward the source of the faint transmission.',
        fromScreenIds: [
          'outer_wall_plateau',
          'mural_attic_panel',
          'mural_cabin_panel',
          'mural_cottage_panel',
          'rock_scatter'
        ],
        matchMode: 'any',
        patterns: [
          '\\b(sound|static|radio|signal|transmission|crackle|noise|hiss)\\b',
          'where .*coming from',
          'what.*hear',
          'listen.*(carefully|closer|again)?'
        ],
        targetScreenId: 'rock_scatter'
      },
      {
        id: 'rose-court-recover-handset',
        description: 'Let the player find the hidden handset by searching the rocks or naming the device.',
        fromScreenIds: [
          'outer_wall_plateau',
          'mural_attic_panel',
          'mural_cabin_panel',
          'mural_cottage_panel',
          'rock_scatter'
        ],
        matchMode: 'any',
        patterns: [
          '\\b(phone|handset|device|receiver)\\b',
          '\\b(search|check|look|inspect|reach|grab|take|pick up|lift|move)\\b.*\\b(rock|stone|behind)\\b',
          '\\b(rock|stone|behind)\\b.*\\b(search|check|look|inspect|reach|grab|take|pick up|lift|move)\\b'
        ],
        targetScreenId: 'phone_found'
      }
    ],
    screens: [
      {
        id: 'outer_wall_plateau',
        title: 'Wall of the Hall of the Rose',
        prompt:
          'Evening wind crosses the plateau. Ahead, a crumbling wall opens like stone rose petals, bearing three murals half-lost to weather and time. One shows an attic high above a city, one a cabin in dark woods, one a country cottage holding onto its grace. Beneath the wind, a faint radio hiss worries the air.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Aged illuminated-manuscript quest opening, dusk plateau before the lowest rose-petal wall of a ruined elven court, three fading murals in different artistic media, distant higher petals visible inward, glowing ouroboros ring handles, faint radio-static unease.',
        referenceImagePrompt:
          'Wide illustrated storybook plate at dusk on a lonely plateau. The player faces the lowest outer petal of the Hall of the Rose, an elven architectural miracle now collapsing into wafer-thin mineral-ceramic petals rather than ordinary stone. The wall should resemble a rose opening in ruin. In the distance, taller inner petals rise more intact. Three faded murals are set into the wall, each with a glowing ouroboros ring knocker: the left mural is a fractured mosaic of an attic above a city, the center mural is a weather-worn traditional painting of a forest cabin, and the right mural is an incised relief with traces of gilt showing a country cottage. Scattered rocks in the foreground, evening wind, parchment-gold and smoke-brown palette, tactile age, no characters.',
        textPromptPlaceholder: 'Examine the murals, ask about the hiss, or search the plateau.',
        expectationSummary: 'An outer threshold: wind, murals, and the hint of a hidden transmission.',
        continuitySummary: 'The opening gives you only weather, stone, and a sound that should not be here.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('This establishing plate must set the full material logic of the court: the outermost petal is the most ruined, the inward petals are visible but more intact, and the three mural media are already distinct before the player approaches them.'),
        visualTransitionIntent: 'inherit',
        promptGuidance:
          'Keep this opening screen observational. The player should meet the court through wind, dusk, erosion, and almost-erased craftsmanship. The static is real but still easy to miss; do not make it dominant until the player listens for it or asks about it.',
        componentBindings: [
          {
            componentId: 'rose_court_opening_sequence',
            slot: 'scene_intro',
            props: {}
          }
        ],
        directions: [
          { direction: 'west', label: 'Inspect the attic mural', targetScreenId: 'mural_attic_panel' },
          { direction: 'north', label: 'Inspect the woodland cabin mural', targetScreenId: 'mural_cabin_panel' },
          { direction: 'east', label: 'Inspect the country cottage mural', targetScreenId: 'mural_cottage_panel' },
          { direction: 'south', label: 'Search the scattered rocks', targetScreenId: 'rock_scatter' }
        ]
      },
      {
        id: 'mural_attic_panel',
        title: 'Mural of the High Attic',
        prompt:
          'The left mural shows a narrow attic perched above black roofs and needled towers. The workmanship is exquisite, but weather has eaten whole corners from it.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Close mural study in cracked rose-petal masonry, attic above a city rendered as broken stone-and-glass mosaic, urban height and weathered elegance, ancient ouroboros door ring nearby.',
        referenceImagePrompt:
          'Close view of the left mural embedded in the rose-petal wall. This mural should be distinctly mosaic: tiny fractured stone-and-glass tesserae showing a narrow attic room perched above dark roofs and needle-thin towers. The image is incomplete where erosion has eaten whole corners away. The surrounding wall still reads as petal-like elven ruin masonry, and the dormant but faintly luminous ouroboros ring handle should be integrated into the mural surface. Romantic verticality, antique craftsmanship, no living figures.',
        textPromptPlaceholder: 'What detail do you study in the attic mural?',
        expectationSummary: 'A vertical refuge, elegant and precarious, survives behind the broken plaster.',
        continuitySummary: 'This is one of the first three murals on the outer wall.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('Move from the establishing view into a tighter study without losing the wall material. This mural should feel like the left-hand city aspect of the same outer petal, rendered in mosaic rather than paint.'),
        visualTransitionIntent: 'drift',
        promptGuidance:
          'Emphasize height, lookout, and urban isolation. This mural should suggest a writer\'s refuge above the world, not a magical portal. Keep details specific but partial, as though time has eaten away the most useful facts.',
        directions: [
          { direction: 'back', label: 'Step back to the wall', targetScreenId: 'outer_wall_plateau' },
          { direction: 'south', label: 'Search the rocks below the wall', targetScreenId: 'rock_scatter' }
        ]
      },
      {
        id: 'mural_cabin_panel',
        title: 'Mural of the Far Cabin',
        prompt:
          'The center mural holds a far cabin among dark trees. Roofline, chimney, and path are half-erased by weather, yet the place still feels cold, inhabited, and watchful.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Close mural study in weathered rose-petal wall, remote cabin in dark woods painted as ancient fresco or tempera, flaking plaster, cold forest quiet, ouroboros ring handle integrated into the mural.',
        referenceImagePrompt:
          'Close view of the center mural on the outer rose wall. This mural should read as the most traditional painting of the three: a faded fresco or tempera image on old plaster showing a remote cabin in deep woods. Dark pines crowd around it, the chimney and path are half-erased by centuries of weather, and pigment has flaked away in sheets. The mural still belongs to the same elven rose-petal masonry, with an ouroboros ring handle set into the image surface. Cold air, remoteness, and severe habitability matter more than overt fantasy spectacle.',
        textPromptPlaceholder: 'What in the cabin mural draws your eye?',
        expectationSummary: 'A harder shelter, remote and solitary, presses at the edge of the wall’s memory.',
        continuitySummary: 'This is one of the first three murals on the outer wall.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('Keep this as the central mural and the sternest of the three. The medium changes from mosaic to faded painting, but the same dusk wall, same petal architecture, and same ceremonial ring-handle logic remain.'),
        visualTransitionIntent: 'drift',
        promptGuidance:
          'Lean into remoteness, timber, cold air, and the possibility that someone could still live here. The mood may be watchful, but do not introduce explicit danger or creatures; the power of the mural is in its severe habitability.',
        directions: [
          { direction: 'back', label: 'Return to the wall', targetScreenId: 'outer_wall_plateau' },
          { direction: 'south', label: 'Follow the strange sound to the rocks', targetScreenId: 'rock_scatter' }
        ]
      },
      {
        id: 'mural_cottage_panel',
        title: 'Mural of the Quiet Cottage',
        prompt:
          'The right mural keeps the gentlest scene: a cottage, a lane, a hush of country light. The relief is badly worn, but its calm has survived the damage.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Close mural study in rose-petal ruin wall, country cottage rendered as incised relief with remnants of gilt and limewash, soft rural light, worn elegance, faintly glowing ouroboros ring.',
        referenceImagePrompt:
          'Detailed view of the right mural carved into the weathered rose wall. This mural should use a third distinct medium: incised bas-relief with traces of gilt, limewash, or other aged decorative finish. It shows a country cottage, narrow lane, hedge or garden hints, and a softer rural light surviving through erosion. The surrounding masonry must still feel like layered elven rose petals, and the integrated ouroboros ring handle should glow a little warmer here than on the other two murals.',
        textPromptPlaceholder: 'Which feature of the cottage mural do you examine?',
        expectationSummary: 'A softer refuge answers the wall with warmth instead of height or wilderness.',
        continuitySummary: 'This is one of the first three murals on the outer wall.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('Keep the same outer wall and same dusk palette, but let this mural feel gentler and more domestic. Its difference should come from relief-and-gilding craft, not from looking like a different ruin entirely.'),
        visualTransitionIntent: 'drift',
        promptGuidance:
          'This mural is the calmest of the three. Emphasize gentleness, privacy, and domestic grace. It should feel like a place one could write quietly, without becoming sentimental or idyllic beyond the damaged stone.',
        directions: [
          { direction: 'back', label: 'Return to the wall', targetScreenId: 'outer_wall_plateau' },
          { direction: 'south', label: 'Listen near the rocks', targetScreenId: 'rock_scatter' }
        ]
      },
      {
        id: 'rock_scatter',
        title: 'Scatter of Plateau Stones',
        prompt:
          'Here the static is harder to ignore. Among the stones, one rock shelters a dull metallic glint from the wind.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Lower-angle dusk view at the base of the rose-petal wall, plateau stones and rubble in wind, one rock hiding a metallic glint, the wall looming above, faint radio-static mystery, aged manuscript fantasy tone.',
        referenceImagePrompt:
          'Ground-level storybook plate beneath the outer rose wall. Scattered plateau stones and broken petal-like debris fill the foreground while the wall still looms above at the edge of frame. One rock partly shields a small metallic glint, but the hidden object should not yet be fully visible. Sparse scrub, dust, ivy, evening wind, parchment-gold ruin palette. The composition should feel like the player has knelt down to the source of the static without solving it yet.',
        textPromptPlaceholder: 'Do you search behind the rocks, follow the sound, or leave it alone?',
        expectationSummary: 'The transmission is no longer rumor; the stones now conceal its source.',
        continuitySummary: 'The scene has narrowed from murals to signal.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('This is a downward, more intimate continuation of the outer wall view. Keep the same wall and plateau, but crop lower and closer so the hidden signal becomes physical rather than abstract.'),
        visualTransitionIntent: 'drift',
        promptGuidance:
          'This screen should reward attention and physical verbs. Listening, moving stones, kneeling, searching behind the rock, or naming the device should all push toward discovery. The key transition here is from vague unease to actionable mystery.',
        directions: [
          { direction: 'north', label: 'Return to the murals', targetScreenId: 'outer_wall_plateau' }
        ]
      },
      {
        id: 'phone_found',
        title: 'The Dwarven Handset',
        prompt:
          'Behind the rock rests an impossible handset: part mobile phone, part brass instrument, built as though dwarves and gnomes had agreed on elegance. It crackles with the same repeating distress call, and the voice on the line sounds almost relieved to be heard.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Close detail of a dwarven-gnomish handset among plateau stones, engraved brass and weathered metal, practical antique engineering, dusk ruin light, faint ceremonial glow, no sleek modern phone design.',
        referenceImagePrompt:
          'Close-up of the discovered handset among plateau stones at the base of the rose wall. It should look like an impossible hybrid between an early mobile phone and a brass field instrument, built by dwarven and gnomish hands with engraved metal, worn switches, vent slots, and pragmatic ornament. Avoid sleek retrofuturism; this should feel handmade, old, durable, and slightly ceremonial. Evening dust, weathered rock, and a sense that the device has been waiting a very long time to be found.',
        textPromptPlaceholder: 'Answer the handset, or keep studying it.',
        expectationSummary: 'The handset is live and waiting for first contact.',
        continuitySummary: 'The source of the static has been found beneath the plateau stones.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('Stay on the same patch of ground as the rock-scatter screen, but move into intimate object study. The handset should belong to this ruin-world materially, not feel imported from a cleaner genre.'),
        visualTransitionIntent: 'drift',
        promptGuidance:
          'Once the handset is answered, the Society clerk may begin immediately. He should sound relieved, formal, discreet, and lightly strained. He must insist on a precise earthly destination, and he should not accept imaginary places, celestial realms, or generic fantasy answers.',
        sceneEndCondition:
          'This screen\'s main purpose is complete when the clerk makes contact and the player understands that an exact real-world Earth location is required.',
        componentBindings: [
          {
            componentId: 'messenger',
            slot: 'auto_open',
            props: {
              sceneId: ROSE_COURT_LOCATION_MESSENGER_SCENE_ID
            }
          },
          {
            componentId: 'messenger',
            slot: 'action_button',
            props: {
              sceneId: ROSE_COURT_LOCATION_MESSENGER_SCENE_ID,
              label: 'Answer the handset near the wall'
            }
          },
          {
            componentId: 'location_mural_materializer',
            slot: 'screen_effect',
            props: {
              trigger: 'after_messenger_complete',
              messengerSceneId: ROSE_COURT_LOCATION_MESSENGER_SCENE_ID
            }
          }
        ],
        directions: [
          { direction: 'back', label: 'Lower the handset and look back to the wall', targetScreenId: 'rock_scatter' }
        ],
        stageLayout: 'focus-left',
        stageModules: [
          {
            module_id: 'phone-found-note',
            type: 'evidence_note',
            title: 'Transmission',
            body: 'The caller has been repeating the same appeal for long enough to sound hopeful now that it has finally been heard.',
            caption: 'If the line matters, it should be answered soon.'
          }
        ]
      },
      {
        id: 'location_mural_gallery',
        title: 'Second Wall of Murals',
        prompt:
          'The wall has changed. Three fresh murals answer the earthly address you gave the clerk, each faithful to the same place but bent toward a different shelter.',
        imageUrl: '/ruin_south_a.png',
        image_prompt:
          'Awakened second wall of the Hall of the Rose at dusk, three newly formed murals interpreting one real earthly destination, same rose-petal masonry, glowing ouroboros ring knockers, illuminated-manuscript ruin atmosphere.',
        referenceImagePrompt:
          'Wide ceremonial view of the second rose wall after the earthly destination is accepted. Three newly appeared murals now glow more legibly within the same elven rose-petal masonry. All three clearly interpret one real place on Earth, but each favors a different shelter and artistic treatment. Their door knockers are luminous ouroboros rings integrated into the mural surfaces. The wall itself remains ancient, cracked, and ceremonial rather than fresh or magical-plastic. Dusk parchment tones, tactile erosion, quiet selection ritual.',
        textPromptPlaceholder: 'Choose which new mural to approach.',
        expectationSummary: 'The wall has answered the filed destination with three new aspects.',
        continuitySummary: 'These murals appeared only after the clerk accepted the address.',
        visualContinuityGuidance:
          buildRoseCourtVisualContinuityGuidance('This should clearly be the same court and same wall logic as before, but newly answered. The second wall is more active and legible, not cleaner or newer; its change comes from response, not from abandoning the ruin aesthetic.'),
        visualTransitionIntent: 'drift',
        promptGuidance:
          'All three murals must clearly belong to the exact Earth location the player named. They may differ in mood, style, shelter, or weather emphasis, but not in geographic identity. This screen should feel like the court answering the filing, not like random new destinations appearing.',
        directions: []
      }
    ]
  };
}

function hasQuestAuthoringValue(value) {
  if (typeof value === 'string') {
    return Boolean(value.trim());
  }
  return value !== undefined && value !== null;
}

function normalizeQuestSceneTemplate(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || DEFAULT_SCENE_TEMPLATE;
}

function normalizeQuestSceneComponentId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/g, '')
    .slice(0, 64);
}

function normalizeQuestSceneComponents(value = []) {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(entries.map((entry) => normalizeQuestSceneComponentId(entry)).filter(Boolean))];
}

function cloneQuestAuthoringValue(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return JSON.parse(JSON.stringify(value));
  }
  return value;
}

function applyScreenAuthoringDefaults(screen = {}, screenDefaults = {}) {
  if (!screenDefaults || typeof screenDefaults !== 'object') {
    return { ...screen };
  }
  const nextScreen = { ...screen };
  Object.entries(screenDefaults).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if ((!Array.isArray(nextScreen[key]) || nextScreen[key].length === 0) && value.length > 0) {
        nextScreen[key] = cloneQuestAuthoringValue(value);
      }
      return;
    }
    if (!hasQuestAuthoringValue(nextScreen[key]) && hasQuestAuthoringValue(value)) {
      nextScreen[key] = cloneQuestAuthoringValue(value);
    }
  });
  return nextScreen;
}

function applyQuestAuthoringDefaults(config = {}, authoringDefaults = {}) {
  if (!config || typeof config !== 'object') {
    return config;
  }

  const nextConfig = {
    ...config,
    screens: Array.isArray(config.screens) ? config.screens.map((screen) => ({ ...screen })) : []
  };

  ['sceneName', 'sceneTemplate', 'authoringBrief', 'phaseGuidance', 'visualStyleGuide'].forEach((key) => {
    if (!hasQuestAuthoringValue(nextConfig[key]) && hasQuestAuthoringValue(authoringDefaults[key])) {
      nextConfig[key] = authoringDefaults[key];
    }
  });

  if ((!Array.isArray(nextConfig.sceneComponents) || !nextConfig.sceneComponents.length)
    && Array.isArray(authoringDefaults.sceneComponents)
    && authoringDefaults.sceneComponents.length) {
    nextConfig.sceneComponents = cloneQuestAuthoringValue(authoringDefaults.sceneComponents);
  }

  if ((!Array.isArray(nextConfig.promptRoutes) || !nextConfig.promptRoutes.length)
    && Array.isArray(authoringDefaults.promptRoutes)
    && authoringDefaults.promptRoutes.length) {
    nextConfig.promptRoutes = cloneQuestAuthoringValue(authoringDefaults.promptRoutes);
  }

  const screensById = authoringDefaults.screensById && typeof authoringDefaults.screensById === 'object'
    ? authoringDefaults.screensById
    : {};
  nextConfig.screens = nextConfig.screens.map((screen) => applyScreenAuthoringDefaults(screen, screensById[screen.id]));
  return nextConfig;
}

function buildDefaultQuestConfigForScope(scope = {}) {
  if (scope?.questId === ROSE_COURT_PROLOGUE_QUEST_ID) {
    return buildRoseCourtPrologueQuestConfig();
  }
  return applyQuestAuthoringDefaults(
    JSON.parse(JSON.stringify(SCENE_AUTHORING_STARTER_CONFIG)),
    SCENE_AUTHORING_STARTER_AUTHORING_DEFAULTS
  );
}

function isRoseCourtLocationScene(sceneId = '') {
  return sceneId === ROSE_COURT_LOCATION_MESSENGER_SCENE_ID;
}

function isRoseCourtTransportScene(sceneId = '') {
  return sceneId === ROSE_COURT_TRANSPORT_MESSENGER_SCENE_ID;
}

function getMessengerSceneAuthoredGuidance(sceneId = DEFAULT_MESSENGER_SCENE_ID) {
  return MESSENGER_SCENE_AUTHORED_GUIDANCE_BY_SCENE_ID[sceneId] || '';
}

function getMessengerInitialMessageForScene(sceneId = DEFAULT_MESSENGER_SCENE_ID) {
  if (isRoseCourtLocationScene(sceneId)) {
    return ROSE_COURT_LOCATION_INITIAL_MESSAGE;
  }
  if (isRoseCourtTransportScene(sceneId)) {
    return ROSE_COURT_TRANSPORT_INITIAL_MESSAGE;
  }
  return MESSENGER_INITIAL_MESSAGE;
}

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

function resolveExplicitBooleanOverride(body = {}, flagNames = []) {
  for (const flagName of flagNames) {
    const parsed = parseBooleanFlag(body?.[flagName]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function resolveExplicitMockOverride(body = {}) {
  return resolveExplicitBooleanOverride(body, [
    'mock',
    'debug',
    'mock_api_calls',
    'mocked_api_calls'
  ]);
}

function resolveMockMode(body = {}, fallback = false) {
  const explicit = resolveExplicitMockOverride(body);
  if (explicit !== null) {
    return explicit;
  }
  return Boolean(fallback);
}

function resolveImageMockMode(body = {}, fallback = false, extraFlagNames = []) {
  const explicit = resolveExplicitBooleanOverride(body, [
    ...extraFlagNames,
    'mockImage',
    'mock_image',
    'mockImages',
    'mock_images',
    'mockTextures',
    'mock_texture',
    'mock_textures',
    'mock_texture_generation',
    'mockedTextures',
    'mocked_textures',
    'mockIllustration',
    'mockIllustrations',
    'mock_illustration',
    'mock_illustrations'
  ]);
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

function appendNarrativeTerm(currentNarrative = '', term = '') {
  const baseText = typeof currentNarrative === 'string' ? currentNarrative : '';
  const normalizedTerm = typeof term === 'string' ? term.trim() : '';
  if (!normalizedTerm) return baseText;
  if (!baseText) return normalizedTerm;
  return /\s$/.test(baseText)
    ? `${baseText}${normalizedTerm}`
    : `${baseText} ${normalizedTerm}`;
}

function narrativeEndsWithTerm(currentNarrative = '', term = '') {
  const normalizedText = String(currentNarrative || '').trim().toLowerCase();
  const normalizedTerm = String(term || '').trim().toLowerCase();
  if (!normalizedText || !normalizedTerm) return false;
  return normalizedText.endsWith(normalizedTerm);
}

function narrativeContainsAnyKeyword(currentNarrative = '', keywords = []) {
  const normalized = String(currentNarrative || '').toLowerCase();
  return keywords.some((keyword) => normalized.includes(String(keyword).toLowerCase()));
}

function shouldAllowXerofagInMock(currentNarrative = '') {
  if (!String(currentNarrative || '').trim()) {
    return false;
  }
  if (narrativeEndsWithTerm(currentNarrative, XEROFAG_CANDIDATE_TERM)) {
    return false;
  }
  const hasCanineSignal = narrativeContainsAnyKeyword(currentNarrative, XEROFAG_CANINE_KEYWORDS);
  const hasUndeadSignal = narrativeContainsAnyKeyword(currentNarrative, XEROFAG_UNDEAD_KEYWORDS);
  return hasCanineSignal && hasUndeadSignal;
}

function buildXerofagInspectionPromptPayload(currentNarrative = '', candidateNarrative = '') {
  return {
    current_narrative: typeof currentNarrative === 'string' ? currentNarrative : '',
    candidate_narrative: typeof candidateNarrative === 'string' && candidateNarrative.trim()
      ? candidateNarrative
      : appendNarrativeTerm(currentNarrative, XEROFAG_CANDIDATE_TERM),
    candidate_term: XEROFAG_CANDIDATE_TERM,
    xerofag_lore: XEROFAG_LORE
  };
}

function buildXerofagInspectionPromptMessages(currentNarrative, candidateNarrative, promptTemplate) {
  const payload = buildXerofagInspectionPromptPayload(currentNarrative, candidateNarrative);
  const renderedPrompt = renderPromptTemplateString(
    promptTemplate && promptTemplate.trim()
      ? promptTemplate
      : getDefaultXerofagInspectionPromptTemplate(),
    payload
  );

  return [
    { role: 'system', content: renderedPrompt },
    { role: 'user', content: JSON.stringify(payload) }
  ];
}

function buildTypewriterKeyCandidateNarrative(currentNarrative = '', insertText = '') {
  const baseText = typeof currentNarrative === 'string' ? currentNarrative : '';
  const normalizedInsertText = typeof insertText === 'string' ? insertText.trim() : '';
  if (!normalizedInsertText) {
    return {
      candidateNarrative: baseText,
      appendedText: ''
    };
  }
  const candidateNarrative = appendNarrativeTerm(baseText, normalizedInsertText);
  return {
    candidateNarrative,
    appendedText: candidateNarrative.slice(baseText.length)
  };
}

function shouldAllowTypewriterKeyInMock(typewriterKey, currentNarrative = '') {
  const keyText = firstDefinedString(typewriterKey?.keyText);
  const insertText = firstDefinedString(typewriterKey?.insertText, keyText);
  const sourceType = firstDefinedString(typewriterKey?.sourceType);

  if (!String(currentNarrative || '').trim() || !insertText) {
    return false;
  }
  if (narrativeEndsWithTerm(currentNarrative, insertText)) {
    return false;
  }
  if (sourceType === 'builtin' && keyText === XEROFAG_KEY_TEXT) {
    return shouldAllowXerofagInMock(currentNarrative);
  }
  return countWords(currentNarrative) >= 3;
}

function buildTypewriterKeyVerificationPromptPayload(typewriterKey, entity, currentNarrative = '', candidateNarrative = '') {
  const keyText = firstDefinedString(typewriterKey?.keyText);
  const insertText = firstDefinedString(typewriterKey?.insertText, keyText);
  const entityName = firstDefinedString(entity?.name, typewriterKey?.entityName, keyText);
  const effectiveCandidate = candidateNarrative && candidateNarrative.trim()
    ? candidateNarrative
    : buildTypewriterKeyCandidateNarrative(currentNarrative, insertText).candidateNarrative;

  return {
    current_narrative: typeof currentNarrative === 'string' ? currentNarrative : '',
    candidate_narrative: effectiveCandidate,
    key_text: keyText,
    insert_text: insertText,
    entity_name: entityName,
    entity_description: firstDefinedString(entity?.description, typewriterKey?.description),
    entity_lore: firstDefinedString(entity?.lore),
    entity_type: firstDefinedString(entity?.type),
    entity_subtype: firstDefinedString(entity?.subtype),
    source_type: firstDefinedString(typewriterKey?.sourceType)
  };
}

function buildTypewriterKeyVerificationPromptMessages(typewriterKey, entity, currentNarrative, candidateNarrative, promptTemplate) {
  const payload = buildTypewriterKeyVerificationPromptPayload(
    typewriterKey,
    entity,
    currentNarrative,
    candidateNarrative
  );
  const renderedPrompt = renderPromptTemplateString(promptTemplate, payload);
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

function pickRoseCourtLocationFeatures(text = '') {
  const features = [];
  for (const candidate of ROSE_COURT_LOCATION_FEATURE_PATTERNS) {
    if (!candidate.pattern.test(text)) continue;
    features.push(candidate.label);
    if (features.length >= 4) break;
  }
  return features;
}

function pickRoseCourtLocationSensoryDetails(text = '') {
  const details = [];
  const candidates = [
    { pattern: /\bwind|gust|breeze\b/i, label: 'wind worrying the approach' },
    { pattern: /\brain|storm|monsoon\b/i, label: 'weather pressing at the structure' },
    { pattern: /\bsnow|ice|cold|frost\b/i, label: 'cold held in the air and surfaces' },
    { pattern: /\bharbor|harbour|sea|coast|shore|waterfall|river|lake\b/i, label: 'water close enough to be heard or smelled' },
    { pattern: /\bforest|woods|pine|cedar\b/i, label: 'timber, leaf-mould, or resin nearby' },
    { pattern: /\bcity|street|town|village\b/i, label: 'human life close enough to leave a civic murmur' }
  ];
  for (const candidate of candidates) {
    if (!candidate.pattern.test(text)) continue;
    details.push(candidate.label);
    if (details.length >= 3) break;
  }
  if (!details.length) {
    details.push('an earthly place with weather of its own');
  }
  return details;
}

function extractRoseCourtPlaceName(text = '') {
  const source = normalizeMessengerBriefText(text, 240);
  if (!source) return '';
  const firstSentence = source.split(/[.!?]/)[0].trim();
  const compact = firstSentence.length <= 120 ? firstSentence : firstSentence.slice(0, 120).trim();
  return compact;
}

function isRoseCourtStructuredEarthLocation(text = '') {
  const source = normalizeMessengerBriefText(text, 320);
  if (!source) return false;
  const segments = source
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length < 2) return false;

  const hasDetailedSegment = segments.some((segment) => (
    /\d/.test(segment)
    || segment.split(/\s+/).length >= 2
    || ROSE_COURT_LOCATION_DESCRIPTOR_PATTERN.test(segment)
  ));

  return hasDetailedSegment || segments.length >= 3;
}

function isRoseCourtEarthLocationPreciseEnough(text = '') {
  const source = normalizeMessengerBriefText(text, 320);
  if (!source) return false;
  if (ROSE_COURT_FANTASY_LOCATION_PATTERN.test(source)) return false;
  if (source.length < 18) return false;
  return (
    ROSE_COURT_PRECISE_LOCATION_PREPOSITION_PATTERN.test(source)
    || isRoseCourtStructuredEarthLocation(source)
    || (/\d/.test(source) && ROSE_COURT_LOCATION_DESCRIPTOR_PATTERN.test(source))
  );
}

function buildRoseCourtLocationSceneBrief(message = '', existingSceneBrief = null) {
  const normalizedMessage = normalizeMessengerBriefText(message, 480);
  const placeName = extractRoseCourtPlaceName(normalizedMessage);
  const notableFeatures = pickRoseCourtLocationFeatures(normalizedMessage);
  const sensoryDetails = pickRoseCourtLocationSensoryDetails(normalizedMessage);
  const preciseEnough = isRoseCourtEarthLocationPreciseEnough(normalizedMessage);
  const placeSummary = preciseEnough
    ? `${normalizedMessage}. An earthly destination precise enough for discreet delivery, with real weather, a real approach, and enough contour for the Society to picture the route.`
    : '';

  return mergeMessengerSceneBrief(existingSceneBrief, {
    subject: 'Earthbound typewriter destination',
    placeName,
    placeSummary,
    typewriterHidingSpot: existingSceneBrief?.typewriterHidingSpot || '',
    sensoryDetails,
    notableFeatures,
    sceneEstablished: preciseEnough
  });
}

function buildRoseCourtLocationMessengerResponse(message = '', existingSceneBrief = null) {
  const normalizedMessage = normalizeMessengerBriefText(message, 480);
  const fantasyRequest = ROSE_COURT_FANTASY_LOCATION_PATTERN.test(normalizedMessage);
  const preciseEnough = isRoseCourtEarthLocationPreciseEnough(normalizedMessage);
  const sceneBrief = preciseEnough
    ? buildRoseCourtLocationSceneBrief(normalizedMessage, existingSceneBrief)
    : buildRoseCourtLocationSceneBrief('', existingSceneBrief);

  if (fantasyRequest) {
    return {
      has_chat_ended: false,
      message_assistant:
        'No, no. On Earth, if you please. The typewriter is a physical instrument, not a mythic vow. Give me a real earthly destination a discreet courier could actually reach. A ship in Antarctic waters, a lane in a mining town, the edge of a rainforest if you insist, but Earth all the same.',
      scene_brief: toMessengerSceneBriefPayload(sceneBrief, {
        sceneEstablished: false
      })
    };
  }

  if (!preciseEnough) {
    return {
      has_chat_ended: false,
      message_assistant:
        'Not the mood of it, sir. The place itself. Country, region, settlement, building if need be. Give me an earthly destination the ledger can distinguish from every other romantic hiding place in the world. I cannot file "somewhere beautiful and windswept."',
      scene_brief: toMessengerSceneBriefPayload(sceneBrief, {
        sceneEstablished: false
      })
    };
  }

  return {
    has_chat_ended: true,
    message_assistant:
      `Good. ${sceneBrief?.placeName || 'That address'} will do. The ledger accepts it; the typewriter can be routed. I dislike the weather there already, but dislike is not a filing category. I shall renew contact when you find the next mural. Keep the handset near. —zzkt—`,
    scene_brief: toMessengerSceneBriefPayload(sceneBrief, {
      typewriterHidingSpot: '',
      sceneEstablished: true
    })
  };
}

function extractRoseCourtTransportMode(text = '') {
  const source = normalizeMessengerBriefText(text, 240);
  if (!source) return '';
  const match = source.match(ROSE_COURT_TRANSPORT_PATTERN);
  return match?.[0] ? match[0].trim() : '';
}

function isRoseCourtTransportConcreteEnough(text = '') {
  const source = normalizeMessengerBriefText(text, 240);
  if (!source) return false;
  if (ROSE_COURT_FANTASY_TRANSPORT_PATTERN.test(source)) return false;
  return ROSE_COURT_TRANSPORT_PATTERN.test(source);
}

function buildRoseCourtTransportSceneBrief(message = '', existingSceneBrief = null) {
  const transportMode = extractRoseCourtTransportMode(message);
  return mergeMessengerSceneBrief(existingSceneBrief, {
    subject: 'Rose court transport contingency',
    placeName: existingSceneBrief?.placeName || '',
    placeSummary:
      normalizeMessengerBriefText(existingSceneBrief?.placeSummary, 4000)
      || 'The destination is already accepted; only the emergency means of movement remains to be recorded.',
    typewriterHidingSpot: normalizeMessengerBriefText(existingSceneBrief?.typewriterHidingSpot, 1600),
    sensoryDetails: Array.isArray(existingSceneBrief?.sensoryDetails) ? existingSceneBrief.sensoryDetails : [],
    notableFeatures: [
      ...(Array.isArray(existingSceneBrief?.notableFeatures) ? existingSceneBrief.notableFeatures : []),
      ...(transportMode ? [`transport the player can manage: ${transportMode}`] : [])
    ],
    sceneEstablished: Boolean(transportMode)
  });
}

function buildRoseCourtTransportMessengerResponse(message = '', existingSceneBrief = null) {
  const normalizedMessage = normalizeMessengerBriefText(message, 240);
  const fantasyRequest = ROSE_COURT_FANTASY_TRANSPORT_PATTERN.test(normalizedMessage);
  const preciseEnough = isRoseCourtTransportConcreteEnough(normalizedMessage);
  const sceneBrief = buildRoseCourtTransportSceneBrief(normalizedMessage, existingSceneBrief);
  const transportMode = extractRoseCourtTransportMode(normalizedMessage);

  if (fantasyRequest) {
    return {
      has_chat_ended: false,
      message_assistant:
        'No legends, please. I need the real conveyance. Train, car, boat, motorcycle, bicycle if that is honestly the measure of it. What could you actually manage on Earth, in haste?',
      scene_brief: toMessengerSceneBriefPayload(sceneBrief, {
        sceneEstablished: false
      })
    };
  }

  if (!preciseEnough) {
    return {
      has_chat_ended: false,
      message_assistant:
        'Quickly, please. Not bravery. Not aspiration. The practical conveyance. If the typewriter had to move at once, what could you actually handle yourself?',
      scene_brief: toMessengerSceneBriefPayload(sceneBrief, {
        sceneEstablished: false
      })
    };
  }

  return {
    has_chat_ended: true,
    message_assistant:
      `Good. ${transportMode} can be entered in the margin. I do not like the sound of it, but I like uncertainty less. Keep moving. If the line fails now, assume that was intention, not fault. —zzkt—`,
    scene_brief: toMessengerSceneBriefPayload(sceneBrief, {
      sceneEstablished: true
    })
  };
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
  const introMessage = getMessengerInitialMessageForScene(sceneId);
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
      content: introMessage,
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
    content: introMessage,
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
const MESSENGER_LOCATION_PATTERN = /(window|bay|attic|apartment|room|woods|forest|desert|plateau|harbor|house|flat|studio|tower|lane|street|road|courtyard|monastery|pass|cellar|basement)/i;
const MESSENGER_HIDING_PATTERN = /(hide|hiding|closet|cupboard|cabinet|wardrobe|locker|crate|cellar|under|beneath|false wall|safe|chest|trunk|crawlspace)/i;
const MESSENGER_SYSTEM_CONTRACT_TEXT = `Runtime output contract:
- Return keys: has_chat_ended, message_assistant
- Include scene_brief only when has_chat_ended is true and the destination is fully established
- If scene_brief is present, it must include: subject, place_name, place_summary, typewriter_hiding_spot, sensory_details, notable_features, scene_established
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

function toMessengerSceneBriefPayload(brief = {}, overrides = {}) {
  const source = brief && typeof brief === 'object' ? brief : {};
  const next = overrides && typeof overrides === 'object' ? overrides : {};
  const typewriterHidingSpot = normalizeMessengerBriefText(
    next.typewriterHidingSpot ?? next.typewriter_hiding_spot ?? source.typewriterHidingSpot ?? source.typewriter_hiding_spot,
    1600
  );

  return {
    subject: normalizeMessengerBriefText(next.subject ?? source.subject, 120),
    place_name: normalizeMessengerBriefText(next.placeName ?? next.place_name ?? source.placeName ?? source.place_name, 240),
    place_summary: normalizeMessengerBriefText(next.placeSummary ?? next.place_summary ?? source.placeSummary ?? source.place_summary, 4000),
    typewriter_hiding_spot: typewriterHidingSpot,
    sensory_details: normalizeMessengerBriefList(next.sensoryDetails ?? next.sensory_details ?? source.sensoryDetails ?? source.sensory_details),
    notable_features: normalizeMessengerBriefList(next.notableFeatures ?? next.notable_features ?? source.notableFeatures ?? source.notable_features),
    scene_established: Boolean(next.sceneEstablished ?? next.scene_established ?? source.sceneEstablished ?? source.scene_established)
  };
}

function getMessengerSceneBriefGaps(brief, sceneId = DEFAULT_MESSENGER_SCENE_ID) {
  if (isRoseCourtLocationScene(sceneId)) {
    if (!brief) {
      return ['subject', 'place', 'scene'];
    }

    const gaps = [];
    if (!brief.subject) gaps.push('subject');
    if (!brief.placeName) gaps.push('place');
    if (countWords(brief.placeSummary) < 10) gaps.push('scene');
    return gaps;
  }

  if (isRoseCourtTransportScene(sceneId)) {
    if (!brief) {
      return ['transport'];
    }
    const notableFeatures = Array.isArray(brief.notableFeatures) ? brief.notableFeatures.join(' ').toLowerCase() : '';
    return /transport/.test(notableFeatures) ? [] : ['transport'];
  }

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

function isMessengerSceneBriefComplete(brief, sceneId = DEFAULT_MESSENGER_SCENE_ID) {
  return getMessengerSceneBriefGaps(brief, sceneId).length === 0;
}

function buildMessengerSceneFollowUp(brief, gaps = [], sceneId = DEFAULT_MESSENGER_SCENE_ID) {
  if (isRoseCourtLocationScene(sceneId)) {
    return 'The Society still requires a precise earthly destination. Give me the real place on Earth, not the mood of it: where would you have the typewriter sent?';
  }
  if (isRoseCourtTransportScene(sceneId)) {
    return 'Quickly, please. I need the real conveyance, not the dream of one. What actual mode of transport could you personally manage if you had to move with the typewriter in haste?';
  }
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

function buildLegacyMessengerSceneBriefFallback(message, historyDocs = [], existingSceneBrief = null, assistantReply = '') {
  const prior = existingSceneBrief && typeof existingSceneBrief === 'object' ? existingSceneBrief : null;
  const historyText = (Array.isArray(historyDocs) ? historyDocs : [])
    .map((entry) => (typeof entry?.content === 'string' ? entry.content.trim() : ''))
    .filter(Boolean)
    .join(' ');
  const combinedText = [historyText, message, assistantReply]
    .map((entry) => normalizeMessengerBriefText(entry, 1200))
    .filter(Boolean)
    .join(' ');

  const mentionsLocation = MESSENGER_LOCATION_PATTERN.test(combinedText);
  const mentionsHiding = MESSENGER_HIDING_PATTERN.test(combinedText);
  const placeSummaryFallback = mentionsLocation
    ? `Proposed destination details gathered so far: ${normalizeMessengerBriefText(historyText || message, 480)}`
    : '';
  const hidingFallback = mentionsHiding
    ? `Possible hiding place noted so far: ${normalizeMessengerBriefText(historyText || message, 320)}`
    : '';

  return {
    subject: prior?.subject || (mentionsLocation ? 'Pending delivery room' : 'Unspecified destination'),
    place_name: prior?.placeName || (mentionsLocation ? 'Proposed typewriter destination' : ''),
    place_summary: prior?.placeSummary || placeSummaryFallback,
    typewriter_hiding_spot: prior?.typewriterHidingSpot || hidingFallback,
    sensory_details: Array.isArray(prior?.sensoryDetails) ? prior.sensoryDetails : [],
    notable_features: Array.isArray(prior?.notableFeatures) ? prior.notableFeatures : [],
    scene_established: Boolean(prior?.sceneEstablished)
  };
}

export function coerceLegacyMessengerAiResponse(rawResponse, {
  message = '',
  historyDocs = [],
  existingSceneBrief = null
} = {}) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return rawResponse;
  }

  const nextResponse = { ...rawResponse };

  if (typeof nextResponse.message_assistant !== 'string') {
    if (typeof nextResponse.assistant_message === 'string') {
      nextResponse.message_assistant = nextResponse.assistant_message;
    } else if (typeof nextResponse.reply === 'string') {
      nextResponse.message_assistant = nextResponse.reply;
    }
  }

  if (typeof nextResponse.has_chat_ended !== 'boolean' && typeof nextResponse.hasChatEnded === 'boolean') {
    nextResponse.has_chat_ended = nextResponse.hasChatEnded;
  }

  if (
    nextResponse.has_chat_ended === true
    && (!nextResponse.scene_brief || typeof nextResponse.scene_brief !== 'object')
  ) {
    nextResponse.scene_brief = buildLegacyMessengerSceneBriefFallback(
      message,
      historyDocs,
      existingSceneBrief,
      typeof nextResponse.message_assistant === 'string' ? nextResponse.message_assistant : ''
    );
  }

  return nextResponse;
}

function getMessengerIntroHistoryDoc(historyDocs = []) {
  const docs = Array.isArray(historyDocs) ? historyDocs : [];
  return docs.find((doc) => doc?.type === 'initial') || docs[0] || null;
}

function buildMessengerOpeningContext(historyDocs = []) {
  const introDoc = getMessengerIntroHistoryDoc(historyDocs);
  const introContent = normalizeMessengerBriefText(introDoc?.content, 2200)
    || normalizeMessengerBriefText(MESSENGER_INITIAL_MESSAGE, 2200);
  return `The conversation already began with this premade Society dispatch shown to the user. Treat it as established canon and continue from it:\n"""${introContent}"""`;
}

export function buildMessengerPromptMessages(
  historyDocs,
  promptTemplate,
  maxHistoryMessages = DEFAULT_MESSENGER_HISTORY_LIMIT,
  sceneId = DEFAULT_MESSENGER_SCENE_ID
) {
  const safePromptBase = typeof promptTemplate === 'string' && promptTemplate.trim()
    ? promptTemplate.trim()
    : 'You are a strange but professional courier for the Storyteller Society. Return JSON only.';
  const safePrompt = `${safePromptBase}\n\n${MESSENGER_SYSTEM_CONTRACT_TEXT}`;
  const safeLimit = normalizeMessengerHistoryLimit(maxHistoryMessages);
  const openingContext = buildMessengerOpeningContext(historyDocs);
  const sceneGuidance = getMessengerSceneAuthoredGuidance(sceneId);
  const formattedHistory = (Array.isArray(historyDocs) ? historyDocs : [])
    .filter((doc) => doc?.type !== 'initial')
    .map((doc) => ({
    role: doc?.sender === 'user' ? 'user' : 'assistant',
    content: typeof doc?.content === 'string' ? doc.content : ''
    }));

  const systemMessages = [
    { role: 'system', content: safePrompt },
    { role: 'system', content: openingContext }
  ];
  if (sceneGuidance) {
    systemMessages.push({
      role: 'system',
      content: `Scene-authored guidance:\n${sceneGuidance}`
    });
  }

  if (formattedHistory.length <= safeLimit) {
    return [...systemMessages, ...formattedHistory];
  }

  return [...systemMessages, ...formattedHistory.slice(-safeLimit)];
}

function buildMockMessengerResponse(message, historyDocs = []) {
  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const lowerMessage = normalizedMessage.toLowerCase();
  const historyText = (Array.isArray(historyDocs) ? historyDocs : [])
    .map((entry) => (typeof entry?.content === 'string' ? entry.content : ''))
    .join(' ');
  const priorUserTurns = (Array.isArray(historyDocs) ? historyDocs : []).filter((entry) => entry?.sender === 'user').length;
  const mentionsLocation = MESSENGER_LOCATION_PATTERN.test(normalizedMessage) || MESSENGER_LOCATION_PATTERN.test(historyText);
  const mentionsHiding = MESSENGER_HIDING_PATTERN.test(normalizedMessage) || MESSENGER_HIDING_PATTERN.test(historyText);
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
        'Excellent. We are beginning to see the room properly now. One final practical matter: if the typewriter had to vanish at short notice, where exactly would you conceal it, and what in that place would keep it safe from idle hands?'
    };
  }

  if (/address|send|deliver|dispatch|ship|post/i.test(lowerMessage)) {
    return {
      has_chat_ended: false,
      message_assistant:
        'Quite. But an address alone is such a blunt instrument. We require the atmosphere as well: the table, the light, the weather at the window, the noises in the corridor, and the sort of room in which the keys will learn your habits.'
    };
  }

  return {
    has_chat_ended: false,
    message_assistant:
      'Yes, yes, but where will it actually live once it reaches you? We need the physical truth of it: the room, the surface, the view, the air, and any nearby place in which a very precious typewriter might be hidden without remark.'
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
    if (isRoseCourtLocationScene(sceneId)) {
      aiResponse = buildRoseCourtLocationMessengerResponse(message, existingSceneBrief);
    } else if (isRoseCourtTransportScene(sceneId)) {
      aiResponse = buildRoseCourtTransportMessengerResponse(message, existingSceneBrief);
    } else if (shouldMock) {
      aiResponse = buildMockMessengerResponse(message, historyDocs);
    } else {
      const promptDoc = await getLatestPromptTemplate('messenger_chat');
      const routeConfig = await getRouteConfig('messenger_chat');
      const promptTemplate = promptDoc?.promptTemplate || routeConfig?.promptTemplate || '';
      aiResponse = await callJsonLlm({
        prompts: buildMessengerPromptMessages(historyDocs, promptTemplate, body.maxHistoryMessages, sceneId),
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

    aiResponse = coerceLegacyMessengerAiResponse(aiResponse, {
      message,
      historyDocs,
      existingSceneBrief
    });

    await validatePayloadForRoute('messenger_chat', aiResponse);

    let reply = typeof aiResponse.message_assistant === 'string' ? aiResponse.message_assistant.trim() : '';
    let hasChatEnded = Boolean(aiResponse.has_chat_ended);
    const incomingSceneBrief = normalizeMessengerSceneBrief(aiResponse.scene_brief);
    let mergedSceneBrief = mergeMessengerSceneBrief(existingSceneBrief, incomingSceneBrief);

    if (!mergedSceneBrief && hasChatEnded) {
      hasChatEnded = false;
      reply = buildMessengerSceneFollowUp(
        null,
        isRoseCourtLocationScene(sceneId) ? ['subject', 'place', 'scene'] : ['scene', 'hideaway', 'sensory', 'subject'],
        sceneId
      );
    } else if (mergedSceneBrief) {
      const sceneGaps = getMessengerSceneBriefGaps(mergedSceneBrief, sceneId);
      if (hasChatEnded && sceneGaps.length > 0) {
        hasChatEnded = false;
        reply = buildMessengerSceneFollowUp(mergedSceneBrief, sceneGaps, sceneId);
      }

      mergedSceneBrief = {
        ...mergedSceneBrief,
        sceneEstablished: isMessengerSceneBriefComplete(mergedSceneBrief, sceneId),
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
    if (hasChatEnded && mergedSceneBrief?.sceneEstablished) {
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
      sceneBrief: hasChatEnded ? (conversation.sceneBrief || savedSceneBrief) : null,
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
    return sendLlmAwareError(res, error, 'Server error during messenger chat.');
  }
}

registerMessengerRoutes(app, {
  handleMessengerChatPost,
  normalizeMessengerSceneId,
  resolveMessengerPersistenceMode,
  buildMessengerConversationPayload,
  deleteMessengerConversation,
  deleteMessengerSceneBrief
});

function normalizeImmersiveRpgSessionId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeImmersiveRpgPlayerId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeImmersiveRpgPlayerName(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function normalizeImmersiveRpgMessengerSceneId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID;
}

function normalizeBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function mergeImmersiveRpgCharacterSheetDraft(existingDoc, patch = {}) {
  const existing = existingDoc?.toObject ? existingDoc.toObject() : (existingDoc || {});
  const nextPatch = patch && typeof patch === 'object' ? patch : {};
  return {
    ...existing,
    ...nextPatch,
    identity: {
      ...(existing?.identity && typeof existing.identity === 'object' ? existing.identity : {}),
      ...(nextPatch?.identity && typeof nextPatch.identity === 'object' ? nextPatch.identity : {})
    },
    coreTraits: {
      ...(existing?.coreTraits && typeof existing.coreTraits === 'object' ? existing.coreTraits : {}),
      ...(nextPatch?.coreTraits && typeof nextPatch.coreTraits === 'object' ? nextPatch.coreTraits : {})
    },
    attributes: {
      ...(existing?.attributes && typeof existing.attributes === 'object' ? existing.attributes : {}),
      ...(nextPatch?.attributes && typeof nextPatch.attributes === 'object' ? nextPatch.attributes : {})
    },
    skills: {
      ...(existing?.skills && typeof existing.skills === 'object' ? existing.skills : {}),
      ...(nextPatch?.skills && typeof nextPatch.skills === 'object' ? nextPatch.skills : {})
    },
    inventory: Array.isArray(nextPatch?.inventory) ? nextPatch.inventory : existing?.inventory,
    notes: Array.isArray(nextPatch?.notes) ? nextPatch.notes : existing?.notes
  };
}

async function loadImmersiveRpgMessengerSceneBrief(sessionId, messengerSceneId) {
  const persistence = await resolveMessengerPersistenceMode();
  const brief = await getMessengerSceneBrief(sessionId, messengerSceneId, persistence);
  return {
    brief: normalizeMessengerSceneBriefForRpg(brief),
    storage: persistence
  };
}

async function resolveImmersiveRpgRuntimeConfig() {
  const routeConfig = await getRouteConfig(IMMERSIVE_RPG_TURN_CONTRACT_KEY);
  const latestPrompt = await getLatestPromptTemplate('immersive_rpg_gm');

  return {
    promptTemplate:
      latestPrompt?.promptTemplate
      || routeConfig?.promptCore
      || routeConfig?.promptTemplate
      || '',
    routeConfig
  };
}

const IMMERSIVE_RPG_CONTEXT_LOADERS = {
  messenger_scene_brief: async ({
    sessionId,
    sceneDefinition
  }) => {
    const { brief, storage } = await loadImmersiveRpgMessengerSceneBrief(
      sessionId,
      sceneDefinition.messengerSceneId || DEFAULT_IMMERSIVE_RPG_MESSENGER_SCENE_ID
    );

    return {
      value: hasEnoughMessengerSceneBriefForRpg(brief) ? brief : null,
      storage
    };
  },
  character_sheet: async ({
    sessionId,
    playerId
  }) => {
    const effectivePlayerId = playerId || DEFAULT_IMMERSIVE_RPG_PLAYER_ID;
    const doc = await ImmersiveRpgCharacterSheet.findOne({ sessionId, playerId: effectivePlayerId }).lean();
    return {
      value: doc,
      storage: 'mongo'
    };
  }
};

const IMMERSIVE_RPG_CONTEXT_MOCK_FACTORIES = {
  messenger_scene_brief: ({ playerName }) => buildMockMessengerSceneBrief({ playerName })
};

async function resolveImmersiveRpgSceneContext({
  sessionId,
  playerId,
  playerName,
  sceneDefinition,
  allowMockDependencies = false
} = {}) {
  const resolvedSceneDefinition = getImmersiveRpgSceneDefinition(
    sceneDefinition?.number || sceneDefinition?.key || null
  );
  const requirements = [
    ...(Array.isArray(resolvedSceneDefinition.needs) ? resolvedSceneDefinition.needs.map((key) => ({ key, required: true })) : []),
    ...(Array.isArray(resolvedSceneDefinition.optional) ? resolvedSceneDefinition.optional.map((key) => ({ key, required: false })) : [])
  ];
  const context = {};
  const missingContext = [];
  const mockedContext = [];
  let sourceStorage = 'mongo';

  for (const requirement of requirements) {
    const loader = IMMERSIVE_RPG_CONTEXT_LOADERS[requirement.key];
    const loaded = loader
      ? await loader({
        sessionId,
        playerId,
        playerName,
        sceneDefinition: resolvedSceneDefinition
      })
      : { value: null, storage: 'mongo' };

    if (loaded?.storage === 'file' && sourceStorage !== 'mock') {
      sourceStorage = 'file';
    }

    if (loaded?.value) {
      context[requirement.key] = loaded.value;
      continue;
    }

    if (allowMockDependencies && IMMERSIVE_RPG_CONTEXT_MOCK_FACTORIES[requirement.key]) {
      context[requirement.key] = IMMERSIVE_RPG_CONTEXT_MOCK_FACTORIES[requirement.key]({
        sessionId,
        playerId,
        playerName,
        sceneDefinition: resolvedSceneDefinition
      });
      mockedContext.push(requirement.key);
      sourceStorage = 'mock';
      continue;
    }

    if (requirement.required) {
      missingContext.push(requirement.key);
    }
  }

  return {
    sceneDefinition: resolvedSceneDefinition,
    context,
    missingContext,
    mockedContext,
    sourceStorage
  };
}

function buildMockImmersiveRpgChatResponse(currentScene, message) {
  const turn = currentScene.pendingRoll
    ? {
      nextBeat: currentScene.currentBeat,
      pendingRoll: currentScene.pendingRoll,
      notebook: currentScene.notebook || {
        mode: 'roll_request',
        title: currentScene.pendingRoll?.label || 'Roll Required',
        prompt: 'The moment still hinges on the unresolved roll.',
        instruction: currentScene.pendingRoll?.instructions || '',
        scratchLines: ['Mock mode preserved the active roll state.'],
        focusTags: ['mock', 'pending'],
        pendingRoll: currentScene.pendingRoll,
        diceFaces: [],
        successTrack: {
          successes: 0,
          successesRequired: currentScene.pendingRoll?.successesRequired || 1,
          passed: null
        },
        resultSummary: 'Awaiting roll.'
      },
      stageLayout: currentScene.stageLayout || 'focus-left',
      stageModules: currentScene.stageModules || [],
      gmText: `${currentScene.pendingRoll.instructions} The moment still hinges on that outcome. What do you do?`
    }
    : buildSkeletonSceneTurn(currentScene, message);

  const stagePayload = toImmersiveRpgStageContractPayload({
    stageLayout: turn.stageLayout,
    stageModules: turn.stageModules
  });

  return {
    gm_reply: turn.gmText,
    current_beat: turn.nextBeat,
    should_pause_for_choice: true,
    pending_roll: turn.pendingRoll
      ? {
        context_key: turn.pendingRoll.contextKey,
        skill: turn.pendingRoll.skill,
        label: turn.pendingRoll.label,
        dice_notation: turn.pendingRoll.diceNotation,
        difficulty: turn.pendingRoll.difficulty,
        success_threshold: turn.pendingRoll.successThreshold,
        successes_required: turn.pendingRoll.successesRequired,
        instructions: turn.pendingRoll.instructions
      }
      : null,
    notebook: toImmersiveRpgNotebookContractPayload(turn.notebook),
    ...stagePayload,
    scene_flags_patch: {},
    keeper_notes: [
      'Mock mode uses the deterministic immersive RPG scene scaffold.'
    ]
  };
}

async function ensureImmersiveRpgCharacterSheet({
  sessionId,
  playerId,
  playerName,
  sourceSceneBrief,
  patch = null
} = {}) {
  const effectivePlayerId = playerId || DEFAULT_IMMERSIVE_RPG_PLAYER_ID;
  const existing = await ImmersiveRpgCharacterSheet.findOne({ sessionId, playerId: effectivePlayerId });
  const mergedDraft = mergeImmersiveRpgCharacterSheetDraft(existing, patch || {});
  const normalized = buildCharacterSheetSkeleton({
    sessionId,
    playerId: effectivePlayerId,
    playerName: playerName || existing?.playerName,
    messengerSceneBrief: sourceSceneBrief,
    current: mergedDraft
  });

  const doc = await ImmersiveRpgCharacterSheet.findOneAndUpdate(
    { sessionId, playerId: effectivePlayerId },
    {
      $set: {
        playerName: normalized.playerName,
        identity: normalized.identity,
        coreTraits: normalized.coreTraits,
        attributes: normalized.attributes,
        skills: normalized.skills,
        inventory: normalized.inventory,
        notes: normalized.notes,
        sourceSceneBrief: normalized.sourceSceneBrief
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return doc;
}

function deriveSkillFieldFromSeerCardKind(kind = '') {
  const normalizedKind = firstDefinedString(kind).toLowerCase();
  if (['location', 'event', 'omen', 'symbol', 'structure', 'geographical_feature'].includes(normalizedKind)) {
    return 'awareness';
  }
  if (['character', 'person', 'npc', 'authority', 'faction'].includes(normalizedKind)) {
    return 'persuade';
  }
  if (['skill', 'lore', 'book', 'ritual', 'spell'].includes(normalizedKind)) {
    return 'occult';
  }
  return 'libraryUse';
}

function buildSeerClaimCharacterSheetPatch(existingSheet = {}, card = {}, entity = {}) {
  const existing = existingSheet && typeof existingSheet === 'object' ? existingSheet : {};
  const existingSkills = existing?.skills && typeof existing.skills === 'object' ? existing.skills : {};
  const noteSummary = firstDefinedString(card?.front?.summary, entity?.description);
  const noteLine = [firstDefinedString(card?.kind, 'entity'), firstDefinedString(card?.title, entity?.name)]
    .filter(Boolean)
    .join(': ');
  const noteText = noteSummary ? `${noteLine} - ${noteSummary}` : noteLine;
  const notes = Array.from(new Set([...(Array.isArray(existing?.notes) ? existing.notes : []), noteText].filter(Boolean))).slice(-20);
  const inventoryKinds = new Set(['item', 'book', 'map', 'relic']);
  const inventory = inventoryKinds.has(firstDefinedString(card?.kind).toLowerCase())
    ? Array.from(new Set([...(Array.isArray(existing?.inventory) ? existing.inventory : []), firstDefinedString(card?.title, entity?.name)].filter(Boolean))).slice(-20)
    : (Array.isArray(existing?.inventory) ? existing.inventory : []);
  const skillField = deriveSkillFieldFromSeerCardKind(card?.kind);
  const currentSkillValue = Number(existingSkills?.[skillField]);
  const nextSkillValue = Number.isFinite(currentSkillValue)
    ? Math.min(99, Math.max(currentSkillValue, 10) + 5)
    : 20;

  return {
    identity: {
      archetype: firstDefinedString(existing?.identity?.archetype, card?.title, entity?.name),
      residence: firstDefinedString(existing?.identity?.residence)
    },
    coreTraits: {
      edge: firstDefinedString(existing?.coreTraits?.edge, noteSummary),
      drive: firstDefinedString(existing?.coreTraits?.drive, firstDefinedString(card?.back?.mood?.[0]))
    },
    skills: {
      ...existingSkills,
      [skillField]: nextSkillValue
    },
    inventory,
    notes
  };
}

async function synthesizeCharacterSheetFromSeerClaim({ reading, playerId, claimedEntity, card }) {
  const safeSessionId = firstDefinedString(reading?.sessionId);
  if (!safeSessionId) return null;

  const effectivePlayerId = normalizeOptionalPlayerId(playerId) || DEFAULT_IMMERSIVE_RPG_PLAYER_ID;
  const existingSheet = await ImmersiveRpgCharacterSheet.findOne({ sessionId: safeSessionId, playerId: effectivePlayerId }).lean();
  const patch = buildSeerClaimCharacterSheetPatch(existingSheet || {}, card, claimedEntity);

  return ensureImmersiveRpgCharacterSheet({
    sessionId: safeSessionId,
    playerId: effectivePlayerId,
    playerName: firstDefinedString(existingSheet?.playerName, claimedEntity?.name, DEFAULT_IMMERSIVE_RPG_PLAYER_NAME),
    sourceSceneBrief: existingSheet?.sourceSceneBrief || null,
    patch
  });
}

function createRouteError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function executeSeerCardClaimAction({
  reading,
  playerId = '',
  cardId = ''
} = {}) {
  const readingSnapshot = reading && typeof reading.toObject === 'function'
    ? reading.toObject()
    : (reading || {});
  const safePlayerId = normalizeOptionalPlayerId(playerId);
  const safeCardId = firstDefinedString(cardId);

  const cards = Array.isArray(readingSnapshot.cards)
    ? readingSnapshot.cards.map((card) => ({
      ...card,
      back: card?.back ? { ...card.back } : {},
      front: card?.front ? { ...card.front } : {}
    }))
    : [];
  const cardIndex = cards.findIndex((card) => card.id === safeCardId);
  if (cardIndex < 0) {
    throw createRouteError('Claimable card not found in this reading.', 404);
  }

  const targetCard = cards[cardIndex];
  if (firstDefinedString(targetCard.status) !== 'claimable') {
    throw createRouteError('This card is not claimable yet.', 409);
  }

  const claimedAt = new Date().toISOString();
  const linkedReadingEntity = findSeerReadingEntityByCard(readingSnapshot, targetCard);
  const existingEntity = await resolveCanonicalEntityForClaim(readingSnapshot, safePlayerId, targetCard);
  const claimedEntity = await upsertNarrativeEntityFromSeerClaim({
    reading: readingSnapshot,
    playerId: safePlayerId,
    card: targetCard,
    claimedAt,
    linkedReadingEntity,
    existingEntity
  });
  const claimedEntityLink = buildClaimedEntityLink(claimedEntity, targetCard, readingSnapshot, claimedAt);
  const canonicalEntityId = firstDefinedString(claimedEntityLink.entityId);
  const canonicalEntityExternalId = firstDefinedString(claimedEntityLink.entityExternalId);
  const claimedCard = {
    ...targetCard,
    status: 'claimed',
    focusState: 'resolved',
    clarity: 1,
    confidence: Math.max(0.86, Number(targetCard.confidence) || 0),
    linkedEntityIds: Array.from(new Set([
      ...(Array.isArray(targetCard.linkedEntityIds) ? targetCard.linkedEntityIds : []),
      canonicalEntityExternalId
    ].filter(Boolean))),
    canonicalEntityId,
    canonicalEntityExternalId
  };
  cards[cardIndex] = claimedCard;

  const nextFocus = findNextSeerClaimFocusCard(cards, safeCardId);
  const nextCards = cards.map((card) => {
    if (card.id === safeCardId) {
      return claimedCard;
    }
    if (nextFocus && card.id === nextFocus.id) {
      return { ...card, focusState: 'active' };
    }
    return {
      ...card,
      focusState: card.focusState === 'resolved' || firstDefinedString(card.status) === 'claimed' ? 'resolved' : 'idle'
    };
  });

  const spokenMessage = nextFocus
    ? `${firstDefinedString(targetCard.title, 'The card')} is yours now. Keep it, and turn next to ${firstDefinedString(nextFocus.title, 'the next thread')}.`
    : `${firstDefinedString(targetCard.title, 'The card')} is yours now. The spread stands ready for synthesis.`;

  const playerEntry = createSeerTranscriptEntry('player', `I claim ${firstDefinedString(targetCard.title, 'this card')}.`, {
    kind: 'claim_card',
    playerId: safePlayerId
  });
  const seerEntry = createSeerTranscriptEntry('seer', spokenMessage, {
    kind: 'card_claimed',
    focusCardId: nextFocus?.id || '',
    focusMemoryId: firstDefinedString(readingSnapshot?.spread?.focusMemoryId)
  });

  const nextClaimedCards = Array.isArray(readingSnapshot.claimedCards) ? [...readingSnapshot.claimedCards] : [];
  nextClaimedCards.push({
    ...buildClaimedSeerCardRecord(claimedCard, claimedAt),
    entityId: canonicalEntityId,
    entityExternalId: canonicalEntityExternalId
  });
  const nextClaimedEntityLinks = Array.isArray(readingSnapshot.claimedEntityLinks) ? [...readingSnapshot.claimedEntityLinks] : [];
  if (!nextClaimedEntityLinks.some((link) => link.cardId === claimedEntityLink.cardId && link.entityExternalId === claimedEntityLink.entityExternalId)) {
    nextClaimedEntityLinks.push(claimedEntityLink);
  }

  const canonicalEntityProjection = buildSeerReadingEntity(claimedEntity);
  const nextReadingEntities = Array.isArray(readingSnapshot.entities) ? [...readingSnapshot.entities] : [];
  const projectionIndex = nextReadingEntities.findIndex((entity) => (
    firstDefinedString(entity?.id) === firstDefinedString(linkedReadingEntity?.id)
    || firstDefinedString(entity?.externalId) === canonicalEntityExternalId
    || firstDefinedString(entity?.id) === canonicalEntityId
    || firstDefinedString(entity?.sourceEntityId) === canonicalEntityExternalId
  ));
  if (projectionIndex >= 0) {
    nextReadingEntities[projectionIndex] = {
      ...nextReadingEntities[projectionIndex],
      ...canonicalEntityProjection
    };
  } else {
    nextReadingEntities.push(canonicalEntityProjection);
  }

  const nextTranscript = [
    ...(Array.isArray(readingSnapshot.transcript) ? readingSnapshot.transcript : []),
    playerEntry,
    seerEntry
  ];
  const nextSpread = {
    ...(readingSnapshot.spread || {}),
    focusCardId: nextFocus?.id || '',
    cardLayout: buildSeerCardLayout(nextCards)
  };
  const nextBeat = nextFocus ? 'card_attunement' : 'cross_memory_synthesis';
  const nextReadingSnapshot = {
    ...readingSnapshot,
    cards: nextCards,
    claimedCards: nextClaimedCards,
    claimedEntityLinks: nextClaimedEntityLinks,
    entities: nextReadingEntities,
    transcript: nextTranscript,
    spread: nextSpread,
    beat: nextBeat
  };
  const characterSheetDoc = await synthesizeCharacterSheetFromSeerClaim({
    reading: nextReadingSnapshot,
    playerId: safePlayerId,
    claimedEntity,
    card: claimedCard
  });

  return {
    nextReadingSnapshot,
    nextReadingFields: {
      cards: nextCards,
      claimedCards: nextClaimedCards,
      claimedEntityLinks: nextClaimedEntityLinks,
      entities: nextReadingEntities,
      transcript: nextTranscript,
      spread: nextSpread,
      beat: nextBeat
    },
    claimedEntity,
    claimedCard,
    claimedEntityLink,
    spokenMessage,
    characterSheet: characterSheetDoc ? toImmersiveRpgCharacterSheetPayload(characterSheetDoc) : null,
    turnSummary: {
      transitionType: 'card_claimed',
      beat: nextBeat,
      spokenMessage,
      focusMemoryId: firstDefinedString(nextSpread.focusMemoryId),
      focusCardId: nextFocus?.id || '',
      claimedCardIds: [safeCardId],
      claimedEntityLinks: [claimedEntityLink]
    }
  };
}

function buildStorytellerMissionEntityRecords({
  entity = {},
  storyteller = {},
  outcome = '',
  userText = '',
  gmNote = '',
  subEntitySeed = '',
  subEntities = [],
  storytellingPoints = 0,
  durationDays = null,
  message = ''
} = {}) {
  const timestamp = new Date().toISOString();
  const subEntityExternalIds = Array.from(new Set(
    (Array.isArray(subEntities) ? subEntities : [])
      .map((subEntity) => firstDefinedString(subEntity?.externalId, subEntity?.id))
      .filter(Boolean)
  ));
  const storytellerName = firstDefinedString(storyteller?.name);
  const entityName = firstDefinedString(entity?.name, 'Unknown entity');

  return {
    timestamp,
    evidence: {
      kind: 'storyteller_mission',
      entityExternalId: firstDefinedString(entity?.externalId, entity?._id ? String(entity._id) : ''),
      storytellerId: firstDefinedString(storyteller?._id ? String(storyteller._id) : ''),
      storytellerName,
      storytellingPoints,
      durationDays,
      outcome: firstDefinedString(outcome, 'pending'),
      message: firstDefinedString(message),
      userText: firstDefinedString(userText),
      gmNote: firstDefinedString(gmNote),
      subEntitySeed: firstDefinedString(subEntitySeed),
      subEntityExternalIds,
      createdAt: timestamp
    },
    generationCost: {
      kind: 'storyteller_mission',
      entityExternalId: firstDefinedString(entity?.externalId, entity?._id ? String(entity._id) : ''),
      storytellerId: firstDefinedString(storyteller?._id ? String(storyteller._id) : ''),
      storytellerName,
      storytellingPoints,
      durationDays,
      estimatedDollarCost: null,
      createdAt: timestamp
    },
    summaryLine: `${entityName} deepened by ${storytellerName || 'a storyteller'}`
  };
}

function buildStorytellerMissionCharacterSheetPatch({
  existingSheet = {},
  entity = {},
  storyteller = {},
  outcome = '',
  userText = '',
  gmNote = '',
  subEntities = [],
  storytellingPoints = 0
} = {}) {
  const existing = existingSheet && typeof existingSheet === 'object' ? existingSheet : {};
  const existingSkills = existing?.skills && typeof existing.skills === 'object' ? existing.skills : {};
  const entityName = firstDefinedString(entity?.name, 'the entity');
  const storytellerName = firstDefinedString(storyteller?.name, 'the storyteller');
  const description = firstDefinedString(entity?.description, entity?.lore, '');
  const subEntityNames = Array.from(new Set(
    (Array.isArray(subEntities) ? subEntities : [])
      .map((subEntity) => firstDefinedString(subEntity?.name, subEntity?.title))
      .filter(Boolean)
  ));
  const noteLines = [
    `mission: ${entityName} studied through ${storytellerName}`,
    `outcome: ${firstDefinedString(outcome, 'pending')}`,
    firstDefinedString(gmNote),
    firstDefinedString(userText),
    subEntityNames.length ? `sub-entities: ${subEntityNames.join(', ')}` : '',
    storytellingPoints ? `storytelling points spent: ${storytellingPoints}` : ''
  ].filter(Boolean);
  const notes = Array.from(new Set([
    ...(Array.isArray(existing?.notes) ? existing.notes : []),
    ...noteLines
  ])).slice(-20);

  const skillField = deriveSkillFieldFromSeerCardKind(entity?.type || entity?.subtype || entity?.category || '');
  const currentSkillValue = Number(existingSkills?.[skillField]);
  const nextSkillValue = Number.isFinite(currentSkillValue)
    ? Math.min(99, Math.max(currentSkillValue, 10) + 3)
    : 16;

  return {
    identity: {
      archetype: firstDefinedString(existing?.identity?.archetype, entityName)
    },
    coreTraits: {
      drive: firstDefinedString(existing?.coreTraits?.drive, userText, description),
      edge: firstDefinedString(existing?.coreTraits?.edge, gmNote, description)
    },
    skills: {
      ...existingSkills,
      [skillField]: nextSkillValue
    },
    notes
  };
}

async function updateNarrativeEntityAfterStorytellerMission({
  entity,
  storyteller,
  outcome,
  userText,
  gmNote,
  subEntitySeed,
  subEntities,
  storytellingPoints,
  durationDays,
  message
} = {}) {
  const entityId = firstDefinedString(entity?._id ? String(entity._id) : '', entity?.externalId);
  if (!entityId) return null;

  const { evidence, generationCost } = buildStorytellerMissionEntityRecords({
    entity,
    storyteller,
    outcome,
    userText,
    gmNote,
    subEntitySeed,
    subEntities,
    storytellingPoints,
    durationDays,
    message
  });

  return NarrativeEntity.findOneAndUpdate(
    {
      _id: entity._id || entityId
    },
    {
      $set: {
        lastUsedAt: new Date(evidence.createdAt),
        canonicalStatus: firstDefinedString(entity?.canonicalStatus, 'candidate')
      },
      $inc: {
        reuseCount: 1
      },
      $push: {
        evidence,
        generationCosts: generationCost
      }
    },
    {
      new: true
    }
  );
}

async function executeStorytellerMissionAction(body = {}) {
  let storytellerDocIdForReset = null;
  let missionActivated = false;

  try {
    const {
      sessionId,
      playerId,
      entityId,
      storytellerId,
      storytellingPoints,
      message,
      duration
    } = body || {};
    const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

    if (!sessionId || !entityId || !storytellerId) {
      throw createRouteError('Missing required parameters: sessionId, entityId, storytellerId.', 400);
    }
    if (!Number.isInteger(storytellingPoints)) {
      throw createRouteError('Missing or invalid storytellingPoints (int required).', 400);
    }
    if (!message || typeof message !== 'string') {
      throw createRouteError('Missing or invalid message (string required).', 400);
    }

    const entity = await findEntityById(sessionId, resolvedPlayerId, entityId);
    const isPublicEntity = entity?.privacy === 'public';
    if (!entity || (!isPublicEntity && (entity.session_id !== sessionId || !matchesOptionalPlayerId(entity.playerId, resolvedPlayerId)))) {
      throw createRouteError('Entity not found.', 404);
    }

    let storyteller = await Storyteller.findById(storytellerId);
    if (!storyteller) {
      storyteller = await Storyteller.findOne(
        applyOptionalPlayerId({ name: storytellerId, session_id: sessionId }, resolvedPlayerId)
      );
    }
    if (!storyteller || storyteller.session_id !== sessionId || !matchesOptionalPlayerId(storyteller.playerId, resolvedPlayerId)) {
      throw createRouteError('Storyteller not found.', 404);
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
      entityCount: 3,
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
    const updatedMissionEntity = await updateNarrativeEntityAfterStorytellerMission({
      entity,
      storyteller,
      outcome: outcome || 'pending',
      userText,
      gmNote,
      subEntitySeed,
      subEntities: savedSubEntities,
      storytellingPoints,
      durationDays,
      message
    });
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

    return {
      sessionId,
      storytellerId: storyteller._id,
      outcome: missionRecord.outcome,
      userText: userText || undefined,
      gmNote: gmNote || undefined,
      entity: updatedMissionEntity || entity,
      subEntities: savedSubEntities,
      characterSheet: toImmersiveRpgCharacterSheetPayload(
        await ensureImmersiveRpgCharacterSheet({
          sessionId,
          playerId: resolvedPlayerId,
          playerName: '',
          sourceSceneBrief: null,
          patch: buildStorytellerMissionCharacterSheetPatch({
            entity: updatedMissionEntity || entity,
            storyteller,
            outcome: missionRecord.outcome,
            userText: userText || '',
            gmNote: gmNote || '',
            subEntities: savedSubEntities,
            storytellingPoints
          })
        })
      ),
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
    };
  } catch (error) {
    if (missionActivated && storytellerDocIdForReset) {
      try {
        await Storyteller.findByIdAndUpdate(storytellerDocIdForReset, { $set: { status: 'active' } });
      } catch (resetError) {
        console.error('Failed to restore storyteller status after mission error:', resetError);
      }
    }
    throw error;
  }
}

async function createOrLoadImmersiveRpgScene({
  sessionId,
  playerId,
  playerName,
  messengerSceneId,
  promptTemplate = '',
  routeConfig = null,
  allowMockDependencies = false,
  forceReset = false
} = {}) {
  let sceneDoc = await ImmersiveRpgSceneSession.findOne({ sessionId }).lean();
  const sceneDefinition = getImmersiveRpgSceneDefinition(
    sceneDoc?.currentSceneNumber || sceneDoc?.currentSceneKey || null
  );
  const effectivePlayerId = sceneDoc?.playerId || playerId || DEFAULT_IMMERSIVE_RPG_PLAYER_ID;
  const effectivePlayerName = playerName || '';
  const resolvedContext = await resolveImmersiveRpgSceneContext({
    sessionId,
    playerId: effectivePlayerId,
    playerName: effectivePlayerName,
    sceneDefinition,
    allowMockDependencies
  });
  const brief = normalizeMessengerSceneBriefForRpg(
    resolvedContext.context.messenger_scene_brief
  );

  if (resolvedContext.missingContext.length) {
    return {
      sceneDoc: null,
      characterSheetDoc: null,
      bootstrapped: false,
      ready: false,
      sceneDefinition: resolvedContext.sceneDefinition,
      missingContext: resolvedContext.missingContext,
      mockedContext: resolvedContext.mockedContext,
      messengerSceneBrief: brief,
      messengerStorage: resolvedContext.sourceStorage
    };
  }

  const characterSheetDoc = await ensureImmersiveRpgCharacterSheet({
    sessionId,
    playerId: effectivePlayerId,
    playerName: effectivePlayerName,
    sourceSceneBrief: brief
  });

  if (!sceneDoc || forceReset) {
    const bootstrap = buildSceneBootstrap({
      sessionId,
      playerId: effectivePlayerId,
      playerName: effectivePlayerName,
      messengerSceneId: normalizeImmersiveRpgMessengerSceneId(messengerSceneId) || resolvedContext.sceneDefinition.messengerSceneId,
      sceneDefinition: resolvedContext.sceneDefinition,
      sceneBrief: brief,
      currentCharacterSheet: characterSheetDoc,
      promptTemplate,
      routeContract: routeConfig
    });
    sceneDoc = await ImmersiveRpgSceneSession.findOneAndUpdate(
      { sessionId },
      { $set: bootstrap },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    ).lean();
    return {
      sceneDoc,
      characterSheetDoc,
      bootstrapped: true,
      ready: true,
      sceneDefinition: resolvedContext.sceneDefinition,
      missingContext: [],
      mockedContext: resolvedContext.mockedContext,
      messengerSceneBrief: brief,
      messengerStorage: resolvedContext.sourceStorage
    };
  }

  const compiledPrompt = buildCompiledScenePrompt({
    promptTemplate,
    routeContract: routeConfig,
    sceneBrief: sceneDoc.sourceSceneBrief || brief,
    characterSheet: characterSheetDoc,
    currentBeat: sceneDoc.currentBeat,
    transcript: sceneDoc.transcript
  });

  if (sceneDoc.compiledPrompt !== compiledPrompt) {
    sceneDoc = await ImmersiveRpgSceneSession.findOneAndUpdate(
      { sessionId },
      {
        $set: {
          compiledPrompt,
          currentSceneNumber: resolvedContext.sceneDefinition.number,
          currentSceneKey: resolvedContext.sceneDefinition.key,
          sceneTitle: resolvedContext.sceneDefinition.title,
          promptKey: resolvedContext.sceneDefinition.promptKey,
          messengerSceneId: resolvedContext.sceneDefinition.messengerSceneId
        }
      },
      { new: true }
    ).lean();
  }

  return {
    sceneDoc,
    characterSheetDoc,
    bootstrapped: false,
    ready: true,
    sceneDefinition: resolvedContext.sceneDefinition,
    missingContext: [],
    mockedContext: resolvedContext.mockedContext,
    messengerSceneBrief: brief,
    messengerStorage: resolvedContext.sourceStorage
  };
}

function buildImmersiveRpgEnvelope(sceneDoc, characterSheetDoc, extras = {}) {
  const characterSheet = toImmersiveRpgCharacterSheetPayload(characterSheetDoc);
  return {
    ...extras,
    scene: toImmersiveRpgScenePayload(sceneDoc, characterSheetDoc),
    characterSheet
  };
}

registerImmersiveRpgRoutes(app, {
  normalizeImmersiveRpgSessionId,
  normalizeImmersiveRpgPlayerId,
  normalizeImmersiveRpgPlayerName,
  normalizeImmersiveRpgMessengerSceneId,
  resolveImmersiveRpgRuntimeConfig,
  getAiPipelineSettings,
  createOrLoadImmersiveRpgScene,
  buildImmersiveRpgEnvelope,
  getDefaultImmersiveRpgSceneDefinition,
  resolveMockMode,
  createTranscriptEntry,
  buildMockImmersiveRpgChatResponse,
  buildImmersiveRpgPromptMessages,
  callJsonLlm,
  validatePayloadForRoute,
  IMMERSIVE_RPG_TURN_CONTRACT_KEY,
  normalizeImmersiveRpgChatResponse,
  buildCompiledScenePrompt,
  ImmersiveRpgSceneSession,
  resolveSchemaErrorMessage,
  sendLlmAwareError,
  simulateDicePoolRoll,
  resolveRollOutcome,
  getImmersiveRpgSceneDefinition,
  resolveImmersiveRpgSceneContext,
  ensureImmersiveRpgCharacterSheet,
  toImmersiveRpgCharacterSheetPayload
});

registerTypewriterRoutes(app, {
  collectTypewriterPageImages,
  ASSETS_ROOTS,
  TYPEWRITER_PAGE_IMAGES_SUBDIR,
  TYPEWRITER_ALLOWED_PAGE_IMAGE_EXTENSIONS,
  TYPEWRITER_DEFAULT_SERVER_BACKGROUNDS,
  pickRandomItem,
  buildAbsoluteAssetUrl,
  TYPEWRITER_DEFAULT_FONTS,
  countWords,
  clampValue,
  getAiPipelineSettings,
  resolveMockMode,
  narrativeEndsWithTerm,
  XEROFAG_CANDIDATE_TERM,
  startTypewriterSession,
  shouldAllowXerofagInMock,
  getLatestPromptTemplate,
  buildXerofagInspectionPromptMessages,
  callJsonLlm,
  sendLlmAwareError,
  normalizeOptionalPlayerId,
  firstDefinedString,
  ensureBuiltinTypewriterKeys,
  findTypewriterKeyForSession,
  buildTypewriterKeyCandidateNarrative,
  buildTypewriterKeyState,
  NarrativeEntity,
  shouldAllowTypewriterKeyInMock,
  markTypewriterKeyPressed,
  resolveTypewriterKeyVerificationPromptTemplate,
  buildTypewriterKeyVerificationPromptMessages,
  validatePayloadForRoute,
  saveTypewriterSessionFragment,
  buildTypewriterSessionPayload,
  buildTypewriterSessionInspectPayload,
  getTypewriterSessionFragment,
  listTypewriterSlotStorytellers,
  filterAssignedTypewriterStorytellers,
  findNextAvailableTypewriterStorytellerSlot,
  getTypewriterStorytellerThreshold,
  TYPEWRITER_STORYTELLER_CHECK_INTERVAL_WORDS,
  generateTypewriterStorytellerForSlot,
  buildStorytellerListItem,
  buildTypewriterStorytellerSlots,
  listTypewriterKeysForSession,
  findTypewriterStorytellerForIntervention,
  acquireTypewriterStorytellerInterventionLock,
  buildTypewriterSessionStorytellerItem,
  toFiniteNumber,
  buildMockStorytellerIntervention,
  resolveStorytellerInterventionPromptTemplate,
  buildStorytellerInterventionPromptMessages,
  normalizeTypewriterMetadata,
  mergeTypewriterFragment,
  saveTypewriterEntityFromIntervention,
  saveTypewriterKeyFromIntervention,
  Storyteller,
  normalizeContinuationInsights,
  createTypewriterResponse,
  buildMockContinuation,
  buildTypewriterPromptMessages
});

registerDocsRoutes(app, {
  OPEN_API_SPEC
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

function buildEntityAccessQuery(sessionId, playerId) {
  return {
    $or: [
      applyOptionalPlayerId({ session_id: sessionId }, playerId),
      { privacy: 'public' }
    ]
  };
}

function dedupeNarrativeEntitiesForResponse(entities = []) {
  const deduped = [];
  const indexByKey = new Map();

  for (const entity of Array.isArray(entities) ? entities : []) {
    const externalId = firstDefinedString(entity?.externalId);
    const key = externalId || String(entity?._id || '');
    if (!key) {
      deduped.push(entity);
      continue;
    }

    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, deduped.length);
      deduped.push(entity);
      continue;
    }

    const existing = deduped[existingIndex];
    if (firstDefinedString(entity?.privacy) === 'public' && firstDefinedString(existing?.privacy) !== 'public') {
      deduped[existingIndex] = entity;
    }
  }

  return deduped;
}

function matchesOptionalPlayerId(actualPlayerId, expectedPlayerId) {
  const safeExpectedPlayerId = normalizeOptionalPlayerId(expectedPlayerId);
  if (!safeExpectedPlayerId) {
    return true;
  }
  return normalizeOptionalPlayerId(actualPlayerId) === safeExpectedPlayerId;
}

function parseOptionalBooleanQuery(value) {
  if (value === undefined) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
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

function escapeRegexPattern(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveWorldContextForSession(sessionId, playerId = '', requestedWorldId = '', requestedUniverseId = '') {
  const explicitWorldId = firstDefinedString(requestedWorldId);
  const explicitUniverseId = firstDefinedString(requestedUniverseId);
  if (explicitWorldId || explicitUniverseId) {
    return {
      worldId: explicitWorldId || explicitUniverseId,
      universeId: explicitUniverseId || explicitWorldId
    };
  }

  if (!sessionId) {
    return { worldId: '', universeId: '' };
  }

  const latestWorld = await World.findOne(
    applyOptionalPlayerId({ sessionId }, playerId)
  )
    .sort({ createdAt: -1 })
    .lean();

  const derivedWorldId = firstDefinedString(latestWorld?.worldId);
  return {
    worldId: derivedWorldId,
    universeId: derivedWorldId
  };
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

function getFallbackTypewriterStorytellerSlotDefinition(index = 0) {
  if (!TYPEWRITER_STORYTELLER_KEY_SLOTS.length) {
    return {
      slotIndex: Number.isInteger(index) ? index : 0,
      slotKey: 'storyteller_slot_fallback',
      keyShape: 'horizontal',
      blankShape: 'horizontal storyteller slot',
      blankTextureUrl: '/textures/keys/blank_horizontal_1.png',
      shapePromptHint: 'wide horizontal key face with a centered emblem and calm edge margins'
    };
  }
  const safeIndex = Number.isInteger(index) && index >= 0
    ? index % TYPEWRITER_STORYTELLER_KEY_SLOTS.length
    : 0;
  return TYPEWRITER_STORYTELLER_KEY_SLOTS[safeIndex];
}

function normalizeGeneratedStorytellerPayload(storyteller, slotDefinition = null, storytellerIndex = 0) {
  const safeStoryteller = storyteller && typeof storyteller === 'object' ? storyteller : {};
  const resolvedSlotDefinition = slotDefinition || getFallbackTypewriterStorytellerSlotDefinition(storytellerIndex);

  return {
    ...safeStoryteller,
    typewriter_key: buildTypewriterStorytellerKeyPayload(
      safeStoryteller.typewriter_key,
      resolvedSlotDefinition
    )
  };
}

function getTypewriterStorytellerSlotDefinition(slotIndex) {
  return TYPEWRITER_STORYTELLER_KEY_SLOTS.find((slot) => slot.slotIndex === slotIndex) || null;
}

const STORYTELLER_REPRESS_GROWTH_FACTOR = 1.1;

function normalizeTypewriterFragmentLength(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function getStorytellerLastPressFragmentLength(storyteller) {
  const normalized = normalizeTypewriterFragmentLength(storyteller?.lastTypewriterPressFragmentLength);
  return normalized > 0 ? normalized : null;
}

function getStorytellerRequiredFragmentLength(storyteller) {
  const lastPressFragmentLength = getStorytellerLastPressFragmentLength(storyteller);
  if (lastPressFragmentLength === null) return 0;
  return Math.floor(lastPressFragmentLength * STORYTELLER_REPRESS_GROWTH_FACTOR) + 1;
}

function buildTypewriterStorytellerPressState(storyteller, currentFragmentLength = 0) {
  const safeFragmentLength = normalizeTypewriterFragmentLength(currentFragmentLength);
  const lastPressFragmentLength = getStorytellerLastPressFragmentLength(storyteller);
  const requiredFragmentLength = getStorytellerRequiredFragmentLength(storyteller);
  const typewriterInterventionInFlight = Boolean(storyteller?.typewriterInterventionInFlight);
  const canPressByGrowth = !requiredFragmentLength || safeFragmentLength >= requiredFragmentLength;
  return {
    currentFragmentLength: safeFragmentLength,
    lastPressFragmentLength,
    requiredFragmentLength,
    fragmentGrowthNeeded: Math.max(0, requiredFragmentLength - safeFragmentLength),
    lastTypewriterPressAt: storyteller?.lastTypewriterPressAt || null,
    typewriterInterventionInFlight,
    pressLockedReason: typewriterInterventionInFlight
      ? 'processing'
      : canPressByGrowth
        ? ''
        : 'growth_required',
    canPress: Boolean(storyteller) && !typewriterInterventionInFlight && canPressByGrowth
  };
}

function buildTypewriterStorytellerSlotState(slotDefinition, storyteller = null, currentFragmentLength = 0) {
  const keyImageUrl = firstDefinedString(storyteller?.keyImageLocalUrl, storyteller?.keyImageUrl);
  const pressState = buildTypewriterStorytellerPressState(storyteller, currentFragmentLength);
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
    description: firstDefinedString(storyteller?.typewriter_key?.description),
    canPress: Boolean(storyteller && keyImageUrl && pressState.canPress),
    pressLockedReason: pressState.pressLockedReason,
    currentFragmentLength: pressState.currentFragmentLength,
    lastPressFragmentLength: pressState.lastPressFragmentLength,
    requiredFragmentLength: pressState.requiredFragmentLength,
    fragmentGrowthNeeded: pressState.fragmentGrowthNeeded,
    lastTypewriterPressAt: pressState.lastTypewriterPressAt,
    typewriterInterventionInFlight: pressState.typewriterInterventionInFlight
  };
}

function buildTypewriterStorytellerSlots(storytellers = [], currentFragmentLength = 0) {
  const storytellerBySlot = new Map();
  for (const storyteller of storytellers) {
    if (!Number.isInteger(storyteller?.keySlotIndex)) continue;
    if (!TYPEWRITER_STORYTELLER_SLOT_INDICES.includes(storyteller.keySlotIndex)) continue;
    if (!storytellerBySlot.has(storyteller.keySlotIndex)) {
      storytellerBySlot.set(storyteller.keySlotIndex, storyteller);
    }
  }
  return TYPEWRITER_STORYTELLER_KEY_SLOTS.map((slotDefinition) =>
    buildTypewriterStorytellerSlotState(
      slotDefinition,
      storytellerBySlot.get(slotDefinition.slotIndex) || null,
      currentFragmentLength
    )
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

function normalizeTypewriterKeyInsertText(value, fallbackKeyText = '') {
  const base = firstDefinedString(value, fallbackKeyText) || fallbackKeyText;
  return base.trim() || fallbackKeyText || 'Hidden Omen';
}

function buildTypewriterEntityKeyState(typewriterKey) {
  return buildTypewriterKeyState(typewriterKey);
}

function buildTypewriterSessionEntityItem(entity) {
  const source = entity && typeof entity.toObject === 'function' ? entity.toObject() : entity || {};
  return {
    id: String(source?._id || ''),
    session_id: firstDefinedString(source?.session_id, source?.sessionId),
    sessionId: firstDefinedString(source?.sessionId, source?.session_id),
    playerId: firstDefinedString(source?.playerId),
    name: firstDefinedString(source?.name, 'Unnamed'),
    description: firstDefinedString(source?.description),
    lore: firstDefinedString(source?.lore),
    privacy: firstDefinedString(source?.privacy, 'session'),
    type: firstDefinedString(source?.type),
    subtype: firstDefinedString(source?.subtype),
    tags: normalizeLooseStringArray(source?.tags),
    universalTraits: normalizeLooseStringArray(source?.universalTraits),
    attributes: source?.attributes && typeof source.attributes === 'object' ? { ...source.attributes } : {},
    connections: source?.connections || {},
    externalId: firstDefinedString(source?.externalId),
    worldId: firstDefinedString(source?.worldId),
    universeId: firstDefinedString(source?.universeId),
    canonicalStatus: firstDefinedString(source?.canonicalStatus),
    sourceReadingIds: Array.isArray(source?.sourceReadingIds) ? [...source.sourceReadingIds] : [],
    claimedFromCardIds: Array.isArray(source?.claimedFromCardIds) ? [...source.claimedFromCardIds] : [],
    storytellingPointsCost: Number.isFinite(Number(source?.storytellingPointsCost)) ? Number(source.storytellingPointsCost) : null,
    storytelling_points: Number.isFinite(Number(source?.storytelling_points)) ? Number(source.storytelling_points) : null,
    hooks: source?.hooks || null,
    specificity: source?.specificity || null,
    reuseCount: Number.isFinite(Number(source?.reuseCount)) ? Number(source.reuseCount) : 0,
    lastUsedAt: source?.lastUsedAt || null,
    mediaAssets: Array.isArray(source?.mediaAssets) ? [...source.mediaAssets] : [],
    source: firstDefinedString(source?.source, 'unknown'),
    sourceRoute: firstDefinedString(source?.sourceRoute),
    typewriterKeyText: firstDefinedString(source?.typewriterKeyText),
    typewriterSource: firstDefinedString(source?.typewriterSource),
    introducedByStorytellerId: firstDefinedString(source?.introducedByStorytellerId),
    introducedByStorytellerName: firstDefinedString(source?.introducedByStorytellerName),
    activeInTypewriter: Boolean(source?.activeInTypewriter),
    createdAt: source?.createdAt || null,
    updatedAt: source?.updatedAt || null
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
  const entities = await NarrativeEntity.find({
    ...buildEntityAccessQuery(sessionId, playerId),
    typewriterKeyText: { $exists: true, $ne: '' },
    activeInTypewriter: true
  })
    .sort({ createdAt: -1 })
    .limit(16)
    .exec();
  return dedupeNarrativeEntitiesForResponse(entities).slice(0, 8);
}

async function ensureBuiltinTypewriterKeys(sessionId, playerId = '') {
  if (!sessionId) return [];

  const xerofagEntity = await upsertNarrativeEntity(
    XEROFAG_ENTITY_SEED,
    {
      sessionId: PUBLIC_NARRATIVE_ENTITY_SESSION_ID,
      playerId: '',
      privacy: 'public',
      source: XEROFAG_ENTITY_SEED?.source || 'public_narrative_entity_seed',
      sourceRoute: XEROFAG_ENTITY_SEED?.sourceRoute || 'seeds/public_narrative_entities.json',
      lookup: {
        privacy: 'public',
        externalId: XEROFAG_ENTITY_EXTERNAL_ID
      }
    }
  );

  const xerofagKey = await upsertTypewriterKey(
    {
      session_id: sessionId,
      sessionId,
      playerId,
      entityId: xerofagEntity?._id || null,
      entityName: XEROFAG_CANDIDATE_TERM,
      keyText: XEROFAG_KEY_TEXT,
      insertText: XEROFAG_CANDIDATE_TERM,
      description: XEROFAG_SUMMARY,
      sourceType: 'builtin',
      sourceRoute: '/api/shouldAllowXerofag',
      verificationKind: 'typewriter_key_verification',
      activeInTypewriter: true,
      knowledgeState: 'hidden',
      playerFacingTooltip: '',
      textureUrl: TYPEWRITER_TEXT_KEY_TEXTURE_URL,
      keyImageUrl: TYPEWRITER_XEROFAG_KEY_IMAGE_URL,
      sortOrder: 0
    },
    {
      sessionId,
      playerId,
      lookup: applyOptionalPlayerId(
        {
          session_id: sessionId,
          keyText: XEROFAG_KEY_TEXT,
          sourceType: 'builtin'
        },
        playerId
      )
    }
  );

  return [xerofagKey].filter(Boolean);
}

async function buildTypewriterSessionPayload(sessionId, fragment, initialFragment = '', playerId = '') {
  await ensureBuiltinTypewriterKeys(sessionId, playerId);
  const typewriterKeys = (await listTypewriterKeysForSession(sessionId, playerId)).map(buildTypewriterKeyState);
  return {
    sessionId,
    fragment,
    initialFragment,
    typewriterKeys,
    entityKeys: typewriterKeys
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

  const storytellersForValidation = normalizedStorytellers.map((storyteller, storytellerIndex) =>
    normalizeGeneratedStorytellerPayload(storyteller, slotDefinition, storytellerIndex)
  );

  await validatePayloadForRoute('text_to_storyteller', { storytellers: storytellersForValidation });

  const storytellerData = storytellersForValidation[0];
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

function buildTypewriterSessionStorytellerItem(storyteller) {
  const pressState = buildTypewriterStorytellerPressState(storyteller, 0);
  return {
    ...buildStorytellerListItem(storyteller),
    introducedInTypewriter: Boolean(storyteller?.introducedInTypewriter),
    typewriterInterventionsCount: Number.isFinite(Number(storyteller?.typewriterInterventionsCount))
      ? Number(storyteller.typewriterInterventionsCount)
      : 0,
    lastTypewriterInterventionAt: storyteller?.lastTypewriterInterventionAt || null,
    lastTypewriterPressAt: pressState.lastTypewriterPressAt,
    lastPressFragmentLength: pressState.lastPressFragmentLength,
    requiredFragmentLength: pressState.requiredFragmentLength,
    typewriterInterventionInFlight: pressState.typewriterInterventionInFlight,
    symbol: firstDefinedString(storyteller?.typewriter_key?.symbol),
    description: firstDefinedString(storyteller?.typewriter_key?.description),
    createdAt: storyteller?.createdAt || null,
    updatedAt: storyteller?.updatedAt || null
  };
}

async function buildTypewriterSessionInspectPayload(sessionId, playerId = '') {
  if (!sessionId) return null;

  const fragmentDoc = await NarrativeFragment.findOne({ session_id: sessionId })
    .sort({ turn: 1 })
    .lean();
  if (!fragmentDoc) {
    return null;
  }

  const storytellers = await listTypewriterSlotStorytellers(sessionId, playerId);
  const typewriterKeys = (await listTypewriterKeysForSession(sessionId, playerId)).map(buildTypewriterKeyState);
  const entities = (await listTypewriterStoryEntities(sessionId, playerId)).map(buildTypewriterSessionEntityItem);
  const narrativeText = firstDefinedString(fragmentDoc?.fragment);
  const narrativeLength = narrativeText.length;
  const slots = buildTypewriterStorytellerSlots(storytellers, narrativeLength);

  return {
    sessionId,
    playerId,
    fragment: narrativeText,
    initialFragment: firstDefinedString(fragmentDoc?.initialFragment),
    currentFragmentLength: narrativeLength,
    narrativeWordCount: countWords(narrativeText),
    slots,
    typewriterKeys,
    entityKeys: typewriterKeys,
    storytellers: storytellers.map(buildTypewriterSessionStorytellerItem),
    entities,
    counts: {
      storytellerCount: storytellers.length,
      slotFilledCount: slots.filter((slot) => slot.filled).length,
      typewriterKeyCount: typewriterKeys.length,
      entityCount: entities.length
    }
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

async function resolveTypewriterKeyVerificationPromptTemplate() {
  const latestPrompt = await getLatestPromptTemplate('typewriter_key_verification');
  if (latestPrompt?.promptTemplate) {
    return latestPrompt.promptTemplate;
  }
  const currentTemplates = await getCurrentTypewriterPromptTemplates();
  return currentTemplates?.typewriter_key_verification?.promptTemplate || '';
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
  return upsertNarrativeEntity(
    {
      session_id: sessionId,
      sessionId,
      playerId: playerId || firstDefinedString(storyteller?.playerId),
      name: entityName,
      description: firstDefinedString(entity?.summary) || 'A newly surfaced narrative entity.',
      lore: firstDefinedString(entity?.lore),
      type: firstDefinedString(entity?.type) || 'omen',
      subtype: firstDefinedString(entity?.subtype),
      universal_traits: normalizeLooseStringArray(entity?.tags),
      relevance: `Introduced during a typewriter intervention by ${firstDefinedString(storyteller?.name) || 'an unnamed storyteller'}.`,
      externalId,
      source: 'storyteller_intervention',
      sourceRoute: '/api/send_storyteller_typewriter_text',
      typewriterKeyText: keyText,
      typewriterSource: 'storyteller_intervention',
      introducedByStorytellerId: String(storyteller?._id || ''),
      introducedByStorytellerName: firstDefinedString(storyteller?.name),
      sourceStorytellerKeySlot: Number.isInteger(storyteller?.keySlotIndex) ? storyteller.keySlotIndex : null,
      activeInTypewriter: true
    },
    {
      sessionId,
      playerId: playerId || firstDefinedString(storyteller?.playerId),
      source: 'storyteller_intervention',
      sourceRoute: '/api/send_storyteller_typewriter_text',
      lookup: applyOptionalPlayerId(
        {
          session_id: sessionId,
          introducedByStorytellerId: String(storyteller?._id || ''),
          typewriterKeyText: keyText
        },
        playerId || firstDefinedString(storyteller?.playerId)
      )
    }
  );
}

async function saveTypewriterKeyFromIntervention({
  sessionId,
  playerId = '',
  storyteller,
  entity,
  keyText,
  insertText
}) {
  const normalizedKeyText = normalizeTypewriterEntityKeyText(
    keyText,
    firstDefinedString(entity?.typewriterKeyText, entity?.name)
  );
  const normalizedInsertText = normalizeTypewriterKeyInsertText(insertText, normalizedKeyText);
  const description = firstDefinedString(entity?.description, entity?.lore, entity?.relevance);

  return upsertTypewriterKey(
    {
      session_id: sessionId,
      sessionId,
      playerId: playerId || firstDefinedString(storyteller?.playerId),
      entityId: entity?._id || null,
      entityName: firstDefinedString(entity?.name),
      keyText: normalizedKeyText,
      insertText: normalizedInsertText,
      description,
      sourceType: 'storyteller_intervention',
      sourceRoute: '/api/send_storyteller_typewriter_text',
      sourceStorytellerId: String(storyteller?._id || ''),
      sourceStorytellerName: firstDefinedString(storyteller?.name),
      sourceStorytellerKeySlot: Number.isInteger(storyteller?.keySlotIndex) ? storyteller.keySlotIndex : null,
      verificationKind: 'typewriter_key_verification',
      activeInTypewriter: true,
      knowledgeState: 'known',
      playerFacingTooltip: description,
      textureUrl: TYPEWRITER_TEXT_KEY_TEXTURE_URL,
      sortOrder: 100
    },
    {
      sessionId,
      playerId: playerId || firstDefinedString(storyteller?.playerId),
      lookup: applyOptionalPlayerId(
        {
          session_id: sessionId,
          keyText: normalizedKeyText,
          sourceType: 'storyteller_intervention'
        },
        playerId || firstDefinedString(storyteller?.playerId)
      )
    }
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

async function acquireTypewriterStorytellerInterventionLock(storytellerId, currentFragmentLength) {
  if (!storytellerId) return null;
  const safeFragmentLength = normalizeTypewriterFragmentLength(currentFragmentLength);
  const maxEligibleBaseline = safeFragmentLength / STORYTELLER_REPRESS_GROWTH_FACTOR;
  return Storyteller.findOneAndUpdate(
    {
      _id: storytellerId,
      $and: [
        {
          $or: [
            { typewriterInterventionInFlight: { $exists: false } },
            { typewriterInterventionInFlight: false }
          ]
        },
        {
          $or: [
            { lastTypewriterPressFragmentLength: { $exists: false } },
            { lastTypewriterPressFragmentLength: null },
            { lastTypewriterPressFragmentLength: { $lt: maxEligibleBaseline } }
          ]
        }
      ]
    },
    {
      $set: {
        typewriterInterventionInFlight: true
      }
    },
    { new: true }
  );
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

const SEER_READING_FIELD_TIERS = {
  0: [],
  1: ['short_title', 'whose_eyes', 'time_of_day', 'location', 'emotional_sentiment'],
  2: ['what_is_being_watched', 'entities_in_memory', 'temporal_relation', 'related_through_what'],
  3: ['action_name', 'dramatic_definition', 'actual_result', 'organizational_affiliation'],
  4: ['miseenscene'],
  5: ['consequences', 'relevant_rolls', 'estimated_action_length', 'action_level']
};

const SEER_MEMORY_STRENGTH_PROFILES = {
  vivid: { revealTier: 2, clarity: 0.45 },
  durable: { revealTier: 1, clarity: 0.3 },
  faint: { revealTier: 0, clarity: 0.15 }
};

const SEER_TRIAD_POSITIONS = {
  before: { x: -1, y: -0.16 },
  during: { x: 0, y: -0.9 },
  after: { x: 1, y: -0.16 }
};

const DEFAULT_SEER_CARD_KINDS = Object.freeze([
  'character',
  'location',
  'event',
  'item',
  'faction',
  'omen',
  'symbol',
  'authority',
  'ritual',
  'feeling'
]);

function normalizeSeerMemoryStrength(value) {
  const normalized = firstDefinedString(value).toLowerCase();
  if (normalized === 'vivid' || normalized === 'durable' || normalized === 'faint') {
    return normalized;
  }
  return 'durable';
}

function deriveSeerTemporalSlot(memory = {}) {
  const temporalText = firstDefinedString(memory.temporal_relation, memory.time_within_action, memory.memory_distance).toLowerCase();
  if (
    /\b(minutes earlier|earlier|before|prior|previous|preceding|just before)\b/.test(temporalText)
  ) {
    return 'before';
  }
  if (
    /\b(simultaneous|same moment|the instant|at the moment|during|while|simultaneous with fragment)\b/.test(temporalText)
  ) {
    return 'during';
  }
  if (
    /\b(after|later|hours later|days later|that night|following|afterward|afterwards)\b/.test(temporalText)
  ) {
    return 'after';
  }
  return 'during';
}

function getSeerVisibleFieldsForTier(revealTier = 0) {
  const fields = [];
  for (let tier = 1; tier <= revealTier; tier += 1) {
    const tierFields = SEER_READING_FIELD_TIERS[tier] || [];
    fields.push(...tierFields);
  }
  return [...new Set(fields)];
}

function normalizeSeerCardCount(value, fallback = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Math.max(1, Math.min(10, Number(fallback) || 3));
  }
  return Math.max(1, Math.min(10, Math.floor(numeric)));
}

function normalizeSeerStringArray(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(values
    .map((entry) => `${entry || ''}`.trim().toLowerCase())
    .filter(Boolean))];
}

function humanizeSeerCardKind(kind = '') {
  return firstDefinedString(kind)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Card';
}

function splitSeerTags(value, fallback = []) {
  const source = firstDefinedString(value);
  if (!source) return [...fallback];
  const entries = source
    .split(/,|;|\bturning to\b|\band\b|\//i)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set(entries.length ? entries : fallback)].slice(0, 4);
}

function chooseSeerVisionSourceMemory(memories = [], requestedMemoryId = '') {
  const safeRequestedId = firstDefinedString(requestedMemoryId);
  if (safeRequestedId) {
    const requested = memories.find((memory) => String(memory._id || memory.id || '') === safeRequestedId);
    if (requested) return requested;
  }

  const duringVivid = memories.find((memory) =>
    deriveSeerTemporalSlot(memory) === 'during' && normalizeSeerMemoryStrength(memory.memory_strength) === 'vivid'
  );
  if (duringVivid) return duringVivid;

  const vivid = memories.find((memory) => normalizeSeerMemoryStrength(memory.memory_strength) === 'vivid');
  if (vivid) return vivid;

  const during = memories.find((memory) => deriveSeerTemporalSlot(memory) === 'during');
  if (during) return during;

  return memories[0] || null;
}

function collectSeerHeuristicCardKinds(memory = {}) {
  const kinds = [];
  if (firstDefinedString(memory.whose_eyes) || Array.isArray(memory.entities_in_memory)) {
    kinds.push('character');
  }
  if (firstDefinedString(memory.location, memory.geographical_relevance)) {
    kinds.push('location');
  }
  if (firstDefinedString(memory.action_name, memory.actual_result, memory.dramatic_definition, memory.short_title)) {
    kinds.push('event');
  }
  if (firstDefinedString(memory.what_is_being_watched, memory.related_through_what)) {
    kinds.push('item');
  }
  if (firstDefinedString(memory.organizational_affiliation).toLowerCase() && firstDefinedString(memory.organizational_affiliation).toLowerCase() !== 'none') {
    kinds.push('faction');
  }
  if (firstDefinedString(memory.emotional_sentiment)) {
    kinds.push('feeling');
  }
  return [...new Set(kinds)];
}

function resolveSeerCardKinds({
  cardCount = 3,
  explicitKinds = [],
  preferredKinds = [],
  allowedKinds = [],
  visionMemory = {}
}) {
  const safeCount = normalizeSeerCardCount(cardCount, 3);
  const normalizedAllowed = normalizeSeerStringArray(allowedKinds);
  const normalizedExplicit = normalizeSeerStringArray(explicitKinds);
  const normalizedPreferred = normalizeSeerStringArray(preferredKinds);
  const heuristics = collectSeerHeuristicCardKinds(visionMemory);

  const allowedPool = normalizedAllowed.length
    ? normalizedAllowed
    : DEFAULT_SEER_CARD_KINDS;

  const ordered = [];
  const addKinds = (entries = []) => {
    entries.forEach((kind) => {
      if (!kind) return;
      if (normalizedAllowed.length && !allowedPool.includes(kind)) return;
      if (ordered.includes(kind)) return;
      ordered.push(kind);
    });
  };

  addKinds(normalizedExplicit);
  addKinds(normalizedPreferred);
  addKinds(heuristics);
  addKinds(allowedPool);
  addKinds(DEFAULT_SEER_CARD_KINDS);

  while (ordered.length < safeCount) {
    ordered.push(`thread-${ordered.length + 1}`);
  }

  return ordered.slice(0, safeCount);
}

function buildSeerVision(memory = {}) {
  const strength = normalizeSeerMemoryStrength(memory.memory_strength);
  const profile = SEER_MEMORY_STRENGTH_PROFILES[strength] || SEER_MEMORY_STRENGTH_PROFILES.durable;
  const revealTier = Math.max(0, profile.revealTier - 1);
  return {
    sourceMemoryId: String(memory._id || memory.id || ''),
    status: 'blurred',
    clarity: Math.max(0.08, Math.min(0.42, profile.clarity * 0.65)),
    revealTier,
    visibleFields: getSeerVisibleFieldsForTier(revealTier),
    sensoryFragments: [
      firstDefinedString(memory.what_is_being_watched),
      firstDefinedString(memory.location),
      firstDefinedString(memory.time_of_day),
      firstDefinedString(memory.emotional_sentiment)
    ].filter(Boolean),
    currentSubjectLabel: firstDefinedString(memory.whose_eyes, Array.isArray(memory.entities_in_memory) ? memory.entities_in_memory[0] : '')
  };
}

function buildSeerCardTitle(memory = {}, kind = '', index = 0) {
  const humanizedKind = humanizeSeerCardKind(kind);
  switch (kind) {
    case 'character':
      return firstDefinedString(memory.whose_eyes, Array.isArray(memory.entities_in_memory) ? memory.entities_in_memory[0] : '', humanizedKind);
    case 'location':
      return firstDefinedString(memory.location, memory.geographical_relevance, humanizedKind);
    case 'event':
      return firstDefinedString(memory.action_name, memory.short_title, humanizedKind);
    case 'item':
      return firstDefinedString(memory.related_through_what, memory.what_is_being_watched, `The ${humanizedKind}`);
    case 'faction':
      return firstDefinedString(memory.organizational_affiliation, `The ${humanizedKind}`);
    case 'feeling':
      return firstDefinedString(memory.emotional_sentiment, humanizedKind);
    case 'authority':
      return firstDefinedString(
        Array.isArray(memory.entities_in_memory) ? memory.entities_in_memory.find((entry) => /lord|lady|king|queen|captain|magistrate|master|brother/i.test(`${entry || ''}`)) : '',
        `The ${humanizedKind}`
      );
    default:
      return firstDefinedString(memory.short_title, memory.action_name, `${humanizedKind} ${index + 1}`);
  }
}

function buildSeerCardSummary(memory = {}, kind = '') {
  switch (kind) {
    case 'character':
      return firstDefinedString(memory.dramatic_definition, `A presence glimpsed through ${firstDefinedString(memory.whose_eyes, 'borrowed eyes')}.`);
    case 'location':
      return firstDefinedString(memory.geographical_relevance, memory.location, 'A place that seems to remember more than it shows.');
    case 'event':
      return firstDefinedString(memory.actual_result, memory.action_name, 'Something happened here that changed the path afterward.');
    case 'item':
      return firstDefinedString(memory.related_through_what, memory.what_is_being_watched, 'A small thing carries more meaning than its price would suggest.');
    case 'faction':
      return firstDefinedString(memory.organizational_affiliation, 'A collective force presses at the edge of the vision.');
    case 'feeling':
      return firstDefinedString(memory.emotional_sentiment, 'Emotion arrives before explanation.');
    default:
      return firstDefinedString(memory.dramatic_definition, 'A thread in the reading waits to be made legible.');
  }
}

function buildSeerReadingCard(memory = {}, kind = '', index = 0, isFocused = false) {
  const moods = splitSeerTags(memory.emotional_sentiment, ['unease']);
  const motifs = [
    firstDefinedString(memory.related_through_what),
    firstDefinedString(memory.what_is_being_watched),
    firstDefinedString(memory.time_of_day),
    firstDefinedString(memory.location)
  ].filter(Boolean).slice(0, 4);
  const title = buildSeerCardTitle(memory, kind, index);
  return {
    id: `seer-card-${randomUUID()}`,
    kind: firstDefinedString(kind, `thread-${index + 1}`),
    title,
    status: 'back_only',
    focusState: isFocused ? 'active' : 'idle',
    clarity: isFocused ? 0.18 : 0.08,
    confidence: isFocused ? 0.24 : 0.12,
    revealTier: 0,
    back: {
      imageUrl: firstDefinedString(memory.back_image_url, memory.back?.imageUrl),
      texturePrompt: firstDefinedString(memory.back?.prompt),
      mood: moods,
      motifs: motifs.length ? motifs : [humanizeSeerCardKind(kind)],
      genreSignal: firstDefinedString(memory.dramatic_definition, memory.action_level, humanizeSeerCardKind(kind))
    },
    front: {
      imageUrl: firstDefinedString(memory.front_image_url, memory.front?.imageUrl),
      summary: buildSeerCardSummary(memory, kind),
      facts: []
    },
    likelyRelationHint: firstDefinedString(memory.related_through_what, memory.dramatic_definition),
    linkedEntityIds: []
  };
}

function buildSeerReadingCardFromDraft(memory = {}, draft = {}, index = 0, isFocused = false) {
  const fallback = buildSeerReadingCard(memory, firstDefinedString(draft.kind), index, isFocused);
  const draftMoods = normalizeSeerStringArray(draft.back_moods);
  const draftMotifs = normalizeSeerStringArray(draft.back_motifs);
  const draftFacts = Array.isArray(draft.facts)
    ? draft.facts.map((entry) => firstDefinedString(entry)).filter(Boolean).slice(0, 4)
    : [];
  return {
    ...fallback,
    kind: firstDefinedString(draft.kind, fallback.kind),
    title: firstDefinedString(draft.label, draft.title, fallback.title),
    back: {
      ...fallback.back,
      texturePrompt: firstDefinedString(draft.texture_prompt, fallback.back?.texturePrompt),
      mood: draftMoods.length ? draftMoods : (fallback.back?.mood || []),
      motifs: draftMotifs.length ? draftMotifs : (fallback.back?.motifs || []),
      genreSignal: firstDefinedString(draft.back_genre_signal, fallback.back?.genreSignal)
    },
    front: {
      ...fallback.front,
      summary: firstDefinedString(draft.summary, fallback.front?.summary),
      facts: draftFacts.length ? draftFacts : (fallback.front?.facts || [])
    },
    likelyRelationHint: firstDefinedString(draft.likely_relation_hint, fallback.likelyRelationHint)
  };
}

function selectTriadMemories(memories = []) {
  const buckets = {
    before: [],
    during: [],
    after: []
  };

  memories.forEach((memory) => {
    buckets[deriveSeerTemporalSlot(memory)].push(memory);
  });

  const selected = [];
  const usedIds = new Set();

  ['before', 'during', 'after'].forEach((slot) => {
    const memory = buckets[slot][0];
    if (!memory) return;
    selected.push({ slot, memory });
    usedIds.add(String(memory._id || memory.id || ''));
  });

  if (selected.length < 3) {
    memories.forEach((memory) => {
      if (selected.length >= 3) return;
      const key = String(memory._id || memory.id || '');
      if (usedIds.has(key)) return;
      const nextSlot = ['before', 'during', 'after'].find((slot) => !selected.some((entry) => entry.slot === slot)) || deriveSeerTemporalSlot(memory);
      selected.push({ slot: nextSlot, memory });
      usedIds.add(key);
    });
  }

  return selected.slice(0, 3);
}

function selectSeerRuntimeMemories(memories = [], visionSourceMemory = null) {
  const selected = selectTriadMemories(memories);
  if (selected.length) {
    return selected;
  }
  if (visionSourceMemory) {
    return [{ slot: deriveSeerTemporalSlot(visionSourceMemory), memory: visionSourceMemory }];
  }
  return memories.slice(0, 3).map((memory) => ({ slot: deriveSeerTemporalSlot(memory), memory }));
}

async function resolveSeerReadingMemories(sessionId, playerId = '', batchId = '') {
  const baseQuery = applyOptionalPlayerId({ sessionId }, playerId);
  const safeBatchId = firstDefinedString(batchId);
  if (safeBatchId) {
    return FragmentMemory.find({ ...baseQuery, batchId: safeBatchId }).sort({ createdAt: 1 }).lean();
  }

  const latestMemory = await FragmentMemory.findOne(baseQuery).sort({ createdAt: -1 }).lean();
  if (!latestMemory) {
    return [];
  }

  if (firstDefinedString(latestMemory.batchId)) {
    return FragmentMemory.find({ ...baseQuery, batchId: latestMemory.batchId }).sort({ createdAt: 1 }).lean();
  }

  return FragmentMemory.find(baseQuery).sort({ createdAt: -1 }).limit(3).lean();
}

function chooseInitialSeerFocusMemoryId(memories = []) {
  const duringMemory = memories.find((memory) => memory.temporalSlot === 'during');
  if (duringMemory) return duringMemory.id;
  const vividMemory = memories.find((memory) => memory.strength === 'vivid');
  if (vividMemory) return vividMemory.id;
  return memories[0]?.id || '';
}

function buildSeerReadingMemory(memory = {}, temporalSlot = 'during', isFocused = false) {
  const strength = normalizeSeerMemoryStrength(memory.memory_strength);
  const profile = SEER_MEMORY_STRENGTH_PROFILES[strength] || SEER_MEMORY_STRENGTH_PROFILES.durable;
  const id = String(memory._id || memory.id || randomUUID());
  return {
    id,
    sourceMemoryId: id,
    temporalSlot,
    strength,
    clarity: profile.clarity,
    revealTier: profile.revealTier,
    focusState: isFocused ? 'active' : 'idle',
    witness: firstDefinedString(memory.whose_eyes),
    sentiment: firstDefinedString(memory.emotional_sentiment),
    location: firstDefinedString(memory.location),
    timeOfDay: firstDefinedString(memory.time_of_day),
    visibleFields: getSeerVisibleFieldsForTier(profile.revealTier),
    candidateEntityIds: [],
    confirmedEntityIds: [],
    card: {
      title: firstDefinedString(memory.short_title, memory.dramatic_definition, memory.action_name, 'Unknown glimpse'),
      subtitle: firstDefinedString(memory.temporal_relation),
      artUrl: firstDefinedString(memory.front_image_url, memory.back_image_url, memory.front?.imageUrl, memory.back?.imageUrl)
    },
    raw: memory
  };
}

function buildSeerReadingEntity(entity = {}) {
  return {
    ...buildTypewriterSessionEntityItem(entity),
    kind: 'existing',
    status: 'present',
    provenance: 'session'
  };
}

function buildSeerReadingApparition(storyteller = {}) {
  const item = buildStorytellerListItem(storyteller);
  return {
    id: String(item.id || ''),
    name: firstDefinedString(item.name, 'Unnamed apparition'),
    status: firstDefinedString(item.status, 'active'),
    iconUrl: firstDefinedString(item.iconUrl),
    level: Number.isFinite(Number(item.level)) ? Number(item.level) : null,
    state: 'available'
  };
}

function buildSeerCardLayout(cards = []) {
  const total = Math.max(1, cards.length);
  return cards.map((card, index) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index / total);
    return {
      id: card.id,
      kind: card.kind,
      label: card.title,
      x: Number((Math.cos(angle) * 1.18).toFixed(4)),
      y: Number((Math.sin(angle) * 0.62).toFixed(4)),
      focusState: card.focusState,
      status: card.status
    };
  });
}

function findSeerFocusCard(cards = []) {
  return cards.find((card) => card.focusState === 'active') || cards[0] || null;
}

function findNextSeerClaimFocusCard(cards = [], currentCardId = '') {
  const unresolved = cards.filter((card) => card.id !== currentCardId && firstDefinedString(card.status) !== 'claimed');
  if (!unresolved.length) return null;
  const sharpening = unresolved.find((card) => Number(card.revealTier) < 3 || firstDefinedString(card.status) !== 'claimable');
  return sharpening || unresolved[0];
}

function buildClaimedSeerCardRecord(card = {}, claimedAt = new Date().toISOString()) {
  return {
    cardId: firstDefinedString(card.id),
    kind: firstDefinedString(card.kind),
    title: firstDefinedString(card.title),
    claimedAt,
    linkedEntityIds: Array.isArray(card.linkedEntityIds) ? [...new Set(card.linkedEntityIds)] : [],
    summary: firstDefinedString(card?.front?.summary),
    back: card?.back ? { ...card.back } : {},
    front: card?.front ? { ...card.front } : {}
  };
}

function buildSeerClaimMediaAssets(card = {}, claimedAt = new Date().toISOString()) {
  const assets = [];
  const cardId = firstDefinedString(card.id);
  if (card?.back?.imageUrl || card?.back?.texturePrompt) {
    assets.push({
      assetKind: 'seer_card_back',
      cardId,
      imageUrl: firstDefinedString(card?.back?.imageUrl),
      prompt: firstDefinedString(card?.back?.texturePrompt),
      createdAt: claimedAt
    });
  }
  if (card?.front?.imageUrl || card?.front?.summary) {
    assets.push({
      assetKind: 'seer_card_front',
      cardId,
      imageUrl: firstDefinedString(card?.front?.imageUrl),
      prompt: firstDefinedString(card?.front?.prompt),
      summary: firstDefinedString(card?.front?.summary),
      createdAt: claimedAt
    });
  }
  return assets;
}

function mergeSeerMediaAssets(existingAssets = [], nextAssets = []) {
  const merged = [];
  const seen = new Set();
  [...existingAssets, ...nextAssets].forEach((asset) => {
    if (!asset || typeof asset !== 'object') return;
    const key = [
      firstDefinedString(asset.assetKind),
      firstDefinedString(asset.cardId),
      firstDefinedString(asset.imageUrl),
      firstDefinedString(asset.prompt)
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({ ...asset });
  });
  return merged;
}

function collectSeerClaimEntityCandidateIds(reading = {}, card = {}) {
  const ids = [];
  const linkedIds = Array.isArray(card?.linkedEntityIds) ? card.linkedEntityIds : [];
  linkedIds.forEach((value) => {
    const safeValue = firstDefinedString(value);
    if (safeValue) ids.push(safeValue);
  });

  const readingEntities = Array.isArray(reading?.entities) ? reading.entities : [];
  readingEntities.forEach((entity) => {
    const entityId = firstDefinedString(entity?.id);
    if (!entityId || !linkedIds.includes(entityId)) return;
    [
      entity?.id,
      entity?.externalId,
      entity?.sourceEntityId
    ].forEach((value) => {
      const safeValue = firstDefinedString(value);
      if (safeValue) ids.push(safeValue);
    });
  });

  return Array.from(new Set(ids));
}

function findSeerReadingEntityByCard(reading = {}, card = {}) {
  const candidateIds = new Set(collectSeerClaimEntityCandidateIds(reading, card));
  const readingEntities = Array.isArray(reading?.entities) ? reading.entities : [];
  return readingEntities.find((entity) => (
    candidateIds.has(firstDefinedString(entity?.id))
    || candidateIds.has(firstDefinedString(entity?.externalId))
    || candidateIds.has(firstDefinedString(entity?.sourceEntityId))
  )) || null;
}

async function resolveCanonicalEntityForClaim(reading = {}, playerId = '', card = {}) {
  const candidateIds = collectSeerClaimEntityCandidateIds(reading, card);
  for (const candidateId of candidateIds) {
    const entity = await findEntityById(firstDefinedString(reading?.sessionId), playerId, candidateId);
    if (entity) return entity;
  }
  return null;
}

function buildClaimedEntityLink(entityDoc = {}, card = {}, reading = {}, claimedAt = new Date().toISOString()) {
  const source = entityDoc && typeof entityDoc.toObject === 'function' ? entityDoc.toObject() : entityDoc || {};
  return {
    cardId: firstDefinedString(card?.id),
    entityId: firstDefinedString(source?._id ? String(source._id) : ''),
    entityExternalId: firstDefinedString(source?.externalId),
    title: firstDefinedString(card?.title),
    readingId: firstDefinedString(reading?.readingId),
    claimedAt
  };
}

function buildSeerReadingSpread(fragmentText, memories = [], focusMemoryId = '', cards = [], focusCardId = '') {
  const fragmentNodeId = 'fragment-anchor';
  const nodes = [
    {
      id: fragmentNodeId,
      kind: 'fragment',
      label: 'Fragment',
      excerpt: firstDefinedString(fragmentText).slice(0, 220),
      x: 0,
      y: 0
    },
    ...memories.map((memory) => ({
      id: memory.id,
      kind: 'memory',
      label: memory.card?.title || 'Unknown glimpse',
      temporalSlot: memory.temporalSlot,
      strength: memory.strength,
      clarity: memory.clarity,
      x: SEER_TRIAD_POSITIONS[memory.temporalSlot]?.x ?? 0,
      y: SEER_TRIAD_POSITIONS[memory.temporalSlot]?.y ?? 0
    }))
  ];

  const edges = memories.map((memory) => ({
    id: `edge-${fragmentNodeId}-${memory.id}`,
    fromId: fragmentNodeId,
    toId: memory.id,
    status: 'present',
    strength: memory.clarity,
    distance: memory.temporalSlot === 'during' ? 0.45 : 0.72,
    rationale: `Glimpse aligned to ${memory.temporalSlot}.`
  }));

  return {
    layoutMode: cards.length ? 'seer_vision_cards' : 'seer_triad',
    focusMemoryId,
    focusCardId,
    nodes,
    edges,
    cardLayout: buildSeerCardLayout(cards)
  };
}

function clampSeerClarity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function createSeerTranscriptEntry(role = 'seer', content = '', extra = {}) {
  return {
    id: `seer-turn-${randomUUID()}`,
    role,
    content: firstDefinedString(content),
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function findSeerFocusMemory(memories = []) {
  return memories.find((memory) => memory.focusState === 'active') || memories[0] || null;
}

function setSeerFocusedMemory(memories = [], focusMemoryId = '') {
  return memories.map((memory) => ({
    ...memory,
    focusState: memory.id === focusMemoryId ? 'active' : (memory.focusState === 'resolved' ? 'resolved' : 'idle')
  }));
}

function findNextSeerFocusMemory(memories = [], currentMemoryId = '') {
  const unresolved = memories.filter((memory) => memory.id !== currentMemoryId && Number(memory.revealTier) < 5);
  if (unresolved.length) {
    const during = unresolved.find((memory) => memory.temporalSlot === 'during');
    return during || unresolved[0];
  }
  return memories.find((memory) => memory.id !== currentMemoryId) || null;
}

function extractSeerEntityLabels(memory = {}) {
  const labels = [];
  const rawEntities = Array.isArray(memory?.raw?.entities_in_memory) ? memory.raw.entities_in_memory : [];
  rawEntities.forEach((label) => {
    const safeLabel = firstDefinedString(label);
    if (safeLabel) {
      labels.push(safeLabel);
    }
  });
  const witness = firstDefinedString(memory?.witness, memory?.raw?.whose_eyes);
  if (witness) {
    labels.push(witness);
  }
  return Array.from(new Set(labels));
}

function createSeerEntityFromLabel(label = '', provenance = 'memory') {
  return {
    id: `seer-entity-${randomUUID()}`,
    name: firstDefinedString(label, 'Unnamed entity'),
    kind: 'generated_during_reading',
    status: 'suggested',
    provenance
  };
}

function ensureSeerEntityForTurn(reading = {}, focusMemory = {}, requestedEntityId = '', replyText = '') {
  const entities = Array.isArray(reading.entities) ? [...reading.entities] : [];
  const safeRequestedEntityId = firstDefinedString(requestedEntityId);
  const normalizedReply = firstDefinedString(replyText).toLowerCase();

  let entity = safeRequestedEntityId
    ? entities.find((candidate) => candidate.id === safeRequestedEntityId)
    : null;

  if (!entity && normalizedReply) {
    entity = entities.find((candidate) => normalizedReply.includes(firstDefinedString(candidate.name).toLowerCase()));
  }

  const candidateLabels = extractSeerEntityLabels(focusMemory);

  if (!entity && candidateLabels.length) {
    entity = entities.find((candidate) =>
      candidateLabels.some((label) => firstDefinedString(candidate.name).toLowerCase() === label.toLowerCase())
    );
  }

  let created = false;
  if (!entity && candidateLabels.length) {
    entity = createSeerEntityFromLabel(
      candidateLabels[0],
      normalizedReply ? 'player_reply' : 'memory'
    );
    entities.push(entity);
    created = true;
  }

  return { entities, entity, created };
}

function computeSeerEntityNodePosition(memoryNode = {}, entityCount = 0) {
  const angle = -Math.PI / 4 + entityCount * 0.68;
  const radius = 0.78 + entityCount * 0.12;
  const originX = Number.isFinite(Number(memoryNode.x)) ? Number(memoryNode.x) : 0;
  const originY = Number.isFinite(Number(memoryNode.y)) ? Number(memoryNode.y) : 0;
  return {
    x: originX + Math.cos(angle) * radius,
    y: originY + Math.sin(angle) * radius
  };
}

function upsertSeerSpreadRelation(spread = {}, focusMemory = {}, entity = {}, options = {}) {
  const nextNodes = Array.isArray(spread.nodes) ? [...spread.nodes] : [];
  const nextEdges = Array.isArray(spread.edges) ? [...spread.edges] : [];
  const focusMemoryId = firstDefinedString(focusMemory.id);
  const entityId = firstDefinedString(entity.id);

  if (!focusMemoryId || !entityId) {
    return spread;
  }

  const memoryNode = nextNodes.find((node) => node.id === focusMemoryId) || {
    x: SEER_TRIAD_POSITIONS[focusMemory.temporalSlot]?.x ?? 0,
    y: SEER_TRIAD_POSITIONS[focusMemory.temporalSlot]?.y ?? 0
  };
  const entityNode = nextNodes.find((node) => node.id === entityId);
  if (!entityNode) {
    const position = computeSeerEntityNodePosition(
      memoryNode,
      nextNodes.filter((node) => node.kind === 'entity').length
    );
    nextNodes.push({
      id: entityId,
      kind: 'entity',
      label: firstDefinedString(entity.name, 'Unknown entity'),
      x: position.x,
      y: position.y
    });
  }

  const relationEdgeId = `edge-${focusMemoryId}-${entityId}`;
  const existingEdgeIndex = nextEdges.findIndex((edge) => edge.id === relationEdgeId);
  const strength = clampSeerClarity(options.strength ?? 0.62);
  const confidence = clampSeerClarity(options.confidence ?? 0.58);
  const relationEdge = {
    id: relationEdgeId,
    fromId: focusMemoryId,
    toId: entityId,
    status: firstDefinedString(options.status, 'forming'),
    strength,
    confidence,
    distance: Math.max(0.22, 0.78 - strength * 0.4),
    rationale: firstDefinedString(options.rationale, 'The seer senses a tightening pull.')
  };

  if (existingEdgeIndex >= 0) {
    nextEdges[existingEdgeIndex] = {
      ...nextEdges[existingEdgeIndex],
      ...relationEdge
    };
  } else {
    nextEdges.push(relationEdge);
  }

  return {
    ...spread,
    focusMemoryId,
    nodes: nextNodes,
    edges: nextEdges
  };
}

function normalizeSeerReadingPayload(doc) {
  const source = doc && typeof doc.toObject === 'function' ? doc.toObject() : (doc || {});
  const focusMemory = findSeerFocusMemory(source.memories || []);
  const focusCard = (Array.isArray(source.cards) ? source.cards : []).find((card) => card.focusState === 'active')
    || (Array.isArray(source.cards) ? source.cards[0] : null);
  const focusEntityIds = focusMemory
    ? (Array.isArray(focusMemory.confirmedEntityIds) ? focusMemory.confirmedEntityIds : [])
    : (Array.isArray(focusCard?.linkedEntityIds) ? focusCard.linkedEntityIds : []);
  return {
    readingId: firstDefinedString(source.readingId),
    sessionId: firstDefinedString(source.sessionId),
    playerId: firstDefinedString(source.playerId),
    worldId: firstDefinedString(source.worldId),
    universeId: firstDefinedString(source.universeId),
    status: firstDefinedString(source.status),
    beat: firstDefinedString(source.beat),
    fragment: source.fragment || {},
    vision: source.vision || {},
    seer: source.seer || {},
    memories: Array.isArray(source.memories) ? source.memories : [],
    cards: Array.isArray(source.cards) ? source.cards : [],
    entities: Array.isArray(source.entities) ? source.entities : [],
    apparitions: Array.isArray(source.apparitions) ? source.apparitions : [],
    spread: source.spread || {},
    transcript: Array.isArray(source.transcript) ? source.transcript : [],
    subjectDialog: Array.isArray(source.subjectDialog) ? source.subjectDialog : [],
    claimedCards: Array.isArray(source.claimedCards) ? source.claimedCards : [],
    claimedEntityLinks: Array.isArray(source.claimedEntityLinks) ? source.claimedEntityLinks : [],
    unresolvedThreads: Array.isArray(source.unresolvedThreads) ? source.unresolvedThreads : [],
    worldbuildingOutputs: Array.isArray(source.worldbuildingOutputs) ? source.worldbuildingOutputs : [],
    metadata: source.metadata || {},
    focus: (focusMemory || focusCard)
      ? {
        memoryId: focusMemory?.id || '',
        cardId: firstDefinedString(focusCard?.id),
        entityIds: focusEntityIds
      }
      : null,
    composer: buildSeerComposerPayload(source),
    orchestrator: source.metadata?.orchestrator || null,
    lastTurn: source.metadata?.lastTurn || null,
    version: Number.isFinite(Number(source.version)) ? Number(source.version) : 1,
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null
  };
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

function cloneDefaultQuestConfig(scope = {}) {
  return JSON.parse(JSON.stringify(buildDefaultQuestConfigForScope(scope)));
}

const QUEST_ADVANCE_CONTRACT_KEY = 'quest_advance';

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

function normalizeQuestPromptRoute(route) {
  if (!route || typeof route !== 'object') {
    return null;
  }

  const targetScreenId = typeof route.targetScreenId === 'string'
    ? route.targetScreenId.trim()
    : '';
  if (!targetScreenId) {
    return null;
  }

  const patterns = Array.isArray(route.patterns)
    ? route.patterns
      .map((pattern) => (typeof pattern === 'string' ? pattern.trim() : ''))
      .filter(Boolean)
    : [];
  if (!patterns.length) {
    return null;
  }

  const fromScreenIds = Array.isArray(route.fromScreenIds)
    ? [...new Set(route.fromScreenIds
      .map((screenId) => (typeof screenId === 'string' ? screenId.trim() : ''))
      .filter(Boolean))]
    : [];

  return {
    id: typeof route.id === 'string' ? route.id.trim() : '',
    description: typeof route.description === 'string' ? route.description.trim() : '',
    fromScreenIds,
    matchMode: route.matchMode === 'all' ? 'all' : 'any',
    patterns,
    targetScreenId
  };
}

function normalizeQuestScreenComponentBinding(binding) {
  if (!binding || typeof binding !== 'object') {
    return null;
  }

  const componentId = normalizeQuestSceneComponentId(binding.componentId);
  const slot = typeof binding.slot === 'string'
    ? binding.slot.trim().toLowerCase()
    : '';
  if (!componentId || !slot) {
    return null;
  }

  const sourceProps = binding.props && typeof binding.props === 'object' && !Array.isArray(binding.props)
    ? binding.props
    : {};
  const props = {};
  Object.entries(sourceProps).forEach(([key, value]) => {
    const safeKey = typeof key === 'string' ? key.trim() : '';
    if (!safeKey) return;
    if (typeof value === 'string') {
      props[safeKey] = value;
      return;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      props[safeKey] = value;
    }
  });

  const normalizedId = typeof binding.id === 'string' ? binding.id.trim() : '';
  const nextBinding = {
    componentId,
    slot,
    props
  };

  if (normalizedId) {
    nextBinding.id = normalizedId;
  }

  return nextBinding;
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
  const referenceImagePrompt = typeof screen.referenceImagePrompt === 'string'
    ? screen.referenceImagePrompt.trim()
    : '';
  const visualContinuityGuidance = typeof screen.visualContinuityGuidance === 'string'
    ? screen.visualContinuityGuidance.trim()
    : '';
  const visualTransitionIntent = ['inherit', 'drift', 'break'].includes(
    typeof screen.visualTransitionIntent === 'string' ? screen.visualTransitionIntent.trim().toLowerCase() : ''
  )
    ? screen.visualTransitionIntent.trim().toLowerCase()
    : 'inherit';
  const textPromptPlaceholder = typeof screen.textPromptPlaceholder === 'string' && screen.textPromptPlaceholder.trim()
    ? screen.textPromptPlaceholder.trim()
    : 'What do you do?';
  const screenType = screen.screenType === 'generated' ? 'generated' : 'authored';
  const parentScreenId = typeof screen.parentScreenId === 'string' ? screen.parentScreenId.trim() : '';
  const anchorScreenId = typeof screen.anchorScreenId === 'string' ? screen.anchorScreenId.trim() : '';
  const expectationSummary = typeof screen.expectationSummary === 'string'
    ? screen.expectationSummary.trim()
    : '';
  const continuitySummary = typeof screen.continuitySummary === 'string'
    ? screen.continuitySummary.trim()
    : '';
  const generatedFromPrompt = typeof screen.generatedFromPrompt === 'string'
    ? screen.generatedFromPrompt.trim()
    : '';
  const generatedByPlayerId = typeof screen.generatedByPlayerId === 'string'
    ? screen.generatedByPlayerId.trim()
    : '';
  const generatedAt = typeof screen.generatedAt === 'string' ? screen.generatedAt.trim() : '';
  const promptGuidance = typeof screen.promptGuidance === 'string'
    ? screen.promptGuidance.trim()
    : '';
  const sceneEndCondition = typeof screen.sceneEndCondition === 'string'
    ? screen.sceneEndCondition.trim()
    : '';
  const normalizedStage = normalizeImmersiveRpgStagePayload({
    stage_layout: screen.stage_layout || screen.stageLayout,
    stage_modules: screen.stage_modules || screen.stageModules
  });
  const directions = Array.isArray(screen.directions)
    ? screen.directions.map(normalizeQuestDirection).filter(Boolean)
    : [];
  const componentBindings = Array.isArray(screen.componentBindings)
    ? screen.componentBindings.map(normalizeQuestScreenComponentBinding).filter(Boolean)
    : [];
  const promptRoutes = Array.isArray(screen.promptRoutes)
    ? screen.promptRoutes.map(normalizeQuestPromptRoute).filter(Boolean)
    : [];
  return {
    id,
    title,
    prompt,
    imageUrl,
    image_prompt,
    referenceImagePrompt,
    visualContinuityGuidance,
    visualTransitionIntent,
    textPromptPlaceholder,
    componentBindings,
    directions,
    screenType,
    parentScreenId,
    anchorScreenId,
    expectationSummary,
    continuitySummary,
    generatedFromPrompt,
    generatedByPlayerId,
    generatedAt,
    promptGuidance,
    sceneEndCondition,
    promptRoutes,
    stageLayout: normalizedStage.stageLayout,
    stageModules: normalizedStage.stageModules
  };
}

function truncateQuestText(value, maxLength = 96) {
  const source = typeof value === 'string' ? value.trim() : '';
  if (!source) return '';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function firstNonEmptyQuestString(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function slugifyQuestSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function titleCaseQuestText(value, maxWords = 4) {
  return String(value || '')
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function buildQuestScreenMap(config = {}) {
  const map = new Map();
  const screens = Array.isArray(config?.screens) ? config.screens : [];
  for (const screen of screens) {
    if (!screen || typeof screen.id !== 'string') continue;
    map.set(screen.id, screen);
  }
  return map;
}

function resolveQuestAnchorScreen(screen, screenMap) {
  if (!screen || !screenMap || !(screenMap instanceof Map)) {
    return screen || null;
  }

  const declaredAnchorId = typeof screen.anchorScreenId === 'string' ? screen.anchorScreenId.trim() : '';
  if (declaredAnchorId && screenMap.has(declaredAnchorId)) {
    return screenMap.get(declaredAnchorId);
  }

  let cursor = screen;
  const visited = new Set();
  while (cursor && typeof cursor.id === 'string' && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    if (cursor.screenType !== 'generated') {
      return cursor;
    }
    const nextParentId = typeof cursor.parentScreenId === 'string' ? cursor.parentScreenId.trim() : '';
    if (!nextParentId || !screenMap.has(nextParentId)) {
      break;
    }
    cursor = screenMap.get(nextParentId);
  }

  return screen;
}

function inferQuestPromptFocus(promptText = '') {
  const lowered = String(promptText || '').toLowerCase();
  if (/(speak|ask|call|whisper|say|listen|sing)/.test(lowered)) {
    return {
      label: 'Echo Encounter',
      noun: 'encounter',
      expectation: 'a response, omen, or witness tied to the place'
    };
  }
  if (/(climb|descend|enter|inside|crawl|squeeze|follow|trail|passage|door|gate|stairs?)/.test(lowered)) {
    return {
      label: 'Hidden Passage',
      noun: 'passage',
      expectation: 'a navigable route that extends the known area without breaking its geography'
    };
  }
  if (/(touch|take|open|inspect|search|study|examine|read|look|peer)/.test(lowered)) {
    return {
      label: 'Close Discovery',
      noun: 'discovery',
      expectation: 'a tighter, more specific discovery nested inside the current location'
    };
  }
  return {
    label: 'New Thread',
    noun: 'thread',
    expectation: 'a local branch that reveals more texture in the same area'
  };
}

function createGeneratedQuestScreenId(existingIds, parentScreenId, promptText) {
  const promptSlug = slugifyQuestSegment(promptText) || 'new_thread';
  const parentSlug = slugifyQuestSegment(parentScreenId) || 'screen';
  let nextId = `${parentSlug}_${promptSlug}`;
  let suffix = 2;
  while (existingIds.has(nextId)) {
    nextId = `${parentSlug}_${promptSlug}_${suffix}`;
    suffix += 1;
  }
  return nextId;
}

function buildQuestGeneratedDirectionLabel(promptText) {
  return truncateQuestText(`Pursue: ${promptText}`, 56);
}

function buildQuestGeneratedTitle(promptText, focus) {
  const promptTitle = titleCaseQuestText(promptText, 5);
  if (promptTitle) {
    return truncateQuestText(promptTitle, 56);
  }
  return focus?.label || 'New Thread';
}

function buildQuestExpectationSummary({ currentScreen, anchorScreen, promptText, focus }) {
  const anchorTitle = anchorScreen?.title || currentScreen?.title || 'this area';
  const actionPreview = truncateQuestText(promptText, 72);
  return `${anchorTitle} now suggests ${focus.expectation}. This branch was opened by "${actionPreview}".`;
}

function buildQuestContinuitySummary({ currentScreen, anchorScreen, promptText }) {
  const fromTitle = currentScreen?.title || 'the current screen';
  const anchorTitle = anchorScreen?.title || fromTitle;
  const actionPreview = truncateQuestText(promptText, 72);
  return `This scene branches from ${fromTitle} and remains anchored to ${anchorTitle}. It grows directly out of "${actionPreview}".`;
}

function buildQuestGeneratedImagePrompt({ currentScreen, anchorScreen, promptText, focus, title }) {
  const basePrompt = currentScreen?.image_prompt || anchorScreen?.image_prompt || 'Cinematic fantasy quest scene.';
  const anchorTitle = anchorScreen?.title || currentScreen?.title || 'the surrounding ruins';
  return truncateQuestText(
    `${basePrompt} Continue the same place and lighting, but reveal a newly discovered ${focus.noun} titled "${title}" within ${anchorTitle}. Player action: ${promptText}. Preserve continuity of architecture, weather, and mood.`,
    600
  );
}

function buildQuestGeneratedStage({ screenId, currentScreen, anchorScreen, promptText, title, expectationSummary, continuitySummary }) {
  const imageUrl = currentScreen?.imageUrl || anchorScreen?.imageUrl || '';
  return normalizeImmersiveRpgStagePayload({
    stage_layout: 'focus-left',
    stage_modules: [
      {
        module_id: `${screenId}-illustration`,
        type: 'illustration',
        variant: 'landscape',
        title,
        caption: expectationSummary,
        image_url: imageUrl,
        alt_text: `${title} quest scene`,
        emphasis: 'primary',
        rotate_deg: -1,
        tone: 'quest',
        body: '',
        meta: {}
      },
      {
        module_id: `${screenId}-continuity`,
        type: 'evidence_note',
        title: 'Continuity',
        body: continuitySummary,
        caption: `Anchor: ${anchorScreen?.title || currentScreen?.title || 'Unknown'}`,
        meta: {}
      },
      {
        module_id: `${screenId}-impulse`,
        type: 'quote_panel',
        title: 'Player Impulse',
        body: truncateQuestText(promptText, 220),
        caption: 'This action now exists as a persistent branch.',
        meta: {}
      }
    ]
  });
}

async function resolveQuestAdvanceRuntimeConfig() {
  const routeConfig = await getRouteConfig(QUEST_ADVANCE_CONTRACT_KEY);
  const latestPrompt = await getLatestPromptTemplate('quest_generation');

  return {
    promptTemplate:
      latestPrompt?.promptTemplate
      || routeConfig?.promptCore
      || routeConfig?.promptTemplate
      || '',
    routeConfig
  };
}

function buildQuestAdvanceRuntime(pipeline = {}, mocked = false) {
  return {
    pipeline: 'quest_generation',
    provider: typeof pipeline?.provider === 'string' ? pipeline.provider : 'openai',
    model: typeof pipeline?.model === 'string' ? pipeline.model : '',
    mocked: Boolean(mocked)
  };
}

async function resolveQuestSceneAuthoringRuntimeConfig() {
  const latestPrompt = await getLatestPromptTemplate(QUEST_SCENE_AUTHORING_PIPELINE_KEY);
  return {
    promptTemplate: latestPrompt?.promptTemplate || '',
    latestPrompt
  };
}

function buildQuestDirectionsPromptSummary(directions = [], screenMap = new Map()) {
  const summary = (Array.isArray(directions) ? directions : []).map((direction) => {
    const targetScreenId = typeof direction?.targetScreenId === 'string' ? direction.targetScreenId.trim() : '';
    const targetScreen = targetScreenId ? screenMap.get(targetScreenId) : null;
    return {
      direction: typeof direction?.direction === 'string' ? direction.direction : '',
      label: typeof direction?.label === 'string' ? direction.label : '',
      target_screen_id: targetScreenId,
      target_screen_title: targetScreen?.title || ''
    };
  });
  return JSON.stringify(summary, null, 2);
}

function buildQuestTraversalPromptSummary(traversal = [], screenMap = new Map()) {
  const summary = (Array.isArray(traversal) ? traversal : []).slice(-6).map((entry) => {
    const fromScreen = entry?.fromScreenId ? screenMap.get(entry.fromScreenId) : null;
    const toScreen = entry?.toScreenId ? screenMap.get(entry.toScreenId) : null;
    return {
      from_screen_id: entry?.fromScreenId || '',
      from_screen_title: fromScreen?.title || '',
      to_screen_id: entry?.toScreenId || '',
      to_screen_title: toScreen?.title || '',
      direction: entry?.direction || '',
      prompt_text: entry?.promptText || '',
      created_at: entry?.createdAt || ''
    };
  });
  return JSON.stringify(summary, null, 2);
}

function buildQuestAdvancePromptPayload({
  config,
  currentScreen,
  anchorScreen,
  promptText,
  traversal = [],
  screenMap = new Map()
}) {
  return {
    sceneName: config?.sceneName || '',
    sceneTemplate: config?.sceneTemplate || DEFAULT_SCENE_TEMPLATE,
    sceneComponents: JSON.stringify(Array.isArray(config?.sceneComponents) ? config.sceneComponents : []),
    sceneVisualStyleGuide: config?.visualStyleGuide || '',
    phaseGuidance: config?.phaseGuidance || '',
    currentScreenId: currentScreen?.id || '',
    currentScreenTitle: currentScreen?.title || '',
    currentScreenType: currentScreen?.screenType || 'authored',
    currentScreenPrompt: currentScreen?.prompt || '',
    currentScreenImagePrompt: currentScreen?.image_prompt || '',
    currentScreenReferenceImagePrompt: currentScreen?.referenceImagePrompt || '',
    currentScreenExpectationSummary: currentScreen?.expectationSummary || '',
    currentScreenContinuitySummary: currentScreen?.continuitySummary || '',
    currentScreenPromptGuidance: currentScreen?.promptGuidance || '',
    currentScreenSceneEndCondition: currentScreen?.sceneEndCondition || '',
    currentScreenComponentBindings: JSON.stringify(Array.isArray(currentScreen?.componentBindings) ? currentScreen.componentBindings : []),
    currentScreenVisualContinuityGuidance: currentScreen?.visualContinuityGuidance || '',
    currentScreenVisualTransitionIntent: currentScreen?.visualTransitionIntent || 'inherit',
    currentDirections: buildQuestDirectionsPromptSummary(currentScreen?.directions, screenMap),
    anchorScreenId: anchorScreen?.id || currentScreen?.id || '',
    anchorScreenTitle: anchorScreen?.title || currentScreen?.title || '',
    anchorScreenPrompt: anchorScreen?.prompt || currentScreen?.prompt || '',
    anchorScreenImagePrompt: anchorScreen?.image_prompt || currentScreen?.image_prompt || '',
    anchorScreenReferenceImagePrompt: anchorScreen?.referenceImagePrompt || currentScreen?.referenceImagePrompt || '',
    authoredPromptRoutes: buildQuestPromptRoutesPromptSummary(
      config?.promptRoutes,
      currentScreen?.id || '',
      screenMap
    ),
    recentTraversal: buildQuestTraversalPromptSummary(traversal, screenMap),
    playerPrompt: promptText
  };
}

function buildQuestPromptRoutesPromptSummary(promptRoutes = [], currentScreenId = '', screenMap = new Map()) {
  const relevantRoutes = (Array.isArray(promptRoutes) ? promptRoutes : [])
    .filter((route) => {
      if (!route || typeof route !== 'object') return false;
      if (!Array.isArray(route.fromScreenIds) || route.fromScreenIds.length === 0) return true;
      return route.fromScreenIds.includes(currentScreenId);
    })
    .map((route) => {
      const targetScreen = screenMap.get(route.targetScreenId);
      return {
        id: route.id || '',
        description: route.description || '',
        target_screen_id: route.targetScreenId || '',
        target_screen_title: targetScreen?.title || '',
        match_mode: route.matchMode || 'any',
        patterns: Array.isArray(route.patterns) ? route.patterns : []
      };
    });

  if (!relevantRoutes.length) {
    return '[]';
  }

  return JSON.stringify(relevantRoutes, null, 2);
}

function buildQuestAdvancePromptMessages({ promptTemplate = '', promptPayload = {} }) {
  const compiledPrompt = renderPromptTemplateString(promptTemplate, promptPayload);
  const supplementalGuidance = [
    typeof promptPayload?.sceneName === 'string' && promptPayload.sceneName.trim()
      ? `Scene name: ${promptPayload.sceneName.trim()}`
      : '',
    typeof promptPayload?.sceneTemplate === 'string' && promptPayload.sceneTemplate.trim()
      ? `Base scene template: ${promptPayload.sceneTemplate.trim()}`
      : '',
    typeof promptPayload?.sceneComponents === 'string' && promptPayload.sceneComponents.trim() && promptPayload.sceneComponents.trim() !== '[]'
      ? `Attached scene components: ${promptPayload.sceneComponents.trim()}`
      : '',
    typeof promptPayload?.sceneVisualStyleGuide === 'string' && promptPayload.sceneVisualStyleGuide.trim()
      ? `Scene visual guide:\n${promptPayload.sceneVisualStyleGuide.trim()}`
      : '',
    typeof promptPayload?.phaseGuidance === 'string' && promptPayload.phaseGuidance.trim()
      ? `Phase guidance:\n${promptPayload.phaseGuidance.trim()}`
      : '',
    typeof promptPayload?.currentScreenPromptGuidance === 'string' && promptPayload.currentScreenPromptGuidance.trim()
      ? `Current screen guidance:\n${promptPayload.currentScreenPromptGuidance.trim()}`
      : '',
    typeof promptPayload?.currentScreenSceneEndCondition === 'string' && promptPayload.currentScreenSceneEndCondition.trim()
      ? `Current scene ends when:\n${promptPayload.currentScreenSceneEndCondition.trim()}`
      : '',
    typeof promptPayload?.currentScreenComponentBindings === 'string'
      && promptPayload.currentScreenComponentBindings.trim()
      && promptPayload.currentScreenComponentBindings.trim() !== '[]'
      ? `Current screen component bindings:\n${promptPayload.currentScreenComponentBindings.trim()}`
      : '',
    typeof promptPayload?.currentScreenVisualContinuityGuidance === 'string' && promptPayload.currentScreenVisualContinuityGuidance.trim()
      ? `Current screen visual continuity:\n${promptPayload.currentScreenVisualContinuityGuidance.trim()}\nTransition intent: ${promptPayload.currentScreenVisualTransitionIntent || 'inherit'}`
      : '',
    typeof promptPayload?.authoredPromptRoutes === 'string' && promptPayload.authoredPromptRoutes.trim() && promptPayload.authoredPromptRoutes.trim() !== '[]'
      ? `Relevant authored prompt routes already reserved by the map:\n${promptPayload.authoredPromptRoutes.trim()}\nIf the player's action clearly belongs to one of these routes, do not invent a new scene for it.`
      : ''
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    compiledPrompt,
    prompts: [
      { role: 'system', content: compiledPrompt },
      ...(supplementalGuidance ? [{ role: 'system', content: supplementalGuidance }] : []),
      {
        role: 'user',
        content: JSON.stringify(promptPayload)
      }
    ]
  };
}

function buildQuestPromptSourceDetails({ latestPrompt = null, routeConfig = null } = {}) {
  if (latestPrompt?.promptTemplate) {
    return {
      source: 'database',
      version: Number(latestPrompt.version) || 0,
      updatedAt: latestPrompt.updatedAt || latestPrompt.createdAt || '',
      createdBy: latestPrompt.createdBy || '',
      promptLength: latestPrompt.promptTemplate.length
    };
  }

  const fallbackPrompt = routeConfig?.promptCore || routeConfig?.promptTemplate || '';
  if (fallbackPrompt) {
    return {
      source: 'route-config',
      version: 0,
      updatedAt: routeConfig?.updatedAt || '',
      createdBy: routeConfig?.updatedBy || '',
      promptLength: fallbackPrompt.length
    };
  }

  return {
    source: 'missing',
    version: 0,
    updatedAt: '',
    createdBy: '',
    promptLength: 0
  };
}

async function buildQuestDebugContext(payload = {}) {
  const scope = normalizeQuestScope(payload);
  const config = await ensureQuestConfig(scope);
  const screenMap = buildQuestScreenMap(config);
  const currentScreenId = typeof payload.currentScreenId === 'string' ? payload.currentScreenId.trim() : '';
  const currentScreen = screenMap.get(currentScreenId)
    || screenMap.get(config.startScreenId)
    || config.screens[0]
    || null;

  if (!currentScreen) {
    const error = new Error('Quest screen not found.');
    error.statusCode = 404;
    error.code = 'QUEST_SCREEN_NOT_FOUND';
    throw error;
  }

  const anchorScreen = resolveQuestAnchorScreen(currentScreen, screenMap) || currentScreen;
  const promptText = typeof payload.promptText === 'string' ? payload.promptText.trim() : '';
  const authoredRouteDiagnostics = buildQuestPromptRouteDiagnostics(config, currentScreen, promptText, screenMap);
  const authoredPromptAdvance = promptText
    ? resolveQuestAuthoredPromptAdvance(config, currentScreen, promptText)
    : null;
  const traversalPayload = await getQuestTraversal(scope);
  const traversal = Array.isArray(traversalPayload?.traversal) ? traversalPayload.traversal : [];
  const questPipeline = await getAiPipelineSettings('quest_generation');
  const runtime = buildQuestAdvanceRuntime(questPipeline, Boolean(questPipeline?.useMock));
  const routeConfig = await getRouteConfig(QUEST_ADVANCE_CONTRACT_KEY);
  const latestPrompt = await getLatestPromptTemplate('quest_generation');
  const promptTemplate =
    latestPrompt?.promptTemplate
    || routeConfig?.promptCore
    || routeConfig?.promptTemplate
    || '';
  const promptPayload = buildQuestAdvancePromptPayload({
    config,
    currentScreen,
    anchorScreen,
    promptText,
    traversal,
    screenMap
  });
  const promptMessages = buildQuestAdvancePromptMessages({
    promptTemplate,
    promptPayload
  });

  return {
    sessionId: scope.sessionId,
    questId: scope.questId,
    currentScreen: {
      id: currentScreen.id,
      title: currentScreen.title || '',
      type: currentScreen.screenType || 'authored'
    },
    anchorScreen: {
      id: anchorScreen?.id || currentScreen.id,
      title: anchorScreen?.title || currentScreen.title || ''
    },
    runtime,
    promptSource: buildQuestPromptSourceDetails({ latestPrompt, routeConfig }),
    promptText,
    wouldBypassGeneration: Boolean(authoredPromptAdvance?.screen?.id),
    authoredRouteMatch: authoredPromptAdvance?.screen?.id
      ? {
          id: authoredPromptAdvance.route?.id || '',
          description: authoredPromptAdvance.route?.description || '',
          targetScreenId: authoredPromptAdvance.screen.id,
          targetScreenTitle: authoredPromptAdvance.screen.title || ''
        }
      : null,
    authoredRouteDiagnostics,
    promptPayload,
    compiledPrompt: promptMessages.compiledPrompt || '',
    promptMessages: Array.isArray(promptMessages.prompts)
      ? promptMessages.prompts.map((entry, index) => ({
          index,
          role: entry?.role || 'system',
          content: typeof entry?.content === 'string' ? entry.content : ''
        }))
      : []
  };
}

function buildQuestAdvanceSeed({ currentScreen, anchorScreen, promptText, screenId = 'quest-seed' }) {
  const focus = inferQuestPromptFocus(promptText);
  const title = buildQuestGeneratedTitle(promptText, focus);
  const expectationSummary = buildQuestExpectationSummary({
    currentScreen,
    anchorScreen,
    promptText,
    focus
  });
  const continuitySummary = buildQuestContinuitySummary({
    currentScreen,
    anchorScreen,
    promptText
  });
  const stage = buildQuestGeneratedStage({
    screenId,
    currentScreen,
    anchorScreen,
    promptText,
    title,
    expectationSummary,
    continuitySummary
  });
  return {
    title,
    prompt: truncateQuestText(
      `${currentScreen?.prompt || 'The area shifts.'} ${continuitySummary} ${expectationSummary}`,
      900
    ),
    image_prompt: buildQuestGeneratedImagePrompt({
      currentScreen,
      anchorScreen,
      promptText,
      focus,
      title
    }),
    text_prompt_placeholder: 'What do you do next in this thread?',
    expectation_summary: expectationSummary,
    continuity_summary: continuitySummary,
    direction_label: buildQuestGeneratedDirectionLabel(promptText),
    stage_layout: stage.stageLayout,
    stage_modules: stage.stageModules
  };
}

function buildQuestAdvanceMockedData({
  promptPayload = {},
  plan = {},
  currentScreen,
  anchorScreen
}) {
  return {
    source: 'deterministic-quest-generator',
    currentScreenId: currentScreen?.id || '',
    anchorScreenId: anchorScreen?.id || currentScreen?.id || '',
    promptPayload,
    plan: {
      title: plan.title || '',
      direction_label: plan.direction_label || plan.directionLabel || '',
      expectation_summary: plan.expectation_summary || plan.expectationSummary || '',
      continuity_summary: plan.continuity_summary || plan.continuitySummary || '',
      image_prompt: plan.image_prompt || plan.imagePrompt || '',
      stage_layout: plan.stageLayout || plan.stage_layout || '',
      stage_module_count: Array.isArray(plan.stageModules || plan.stage_modules)
        ? (plan.stageModules || plan.stage_modules).length
        : 0
    }
  };
}

function createQuestAdvanceError(message, {
  code = 'QUEST_ADVANCE_GENERATION_FAILED',
  statusCode = 502,
  runtime = null,
  details = null
} = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  if (runtime) {
    error.runtime = runtime;
  }
  if (details) {
    error.details = details;
  }
  return error;
}

function buildGeneratedQuestScreen(config, currentScreen, promptText, playerId = '', generationPlan = null) {
  const screenMap = buildQuestScreenMap(config);
  const anchorScreen = resolveQuestAnchorScreen(currentScreen, screenMap) || currentScreen;
  const existingIds = new Set(Array.isArray(config?.screens) ? config.screens.map((screen) => screen.id) : []);
  const screenId = createGeneratedQuestScreenId(existingIds, currentScreen?.id, promptText);
  const fallbackPlan = buildQuestAdvanceSeed({
    currentScreen,
    anchorScreen,
    promptText,
    screenId
  });
  const plan = normalizeQuestAdvancePlan(generationPlan, fallbackPlan);

  return {
    screen: {
      id: screenId,
      title: plan.title,
      prompt: plan.prompt,
      imageUrl: currentScreen?.imageUrl || anchorScreen?.imageUrl || '',
      image_prompt: plan.image_prompt,
      textPromptPlaceholder: plan.text_prompt_placeholder,
      directions: [
        {
          direction: 'back',
          label: `Return to ${currentScreen?.title || 'previous screen'}`,
          targetScreenId: currentScreen?.id || anchorScreen?.id || ''
        }
      ],
      screenType: 'generated',
      parentScreenId: currentScreen?.id || '',
      anchorScreenId: anchorScreen?.id || currentScreen?.id || '',
      expectationSummary: plan.expectation_summary,
      continuitySummary: plan.continuity_summary,
      generatedFromPrompt: truncateQuestText(promptText, 400),
      generatedByPlayerId: typeof playerId === 'string' ? playerId.trim() : '',
      generatedAt: new Date().toISOString(),
      stageLayout: plan.stageLayout,
      stageModules: plan.stageModules
    },
    direction: {
      direction: 'prompt',
      label: plan.direction_label,
      targetScreenId: screenId
    },
    plan,
    anchorScreen
  };
}

function applyQuestDirectionAdvance(config, currentScreen, direction) {
  const targetScreenId = typeof direction?.targetScreenId === 'string' ? direction.targetScreenId.trim() : '';
  if (!targetScreenId) {
    return null;
  }
  const screenMap = buildQuestScreenMap(config);
  const targetScreen = screenMap.get(targetScreenId);
  if (!targetScreen) {
    return null;
  }
  return {
    config,
    screen: targetScreen,
    createdScreen: null,
    direction
  };
}

function isRoseCourtPrologueQuest(questId = '') {
  return questId === ROSE_COURT_PROLOGUE_QUEST_ID;
}

function questPromptRouteAppliesToScreen(route, screenId = '') {
  if (!route || typeof route !== 'object') return false;
  if (!Array.isArray(route.fromScreenIds) || route.fromScreenIds.length === 0) {
    return true;
  }
  return route.fromScreenIds.includes(screenId);
}

function matchesQuestPromptRoute(route, promptText = '') {
  const source = String(promptText || '').trim();
  if (!source || !route || typeof route !== 'object') {
    return false;
  }

  const patterns = Array.isArray(route.patterns) ? route.patterns : [];
  if (!patterns.length) {
    return false;
  }

  const results = patterns.map((patternSource) => {
    try {
      return new RegExp(patternSource, 'i').test(source);
    } catch (error) {
      console.warn('Invalid quest prompt route pattern:', patternSource, error);
      return false;
    }
  });

  if (route.matchMode === 'all') {
    return results.every(Boolean);
  }
  return results.some(Boolean);
}

function buildQuestPromptRouteDiagnostics(config, currentScreen, promptText = '', screenMap = new Map()) {
  const sourceScreenId = currentScreen?.id || '';
  const promptRoutes = Array.isArray(config?.promptRoutes) ? config.promptRoutes : [];

  return promptRoutes.map((route) => {
    const appliesToCurrentScreen = questPromptRouteAppliesToScreen(route, sourceScreenId);
    const matched = appliesToCurrentScreen && matchesQuestPromptRoute(route, promptText);
    const targetScreen = screenMap.get(route?.targetScreenId || '');
    return {
      id: route?.id || '',
      description: route?.description || '',
      appliesToCurrentScreen,
      matched,
      matchMode: route?.matchMode === 'all' ? 'all' : 'any',
      patterns: Array.isArray(route?.patterns) ? route.patterns : [],
      targetScreenId: route?.targetScreenId || '',
      targetScreenTitle: targetScreen?.title || ''
    };
  });
}

function resolveQuestAuthoredPromptAdvance(config, currentScreen, promptText) {
  const sourceScreenId = currentScreen?.id || '';
  const screenMap = buildQuestScreenMap(config);
  const promptRoutes = Array.isArray(config?.promptRoutes) ? config.promptRoutes : [];

  for (const route of promptRoutes) {
    if (!questPromptRouteAppliesToScreen(route, sourceScreenId)) {
      continue;
    }
    if (!matchesQuestPromptRoute(route, promptText)) {
      continue;
    }
    const targetScreen = screenMap.get(route.targetScreenId);
    if (!targetScreen) {
      continue;
    }
    return {
      route,
      screen: targetScreen
    };
  }

  return null;
}

function buildRoseCourtLocationVariantScreens(brief = {}) {
  const placeName = truncateQuestText(brief?.placeName || 'the named earthly destination', 120);
  const placeSummary = truncateQuestText(
    brief?.placeSummary || `An earthly destination has been recorded for the Society: ${placeName}.`,
    480
  );
  const features = Array.isArray(brief?.notableFeatures) && brief.notableFeatures.length
    ? brief.notableFeatures.slice(0, 3).join(', ')
    : 'weather, approach, and shelter';
  const sensory = Array.isArray(brief?.sensoryDetails) && brief.sensoryDetails.length
    ? brief.sensoryDetails.join(', ')
    : 'the physical truth of the place';

  const variants = [
    {
      id: 'location_mural_high_room',
      direction: 'west',
      label: 'Study the high-room mural',
      title: 'Mural of the High Room',
      imageUrl: '/textures/decor/film_frame_desert.png',
      imagePromptMood: 'an elevated attic-like refuge, lamp-lit, observant, urban or cliffside in feeling',
      muralMedium: 'fractured stone-and-glass mosaic with vertical tesserae and surviving metallic accents',
      expectation: 'This version of the place emphasizes height, outlook, and a writer watching the weather from above.',
      prompt:
        `${placeName} appears here as a high room: a perched refuge translated into narrow steps, skylight glow, and a sense that the whole place can be watched from just under the roof. ${placeSummary}`,
      continuity:
        `The mural still belongs to ${placeName}, but it recasts the destination as an elevated retreat. Features carried forward: ${features}.`,
      caption: 'Aspect: elevation and vigilance'
    },
    {
      id: 'location_mural_weather_cabin',
      direction: 'north',
      label: 'Study the weather-cabin mural',
      title: 'Mural of the Weather Cabin',
      imageUrl: '/ruin_south_a.png',
      imagePromptMood: 'a rough shelter under strong weather, remote, timbered, solitary, storm-ready',
      muralMedium: 'faded fresco and tempera on cracked plaster, with flaked weather damage and exposed underdrawing',
      expectation: 'This version of the place tests the destination against weather, solitude, and endurance.',
      prompt:
        `${placeName} appears here as a weather-beaten cabin, the same earthly destination translated into rough boards, sparse shelter, and a harder edge against wind and distance. ${placeSummary}`,
      continuity:
        `The destination remains ${placeName}, now interpreted through harsher shelter and outer exposure. Sensory anchors carried forward: ${sensory}.`,
      caption: 'Aspect: exposure and endurance'
    },
    {
      id: 'location_mural_quiet_cottage',
      direction: 'east',
      label: 'Study the quiet-cottage mural',
      title: 'Mural of the Quiet Cottage',
      imageUrl: '/arenas/petal_hex_v1.png',
      imagePromptMood: 'an intimate cottage-like shelter, domestic calm, lamplight, lane or garden nearby',
      muralMedium: 'incised bas-relief with traces of gilt, limewash, and hand-drawn border ornament',
      expectation: 'This version of the place makes the destination feel inhabited, intimate, and quietly protective.',
      prompt:
        `${placeName} appears here as a quiet cottage, the earthly destination softened into lamplight, a threshold worth crossing, and a shelter that promises privacy without losing the place itself. ${placeSummary}`,
      continuity:
        `This mural preserves the same destination while favoring domestic calm and inward refuge. Distinctive elements retained: ${features}.`,
      caption: 'Aspect: intimacy and hearth'
    }
  ];

  return variants.map((variant) => ({
    id: variant.id,
    title: variant.title,
    prompt: variant.prompt,
    imageUrl: variant.imageUrl,
    image_prompt:
      `Aged illuminated-manuscript mural on the second rose wall, ${variant.muralMedium}, interpreting ${placeName} as ${variant.imagePromptMood}. Preserve the same earthly destination, local climate, and recognisable physical cues: ${features}. Include a glowing ouroboros ring handle and crumbling elven rose-petal masonry.`,
    referenceImagePrompt:
      `Illustrated mural-door on the second wall of the Hall of the Rose. The mural is made as ${variant.muralMedium} and shows ${placeName} as ${variant.imagePromptMood}. The place must remain recognisably the same real-world destination, with stable local weather, terrain, architecture, and sensory truth carried forward. The mural is still set inside the court's crumbling rose-petal masonry and should include a luminous ouroboros ring knocker worked into the surface. Dusk parchment palette, tactile erosion, ceremonial but ruin-worn atmosphere, old storybook gravity rather than glossy fantasy.`,
    textPromptPlaceholder: 'Which doorway will you eventually trust?',
    expectationSummary: variant.expectation,
    continuitySummary: variant.continuity,
    visualContinuityGuidance:
      buildRoseCourtVisualContinuityGuidance(`This is one answered interpretation of the confirmed Earth destination. The geography must stay stable while the shelter, mood, and mural medium shift toward ${variant.caption.toLowerCase()}.`),
    visualTransitionIntent: 'drift',
    promptGuidance:
      `This mural is one interpretation of the confirmed earthly destination, not a new place. Keep ${placeName} recognisable and let this version lean specifically toward ${variant.caption.toLowerCase()}. The door should feel enterable, but the image must still read as mural before threshold.`,
    directions: [
      {
        direction: 'forward',
        label: 'Turn the ouroboros ring and step through',
        targetScreenId: 'inner_court_well_approach'
      },
      {
        direction: 'back',
        label: 'Return to the second wall',
        targetScreenId: 'location_mural_gallery'
      }
    ],
    screenType: 'authored',
    parentScreenId: 'location_mural_gallery',
    anchorScreenId: 'location_mural_gallery',
    stageLayout: 'stacked',
    stageModules: [
      {
        module_id: `${variant.id}-note`,
        type: 'evidence_note',
        title: variant.caption,
        body: variant.continuity,
        caption: placeName
      },
      {
        module_id: `${variant.id}-quote`,
        type: 'quote_panel',
        title: 'Ledger Echo',
        body: placeSummary,
        caption: sensory
      }
    ],
    _direction: {
      direction: variant.direction,
      label: variant.label,
      targetScreenId: variant.id
    }
  }));
}

function buildRoseCourtWellSequenceScreens(brief = {}) {
  const placeName = truncateQuestText(brief?.placeName || 'the filed earthly destination', 120);
  const placeSummary = truncateQuestText(
    brief?.placeSummary || `${placeName} still hangs in the air behind you like a destination the court has already accepted.`,
    320
  );

  return [
    {
      id: 'inner_court_well_approach',
      title: 'Broken Path to the Well',
      prompt:
        'Past the second wall, the court opens onto a broken path cut along the inner cliff. There, almost tucked into the masonry, you finally notice a roofed stone well. Beyond it the rose-like structure rises over the court, stranger and nearer than before.',
      imageUrl: '/ruin_south_a.png',
      image_prompt:
        'Aged illuminated-manuscript inner-court path, broken arches and a roofed stone well set into rose-petal masonry, distant taller petals of the Hall of the Rose looming beyond, dusk ceremonial ruin atmosphere.',
      referenceImagePrompt:
        'Wide inner-court approach at dusk, as though stepping beyond the second mural wall into a deeper petal of the same ruin. A broken masonry path curves toward a roofed stone well tucked into the wall. Beyond it, the taller inner petals of the Hall of the Rose rise stranger and less ruined than the outer wall. Keep the same parchment-gold dusk, elven petal-masonry, and tactile age. Leave enough space for a falcon to be implied above or nearby, but do not let the bird dominate yet.',
      textPromptPlaceholder: 'Do you keep your distance, or move to the rim?',
      expectationSummary: 'The well is discovered only after the second wall has answered the filed destination.',
      continuitySummary: `${placeSummary} The falcon is not in your hand; it is somewhere above, already keeping pace.`,
      visualContinuityGuidance:
        buildRoseCourtVisualContinuityGuidance('This is the first inward step beyond the mural-door logic. The environment should feel like the same court, one layer deeper and slightly less ruined, not like a different fantasy map.'),
      visualTransitionIntent: 'drift',
      promptGuidance:
        'This screen should feel like the court opening one layer further inward. The player notices the well before understanding it. The falcon may be implied or glimpsed, but do not let it dominate until the player reaches the rim.',
      componentBindings: [
        {
          componentId: 'messenger',
          slot: 'auto_open',
          props: {
            sceneId: ROSE_COURT_TRANSPORT_MESSENGER_SCENE_ID
          }
        },
        {
          componentId: 'messenger',
          slot: 'action_button',
          props: {
            sceneId: ROSE_COURT_TRANSPORT_MESSENGER_SCENE_ID,
            label: 'Answer the returning transmission'
          }
        }
      ],
      directions: [
        {
          direction: 'down',
          label: 'Step to the rim and look into the well',
          targetScreenId: 'inner_court_well'
        },
        {
          direction: 'back',
          label: 'Return to the second wall of murals',
          targetScreenId: 'location_mural_gallery'
        }
      ]
    },
    {
      id: 'inner_court_well',
      title: 'Well of Fragments',
      prompt:
        'When you lean over the rim, fragments of paper begin resurfacing on the water below. Each one carries a radiant narrative line for a few breaths before the letters loosen, dim, and sink. A falcon lands above you on the well roof, watching until it produces a feather and a scrap of parchment small enough for ten words at most.',
      imageUrl: '/well/well_background.png',
      image_prompt:
        'Ancient roofed stone well in the inner rose court, dark reflective water with resurfacing paper fragments and radiant script, large falcon with satchel perched above, aged manuscript fantasy mood, dusk gold and deep water black.',
      referenceImagePrompt:
        'View into the inner-court well at twilight. Dark water reflects the court while torn paper fragments surface one by one bearing large radiant handwritten lines before they loosen and sink again. Above, on the roof of the well, a large falcon with a satchel watches and offers feather and parchment. The stonework should still belong to the Hall of the Rose: old elven masonry, tactile erosion, quiet ceremonial dread, luminous letters rather than flashy magical beams.',
      textPromptPlaceholder: 'The falcon waits for one line. Ten words at most.',
      expectationSummary: 'Fragments from books and unwritten pages surface, fade, and sink while the falcon waits for a single line in return.',
      continuitySummary: 'This is the final interactive beat of the opening scene: write, surrender the parchment, watch the falcon depart.',
      visualContinuityGuidance:
        buildRoseCourtVisualContinuityGuidance('Keep the same court and same dusk world, but shift from architectural distance into vertical stillness, luminous text, and the falcon\'s deliberate presence.'),
      visualTransitionIntent: 'drift',
      promptGuidance:
        'Hold this scene in stillness and precision. The surfaced lines should feel like fragments of many books, not a single message. The falcon is deliberate and expectant, and the parchment limit of ten words must be clear and binding.',
      sceneEndCondition: 'The scene ends when the player commits a line to the parchment and the falcon carries it toward the dovecot above the inner court.',
      componentBindings: [
        {
          componentId: 'well_sequence',
          slot: 'screen_media',
          props: {}
        }
      ],
      directions: [
        {
          direction: 'end',
          label: 'Let the opening scene go dark',
          targetScreenId: 'inner_court_blackout'
        }
      ],
      stageLayout: 'focus-left',
      stageModules: [
        {
          module_id: 'well-fragments-note',
          type: 'evidence_note',
          title: 'Ink Allowance',
          body: 'The parchment is small by design. The falcon offers only enough ink for a single line of ten words or fewer.',
          caption: 'The court expects precision.'
        }
      ]
    },
    {
      id: 'inner_court_blackout',
      title: 'Blackout',
      prompt: '',
      imageUrl: '',
      image_prompt: 'Full black screen, opening scene ended.',
      referenceImagePrompt: 'Complete black frame. No detail. The opening scene has ended.',
      textPromptPlaceholder: '',
      expectationSummary: '',
      continuitySummary: 'The opening scene ends in blank darkness after the falcon ascends toward the dovecot.',
      visualContinuityGuidance: 'Break completely from the illustrated manuscript imagery. The opening is over; leave only black.',
      visualTransitionIntent: 'break',
      promptGuidance:
        'Nothing further should be described here. Once the falcon departs and the screen cuts to black, the opening is over.',
      directions: []
    }
  ];
}

function materializeRoseCourtLocationMurals(config = {}, brief = {}) {
  const nextVariants = buildRoseCourtLocationVariantScreens(brief);
  const nextWellScreens = buildRoseCourtWellSequenceScreens(brief);
  const variantIds = new Set(nextVariants.map((screen) => screen.id));
  const wellScreenIds = new Set(nextWellScreens.map((screen) => screen.id));
  const retainedScreens = (Array.isArray(config?.screens) ? config.screens : [])
    .filter((screen) => (
      screen.id !== 'location_mural_gallery'
      && !variantIds.has(screen.id)
      && !wellScreenIds.has(screen.id)
    ))
    .map((screen) => {
      if (screen.id !== 'phone_found') {
        return screen;
      }
      const retainedDirections = (Array.isArray(screen.directions) ? screen.directions : [])
        .filter((direction) => direction.targetScreenId !== 'location_mural_gallery');
      return {
        ...screen,
        directions: [
          ...retainedDirections,
          {
            direction: 'forward',
            label: 'Approach the second wall of murals',
            targetScreenId: 'location_mural_gallery'
          }
        ]
      };
    });

  const galleryScreen = {
    id: 'location_mural_gallery',
    title: 'Second Wall of Murals',
    prompt:
      `The wall answers the earthly destination with three new murals. Each one is unmistakably ${brief?.placeName || 'the place you named'}, but each leans into a different shelter, mood, and way of writing there.`,
    imageUrl: '/ruin_south_a.png',
    image_prompt:
      `Aged illuminated-manuscript second wall of the Hall of the Rose, three newly formed murals interpreting ${brief?.placeName || 'a named earthly destination'} in distinct moods but the same geography, glowing ouroboros ring knockers, crumbling petal masonry at dusk.`,
    referenceImagePrompt:
      `Wide ceremonial view of the second wall of the Hall of the Rose at dusk. Three newly appeared murals all interpret ${brief?.placeName || 'the confirmed earthly destination'} in different moods of shelter, but they clearly belong to one real location. Keep the same crumbling elven rose-petal masonry, tactile age, and illuminated-manuscript gravity established at the opening wall. Each mural should feel crafted in a different medium and each mural door should carry a luminous ouroboros ring handle.`,
    textPromptPlaceholder: 'Choose which mural interpretation you want to inspect.',
    expectationSummary: 'Three new mural interpretations now fit the earthly destination given to the clerk.',
    continuitySummary: 'These murals were materialized in response to the confirmed address, not discovered before it.',
    visualContinuityGuidance:
      buildRoseCourtVisualContinuityGuidance('The second wall should read as the answered cousin of the opening wall: same court, same ruin, more active response, and clearer ring-handles, but not a clean or modernized space.'),
    visualTransitionIntent: 'drift',
    promptGuidance:
      'This gallery confirms that the court has accepted the earthly address. All three murals should be recognisably the same place, varied by mood and shelter rather than by geography. The sense should be selection, not randomness.',
    directions: nextVariants.map((screen) => screen._direction),
    stageLayout: 'focus-left',
    stageModules: [
      {
        module_id: 'location-gallery-note',
        type: 'evidence_note',
        title: 'Confirmed Destination',
        body: brief?.placeSummary || '',
        caption: brief?.placeName || ''
      }
    ]
  };

  return {
    config: {
      ...config,
      screens: [
        ...retainedScreens,
        galleryScreen,
        ...nextVariants.map((screen) => {
          const nextScreen = { ...screen };
          delete nextScreen._direction;
          return nextScreen;
        }),
        ...nextWellScreens
      ]
    },
    screen: galleryScreen,
    generatedScreens: nextVariants.map((screen) => {
      const nextScreen = { ...screen };
      delete nextScreen._direction;
      return nextScreen;
    })
  };
}

async function advanceQuest(payload = {}) {
  const scope = normalizeQuestScope(payload);
  const config = await ensureQuestConfig(scope);
  const screenMap = buildQuestScreenMap(config);
  const currentScreenId = typeof payload.currentScreenId === 'string' ? payload.currentScreenId.trim() : '';
  const currentScreen = screenMap.get(currentScreenId)
    || screenMap.get(config.startScreenId)
    || config.screens[0]
    || null;

  if (!currentScreen) {
    const error = new Error('Quest screen not found.');
    error.statusCode = 404;
    error.code = 'QUEST_SCREEN_NOT_FOUND';
    throw error;
  }

  const playerId = typeof payload.playerId === 'string' ? payload.playerId.trim() : '';
  const requestedActionType = typeof payload.actionType === 'string' ? payload.actionType.trim().toLowerCase() : '';
  const actionType = requestedActionType === 'direction' ? 'direction' : 'prompt';

  if (actionType === 'direction') {
    const requestedTargetScreenId = typeof payload.targetScreenId === 'string' ? payload.targetScreenId.trim() : '';
    const requestedDirection = typeof payload.direction === 'string' ? payload.direction.trim().toLowerCase() : '';
    const direction = (Array.isArray(currentScreen.directions) ? currentScreen.directions : []).find((candidate) => {
      if (!candidate || typeof candidate !== 'object') return false;
      if (requestedTargetScreenId && candidate.targetScreenId === requestedTargetScreenId) return true;
      if (requestedDirection && candidate.direction === requestedDirection) return true;
      return false;
    });

    if (!direction) {
      const error = new Error('Quest direction not found.');
      error.statusCode = 404;
      error.code = 'QUEST_DIRECTION_NOT_FOUND';
      throw error;
    }

    const next = applyQuestDirectionAdvance(config, currentScreen, direction);
    if (!next?.screen) {
      const error = new Error('Quest direction target not found.');
      error.statusCode = 404;
      error.code = 'QUEST_DIRECTION_TARGET_NOT_FOUND';
      throw error;
    }

    const eventResult = await appendQuestTraversalEvent({
      ...scope,
      playerId,
      fromScreenId: currentScreen.id,
      toScreenId: next.screen.id,
      direction: direction.direction
    });

    return {
      sessionId: scope.sessionId,
      questId: scope.questId,
      actionType,
      config: next.config,
      screen: next.screen,
      createdScreen: null,
      event: eventResult?.event || null,
      traversalCount: eventResult?.traversalCount || 0,
      mocked: false,
      runtime: null,
      mockedData: null
    };
  }

  const promptText = typeof payload.promptText === 'string' ? payload.promptText.trim() : '';
  if (!promptText) {
    const error = new Error('Missing required parameter: promptText.');
    error.statusCode = 400;
    error.code = 'QUEST_PROMPT_REQUIRED';
    throw error;
  }

  const authoredPromptAdvance = resolveQuestAuthoredPromptAdvance(config, currentScreen, promptText);
  if (authoredPromptAdvance?.screen?.id) {
    const eventResult = await appendQuestTraversalEvent({
      ...scope,
      playerId,
      fromScreenId: currentScreen.id,
      toScreenId: authoredPromptAdvance.screen.id,
      direction: 'prompt',
      promptText
    });

    return {
      sessionId: scope.sessionId,
      questId: scope.questId,
      actionType,
      config,
      screen: authoredPromptAdvance.screen,
      createdScreen: null,
      event: eventResult?.event || null,
      traversalCount: eventResult?.traversalCount || 0,
      mocked: false,
      runtime: null,
      mockedData: {
        source: 'authored-prompt-route',
        routeId: authoredPromptAdvance.route?.id || '',
        routeDescription: authoredPromptAdvance.route?.description || '',
        matchedPrompt: promptText,
        targetScreenId: authoredPromptAdvance.screen.id
      }
    };
  }

  const anchorScreen = resolveQuestAnchorScreen(currentScreen, screenMap) || currentScreen;
  const traversalPayload = await getQuestTraversal(scope);
  const traversal = Array.isArray(traversalPayload?.traversal) ? traversalPayload.traversal : [];
  const questPipeline = await getAiPipelineSettings('quest_generation');
  const runtime = buildQuestAdvanceRuntime(
    questPipeline,
    resolveMockMode(payload, questPipeline.useMock)
  );
  const promptPayload = buildQuestAdvancePromptPayload({
    config,
    currentScreen,
    anchorScreen,
    promptText,
    traversal,
    screenMap
  });

  let generationPlan = null;
  let mockedData = null;
  if (runtime.mocked) {
    generationPlan = buildQuestAdvanceSeed({
      currentScreen,
      anchorScreen,
      promptText
    });
    mockedData = buildQuestAdvanceMockedData({
      promptPayload,
      plan: generationPlan,
      currentScreen,
      anchorScreen
    });
  } else {
    const { promptTemplate } = await resolveQuestAdvanceRuntimeConfig();
    const promptMessages = buildQuestAdvancePromptMessages({
      promptTemplate,
      promptPayload
    });
    const rawResponse = await callJsonLlm({
      prompts: promptMessages.prompts,
      provider: runtime.provider,
      model: runtime.model || '',
      max_tokens: 1800,
      explicitJsonObjectFormat: true
    });

    if (!rawResponse || typeof rawResponse !== 'object') {
      throw createQuestAdvanceError('Quest advance generation failed.', { runtime });
    }

    const contractCandidate = coerceQuestAdvanceContractPayload(rawResponse);

    try {
      await validatePayloadForRoute(QUEST_ADVANCE_CONTRACT_KEY, contractCandidate);
    } catch (error) {
      error.statusCode = error.statusCode || 502;
      error.runtime = runtime;
      throw error;
    }

    generationPlan = contractCandidate;
  }

  const generated = buildGeneratedQuestScreen(config, currentScreen, promptText, playerId, generationPlan);
  const nextScreens = (Array.isArray(config.screens) ? config.screens : []).map((screen) => {
    if (screen.id !== currentScreen.id) return screen;
    return {
      ...screen,
      directions: [...(Array.isArray(screen.directions) ? screen.directions : []), generated.direction]
    };
  });
  nextScreens.push(generated.screen);

  const savedConfig = await saveQuestConfig({
    ...config,
    sessionId: scope.sessionId,
    questId: scope.questId,
    screens: nextScreens
  }, scope);

  const savedScreenMap = buildQuestScreenMap(savedConfig);
  const savedScreen = savedScreenMap.get(generated.screen.id) || generated.screen;
  const eventResult = await appendQuestTraversalEvent({
    ...scope,
    playerId,
    fromScreenId: currentScreen.id,
    toScreenId: savedScreen.id,
    direction: 'prompt',
    promptText
  });

  return {
    sessionId: scope.sessionId,
    questId: scope.questId,
    actionType,
    config: savedConfig,
    screen: savedScreen,
    createdScreen: savedScreen,
    event: eventResult?.event || null,
    traversalCount: eventResult?.traversalCount || 0,
    mocked: runtime.mocked,
    runtime,
    mockedData
  };
}

function sanitizeQuestConfig(payload, { preserveUpdatedAt = false, fallbackScope = {} } = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const scope = normalizeQuestScope(source, fallbackScope);
  const sceneName = typeof source.sceneName === 'string'
    ? source.sceneName.trim()
    : '';
  const sceneTemplate = normalizeQuestSceneTemplate(source.sceneTemplate);
  const sceneComponents = normalizeQuestSceneComponents(source.sceneComponents);
  const normalizedScreens = Array.isArray(source.screens)
    ? source.screens.map(normalizeQuestScreen).filter(Boolean)
    : [];
  const authoringBrief = typeof source.authoringBrief === 'string'
    ? source.authoringBrief.trim()
    : '';
  const phaseGuidance = typeof source.phaseGuidance === 'string'
    ? source.phaseGuidance.trim()
    : '';
  const visualStyleGuide = typeof source.visualStyleGuide === 'string'
    ? source.visualStyleGuide.trim()
    : '';
  const promptRoutes = Array.isArray(source.promptRoutes)
    ? source.promptRoutes.map(normalizeQuestPromptRoute).filter(Boolean)
    : [];

  if (!normalizedScreens.length) {
    const fallback = cloneDefaultQuestConfig(scope);
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
    sceneName,
    sceneTemplate,
    sceneComponents,
    startScreenId,
    authoringBrief,
    phaseGuidance,
    visualStyleGuide,
    promptRoutes: promptRoutes.filter((route) => validIds.has(route.targetScreenId)),
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

  if (Array.isArray(payload.promptRoutes)) {
    payload.promptRoutes.forEach((route, index) => {
      const normalizedRoute = normalizeQuestPromptRoute(route);
      if (!normalizedRoute) {
        errors.push(`promptRoutes[${index}] must include targetScreenId and at least one pattern.`);
        return;
      }
      if (!screenIds.has(normalizedRoute.targetScreenId)) {
        errors.push(`promptRoutes[${index}] points to unknown screen "${normalizedRoute.targetScreenId}".`);
      }
      normalizedRoute.fromScreenIds.forEach((screenId) => {
        if (!screenIds.has(screenId)) {
          errors.push(`promptRoutes[${index}] references unknown fromScreenId "${screenId}".`);
        }
      });
    });
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
  const seed = buildDefaultQuestConfigForScope({
    sessionId: doc?.sessionId || fallbackScope?.sessionId,
    questId: doc?.questId || fallbackScope?.questId
  });
  const hydratedDoc = applyQuestAuthoringDefaults(
    {
      sessionId: doc?.sessionId,
      questId: doc?.questId,
      sceneName: doc?.sceneName,
      sceneTemplate: doc?.sceneTemplate,
      sceneComponents: doc?.sceneComponents || [],
      startScreenId: doc?.startScreenId,
      authoringBrief: doc?.authoringBrief,
      phaseGuidance: doc?.phaseGuidance,
      visualStyleGuide: doc?.visualStyleGuide,
      promptRoutes: doc?.promptRoutes || [],
      screens: doc?.screens || [],
      updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : undefined
    },
    {
      sceneName: seed?.sceneName,
      sceneTemplate: seed?.sceneTemplate,
      sceneComponents: seed?.sceneComponents || [],
      authoringBrief: seed?.authoringBrief,
      phaseGuidance: seed?.phaseGuidance,
      visualStyleGuide: seed?.visualStyleGuide,
      promptRoutes: seed?.promptRoutes || [],
      screensById: Object.fromEntries((Array.isArray(seed?.screens) ? seed.screens : []).map((screen) => [screen.id, screen]))
    }
  );
  return sanitizeQuestConfig(
    hydratedDoc,
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
    ...cloneDefaultQuestConfig(scope),
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
        sceneName: seed.sceneName,
        sceneTemplate: seed.sceneTemplate,
        sceneComponents: seed.sceneComponents,
        startScreenId: seed.startScreenId,
        authoringBrief: seed.authoringBrief,
        phaseGuidance: seed.phaseGuidance,
        visualStyleGuide: seed.visualStyleGuide,
        promptRoutes: seed.promptRoutes,
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
        sceneName: nextConfig.sceneName,
        sceneTemplate: nextConfig.sceneTemplate,
        sceneComponents: nextConfig.sceneComponents,
        startScreenId: nextConfig.startScreenId,
        authoringBrief: nextConfig.authoringBrief,
        phaseGuidance: nextConfig.phaseGuidance,
        visualStyleGuide: nextConfig.visualStyleGuide,
        promptRoutes: nextConfig.promptRoutes,
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
    ...cloneDefaultQuestConfig(scope),
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
        sceneName: resetConfig.sceneName,
        sceneTemplate: resetConfig.sceneTemplate,
        sceneComponents: resetConfig.sceneComponents,
        startScreenId: resetConfig.startScreenId,
        authoringBrief: resetConfig.authoringBrief,
        phaseGuidance: resetConfig.phaseGuidance,
        visualStyleGuide: resetConfig.visualStyleGuide,
        promptRoutes: resetConfig.promptRoutes,
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

async function materializeRoseCourtLocationMuralsForQuest(payload = {}) {
  const scope = normalizeQuestScope(payload, {
    sessionId: ROSE_COURT_PROLOGUE_SESSION_ID,
    questId: ROSE_COURT_PROLOGUE_QUEST_ID
  });

  if (!isRoseCourtPrologueQuest(scope.questId)) {
    const error = new Error('Rose Court mural materialization is only available for the rose court prologue quest.');
    error.statusCode = 400;
    error.code = 'ROSE_COURT_INVALID_QUEST';
    throw error;
  }

  const sceneId = normalizeMessengerSceneId(payload.sceneId || ROSE_COURT_LOCATION_MESSENGER_SCENE_ID);
  const persistence = await resolveMessengerPersistenceMode();
  const brief = await getMessengerSceneBrief(scope.sessionId, sceneId, persistence);
  if (!brief || !isMessengerSceneBriefComplete(brief, sceneId)) {
    const error = new Error('The rose court location has not been confirmed yet.');
    error.statusCode = 400;
    error.code = 'ROSE_COURT_LOCATION_INCOMPLETE';
    throw error;
  }

  const config = await ensureQuestConfig(scope);
  const materialized = materializeRoseCourtLocationMurals(config, brief);
  const savedConfig = await saveQuestConfig({
    ...materialized.config,
    sessionId: scope.sessionId,
    questId: scope.questId
  }, scope);

  const playerId = typeof payload.playerId === 'string' ? payload.playerId.trim() : '';
  const fromScreenId = typeof payload.fromScreenId === 'string' && payload.fromScreenId.trim()
    ? payload.fromScreenId.trim()
    : 'phone_found';
  const eventResult = await appendQuestTraversalEvent({
    ...scope,
    playerId,
    fromScreenId,
    toScreenId: materialized.screen.id,
    direction: 'transmission'
  });

  return {
    sessionId: scope.sessionId,
    questId: scope.questId,
    sceneId,
    config: savedConfig,
    screen: materialized.screen,
    generatedScreens: materialized.generatedScreens,
    sceneBrief: brief,
    event: eventResult?.event || null,
    traversalCount: eventResult?.traversalCount || 0
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

  const safeEntityId = String(entityId);

  const publicByExternalId = await NarrativeEntity.findOne({
    externalId: safeEntityId,
    privacy: 'public'
  });
  if (publicByExternalId) {
    return publicByExternalId;
  }

  const byExternalId = await NarrativeEntity.findOne({
    ...buildEntityAccessQuery(sessionId, playerId),
    externalId: safeEntityId
  });
  if (byExternalId) {
    return byExternalId;
  }

  if (!mongoose.isValidObjectId(safeEntityId)) {
    return null;
  }

  return NarrativeEntity.findOne({
    ...buildEntityAccessQuery(sessionId, playerId),
    _id: safeEntityId
  });
}

async function upsertNarrativeEntityFromSeerClaim({
  reading,
  playerId,
  card,
  claimedAt,
  linkedReadingEntity,
  existingEntity
}) {
  const sessionId = firstDefinedString(reading?.sessionId);
  const worldId = firstDefinedString(reading?.worldId);
  const universeId = firstDefinedString(reading?.universeId, worldId);
  const focusMemory = Array.isArray(reading?.memories)
    ? reading.memories.find((memory) => memory.id === firstDefinedString(reading?.spread?.focusMemoryId))
    : null;
  const safePlayerId = normalizeOptionalPlayerId(playerId);
  const externalId = firstDefinedString(
    existingEntity?.externalId,
    linkedReadingEntity?.externalId,
    linkedReadingEntity?.sourceEntityId,
    linkedReadingEntity?.id,
    `seer-claim-${randomUUID()}`
  );
  const existingAssets = Array.isArray(existingEntity?.mediaAssets) ? existingEntity.mediaAssets : [];
  const nextAssets = buildSeerClaimMediaAssets(card, claimedAt);
  const existingEvidence = Array.isArray(existingEntity?.evidence) ? existingEntity.evidence : [];
  const claimEvidence = {
    kind: 'seer_card_claim',
    readingId: firstDefinedString(reading?.readingId),
    memoryId: firstDefinedString(focusMemory?.id, reading?.spread?.focusMemoryId),
    cardId: firstDefinedString(card?.id),
    title: firstDefinedString(card?.title),
    summary: firstDefinedString(card?.front?.summary),
    facts: Array.isArray(card?.front?.facts) ? card.front.facts.filter(Boolean).slice(0, 6) : [],
    claimedAt
  };

  const updatedEntity = await upsertNarrativeEntity(
    {
      session_id: sessionId,
      sessionId,
      playerId: safePlayerId,
      externalId,
      name: firstDefinedString(existingEntity?.name, card?.title, linkedReadingEntity?.name, 'Claimed entity'),
      description: firstDefinedString(existingEntity?.description, card?.front?.summary, linkedReadingEntity?.description),
      lore: firstDefinedString(existingEntity?.lore, linkedReadingEntity?.lore),
      type: firstDefinedString(existingEntity?.type, linkedReadingEntity?.type, String(card?.kind || '').toUpperCase()),
      subtype: firstDefinedString(existingEntity?.subtype, linkedReadingEntity?.subtype),
      tags: Array.from(new Set([
        ...(Array.isArray(existingEntity?.tags) ? existingEntity.tags : []),
        ...(Array.isArray(linkedReadingEntity?.tags) ? linkedReadingEntity.tags : []),
        firstDefinedString(card?.kind)
      ].filter(Boolean))),
      worldId,
      universeId,
      canonicalStatus: firstDefinedString(existingEntity?.canonicalStatus, 'candidate'),
      source: firstDefinedString(existingEntity?.source, 'seer_claim'),
      sourceRoute: firstDefinedString(existingEntity?.sourceRoute, '/api/seer/readings/:readingId/cards/:cardId/claim'),
      sourceReadingIds: Array.from(new Set([
        ...(Array.isArray(existingEntity?.sourceReadingIds) ? existingEntity.sourceReadingIds : []),
        firstDefinedString(reading?.readingId)
      ].filter(Boolean))),
      claimedFromCardIds: Array.from(new Set([
        ...(Array.isArray(existingEntity?.claimedFromCardIds) ? existingEntity.claimedFromCardIds : []),
        firstDefinedString(card?.id)
      ].filter(Boolean))),
      discoveredByPlayerIds: Array.from(new Set([
        ...(Array.isArray(existingEntity?.discoveredByPlayerIds) ? existingEntity.discoveredByPlayerIds : []),
        safePlayerId
      ].filter(Boolean))),
      bankSource: {
        readingId: firstDefinedString(reading?.readingId),
        memoryId: firstDefinedString(focusMemory?.id, reading?.spread?.focusMemoryId),
        cardId: firstDefinedString(card?.id),
        sourceType: 'seer_claim'
      },
      mediaAssets: mergeSeerMediaAssets(existingAssets, nextAssets),
      evidence: [...existingEvidence, claimEvidence],
      generationCosts: Array.isArray(existingEntity?.generationCosts) ? existingEntity.generationCosts : [],
      reuseCount: Math.max(1, Number(existingEntity?.reuseCount || 0) + 1),
      lastUsedAt: claimedAt
    },
    {
      sessionId,
      playerId: safePlayerId,
      worldId,
      universeId,
      source: 'seer_claim',
      sourceRoute: '/api/seer/readings/:readingId/cards/:cardId/claim',
      lookup: existingEntity
        ? applyOptionalPlayerId({ _id: existingEntity._id, session_id: sessionId }, safePlayerId)
        : applyOptionalPlayerId({ session_id: sessionId, externalId }, safePlayerId)
    }
  );

  return updatedEntity;
}

// Register the route surface by domain so the server entrypoint stays a composition root.
registerWellAdminRoutes(app, {
  requireAdmin,
  loadWellSceneConfig,
  startWellMemorySession,
  getWellMemorySession,
  drawNextWellTextualFragment,
  submitWellTextualJot,
  handoffWellMemorySession,
  getWellSceneConfigMeta,
  saveWellSceneConfig,
  resetWellSceneConfig,
  getTypewriterAiSettings,
  getTypewriterPipelineDefinitions,
  updateTypewriterAiSettings,
  resetTypewriterAiSettings,
  parseBooleanFlag,
  listAvailableOpenAiModels,
  listAvailableAnthropicModels,
  listLatestPromptTemplates,
  getCurrentTypewriterPromptTemplates,
  getTypewriterPromptDefinitions,
  seedCurrentTypewriterPromptTemplates,
  listPromptTemplateVersions,
  savePromptTemplateVersion,
  setLatestPromptTemplate,
  listRouteConfigs,
  getRouteConfig,
  listRouteConfigVersions,
  saveRouteConfigVersion,
  updateRoutePrompt,
  updateRouteSchema,
  setLatestRouteConfig,
  resetRouteConfig
});

registerQuestRoutes(app, {
  requireAdmin,
  normalizeQuestScope,
  ensureQuestConfig,
  validateQuestConfigPayload,
  saveQuestConfig,
  resetQuestConfig,
  parseQuestSceneImageDataUrl,
  MAX_QUEST_SCENE_UPLOAD_BYTES,
  buildQuestSceneUploadAssetPath,
  fsPromises,
  composeQuestSceneImagePrompt,
  resolveProjectAssetUrl,
  generateQuestSceneImageAsset,
  resolveMockMode,
  sanitizeQuestConfig,
  getAiPipelineSettings,
  QUEST_SCENE_AUTHORING_PIPELINE_KEY,
  buildQuestSceneAuthoringRuntime,
  buildQuestSceneAuthoringPromptPayload,
  buildQuestPromptSourceDetails,
  getDefaultQuestSceneAuthoringPromptTemplate,
  buildMockQuestSceneAuthoringDraft,
  resolveQuestSceneAuthoringRuntimeConfig,
  buildQuestSceneAuthoringPromptMessages,
  callJsonLlm,
  normalizeQuestSceneAuthoringDraft,
  flattenQuestSceneAuthoringChanges,
  buildQuestDebugContext,
  appendQuestTraversalEvent,
  getQuestTraversal,
  materializeRoseCourtLocationMuralsForQuest,
  advanceQuest,
  resolveSchemaErrorMessage
});

app.use('/api', memoriesRouter);

registerSeerRoutes(app, {
  firstDefinedString,
  normalizeOptionalPlayerId,
  randomUUID,
  resolveFragmentText,
  resolveWorldContextForSession,
  resolveSeerReadingMemories,
  chooseSeerVisionSourceMemory,
  selectSeerRuntimeMemories,
  buildSeerReadingMemory,
  chooseInitialSeerFocusMemoryId,
  NarrativeEntity,
  applyOptionalPlayerId,
  buildSeerReadingEntity,
  getPipelineSettings,
  resolveMockMode,
  normalizeSeerCardCount,
  normalizeSeerStringArray,
  resolveSeerCardKinds,
  generateSeerReadingCardDrafts,
  buildSeerReadingCardFromDraft,
  listTypewriterSlotStorytellers,
  buildSeerReadingApparition,
  buildSeerVision,
  buildSeerReadingSpread,
  SeerReading,
  normalizeSeerReadingPayload,
  runSeerReadingTurn,
  findSeerReadingEntityByCard,
  resolveCanonicalEntityForClaim,
  upsertNarrativeEntityFromSeerClaim,
  buildClaimedEntityLink,
  findNextSeerClaimFocusCard,
  createSeerTranscriptEntry,
  buildClaimedSeerCardRecord,
  buildSeerCardLayout,
  buildSeerOrchestratorEnvelope,
  synthesizeCharacterSheetFromSeerClaim,
  toImmersiveRpgCharacterSheetPayload,
  executeSeerCardClaimAction,
  executeStorytellerMissionAction
});

registerSessionWorldRoutes(app, {
  randomUUID,
  SessionPlayer,
  Arena,
  normalizeArenaPayload,
  World,
  findWorldForPlayer,
  WorldElement,
  getRouteConfig,
  renderPrompt,
  directExternalApiCall,
  validatePayloadForRoute,
  buildMockWorld,
  buildMockElements,
  resolveSchemaErrorMessage,
  sendLlmAwareError
});

registerNarrativeRoutes(app, {
  Storyteller,
  NarrativeEntity,
  applyOptionalPlayerId,
  buildEntityAccessQuery,
  dedupeNarrativeEntitiesForResponse,
  matchesOptionalPlayerId,
  buildStorytellerListItem,
  parseOptionalBooleanQuery,
  escapeRegexPattern,
  firstDefinedString,
  normalizeOptionalPlayerId,
  findEntityById,
  getAiPipelineSettings,
  getLatestPromptTemplate,
  resolveMockMode,
  resolveImageMockMode,
  textToEntityFromText,
  normalizeEntityCount,
  normalizeDesiredEntityCategories,
  validatePayloadForRoute,
  normalizeStorytellerCount,
  buildMockStorytellers,
  renderPromptTemplateString,
  getRouteConfig,
  renderPrompt,
  callJsonLlm,
  normalizeGeneratedStorytellerPayload,
  pickMockStorytellerIllustrationUrl,
  pickMockStorytellerKeyUrl,
  createStoryTellerKey,
  createStorytellerIllustration,
  path,
  resolveSchemaErrorMessage,
  sendLlmAwareError,
  resolveFragmentText,
  updateNarrativeEntityAfterStorytellerMission,
  ensureImmersiveRpgCharacterSheet,
  buildStorytellerMissionCharacterSheetPatch,
  toImmersiveRpgCharacterSheetPayload,
  executeStorytellerMissionAction
});

registerArenaRoutes(app, {
  randomUUID,
  getAiPipelineSettings,
  getLatestPromptTemplate,
  resolveMockMode,
  Arena,
  normalizePredicate,
  getExistingEdgesForEntities,
  getClusterForEntities,
  buildClusterContext,
  checkDuplicateEdge,
  evaluateRelationship,
  deriveRelationshipStrength,
  calculatePoints,
  syncEntityNode,
  createRelationship,
  deleteRelationshipsByEdgeIds
});

registerBrewingRoutes(app, {
  BrewRoom,
  randomUUID,
  generateRoomId,
  sanitizeRoomForPublic,
  broadcastToRoom,
  roomClients
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

import fs from 'fs';
import mongoose from 'mongoose';
import fsPromises from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { ensureMongoConnection } from '../services/mongoConnectionService.js';

const chatMessageSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  sceneId: { type: String, required: true, index: true },
  order: { type: Number, required: true },
  type: { type: String, enum: ['initial', 'response', 'user'], default: 'user' },
  sender: { type: String, enum: ['user', 'system'], required: true },
  content: { type: String, required: true },
  required_rolls: { type: [Object], default: [] },  // Array of flexible JSONs
  has_chat_ended: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const messengerSceneBriefSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  sceneId: { type: String, required: true, index: true },
  subject: { type: String, default: '', index: true },
  placeName: { type: String, default: '' },
  placeSummary: { type: String, default: '' },
  typewriterHidingSpot: { type: String, default: '' },
  sensoryDetails: { type: [String], default: [] },
  notableFeatures: { type: [String], default: [] },
  sceneEstablished: { type: Boolean, default: false },
  assistantReply: { type: String, default: '' },
  source: { type: String, default: 'unknown' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

messengerSceneBriefSchema.index({ sessionId: 1, sceneId: 1 }, { unique: true });

const narrativeFragmentSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  fragment: { type: mongoose.Schema.Types.Mixed, required: true },
  initialFragment: { type: mongoose.Schema.Types.Mixed, default: '' },
  turn: { type: Number },
});

const SessionVectorSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  magic_prevalence: { type: String, enum: ["none", "rare", "hidden", "common", "ubiquitous"] },
  magic_system: { type: String, enum: ["none", "wild", "ritualistic", "structured", "artifact-based", "divine", "soft"] },
  magic_source: { type: String, enum: ["none", "innate", "learned", "artifact", "divine", "environmental"] },
  magic_cultural_role: { type: String, enum: ["none", "celebrated", "feared", "regulated", "taboo", "ignored"] },
  supernatural_manifestation: { type: String, enum: ["none", "subtle", "overt", "mundane", "cosmic"] },
  supernatural_agency: { type: String, enum: ["none", "benign", "malevolent", "ambiguous", "neutral"] },
  supernatural_integration: { type: String, enum: ["none", "central", "peripheral", "atmospheric", "background"] },
  apocalyptic_temporal_focus: { type: String, enum: ["none", "pre-apocalypse", "during", "post-apocalypse", "cyclical"] },
  apocalyptic_scope: { type: String, enum: ["none", "personal", "regional", "global", "cosmic"] },
  apocalyptic_cause: { type: String, enum: ["none", "natural", "supernatural", "war", "disease", "technological", "unknown"] },
  apocalyptic_tone: { type: String, enum: ["none", "grim", "redemptive", "nihilistic", "hopeful"] },
  gothic_setting: { type: String, enum: ["none", "ruins", "castle", "urban decay", "crypts", "forest"] },
  gothic_tone: { type: String, enum: ["none", "melancholic", "oppressive", "suspenseful", "decadent"] },
  // Allowed values for gothic_motifs: ["madness", "family secrets", "the uncanny", "haunting", "decay"]
  gothic_motifs: { type: [String] },
  gothic_role_of_past: { type: String, enum: ["none", "haunting", "influential", "ignored"] },
  technology_level: { type: String, enum: ["none", "prehistoric", "ancient", "medieval", "steampunk", "industrial", "modern", "sci-fi", "cyberpunk", "post-singularity"] },
  technology_integration: { type: String, enum: ["absent", "background", "central", "ubiquitous"] },
  urbanization_settlement_type: { type: String, enum: ["none", "wilds", "village", "town", "city", "megacity", "arcology"] },
  urbanization_density: { type: String, enum: ["none", "sparse", "scattered", "dense", "overcrowded"] },
  religiosity_dominant_belief: { type: String, enum: ["none", "animist", "polytheistic", "monotheistic", "atheist", "cultic", "syncretic"] },
  religiosity_power: { type: String, enum: ["none", "marginal", "influential", "dominant", "theocratic"] },
  scale_physical: { type: String, enum: ["intimate", "local", "regional", "global", "planetary", "interstellar", "multiverse"] },
  scale_temporal: { type: String, enum: ["day", "generation", "century", "epoch", "timeless"] },
  social_structure_system: { type: String, enum: ["none", "tribal", "feudal", "caste", "capitalist", "anarchic", "egalitarian", "matriarchal", "patriarchal"] },
  social_structure_mobility: { type: String, enum: ["none", "frozen", "rigid", "mobile", "fluid"] },
  genre_tropes_style: { type: String, enum: ["none", "heroic", "grimdark", "noir", "fairy tale", "satire", "picaresque", "weird", "hard SF", "soft SF", "romantic", "mythic"] },
  createdAt: { type: Date, default: Date.now }
});

if (process.env.NODE_ENV !== 'test') {
  ensureMongoConnection({ allowFailure: true }).catch((error) => {
    console.error('MongoDB connection error:', error);
  });
}


export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export const MessengerSceneBrief = mongoose.model('MessengerSceneBrief', messengerSceneBriefSchema);
export const NarrativeFragment = mongoose.model('NarrativeFragment', narrativeFragmentSchema);
export const SessionVector = mongoose.model('SessionVector', SessionVectorSchema);

const SessionPlayerSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  playerId: { type: String, required: true, index: true },
  playerName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const SessionPlayer = mongoose.model('SessionPlayer', SessionPlayerSchema);

const ArenaSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true, unique: true },
  arena: { type: mongoose.Schema.Types.Mixed, default: { entities: [], storytellers: [] } },
  lastUpdatedBy: { type: String }
}, { timestamps: true });

export const Arena = mongoose.model('Arena', ArenaSchema);

const WorldSchema = new mongoose.Schema({
  worldId: { type: String, required: true, index: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  playerId: { type: String, required: true, index: true },
  seedText: { type: String, required: true },
  name: { type: String, required: true },
  summary: { type: String },
  tone: { type: String },
  pillars: { type: [String], default: [] },
  themes: { type: [String], default: [] },
  palette: { type: [String], default: [] }
}, { timestamps: true });

export const World = mongoose.model('World', WorldSchema);

const WorldElementSchema = new mongoose.Schema({
  worldId: { type: String, required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  playerId: { type: String, required: true, index: true },
  type: { type: String, enum: ['faction', 'location', 'rumor', 'lore'], required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  tags: { type: [String], default: [] },
  traits: { type: [String], default: [] },
  hooks: { type: [String], default: [] }
}, { timestamps: true });

WorldElementSchema.index({ worldId: 1, type: 1 });

export const WorldElement = mongoose.model('WorldElement', WorldElementSchema);

const StorytellerSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  sessionId: { type: String, index: true },
  playerId: { type: String, index: true },
  name: { type: String, required: true },
  immediate_ghost_appearance: { type: String },
  typewriter_key: {
    symbol: { type: String },
    description: { type: String },
    key_shape: { type: String },
    blank_shape: { type: String },
    blank_texture_url: { type: String },
    shape_prompt_hint: { type: String }
  },
  influences: { type: [String] },
  known_universes: { type: [String] },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  totalStorytellingPoints: { type: Number, default: 0 },
  voice_creation: {
    voice: { type: String },
    age: { type: String },
    style: { type: String },
  },
  vector: { type: [Number] },
  illustration: { type: String },
  keyImageUrl: { type: String },
  keyImageLocalUrl: { type: String },
  keyImageLocalPath: { type: String },
  keyShape: { type: String },
  keyBlankTextureUrl: { type: String },
  keySlotIndex: { type: Number },
  introducedInTypewriter: { type: Boolean, default: false },
  lastTypewriterInterventionAt: { type: Date, default: null },
  typewriterInterventionsCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'in_mission'], default: 'active' },
  missions: {
    type: [
      {
        entityId: { type: mongoose.Schema.Types.ObjectId, ref: 'NarrativeEntity' },
        entityExternalId: { type: String },
        playerId: { type: String },
        storytellingPoints: { type: Number },
        message: { type: String },
        durationDays: { type: Number },
        outcome: { type: String, enum: ['success', 'failure', 'delayed', 'pending'] },
        userText: { type: String },
        gmNote: { type: String },
        subEntityExternalIds: { type: [String], default: [] },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    default: []
  },
}, { timestamps: true });

StorytellerSchema.index({ session_id: 1, playerId: 1, name: 1 });

export const Storyteller = mongoose.model('Storyteller', StorytellerSchema);

const QuestTraversalEventSchema = new mongoose.Schema({
  playerId: { type: String, default: '' },
  fromScreenId: { type: String, default: '' },
  toScreenId: { type: String, required: true },
  direction: { type: String, default: '' },
  promptText: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const QuestScreenGraphSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  questId: { type: String, required: true, default: 'scene_authoring_starter', index: true },
  sceneName: { type: String, default: '' },
  sceneTemplate: { type: String, default: 'basic_scene' },
  sceneComponents: { type: [String], default: [] },
  startScreenId: { type: String, required: true },
  authoringBrief: { type: String, default: '' },
  phaseGuidance: { type: String, default: '' },
  visualStyleGuide: { type: String, default: '' },
  promptRoutes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  screens: { type: [mongoose.Schema.Types.Mixed], default: [] },
  traversalLog: { type: [QuestTraversalEventSchema], default: [] }
}, { timestamps: true });

QuestScreenGraphSchema.index({ sessionId: 1, questId: 1 }, { unique: true });

export const QuestScreenGraph = mongoose.model('QuestScreenGraph', QuestScreenGraphSchema);

const WellMemoryFragmentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['textual'], default: 'textual' },
  bankId: { type: String, default: '' },
  surface: {
    text: { type: String, default: '' }
  },
  surfacedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }
}, { _id: false });

const WellMemoryJotSchema = new mongoose.Schema({
  jotId: { type: String, required: true },
  fragmentId: { type: String, required: true },
  fragmentType: { type: String, enum: ['textual'], default: 'textual' },
  rawJotText: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const WellMemorySessionSchema = new mongoose.Schema({
  session_id: { type: String, required: true, index: true },
  playerId: { type: String, default: '', index: true },
  sceneKey: { type: String, default: 'well', index: true },
  status: {
    type: String,
    enum: ['observing', 'jotting', 'bundle_ready', 'handoff', 'departing', 'completed'],
    default: 'observing'
  },
  required: {
    textual: { type: Number, default: 3 }
  },
  captured: {
    textual: { type: Number, default: 0 }
  },
  currentFragment: { type: WellMemoryFragmentSchema, default: null },
  seenFragmentIds: { type: [String], default: [] },
  bundle: { type: [WellMemoryJotSchema], default: [] },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

WellMemorySessionSchema.index({ session_id: 1, playerId: 1, sceneKey: 1 }, { unique: true });

export const WellMemorySession = mongoose.model('WellMemorySession', WellMemorySessionSchema);

const ImmersiveRpgTranscriptEntrySchema = new mongoose.Schema({
  entryId: { type: String, default: () => randomUUID() },
  role: { type: String, enum: ['gm', 'pc', 'system'], required: true },
  kind: { type: String, default: 'narration' },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const ImmersiveRpgRollSchema = new mongoose.Schema({
  rollId: { type: String, default: () => randomUUID() },
  contextKey: { type: String, default: '' },
  skill: { type: String, default: '' },
  label: { type: String, default: '' },
  diceNotation: { type: String, default: '1d6' },
  diceCount: { type: Number, default: 1 },
  sides: { type: Number, default: 6 },
  difficulty: { type: String, default: 'standard' },
  successThreshold: { type: Number, default: 5 },
  successesRequired: { type: Number, default: 1 },
  rolls: { type: [Number], default: [] },
  successes: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  summary: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const ImmersiveRpgSceneSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true, unique: true },
  playerId: { type: String, required: true, default: 'pc', index: true },
  messengerSceneId: { type: String, default: 'messanger' },
  currentSceneNumber: { type: Number, required: true, default: 3 },
  currentSceneKey: { type: String, required: true, default: 'scene_3_mysterious_encounter' },
  sceneTitle: { type: String, required: true, default: 'Scene 3: The Mysterious Encounter' },
  currentBeat: { type: String, default: 'encounter_setup' },
  status: { type: String, enum: ['draft', 'active', 'paused', 'completed'], default: 'active' },
  promptKey: { type: String, default: 'scene_3_mysterious_encounter' },
  sourceSceneBrief: { type: mongoose.Schema.Types.Mixed, default: {} },
  compiledPrompt: { type: String, default: '' },
  transcript: { type: [ImmersiveRpgTranscriptEntrySchema], default: [] },
  rollLog: { type: [ImmersiveRpgRollSchema], default: [] },
  pendingRoll: { type: mongoose.Schema.Types.Mixed, default: null },
  notebook: { type: mongoose.Schema.Types.Mixed, default: {} },
  stageLayout: { type: String, default: 'focus-left' },
  stageModules: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sceneFlags: { type: mongoose.Schema.Types.Mixed, default: {} },
  notes: { type: [String], default: [] }
}, { timestamps: true });

const ImmersiveRpgCharacterSheetSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  playerId: { type: String, required: true, default: 'pc', index: true },
  playerName: { type: String, default: 'Player Character' },
  identity: { type: mongoose.Schema.Types.Mixed, default: {} },
  coreTraits: { type: mongoose.Schema.Types.Mixed, default: {} },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  skills: { type: mongoose.Schema.Types.Mixed, default: {} },
  inventory: { type: [String], default: [] },
  notes: { type: [String], default: [] },
  sourceSceneBrief: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

ImmersiveRpgCharacterSheetSchema.index({ sessionId: 1, playerId: 1 }, { unique: true });

export const ImmersiveRpgSceneSession = mongoose.model('ImmersiveRpgSceneSession', ImmersiveRpgSceneSessionSchema);
export const ImmersiveRpgCharacterSheet = mongoose.model('ImmersiveRpgCharacterSheet', ImmersiveRpgCharacterSheetSchema);

const TypewriterPromptTemplateSchema = new mongoose.Schema({
  pipelineKey: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  promptTemplate: { type: String, required: true },
  isLatest: { type: Boolean, default: true, index: true },
  createdBy: { type: String, default: 'admin' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

TypewriterPromptTemplateSchema.index({ pipelineKey: 1, version: 1 }, { unique: true });
TypewriterPromptTemplateSchema.index({ pipelineKey: 1, isLatest: 1 });

export const TypewriterPromptTemplate = mongoose.model('TypewriterPromptTemplate', TypewriterPromptTemplateSchema);

const LlmRouteConfigVersionSchema = new mongoose.Schema({
  routeKey: { type: String, required: true, index: true },
  version: { type: Number, required: true },
  promptMode: { type: String, enum: ['manual', 'contract'], default: 'manual' },
  promptTemplate: { type: String, default: '' },
  promptCore: { type: String, default: '' },
  responseSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
  fieldDocs: { type: mongoose.Schema.Types.Mixed, default: {} },
  examplePayload: { type: mongoose.Schema.Types.Mixed, default: null },
  outputRules: { type: [String], default: [] },
  isLatest: { type: Boolean, default: true, index: true },
  createdBy: { type: String, default: 'admin' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

LlmRouteConfigVersionSchema.index({ routeKey: 1, version: 1 }, { unique: true });
LlmRouteConfigVersionSchema.index({ routeKey: 1, isLatest: 1 });

export const LlmRouteConfigVersion = mongoose.model('LlmRouteConfigVersion', LlmRouteConfigVersionSchema);

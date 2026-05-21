import mongoose from 'mongoose';

const OrreryFigurineLevelSchema = new mongoose.Schema({
  figurineId: { type: String, required: true, index: true },
  level: { type: Number, required: true, min: 0, max: 5 },
  meaning: { type: String, default: '' },
  geographyInfluence: { type: String, default: '' },
  civilizationInfluence: { type: String, default: '' },
  magicInfluence: { type: String, default: '' },
  technologyInfluence: { type: String, default: '' },
  emotionalTone: { type: String, default: '' },
  conflictTypes: { type: [String], default: [] },
  materialLanguage: { type: [String], default: [] },
  paperTextureHints: { type: [String], default: [] },
  promptVocabulary: { type: [String], default: [] }
}, { timestamps: true });

OrreryFigurineLevelSchema.index({ figurineId: 1, level: 1 }, { unique: true });

const OrreryAlignmentSchema = new mongoose.Schema({
  alignmentKey: { type: String, required: true, unique: true, index: true },
  vector: { type: mongoose.Schema.Types.Mixed, required: true },
  title: { type: String, default: '' },
  universeSummary: { type: String, default: '' },
  mood: { type: String, default: '' },
  vibe: { type: String, default: '' },
  dominantArchetype: { type: String, default: '' },
  secondaryArchetype: { type: String, default: '' },
  tertiaryArchetype: { type: String, default: '' },
  hybridInterpretation: { type: String, default: '' },
  geographyStyle: { type: String, default: '' },
  civilizationStyle: { type: String, default: '' },
  magicStyle: { type: String, default: '' },
  technologyStyle: { type: String, default: '' },
  materialText: { type: String, default: '' },
  paperTexturePrompt: { type: String, default: '' },
  hiddenImagePrompt: { type: String, default: '' },
  negativePrompt: { type: String, default: 'No readable text. No letters. No UI. No modern objects. No glossy photograph. Keep the central writing area usable.' },
  writingStyle: {
    font: { type: String, default: "'IM Fell English SC', serif" },
    font_size: { type: String, default: '1.9rem' },
    font_color: { type: String, default: '#2a120f' },
    mood: { type: String, default: '' }
  },
  assetPngUrl: { type: String, default: '' },
  assetStatus: {
    type: String,
    enum: ['premade', 'generated', 'missing'],
    default: 'missing'
  },
  source: {
    type: String,
    enum: ['seed', 'composed', 'llm'],
    default: 'composed'
  },
  version: { type: Number, default: 1 }
}, { timestamps: true });

OrreryAlignmentSchema.index({ dominantArchetype: 1, assetStatus: 1 });

export const OrreryFigurineLevel = mongoose.model('OrreryFigurineLevel', OrreryFigurineLevelSchema);
export const OrreryAlignment = mongoose.model('OrreryAlignment', OrreryAlignmentSchema);

import fs from 'fs';
import mongoose from 'mongoose';
import fsPromises from 'fs/promises';
import path from 'path';

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

const narrativeFragmentSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  fragment: { type: mongoose.Schema.Types.Mixed, required: true },
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

mongoose.connect('mongodb://localhost:27017/storytelling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB.");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export const NarrativeFragment = mongoose.model('NarrativeFragment', narrativeFragmentSchema);
export const SessionVector = mongoose.model('SessionVector', SessionVectorSchema);

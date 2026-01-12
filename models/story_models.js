import mongoose from 'mongoose';

const StoryEntitySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  type: {
    type: String,
    enum: ["PLACE", "HERO", "KEYSTONE", "STORYTELLER"],
    required: true,
    index: true
  },
  suit: { type: String, enum: ["STONE", "RIVER", "SKY", "ASH"] },
  order: { type: String, enum: ["LOW", "MID", "HIGH"] },
  tags: { type: [String] },
  summary: { type: String, required: true },
  lore: { type: String },
  universe_keys: { type: [String], default: ["mariposa_world"] },
  portal_friendly: { type: Boolean, default: false },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const StorySpreadSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  universe_key: { type: String, default: "mariposa_world" },
  positions: [{
    position: {
      type: String,
      enum: ["PLACE", "HERO", "KEYSTONE", "STORYTELLER"],
      required: true
    },
    options: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StoryEntity' }],
    chosen_entity_id: { type: mongoose.Schema.Types.ObjectId, ref: 'StoryEntity', default: null }
  }],
}, { timestamps: true });

// Ensure positions are consistent (optional validation could be added here)

export const StoryEntity = mongoose.model('StoryEntity', StoryEntitySchema);
export const StorySpread = mongoose.model('StorySpread', StorySpreadSchema);

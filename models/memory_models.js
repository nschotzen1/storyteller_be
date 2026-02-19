import mongoose from 'mongoose';
import { FRAGMENT_MEMORY_REQUIRED_FIELDS } from '../contracts/fragmentMemoryContract.js';

const fragmentMemorySchemaDefinition = {
  sessionId: { type: String, required: true, index: true },
  playerId: { type: String, index: true },
  fragmentText: { type: String, required: true },
  batchId: { type: String, required: true, index: true },
  memory_strength: { type: String, required: true },
  emotional_sentiment: { type: String, required: true },
  action_name: { type: String, required: true },
  estimated_action_length: { type: String, required: true },
  time_within_action: { type: String, required: true },
  actual_result: { type: String, required: true },
  related_through_what: { type: String, required: true },
  geographical_relevance: { type: String, required: true },
  temporal_relation: { type: String, required: true },
  organizational_affiliation: { type: String, required: true },
  consequences: { type: String, required: true },
  distance_from_fragment_location_km: { type: Number, required: true },
  shot_type: { type: String, required: true },
  time_of_day: { type: String, required: true },
  whose_eyes: { type: String, required: true },
  'interior/exterior': { type: String, required: true },
  what_is_being_watched: { type: String, required: true },
  location: { type: String, required: true },
  estimated_duration_of_memory: { type: Number, required: true, min: 1, max: 30 },
  memory_distance: { type: String, required: true },
  entities_in_memory: { type: [String], required: true, default: [] },
  currently_assumed_turns_to_round: { type: String, required: true },
  relevant_rolls: { type: [String], required: true, default: [] },
  action_level: { type: String, required: true },
  dramatic_definition: { type: String, required: true },
  miseenscene: { type: String, required: true },
  front: {
    prompt: { type: String },
    imageUrl: { type: String }
  },
  back: {
    prompt: { type: String },
    imageUrl: { type: String }
  },
  front_image_url: { type: String },
  back_image_url: { type: String }
};

const FragmentMemorySchema = new mongoose.Schema(fragmentMemorySchemaDefinition, {
  timestamps: true,
  strict: true
});

FragmentMemorySchema.index({ sessionId: 1, playerId: 1, createdAt: -1 });
FragmentMemorySchema.index({ sessionId: 1, batchId: 1 });

// Guardrail: required fields should stay synced with prompt/JSON schema contract.
for (const field of FRAGMENT_MEMORY_REQUIRED_FIELDS) {
  if (!fragmentMemorySchemaDefinition[field]) {
    throw new Error(`FragmentMemory schema missing required contract field: ${field}`);
  }
}

export const FragmentMemory = mongoose.model('FragmentMemory', FragmentMemorySchema);

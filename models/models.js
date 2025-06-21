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

const storytellerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  immediate_ghost_appearance: { type: String },
  typewriter_key: { type: Object },
  influences: { type: [String] },
  known_universes: { type: [String] },
  level: { type: Number },
  voice_creation: { type: Object },
  vector: { type: [Number] },
}, { timestamps: true });

const defaultMongoUri = 'mongodb://localhost:27017/storytelling';

export const connectDB = async (uri) => {
  const mongoUri = uri || defaultMongoUri;
  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`Connected to MongoDB at ${mongoUri}`);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    // Propagate the error or handle it as needed
    throw err;
  }
};

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
export const NarrativeFragment = mongoose.model('NarrativeFragment', narrativeFragmentSchema);
export const Storyteller = mongoose.model('Storyteller', storytellerSchema);

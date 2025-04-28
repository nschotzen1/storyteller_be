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


mongoose.connect('mongodb://localhost:27017/storytelling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB.");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});


export default mongoose.model('ChatMessage', chatMessageSchema);

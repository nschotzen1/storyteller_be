import mongoose from 'mongoose';
import {
  GeneratedContent,
  NarrativeEntity,
  NarrativeTexture,
  SessionState,
  SessionSceneState
} from '../storyteller/utils.js';
import {
  Arena,
  ChatMessage,
  NarrativeFragment,
  SessionVector,
  SessionPlayer,
  World,
  WorldElement,
  Storyteller
} from '../models/models.js';
import { deleteSessionData, closeNeo4j } from '../services/neo4jService.js';

const sessionId = 'persistent-relationships-test';
const mongoUri = process.env.MONGO_URI
  || process.env.MONGODB_URI
  || 'mongodb://localhost:27017/storytelling';

async function cleanup() {
  const sessionFilter = { $in: [sessionId] };
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await Promise.all([
    GeneratedContent.deleteMany({ sessionId: sessionFilter }),
    Arena.deleteMany({ sessionId: sessionFilter }),
    NarrativeEntity.deleteMany({ session_id: sessionFilter }),
    NarrativeTexture.deleteMany({ session_id: sessionFilter }),
    SessionState.deleteMany({ sessionId: sessionFilter }),
    SessionSceneState.deleteMany({ sessionId: sessionFilter }),
    NarrativeFragment.deleteMany({ session_id: sessionFilter }),
    ChatMessage.deleteMany({ sessionId: sessionFilter }),
    SessionVector.deleteMany({ session_id: sessionFilter }),
    SessionPlayer.deleteMany({ sessionId: sessionFilter }),
    World.deleteMany({ sessionId: sessionFilter }),
    WorldElement.deleteMany({ sessionId: sessionFilter }),
    Storyteller.deleteMany({ $or: [{ session_id: sessionFilter }, { sessionId: sessionFilter }] })
  ]);

  await deleteSessionData(sessionId);
  await mongoose.disconnect();
  await closeNeo4j();
}

cleanup().catch((error) => {
  console.error('Failed to cleanup persistent relationships test data:', error);
  process.exitCode = 1;
});

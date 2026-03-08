import mongoose from 'mongoose';

mongoose.set('bufferCommands', false);

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/storytelling';
const SERVER_SELECTION_TIMEOUT_MS = Number.isFinite(Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS))
  ? Math.max(250, Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS))
  : 2000;
const CONNECT_TIMEOUT_MS = Number.isFinite(Number(process.env.MONGODB_CONNECT_TIMEOUT_MS))
  ? Math.max(250, Number(process.env.MONGODB_CONNECT_TIMEOUT_MS))
  : 2000;
const RETRY_COOLDOWN_MS = Number.isFinite(Number(process.env.MONGODB_RETRY_COOLDOWN_MS))
  ? Math.max(250, Number(process.env.MONGODB_RETRY_COOLDOWN_MS))
  : 5000;

let connectPromise = null;
let lastError = null;
let lastAttemptAtMs = 0;

export function getMongoUri() {
  const raw = typeof process.env.MONGODB_URI === 'string' ? process.env.MONGODB_URI.trim() : '';
  return raw || DEFAULT_MONGO_URI;
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export function getMongoConnectionSnapshot() {
  return {
    readyState: mongoose.connection.readyState,
    mongoUri: getMongoUri(),
    lastAttemptAt: lastAttemptAtMs ? new Date(lastAttemptAtMs).toISOString() : '',
    lastError: lastError?.message || ''
  };
}

async function startMongoConnection() {
  lastAttemptAtMs = Date.now();
  lastError = null;
  await mongoose.connect(getMongoUri(), {
    serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS
  });
  return true;
}

export async function ensureMongoConnection({ allowFailure = true } = {}) {
  if (isMongoReady()) {
    return true;
  }

  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  if (mongoose.connection.readyState === 2 && connectPromise) {
    try {
      await connectPromise;
      return true;
    } catch (error) {
      if (!allowFailure) throw error;
      return false;
    }
  }

  const now = Date.now();
  if (
    allowFailure
    && lastError
    && now - lastAttemptAtMs < RETRY_COOLDOWN_MS
  ) {
    return false;
  }

  if (!connectPromise) {
    connectPromise = startMongoConnection()
      .catch((error) => {
        lastError = error;
        throw error;
      })
      .finally(() => {
        connectPromise = null;
      });
  }

  try {
    await connectPromise;
    lastError = null;
    return true;
  } catch (error) {
    if (!allowFailure) {
      throw error;
    }
    return false;
  }
}

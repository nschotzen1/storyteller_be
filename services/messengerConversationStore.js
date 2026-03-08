import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const STORE_PATH = process.env.MESSENGER_CONVERSATION_STORE_PATH
  || path.join(CONFIG_DIR, 'messenger_conversations.json');

function normalizeConversationKey(sessionId, sceneId) {
  return `${sessionId}::${sceneId}`;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      conversations: asObject(parsed.conversations)
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { conversations: {} };
    }
    throw error;
  }
}

async function writeStore(store) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function sortMessages(messages) {
  return [...messages].sort((left, right) => {
    const orderDiff = (Number(left?.order) || 0) - (Number(right?.order) || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(left?.createdAt || '').localeCompare(String(right?.createdAt || ''));
  });
}

function normalizeStoredMessage(doc, sessionId, sceneId) {
  return {
    id: typeof doc?.id === 'string' && doc.id ? doc.id : randomUUID(),
    sessionId,
    sceneId,
    order: Number(doc?.order) || Date.now(),
    type: typeof doc?.type === 'string' ? doc.type : 'response',
    sender: doc?.sender === 'user' ? 'user' : 'system',
    content: typeof doc?.content === 'string' ? doc.content : '',
    has_chat_ended: Boolean(doc?.has_chat_ended),
    createdAt: typeof doc?.createdAt === 'string' && doc.createdAt ? doc.createdAt : new Date().toISOString()
  };
}

export async function listStoredMessengerMessages(sessionId, sceneId) {
  const store = await readStore();
  const key = normalizeConversationKey(sessionId, sceneId);
  const messages = Array.isArray(store.conversations[key]) ? store.conversations[key] : [];
  return sortMessages(messages).map((message) => normalizeStoredMessage(message, sessionId, sceneId));
}

export async function findStoredMessengerMessage(sessionId, sceneId, predicate) {
  const messages = await listStoredMessengerMessages(sessionId, sceneId);
  return messages.find(predicate) || null;
}

export async function appendStoredMessengerMessage(sessionId, sceneId, doc) {
  const store = await readStore();
  const key = normalizeConversationKey(sessionId, sceneId);
  const nextMessage = normalizeStoredMessage(doc, sessionId, sceneId);
  const messages = Array.isArray(store.conversations[key]) ? store.conversations[key] : [];
  store.conversations[key] = sortMessages([...messages, nextMessage]);
  await writeStore(store);
  return nextMessage;
}

export async function deleteStoredMessengerConversation(sessionId, sceneId) {
  const store = await readStore();
  const key = normalizeConversationKey(sessionId, sceneId);
  const current = Array.isArray(store.conversations[key]) ? store.conversations[key] : [];
  delete store.conversations[key];
  await writeStore(store);
  return current.length;
}

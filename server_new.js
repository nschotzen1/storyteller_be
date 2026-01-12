import express from 'express';
import cors from 'cors';
import path from 'path';
import { randomUUID } from 'crypto';
import { BrewRoom } from './models/brewing_models.js';
import { directExternalApiCall } from './ai/openai/apiService.js';
import { Storyteller } from './models/models.js';
import {
  generateStoryTellerForFragmentPrompt,
  generateSendStorytellerToEntityPrompt,
  createStoryTellerKey,
  createStorytellerIllustration
} from './services/storytellerService.js';
import { NarrativeEntity } from './storyteller/utils.js';
import { textToEntityFromText } from './services/textToEntityService.js';

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5001;
const ASSETS_ROOT = path.resolve(process.cwd(), 'assets');

app.use('/assets', express.static(ASSETS_ROOT));

const MOCK_STORYTELLER = {
  name: 'The Pass-Archivist of Yuradel',
  fragmentText: `it was getting dark. they have been going for almost 6 hours, no stop. none! she thought to herself. their morning began waking up at one of the empty halls in  the desolate monastery. it was the first nights in many, that they slept under any sort of roof, she much preferred ll the stern, straight pines. the empty halls made her shiver. she was so happy when they went back on the trail, up, climbing up, along the ravine, where the Yuradel was flowing to the Baruuya bay, like a glittering silver line. yes, they climbed up. to the pass. where they would finally reach the plateau. and maybe there the last monastery would still stand, and won't be desolate. where they finally might learn what happened, and what is to be expected.`,
  immediate_ghost_appearance:
    'A faint shimmer condenses into a travel-worn figure: wind-scoured cloak, pale hands stained with ink, edges of the body translucent like smoke in cold air.',
  voice_creation: {
    style: 'measured',
    voice: 'low, smoky, almost whispered',
    age: 'ageless'
  },
  influences: [
    'Ashen Cantos',
    'Voyager Myths'
  ]
};

// --- State Management ---
// Map<roomId, Set<Response>> for SSE clients (still needed for push)
const roomClients = new Map();

// --- Constants ---
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// --- Helpers ---
function generateRoomId() {
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return result;
}

function broadcastToRoom(roomId, eventName, payload) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const data = JSON.stringify({ type: eventName, payload });
  const message = `data: ${data}\n\n`;

  for (const client of clients) {
    client.write(message);
  }
}

function sanitizeRoomForPublic(room) {
  // room is a Mongoose document. Convert to object.
  const clone = room.toObject ? room.toObject() : JSON.parse(JSON.stringify(room));
  if (clone.brew && clone.brew.vials) {
    clone.brew.vials.forEach(v => {
      delete v.privateIngredient;
    });
  }
  return clone;
}

function getFragmentText(body) {
  return body?.text || body?.userText || body?.fragment || '';
}

function buildLastMissionSummary(storyteller) {
  const missions = Array.isArray(storyteller?.missions) ? storyteller.missions : [];
  if (missions.length === 0) {
    return null;
  }
  const last = missions[missions.length - 1];
  return {
    outcome: last.outcome,
    message: last.message,
    entityExternalId: last.entityExternalId,
    createdAt: last.createdAt
  };
}

function normalizeStorytellerCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) {
    return 3;
  }
  return Math.min(Math.max(1, Math.floor(count)), 10);
}

function buildMockStorytellers(count, fragmentText) {
  const baseStoryteller = {
    ...MOCK_STORYTELLER,
    fragmentText: MOCK_STORYTELLER.fragmentText || fragmentText
  };

  const fallbackStorytellers = Array.from({ length: Math.max(0, count - 1) }).map((_, idx) => ({
    name: `Mock Storyteller ${idx + 1}`,
    immediate_ghost_appearance: 'A soft shimmer resolves into a figure with ink-stained hands.',
    typewriter_key: {
      symbol: 'ink moth',
      description: 'A tarnished brass key with a faint glow.'
    },
    influences: ['Ashen Cantos', 'Voyager Myths'],
    known_universes: ['The Riven Orrery'],
    level: 5 + idx,
    voice_creation: {
      voice: 'neutral',
      age: 'ageless',
      style: 'measured and smoky'
    },
    fragmentText
  }));

  return [baseStoryteller, ...fallbackStorytellers].slice(0, count);
}

async function findEntityById(sessionId, playerId, entityId) {
  if (!entityId) {
    return null;
  }

  const byExternalId = await NarrativeEntity.findOne({
    session_id: sessionId,
    playerId,
    externalId: String(entityId)
  });
  if (byExternalId) {
    return byExternalId;
  }

  return NarrativeEntity.findOne({ _id: entityId, session_id: sessionId, playerId });
}

// --- Routes ---

// List Storytellers
app.get('/api/storytellers', async (req, res) => {
  try {
    const { sessionId, playerId } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const storytellers = await Storyteller.find({ session_id: sessionId, playerId }).sort({ createdAt: 1 });
    const response = storytellers.map((storyteller) => ({
      id: storyteller._id,
      name: storyteller.name,
      status: storyteller.status,
      level: storyteller.level,
      lastMission: buildLastMissionSummary(storyteller)
    }));

    return res.status(200).json({ sessionId, storytellers: response });
  } catch (error) {
    console.error('Error in /api/storytellers:', error);
    return res.status(500).json({ message: 'Server error during storyteller listing.' });
  }
});

// Get Storyteller by ID
app.get('/api/storytellers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, playerId } = req.query;

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }
    const storyteller = await Storyteller.findById(id);
    if (!storyteller) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }
    if (storyteller.session_id !== sessionId || storyteller.playerId !== playerId) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }

    return res.status(200).json({ storyteller });
  } catch (error) {
    console.error('Error in /api/storytellers/:id:', error);
    return res.status(500).json({ message: 'Server error during storyteller fetch.' });
  }
});

// List Entities
app.get('/api/entities', async (req, res) => {
  try {
    const { sessionId, playerId, mainEntityId, isSubEntity } = req.query;
    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const query = { session_id: sessionId, playerId };
    if (mainEntityId) {
      query.mainEntityId = mainEntityId;
    }
    if (isSubEntity !== undefined) {
      query.isSubEntity = String(isSubEntity) === 'true';
    }

    const entities = await NarrativeEntity.find(query).sort({ createdAt: 1 });
    return res.status(200).json({ sessionId, entities });
  } catch (error) {
    console.error('Error in /api/entities:', error);
    return res.status(500).json({ message: 'Server error during entity listing.' });
  }
});

// Refresh Entity (Generate Sub-Entities)
app.post('/api/entities/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    const { sessionId, playerId, note, debug, mock } = req.body;

    if (!sessionId || !playerId) {
      return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
    }

    const entity = await findEntityById(sessionId, playerId, id);
    if (!entity || entity.session_id !== sessionId || entity.playerId !== playerId) {
      return res.status(404).json({ message: 'Entity not found.' });
    }

    const promptText = [
      `Expand sub-entities related to "${entity.name}".`,
      entity.description ? `Description: ${entity.description}` : '',
      entity.lore ? `Lore: ${entity.lore}` : '',
      note ? `GM note: ${note}` : ''
    ].filter(Boolean).join('\n');

    const shouldMock = Boolean(debug || mock);
    const subEntityResult = await textToEntityFromText({
      sessionId,
      playerId,
      text: promptText,
      includeCards: false,
      debug: shouldMock,
      mainEntityId: entity.externalId || String(entity._id),
      isSubEntity: true
    });

    const subEntityExternalIds = (subEntityResult?.entities || [])
      .map((subEntity) => subEntity.externalId || subEntity.id)
      .filter(Boolean)
      .map((value) => String(value));

    const savedSubEntities = subEntityExternalIds.length
      ? await NarrativeEntity.find({
        session_id: sessionId,
        playerId,
        externalId: { $in: subEntityExternalIds },
        mainEntityId: entity.externalId || String(entity._id)
      })
      : [];

    return res.status(200).json({
      sessionId,
      entity,
      subEntities: savedSubEntities,
      mocked: shouldMock
    });
  } catch (error) {
    console.error('Error in /api/entities/:id/refresh:', error);
    return res.status(500).json({ message: 'Server error during entity refresh.' });
  }
});

// Text to Entity
app.post('/api/textToEntity', async (req, res) => {
  try {
    const {
      sessionId,
      playerId,
      text,
      userText,
      fragment,
      includeCards,
      includeFront,
      includeBack,
      debug,
      mock
    } = req.body;

    const fragmentText = text || userText || fragment;

    if (!sessionId || !playerId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, or text.' });
    }

    const shouldMock = Boolean(debug || mock);
    const options = {
      sessionId,
      playerId,
      text: fragmentText,
      includeCards: includeCards === undefined ? false : Boolean(includeCards),
      includeFront: includeFront === undefined ? true : Boolean(includeFront),
      includeBack: includeBack === undefined ? true : Boolean(includeBack),
      debug: shouldMock
    };

    const result = await textToEntityFromText(options);

    const response = {
      sessionId,
      entities: result.entities,
      mocked: result.mocked
    };

    if (options.includeCards) {
      response.cards = result.cards || [];
      response.cardOptions = {
        includeFront: options.includeFront,
        includeBack: options.includeBack
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error in /api/textToEntity:', error);
    res.status(500).json({ message: 'Server error during text-to-entity generation.' });
  }
});

// Text to Storyteller
app.post('/api/textToStoryteller', async (req, res) => {
  try {
    const { sessionId, playerId, count, numberOfStorytellers, generateKeyImages, mockImage, debug, mock } = req.body;
    const fragmentText = getFragmentText(req.body);

    if (!sessionId || !playerId || !fragmentText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, or text.' });
    }

    const storytellerCount = normalizeStorytellerCount(count ?? numberOfStorytellers);
    const shouldMock = Boolean(debug || mock);
    let storytellerDataArray;

    if (shouldMock) {
      storytellerDataArray = buildMockStorytellers(storytellerCount, fragmentText);
    } else {
      const prompt = generateStoryTellerForFragmentPrompt(fragmentText, storytellerCount);
      storytellerDataArray = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        2500,
        undefined,
        undefined,
        true,
        true
      );
    }

    if (!Array.isArray(storytellerDataArray) || storytellerDataArray.length === 0) {
      return res.status(502).json({ message: 'Storyteller generation failed.' });
    }

    const savedStorytellers = [];
    const keyImages = [];

    for (const storytellerData of storytellerDataArray) {
      if (!storytellerData || typeof storytellerData !== 'object') {
        continue;
      }

      const payload = {
        session_id: sessionId,
        sessionId,
        playerId,
        fragmentText,
        ...storytellerData
      };

      const savedStoryteller = await Storyteller.findOneAndUpdate(
        { session_id: sessionId, playerId, name: payload.name },
        payload,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      savedStorytellers.push(savedStoryteller);

      if (generateKeyImages && payload.typewriter_key?.symbol) {
        const keyImageResult = await createStoryTellerKey(
          payload.typewriter_key,
          sessionId,
          payload.name,
          Boolean(mockImage)
        );
        if (keyImageResult?.localPath) {
          const localUrl = `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_keys/${path.basename(keyImageResult.localPath)}`;
          keyImages.push({
            storytellerId: savedStoryteller._id,
            name: savedStoryteller.name,
            imageUrl: keyImageResult.imageUrl || localUrl,
            localUrl,
            localPath: keyImageResult.localPath
          });
        }
      }

      // Generate Illustration
      const illustrationResult = await createStorytellerIllustration(
        payload,
        sessionId,
        Boolean(mockImage)
      );

      if (illustrationResult?.localPath) {
        const illustrationUrl = `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_illustrations/${path.basename(illustrationResult.localPath)}`;

        await Storyteller.findByIdAndUpdate(savedStoryteller._id, {
          illustration: illustrationUrl
        });

        // Update the object in the list for response
        savedStoryteller.illustration = illustrationUrl;
      }
    }

    res.status(200).json({
      sessionId,
      storytellers: savedStorytellers,
      keyImages,
      count: savedStorytellers.length
    });
  } catch (err) {
    console.error('Error in /api/textToStoryteller:', err);
    res.status(500).json({ message: 'Server error during storyteller generation.' });
  }
});

// Send Storyteller to Entity
app.post('/api/sendStorytellerToEntity', async (req, res) => {
  try {
    const {
      sessionId,
      playerId,
      entityId,
      storytellerId,
      storytellingPoints,
      message,
      duration,
      debug,
      mock
    } = req.body;

    if (!sessionId || !playerId || !entityId || !storytellerId) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, entityId, storytellerId.' });
    }
    if (!Number.isInteger(storytellingPoints)) {
      return res.status(400).json({ message: 'Missing or invalid storytellingPoints (int required).' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid message (string required).' });
    }

    const entity = await findEntityById(sessionId, playerId, entityId);
    if (!entity || entity.session_id !== sessionId || entity.playerId !== playerId) {
      return res.status(404).json({ message: 'Entity not found.' });
    }

    let storyteller = await Storyteller.findById(storytellerId);
    if (!storyteller) {
      storyteller = await Storyteller.findOne({ name: storytellerId, session_id: sessionId, playerId });
    }
    if (!storyteller || storyteller.session_id !== sessionId || storyteller.playerId !== playerId) {
      return res.status(404).json({ message: 'Storyteller not found.' });
    }

    const shouldMock = Boolean(debug || mock);
    const durationDays = Number.isFinite(Number(duration)) ? Number(duration) : undefined;

    await Storyteller.findByIdAndUpdate(
      storyteller._id,
      { $set: { status: 'in_mission' } }
    );

    let missionResult;
    if (shouldMock) {
      missionResult = {
        outcome: 'success',
        userText: `The mission concludes. ${storyteller.name} returns with a focused insight about ${entity.name}.`,
        gmNote: `Lean into the sensory details of ${entity.name}; highlight a single, striking detail that hints at hidden layers.`,
        subEntitySeed: `New sub-entities emerge around ${entity.name}: a revealing clue, a minor witness, and a tangible relic tied to the mission.`
      };
    } else {
      const prompt = generateSendStorytellerToEntityPrompt({
        storyteller,
        entity,
        storytellingPoints,
        message,
        durationDays
      });
      missionResult = await directExternalApiCall(
        [{ role: 'system', content: prompt }],
        1200,
        undefined,
        undefined,
        true,
        true
      );
    }

    const outcome = missionResult?.outcome;
    const userText = missionResult?.userText || '';
    const gmNote = missionResult?.gmNote || '';
    const subEntitySeed = missionResult?.subEntitySeed || `Sub-entities tied to ${entity.name} and ${message}.`;

    const subEntityResult = await textToEntityFromText({
      sessionId,
      playerId,
      text: subEntitySeed,
      includeCards: false,
      debug: shouldMock,
      mainEntityId: entity.externalId || String(entity._id),
      isSubEntity: true
    });

    const subEntities = Array.isArray(subEntityResult?.entities) ? subEntityResult.entities : [];
    const subEntityExternalIds = subEntities
      .map((subEntity) => subEntity.externalId || subEntity.id)
      .filter(Boolean)
      .map((id) => String(id));
    const savedSubEntities = subEntityExternalIds.length
      ? await NarrativeEntity.find({
        session_id: sessionId,
        playerId,
        externalId: { $in: subEntityExternalIds },
        mainEntityId: entity.externalId || String(entity._id)
      })
      : [];
    const missionRecord = {
      entityId: entity._id,
      entityExternalId: entity.externalId || String(entity._id),
      playerId,
      storytellingPoints,
      message,
      durationDays,
      outcome: outcome || 'pending',
      userText: userText || undefined,
      gmNote: gmNote || undefined,
      subEntityExternalIds: savedSubEntities.map((subEntity) => subEntity.externalId).filter(Boolean)
    };

    await Storyteller.findByIdAndUpdate(
      storyteller._id,
      {
        $set: { status: 'active' },
        $push: { missions: missionRecord }
      },
      { new: true }
    );

    return res.status(200).json({
      sessionId,
      storytellerId: storyteller._id,
      outcome: missionRecord.outcome,
      userText: userText || undefined,
      gmNote: gmNote || undefined,
      entity,
      subEntities: savedSubEntities
    });
  } catch (err) {
    console.error('Error in /api/sendStorytellerToEntity:', err);
    return res.status(500).json({ message: 'Server error during storyteller mission.' });
  }
});

// 1. Create Room
app.post('/api/brewing/rooms', async (req, res) => {
  try {
    const roomId = generateRoomId();
    // Need to handle strict uniqueness in production loop, but simple here
    const newRoom = new BrewRoom({ roomId });
    await newRoom.save();
    console.log(`[Room Created] ${roomId}`);
    res.json({ roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// 2. Get Room
app.get('/api/brewing/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await BrewRoom.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(sanitizeRoomForPublic(room));
  } catch (err) {
    res.status(500).json({ error: 'Server fatal' });
  }
});

// 3. Join Room
app.post('/api/brewing/rooms/:roomId/join', async (req, res) => {
  const { roomId } = req.params;
  const { maskId, displayName } = req.body;

  try {
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const playerId = randomUUID();
    const newPlayer = {
      playerId,
      maskId: maskId || 'unknown',
      maskName: displayName || `Mask ${maskId}`,
      displayName,
      status: 'not_ready',
      isBot: false
    };

    room.players.push(newPlayer);
    await room.save();

    broadcastToRoom(roomId, 'PLAYER_JOINED', { player: newPlayer, roomState: sanitizeRoomForPublic(room) });

    res.json({ playerId, roomState: sanitizeRoomForPublic(room) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Join failed' });
  }
});

// 4. Toggle Ready
app.post('/api/brewing/rooms/:roomId/players/:playerId/ready', async (req, res) => {
  const { roomId, playerId } = req.params;
  const { ready } = req.body;

  try {
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const player = room.players.find(p => p.playerId === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found' });

    player.status = ready ? 'ready' : 'not_ready';
    await room.save(); // Mongoose subdoc update

    broadcastToRoom(roomId, 'PLAYER_READY_CHANGED', {
      playerId,
      status: player.status,
      roomState: sanitizeRoomForPublic(room)
    });

    res.json(sanitizeRoomForPublic(room));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ready failed' });
  }
});

// 5. Start Brew (Host)
app.post('/api/brewing/rooms/:roomId/start', async (req, res) => {
  const { roomId } = req.params;

  try {
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.players.length === 0) return res.status(400).json({ error: 'No players' });

    room.phase = 'brewing';
    room.players.forEach(p => p.status = 'active');

    // Setup First Turn
    room.turn.activePlayerId = room.players[0].playerId;
    room.turn.round = 1;
    room.turn.index = 0;

    await room.save();

    broadcastToRoom(roomId, 'PHASE_CHANGED', { phase: 'brewing', roomState: sanitizeRoomForPublic(room) });
    broadcastToRoom(roomId, 'TURN_STARTED', { turn: room.turn });

    res.json(sanitizeRoomForPublic(room));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Start failed' });
  }
});

// 6. Submit Ingredient (Active Player)
app.post('/api/brewing/rooms/:roomId/turn/submit', async (req, res) => {
  const { roomId } = req.params;
  const activePlayerId = req.header('x-player-id');
  const { ingredient } = req.body;

  try {
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (room.turn.activePlayerId !== activePlayerId) {
      return res.status(403).json({ error: 'Not your turn' });
    }

    broadcastToRoom(roomId, 'INGREDIENT_ACCEPTED', { playerId: activePlayerId, text: ingredient });

    res.json({ ok: true });

    // Trigger Async Logic
    handleBrewmasterTurn(roomId, activePlayerId, ingredient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submit failed' });
  }
});

async function handleBrewmasterTurn(roomId, playerId, ingredient) {
  console.log(`[Brewmaster] Processing ingredient '${ingredient}' from ${playerId} in ${roomId}...`);

  await new Promise(r => setTimeout(r, 3000));

  try {
    // Re-fetch room to avoid race conditions (naive lock)
    const room = await BrewRoom.findOne({ roomId });
    if (!room) return;

    const vialId = randomUUID();
    const newVial = {
      id: vialId,
      title: `Essence of ${ingredient}`,
      containerDescription: "A twisted glass bottle emitting faint smoke.",
      substanceDescription: `A glowing liquid derived from ${ingredient}.`,
      pourEffect: "The universe shudders slightly.",
      timestamp: Date.now(),
      addedByMaskId: room.players.find(p => p.playerId === playerId)?.maskId || 'unknown',
      privateIngredient: ingredient
    };

    room.brew.vials.push(newVial);

    room.brew.summaryLines.push(`Someone added ${ingredient} to the mix.`);
    if (room.brew.summaryLines.length > 3) room.brew.summaryLines.shift();

    // Broadcast VIAL_REVEALED
    const publicVial = { ...newVial };
    delete publicVial.privateIngredient;

    broadcastToRoom(roomId, 'VIAL_REVEALED', { vial: publicVial });
    broadcastToRoom(roomId, 'BREW_SUMMARY_UPDATED', { summaryLines: room.brew.summaryLines });

    // Advance Turn
    const currentPlayerIdx = room.players.findIndex(p => p.playerId === room.turn.activePlayerId);
    const nextPlayerIdx = (currentPlayerIdx + 1) % room.players.length;
    room.turn.activePlayerId = room.players[nextPlayerIdx].playerId;
    room.turn.index++;

    if (nextPlayerIdx === 0) {
      room.turn.round++;
    }

    if (room.turn.round > room.turn.totalRounds) {
      room.phase = 'complete';
      broadcastToRoom(roomId, 'BREW_COMPLETED', { brew: room.brew });
    } else {
      broadcastToRoom(roomId, 'TURN_ENDED', {});
      broadcastToRoom(roomId, 'TURN_STARTED', { turn: room.turn });
    }

    await room.save();

  } catch (err) {
    console.error("Brewmaster error:", err);
  }
}

// --- Real-time Events (SSE) ---
app.get('/api/brewing/events', (req, res) => {
  const { roomId } = req.query;

  // Note: We don't necessarily check DB *existence* strictly here on connection 
  // to save a read, but arguably we should.

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  if (!roomClients.has(roomId)) {
    roomClients.set(roomId, new Set());
  }
  roomClients.get(roomId).add(res);

  console.log(`[SSE] Client connected to room ${roomId}`);

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', payload: { roomId } })}\n\n`);

  req.on('close', () => {
    console.log(`[SSE] Client disconnected from room ${roomId}`);
    const clients = roomClients.get(roomId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        roomClients.delete(roomId);
      }
    }
  });
});


if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Multiplayer Universe Brewing Server running on port ${PORT}`);
  });
}

export { app };

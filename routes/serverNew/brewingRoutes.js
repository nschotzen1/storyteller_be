export function registerBrewingRoutes(app, deps) {
  const {
    BrewRoom,
    randomUUID,
    generateRoomId,
    sanitizeRoomForPublic,
    broadcastToRoom,
    roomClients
  } = deps;

  async function handleBrewmasterTurn(roomId, playerId, ingredient) {
    console.log(`[Brewmaster] Processing ingredient '${ingredient}' from ${playerId} in ${roomId}...`);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const room = await BrewRoom.findOne({ roomId });
      if (!room) return;

      const vialId = randomUUID();
      const newVial = {
        id: vialId,
        title: `Essence of ${ingredient}`,
        containerDescription: 'A twisted glass bottle emitting faint smoke.',
        substanceDescription: `A glowing liquid derived from ${ingredient}.`,
        pourEffect: 'The universe shudders slightly.',
        timestamp: Date.now(),
        addedByMaskId: room.players.find((player) => player.playerId === playerId)?.maskId || 'unknown',
        privateIngredient: ingredient
      };

      room.brew.vials.push(newVial);

      room.brew.summaryLines.push(`Someone added ${ingredient} to the mix.`);
      if (room.brew.summaryLines.length > 3) room.brew.summaryLines.shift();

      const publicVial = { ...newVial };
      delete publicVial.privateIngredient;

      broadcastToRoom(roomId, 'VIAL_REVEALED', { vial: publicVial });
      broadcastToRoom(roomId, 'BREW_SUMMARY_UPDATED', { summaryLines: room.brew.summaryLines });

      const currentPlayerIdx = room.players.findIndex((player) => player.playerId === room.turn.activePlayerId);
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
      console.error('Brewmaster error:', err);
    }
  }

  app.post('/api/brewing/rooms', async (_req, res) => {
    try {
      const roomId = generateRoomId();
      const newRoom = new BrewRoom({ roomId });
      await newRoom.save();
      console.log(`[Room Created] ${roomId}`);
      res.json({ roomId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  app.get('/api/brewing/rooms/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await BrewRoom.findOne({ roomId });
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json(sanitizeRoomForPublic(room));
    } catch (_err) {
      res.status(500).json({ error: 'Server fatal' });
    }
  });

  app.post('/api/brewing/rooms/:roomId/join', async (req, res) => {
    const { roomId } = req.params;
    const body = req.body || {};
    const rawMaskId = typeof body.maskId === 'string' ? body.maskId.trim() : '';
    const rawDisplayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const maskId = rawMaskId || 'unknown';
    const displayName = rawDisplayName || `Mask ${maskId}`;

    try {
      const room = await BrewRoom.findOne({ roomId });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const playerId = randomUUID();
      const newPlayer = {
        playerId,
        maskId,
        maskName: displayName,
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

  app.post('/api/brewing/rooms/:roomId/players/:playerId/ready', async (req, res) => {
    const { roomId, playerId } = req.params;
    const body = req.body || {};
    const { ready } = body;

    try {
      if (typeof ready !== 'boolean') {
        return res.status(400).json({ error: 'ready must be a boolean' });
      }

      const room = await BrewRoom.findOne({ roomId });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      const player = room.players.find((item) => item.playerId === playerId);
      if (!player) return res.status(404).json({ error: 'Player not found' });

      player.status = ready ? 'ready' : 'not_ready';
      await room.save();

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

  app.post('/api/brewing/rooms/:roomId/start', async (req, res) => {
    const { roomId } = req.params;

    try {
      const room = await BrewRoom.findOne({ roomId });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      if (room.players.length === 0) return res.status(400).json({ error: 'No players' });

      room.phase = 'brewing';
      room.players.forEach((player) => {
        player.status = 'active';
      });

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

  app.post('/api/brewing/rooms/:roomId/turn/submit', async (req, res) => {
    const { roomId } = req.params;
    const activePlayerId = req.header('x-player-id');
    const body = req.body || {};
    const ingredient = typeof body.ingredient === 'string' ? body.ingredient.trim() : '';

    try {
      if (!activePlayerId || typeof activePlayerId !== 'string') {
        return res.status(400).json({ error: 'x-player-id header is required' });
      }

      const room = await BrewRoom.findOne({ roomId });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      if (!ingredient) {
        return res.status(400).json({ error: 'Ingredient is required' });
      }

      if (room.turn.activePlayerId !== activePlayerId) {
        return res.status(403).json({ error: 'Not your turn' });
      }

      broadcastToRoom(roomId, 'INGREDIENT_ACCEPTED', { playerId: activePlayerId, text: ingredient });

      res.json({ ok: true });

      handleBrewmasterTurn(roomId, activePlayerId, ingredient);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Submit failed' });
    }
  });

  app.get('/api/brewing/events', (req, res) => {
    const { roomId } = req.query;

    if (!roomId || typeof roomId !== 'string') {
      return res.status(400).json({ error: 'roomId is required' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
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
}

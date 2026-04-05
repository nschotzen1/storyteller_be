export function registerSessionWorldRoutes(app, deps) {
  const {
    randomUUID,
    SessionPlayer,
    Arena,
    normalizeArenaPayload,
    World,
    findWorldForPlayer,
    WorldElement,
    getRouteConfig,
    renderPrompt,
    directExternalApiCall,
    validatePayloadForRoute,
    buildMockWorld,
    buildMockElements,
    resolveSchemaErrorMessage,
    sendLlmAwareError
  } = deps;

  async function handleWorldElements(req, res, type) {
    try {
      const { worldId } = req.params;
      const { sessionId, playerId, count, seedText, debug, mock, mock_api_calls, mocked_api_calls } = req.body || {};

      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
      }

      const world = await findWorldForPlayer(sessionId, playerId, worldId);
      if (!world) {
        return res.status(404).json({ message: 'World not found.' });
      }

      const requestedCount = Number.isFinite(Number(count)) ? Math.max(1, Math.min(6, Number(count))) : 3;
      const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
      let elementsData;

      if (shouldMock) {
        elementsData = buildMockElements(type, requestedCount);
      } else {
        const routeConfig = await getRouteConfig('worlds_elements');
        const prompt = renderPrompt(routeConfig.promptTemplate, {
          worldName: world.name || '',
          worldTone: world.tone || '',
          worldSummary: world.summary || '',
          seedText: seedText || world.seedText || '',
          elementType: type,
          count: requestedCount
        });
        const result = await directExternalApiCall(
          [{ role: 'system', content: prompt }],
          1400,
          undefined,
          undefined,
          true,
          true
        );
        elementsData = Array.isArray(result) ? result : result?.elements;
      }

      if (!Array.isArray(elementsData) || elementsData.length === 0) {
        return res.status(502).json({ message: 'World element generation failed.' });
      }

      await validatePayloadForRoute('worlds_elements', { elements: elementsData });

      const payloads = elementsData.slice(0, requestedCount).map((element) => ({
        worldId,
        sessionId,
        playerId,
        type,
        name: element?.name || `${type} ${randomUUID().slice(0, 4)}`,
        description: element?.description || '',
        tags: Array.isArray(element?.tags) ? element.tags : [],
        traits: Array.isArray(element?.traits) ? element.traits : [],
        hooks: Array.isArray(element?.hooks) ? element.hooks : []
      }));

      const saved = await WorldElement.insertMany(payloads);

      return res.status(201).json({ worldId, type, elements: saved, mocked: shouldMock });
    } catch (error) {
      if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
        return res.status(502).json({
          message: resolveSchemaErrorMessage(error, 'World elements schema validation failed.')
        });
      }
      console.error(`Error in /api/worlds/:worldId/${type}:`, error);
      return sendLlmAwareError(res, error, 'Server error during world element generation.');
    }
  }

  app.get('/api/sessions/:sessionId/players', async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const players = await SessionPlayer.find({ sessionId }).sort({ createdAt: 1 }).lean();
      const responsePlayers = players.map((player) => ({
        id: player.playerId,
        playerId: player.playerId,
        playerName: player.playerName
      }));

      return res.status(200).json({
        count: responsePlayers.length,
        players: responsePlayers
      });
    } catch (error) {
      console.error('Error in /api/sessions/:sessionId/players:', error);
      return res.status(500).json({ message: 'Server error during session player listing.' });
    }
  });

  app.post('/api/sessions/:sessionId/players', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { playerName } = req.body || {};

      if (!sessionId || !playerName || typeof playerName !== 'string') {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerName.' });
      }

      const playerId = randomUUID();
      const newPlayer = new SessionPlayer({ sessionId, playerId, playerName });
      await newPlayer.save();

      return res.status(201).json({ playerId, id: playerId });
    } catch (error) {
      console.error('Error in /api/sessions/:sessionId/players (POST):', error);
      return res.status(500).json({ message: 'Server error during session player registration.' });
    }
  });

  app.get('/api/sessions/:sessionId/arena', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { playerId } = req.query;

      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
      }

      const arenaDoc = await Arena.findOne({ sessionId }).lean();
      const arena = normalizeArenaPayload(arenaDoc?.arena);

      return res.status(200).json({
        sessionId,
        playerId,
        arena,
        lastUpdatedBy: arenaDoc?.lastUpdatedBy,
        updatedAt: arenaDoc?.updatedAt
      });
    } catch (error) {
      console.error('Error in /api/sessions/:sessionId/arena (GET):', error);
      return res.status(500).json({ message: 'Server error during arena fetch.' });
    }
  });

  app.post('/api/sessions/:sessionId/arena', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { playerId } = req.body || {};

      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId or playerId.' });
      }

      const body = req.body || {};
      const arenaPayload = body.arena || { entities: body.entities, storytellers: body.storytellers };
      const arena = normalizeArenaPayload(arenaPayload);

      const updatedArena = await Arena.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            arena,
            lastUpdatedBy: playerId
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({
        sessionId,
        playerId,
        arena: normalizeArenaPayload(updatedArena?.arena),
        lastUpdatedBy: updatedArena?.lastUpdatedBy,
        updatedAt: updatedArena?.updatedAt
      });
    } catch (error) {
      console.error('Error in /api/sessions/:sessionId/arena (POST):', error);
      return res.status(500).json({ message: 'Server error during arena update.' });
    }
  });

  app.post('/api/worlds', async (req, res) => {
    try {
      const { sessionId, playerId, seedText, name, debug, mock, mock_api_calls, mocked_api_calls } = req.body || {};

      if (!sessionId || !playerId || !seedText) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId, playerId, or seedText.' });
      }

      const shouldMock = Boolean(debug || mock || mock_api_calls || mocked_api_calls);
      let worldData;

      if (shouldMock) {
        worldData = buildMockWorld(seedText, name);
      } else {
        const routeConfig = await getRouteConfig('worlds_create');
        const prompt = renderPrompt(routeConfig.promptTemplate, {
          seedText,
          name: name || ''
        });
        worldData = await directExternalApiCall(
          [{ role: 'system', content: prompt }],
          1200,
          undefined,
          undefined,
          true,
          true
        );
      }

      if (!worldData || typeof worldData !== 'object') {
        return res.status(502).json({ message: 'World generation failed.' });
      }

      await validatePayloadForRoute('worlds_create', worldData);

      const world = await World.create({
        worldId: randomUUID(),
        sessionId,
        playerId,
        seedText,
        name: worldData.name || name || 'Untitled World',
        summary: worldData.summary || '',
        tone: worldData.tone || '',
        pillars: Array.isArray(worldData.pillars) ? worldData.pillars : [],
        themes: Array.isArray(worldData.themes) ? worldData.themes : [],
        palette: Array.isArray(worldData.palette) ? worldData.palette : []
      });

      return res.status(201).json({ world, mocked: shouldMock });
    } catch (error) {
      if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
        return res.status(502).json({
          message: resolveSchemaErrorMessage(error, 'World generation schema validation failed.')
        });
      }
      console.error('Error in /api/worlds:', error);
      return sendLlmAwareError(res, error, 'Server error during world creation.');
    }
  });

  app.get('/api/worlds', async (req, res) => {
    try {
      const { sessionId, playerId } = req.query;
      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
      }

      const worlds = await World.find({ sessionId, playerId }).sort({ createdAt: 1 });
      return res.status(200).json({ sessionId, worlds });
    } catch (error) {
      console.error('Error in /api/worlds (GET):', error);
      return res.status(500).json({ message: 'Server error during world listing.' });
    }
  });

  app.get('/api/worlds/:worldId', async (req, res) => {
    try {
      const { worldId } = req.params;
      const { sessionId, playerId } = req.query;
      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
      }

      const world = await findWorldForPlayer(sessionId, playerId, worldId);
      if (!world) {
        return res.status(404).json({ message: 'World not found.' });
      }

      return res.status(200).json({ world });
    } catch (error) {
      console.error('Error in /api/worlds/:worldId (GET):', error);
      return res.status(500).json({ message: 'Server error during world fetch.' });
    }
  });

  app.get('/api/worlds/:worldId/state', async (req, res) => {
    try {
      const { worldId } = req.params;
      const { sessionId, playerId } = req.query;
      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
      }

      const world = await findWorldForPlayer(sessionId, playerId, worldId);
      if (!world) {
        return res.status(404).json({ message: 'World not found.' });
      }

      const elements = await WorldElement.find({ worldId, sessionId, playerId }).sort({ createdAt: 1 });
      const grouped = elements.reduce((acc, element) => {
        acc[element.type] = acc[element.type] || [];
        acc[element.type].push(element);
        return acc;
      }, {});

      return res.status(200).json({ world, elements: grouped });
    } catch (error) {
      console.error('Error in /api/worlds/:worldId/state:', error);
      return res.status(500).json({ message: 'Server error during world state fetch.' });
    }
  });

  app.post('/api/worlds/:worldId/factions', (req, res) => handleWorldElements(req, res, 'faction'));
  app.post('/api/worlds/:worldId/locations', (req, res) => handleWorldElements(req, res, 'location'));
  app.post('/api/worlds/:worldId/rumors', (req, res) => handleWorldElements(req, res, 'rumor'));
  app.post('/api/worlds/:worldId/lore', (req, res) => handleWorldElements(req, res, 'lore'));
}

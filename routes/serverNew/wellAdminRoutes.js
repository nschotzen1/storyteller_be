export function registerWellAdminRoutes(app, deps) {
  const {
    requireAdmin,
    loadWellSceneConfig,
    startWellMemorySession,
    getWellMemorySession,
    drawNextWellTextualFragment,
    submitWellTextualJot,
    handoffWellMemorySession,
    getWellSceneConfigMeta,
    saveWellSceneConfig,
    resetWellSceneConfig,
    getTypewriterAiSettings,
    getTypewriterPipelineDefinitions,
    updateTypewriterAiSettings,
    resetTypewriterAiSettings,
    parseBooleanFlag,
    listAvailableOpenAiModels,
    listAvailableAnthropicModels,
    listLatestPromptTemplates,
    getCurrentTypewriterPromptTemplates,
    getTypewriterPromptDefinitions,
    seedCurrentTypewriterPromptTemplates,
    listPromptTemplateVersions,
    savePromptTemplateVersion,
    setLatestPromptTemplate,
    listRouteConfigs,
    getRouteConfig,
    listRouteConfigVersions,
    saveRouteConfigVersion,
    updateRoutePrompt,
    updateRouteSchema,
    setLatestRouteConfig,
    resetRouteConfig
  } = deps;

  app.post('/api/well/session/start', async (req, res) => {
    try {
      const config = await loadWellSceneConfig();
      const session = await startWellMemorySession({
        sessionId: req.body?.sessionId,
        playerId: req.body?.playerId,
        config
      });
      return res.status(200).json({ session });
    } catch (error) {
      console.error('Error in POST /api/well/session/start:', error);
      return res.status(500).json({ message: error.message || 'Server error while starting the well session.' });
    }
  });

  app.get('/api/well/session/:sessionId', async (req, res) => {
    try {
      const playerId = typeof req.query?.playerId === 'string' ? req.query.playerId : '';
      const session = await getWellMemorySession({
        sessionId: req.params.sessionId,
        playerId
      });
      if (!session) {
        return res.status(404).json({ message: 'Well session not found.' });
      }
      return res.status(200).json({ session });
    } catch (error) {
      console.error('Error in GET /api/well/session/:sessionId:', error);
      return res.status(500).json({ message: error.message || 'Server error while loading the well session.' });
    }
  });

  app.post('/api/well/session/next-fragment', async (req, res) => {
    try {
      const config = await loadWellSceneConfig();
      const session = await drawNextWellTextualFragment({
        sessionId: req.body?.sessionId,
        playerId: req.body?.playerId,
        config,
        replaceCurrent: Boolean(req.body?.replaceCurrent)
      });
      return res.status(200).json({ session });
    } catch (error) {
      console.error('Error in POST /api/well/session/next-fragment:', error);
      const status = error.code === 'EMPTY_TEXTUAL_BANK' ? 400 : 500;
      return res.status(status).json({ message: error.message || 'Server error while drawing the next fragment.' });
    }
  });

  app.post('/api/well/session/jot', async (req, res) => {
    try {
      const config = await loadWellSceneConfig();
      const session = await submitWellTextualJot({
        sessionId: req.body?.sessionId,
        playerId: req.body?.playerId,
        fragmentId: req.body?.fragmentId,
        rawJotText: req.body?.rawJotText,
        config
      });
      return res.status(200).json({ session });
    } catch (error) {
      console.error('Error in POST /api/well/session/jot:', error);
      const status = ['INVALID_SESSION_ID', 'INVALID_FRAGMENT_ID', 'INVALID_JOT_TEXT', 'FRAGMENT_MISMATCH'].includes(error.code)
        ? 400
        : error.code === 'SESSION_NOT_FOUND'
          ? 404
          : 500;
      return res.status(status).json({ message: error.message || 'Server error while saving the jot.' });
    }
  });

  app.post('/api/well/session/handoff', async (req, res) => {
    try {
      const config = await loadWellSceneConfig();
      const session = await handoffWellMemorySession({
        sessionId: req.body?.sessionId,
        playerId: req.body?.playerId,
        config
      });
      return res.status(200).json({ session });
    } catch (error) {
      console.error('Error in POST /api/well/session/handoff:', error);
      const status = error.code === 'HANDOFF_NOT_READY'
        ? 400
        : error.code === 'SESSION_NOT_FOUND'
          ? 404
          : 500;
      return res.status(status).json({ message: error.message || 'Server error while handing the bundle to the falcon.' });
    }
  });

  app.get('/api/well/config', async (_req, res) => {
    try {
      const config = await loadWellSceneConfig();
      return res.status(200).json({
        config,
        ...getWellSceneConfigMeta()
      });
    } catch (error) {
      console.error('Error in GET /api/well/config:', error);
      return res.status(500).json({ message: 'Server error while loading well config.' });
    }
  });

  app.put('/api/admin/well/config', requireAdmin, async (req, res) => {
    try {
      const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
        ? req.body.updatedBy.trim()
        : 'admin';
      const config = await saveWellSceneConfig(req.body, updatedBy);
      return res.status(200).json({
        config,
        ...getWellSceneConfigMeta()
      });
    } catch (error) {
      console.error('Error in PUT /api/admin/well/config:', error);
      return res.status(500).json({ message: 'Server error while saving well config.' });
    }
  });

  app.post('/api/admin/well/config/reset', requireAdmin, async (req, res) => {
    try {
      const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
        ? req.body.updatedBy.trim()
        : 'admin';
      const config = await resetWellSceneConfig(updatedBy);
      return res.status(200).json({
        config,
        ...getWellSceneConfigMeta()
      });
    } catch (error) {
      console.error('Error in POST /api/admin/well/config/reset:', error);
      return res.status(500).json({ message: 'Server error while resetting well config.' });
    }
  });

  app.get('/api/admin/typewriter/ai-settings', requireAdmin, async (_req, res) => {
    try {
      const settings = await getTypewriterAiSettings();
      return res.status(200).json({
        ...settings,
        pipelinesMeta: getTypewriterPipelineDefinitions()
      });
    } catch (error) {
      console.error('Error in GET /api/admin/typewriter/ai-settings:', error);
      return res.status(500).json({ message: 'Server error while loading typewriter AI settings.' });
    }
  });

  app.put('/api/admin/typewriter/ai-settings', requireAdmin, async (req, res) => {
    try {
      const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
        ? req.body.updatedBy.trim()
        : 'admin';
      const updated = await updateTypewriterAiSettings(req.body || {}, updatedBy);
      return res.status(200).json({
        ...updated,
        pipelinesMeta: getTypewriterPipelineDefinitions()
      });
    } catch (error) {
      if (error.code === 'INVALID_PIPELINE_KEY') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in PUT /api/admin/typewriter/ai-settings:', error);
      return res.status(500).json({ message: 'Server error while updating typewriter AI settings.' });
    }
  });

  app.post('/api/admin/typewriter/ai-settings/reset', requireAdmin, async (req, res) => {
    try {
      const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
        ? req.body.updatedBy.trim()
        : 'admin';
      const resetSettings = await resetTypewriterAiSettings(updatedBy);
      return res.status(200).json({
        ...resetSettings,
        pipelinesMeta: getTypewriterPipelineDefinitions()
      });
    } catch (error) {
      console.error('Error in POST /api/admin/typewriter/ai-settings/reset:', error);
      return res.status(500).json({ message: 'Server error while resetting typewriter AI settings.' });
    }
  });

  app.get('/api/admin/openai/models', requireAdmin, async (req, res) => {
    try {
      const forceRefresh = parseBooleanFlag(req.query?.forceRefresh) === true
        || parseBooleanFlag(req.query?.refresh) === true;
      const [openAiModelsPayload, anthropicModelsPayload] = await Promise.all([
        listAvailableOpenAiModels({ forceRefresh }),
        listAvailableAnthropicModels({ forceRefresh })
      ]);
      return res.status(200).json({
        ...openAiModelsPayload,
        providers: {
          openai: openAiModelsPayload,
          anthropic: anthropicModelsPayload
        }
      });
    } catch (error) {
      console.error('Error in GET /api/admin/openai/models:', error);
      return res.status(500).json({ message: 'Server error while loading OpenAI models.' });
    }
  });

  app.get('/api/admin/typewriter/prompts', requireAdmin, async (_req, res) => {
    try {
      const latest = await listLatestPromptTemplates();
      const currentTemplates = await getCurrentTypewriterPromptTemplates();
      const mergedPipelines = {};

      for (const [pipelineKey, definition] of Object.entries(currentTemplates)) {
        mergedPipelines[pipelineKey] = latest?.pipelines?.[pipelineKey] || {
          id: '',
          pipelineKey,
          version: 0,
          promptTemplate: definition.promptTemplate,
          isLatest: true,
          createdBy: 'code-default',
          createdAt: '',
          updatedAt: '',
          meta: {
            source: definition.source,
            variables: definition.variables,
            fallbackFromCode: true
          }
        };
      }

      return res.status(200).json({
        pipelines: mergedPipelines,
        pipelinesMeta: getTypewriterPromptDefinitions()
      });
    } catch (error) {
      console.error('Error in GET /api/admin/typewriter/prompts:', error);
      return res.status(500).json({ message: 'Server error while loading typewriter prompts.' });
    }
  });

  app.post('/api/admin/typewriter/prompts/seed-current', requireAdmin, async (req, res) => {
    try {
      const updatedBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
        ? req.body.updatedBy.trim()
        : 'admin';
      const overwrite = parseBooleanFlag(req.body?.overwrite) === true;
      const seeded = await seedCurrentTypewriterPromptTemplates({ updatedBy, overwrite });
      return res.status(200).json(seeded);
    } catch (error) {
      console.error('Error in POST /api/admin/typewriter/prompts/seed-current:', error);
      return res.status(500).json({ message: 'Server error while seeding current prompt templates.' });
    }
  });

  app.get('/api/admin/typewriter/prompts/:pipelineKey/versions', requireAdmin, async (req, res) => {
    try {
      const { pipelineKey } = req.params;
      const versions = await listPromptTemplateVersions(pipelineKey, req.query?.limit);
      if (versions.length === 0) {
        const currentTemplates = await getCurrentTypewriterPromptTemplates();
        const fallback = currentTemplates?.[pipelineKey];
        if (fallback) {
          return res.status(200).json({
            pipelineKey,
            versions: [
              {
                id: '',
                pipelineKey,
                version: 0,
                promptTemplate: fallback.promptTemplate,
                isLatest: true,
                createdBy: 'code-default',
                createdAt: '',
                updatedAt: '',
                meta: {
                  source: fallback.source,
                  variables: fallback.variables,
                  fallbackFromCode: true
                }
              }
            ]
          });
        }
      }
      return res.status(200).json({ pipelineKey, versions });
    } catch (error) {
      if (error.code === 'INVALID_PIPELINE_KEY') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in GET /api/admin/typewriter/prompts/:pipelineKey/versions:', error);
      return res.status(500).json({ message: 'Server error while listing prompt versions.' });
    }
  });

  app.post('/api/admin/typewriter/prompts/:pipelineKey', requireAdmin, async (req, res) => {
    try {
      const { pipelineKey } = req.params;
      const promptTemplate = req.body?.promptTemplate;
      const createdBy = typeof req.body?.updatedBy === 'string' && req.body.updatedBy.trim()
        ? req.body.updatedBy.trim()
        : 'admin';
      const saved = await savePromptTemplateVersion(pipelineKey, promptTemplate, createdBy, {
        markLatest: parseBooleanFlag(req.body?.markLatest) !== false,
        meta: req.body?.meta
      });
      return res.status(201).json(saved);
    } catch (error) {
      if (error.code === 'INVALID_PIPELINE_KEY' || error.code === 'INVALID_PROMPT_TEMPLATE') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in POST /api/admin/typewriter/prompts/:pipelineKey:', error);
      return res.status(500).json({ message: 'Server error while saving prompt template.' });
    }
  });

  app.post('/api/admin/typewriter/prompts/:pipelineKey/latest', requireAdmin, async (req, res) => {
    try {
      const { pipelineKey } = req.params;
      const latest = await setLatestPromptTemplate(pipelineKey, {
        id: req.body?.id,
        version: req.body?.version
      });
      return res.status(200).json(latest);
    } catch (error) {
      if (
        error.code === 'INVALID_PIPELINE_KEY'
        || error.code === 'INVALID_PROMPT_SELECTION'
        || error.code === 'PROMPT_VERSION_NOT_FOUND'
      ) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in POST /api/admin/typewriter/prompts/:pipelineKey/latest:', error);
      return res.status(500).json({ message: 'Server error while selecting latest prompt template.' });
    }
  });

  app.get('/api/admin/llm-config', requireAdmin, async (_req, res) => {
    try {
      const configs = await listRouteConfigs();
      return res.status(200).json(configs);
    } catch (error) {
      console.error('Error in GET /api/admin/llm-config:', error);
      return res.status(500).json({ message: 'Server error while listing LLM route configs.' });
    }
  });

  app.get('/api/admin/llm-config/:routeKey', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const config = await getRouteConfig(routeKey);
      return res.status(200).json(config);
    } catch (error) {
      if (error.code === 'INVALID_ROUTE_KEY') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in GET /api/admin/llm-config/:routeKey:', error);
      return res.status(500).json({ message: 'Server error while fetching LLM route config.' });
    }
  });

  app.get('/api/admin/llm-config/:routeKey/versions', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const { limit = 20 } = req.query || {};
      const versions = await listRouteConfigVersions(routeKey, limit);
      return res.status(200).json({
        routeKey,
        versions
      });
    } catch (error) {
      if (error.code === 'INVALID_ROUTE_KEY') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in GET /api/admin/llm-config/:routeKey/versions:', error);
      return res.status(500).json({ message: 'Server error while listing route config versions.' });
    }
  });

  app.post('/api/admin/llm-config/:routeKey', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const {
        promptMode,
        promptTemplate,
        promptCore,
        responseSchema,
        fieldDocs,
        examplePayload,
        outputRules,
        updatedBy,
        markLatest
      } = req.body || {};

      const config = await saveRouteConfigVersion(routeKey, {
        promptMode,
        promptTemplate,
        promptCore,
        responseSchema,
        fieldDocs,
        examplePayload,
        outputRules,
        meta: { updatedBy: updatedBy || 'admin' }
      }, updatedBy || 'admin', {
        markLatest: markLatest === undefined ? true : Boolean(markLatest)
      });
      return res.status(200).json(config);
    } catch (error) {
      if (
        error.code === 'INVALID_ROUTE_KEY'
        || error.code === 'INVALID_PROMPT_TEMPLATE'
        || error.code === 'INVALID_RESPONSE_SCHEMA'
        || error.code === 'INVALID_EXAMPLE_PAYLOAD'
      ) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in POST /api/admin/llm-config/:routeKey:', error);
      return res.status(500).json({ message: 'Server error while saving route config version.' });
    }
  });

  app.put('/api/admin/llm-config/:routeKey/prompt', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const { promptTemplate, updatedBy } = req.body || {};
      const config = await updateRoutePrompt(routeKey, promptTemplate, updatedBy || 'admin');
      return res.status(200).json(config);
    } catch (error) {
      if (error.code === 'INVALID_ROUTE_KEY' || error.code === 'INVALID_PROMPT_TEMPLATE') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in PUT /api/admin/llm-config/:routeKey/prompt:', error);
      return res.status(500).json({ message: 'Server error while updating prompt template.' });
    }
  });

  app.put('/api/admin/llm-config/:routeKey/schema', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const { responseSchema, updatedBy } = req.body || {};
      const config = await updateRouteSchema(routeKey, responseSchema, updatedBy || 'admin');
      return res.status(200).json(config);
    } catch (error) {
      if (error.code === 'INVALID_ROUTE_KEY' || error.code === 'INVALID_RESPONSE_SCHEMA') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in PUT /api/admin/llm-config/:routeKey/schema:', error);
      return res.status(500).json({ message: 'Server error while updating response schema.' });
    }
  });

  app.post('/api/admin/llm-config/:routeKey/latest', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const { id, version } = req.body || {};
      const config = await setLatestRouteConfig(routeKey, { id, version });
      return res.status(200).json(config);
    } catch (error) {
      if (
        error.code === 'INVALID_ROUTE_KEY'
        || error.code === 'INVALID_ROUTE_SELECTION'
        || error.code === 'ROUTE_CONFIG_VERSION_NOT_FOUND'
      ) {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in POST /api/admin/llm-config/:routeKey/latest:', error);
      return res.status(500).json({ message: 'Server error while selecting latest route config.' });
    }
  });

  app.post('/api/admin/llm-config/:routeKey/reset', requireAdmin, async (req, res) => {
    try {
      const { routeKey } = req.params;
      const { updatedBy } = req.body || {};
      const config = await resetRouteConfig(routeKey, updatedBy || 'admin');
      return res.status(200).json(config);
    } catch (error) {
      if (error.code === 'INVALID_ROUTE_KEY') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in POST /api/admin/llm-config/:routeKey/reset:', error);
      return res.status(500).json({ message: 'Server error while resetting route config.' });
    }
  });
}

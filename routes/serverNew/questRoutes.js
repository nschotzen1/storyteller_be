export function registerQuestRoutes(app, deps) {
  const {
    requireAdmin,
    normalizeQuestScope,
    ensureQuestConfig,
    validateQuestConfigPayload,
    saveQuestConfig,
    resetQuestConfig,
    parseQuestSceneImageDataUrl,
    MAX_QUEST_SCENE_UPLOAD_BYTES,
    buildQuestSceneUploadAssetPath,
    fsPromises,
    composeQuestSceneImagePrompt,
    resolveProjectAssetUrl,
    generateQuestSceneImageAsset,
    resolveMockMode,
    sanitizeQuestConfig,
    getAiPipelineSettings,
    QUEST_SCENE_AUTHORING_PIPELINE_KEY,
    buildQuestSceneAuthoringRuntime,
    buildQuestSceneAuthoringPromptPayload,
    buildQuestPromptSourceDetails,
    getDefaultQuestSceneAuthoringPromptTemplate,
    buildMockQuestSceneAuthoringDraft,
    resolveQuestSceneAuthoringRuntimeConfig,
    buildQuestSceneAuthoringPromptMessages,
    callJsonLlm,
    normalizeQuestSceneAuthoringDraft,
    flattenQuestSceneAuthoringChanges,
    buildQuestDebugContext,
    appendQuestTraversalEvent,
    getQuestTraversal,
    materializeRoseCourtLocationMuralsForQuest,
    advanceQuest,
    resolveSchemaErrorMessage
  } = deps;

  app.get('/api/quest/screens', async (req, res) => {
    try {
      const scope = normalizeQuestScope(req.query || {});
      const config = await ensureQuestConfig(scope);
      return res.status(200).json(config);
    } catch (error) {
      console.error('Error in GET /api/quest/screens:', error);
      return res.status(500).json({ message: 'Server error while loading quest screens.' });
    }
  });

  app.get('/api/quest/screens/:screenId', async (req, res) => {
    try {
      const { screenId } = req.params;
      const scope = normalizeQuestScope(req.query || {});
      const config = await ensureQuestConfig(scope);
      const screen = config.screens.find((item) => item.id === screenId);
      if (!screen) {
        return res.status(404).json({ message: 'Quest screen not found.' });
      }
      return res.status(200).json({
        sessionId: config.sessionId,
        questId: config.questId,
        screen,
        startScreenId: config.startScreenId,
        updatedAt: config.updatedAt
      });
    } catch (error) {
      console.error('Error in GET /api/quest/screens/:screenId:', error);
      return res.status(500).json({ message: 'Server error while loading quest screen.' });
    }
  });

  app.put('/api/admin/quest/screens', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const validationErrors = validateQuestConfigPayload(payload);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: 'Invalid quest screen payload.',
          errors: validationErrors
        });
      }

      const saved = await saveQuestConfig(payload, payload);
      return res.status(200).json(saved);
    } catch (error) {
      console.error('Error in PUT /api/admin/quest/screens:', error);
      return res.status(500).json({ message: 'Server error while saving quest screens.' });
    }
  });

  app.post('/api/admin/quest/screens/reset', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const saved = await resetQuestConfig(payload);
      return res.status(200).json(saved);
    } catch (error) {
      console.error('Error in POST /api/admin/quest/screens/reset:', error);
      return res.status(500).json({ message: 'Server error while resetting quest screens.' });
    }
  });

  app.post('/api/admin/quest/scene-image', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const scope = normalizeQuestScope(payload);
      const screenId = typeof payload.screenId === 'string' ? payload.screenId.trim() : '';
      if (!screenId) {
        return res.status(400).json({ message: 'screenId is required.' });
      }

      const parsedImage = parseQuestSceneImageDataUrl(payload.dataUrl);
      if (!parsedImage) {
        return res.status(400).json({ message: 'dataUrl must be a base64 data URL for a PNG, JPEG, WEBP, or GIF image.' });
      }

      if (parsedImage.buffer.length > MAX_QUEST_SCENE_UPLOAD_BYTES) {
        return res.status(413).json({ message: 'Scene image upload is too large. Maximum size is 8 MB.' });
      }

      const config = await ensureQuestConfig(scope);
      const screen = Array.isArray(config?.screens)
        ? config.screens.find((item) => item?.id === screenId)
        : null;
      if (!screen) {
        return res.status(404).json({ message: `Unknown screen "${screenId}".` });
      }

      const uploadTarget = buildQuestSceneUploadAssetPath({
        sessionId: scope.sessionId,
        questId: scope.questId,
        screenId,
        filename: payload.filename,
        mimeType: parsedImage.mimeType
      });

      await fsPromises.mkdir(uploadTarget.absoluteDir, { recursive: true });
      await fsPromises.writeFile(uploadTarget.absolutePath, parsedImage.buffer);

      return res.status(201).json({
        sessionId: scope.sessionId,
        questId: scope.questId,
        screenId,
        imageUrl: uploadTarget.imageUrl,
        storedFilename: uploadTarget.storedFilename,
        mimeType: parsedImage.mimeType,
        bytes: parsedImage.buffer.length
      });
    } catch (error) {
      console.error('Error in POST /api/admin/quest/scene-image:', error);
      return res.status(500).json({ message: 'Server error while uploading quest scene image.' });
    }
  });

  app.post('/api/admin/quest/scene-image/compose-prompt', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const scope = normalizeQuestScope(payload);
      const composedPrompt = composeQuestSceneImagePrompt({
        sceneName: typeof payload.sceneName === 'string' ? payload.sceneName : '',
        sceneTemplate: typeof payload.sceneTemplate === 'string' ? payload.sceneTemplate : '',
        sceneComponents: Array.isArray(payload.sceneComponents) ? payload.sceneComponents : [],
        authoringBrief: typeof payload.authoringBrief === 'string' ? payload.authoringBrief : '',
        visualStyleGuide: typeof payload.visualStyleGuide === 'string' ? payload.visualStyleGuide : '',
        screenId: typeof payload.screenId === 'string' ? payload.screenId.trim() : '',
        screenTitle: typeof payload.screenTitle === 'string' ? payload.screenTitle : '',
        screenPrompt: typeof payload.screenPrompt === 'string'
          ? payload.screenPrompt
          : (typeof payload.promptText === 'string' ? payload.promptText : ''),
        referenceImagePrompt: typeof payload.referenceImagePrompt === 'string' ? payload.referenceImagePrompt : '',
        image_prompt: typeof payload.image_prompt === 'string'
          ? payload.image_prompt
          : (typeof payload.imagePrompt === 'string' ? payload.imagePrompt : ''),
        visualContinuityGuidance: typeof payload.visualContinuityGuidance === 'string' ? payload.visualContinuityGuidance : '',
        visualTransitionIntent: typeof payload.visualTransitionIntent === 'string' ? payload.visualTransitionIntent : '',
        incomingContext: Array.isArray(payload.incomingContext) ? payload.incomingContext : [],
        outgoingContext: Array.isArray(payload.outgoingContext) ? payload.outgoingContext : []
      });

      return res.status(200).json({
        sessionId: scope.sessionId,
        questId: scope.questId,
        screenId: typeof payload.screenId === 'string' ? payload.screenId.trim() : '',
        composedPrompt
      });
    } catch (error) {
      console.error('Error in POST /api/admin/quest/scene-image/compose-prompt:', error);
      return res.status(500).json({ message: 'Server error while composing quest scene image prompt.' });
    }
  });

  app.post('/api/admin/quest/scene-image/resolve-path', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const imageUrl = typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() : '';
      if (!imageUrl) {
        return res.status(400).json({ message: 'imageUrl is required.' });
      }

      const resolved = resolveProjectAssetUrl(imageUrl);
      return res.status(200).json(resolved);
    } catch (error) {
      console.error('Error in POST /api/admin/quest/scene-image/resolve-path:', error);
      return res.status(500).json({ message: 'Server error while resolving quest scene image path.' });
    }
  });

  app.post('/api/admin/quest/scene-image/generate', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const scope = normalizeQuestScope(payload);
      const result = await generateQuestSceneImageAsset({
        sessionId: scope.sessionId,
        questId: scope.questId,
        screenId: typeof payload.screenId === 'string' ? payload.screenId.trim() : '',
        screenTitle: typeof payload.screenTitle === 'string' ? payload.screenTitle.trim() : '',
        prompt: typeof payload.prompt === 'string' ? payload.prompt : '',
        referenceImagePrompt: typeof payload.referenceImagePrompt === 'string' ? payload.referenceImagePrompt : '',
        image_prompt: typeof payload.image_prompt === 'string'
          ? payload.image_prompt
          : (typeof payload.imagePrompt === 'string' ? payload.imagePrompt : ''),
        imageModel: typeof payload.imageModel === 'string' ? payload.imageModel.trim() : '',
        shouldMock: resolveMockMode(payload, process.env.TYPEWRITER_MOCK_IMAGE_GEN === 'true')
      });

      return res.status(201).json({
        sessionId: scope.sessionId,
        questId: scope.questId,
        screenId: typeof payload.screenId === 'string' ? payload.screenId.trim() : '',
        ...result
      });
    } catch (error) {
      console.error('Error in POST /api/admin/quest/scene-image/generate:', error);
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return res.status(statusCode).json({
        message: error?.message || 'Server error while generating quest scene image.'
      });
    }
  });

  app.post('/api/admin/quest/authoring-draft', requireAdmin, async (req, res) => {
    try {
      const payload = req.body || {};
      const scope = normalizeQuestScope(payload);
      const mode = ['scene', 'selected_screen', 'fill_missing'].includes(
        typeof payload.mode === 'string' ? payload.mode.trim() : ''
      )
        ? payload.mode.trim()
        : 'fill_missing';
      const incomingConfig = payload.config && typeof payload.config === 'object'
        ? sanitizeQuestConfig(
            {
              ...payload.config,
              sessionId: scope.sessionId,
              questId: scope.questId
            },
            { fallbackScope: scope }
          )
        : await ensureQuestConfig(scope);
      const screens = Array.isArray(incomingConfig?.screens) ? incomingConfig.screens : [];
      const requestedScreenId = typeof payload.selectedScreenId === 'string' ? payload.selectedScreenId.trim() : '';
      const selectedScreen = screens.find((screen) => screen?.id === requestedScreenId)
        || screens.find((screen) => screen?.id === incomingConfig.startScreenId)
        || screens[0]
        || null;
      const selectedScreenId = selectedScreen?.id || '';
      const questPipeline = await getAiPipelineSettings(QUEST_SCENE_AUTHORING_PIPELINE_KEY);
      const runtime = buildQuestSceneAuthoringRuntime(
        questPipeline,
        resolveMockMode(payload, questPipeline.useMock)
      );
      const promptPayload = buildQuestSceneAuthoringPromptPayload({
        config: incomingConfig,
        selectedScreen,
        mode
      });
      const fallbackPromptSource = buildQuestPromptSourceDetails({
        latestPrompt: null,
        routeConfig: {
          promptCore: getDefaultQuestSceneAuthoringPromptTemplate(),
          updatedBy: 'code-default'
        }
      });

      let promptSource = fallbackPromptSource;
      let rawDraft = null;
      let compiledPrompt = '';

      if (runtime.mocked) {
        rawDraft = buildMockQuestSceneAuthoringDraft({
          config: incomingConfig,
          selectedScreen,
          mode
        });
      } else {
        const { promptTemplate, latestPrompt } = await resolveQuestSceneAuthoringRuntimeConfig();
        promptSource = buildQuestPromptSourceDetails({
          latestPrompt,
          routeConfig: {
            promptCore: getDefaultQuestSceneAuthoringPromptTemplate(),
            updatedBy: 'code-default'
          }
        });
        const promptMessages = buildQuestSceneAuthoringPromptMessages({
          promptTemplate,
          promptPayload
        });
        compiledPrompt = promptMessages.compiledPrompt || '';
        const rawResponse = await callJsonLlm({
          prompts: promptMessages.prompts,
          provider: runtime.provider,
          model: runtime.model || '',
          max_tokens: 2200,
          explicitJsonObjectFormat: true
        });
        if (!rawResponse || typeof rawResponse !== 'object') {
          const error = new Error('Quest scene authoring draft generation failed.');
          error.statusCode = 502;
          throw error;
        }
        rawDraft = rawResponse;
      }

      const draft = normalizeQuestSceneAuthoringDraft(rawDraft, {
        config: incomingConfig,
        selectedScreenId,
        mode
      });
      const changes = flattenQuestSceneAuthoringChanges(draft, incomingConfig);

      return res.status(200).json({
        sessionId: scope.sessionId,
        questId: scope.questId,
        mode,
        selectedScreenId,
        mocked: runtime.mocked,
        runtime,
        promptSource,
        promptPayload,
        compiledPrompt,
        summary: draft.summary,
        draft,
        changes
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code || 'QUEST_AUTHORING_DRAFT_ERROR' });
      }
      console.error('Error in POST /api/admin/quest/authoring-draft:', error);
      return res.status(500).json({ message: 'Server error while generating quest authoring draft.' });
    }
  });

  app.post('/api/admin/quest/debug-context', requireAdmin, async (req, res) => {
    try {
      const debugContext = await buildQuestDebugContext(req.body || {});
      return res.status(200).json(debugContext);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message, code: error.code || 'QUEST_DEBUG_ERROR' });
      }
      console.error('Error in POST /api/admin/quest/debug-context:', error);
      return res.status(500).json({ message: 'Server error while inspecting quest debug context.' });
    }
  });

  app.post('/api/quest/traversal', async (req, res) => {
    try {
      const payload = req.body || {};
      const eventResult = await appendQuestTraversalEvent(payload);
      if (!eventResult) {
        return res.status(400).json({ message: 'Missing required parameter: toScreenId.' });
      }
      return res.status(201).json(eventResult);
    } catch (error) {
      console.error('Error in POST /api/quest/traversal:', error);
      return res.status(500).json({ message: 'Server error while saving traversal event.' });
    }
  });

  app.get('/api/quest/traversal', async (req, res) => {
    try {
      const traversalPayload = await getQuestTraversal(req.query || {});
      return res.status(200).json(traversalPayload);
    } catch (error) {
      console.error('Error in GET /api/quest/traversal:', error);
      return res.status(500).json({ message: 'Server error while loading traversal events.' });
    }
  });

  app.post('/api/rose-court/prologue/materialize-location', async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await materializeRoseCourtLocationMuralsForQuest(payload);
      return res.status(200).json(result);
    } catch (error) {
      if (
        error.code === 'ROSE_COURT_INVALID_QUEST'
        || error.code === 'ROSE_COURT_LOCATION_INCOMPLETE'
      ) {
        return res.status(error.statusCode || 400).json({ message: error.message });
      }
      console.error('Error in POST /api/rose-court/prologue/materialize-location:', error);
      return res.status(500).json({ message: 'Server error while materializing rose court location murals.' });
    }
  });

  app.post('/api/quest/advance', async (req, res) => {
    try {
      const payload = req.body || {};
      const result = await advanceQuest(payload);
      return res.status(200).json(result);
    } catch (error) {
      if (
        error.code === 'QUEST_SCREEN_NOT_FOUND'
        || error.code === 'QUEST_DIRECTION_NOT_FOUND'
        || error.code === 'QUEST_DIRECTION_TARGET_NOT_FOUND'
      ) {
        return res.status(error.statusCode || 404).json({ message: error.message });
      }
      if (error.code === 'QUEST_PROMPT_REQUIRED') {
        return res.status(error.statusCode || 400).json({ message: error.message });
      }
      if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
        return res.status(error.statusCode || 502).json({
          message: resolveSchemaErrorMessage(error, 'Quest advance schema validation failed.'),
          runtime: error.runtime || null
        });
      }
      if (error.code === 'QUEST_ADVANCE_GENERATION_FAILED') {
        return res.status(error.statusCode || 502).json({
          message: error.message,
          runtime: error.runtime || null
        });
      }
      console.error('Error in POST /api/quest/advance:', error);
      return res.status(500).json({ message: 'Server error while advancing quest state.' });
    }
  });
}

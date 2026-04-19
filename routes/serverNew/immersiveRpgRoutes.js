export function registerImmersiveRpgRoutes(app, deps) {
  const {
    normalizeImmersiveRpgSessionId,
    normalizeImmersiveRpgPlayerId,
    normalizeImmersiveRpgPlayerName,
    normalizeImmersiveRpgMessengerSceneId,
    resolveImmersiveRpgRuntimeConfig,
    getAiPipelineSettings,
    createOrLoadImmersiveRpgScene,
    buildImmersiveRpgEnvelope,
    getDefaultImmersiveRpgSceneDefinition,
    resolveMockMode,
    createTranscriptEntry,
    buildMockImmersiveRpgChatResponse,
    buildImmersiveRpgPromptMessages,
    callJsonLlm,
    validatePayloadForRoute,
    IMMERSIVE_RPG_TURN_CONTRACT_KEY,
    normalizeImmersiveRpgChatResponse,
    buildCompiledScenePrompt,
    ImmersiveRpgSceneSession,
    resolveSchemaErrorMessage,
    sendLlmAwareError,
    simulateDicePoolRoll,
    resolveRollOutcome,
    getImmersiveRpgSceneDefinition,
    resolveImmersiveRpgSceneContext,
    ensureImmersiveRpgCharacterSheet,
    toImmersiveRpgCharacterSheetPayload
  } = deps;

  app.get('/api/immersive-rpg/scene', async (req, res) => {
    try {
      const sessionId = normalizeImmersiveRpgSessionId(req.query?.sessionId);
      const playerId = normalizeImmersiveRpgPlayerId(req.query?.playerId);
      const playerName = normalizeImmersiveRpgPlayerName(req.query?.playerName);
      const { promptTemplate, routeConfig } = await resolveImmersiveRpgRuntimeConfig();
      const immersiveRpgPipeline = await getAiPipelineSettings('immersive_rpg_gm');

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const result = await createOrLoadImmersiveRpgScene({
        sessionId,
        playerId,
        playerName,
        promptTemplate,
        routeConfig,
        allowMockDependencies: Boolean(immersiveRpgPipeline?.useMock)
      });

      if (!result.sceneDoc) {
        return res.status(200).json(buildImmersiveRpgEnvelope(null, null, {
          sessionId,
          ready: false,
          currentSceneNumber: result.sceneDefinition?.number || getDefaultImmersiveRpgSceneDefinition().number,
          currentSceneKey: result.sceneDefinition?.key || getDefaultImmersiveRpgSceneDefinition().key,
          missingContext: result.missingContext || [],
          mockedContext: result.mockedContext || [],
          storage: 'mongo',
          sourceStorage: result.messengerStorage
        }));
      }

      return res.status(200).json(buildImmersiveRpgEnvelope(result.sceneDoc, result.characterSheetDoc, {
        sessionId,
        ready: true,
        currentSceneNumber: result.sceneDefinition?.number || result.sceneDoc?.currentSceneNumber,
        currentSceneKey: result.sceneDefinition?.key || result.sceneDoc?.currentSceneKey,
        bootstrapped: result.bootstrapped,
        mockedContext: result.mockedContext || [],
        messengerReady: Boolean(result.messengerSceneBrief?.sceneEstablished),
        storage: 'mongo',
        sourceStorage: result.messengerStorage
      }));
    } catch (error) {
      console.error('Error in GET /api/immersive-rpg/scene:', error);
      return res.status(500).json({ message: 'Server error while loading immersive RPG scene.' });
    }
  });

  app.post('/api/immersive-rpg/chat', async (req, res) => {
    try {
      const body = req.body || {};
      const sessionId = normalizeImmersiveRpgSessionId(body.sessionId);
      const playerId = normalizeImmersiveRpgPlayerId(body.playerId);
      const playerName = normalizeImmersiveRpgPlayerName(body.playerName);
      const messengerSceneId = normalizeImmersiveRpgMessengerSceneId(body.messengerSceneId);
      const message = typeof body.message === 'string' ? body.message.trim() : '';

      if (!sessionId || !message) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or message.' });
      }

      const { promptTemplate, routeConfig } = await resolveImmersiveRpgRuntimeConfig();
      const immersiveRpgPipeline = await getAiPipelineSettings('immersive_rpg_gm');
      const immersiveRpgProvider = typeof immersiveRpgPipeline?.provider === 'string'
        ? immersiveRpgPipeline.provider
        : 'openai';
      const shouldMock = resolveMockMode(body, immersiveRpgPipeline.useMock);
      let result = await createOrLoadImmersiveRpgScene({
        sessionId,
        playerId,
        playerName,
        messengerSceneId,
        promptTemplate,
        routeConfig,
        allowMockDependencies: shouldMock
      });

      if (!result.ready || !result.sceneDoc) {
        return res.status(409).json({
          message: 'Immersive RPG scene is missing required persisted context.',
          missingContext: result.missingContext || [],
          mockedContext: result.mockedContext || []
        });
      }

      const currentScene = result.sceneDoc;
      const playerEntry = createTranscriptEntry({
        role: 'pc',
        kind: 'action',
        text: message
      });
      const requestTranscript = [...(Array.isArray(currentScene.transcript) ? currentScene.transcript : []), playerEntry];

      let rawResponse;
      if (shouldMock) {
        rawResponse = buildMockImmersiveRpgChatResponse(currentScene, message);
      } else {
        const promptMessages = buildImmersiveRpgPromptMessages({
          promptTemplate,
          routeContract: routeConfig,
          sceneBrief: currentScene.sourceSceneBrief,
          characterSheet: result.characterSheetDoc,
          currentBeat: currentScene.currentBeat,
          transcript: requestTranscript,
          playerMessage: message
        });
        rawResponse = await callJsonLlm({
          prompts: promptMessages.prompts,
          provider: immersiveRpgProvider,
          model: immersiveRpgPipeline.model || '',
          max_tokens: 1400,
          explicitJsonObjectFormat: true
        });
      }

      if (!rawResponse || typeof rawResponse !== 'object') {
        return res.status(502).json({
          message: 'Immersive RPG generation failed.',
          runtime: {
            pipeline: 'immersive_rpg_gm',
            provider: immersiveRpgProvider,
            model: immersiveRpgPipeline.model || '',
            mocked: shouldMock
          }
        });
      }

      await validatePayloadForRoute(IMMERSIVE_RPG_TURN_CONTRACT_KEY, rawResponse);
      const normalizedResponse = normalizeImmersiveRpgChatResponse(rawResponse);
      if (!normalizedResponse.gmReply) {
        return res.status(502).json({
          message: 'Immersive RPG generation returned an empty GM reply.',
          runtime: {
            pipeline: 'immersive_rpg_gm',
            provider: immersiveRpgProvider,
            model: immersiveRpgPipeline.model || '',
            mocked: shouldMock
          }
        });
      }

      const gmEntry = createTranscriptEntry({
        role: 'gm',
        kind: normalizedResponse.pendingRoll ? 'roll_prompt' : 'response',
        text: normalizedResponse.gmReply,
        meta: {
          beat: normalizedResponse.currentBeat,
          pendingRoll: normalizedResponse.pendingRoll,
          shouldPauseForChoice: normalizedResponse.shouldPauseForChoice
        }
      });

      const nextTranscript = [...requestTranscript, gmEntry];
      const compiledPrompt = buildCompiledScenePrompt({
        promptTemplate,
        routeContract: routeConfig,
        sceneBrief: currentScene.sourceSceneBrief,
        characterSheet: result.characterSheetDoc,
        currentBeat: normalizedResponse.currentBeat,
        transcript: nextTranscript
      });
      const nextSceneFlags = {
        ...(currentScene.sceneFlags && typeof currentScene.sceneFlags === 'object' ? currentScene.sceneFlags : {}),
        ...(normalizedResponse.sceneFlagsPatch && typeof normalizedResponse.sceneFlagsPatch === 'object'
          ? normalizedResponse.sceneFlagsPatch
          : {})
      };
      const nextNotes = Array.from(new Set([
        ...(Array.isArray(currentScene.notes) ? currentScene.notes : []),
        ...(Array.isArray(normalizedResponse.keeperNotes) ? normalizedResponse.keeperNotes : [])
      ])).slice(-20);

      const updatedScene = await ImmersiveRpgSceneSession.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            currentBeat: normalizedResponse.currentBeat,
            pendingRoll: normalizedResponse.pendingRoll,
            notebook: normalizedResponse.notebook,
            stageLayout: normalizedResponse.stageLayout,
            stageModules: normalizedResponse.stageModules,
            compiledPrompt,
            sceneFlags: nextSceneFlags,
            notes: nextNotes
          },
          $push: {
            transcript: {
              $each: [playerEntry, gmEntry]
            }
          }
        },
        { new: true }
      ).lean();

      return res.status(200).json(buildImmersiveRpgEnvelope(updatedScene, result.characterSheetDoc, {
        sessionId,
        reply: gmEntry.text,
        pendingRoll: updatedScene.pendingRoll,
        storage: 'mongo',
        mocked: shouldMock,
        runtime: {
          pipeline: 'immersive_rpg_gm',
          provider: immersiveRpgProvider,
          model: immersiveRpgPipeline.model || '',
          mocked: shouldMock
        }
      }));
    } catch (error) {
      if (error.code === 'IMMERSIVE_RPG_MESSENGER_BRIEF_REQUIRED') {
        return res.status(error.statusCode || 409).json({ message: error.message });
      }
      if (error.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
        return res.status(502).json({
          message: resolveSchemaErrorMessage(error, 'Immersive RPG chat schema validation failed.')
        });
      }
      console.error('Error in POST /api/immersive-rpg/chat:', error);
      return sendLlmAwareError(res, error, 'Server error while advancing immersive RPG chat.');
    }
  });

  app.post('/api/immersive-rpg/rolls', async (req, res) => {
    try {
      const body = req.body || {};
      const sessionId = normalizeImmersiveRpgSessionId(body.sessionId);
      const playerId = normalizeImmersiveRpgPlayerId(body.playerId);
      const playerName = normalizeImmersiveRpgPlayerName(body.playerName);
      const messengerSceneId = normalizeImmersiveRpgMessengerSceneId(body.messengerSceneId);

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const { promptTemplate, routeConfig } = await resolveImmersiveRpgRuntimeConfig();
      const immersiveRpgPipeline = await getAiPipelineSettings('immersive_rpg_gm');
      const result = await createOrLoadImmersiveRpgScene({
        sessionId,
        playerId,
        playerName,
        messengerSceneId,
        promptTemplate,
        routeConfig,
        allowMockDependencies: Boolean(immersiveRpgPipeline?.useMock)
      });

      if (!result.ready || !result.sceneDoc) {
        return res.status(409).json({
          message: 'Immersive RPG scene is missing required persisted context.',
          missingContext: result.missingContext || [],
          mockedContext: result.mockedContext || []
        });
      }

      const currentScene = result.sceneDoc;
      const pendingRoll = currentScene.pendingRoll && typeof currentScene.pendingRoll === 'object'
        ? currentScene.pendingRoll
        : null;

      const roll = simulateDicePoolRoll({
        contextKey: typeof body.contextKey === 'string' && body.contextKey.trim()
          ? body.contextKey.trim()
          : pendingRoll?.contextKey,
        skill: typeof body.skill === 'string' && body.skill.trim()
          ? body.skill.trim()
          : pendingRoll?.skill,
        label: typeof body.label === 'string' && body.label.trim()
          ? body.label.trim()
          : pendingRoll?.label,
        diceNotation: typeof body.diceNotation === 'string' && body.diceNotation.trim()
          ? body.diceNotation.trim()
          : pendingRoll?.diceNotation,
        difficulty: typeof body.difficulty === 'string' && body.difficulty.trim()
          ? body.difficulty.trim()
          : pendingRoll?.difficulty,
        successThreshold: body.successThreshold ?? pendingRoll?.successThreshold,
        successesRequired: body.successesRequired ?? pendingRoll?.successesRequired
      });

      const resolution = resolveRollOutcome(currentScene, roll);
      const gmEntry = createTranscriptEntry({
        role: 'gm',
        kind: 'resolution',
        text: resolution.gmText,
        meta: {
          beat: resolution.nextBeat,
          resolvedRollId: roll.rollId,
          contextKey: roll.contextKey
        }
      });

      const nextTranscript = [...(Array.isArray(currentScene.transcript) ? currentScene.transcript : []), gmEntry];
      const nextSceneFlags = {
        ...(currentScene.sceneFlags && typeof currentScene.sceneFlags === 'object' ? currentScene.sceneFlags : {}),
        ...(resolution.sceneFlags && typeof resolution.sceneFlags === 'object' ? resolution.sceneFlags : {})
      };
      const compiledPrompt = buildCompiledScenePrompt({
        promptTemplate,
        routeContract: routeConfig,
        sceneBrief: currentScene.sourceSceneBrief,
        characterSheet: result.characterSheetDoc,
        currentBeat: resolution.nextBeat,
        transcript: nextTranscript
      });

      const updatedScene = await ImmersiveRpgSceneSession.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            currentBeat: resolution.nextBeat,
            pendingRoll: null,
            notebook: resolution.notebook,
            stageLayout: resolution.stageLayout,
            stageModules: resolution.stageModules,
            sceneFlags: nextSceneFlags,
            compiledPrompt
          },
          $push: {
            rollLog: {
              ...roll,
              meta: {
                source: pendingRoll ? 'scene_pending_roll' : 'manual'
              }
            },
            transcript: gmEntry
          }
        },
        { new: true }
      ).lean();

      return res.status(200).json(buildImmersiveRpgEnvelope(updatedScene, result.characterSheetDoc, {
        sessionId,
        roll,
        resolution: {
          currentBeat: resolution.nextBeat,
          message: gmEntry.text
        },
        storage: 'mongo'
      }));
    } catch (error) {
      if (error.code === 'IMMERSIVE_RPG_MESSENGER_BRIEF_REQUIRED') {
        return res.status(error.statusCode || 409).json({ message: error.message });
      }
      if (error.code === 'INVALID_DICE_NOTATION') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error in POST /api/immersive-rpg/rolls:', error);
      return res.status(500).json({ message: 'Server error while resolving immersive RPG roll.' });
    }
  });

  app.get('/api/immersive-rpg/character-sheet', async (req, res) => {
    try {
      const sessionId = normalizeImmersiveRpgSessionId(req.query?.sessionId);
      const playerId = normalizeImmersiveRpgPlayerId(req.query?.playerId);
      const playerName = normalizeImmersiveRpgPlayerName(req.query?.playerName);

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const sceneDoc = await ImmersiveRpgSceneSession.findOne({ sessionId }).lean();
      const immersiveRpgPipeline = await getAiPipelineSettings('immersive_rpg_gm');
      const sceneDefinition = getImmersiveRpgSceneDefinition(
        sceneDoc?.currentSceneNumber || sceneDoc?.currentSceneKey || null
      );
      const resolvedContext = await resolveImmersiveRpgSceneContext({
        sessionId,
        playerId,
        playerName,
        sceneDefinition,
        allowMockDependencies: Boolean(immersiveRpgPipeline?.useMock)
      });
      const sourceSceneBrief = sceneDoc?.sourceSceneBrief || resolvedContext.context.messenger_scene_brief || {};
      const characterSheetDoc = await ensureImmersiveRpgCharacterSheet({
        sessionId,
        playerId,
        playerName,
        sourceSceneBrief
      });

      return res.status(200).json({
        sessionId,
        playerId: characterSheetDoc.playerId,
        characterSheet: toImmersiveRpgCharacterSheetPayload(characterSheetDoc)
      });
    } catch (error) {
      console.error('Error in GET /api/immersive-rpg/character-sheet:', error);
      return res.status(500).json({ message: 'Server error while loading immersive RPG character sheet.' });
    }
  });

  app.put('/api/immersive-rpg/character-sheet', async (req, res) => {
    try {
      const body = req.body || {};
      const sessionId = normalizeImmersiveRpgSessionId(body.sessionId);
      const playerId = normalizeImmersiveRpgPlayerId(body.playerId);
      const playerName = normalizeImmersiveRpgPlayerName(body.playerName);

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const sceneDoc = await ImmersiveRpgSceneSession.findOne({ sessionId }).lean();
      const immersiveRpgPipeline = await getAiPipelineSettings('immersive_rpg_gm');
      const sceneDefinition = getImmersiveRpgSceneDefinition(
        sceneDoc?.currentSceneNumber || sceneDoc?.currentSceneKey || null
      );
      const resolvedContext = await resolveImmersiveRpgSceneContext({
        sessionId,
        playerId,
        playerName,
        sceneDefinition,
        allowMockDependencies: Boolean(immersiveRpgPipeline?.useMock)
      });
      const sourceSceneBrief = sceneDoc?.sourceSceneBrief || resolvedContext.context.messenger_scene_brief || {};
      const characterSheetDoc = await ensureImmersiveRpgCharacterSheet({
        sessionId,
        playerId,
        playerName,
        sourceSceneBrief,
        patch: body
      });

      if (sceneDoc) {
        const { promptTemplate, routeConfig } = await resolveImmersiveRpgRuntimeConfig();
        await ImmersiveRpgSceneSession.updateOne(
          { sessionId },
          {
            $set: {
              compiledPrompt: buildCompiledScenePrompt({
                promptTemplate,
                routeContract: routeConfig,
                sceneBrief: sceneDoc.sourceSceneBrief,
                characterSheet: characterSheetDoc,
                currentBeat: sceneDoc.currentBeat,
                transcript: sceneDoc.transcript
              })
            }
          }
        );
      }

      return res.status(200).json({
        sessionId,
        playerId: characterSheetDoc.playerId,
        characterSheet: toImmersiveRpgCharacterSheetPayload(characterSheetDoc)
      });
    } catch (error) {
      console.error('Error in PUT /api/immersive-rpg/character-sheet:', error);
      return res.status(500).json({ message: 'Server error while saving immersive RPG character sheet.' });
    }
  });
}

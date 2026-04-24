export function registerTypewriterRoutes(app, deps) {
  const {
    collectTypewriterPageImages,
    ASSETS_ROOTS,
    TYPEWRITER_PAGE_IMAGES_SUBDIR,
    TYPEWRITER_ALLOWED_PAGE_IMAGE_EXTENSIONS,
    TYPEWRITER_DEFAULT_SERVER_BACKGROUNDS,
    pickRandomItem,
    buildAbsoluteAssetUrl,
    TYPEWRITER_DEFAULT_FONTS,
    countWords,
    clampValue,
    getAiPipelineSettings,
    resolveMockMode,
    narrativeEndsWithTerm,
    XEROFAG_CANDIDATE_TERM,
    startTypewriterSession,
    shouldAllowXerofagInMock,
    getLatestPromptTemplate,
    buildXerofagInspectionPromptMessages,
    callJsonLlm,
    sendLlmAwareError,
    normalizeOptionalPlayerId,
    firstDefinedString,
    ensureBuiltinTypewriterKeys,
    findTypewriterKeyForSession,
    buildTypewriterKeyCandidateNarrative,
    buildTypewriterKeyState,
    NarrativeEntity,
    shouldAllowTypewriterKeyInMock,
    markTypewriterKeyPressed,
    resolveTypewriterKeyVerificationPromptTemplate,
    buildTypewriterKeyVerificationPromptMessages,
    validatePayloadForRoute,
    saveTypewriterSessionFragment,
    buildTypewriterSessionPayload,
    buildTypewriterSessionInspectPayload,
    getTypewriterSessionFragment,
    listTypewriterSlotStorytellers,
    filterAssignedTypewriterStorytellers,
    findNextAvailableTypewriterStorytellerSlot,
    getTypewriterStorytellerThreshold,
    TYPEWRITER_STORYTELLER_CHECK_INTERVAL_WORDS,
    generateTypewriterStorytellerForSlot,
    buildStorytellerListItem,
    buildTypewriterStorytellerSlots,
    listTypewriterKeysForSession,
    findTypewriterStorytellerForIntervention,
    acquireTypewriterStorytellerInterventionLock,
    buildTypewriterSessionStorytellerItem,
    toFiniteNumber,
    buildMockStorytellerIntervention,
    resolveStorytellerInterventionPromptTemplate,
    buildStorytellerInterventionPromptMessages,
    findStorytellerTaskAssignmentForRoute,
    resolveTaskPromptText,
    resolveTaskKnowledgeContext,
    normalizeTypewriterMetadata,
    mergeTypewriterFragment,
    saveTypewriterEntityFromIntervention,
    saveTypewriterKeyFromIntervention,
    Storyteller,
    normalizeContinuationInsights,
    createTypewriterResponse,
    buildMockContinuation,
    buildTypewriterPromptMessages
  } = deps;

  app.post('/api/next_film_image', async (req, res) => {
    try {
      const { sessionId } = req.body || {};
      if (!sessionId) {
        return res.status(400).json({ error: 'Missing sessionId' });
      }

      const discoveredBackgrounds = collectTypewriterPageImages(
        ASSETS_ROOTS,
        TYPEWRITER_PAGE_IMAGES_SUBDIR,
        TYPEWRITER_ALLOWED_PAGE_IMAGE_EXTENSIONS
      );
      const availableBackgrounds = discoveredBackgrounds.length
        ? discoveredBackgrounds
        : TYPEWRITER_DEFAULT_SERVER_BACKGROUNDS;
      const backgroundPath = pickRandomItem(availableBackgrounds) || availableBackgrounds[0];
      const backgroundUrl = buildAbsoluteAssetUrl(req, backgroundPath);
      if (!backgroundUrl) {
        return res.status(500).json({ error: 'No typewriter page image available' });
      }

      const fontStyle = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
      return res.status(200).json({ image_url: backgroundUrl, image_path: backgroundPath, ...fontStyle });
    } catch (error) {
      console.error('Error in /api/next_film_image:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/shouldGenerateContinuation', async (req, res) => {
    try {
      const goldenRatio = 1.61;
      const minWords = 3;
      const { currentText, latestAddition, latestPauseSeconds, lastGhostwriterWordCount } = req.body || {};

      if (!currentText || !latestAddition || typeof latestPauseSeconds !== 'number') {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const wordCount = countWords(latestAddition);
      const goldenThreshold = Math.max(minWords, Math.floor((lastGhostwriterWordCount || 1) / goldenRatio));
      if (wordCount < goldenThreshold) {
        return res.status(200).json({ shouldGenerate: false });
      }

      const totalLength = countWords(currentText);
      const additionChars = String(latestAddition || '').trim().length;

      const hardMinimumPauseSeconds = 4.2;
      if (latestPauseSeconds < hardMinimumPauseSeconds) {
        return res.status(200).json({ shouldGenerate: false });
      }

      // Keep continuation from interrupting likely writing sprees.
      if (wordCount >= 8 && latestPauseSeconds < 6.8) {
        return res.status(200).json({ shouldGenerate: false });
      }
      if (wordCount >= 14 && latestPauseSeconds < 8.6) {
        return res.status(200).json({ shouldGenerate: false });
      }

      const basePause = 5.4;
      const narrativeFactor = clampValue(totalLength * 0.018, 0, 3.5);
      const additionFactor = clampValue(wordCount * 0.11, 0, 2.2);
      const densityFactor = clampValue(additionChars / 120, 0, 1.2);
      const requiredPause = basePause + narrativeFactor + additionFactor + densityFactor;

      return res.status(200).json({ shouldGenerate: latestPauseSeconds >= requiredPause });
    } catch (error) {
      console.error('Error in /api/shouldGenerateContinuation:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/shouldAllowXerofag', async (req, res) => {
    try {
      const { sessionId, currentNarrative, candidateNarrative } = req.body || {};
      if (!sessionId || typeof currentNarrative !== 'string') {
        return res.status(400).json({ error: 'Missing sessionId or currentNarrative' });
      }

      const inspectionPipeline = await getAiPipelineSettings('xerofag_inspection');
      const inspectionProvider = typeof inspectionPipeline?.provider === 'string'
        ? inspectionPipeline.provider
        : 'openai';
      const shouldMock = resolveMockMode(req.body, inspectionPipeline.useMock);

      if (!currentNarrative.trim() || narrativeEndsWithTerm(currentNarrative, XEROFAG_CANDIDATE_TERM)) {
        return res.status(200).json({
          allowed: false,
          mocked: shouldMock,
          runtime: {
            pipeline: 'xerofag_inspection',
            provider: inspectionProvider,
            model: inspectionPipeline.model || '',
            mocked: shouldMock
          }
        });
      }

      await startTypewriterSession(sessionId);

      if (shouldMock) {
        return res.status(200).json({
          allowed: shouldAllowXerofagInMock(currentNarrative),
          mocked: true,
          runtime: {
            pipeline: 'xerofag_inspection',
            provider: inspectionProvider,
            model: inspectionPipeline.model || '',
            mocked: true
          }
        });
      }

      try {
        const inspectionPromptDoc = await getLatestPromptTemplate('xerofag_inspection');
        const prompt = buildXerofagInspectionPromptMessages(
          currentNarrative,
          candidateNarrative,
          inspectionPromptDoc?.promptTemplate || ''
        );
        const aiResponse = await callJsonLlm({
          prompts: prompt,
          provider: inspectionProvider,
          model: inspectionPipeline.model || '',
          max_tokens: 180,
          explicitJsonObjectFormat: true
        });

        if (typeof aiResponse?.allowed !== 'boolean') {
          return res.status(502).json({
            error: 'Live Xerofag inspection did not return a valid boolean verdict.',
            runtime: {
              pipeline: 'xerofag_inspection',
              provider: inspectionProvider,
              model: inspectionPipeline.model || '',
              mocked: false
            }
          });
        }

        return res.status(200).json({
          allowed: aiResponse.allowed,
          mocked: false,
          runtime: {
            pipeline: 'xerofag_inspection',
            provider: inspectionProvider,
            model: inspectionPipeline.model || '',
            mocked: false
          }
        });
      } catch (aiError) {
        console.error('Error in live /api/shouldAllowXerofag call:', aiError);
        return res.status(502).json({
          error: 'Live Xerofag inspection failed.',
          details: aiError?.message || 'Unknown error',
          runtime: {
            pipeline: 'xerofag_inspection',
            provider: inspectionProvider,
            model: inspectionPipeline.model || '',
            mocked: false
          }
        });
      }
    } catch (error) {
      console.error('Error in /api/shouldAllowXerofag:', error);
      return sendLlmAwareError(res, error, 'Internal Server Error', 'error');
    }
  });

  app.post('/api/typewriter/keys/shouldAllow', async (req, res) => {
    try {
      const body = req.body || {};
      const { sessionId, currentNarrative, candidateNarrative } = body;
      const resolvedPlayerId = normalizeOptionalPlayerId(body.playerId);
      const requestedKeyId = firstDefinedString(body.keyId);
      const requestedKeyText = firstDefinedString(body.keyText);

      if (!sessionId || typeof currentNarrative !== 'string') {
        return res.status(400).json({ error: 'Missing sessionId or currentNarrative' });
      }
      if (!requestedKeyId && !requestedKeyText) {
        return res.status(400).json({ error: 'Missing keyId or keyText' });
      }

      await startTypewriterSession(sessionId);
      await ensureBuiltinTypewriterKeys(sessionId, resolvedPlayerId);

      const typewriterKey = await findTypewriterKeyForSession({
        sessionId,
        playerId: resolvedPlayerId,
        keyId: requestedKeyId,
        keyText: requestedKeyText
      });

      if (!typewriterKey) {
        return res.status(404).json({ error: 'Typewriter key not found for this session.' });
      }

      const insertText = firstDefinedString(typewriterKey.insertText, typewriterKey.keyText);
      const candidate = buildTypewriterKeyCandidateNarrative(currentNarrative, insertText);
      const effectiveCandidateNarrative = firstDefinedString(candidateNarrative) || candidate.candidateNarrative;
      const appendedText = effectiveCandidateNarrative.slice(String(currentNarrative || '').length);
      const verificationPipeline = await getAiPipelineSettings('typewriter_key_verification');
      const verificationProvider = typeof verificationPipeline?.provider === 'string'
        ? verificationPipeline.provider
        : 'openai';
      const shouldMock = resolveMockMode(body, verificationPipeline.useMock);

      if (!currentNarrative.trim() || narrativeEndsWithTerm(currentNarrative, insertText)) {
        return res.status(200).json({
          allowed: false,
          appendedText,
          candidateNarrative: effectiveCandidateNarrative,
          key: buildTypewriterKeyState(typewriterKey),
          mocked: shouldMock,
          runtime: {
            pipeline: 'typewriter_key_verification',
            provider: verificationProvider,
            model: verificationPipeline.model || '',
            mocked: shouldMock
          }
        });
      }

      const linkedEntity = typewriterKey.entityId
        ? await NarrativeEntity.findById(typewriterKey.entityId).lean()
        : null;

      if (shouldMock) {
        const allowed = shouldAllowTypewriterKeyInMock(typewriterKey, currentNarrative);
        if (allowed) {
          await markTypewriterKeyPressed(typewriterKey?._id ? String(typewriterKey._id) : '');
        }
        return res.status(200).json({
          allowed,
          appendedText,
          candidateNarrative: effectiveCandidateNarrative,
          key: buildTypewriterKeyState(typewriterKey),
          mocked: true,
          runtime: {
            pipeline: 'typewriter_key_verification',
            provider: verificationProvider,
            model: verificationPipeline.model || '',
            mocked: true
          }
        });
      }

      try {
        const promptTemplate = await resolveTypewriterKeyVerificationPromptTemplate();
        const aiResponse = await callJsonLlm({
          prompts: buildTypewriterKeyVerificationPromptMessages(
            typewriterKey,
            linkedEntity,
            currentNarrative,
            effectiveCandidateNarrative,
            promptTemplate
          ),
          provider: verificationProvider,
          model: verificationPipeline.model || '',
          max_tokens: 220,
          explicitJsonObjectFormat: true
        });

        await validatePayloadForRoute('typewriter_key_verification', aiResponse);
        const allowed = Boolean(aiResponse.allowed);
        if (allowed) {
          await markTypewriterKeyPressed(typewriterKey?._id ? String(typewriterKey._id) : '');
        }

        return res.status(200).json({
          allowed,
          appendedText,
          candidateNarrative: effectiveCandidateNarrative,
          reason: firstDefinedString(aiResponse.reason),
          key: buildTypewriterKeyState(typewriterKey),
          mocked: false,
          runtime: {
            pipeline: 'typewriter_key_verification',
            provider: verificationProvider,
            model: verificationPipeline.model || '',
            mocked: false
          }
        });
      } catch (aiError) {
        console.error('Error in live /api/typewriter/keys/shouldAllow call:', aiError);
        return res.status(502).json({
          error: 'Live typewriter key verification failed.',
          details: aiError?.message || 'Unknown error',
          key: buildTypewriterKeyState(typewriterKey),
          runtime: {
            pipeline: 'typewriter_key_verification',
            provider: verificationProvider,
            model: verificationPipeline.model || '',
            mocked: false
          }
        });
      }
    } catch (error) {
      console.error('Error in /api/typewriter/keys/shouldAllow:', error);
      return sendLlmAwareError(res, error, 'Internal Server Error', 'error');
    }
  });

  app.post('/api/typewriter/session/start', async (req, res) => {
    try {
      const { sessionId, fragment, playerId, setInitialFragment } = req.body || {};
      const resolvedPlayerId = normalizeOptionalPlayerId(playerId);
      const session = await startTypewriterSession(sessionId);
      await ensureBuiltinTypewriterKeys(session.sessionId, resolvedPlayerId);
      if (typeof fragment === 'string') {
        const seededSession = await saveTypewriterSessionFragment(session.sessionId, fragment, {
          updateInitialFragment: Boolean(setInitialFragment)
        });
        return res.status(200).json(
          await buildTypewriterSessionPayload(
            session.sessionId,
            seededSession.fragment,
            seededSession.initialFragment,
            resolvedPlayerId
          )
        );
      }
      return res.status(200).json(
        await buildTypewriterSessionPayload(
          session.sessionId,
          session.fragment,
          session.initialFragment,
          resolvedPlayerId
        )
      );
    } catch (error) {
      console.error('Error in /api/typewriter/session/start:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/typewriter/session/inspect', async (req, res) => {
    try {
      const sessionId = firstDefinedString(req.query?.sessionId);
      const resolvedPlayerId = normalizeOptionalPlayerId(req.query?.playerId);

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const payload = await buildTypewriterSessionInspectPayload(sessionId, resolvedPlayerId);
      if (!payload) {
        return res.status(404).json({ message: 'Typewriter session not found.' });
      }

      return res.status(200).json(payload);
    } catch (error) {
      console.error('Error in GET /api/typewriter/session/inspect:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.post('/api/shouldCreateStorytellerKey', async (req, res) => {
    try {
      const body = req.body || {};
      const { sessionId, playerId } = body;
      const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      await startTypewriterSession(sessionId);
      await ensureBuiltinTypewriterKeys(sessionId, resolvedPlayerId);
      const fragmentText = await getTypewriterSessionFragment(sessionId);
      const narrativeWordCount = countWords(fragmentText);
      const storytellerPipeline = await getAiPipelineSettings('storyteller_creation');
      const illustrationPipeline = await getAiPipelineSettings('illustration_creation');
      const shouldMockStorytellers = resolveMockMode(body, storytellerPipeline.useMock);
      const shouldMockIllustrations = resolveMockMode(body, illustrationPipeline.useMock);
      const allowMockSlots = shouldMockStorytellers || shouldMockIllustrations;
      const assignedStorytellers = await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId);
      const effectiveAssignedStorytellers = filterAssignedTypewriterStorytellers(assignedStorytellers, {
        allowMockSlots
      });
      const nextAvailableSlot = findNextAvailableTypewriterStorytellerSlot(effectiveAssignedStorytellers);
      const currentAssignedCount = effectiveAssignedStorytellers.length;
      const currentThreshold = getTypewriterStorytellerThreshold(currentAssignedCount);
      const shouldCreate = Boolean(nextAvailableSlot && currentThreshold !== null && narrativeWordCount >= currentThreshold);

      let createdStoryteller = null;
      if (shouldCreate && nextAvailableSlot) {
        createdStoryteller = await generateTypewriterStorytellerForSlot({
          sessionId,
          playerId: resolvedPlayerId,
          fragmentText,
          slotDefinition: nextAvailableSlot,
          req,
          body
        });
      }

      const storytellers = createdStoryteller
        ? await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId)
        : effectiveAssignedStorytellers;
      const visibleStorytellers = filterAssignedTypewriterStorytellers(storytellers, { allowMockSlots });
      const filledCount = visibleStorytellers.length;
      const nextThreshold = getTypewriterStorytellerThreshold(filledCount);

      return res.status(200).json({
        sessionId,
        narrativeWordCount,
        checkIntervalWords: TYPEWRITER_STORYTELLER_CHECK_INTERVAL_WORDS,
        shouldCreate,
        created: Boolean(createdStoryteller),
        createdStoryteller: createdStoryteller ? buildStorytellerListItem(createdStoryteller) : null,
        assignedStorytellerCount: filledCount,
        nextThreshold,
        slots: buildTypewriterStorytellerSlots(visibleStorytellers, fragmentText.length),
        typewriterKeys: (await listTypewriterKeysForSession(sessionId, resolvedPlayerId)).map(buildTypewriterKeyState),
        entityKeys: (await listTypewriterKeysForSession(sessionId, resolvedPlayerId)).map(buildTypewriterKeyState)
      });
    } catch (error) {
      console.error('Error in /api/shouldCreateStorytellerKey:', error);
      const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
      return res.status(statusCode).json({
        message: statusCode === 500 ? 'Server error during storyteller key creation check.' : error.message
      });
    }
  });

  app.post('/api/send_storyteller_typewriter_text', async (req, res) => {
    try {
      const body = req.body || {};
      const { sessionId, storytellerId } = body;
      const slotIndexRaw = Number(body.slotIndex);
      const slotIndex = Number.isInteger(slotIndexRaw) ? slotIndexRaw : null;
      const resolvedPlayerId = normalizeOptionalPlayerId(body.playerId);

      if (!sessionId || (!storytellerId && slotIndex === null)) {
        return res.status(400).json({ error: 'Missing sessionId and storytellerId or slotIndex.' });
      }

      await startTypewriterSession(sessionId);
      await ensureBuiltinTypewriterKeys(sessionId, resolvedPlayerId);
      const fragmentText = await getTypewriterSessionFragment(sessionId);
      const storyteller = await findTypewriterStorytellerForIntervention(
        sessionId,
        storytellerId,
        slotIndex,
        resolvedPlayerId
      );
      const taskId = firstDefinedString(body.taskId);

      if (!storyteller) {
        return res.status(404).json({ error: 'Storyteller not found for this session.' });
      }

      const { task, assignment: taskAssignment } = await findStorytellerTaskAssignmentForRoute({
        sessionId,
        storytellerId: String(storyteller._id || storytellerId || ''),
        routePath: '/api/send_storyteller_typewriter_text',
        explicitTaskId: taskId,
        playerId: resolvedPlayerId
      });

      if (taskId && !task) {
        return res.status(404).json({ error: 'Task not found for this session.' });
      }

      const currentFragmentLength = fragmentText.length;
      let storytellerLockHeld = false;
      const lockedStoryteller = await acquireTypewriterStorytellerInterventionLock(
        storyteller._id,
        currentFragmentLength
      );

      if (!lockedStoryteller) {
        const visibleStorytellers = await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId);
        return res.status(409).json({
          error: 'Storyteller press is not allowed yet.',
          code: 'STORYTELLER_PRESS_NOT_ALLOWED',
          sessionId,
          currentFragmentLength,
          slots: buildTypewriterStorytellerSlots(visibleStorytellers, currentFragmentLength),
          storyteller: buildTypewriterSessionStorytellerItem(storyteller)
        });
      }

      storytellerLockHeld = true;
      const interventionPipeline = await getAiPipelineSettings('storyteller_intervention');
      const interventionProvider = typeof interventionPipeline?.provider === 'string'
        ? interventionPipeline.provider
        : 'openai';
      const shouldMock = resolveMockMode(body, interventionPipeline.useMock);
      const requestedFadeTimingScale = toFiniteNumber(body?.fadeTimingScale);
      const storytellerTask = resolveTaskPromptText(task);
      const taskContext = await resolveTaskKnowledgeContext(task, sessionId, resolvedPlayerId);

      try {
        let interventionResponse;
        if (shouldMock) {
          interventionResponse = buildMockStorytellerIntervention(lockedStoryteller, fragmentText, storytellerTask);
        } else {
          const promptTemplate = await resolveStorytellerInterventionPromptTemplate();
          interventionResponse = await callJsonLlm({
            prompts: buildStorytellerInterventionPromptMessages(
              lockedStoryteller,
              fragmentText,
              promptTemplate,
              storytellerTask,
              taskContext.knownContextText
            ),
            provider: interventionProvider,
            model: interventionPipeline.model || '',
            max_tokens: 1800,
            explicitJsonObjectFormat: true
          });
        }

        const continuation = firstDefinedString(interventionResponse?.continuation);
        if (!continuation) {
          return res.status(502).json({
            error: 'Storyteller intervention did not return valid continuation text.',
            runtime: {
              pipeline: 'storyteller_intervention',
              provider: interventionProvider,
              model: interventionPipeline.model || '',
              mocked: shouldMock
            }
          });
        }

        const rawEntity = interventionResponse?.entity && typeof interventionResponse.entity === 'object'
          ? interventionResponse.entity
          : null;
        if (!rawEntity || !firstDefinedString(rawEntity.name, rawEntity.key_text)) {
          return res.status(502).json({
            error: 'Storyteller intervention did not return a valid entity.',
            runtime: {
              pipeline: 'storyteller_intervention',
              provider: interventionProvider,
              model: interventionPipeline.model || '',
              mocked: shouldMock
            }
          });
        }

        const metadata = normalizeTypewriterMetadata(interventionResponse?.style)
          || pickRandomItem(TYPEWRITER_DEFAULT_FONTS)
          || TYPEWRITER_DEFAULT_FONTS[0];
        const nextFragment = mergeTypewriterFragment(fragmentText, continuation);
        const savedEntity = await saveTypewriterEntityFromIntervention({
          sessionId,
          playerId: resolvedPlayerId,
          storyteller: lockedStoryteller,
          entity: rawEntity
        });
        const savedTypewriterKey = await saveTypewriterKeyFromIntervention({
          sessionId,
          playerId: resolvedPlayerId,
          storyteller: lockedStoryteller,
          entity: savedEntity,
          keyText: rawEntity?.key_text,
          insertText: rawEntity?.insert_text
        });

        await saveTypewriterSessionFragment(sessionId, nextFragment);

        const updatedStoryteller = await Storyteller.findOneAndUpdate(
          { _id: lockedStoryteller._id },
          {
            $set: {
              introducedInTypewriter: true,
              lastTypewriterInterventionAt: new Date(),
              lastTypewriterPressAt: new Date(),
              lastTypewriterPressFragmentLength: nextFragment.length,
              typewriterInterventionInFlight: false
            },
            $inc: {
              typewriterInterventionsCount: 1
            }
          },
          { new: true }
        );
        storytellerLockHeld = false;

        const sessionTypewriterKeys = (await listTypewriterKeysForSession(sessionId, resolvedPlayerId)).map(buildTypewriterKeyState);
        const sessionStorytellers = await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId);
        const sessionSlots = buildTypewriterStorytellerSlots(sessionStorytellers, nextFragment.length);

        const continuationInsights = normalizeContinuationInsights(
          {
            meaning: [
              `${firstDefinedString(updatedStoryteller?.name, lockedStoryteller?.name)} briefly entered the narrative.`
            ],
            contextual_strengthening: `The intervention surfaced ${firstDefinedString(savedEntity?.name)} as a fresh point of interest in the scene.`,
            entities: [
              {
                entity_name: firstDefinedString(savedEntity?.name),
                ner_category: firstDefinedString(savedEntity?.type),
                ascope_pmesii: firstDefinedString(savedEntity?.subtype),
                reuse: false
              }
            ],
            style: metadata
          },
          continuation,
          metadata
        );

        return res.status(200).json({
          ...createTypewriterResponse(continuation, metadata, null, {
            narrativeWordCount: countWords(fragmentText),
            fadeTimingScale: requestedFadeTimingScale
          }),
          continuation_insights: continuationInsights,
          sessionId,
          fragment: nextFragment,
          mocked: shouldMock,
          storyteller: buildStorytellerListItem(updatedStoryteller || lockedStoryteller),
          task: task ? {
            id: String(task._id),
            taskId: firstDefinedString(task.taskId),
            title: firstDefinedString(task.title),
            brief: firstDefinedString(task.brief),
            knownEntityIds: Array.isArray(task.knownEntityIds) ? task.knownEntityIds : [],
            target: task.target || null
          } : null,
          taskContext: {
            knownEntities: Array.isArray(taskContext?.knownEntities) ? taskContext.knownEntities : []
          },
          taskAssignment: taskAssignment ? {
            id: String(taskAssignment._id),
            status: firstDefinedString(taskAssignment.status),
            assigneeType: firstDefinedString(taskAssignment.assigneeType),
            assigneeId: firstDefinedString(taskAssignment.assigneeId)
          } : null,
          slots: sessionSlots,
          typewriterKey: buildTypewriterKeyState(savedTypewriterKey),
          typewriterKeys: sessionTypewriterKeys,
          entityKey: buildTypewriterKeyState(savedTypewriterKey),
          entityKeys: sessionTypewriterKeys,
          runtime: {
            pipeline: 'storyteller_intervention',
            provider: interventionProvider,
            model: interventionPipeline.model || '',
            mocked: shouldMock
          }
        });
      } finally {
        if (storytellerLockHeld) {
          await Storyteller.findOneAndUpdate(
            { _id: lockedStoryteller._id },
            { $set: { typewriterInterventionInFlight: false } }
          );
        }
      }
    } catch (error) {
      console.error('Error in /api/send_storyteller_typewriter_text:', error);
      return sendLlmAwareError(res, error, 'Internal Server Error', 'error');
    }
  });

  app.post('/api/send_typewriter_text', async (req, res) => {
    try {
      const { sessionId, message } = req.body || {};
      if (!sessionId || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Missing sessionId or message' });
      }
      const requestedFadeTimingScale = toFiniteNumber(req.body?.fadeTimingScale);

      await startTypewriterSession(sessionId);

      const continuationPipeline = await getAiPipelineSettings('story_continuation');
      const continuationProvider = typeof continuationPipeline?.provider === 'string'
        ? continuationPipeline.provider
        : 'openai';
      const shouldMock = resolveMockMode(req.body, continuationPipeline.useMock);
      if (shouldMock) {
        const mockMetadata = pickRandomItem(TYPEWRITER_DEFAULT_FONTS) || TYPEWRITER_DEFAULT_FONTS[0];
        const continuation = buildMockContinuation(message);
        const nextFragment = mergeTypewriterFragment(message, continuation);
        const narrativeWordCount = countWords(message);
        const continuationInsights = normalizeContinuationInsights({}, continuation, mockMetadata);
        await saveTypewriterSessionFragment(sessionId, nextFragment);
        return res.status(200).json({
          ...createTypewriterResponse(continuation, mockMetadata, null, {
            narrativeWordCount,
            fadeTimingScale: requestedFadeTimingScale
          }),
          continuation_insights: continuationInsights,
          sessionId,
          fragment: nextFragment,
          mocked: true,
          runtime: {
            pipeline: 'story_continuation',
            provider: continuationProvider,
            model: continuationPipeline.model || '',
            mocked: true
          }
        });
      }

      try {
        const continuationPromptDoc = await getLatestPromptTemplate('story_continuation');
        const prompt = buildTypewriterPromptMessages(message, continuationPromptDoc?.promptTemplate || '');
        const aiResponse = await callJsonLlm({
          prompts: prompt,
          provider: continuationProvider,
          model: continuationPipeline.model || '',
          max_tokens: 2500,
          explicitJsonObjectFormat: true
        });
        const continuation = typeof aiResponse?.continuation === 'string' && aiResponse.continuation.trim()
          ? aiResponse.continuation.trim()
          : '';
        if (!continuation) {
          return res.status(502).json({
            error: 'Live typewriter continuation did not return valid content.',
            runtime: {
              pipeline: 'story_continuation',
              provider: continuationProvider,
              model: continuationPipeline.model || '',
              mocked: false
            }
          });
        }
        const metadata = normalizeTypewriterMetadata(aiResponse?.style || aiResponse?.metadata)
          || pickRandomItem(TYPEWRITER_DEFAULT_FONTS)
          || TYPEWRITER_DEFAULT_FONTS[0];
        const nextFragment = mergeTypewriterFragment(message, continuation);
        const narrativeWordCount = countWords(message);
        const continuationInsights = normalizeContinuationInsights(aiResponse, continuation, metadata);

        await saveTypewriterSessionFragment(sessionId, nextFragment);

        return res.status(200).json({
          ...createTypewriterResponse(continuation, metadata, null, {
            narrativeWordCount,
            fadeTimingScale: requestedFadeTimingScale
          }),
          continuation_insights: continuationInsights,
          sessionId,
          fragment: nextFragment,
          mocked: false,
          runtime: {
            pipeline: 'story_continuation',
            provider: continuationProvider,
            model: continuationPipeline.model || '',
            mocked: false
          }
        });
      } catch (aiError) {
        console.error('Error in live /api/send_typewriter_text call:', aiError);
        return res.status(502).json({
          error: 'Live typewriter continuation failed.',
          details: aiError?.message || 'Unknown error',
          runtime: {
            pipeline: 'story_continuation',
            provider: continuationProvider,
            model: continuationPipeline.model || '',
            mocked: false
          }
        });
      }
    } catch (error) {
      console.error('Error in /api/send_typewriter_text:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}

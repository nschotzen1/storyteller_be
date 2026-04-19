export function registerSeerRoutes(app, deps) {
  const {
    firstDefinedString,
    normalizeOptionalPlayerId,
    randomUUID,
    resolveFragmentText,
    resolveWorldContextForSession,
    resolveSeerReadingMemories,
    chooseSeerVisionSourceMemory,
    selectSeerRuntimeMemories,
    buildSeerReadingMemory,
    chooseInitialSeerFocusMemoryId,
    NarrativeEntity,
    applyOptionalPlayerId,
    buildSeerReadingEntity,
    getPipelineSettings,
    resolveMockMode,
    normalizeSeerCardCount,
    normalizeSeerStringArray,
    resolveSeerCardKinds,
    generateSeerReadingCardDrafts,
    buildSeerReadingCardFromDraft,
    listTypewriterSlotStorytellers,
    buildSeerReadingApparition,
    buildSeerVision,
    buildSeerReadingSpread,
    SeerReading,
    normalizeSeerReadingPayload,
    runSeerReadingTurn,
    findSeerReadingEntityByCard,
    resolveCanonicalEntityForClaim,
    upsertNarrativeEntityFromSeerClaim,
    buildClaimedEntityLink,
    findNextSeerClaimFocusCard,
    createSeerTranscriptEntry,
    buildClaimedSeerCardRecord,
    buildSeerCardLayout,
    buildSeerOrchestratorEnvelope,
    synthesizeCharacterSheetFromSeerClaim,
    toImmersiveRpgCharacterSheetPayload,
    executeSeerCardClaimAction,
    executeStorytellerMissionAction
  } = deps;

  app.post('/api/seer/readings', async (req, res) => {
    try {
      const body = req.body || {};
      const sessionId = firstDefinedString(body.sessionId);
      const resolvedPlayerId = normalizeOptionalPlayerId(body.playerId);
      const readingId = firstDefinedString(body.readingId) || randomUUID();
      const batchId = firstDefinedString(body.batchId);
      const fragmentText = await resolveFragmentText(body);
      const { worldId, universeId } = await resolveWorldContextForSession(
        sessionId,
        resolvedPlayerId,
        body.worldId,
        body.universeId
      );

      if (!sessionId || !fragmentText) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or text.' });
      }

      const sourceMemories = await resolveSeerReadingMemories(sessionId, resolvedPlayerId, batchId);
      if (!sourceMemories.length) {
        return res.status(409).json({
          message: 'Seer readings require at least 1 memory in the selected session or batch.'
        });
      }

      const visionSourceMemory = chooseSeerVisionSourceMemory(sourceMemories, req.body?.visionMemoryId);
      const runtimeSourceMemories = selectSeerRuntimeMemories(sourceMemories, visionSourceMemory);
      const runtimeMemories = runtimeSourceMemories.map(({ slot, memory }) => buildSeerReadingMemory(memory, slot, false));
      const focusMemoryId = chooseInitialSeerFocusMemoryId(runtimeMemories);
      const hydratedMemories = runtimeMemories.map((memory) => ({
        ...memory,
        focusState: memory.id === focusMemoryId ? 'active' : 'idle'
      }));

      const seedEntities = (await NarrativeEntity.find(
        applyOptionalPlayerId({ session_id: sessionId }, resolvedPlayerId)
      )
        .sort({ createdAt: -1 })
        .limit(12)
        .lean())
        .map(buildSeerReadingEntity);

      const cardPipeline = await getPipelineSettings('seer_reading_card_generation');
      const shouldMockCards = resolveMockMode(body, cardPipeline?.useMock);
      const requestedCardCount = normalizeSeerCardCount(req.body?.cardCount, cardPipeline?.cardCount || 3);
      const explicitCardKinds = normalizeSeerStringArray(req.body?.cardKinds);
      const preferredCardKinds = normalizeSeerStringArray(req.body?.preferredCardKinds);
      const allowedCardKinds = normalizeSeerStringArray(req.body?.allowedCardKinds);
      const resolvedCardKinds = resolveSeerCardKinds({
        cardCount: requestedCardCount,
        explicitKinds: explicitCardKinds,
        preferredKinds: preferredCardKinds,
        allowedKinds: allowedCardKinds,
        visionMemory: visionSourceMemory || {}
      });
      const cardGeneration = await generateSeerReadingCardDrafts({
        fragmentText,
        visionMemory: visionSourceMemory || {},
        knownEntities: seedEntities,
        cardCount: requestedCardCount,
        cardKinds: resolvedCardKinds,
        preferredCardKinds,
        allowedCardKinds,
        forceMock: shouldMockCards
      });
      const cards = (Array.isArray(cardGeneration?.cards) ? cardGeneration.cards : []).map((draft, index) =>
        buildSeerReadingCardFromDraft(visionSourceMemory || {}, draft, index, index === 0)
      );
      const focusCardId = cards.find((card) => card.focusState === 'active')?.id || cards[0]?.id || '';

      const apparitions = (await listTypewriterSlotStorytellers(sessionId, resolvedPlayerId))
        .map(buildSeerReadingApparition);

      const openingMessage = cards.length === 1
        ? 'The thread blurs, then gathers. A single card answers the vision.'
        : `The thread blurs, then gathers. ${cards.length} cards answer the vision.`;
      const transcript = [
        {
          id: randomUUID(),
          role: 'seer',
          kind: 'invocation',
          content: openingMessage,
          createdAt: new Date().toISOString()
        }
      ];

      const payload = {
        readingId,
        sessionId,
        playerId: resolvedPlayerId,
        worldId,
        universeId,
        status: 'active',
        beat: 'cards_revealed',
        fragment: {
          text: fragmentText,
          anchorLabel: 'Fragment'
        },
        vision: {
          ...buildSeerVision(visionSourceMemory || {}),
          summary: firstDefinedString(cardGeneration?.visionSummary)
        },
        seer: {
          personaId: 'default-seer',
          voice: 'ritual witness'
        },
        memories: hydratedMemories,
        cards,
        entities: seedEntities,
        apparitions,
        spread: buildSeerReadingSpread(fragmentText, hydratedMemories, focusMemoryId, cards, focusCardId),
        transcript,
        claimedCards: [],
        claimedEntityLinks: [],
        unresolvedThreads: [],
        worldbuildingOutputs: [],
        metadata: {
          specVersion: 'seer-reading-v1-alpha',
          batchId,
          observableMilestone: 'M1',
          demoMockMode: Boolean(shouldMockCards),
          visionMemoryId: String(visionSourceMemory?._id || visionSourceMemory?.id || ''),
          cardConfig: {
            requestedCount: requestedCardCount,
            generatedCount: cards.length,
            explicitKinds: explicitCardKinds,
            preferredKinds: preferredCardKinds,
            allowedKinds: allowedCardKinds,
            generatedKinds: cards.map((card) => card.kind),
            generationMode: firstDefinedString(cardGeneration?.generationMode, 'deterministic_seed'),
            usedFallback: Boolean(cardGeneration?.usedFallback),
            errorMessage: firstDefinedString(cardGeneration?.errorMessage),
            promptText: firstDefinedString(cardGeneration?.promptText),
            pipeline: cardGeneration?.runtime || {
              key: 'seer_reading_card_generation',
              provider: firstDefinedString(cardPipeline?.provider, 'openai'),
              model: firstDefinedString(cardPipeline?.model),
              useMock: Boolean(shouldMockCards)
            }
          }
        }
      };

      const readingDoc = await SeerReading.findOneAndUpdate(
        applyOptionalPlayerId({ readingId }, resolvedPlayerId),
        payload,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(201).json(normalizeSeerReadingPayload(readingDoc));
    } catch (error) {
      console.error('Error in /api/seer/readings:', error);
      return res.status(500).json({ message: 'Server error while creating seer reading.' });
    }
  });

  app.get('/api/seer/readings/:readingId', async (req, res) => {
    try {
      const readingId = firstDefinedString(req.params?.readingId);
      const resolvedPlayerId = normalizeOptionalPlayerId(req.query?.playerId);

      if (!readingId) {
        return res.status(400).json({ message: 'Missing required parameter: readingId.' });
      }

      const reading = await SeerReading.findOne(
        applyOptionalPlayerId({ readingId }, resolvedPlayerId)
      ).lean();

      if (!reading) {
        return res.status(404).json({ message: 'Seer reading not found.' });
      }

      return res.status(200).json(normalizeSeerReadingPayload(reading));
    } catch (error) {
      console.error('Error in /api/seer/readings/:readingId:', error);
      return res.status(500).json({ message: 'Server error while loading seer reading.' });
    }
  });

  app.post('/api/seer/readings/:readingId/turn', async (req, res) => {
    try {
      const readingId = firstDefinedString(req.params?.readingId);
      const body = req.body || {};
      const resolvedPlayerId = normalizeOptionalPlayerId(body.playerId);
      const action = firstDefinedString(body.action, 'answer');
      const safeMessage = firstDefinedString(body.message);
      const requestedFocusMemoryId = firstDefinedString(body.focusMemoryId);
      const requestedFocusCardId = firstDefinedString(body.focusCardId);
      const requestedEntityId = firstDefinedString(body.entityId);

      if (!readingId) {
        return res.status(400).json({ message: 'Missing required parameter: readingId.' });
      }

      const reading = await SeerReading.findOne(
        applyOptionalPlayerId({ readingId }, resolvedPlayerId)
      );

      if (!reading) {
        return res.status(404).json({ message: 'Seer reading not found.' });
      }

      if (firstDefinedString(reading.status) !== 'active') {
        return res.status(409).json({ message: 'Seer reading is already closed.' });
      }

      if (action === 'focus_card') {
        if (!requestedFocusCardId || !Array.isArray(reading.cards) || !reading.cards.some((card) => card.id === requestedFocusCardId)) {
          return res.status(400).json({ message: 'Missing or unknown focusCardId for focus_card action.' });
        }
      } else if (action === 'focus_memory') {
        if (!requestedFocusMemoryId || !Array.isArray(reading.memories) || !reading.memories.some((memory) => memory.id === requestedFocusMemoryId)) {
          return res.status(400).json({ message: 'Missing or unknown focusMemoryId for focus_memory action.' });
        }
      } else {
        if (!safeMessage) {
          return res.status(400).json({ message: 'Missing required parameter: message.' });
        }
      }

      const effectiveMockMode = resolveMockMode(body, Boolean(reading?.metadata?.demoMockMode));

      const runtimeResult = await runSeerReadingTurn({
        reading: typeof reading.toObject === 'function' ? reading.toObject() : reading,
        playerId: resolvedPlayerId,
        action,
        message: safeMessage,
        focusMemoryId: requestedFocusMemoryId,
        focusCardId: requestedFocusCardId,
        entityId: requestedEntityId,
        mock: effectiveMockMode,
        runtimeActions: {
          claimCard: async ({ reading: runtimeReading, playerId: actionPlayerId, cardId }) => executeSeerCardClaimAction({
            reading: runtimeReading,
            playerId: actionPlayerId || resolvedPlayerId,
            cardId
          }),
          invokeStoryteller: async (params = {}) => executeStorytellerMissionAction({
            ...params,
            playerId: params.playerId || resolvedPlayerId,
            mock: typeof params.mock === 'boolean' ? params.mock : effectiveMockMode
          })
        }
      });
      const nextReadingFields = runtimeResult?.nextReadingFields || {};

      reading.memories = Array.isArray(nextReadingFields.memories) ? nextReadingFields.memories : [];
      reading.cards = Array.isArray(nextReadingFields.cards) ? nextReadingFields.cards : [];
      reading.entities = Array.isArray(nextReadingFields.entities) ? nextReadingFields.entities : [];
      reading.claimedCards = Array.isArray(nextReadingFields.claimedCards) ? nextReadingFields.claimedCards : [];
      reading.claimedEntityLinks = Array.isArray(nextReadingFields.claimedEntityLinks) ? nextReadingFields.claimedEntityLinks : [];
      reading.spread = nextReadingFields.spread || {};
      reading.transcript = Array.isArray(nextReadingFields.transcript) ? nextReadingFields.transcript : [];
      reading.unresolvedThreads = Array.isArray(nextReadingFields.unresolvedThreads) ? nextReadingFields.unresolvedThreads : [];
      reading.worldbuildingOutputs = Array.isArray(nextReadingFields.worldbuildingOutputs) ? nextReadingFields.worldbuildingOutputs : [];
      reading.beat = firstDefinedString(nextReadingFields.beat, reading.beat, 'seer_question_pending');
      reading.version = Number.isFinite(Number(reading.version)) ? Number(reading.version) + 1 : 2;
      reading.metadata = {
        ...(reading.metadata || {}),
        observableMilestone: 'M4',
        demoMockMode: Boolean(effectiveMockMode),
        lastTurn: nextReadingFields.lastTurn || null,
        orchestrator: nextReadingFields.orchestrator || null
      };

      await reading.save();

      const responsePayload = normalizeSeerReadingPayload(reading);
      if (runtimeResult?.characterSheet) {
        responsePayload.characterSheet = runtimeResult.characterSheet;
      }
      if (runtimeResult?.storytellerMission) {
        responsePayload.storytellerMission = runtimeResult.storytellerMission;
      }

      return res.status(200).json(responsePayload);
    } catch (error) {
      if (Number.isInteger(error?.statusCode)) {
        return res.status(error.statusCode).json({ message: error.message || 'Request failed.' });
      }
      console.error('Error in /api/seer/readings/:readingId/turn:', error);
      return res.status(500).json({ message: 'Server error while advancing seer reading.' });
    }
  });

  app.post('/api/seer/readings/:readingId/cards/:cardId/claim', async (req, res) => {
    try {
      const readingId = firstDefinedString(req.params?.readingId);
      const cardId = firstDefinedString(req.params?.cardId);
      const body = req.body || {};
      const resolvedPlayerId = normalizeOptionalPlayerId(body.playerId);

      if (!readingId || !cardId) {
        return res.status(400).json({ message: 'Missing required parameters: readingId or cardId.' });
      }

      const reading = await SeerReading.findOne(
        applyOptionalPlayerId({ readingId }, resolvedPlayerId)
      );

      if (!reading) {
        return res.status(404).json({ message: 'Seer reading not found.' });
      }

      if (firstDefinedString(reading.status) !== 'active') {
        return res.status(409).json({ message: 'Seer reading is already closed.' });
      }

      const claimResult = await executeSeerCardClaimAction({
        reading,
        playerId: resolvedPlayerId,
        cardId
      });

      reading.cards = Array.isArray(claimResult?.nextReadingFields?.cards) ? claimResult.nextReadingFields.cards : [];
      reading.claimedCards = Array.isArray(claimResult?.nextReadingFields?.claimedCards) ? claimResult.nextReadingFields.claimedCards : [];
      reading.claimedEntityLinks = Array.isArray(claimResult?.nextReadingFields?.claimedEntityLinks) ? claimResult.nextReadingFields.claimedEntityLinks : [];
      reading.entities = Array.isArray(claimResult?.nextReadingFields?.entities) ? claimResult.nextReadingFields.entities : [];
      reading.transcript = Array.isArray(claimResult?.nextReadingFields?.transcript) ? claimResult.nextReadingFields.transcript : [];
      reading.spread = claimResult?.nextReadingFields?.spread || {};
      reading.beat = firstDefinedString(claimResult?.nextReadingFields?.beat, reading.beat, 'cross_memory_synthesis');
      reading.version = Number.isFinite(Number(reading.version)) ? Number(reading.version) + 1 : 2;

      const orchestrator = await buildSeerOrchestratorEnvelope({
        ...(claimResult?.nextReadingSnapshot || (typeof reading.toObject === 'function' ? reading.toObject() : reading)),
        cards: reading.cards,
        claimedCards: reading.claimedCards,
        claimedEntityLinks: reading.claimedEntityLinks,
        entities: reading.entities,
        spread: reading.spread,
        transcript: reading.transcript,
        beat: reading.beat
      });
      const lastTurn = {
        transitionType: claimResult?.turnSummary?.transitionType || 'card_claimed',
        spokenMessage: claimResult?.turnSummary?.spokenMessage || '',
        focusMemoryId: claimResult?.turnSummary?.focusMemoryId || firstDefinedString(reading?.spread?.focusMemoryId),
        focusCardId: claimResult?.turnSummary?.focusCardId || '',
        claimedCardIds: Array.isArray(claimResult?.turnSummary?.claimedCardIds) ? claimResult.turnSummary.claimedCardIds : [cardId],
        claimedEntityLinks: Array.isArray(claimResult?.turnSummary?.claimedEntityLinks) ? claimResult.turnSummary.claimedEntityLinks : [],
        toolCalls: [
          {
            tool_id: 'claim_card',
            input: {
              card_id: cardId,
              entity_external_id: firstDefinedString(claimResult?.claimedEntityLink?.entityExternalId)
            },
            reason: 'Player sealed a fully revealed card into the reading.'
          }
        ],
        availableToolIds: orchestrator.availableTools.map((tool) => tool.id),
        runtimeId: orchestrator.runtimeId,
        personaId: orchestrator.persona.id,
        createdEntityPromptText: '',
        createdEntityMocked: false,
        decisionSource: 'direct_claim_route',
        executionTrace: [
          {
            toolId: 'claim_card',
            status: 'executed',
            reason: 'Player sealed a fully revealed card into the reading.',
            input: {
              cardId,
              entityExternalId: firstDefinedString(claimResult?.claimedEntityLink?.entityExternalId)
            }
          }
        ]
      };

      reading.metadata = {
        ...(reading.metadata || {}),
        observableMilestone: 'M5',
        lastTurn,
        orchestrator
      };

      await reading.save();
      const responsePayload = normalizeSeerReadingPayload(reading);
      if (claimResult?.characterSheet) {
        responsePayload.characterSheet = claimResult.characterSheet;
      }

      return res.status(200).json(responsePayload);
    } catch (error) {
      if (Number.isInteger(error?.statusCode)) {
        return res.status(error.statusCode).json({ message: error.message || 'Request failed.' });
      }
      console.error('Error in /api/seer/readings/:readingId/cards/:cardId/claim:', error);
      return res.status(500).json({ message: 'Server error while claiming seer card.' });
    }
  });

  app.post('/api/seer/readings/:readingId/close', async (req, res) => {
    try {
      const readingId = firstDefinedString(req.params?.readingId);
      const resolvedPlayerId = normalizeOptionalPlayerId(req.body?.playerId);
      const closeReason = firstDefinedString(req.body?.reason, 'closed_by_user');

      if (!readingId) {
        return res.status(400).json({ message: 'Missing required parameter: readingId.' });
      }

      const reading = await SeerReading.findOneAndUpdate(
        applyOptionalPlayerId({ readingId }, resolvedPlayerId),
        {
          $set: {
            status: 'closed',
            beat: 'reading_closed',
            'metadata.closedReason': closeReason,
            'metadata.closedAt': new Date().toISOString()
          },
          $push: {
            transcript: {
              id: randomUUID(),
              role: 'system',
              kind: 'closure',
              content: `Reading closed: ${closeReason}.`,
              createdAt: new Date().toISOString()
            }
          },
          $inc: { version: 1 }
        },
        { new: true }
      );

      if (!reading) {
        return res.status(404).json({ message: 'Seer reading not found.' });
      }

      return res.status(200).json(normalizeSeerReadingPayload(reading));
    } catch (error) {
      console.error('Error in /api/seer/readings/:readingId/close:', error);
      return res.status(500).json({ message: 'Server error while closing seer reading.' });
    }
  });
}

export function registerNarrativeRoutes(app, deps) {
  const {
    Storyteller,
    NarrativeEntity,
    applyOptionalPlayerId,
    matchesOptionalPlayerId,
    buildStorytellerListItem,
    parseOptionalBooleanQuery,
    escapeRegexPattern,
    firstDefinedString,
    normalizeOptionalPlayerId,
    findEntityById,
    getAiPipelineSettings,
    getLatestPromptTemplate,
    resolveMockMode,
    resolveImageMockMode,
    textToEntityFromText,
    normalizeEntityCount,
    normalizeDesiredEntityCategories,
    validatePayloadForRoute,
    normalizeStorytellerCount,
    buildMockStorytellers,
    renderPromptTemplateString,
    getRouteConfig,
    renderPrompt,
    callJsonLlm,
    normalizeGeneratedStorytellerPayload,
    pickMockStorytellerIllustrationUrl,
    pickMockStorytellerKeyUrl,
    createStoryTellerKey,
    createStorytellerIllustration,
    path,
    resolveSchemaErrorMessage,
    sendLlmAwareError,
    resolveFragmentText,
    updateNarrativeEntityAfterStorytellerMission,
    ensureImmersiveRpgCharacterSheet,
    buildStorytellerMissionCharacterSheetPatch,
    toImmersiveRpgCharacterSheetPayload
  } = deps;

  app.get('/api/storytellers', async (req, res) => {
    try {
      const { sessionId, playerId } = req.query;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const storytellers = await Storyteller.find(
        applyOptionalPlayerId({ session_id: sessionId }, playerId)
      ).sort({ createdAt: 1 });
      const response = storytellers.map((storyteller) => buildStorytellerListItem(storyteller));

      return res.status(200).json({ sessionId, storytellers: response });
    } catch (error) {
      console.error('Error in /api/storytellers:', error);
      return res.status(500).json({ message: 'Server error during storyteller listing.' });
    }
  });

  app.get('/api/storytellers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { sessionId, playerId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }
      const storyteller = await Storyteller.findById(id);
      if (!storyteller) {
        return res.status(404).json({ message: 'Storyteller not found.' });
      }
      if (storyteller.session_id !== sessionId || !matchesOptionalPlayerId(storyteller.playerId, playerId)) {
        return res.status(404).json({ message: 'Storyteller not found.' });
      }

      const storytellerPayload = storyteller.toObject ? storyteller.toObject() : JSON.parse(JSON.stringify(storyteller));
      storytellerPayload.iconUrl = storytellerPayload.keyImageUrl || storytellerPayload.illustration || '';
      return res.status(200).json({ storyteller: storytellerPayload });
    } catch (error) {
      console.error('Error in /api/storytellers/:id:', error);
      return res.status(500).json({ message: 'Server error during storyteller fetch.' });
    }
  });

  app.get('/api/entities', async (req, res) => {
    try {
      const {
        sessionId,
        playerId,
        mainEntityId,
        isSubEntity,
        source,
        type,
        subtype,
        externalId,
        worldId,
        universeId,
        name,
        tag,
        canonicalStatus,
        linkedReadingId,
        introducedByStorytellerId,
        activeInTypewriter,
        typewriterKeyText,
        sort,
        limit
      } = req.query;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const query = applyOptionalPlayerId({ session_id: sessionId }, playerId);
      if (mainEntityId) {
        query.mainEntityId = mainEntityId;
      }
      const parsedIsSubEntity = parseOptionalBooleanQuery(isSubEntity);
      if (parsedIsSubEntity !== undefined) {
        query.isSubEntity = parsedIsSubEntity;
      }
      if (source) query.source = String(source);
      if (type) query.type = String(type);
      if (subtype) query.subtype = String(subtype);
      if (externalId) query.externalId = String(externalId);
      if (worldId) query.worldId = String(worldId);
      if (universeId) query.universeId = String(universeId);
      if (canonicalStatus) query.canonicalStatus = String(canonicalStatus);
      if (linkedReadingId) query.sourceReadingIds = String(linkedReadingId);
      if (introducedByStorytellerId) query.introducedByStorytellerId = String(introducedByStorytellerId);
      const parsedActiveInTypewriter = parseOptionalBooleanQuery(activeInTypewriter);
      if (parsedActiveInTypewriter !== undefined) {
        query.activeInTypewriter = parsedActiveInTypewriter;
      }
      if (typewriterKeyText) query.typewriterKeyText = String(typewriterKeyText);
      if (name) {
        query.name = { $regex: escapeRegexPattern(String(name)), $options: 'i' };
      }
      if (tag) {
        query.tags = { $regex: escapeRegexPattern(String(tag)), $options: 'i' };
      }

      const safeLimit = Number.isFinite(Number(limit))
        ? Math.max(1, Math.min(200, Math.floor(Number(limit))))
        : 0;
      const normalizedSort = firstDefinedString(sort).toLowerCase();
      const sortSpec = normalizedSort === 'reuse'
        ? { reuseCount: -1, lastUsedAt: -1, createdAt: -1 }
        : { createdAt: -1 };

      let entitiesQuery = NarrativeEntity.find(query).sort(sortSpec);
      if (safeLimit) {
        entitiesQuery = entitiesQuery.limit(safeLimit);
      }

      const entities = await entitiesQuery.exec();
      return res.status(200).json({
        sessionId,
        playerId: normalizeOptionalPlayerId(playerId),
        count: entities.length,
        entities
      });
    } catch (error) {
      console.error('Error in /api/entities:', error);
      return res.status(500).json({ message: 'Server error during entity listing.' });
    }
  });

  app.post('/api/entities/:id/refresh', async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};
      const { sessionId, playerId, note } = body;
      const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

      if (!sessionId) {
        return res.status(400).json({ message: 'Missing required parameter: sessionId.' });
      }

      const entity = await findEntityById(sessionId, resolvedPlayerId, id);
      if (!entity || entity.session_id !== sessionId || !matchesOptionalPlayerId(entity.playerId, resolvedPlayerId)) {
        return res.status(404).json({ message: 'Entity not found.' });
      }

      const promptText = [
        `Expand sub-entities related to "${entity.name}".`,
        entity.description ? `Description: ${entity.description}` : '',
        entity.lore ? `Lore: ${entity.lore}` : '',
        note ? `GM note: ${note}` : ''
      ].filter(Boolean).join('\n');

      const entityPipeline = await getAiPipelineSettings('entity_creation');
      const entityProvider = typeof entityPipeline?.provider === 'string' ? entityPipeline.provider : 'openai';
      const entityPromptDoc = await getLatestPromptTemplate('entity_creation');
      const shouldMock = resolveMockMode(body, entityPipeline.useMock);
      const subEntityResult = await textToEntityFromText({
        sessionId,
        playerId: resolvedPlayerId,
        text: promptText,
        includeCards: false,
        debug: shouldMock,
        llmModel: entityPipeline.model,
        llmProvider: entityProvider,
        entityPromptTemplate: entityPromptDoc?.promptTemplate || '',
        mainEntityId: entity.externalId || String(entity._id),
        isSubEntity: true
      });

      const subEntityExternalIds = (subEntityResult?.entities || [])
        .map((subEntity) => subEntity.externalId || subEntity.id)
        .filter(Boolean)
        .map((value) => String(value));

      const savedSubEntities = subEntityExternalIds.length
        ? await NarrativeEntity.find(
          applyOptionalPlayerId(
            {
              session_id: sessionId,
              externalId: { $in: subEntityExternalIds },
              mainEntityId: entity.externalId || String(entity._id)
            },
            resolvedPlayerId
          )
        )
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

  app.post('/api/textToEntity', async (req, res) => {
    try {
      const body = req.body || {};
      const {
        sessionId,
        playerId,
        count,
        numberOfEntities,
        desiredEntityCategories,
        includeCards,
        includeFront,
        includeBack
      } = body;
      const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

      const fragmentText = await resolveFragmentText(body);

      if (!sessionId || !fragmentText) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or text.' });
      }

      const entityPipeline = await getAiPipelineSettings('entity_creation');
      const texturePipeline = await getAiPipelineSettings('texture_creation');
      const entityProvider = typeof entityPipeline?.provider === 'string' ? entityPipeline.provider : 'openai';
      const textureProvider = typeof texturePipeline?.provider === 'string' ? texturePipeline.provider : 'openai';
      const entityPromptDoc = await getLatestPromptTemplate('entity_creation');
      const entityFrontPromptDoc = await getLatestPromptTemplate('entity_card_front');
      const texturePromptDoc = await getLatestPromptTemplate('texture_creation');
      const entityCount = normalizeEntityCount(
        count ?? numberOfEntities,
        normalizeEntityCount(entityPipeline.entityCount, 8)
      );
      const normalizedDesiredEntityCategories = normalizeDesiredEntityCategories(desiredEntityCategories);
      const shouldMockEntities = resolveMockMode(body, entityPipeline.useMock);
      const shouldMockTextures = resolveImageMockMode(body, texturePipeline.useMock, [
        'mockImage',
        'mockTextures'
      ]);
      const options = {
        sessionId,
        playerId: resolvedPlayerId,
        text: fragmentText,
        entityCount,
        desiredEntityCategories: normalizedDesiredEntityCategories,
        includeCards: includeCards === undefined ? false : Boolean(includeCards),
        includeFront: includeFront === undefined ? true : Boolean(includeFront),
        includeBack: includeBack === undefined ? true : Boolean(includeBack),
        debug: shouldMockEntities,
        llmModel: entityPipeline.model,
        llmProvider: entityProvider,
        textureModel: texturePipeline.model,
        mockTextures: shouldMockTextures,
        entityPromptTemplate: entityPromptDoc?.promptTemplate || '',
        frontPromptTemplate: entityFrontPromptDoc?.promptTemplate || '',
        texturePromptTemplate: texturePromptDoc?.promptTemplate || ''
      };

      const result = await textToEntityFromText(options);
      await validatePayloadForRoute('text_to_entity', { entities: result.entities || [] });

      const response = {
        sessionId,
        count: result.entities?.length || 0,
        requestedCount: entityCount,
        desiredEntityCategories: result.desiredEntityCategories || normalizedDesiredEntityCategories,
        entities: result.entities,
        mocked: result.mocked,
        mockedEntities: result.mockedEntities,
        mockedTextures: result.mockedTextures,
        runtime: {
          generation: {
            pipeline: 'entity_creation',
            provider: entityProvider,
            model: entityPipeline.model || '',
            mocked: shouldMockEntities
          },
          textures: {
            pipeline: 'texture_creation',
            provider: textureProvider,
            model: texturePipeline.model || '',
            mocked: shouldMockTextures
          }
        }
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

  app.post('/api/textToStoryteller', async (req, res) => {
    try {
      const body = req.body || {};
      const {
        sessionId,
        playerId,
        count,
        numberOfStorytellers,
        generateKeyImages
      } = body;
      const resolvedPlayerId = normalizeOptionalPlayerId(playerId);
      const fragmentText = await resolveFragmentText(body);

      if (!sessionId || !fragmentText) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or text.' });
      }

      const shouldGenerateKeyImages = generateKeyImages === undefined ? true : Boolean(generateKeyImages);
      const storytellerPipeline = await getAiPipelineSettings('storyteller_creation');
      const illustrationPipeline = await getAiPipelineSettings('illustration_creation');
      const storytellerProvider = typeof storytellerPipeline?.provider === 'string' ? storytellerPipeline.provider : 'openai';
      const illustrationProvider = typeof illustrationPipeline?.provider === 'string' ? illustrationPipeline.provider : 'openai';
      const storytellerCount = normalizeStorytellerCount(
        count ?? numberOfStorytellers ?? storytellerPipeline.storytellerCount
      );
      const storytellerPromptDoc = await getLatestPromptTemplate('storyteller_creation');
      const storytellerKeyPromptDoc = await getLatestPromptTemplate('storyteller_key_creation');
      const illustrationPromptDoc = await getLatestPromptTemplate('illustration_creation');
      const shouldMockStorytellers = resolveMockMode(body, storytellerPipeline.useMock);
      const shouldMockIllustrations = resolveImageMockMode(body, illustrationPipeline.useMock, [
        'mockImage',
        'mockIllustrations'
      ]);
      let storytellerDataArray;

      if (shouldMockStorytellers) {
        storytellerDataArray = buildMockStorytellers(storytellerCount, fragmentText);
      } else {
        let prompt = '';
        if (storytellerPromptDoc?.promptTemplate) {
          prompt = renderPromptTemplateString(storytellerPromptDoc.promptTemplate, {
            fragmentText,
            storytellerCount
          });
        } else {
          const routeConfig = await getRouteConfig('text_to_storyteller');
          prompt = renderPrompt(routeConfig.promptTemplate, {
            fragmentText,
            storytellerCount
          });
        }
        storytellerDataArray = await callJsonLlm({
          prompts: [{ role: 'system', content: prompt }],
          provider: storytellerProvider,
          model: storytellerPipeline.model || '',
          max_tokens: 2500,
          explicitJsonObjectFormat: true
        });
      }

      const normalizedStorytellers = Array.isArray(storytellerDataArray)
        ? storytellerDataArray
        : Array.isArray(storytellerDataArray?.storytellers)
          ? storytellerDataArray.storytellers
          : [];

      if (!Array.isArray(normalizedStorytellers) || normalizedStorytellers.length === 0) {
        return res.status(502).json({ message: 'Storyteller generation failed.' });
      }

      storytellerDataArray = normalizedStorytellers.map((storyteller, storytellerIndex) =>
        normalizeGeneratedStorytellerPayload(storyteller, null, storytellerIndex)
      );

      await validatePayloadForRoute('text_to_storyteller', { storytellers: storytellerDataArray });

      const savedStorytellers = [];
      const keyImages = [];

      for (let storytellerIndex = 0; storytellerIndex < storytellerDataArray.length; storytellerIndex += 1) {
        const storytellerData = storytellerDataArray[storytellerIndex];
        if (!storytellerData || typeof storytellerData !== 'object') {
          continue;
        }

        const payload = {
          session_id: sessionId,
          sessionId,
          fragmentText,
          ...storytellerData
        };
        if (resolvedPlayerId) {
          payload.playerId = resolvedPlayerId;
        }
        if (shouldMockIllustrations && !payload.illustration) {
          payload.illustration = pickMockStorytellerIllustrationUrl(storytellerIndex);
        }
        if (shouldGenerateKeyImages && shouldMockIllustrations && payload.typewriter_key?.symbol && !payload.keyImageUrl) {
          payload.keyImageUrl = pickMockStorytellerKeyUrl(storytellerIndex);
          payload.keyImageLocalUrl = payload.keyImageUrl;
          payload.keyImageLocalPath = '';
        }

        const storytellerLookup = applyOptionalPlayerId(
          { session_id: sessionId, name: payload.name },
          resolvedPlayerId
        );
        const savedStoryteller = await Storyteller.findOneAndUpdate(
          storytellerLookup,
          payload,
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        savedStorytellers.push(savedStoryteller);

        if (shouldGenerateKeyImages && shouldMockIllustrations && payload.keyImageUrl) {
          keyImages.push({
            storytellerId: savedStoryteller._id,
            name: savedStoryteller.name,
            imageUrl: payload.keyImageUrl,
            localUrl: payload.keyImageLocalUrl || payload.keyImageUrl,
            localPath: payload.keyImageLocalPath || ''
          });
        }

        if (!shouldMockIllustrations && shouldGenerateKeyImages && payload.typewriter_key?.symbol) {
          const keyImageResult = await createStoryTellerKey(
            payload.typewriter_key,
            sessionId,
            payload.name,
            false,
            illustrationPipeline.model,
            storytellerKeyPromptDoc?.promptTemplate || ''
          );
          if (keyImageResult?.imageUrl || keyImageResult?.localPath) {
            const localUrl = keyImageResult?.localPath
              ? `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_keys/${path.basename(keyImageResult.localPath)}`
              : null;
            const imageUrl = keyImageResult?.imageUrl || localUrl;
            await Storyteller.findByIdAndUpdate(savedStoryteller._id, {
              keyImageUrl: imageUrl,
              keyImageLocalUrl: localUrl || imageUrl || '',
              keyImageLocalPath: keyImageResult.localPath || ''
            });
            savedStoryteller.keyImageUrl = imageUrl;
            savedStoryteller.keyImageLocalUrl = localUrl || imageUrl || '';
            savedStoryteller.keyImageLocalPath = keyImageResult.localPath || '';
            keyImages.push({
              storytellerId: savedStoryteller._id,
              name: savedStoryteller.name,
              imageUrl,
              localUrl,
              localPath: keyImageResult.localPath
            });
          }
        }

        if (!shouldMockIllustrations) {
          const illustrationResult = await createStorytellerIllustration(
            payload,
            sessionId,
            false,
            illustrationPipeline.model,
            illustrationPromptDoc?.promptTemplate || ''
          );

          if (illustrationResult?.imageUrl || illustrationResult?.localPath) {
            const localIllustrationUrl = illustrationResult?.localPath
              ? `${req.protocol}://${req.get('host')}/assets/${sessionId}/storyteller_illustrations/${path.basename(illustrationResult.localPath)}`
              : null;
            const illustrationUrl = illustrationResult?.imageUrl || localIllustrationUrl;

            await Storyteller.findByIdAndUpdate(savedStoryteller._id, {
              illustration: illustrationUrl
            });

            savedStoryteller.illustration = illustrationUrl;
          }
        }
      }

      res.status(200).json({
        sessionId,
        storytellers: savedStorytellers,
        keyImages,
        count: savedStorytellers.length,
        generateKeyImages: shouldGenerateKeyImages,
        mocked: shouldMockStorytellers || shouldMockIllustrations,
        mockedStorytellers: shouldMockStorytellers,
        mockedIllustrations: shouldMockIllustrations,
        runtime: {
          generation: {
            pipeline: 'storyteller_creation',
            provider: storytellerProvider,
            model: storytellerPipeline.model || '',
            mocked: shouldMockStorytellers
          },
          illustrations: {
            pipeline: 'illustration_creation',
            provider: illustrationProvider,
            model: illustrationPipeline.model || '',
            mocked: shouldMockIllustrations
          }
        }
      });
    } catch (err) {
      if (err.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
        return res.status(502).json({
          message: resolveSchemaErrorMessage(err, 'Storyteller generation schema validation failed.')
        });
      }
      console.error('Error in /api/textToStoryteller:', err);
      return sendLlmAwareError(res, err, 'Server error during storyteller generation.');
    }
  });

  app.post('/api/sendStorytellerToEntity', async (req, res) => {
    let storytellerDocIdForReset = null;
    let missionActivated = false;
    try {
      const body = req.body || {};
      const {
        sessionId,
        playerId,
        entityId,
        storytellerId,
        storytellingPoints,
        message,
        duration
      } = body;
      const resolvedPlayerId = normalizeOptionalPlayerId(playerId);

      if (!sessionId || !entityId || !storytellerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId, entityId, storytellerId.' });
      }
      if (!Number.isInteger(storytellingPoints)) {
        return res.status(400).json({ message: 'Missing or invalid storytellingPoints (int required).' });
      }
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: 'Missing or invalid message (string required).' });
      }

      const entity = await findEntityById(sessionId, resolvedPlayerId, entityId);
      if (!entity || entity.session_id !== sessionId || !matchesOptionalPlayerId(entity.playerId, resolvedPlayerId)) {
        return res.status(404).json({ message: 'Entity not found.' });
      }

      let storyteller = await Storyteller.findById(storytellerId);
      if (!storyteller) {
        storyteller = await Storyteller.findOne(
          applyOptionalPlayerId({ name: storytellerId, session_id: sessionId }, resolvedPlayerId)
        );
      }
      if (!storyteller || storyteller.session_id !== sessionId || !matchesOptionalPlayerId(storyteller.playerId, resolvedPlayerId)) {
        return res.status(404).json({ message: 'Storyteller not found.' });
      }
      storytellerDocIdForReset = storyteller._id;

      const storytellerMissionPipeline = await getAiPipelineSettings('storyteller_mission');
      const entityPipeline = await getAiPipelineSettings('entity_creation');
      const storytellerProvider = typeof storytellerMissionPipeline?.provider === 'string'
        ? storytellerMissionPipeline.provider
        : 'openai';
      const entityProvider = typeof entityPipeline?.provider === 'string' ? entityPipeline.provider : 'openai';
      const entityPromptDoc = await getLatestPromptTemplate('entity_creation');
      const storytellerMissionPromptDoc = await getLatestPromptTemplate('storyteller_mission');
      const shouldMockMission = resolveMockMode(body, storytellerMissionPipeline.useMock);
      const shouldMockSubEntities = resolveMockMode(body, entityPipeline.useMock);
      const durationDays = Number.isFinite(Number(duration)) ? Number(duration) : undefined;

      await Storyteller.findByIdAndUpdate(
        storyteller._id,
        { $set: { status: 'in_mission' } }
      );
      missionActivated = true;

      let missionResult;
      if (shouldMockMission) {
        missionResult = {
          outcome: 'success',
          userText: `The mission concludes. ${storyteller.name} returns with a focused insight about ${entity.name}.`,
          gmNote: `Lean into the sensory details of ${entity.name}; highlight a single, striking detail that hints at hidden layers.`,
          subEntitySeed: `New sub-entities emerge around ${entity.name}: a revealing clue, a minor witness, and a tangible relic tied to the mission.`
        };
      } else {
        let prompt = '';
        if (storytellerMissionPromptDoc?.promptTemplate) {
          prompt = renderPromptTemplateString(storytellerMissionPromptDoc.promptTemplate, {
            storytellerName: storyteller?.name || '',
            entityName: entity?.name || '',
            entityType: entity?.type || entity?.ner_type || 'ENTITY',
            entitySubtype: entity?.subtype || entity?.ner_subtype || 'General',
            entityDescription: entity?.description || '',
            entityLore: entity?.lore || '',
            storytellingPoints,
            message,
            durationDays: Number.isFinite(durationDays) ? `${durationDays} days` : 'unknown'
          });
        } else {
          const routeConfig = await getRouteConfig('storyteller_mission');
          prompt = renderPrompt(routeConfig.promptTemplate, {
            storytellerName: storyteller?.name || '',
            entityName: entity?.name || '',
            entityType: entity?.type || entity?.ner_type || 'ENTITY',
            entitySubtype: entity?.subtype || entity?.ner_subtype || 'General',
            entityDescription: entity?.description || '',
            entityLore: entity?.lore || '',
            storytellingPoints,
            message,
            durationDays: Number.isFinite(durationDays) ? `${durationDays} days` : 'unknown'
          });
        }
        missionResult = await callJsonLlm({
          prompts: [{ role: 'system', content: prompt }],
          provider: storytellerProvider,
          model: storytellerMissionPipeline.model || '',
          max_tokens: 1200,
          explicitJsonObjectFormat: true
        });
      }

      await validatePayloadForRoute('storyteller_mission', missionResult);

      const outcome = missionResult?.outcome;
      const userText = missionResult?.userText || '';
      const gmNote = missionResult?.gmNote || '';
      const subEntitySeed = missionResult?.subEntitySeed || `Sub-entities tied to ${entity.name} and ${message}.`;

      const subEntityResult = await textToEntityFromText({
        sessionId,
        playerId: resolvedPlayerId,
        text: subEntitySeed,
        entityCount: 3,
        includeCards: false,
        debug: shouldMockSubEntities,
        llmModel: entityPipeline.model,
        llmProvider: entityProvider,
        entityPromptTemplate: entityPromptDoc?.promptTemplate || '',
        mainEntityId: entity.externalId || String(entity._id),
        isSubEntity: true
      });

      const subEntities = Array.isArray(subEntityResult?.entities) ? subEntityResult.entities : [];
      const subEntityExternalIds = subEntities
        .map((subEntity) => subEntity.externalId || subEntity.id)
        .filter(Boolean)
        .map((id) => String(id));
      const savedSubEntities = subEntityExternalIds.length
        ? await NarrativeEntity.find(
          applyOptionalPlayerId(
            {
              session_id: sessionId,
              externalId: { $in: subEntityExternalIds },
              mainEntityId: entity.externalId || String(entity._id)
            },
            resolvedPlayerId
          )
        )
        : [];
      const updatedMissionEntity = await updateNarrativeEntityAfterStorytellerMission({
        entity,
        storyteller,
        outcome: outcome || 'pending',
        userText,
        gmNote,
        subEntitySeed,
        subEntities: savedSubEntities,
        storytellingPoints,
        durationDays,
        message
      });
      const missionRecord = {
        entityId: entity._id,
        entityExternalId: entity.externalId || String(entity._id),
        playerId: resolvedPlayerId,
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
      missionActivated = false;

      return res.status(200).json({
        sessionId,
        storytellerId: storyteller._id,
        outcome: missionRecord.outcome,
        userText: userText || undefined,
        gmNote: gmNote || undefined,
        entity: updatedMissionEntity || entity,
        subEntities: savedSubEntities,
        characterSheet: toImmersiveRpgCharacterSheetPayload(
          await ensureImmersiveRpgCharacterSheet({
            sessionId,
            playerId: resolvedPlayerId,
            playerName: '',
            sourceSceneBrief: null,
            patch: buildStorytellerMissionCharacterSheetPatch({
              entity: updatedMissionEntity || entity,
              storyteller,
              outcome: missionRecord.outcome,
              userText: userText || '',
              gmNote: gmNote || '',
              subEntities: savedSubEntities,
              storytellingPoints
            })
          })
        ),
        runtime: {
          mission: {
            pipeline: 'storyteller_mission',
            provider: storytellerProvider,
            model: storytellerMissionPipeline.model || '',
            mocked: shouldMockMission
          },
          subEntities: {
            pipeline: 'entity_creation',
            provider: entityProvider,
            model: entityPipeline.model || '',
            mocked: shouldMockSubEntities
          }
        }
      });
    } catch (err) {
      if (missionActivated && storytellerDocIdForReset) {
        try {
          await Storyteller.findByIdAndUpdate(storytellerDocIdForReset, { $set: { status: 'active' } });
        } catch (resetError) {
          console.error('Failed to restore storyteller status after mission error:', resetError);
        }
      }
      if (err.code === 'LLM_SCHEMA_VALIDATION_ERROR') {
        return res.status(502).json({
          message: resolveSchemaErrorMessage(err, 'Storyteller mission schema validation failed.')
        });
      }
      console.error('Error in /api/sendStorytellerToEntity:', err);
      return sendLlmAwareError(res, err, 'Server error during storyteller mission.');
    }
  });
}

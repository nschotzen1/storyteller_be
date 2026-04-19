export function registerArenaRoutes(app, deps) {
  const {
    randomUUID,
    getAiPipelineSettings,
    getLatestPromptTemplate,
    resolveMockMode,
    Arena,
    normalizePredicate,
    getExistingEdgesForEntities,
    getClusterForEntities,
    buildClusterContext,
    checkDuplicateEdge,
    evaluateRelationship,
    deriveRelationshipStrength,
    calculatePoints,
    syncEntityNode,
    createRelationship,
    deleteRelationshipsByEdgeIds
  } = deps;

  async function handleArenaRelationship(req, res, { forceDryRun = false } = {}) {
    try {
      const {
        sessionId,
        playerId,
        source,
        targets,
        relationship,
        options,
        debug,
        mock,
        mock_api_calls,
        mocked_api_calls
      } = req.body || {};

      const relationshipPayload = {
        ...(relationship || {}),
        fastValidate: Boolean(relationship?.fastValidate || options?.fastValidate)
      };
      const relationshipPipeline = await getAiPipelineSettings('relationship_evaluation');
      const relationshipProvider = typeof relationshipPipeline?.provider === 'string'
        ? relationshipPipeline.provider
        : 'openai';
      const relationshipPromptDoc = await getLatestPromptTemplate('relationship_evaluation');

      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
      }
      if (!source || (!source.cardId && !source.entityId)) {
        return res.status(400).json({ message: 'Missing required parameter: source (cardId or entityId).' });
      }
      if (!Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ message: 'Missing required parameter: targets array.' });
      }
      if (!relationshipPayload.surfaceText) {
        return res.status(400).json({ message: 'Missing required parameter: relationship.surfaceText.' });
      }

      const shouldMock = resolveMockMode(
        { debug, mock, mock_api_calls, mocked_api_calls },
        relationshipPipeline.useMock
      );
      const dryRun = forceDryRun || Boolean(options?.dryRun);

      const arenaDoc = await Arena.findOne({ sessionId });
      const arena = arenaDoc?.arena || { entities: [], storytellers: [], edges: [], scores: {} };
      const predicate = relationshipPayload.predicateHint
        ? normalizePredicate(relationshipPayload.predicateHint)
        : normalizePredicate(relationshipPayload.surfaceText);

      const involvedEntityIds = [
        source.cardId || source.entityId,
        ...targets.map((target) => target.cardId || target.entityId)
      ].filter(Boolean);

      const existingEdges = getExistingEdgesForEntities(arena, involvedEntityIds);

      let clusterContext = null;
      let cluster = null;
      try {
        cluster = await getClusterForEntities(sessionId, involvedEntityIds);
        clusterContext = buildClusterContext(cluster);
      } catch (neo4jError) {
        console.warn('Neo4j cluster query failed (continuing without cluster context):', neo4jError.message);
      }

      const fromId = source.cardId || source.entityId;
      for (const target of targets) {
        const toId = target.cardId || target.entityId;
        const duplicate = checkDuplicateEdge(existingEdges, fromId, toId, predicate);
        if (duplicate) {
          return res.status(409).json({
            message: 'Duplicate edge already exists.',
            existingEdge: duplicate
          });
        }
      }

      const evaluation = await evaluateRelationship(
        source,
        targets,
        relationshipPayload,
        existingEdges,
        shouldMock,
        clusterContext,
        relationshipPipeline.model,
        relationshipProvider,
        relationshipPromptDoc?.promptTemplate || ''
      );

      if (evaluation.verdict !== 'accepted') {
        return res.status(200).json({
          verdict: 'rejected',
          quality: evaluation.quality,
          suggestions: evaluation.suggestions || [],
          fastValidate: evaluation.fastValidate,
          mocked: shouldMock,
          runtime: {
            pipeline: 'relationship_evaluation',
            provider: relationshipProvider,
            model: relationshipPipeline.model || '',
            mocked: shouldMock
          }
        });
      }

      if (dryRun) {
        const strength = deriveRelationshipStrength(evaluation?.quality?.score);
        return res.status(200).json({
          verdict: 'accepted',
          dryRun: true,
          quality: evaluation.quality,
          predicate,
          strength,
          message: 'Relationship would be accepted (dry run, not committed).',
          fastValidate: evaluation.fastValidate,
          mocked: shouldMock,
          runtime: {
            pipeline: 'relationship_evaluation',
            provider: relationshipProvider,
            model: relationshipPipeline.model || '',
            mocked: shouldMock
          }
        });
      }

      const createdEdges = [];
      const edgesArray = Array.isArray(arena.edges) ? arena.edges : [];
      const relationshipStrength = deriveRelationshipStrength(evaluation?.quality?.score);

      for (const target of targets) {
        const edge = {
          edgeId: `edge_${randomUUID().slice(0, 8)}`,
          fromCardId: source.cardId || source.entityId,
          toCardId: target.cardId || target.entityId,
          surfaceText: relationshipPayload.surfaceText,
          predicate,
          direction: relationshipPayload.direction || 'source_to_target',
          strength: relationshipStrength,
          quality: evaluation.quality,
          createdBy: playerId,
          createdAt: new Date().toISOString()
        };
        edgesArray.push(edge);
        createdEdges.push(edge);
      }

      const pointsAwarded = calculatePoints(evaluation.quality.score);
      const scores = { ...(arena.scores || {}) };
      const previousTotal = scores[playerId] || 0;
      scores[playerId] = previousTotal + pointsAwarded;

      const edgeIds = createdEdges.map((edge) => edge.edgeId);
      const enforceDualWrite = !shouldMock;

      if (enforceDualWrite) {
        try {
          await syncEntityNode(sessionId, source);
          for (const target of targets) {
            await syncEntityNode(sessionId, target);
          }
          for (const edge of createdEdges) {
            await createRelationship(sessionId, edge);
          }
        } catch (neo4jError) {
          console.error('Neo4j sync failed before Mongo commit, aborting relationship proposal:', neo4jError);
          return res.status(503).json({
            message: 'Relationship persistence failed: Neo4j unavailable. No changes were committed.'
          });
        }
      }

      try {
        await Arena.findOneAndUpdate(
          { sessionId },
          {
            $set: {
              'arena.edges': edgesArray,
              'arena.scores': scores,
              lastUpdatedBy: playerId
            }
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
      } catch (mongoError) {
        if (enforceDualWrite) {
          try {
            await deleteRelationshipsByEdgeIds(sessionId, edgeIds);
          } catch (rollbackError) {
            console.error('Neo4j rollback failed after MongoDB persistence error:', rollbackError);
          }
        }
        throw mongoError;
      }

      if (!enforceDualWrite) {
        try {
          await syncEntityNode(sessionId, source);
          for (const target of targets) {
            await syncEntityNode(sessionId, target);
          }
          for (const edge of createdEdges) {
            await createRelationship(sessionId, edge);
          }
        } catch (neo4jError) {
          console.warn('Neo4j sync failed in mock mode (MongoDB updated successfully):', neo4jError.message);
        }
      }

      return res.status(200).json({
        verdict: 'accepted',
        edge: createdEdges.length === 1 ? createdEdges[0] : createdEdges,
        points: {
          awarded: pointsAwarded,
          playerTotal: scores[playerId],
          breakdown: [`Base quality score: ${evaluation.quality.score.toFixed(2)} → ${pointsAwarded} points`]
        },
        evolution: {
          affected: targets.map((target) => ({
            cardId: target.cardId || target.entityId,
            delta: Math.ceil(evaluation.quality.score * 2),
            changeSummary: `Connection established: "${relationshipPayload.surfaceText}"`
          })),
          regenSuggested: []
        },
        clusters: {
          touched: cluster?.entities?.map((entity) => entity.entityId) || [],
          metrics: cluster ? [{ entitiesInCluster: cluster.entities?.length || 0, relationshipsInCluster: cluster.relationships?.length || 0 }] : []
        },
        existingEdgesCount: existingEdges.length,
        mocked: shouldMock,
        fastValidate: evaluation.fastValidate,
        runtime: {
          pipeline: 'relationship_evaluation',
          provider: relationshipProvider,
          model: relationshipPipeline.model || '',
          mocked: shouldMock
        }
      });
    } catch (error) {
      console.error('Error in /api/arena/relationships/propose:', error);
      return res.status(500).json({ message: 'Server error during relationship proposal.' });
    }
  }

  app.post('/api/arena/relationships/propose', async (req, res) =>
    handleArenaRelationship(req, res)
  );

  app.post('/api/arena/relationships/validate', async (req, res) =>
    handleArenaRelationship(req, res, { forceDryRun: true })
  );

  app.get('/api/arena/state', async (req, res) => {
    try {
      const { sessionId, playerId, arenaId } = req.query;

      if (!sessionId || !playerId) {
        return res.status(400).json({ message: 'Missing required parameters: sessionId or playerId.' });
      }

      const arenaDoc = await Arena.findOne({ sessionId }).lean();
      const arena = arenaDoc?.arena || { entities: [], storytellers: [], edges: [], scores: {}, clusters: [] };

      return res.status(200).json({
        sessionId,
        playerId,
        arenaId: arenaId || 'default',
        arena: {
          entities: Array.isArray(arena.entities) ? arena.entities : [],
          storytellers: Array.isArray(arena.storytellers) ? arena.storytellers : []
        },
        edges: Array.isArray(arena.edges) ? arena.edges : [],
        clusters: Array.isArray(arena.clusters) ? arena.clusters : [],
        scores: arena.scores || {},
        lastUpdatedBy: arenaDoc?.lastUpdatedBy,
        updatedAt: arenaDoc?.updatedAt
      });
    } catch (error) {
      console.error('Error in /api/arena/state:', error);
      return res.status(500).json({ message: 'Server error during arena state fetch.' });
    }
  });
}

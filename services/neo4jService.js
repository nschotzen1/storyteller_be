import neo4j from 'neo4j-driver';

// Neo4j connection configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'storyteller123';

let driver = null;

/**
 * Initialize the Neo4j driver.
 * Call this once when the server starts.
 */
export function initNeo4j() {
    if (driver) return driver;

    driver = neo4j.driver(
        NEO4J_URI,
        neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
        { maxConnectionPoolSize: 50 }
    );

    console.log('Neo4j driver initialized');
    return driver;
}

/**
 * Close the Neo4j driver connection.
 * Call this when shutting down.
 */
export async function closeNeo4j() {
    if (driver) {
        await driver.close();
        driver = null;
        console.log('Neo4j driver closed');
    }
}

/**
 * Get a session for running queries.
 * @returns {neo4j.Session}
 */
export function getSession() {
    if (!driver) {
        initNeo4j();
    }
    return driver.session();
}

/**
 * Sync an entity to Neo4j as a node.
 * Creates or updates the node based on entityId.
 * @param {string} sessionId - The game session ID
 * @param {Object} entity - The entity to sync
 * @returns {Promise<Object>} - The created/updated node properties
 */
export async function syncEntityNode(sessionId, entity) {
    const session = getSession();
    try {
        const entityId = entity.cardId || entity.entityId || entity.id || entity.externalId;
        if (!entityId) {
            throw new Error('Entity must have an ID (cardId, entityId, id, or externalId)');
        }

        const result = await session.run(
            `MERGE (e:Entity {entityId: $entityId, sessionId: $sessionId})
       SET e.slug = $slug,
           e.name = $name,
           e.type = $type,
           e.description = $description,
           e.narrative_weight = $narrative_weight,
           e.updatedAt = datetime()
       RETURN e`,
            {
                entityId: String(entityId),
                sessionId: String(sessionId),
                slug: entity.slug || '',
                name: entity.name || entity.entityName || 'Unknown',
                type: entity.ner_type || entity.type || 'ENTITY',
                description: entity.description || '',
                narrative_weight: entity.narrative_weight || 0
            }
        );

        return result.records[0]?.get('e')?.properties || null;
    } finally {
        await session.close();
    }
}

/**
 * Create a relationship between two entities in Neo4j.
 * @param {string} sessionId - The game session ID
 * @param {Object} edge - The edge/relationship to create
 * @returns {Promise<Object>} - The created relationship properties
 */
export async function createRelationship(sessionId, edge) {
    const session = getSession();
    try {
        const qualityScoreRaw = Number(edge.quality?.score);
        const normalizedQualityScore = Number.isFinite(qualityScoreRaw)
            ? Math.min(Math.max(qualityScoreRaw, 0), 1)
            : 0;
        const strengthRaw = Number(edge.strength);
        const normalizedStrength = Number.isFinite(strengthRaw)
            ? Math.min(Math.max(Math.round(strengthRaw), 1), 5)
            : Math.round(1 + normalizedQualityScore * 4);

        const result = await session.run(
            `MATCH (from:Entity {entityId: $fromCardId, sessionId: $sessionId})
       MATCH (to:Entity {entityId: $toCardId, sessionId: $sessionId})
       MERGE (from)-[r:RELATES_TO {edgeId: $edgeId}]->(to)
       SET r.predicate = $predicate,
           r.surfaceText = $surfaceText,
           r.direction = $direction,
           r.qualityScore = $qualityScore,
           r.strength = $strength,
           r.createdBy = $createdBy,
           r.createdAt = $createdAt
       RETURN r`,
            {
                sessionId: String(sessionId),
                fromCardId: String(edge.fromCardId),
                toCardId: String(edge.toCardId),
                edgeId: edge.edgeId,
                predicate: edge.predicate || 'relates_to',
                surfaceText: edge.surfaceText || '',
                direction: edge.direction || 'source_to_target',
                qualityScore: normalizedQualityScore,
                strength: normalizedStrength,
                createdBy: edge.createdBy || 'unknown',
                createdAt: edge.createdAt || new Date().toISOString()
            }
        );

        return result.records[0]?.get('r')?.properties || null;
    } finally {
        await session.close();
    }
}

/**
 * Deletes relationships by edge IDs for a specific session.
 * Used for compensating rollback when MongoDB persistence fails
 * after Neo4j relationship creation succeeded.
 * @param {string} sessionId
 * @param {string[]} edgeIds
 * @returns {Promise<number>}
 */
export async function deleteRelationshipsByEdgeIds(sessionId, edgeIds) {
    const session = getSession();
    try {
        if (!Array.isArray(edgeIds) || edgeIds.length === 0) {
            return 0;
        }

        const normalizedIds = edgeIds.filter(Boolean).map(String);
        if (normalizedIds.length === 0) {
            return 0;
        }

        const result = await session.run(
            `MATCH (:Entity {sessionId: $sessionId})-[r:RELATES_TO]->(:Entity {sessionId: $sessionId})
       WHERE r.edgeId IN $edgeIds
       WITH count(r) AS relationshipCount, collect(r) AS rels
       FOREACH (rel IN rels | DELETE rel)
       RETURN relationshipCount`,
            {
                sessionId: String(sessionId),
                edgeIds: normalizedIds
            }
        );

        const countValue = result.records[0]?.get('relationshipCount');
        if (!countValue) return 0;
        if (typeof countValue.toNumber === 'function') return countValue.toNumber();
        return Number(countValue) || 0;
    } finally {
        await session.close();
    }
}

/**
 * Get the cluster of connected entities for a given entity.
 * Returns all entities and relationships within N hops.
 * @param {string} sessionId - The game session ID
 * @param {string} entityId - The entity to get cluster for
 * @param {number} depth - Max hop distance (default 2)
 * @returns {Promise<Object>} - Cluster with nodes and relationships
 */
export async function getClusterForEntity(sessionId, entityId, depth = 2) {
    const session = getSession();
    try {
        const result = await session.run(
            `MATCH (start:Entity {entityId: $entityId, sessionId: $sessionId})
       CALL apoc.path.subgraphAll(start, {
         maxLevel: $depth,
         relationshipFilter: 'RELATES_TO'
       }) YIELD nodes, relationships
       RETURN nodes, relationships`,
            {
                sessionId: String(sessionId),
                entityId: String(entityId),
                depth: neo4j.int(depth)
            }
        );

        // If APOC is not available, fall back to basic query
        if (result.records.length === 0) {
            return getClusterBasic(session, sessionId, entityId, depth);
        }

        const nodes = result.records[0]?.get('nodes') || [];
        const relationships = result.records[0]?.get('relationships') || [];

        return {
            entities: nodes.map(n => n.properties),
            relationships: relationships.map(r => ({
                ...r.properties,
                fromEntityId: r.start?.properties?.entityId,
                toEntityId: r.end?.properties?.entityId
            }))
        };
    } catch (error) {
        // APOC not installed, use basic query
        if (error.message?.includes('apoc')) {
            return getClusterBasic(session, sessionId, entityId, depth);
        }
        throw error;
    } finally {
        await session.close();
    }
}

/**
 * Basic cluster query without APOC (limited to 2 hops).
 */
async function getClusterBasic(session, sessionId, entityId, depth) {
    const depthPattern = depth >= 2 ? '*1..2' : '*1';

    const result = await session.run(
        `MATCH (start:Entity {entityId: $entityId, sessionId: $sessionId})
     OPTIONAL MATCH path = (start)-[r:RELATES_TO${depthPattern}]-(connected:Entity)
     WHERE connected.sessionId = $sessionId
     WITH start, collect(DISTINCT connected) as connectedNodes, collect(DISTINCT r) as rels
     RETURN start, connectedNodes, rels`,
        {
            sessionId: String(sessionId),
            entityId: String(entityId)
        }
    );

    if (result.records.length === 0) {
        return { entities: [], relationships: [] };
    }

    const record = result.records[0];
    const startNode = record.get('start');
    const connectedNodes = record.get('connectedNodes') || [];
    const rels = record.get('rels') || [];

    const entities = [startNode, ...connectedNodes]
        .filter(n => n)
        .map(n => n.properties);

    const relationships = rels
        .filter(r => r)
        .map(r => r.properties);

    return { entities, relationships };
}

/**
 * Get cluster for multiple entities.
 * Combines clusters for all specified entities.
 * @param {string} sessionId - The game session ID
 * @param {string[]} entityIds - Entity IDs to get clusters for
 * @param {number} depth - Max hop distance (default 2)
 * @returns {Promise<Object>} - Combined cluster with nodes and relationships
 */
export async function getClusterForEntities(sessionId, entityIds, depth = 2) {
    const session = getSession();
    try {
        if (!entityIds || entityIds.length === 0) {
            return { entities: [], relationships: [] };
        }

        const depthPattern = depth >= 2 ? '*1..2' : '*1';
        const entityIdStrings = entityIds.map(String);

        const result = await session.run(
            `MATCH (start:Entity)
       WHERE start.entityId IN $entityIds AND start.sessionId = $sessionId
       OPTIONAL MATCH path = (start)-[r:RELATES_TO${depthPattern}]-(connected:Entity)
       WHERE connected.sessionId = $sessionId
       WITH collect(DISTINCT start) + collect(DISTINCT connected) as allNodes,
            collect(DISTINCT r) as allRels
       RETURN allNodes, allRels`,
            {
                sessionId: String(sessionId),
                entityIds: entityIdStrings
            }
        );

        if (result.records.length === 0) {
            return { entities: [], relationships: [] };
        }

        const record = result.records[0];
        const allNodes = record.get('allNodes') || [];
        const allRels = record.get('allRels') || [];

        const entities = allNodes
            .filter(n => n)
            .map(n => n.properties);

        const relationships = allRels
            .filter(r => r)
            .map(r => r.properties);

        // Deduplicate by entityId
        const uniqueEntities = [];
        const seenIds = new Set();
        for (const entity of entities) {
            if (entity?.entityId && !seenIds.has(entity.entityId)) {
                seenIds.add(entity.entityId);
                uniqueEntities.push(entity);
            }
        }

        return { entities: uniqueEntities, relationships };
    } finally {
        await session.close();
    }
}

/**
 * Delete all data for a session (useful for cleanup/testing).
 * @param {string} sessionId - The game session ID
 */
export async function deleteSessionData(sessionId) {
    const session = getSession();
    try {
        await session.run(
            `MATCH (e:Entity {sessionId: $sessionId})
       DETACH DELETE e`,
            { sessionId: String(sessionId) }
        );
    } finally {
        await session.close();
    }
}

/**
 * Build a formatted cluster context for LLM prompts.
 * @param {Object} cluster - Cluster from getClusterForEntities
 * @returns {string} - Formatted context string
 */
export function buildClusterContext(cluster) {
    if (!cluster?.entities?.length) {
        return 'No existing cluster context (new or isolated entity).';
    }

    const lines = [];

    lines.push(`Connected entities (${cluster.entities.length}):`);
    for (const entity of cluster.entities.slice(0, 10)) {
        lines.push(`  - ${entity.name || entity.entityId} (${entity.type || 'unknown type'})`);
    }

    if (cluster.relationships?.length > 0) {
        lines.push(`\nExisting relationships (${cluster.relationships.length}):`);
        for (const rel of cluster.relationships.slice(0, 10)) {
            lines.push(`  - "${rel.surfaceText || rel.predicate}"`);
        }
    }

    return lines.join('\n');
}
/**
 * Create a session node in Neo4j.
 */
export async function createSession(sessionId, seed, fragment) {
    const session = getSession();
    try {
        await session.run(
            `MERGE (s:Session {sessionId: $sessionId})
       SET s.seed = $seed,
           s.fragment = $fragment,
           s.createdAt = datetime()`,
            { sessionId: String(sessionId), seed: Number(seed), fragment: String(fragment) }
        );
    } finally {
        await session.close();
    }
}

/**
 * Update an entity's description in the graph.
 */
export async function updateEntityDescription(sessionId, entityId, newDescription) {
    if (!driver) return;
    const session = driver.session();
    try {
        await session.run(`
            MATCH (e:Entity { entityId: $entityId, sessionId: $sessionId })
            SET e.description = $newDescription
        `, { entityId: String(entityId), sessionId: String(sessionId), newDescription: String(newDescription) });
    } finally {
        await session.close();
    }
}

/**
 * Update a specific property of an entity in Neo4j.
 */
export async function updateEntityProperty(sessionId, entityId, property, newValue) {
    if (!driver) return;
    const session = driver.session();
    try {
        await session.run(`
            MATCH (e:Entity { sessionId: $sessionId })
            WHERE e.entityId = $entityId OR e.slug = $entityId OR e.name = $entityId
            SET e += $props
        `, {
            entityId: String(entityId),
            sessionId: String(sessionId),
            props: { [property]: String(newValue) }
        });
    } finally {
        await session.close();
    }
}

/**
 * Persist players as nodes in Neo4j.
 */
export async function persistPlayers(sessionId, players) {
    const session = getSession();
    try {
        for (const player of players) {
            await session.run(
                `MATCH (s:Session {sessionId: $sessionId})
         MERGE (p:Player {playerId: $playerId, sessionId: $sessionId})
         SET p.seat = $seat, p.name = $name
         MERGE (p)-[:IN_SESSION]->(s)`,
                {
                    sessionId: String(sessionId),
                    playerId: String(player.id),
                    seat: Number(player.seat),
                    name: String(player.name)
                }
            );
        }
    } finally {
        await session.close();
    }
}

/**
 * Create memories as nodes in Neo4j.
 */
export async function createMemories(sessionId, memories) {
    const session = getSession();
    try {
        for (const mem of memories) {
            await session.run(
                `MATCH (s:Session {sessionId: $sessionId})
         MERGE (m:Memory {id: $id, sessionId: $sessionId})
         SET m.content = $content, m.intensity = $intensity
         MERGE (m)-[:IN_ARENA]->(s)`,
                {
                    sessionId: String(sessionId),
                    id: String(mem.id),
                    content: String(mem.content),
                    intensity: Number(mem.intensity || 0.5)
                }
            );
        }
    } finally {
        await session.close();
    }
}

/**
 * Create storytellers as nodes in Neo4j.
 */
export async function createStorytellers(sessionId, storytellers) {
    const session = getSession();
    try {
        for (const st of storytellers) {
            await session.run(
                `MATCH (s:Session {sessionId: $sessionId})
         MERGE (t:Storyteller {name: $name, sessionId: $sessionId})
         SET t.style = $style, t.level = $level
         MERGE (t)-[:IN_ARENA]->(s)`,
                {
                    sessionId: String(sessionId),
                    name: String(st.name),
                    style: String(st.style || ''),
                    level: Number(st.level || 10)
                }
            );
        }
    } finally {
        await session.close();
    }
}

/**
 * Create entities and deal to player in Neo4j.
 */
export async function createEntitiesAndDealToPlayer(sessionId, player, entities) {
    const session = getSession();
    try {
        for (const ent of entities) {
            await session.run(
                `MATCH (p:Player {playerId: $playerId, sessionId: $sessionId})
         MERGE (e:Entity {entityId: $id, sessionId: $sessionId})
         SET e.slug = $slug, e.name = $name, e.type = $type, e.description = $description, e.narrative_weight = $narrative_weight
         MERGE (e)-[:IN_HAND]->(p)`,
                {
                    sessionId: String(sessionId),
                    playerId: String(player.id),
                    id: String(ent.id),
                    slug: String(ent.slug || ''),
                    name: String(ent.name),
                    type: String(ent.type || 'UNKNOWN'),
                    description: String(ent.description || ''),
                    narrative_weight: ent.narrative_weight || 0
                }
            );
        }
    } finally {
        await session.close();
    }
}

/**
 * Export full graph snapshot for a session.
 */
export async function exportGraphSnapshot(sessionId) {
    const session = getSession();
    try {
        const result = await session.run(
            `MATCH (n {sessionId: $sessionId})
       OPTIONAL MATCH (n)-[r]->(m {sessionId: $sessionId})
       RETURN collect(distinct n) as nodes, 
              collect(distinct {
                start: id(n), 
                end: id(m), 
                type: type(r), 
                props: properties(r)
              }) as relationships`,
            { sessionId: String(sessionId) }
        );

        const record = result.records[0];
        const nodes = record?.get('nodes') || [];
        const relationships = record?.get('relationships') || [];

        return {
            nodes: nodes.map(n => ({
                id: n.identity.toString(),
                labels: n.labels,
                properties: n.properties
            })),
            relationships: relationships.filter(r => r.end !== null)
        };
    } finally {
        await session.close();
    }
}

/**
 * Calculate physics metrics for a session's narrative cluster.
 * 
 * @param {string} sessionId 
 * @returns {Promise<{totalMass: number, bindingEnergy: number, density: number, entityCount: number, connectionCount: number}>}
 */
export async function calculateClusterMetrics(sessionId) {
    const session = getSession();
    try {
        const query = `
            MATCH (e:Entity {sessionId: $sessionId})
            OPTIONAL MATCH (e)-[r]->(:Entity {sessionId: $sessionId})
            RETURN 
                count(DISTINCT e) as entityCount,
                count(r) as connectionCount,
                sum(e.narrative_weight) as totalMass,
                sum(r.qualityScore) as bindingEnergy
        `;

        const result = await session.run(query, { sessionId });
        const record = result.records[0];

        if (!record) return { totalMass: 0, bindingEnergy: 0, density: 0, entityCount: 0, connectionCount: 0 };

        const toNum = (val) => {
            if (!val) return 0;
            if (val.toNumber) return val.toNumber();
            return Number(val);
        };

        const entityCount = toNum(record.get('entityCount'));
        const connectionCount = toNum(record.get('connectionCount'));

        // Mass is often null if property is missing, defaulting to count * 10
        let totalMass = toNum(record.get('totalMass'));
        if (totalMass === 0 && entityCount > 0) totalMass = entityCount * 10;

        const bindingEnergy = toNum(record.get('bindingEnergy'));

        // Density = Energy / Mass (How tightly bound is the matter?)
        const density = totalMass > 0 ? (bindingEnergy / totalMass) : 0;

        return {
            totalMass,
            bindingEnergy,
            density,
            entityCount,
            connectionCount
        };
    } catch (err) {
        console.warn('Failed to calculate cluster metrics:', err.message);
        return { totalMass: 0, bindingEnergy: 0, density: 0, entityCount: 0, connectionCount: 0 };
    } finally {
        await session.close();
    }
}

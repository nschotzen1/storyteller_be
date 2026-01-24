import { directExternalApiCall } from '../ai/openai/apiService.js';

/**
 * Normalizes a relationship string into a slug.
 * @param {string} surfaceText 
 * @returns {string}
 */
export function normalizePredicate(surfaceText) {
    if (!surfaceText || typeof surfaceText !== 'string') {
        return 'custom:unknown';
    }
    const slug = surfaceText
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_');
    return slug || `custom:${surfaceText.slice(0, 20).replace(/\s+/g, '_')}`;
}

/**
 * Filters existing edges to find those involving the specified entities.
 * @param {Object} arena 
 * @param {string[]} entityIds 
 * @returns {Array}
 */
export function getExistingEdgesForEntities(arena, entityIds) {
    const edges = Array.isArray(arena?.edges) ? arena.edges : [];
    const idSet = new Set(entityIds.map(String));
    return edges.filter(edge =>
        idSet.has(String(edge.fromCardId)) || idSet.has(String(edge.toCardId))
    );
}

/**
 * Checks if an edge already exists.
 * @param {Array} existingEdges 
 * @param {string} fromCardId 
 * @param {string} toCardId 
 * @param {string} predicate 
 * @returns {Object|undefined}
 */
export function checkDuplicateEdge(existingEdges, fromCardId, toCardId, predicate) {
    return existingEdges.find(edge =>
        String(edge.fromCardId) === String(fromCardId) &&
        String(edge.toCardId) === String(toCardId) &&
        edge.predicate === predicate
    );
}

/**
 * Generates a deterministic mock judgment.
 * @param {Object} source 
 * @param {Array} targets 
 * @param {Object} relationship 
 * @param {Array} existingEdges 
 * @returns {Object}
 */
export function buildMockJudgment(source, targets, relationship, existingEdges) {
    const surfaceText = relationship?.surfaceText || '';
    const isDescriptive = surfaceText.length > 10;
    const hasExistingConnections = existingEdges.length > 0;

    const score = isDescriptive ? 0.75 : 0.35;
    const accepted = score >= 0.5;

    const reasons = [];
    if (isDescriptive) {
        reasons.push('Relationship text is descriptive and specific');
    } else {
        reasons.push('Relationship text is too brief');
    }
    if (hasExistingConnections) {
        reasons.push(`Context: ${existingEdges.length} existing connection(s) found`);
    }

    if (accepted) {
        return {
            verdict: 'accepted',
            quality: { score, confidence: 0.8, reasons }
        };
    } else {
        return {
            verdict: 'rejected',
            quality: { score, confidence: 0.6, reasons },
            suggestions: [
                { predicate: 'sometimes_seen_at', surfaceText: 'sometimes seen at' },
                { predicate: 'connected_to', surfaceText: 'connected to' }
            ]
        };
    }
}

/**
 * Evaluates a relationship using LLM or mock logic.
 * @param {Object} source 
 * @param {Array} targets 
 * @param {Object} relationship 
 * @param {Array} existingEdges 
 * @param {boolean} shouldMock 
 * @returns {Promise<Object>}
 */
export async function evaluateRelationship(source, targets, relationship, existingEdges, shouldMock) {
    if (shouldMock) {
        return buildMockJudgment(source, targets, relationship, existingEdges);
    }

    // Real mode: use LLM for judgment
    const prompt = `You are a worldbuilding judge for a collaborative storytelling game.

A player proposes a relationship between entities in an arena:
- Source: ${JSON.stringify(source)}
- Targets: ${JSON.stringify(targets)}
- Proposed relationship: "${relationship.surfaceText}"
- Existing connections: ${JSON.stringify(existingEdges.slice(0, 5))}

Evaluate this relationship on:
1. Type coherence (does it make sense for these entity types?)
2. Specificity (is it descriptive, not vague?)
3. Non-redundancy (is it different from existing edges?)
4. Narrative grounding (does it feel plausible in this world?)

Return JSON:
{
  "verdict": "accepted" or "rejected",
  "quality": { "score": 0-1, "confidence": 0-1, "reasons": ["..."] },
  "suggestions": [{ "predicate": "...", "surfaceText": "..." }] // only if rejected
}`;

    try {
        const result = await directExternalApiCall(
            [{ role: 'system', content: prompt }],
            800,
            undefined,
            undefined,
            true,
            true
        );
        return result || buildMockJudgment(source, targets, relationship, existingEdges);
    } catch (err) {
        console.error('Error in LLM relationship evaluation:', err);
        return buildMockJudgment(source, targets, relationship, existingEdges);
    }
}

/**
 * Calculates points based on quality score.
 * @param {number} qualityScore 
 * @returns {number}
 */
export function calculatePoints(qualityScore) {
    // Base points: 5-20 based on quality
    return Math.round(5 + qualityScore * 15);
}

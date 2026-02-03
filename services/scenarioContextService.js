/**
 * Scenario Context Service
 * 
 * Loads context from Neo4j and MongoDB for use during scenario execution.
 * This includes relationship patterns, prior samples, and understanding docs.
 */

import { LLMSample, AgentUnderstanding } from '../models/scenario_models.js';
import * as neo4jService from './neo4jService.js';
import neo4j from 'neo4j-driver';

/**
 * Load relationship type patterns from Neo4j.
 * Returns the most common relationship types with their counts.
 * 
 * @param {number} limit - Maximum patterns to return
 * @returns {Promise<Array<{type: string, count: number}>>}
 */
export async function loadRelationshipCatalog(limit = 500) {
    let session;
    try {
        session = neo4jService.getSession();
        const result = await session.run(`
      MATCH ()-[r]->()
      WITH type(r) as relType, count(*) as count
      RETURN relType, count
      ORDER BY count DESC
      LIMIT $limit
    `, { limit: neo4j.int(limit) });

        return result.records.map(rec => ({
            type: rec.get('relType'),
            count: rec.get('count').toNumber()
        }));
    } catch (error) {
        // Neo4j might not be available or have no data yet
        console.warn('Could not load relationship catalog from Neo4j:', error.message);
        return [];
    } finally {
        if (session) {
            await session.close();
        }
    }
}

/**
 * Load recent LLM samples for each module.
 * Used to improve mock generation based on prior outputs.
 * 
 * @param {string[]} modules - Module names to load samples for
 * @param {number} limitPerModule - Max samples per module
 * @returns {Promise<Object<string, Array>>}
 */
export async function loadPriorSamples(modules, limitPerModule = 50) {
    const samples = {};

    for (const mod of modules) {
        try {
            samples[mod] = await LLMSample.find({ moduleName: mod })
                .sort({ qualityScore: -1, createdAt: -1 })
                .limit(limitPerModule)
                .lean();
        } catch (error) {
            console.warn(`Could not load prior samples for ${mod}:`, error.message);
            samples[mod] = [];
        }
    }

    return samples;
}

/**
 * Load the latest understanding document.
 * This contains accumulated definitions and principles from prior runs.
 * 
 * @returns {Promise<Object|null>}
 */
export async function loadLatestUnderstanding() {
    try {
        return await AgentUnderstanding.findOne()
            .sort({ version: -1, createdAt: -1 })
            .lean();
    } catch (error) {
        console.warn('Could not load understanding document:', error.message);
        return null;
    }
}

/**
 * Build a formatted context string from loaded data.
 * Used to provide context to LLM calls.
 * 
 * @param {object} ctx - Context object with relationship catalog and understanding
 * @returns {string}
 */
export function buildContextString(ctx) {
    const parts = [];

    if (ctx.fragment) {
        parts.push(`Narrative Fragment: ${ctx.fragment}`);
    }

    if (ctx.relationshipCatalog?.length > 0) {
        const topTypes = ctx.relationshipCatalog.slice(0, 10);
        parts.push(`Common relationship types: ${topTypes.map(r => r.type).join(', ')}`);
    }

    if (ctx.understanding?.definitions) {
        const defs = ctx.understanding.definitions;
        const defStrings = Object.entries(defs)
            .filter(([_, v]) => v)
            .map(([k, v]) => `${k}: ${v}`);
        if (defStrings.length > 0) {
            parts.push(`Definitions:\n${defStrings.join('\n')}`);
        }
    }

    if (ctx.understanding?.principles?.length > 0) {
        parts.push(`Principles:\n- ${ctx.understanding.principles.slice(-5).join('\n- ')}`);
    }

    return parts.join('\n\n');
}

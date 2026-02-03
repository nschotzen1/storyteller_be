/**
 * JSON Schemas for LLM Module Outputs.
 * Used to validate mocked outputs before use.
 */

export const LLM_MODULE_SCHEMAS = {
    generate_memories: {
        type: 'array',
        items: {
            type: 'object',
            required: ['id', 'content'],
            properties: {
                id: { type: 'string' },
                content: { type: 'string' },
                intensity: { type: 'number', minimum: 0, maximum: 1 },
                tags: { type: 'array', items: { type: 'string' } }
            }
        }
    },

    generate_entities: {
        type: 'array',
        items: {
            type: 'object',
            required: ['id', 'slug', 'name', 'type', 'description'],
            properties: {
                id: { type: 'string' },
                slug: { type: 'string', description: 'Technical identifier (e.g. the-obsidian-hound)' },
                name: { type: 'string' },
                type: {
                    type: 'string',
                    enum: ['CHARACTER', 'LOCATION', 'OBJECT', 'EVENT', 'CONCEPT']
                },
                description: { type: 'string' },
                sensory_profile: {
                    type: 'object',
                    properties: {
                        sight: { type: 'string' },
                        sound: { type: 'string' },
                        smell: { type: 'string' },
                        touch: { type: 'string' }
                    }
                },
                dynamic_state: {
                    type: 'object',
                    description: 'Mutable properties that reflect the current condition of the entity.'
                },
                traits: { type: 'array', items: { type: 'string' } },
                secrets: { type: 'array', items: { type: 'string' } },
                narrative_weight: { type: 'number', minimum: 0, maximum: 100 }
            }
        }
    },

    generate_storytellers: {
        type: 'array',
        items: {
            type: 'object',
            required: ['name', 'style'],
            properties: {
                name: { type: 'string' },
                style: { type: 'string' },
                level: { type: 'integer', minimum: 1, maximum: 20 },
                immediate_ghost_appearance: { type: 'string' },
                influences: { type: 'array', items: { type: 'string' } },
                narrative_bias: { type: 'string' }
            }
        }
    },

    deepen_entity: {
        type: 'object',
        required: ['entity_id', 'slug', 'improved_description', 'layered_history', 'sensory_profile'],
        properties: {
            entity_id: { type: 'string' },
            slug: { type: 'string', description: 'Technical identifier (e.g. the-obsidian-hound)' },
            improved_description: { type: 'string' },
            layered_history: { type: 'string' },
            sensory_profile: {
                type: 'object',
                properties: {
                    sight: { type: 'string' },
                    sound: { type: 'string' },
                    smell: { type: 'string' },
                    touch: { type: 'string' }
                }
            },
            new_traits: { type: 'array', items: { type: 'string' } },
            sprout_entities: {
                type: 'array',
                description: 'New entities discovered during this investigation',
                items: {
                    type: 'object',
                    required: ['id', 'slug', 'name', 'type', 'description'],
                    properties: {
                        id: { type: 'string' },
                        slug: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['CHARACTER', 'LOCATION', 'OBJECT', 'EVENT', 'CONCEPT'] },
                        description: { type: 'string' },
                        sensory_profile: {
                            type: 'object',
                            properties: {
                                sight: { type: 'string' },
                                sound: { type: 'string' },
                                smell: { type: 'string' },
                                touch: { type: 'string' }
                            }
                        }
                    }
                }
            },
            suggested_relationships: {
                type: 'array',
                description: 'Relationships between the deepened entity and the newly sprouted ones',
                items: {
                    type: 'object',
                    required: ['target_slug', 'surfaceText', 'direction'],
                    properties: {
                        target_slug: { type: 'string' },
                        surfaceText: { type: 'string' },
                        direction: { type: 'string', enum: ['source_to_target', 'target_to_source', 'bi_directional'] }
                    }
                }
            }
        }
    },

    immersion_scene: {
        type: 'object',
        required: ['scene_id', 'title', 'narrative'],
        properties: {
            scene_id: { type: 'string' },
            title: { type: 'string' },
            narrative: { type: 'string' },
            sensory_details: {
                type: 'object',
                properties: {
                    sight: { type: 'string' },
                    sound: { type: 'string' },
                    smell: { type: 'string' },
                    touch: { type: 'string' }
                }
            },
            character_interiority: { type: 'string' },
            choice_points: { type: 'array', items: { type: 'string' } },
            emotional_resonance: { type: 'string' },
            clarity_score: { type: 'number' }
        }
    },

    generate_choice_consequences: {
        type: 'object',
        required: ['choice_text', 'narrative_outcome', 'world_mutations'],
        properties: {
            choice_text: { type: 'string' },
            narrative_outcome: { type: 'string' },
            world_mutations: {
                type: 'array',
                items: {
                    type: 'object',
                    required: ['entity_id', 'property', 'new_value'],
                    properties: {
                        entity_id: { type: 'string' },
                        property: { type: 'string' },
                        new_value: { type: 'string' },
                        operation: { type: 'string', enum: ['set', 'add', 'remove'] }
                    }
                }
            },
            discovered_secrets: { type: 'array', items: { type: 'string' } }
        }
    },

    validate_connection: {
        type: 'object',
        required: ['verdict', 'quality'],
        properties: {
            verdict: { type: 'string', enum: ['accepted', 'rejected'] },
            quality: {
                type: 'object',
                required: ['score'],
                properties: {
                    score: { type: 'number', minimum: 0, maximum: 1 },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    reasons: { type: 'array', items: { type: 'string' } }
                }
            },
            suggestions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        predicate: { type: 'string' },
                        surfaceText: { type: 'string' }
                    }
                }
            }
        }
    },

    storyteller_investigate: {
        type: 'object',
        required: ['outcome'],
        properties: {
            outcome: {
                type: 'string',
                enum: ['success', 'failure', 'delayed', 'pending']
            },
            report: { type: 'string' },
            discoveries: {
                type: 'array',
                items: { type: 'object' }
            },
            userText: { type: 'string' },
            gmNote: { type: 'string' }
        }
    }
};

/**
 * Get the schema for a specific module.
 * @param {string} moduleName 
 * @returns {object|null}
 */
export function getModuleSchema(moduleName) {
    return LLM_MODULE_SCHEMAS[moduleName] || null;
}

/**
 * List all supported module names.
 * @returns {string[]}
 */
export function getSupportedModules() {
    return Object.keys(LLM_MODULE_SCHEMAS);
}

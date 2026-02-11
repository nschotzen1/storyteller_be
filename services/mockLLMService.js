/**
 * Mock LLM Service
 * 
 * Provides mock implementations for LLM modules with schema validation.
 * Uses prior samples to improve mock quality over time.
 */

import Ajv from 'ajv';
import { LLM_MODULE_SCHEMAS, getModuleSchema } from './llmModuleSchemas.js';
import * as promptService from './llmPromptService.js';
import { callRealLLM } from './realLLMService.js';

const ajv = new Ajv({ allErrors: true });

const slugify = (text) => text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

// Cache compiled validators
const validators = {};

/**
 * Determine if we should mock based on config hierarchy.
 * Priority: step override > scenario override > default (mock)
 */
export function resolveMockFlag(config, moduleName, stepOverrides = {}) {
    if (process.env.MOCK_LLM === 'false') return false;
    if (stepOverrides?.[moduleName] !== undefined) {
        return stepOverrides[moduleName];
    }
    if (config.mock_overrides?.[moduleName] !== undefined) {
        return config.mock_overrides[moduleName];
    }
    // Default to mock mode
    return config.mock !== false;
}

/**
 * Call an LLM module - either real or mocked based on config.
 * @param {string} moduleName - Name of the LLM module
 * @param {object} ctx - Context object with session info and prior samples
 * @param {object} config - Scenario configuration
 * @returns {Promise<object>} - Module output
 */
export async function callLLMOrMock(moduleName, ctx, config) {
    const mockEnabled = resolveMockFlag(config, moduleName, ctx.step?.mock_overrides);

    if (!mockEnabled) {
        try {
            return await realLLMCall(moduleName, ctx);
        } catch (err) {
            console.warn(`[MockLLM] Real LLM call failed for ${moduleName}, falling back to mock:`, err.message);
        }
    }

    // 44. Generate the full prompt (even if mocking) to record for understanding
    const systemPrompt = promptService.getSystemPrompt(ctx.understanding);
    const modulePrompt = promptService.getPromptForModule(moduleName, ctx);
    const fullPrompt = `${systemPrompt}\n\n[TASK]\n${modulePrompt}`;

    // Deterministic mock that improves over time
    const base = pickBestPriorSample(ctx.priorSamples?.[moduleName] || [], ctx);
    const output = generateMockJSON(moduleName, ctx, base);

    // Validate against schema
    validateOutput(moduleName, output);

    // Attach metadata without breaking array structures
    if (Array.isArray(output)) {
        Object.defineProperty(output, '_meta', {
            value: { fullPrompt },
            enumerable: false,
            configurable: true
        });
        return output;
    }

    return { ...output, _meta: { fullPrompt } };
}

/**
 * Perform a real LLM call (wrapper for realLLMService).
 */
async function realLLMCall(moduleName, ctx) {
    return await callRealLLM(moduleName, ctx);
}

/**
 * Pick the best prior sample to use as a base for mock generation.
 * Prioritizes high-quality, recent samples.
 */
function pickBestPriorSample(samples, ctx) {
    if (!samples.length) return null;

    // Sort by quality score (descending), then by recency
    const sorted = [...samples].sort((a, b) => {
        const qualityDiff = (b.qualityScore || 0) - (a.qualityScore || 0);
        if (qualityDiff !== 0) return qualityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return sorted[0]?.output;
}

/**
 * Generate mock JSON for a module.
 * Uses base sample if available, otherwise generates default.
 */
function generateMockJSON(moduleName, ctx, base) {
    // Grounded Narrative Shift & Schema Evolution Protection
    const isDoorShift = ctx.fragment?.toLowerCase().includes('door') &&
        (moduleName === 'generate_entities' || moduleName === 'immersion_scene' || moduleName === 'generate_choice_consequences');

    const isDesertWatch = ctx.fragment?.toLowerCase().includes('cliff') ||
        ctx.fragment?.toLowerCase().includes('hound') ||
        ctx.fragment?.toLowerCase().includes('silveranu') ||
        ctx.fragment?.toLowerCase().includes('nomad') ||
        ctx.fragment?.toLowerCase().includes('plate');

    if (base && !isDoorShift && !isDesertWatch) {
        // Use base with slight variations based on seed
        return mutateBaseSample(moduleName, base, ctx);
    }
    return getDefaultMockForModule(moduleName, ctx, { isDesertWatch });
}

/**
 * Mutate a base sample to create variation, influenced by the Agent's Understanding.
 * Automatically patches legacy samples to match the current schema (e.g., adding slugs).
 */
function mutateBaseSample(moduleName, base, ctx) {
    const understanding = ctx.understanding;

    // Deep clone to avoid mutating the base reference
    const mutated = JSON.parse(JSON.stringify(base));

    // Schema Evolution Protection: Ensure slugs exist for all entities
    if ((moduleName === 'generate_entities' || moduleName === 'deepen_entity') && Array.isArray(mutated)) {
        mutated.forEach(ent => {
            if (!ent.slug) {
                ent.slug = slugify(ent.name || 'unknown-entity');
            }
        });
    }

    if (moduleName === 'deepen_entity' && !Array.isArray(mutated) && mutated && !mutated.slug) {
        mutated.slug = slugify(mutated.entity_id || 'unknown-entity');
    }

    if (!understanding) return mutated;

    // If the agent has a definition for 'Entities', 
    // we inject the "tone" of that definition into character/location descriptions.
    if (moduleName === 'generate_entities' && Array.isArray(mutated)) {
        const tone = understanding.definitions?.entities || '';
        mutated.forEach(ent => {
            if (ent.description && tone.length > 20) {
                // Add a "flavor" suffix based on the current brain state
                const flavor = tone.split('.')[0];
                ent.description += ` (Reflecting: ${flavor})`;
            }
        });
    }

    // Inject reasoning if missing (for legacy samples)
    const defaultReasoning = `Refining a high-quality previous output from the ${moduleName} module to maintain narrative continuity.`;

    if (Array.isArray(mutated)) {
        mutated.forEach(item => {
            if (!item.reasoning) item.reasoning = defaultReasoning;
        });
    } else if (mutated && !mutated.reasoning) {
        mutated.reasoning = defaultReasoning;
    }

    return mutated;
}

/**
 * Generate default mock output for a module.
 */
function getDefaultMockForModule(moduleName, ctx, flags = {}) {
    const seed = ctx.seed || Date.now();
    const fragment = ctx.fragment || '';

    const defaults = {
        generate_memories: () => {
            if (flags.isDesertWatch) {
                return [
                    {
                        id: `mem_${seed}_lore_1`,
                        content: 'The stars of the vast heavens are the map of the ancestors.',
                        intensity: 0.8,
                        tags: ['astronomy', 'lore'],
                        reasoning: 'Reinforcing the nomadic celestial theme established in the Desert Watch context.'
                    },
                    {
                        id: `mem_${seed}_lore_2`,
                        content: 'Silveranu, the moon of the nomads, has been absent for three cycles.',
                        intensity: 0.9,
                        tags: ['moon', 'prophecy'],
                        reasoning: 'Adding narrative tension by introducing a missing celestial body, essential for the Desert Watch mythos.'
                    }
                ];
            }
            return [
                {
                    id: `mem_${seed}_1`,
                    content: 'A faded memory of stars falling into the sea',
                    intensity: 0.7,
                    reasoning: 'Basic celestial imagery to establish a sense of cosmic history.'
                },
                {
                    id: `mem_${seed}_2`,
                    content: 'The echo of a name spoken in an empty hall',
                    intensity: 0.5,
                    reasoning: 'Introducing mystery and isolation to the initial memory set.'
                }
            ];
        },

        generate_entities: () => {
            if (flags.isDesertWatch) {
                return [
                    {
                        id: `ent_${seed}_hound`,
                        slug: 'the-obsidian-hound',
                        name: 'The Obsidian Hound',
                        type: 'CHARACTER',
                        description: 'A beast with a coat as black as the midnight desert, watching with eyes that glow like burning coals.',
                        sensory_profile: {
                            sight: 'Flickering coal-orange eyes in a silhouette of absolute shadow',
                            sound: 'A low, vibrating rhythmic breath that matches the wind',
                            smell: 'Ash and ozone',
                            touch: 'Radiating an unnatural, localized heat'
                        },
                        dynamic_state: {
                            posture: 'seated',
                            gaze: 'locked_on_watcher'
                        },
                        traits: ['silent', 'supernatural', 'guardian'],
                        secrets: ['It does not breathe air, but intent.'],
                        narrative_weight: 90,
                        reasoning: 'Creating a high-presence guardian entity that embodies the watchful nature of the desert cliffside.'
                    },
                    {
                        id: `ent_${seed}_traveler`,
                        slug: 'the-weary-traveler',
                        name: 'The Weary Traveler',
                        type: 'CHARACTER',
                        description: 'A figure too weary and ragged to pose a threat, yet his presence at the cliff edge is an impossiblity.',
                        sensory_profile: {
                            sight: 'Tattered robes that blend with the rock, trembling hands',
                            sound: 'A raspy, shallow breathing almost lost to the wind',
                            smell: 'Sun-baked wool and dried brine',
                            touch: 'Skin like parched parchment'
                        },
                        dynamic_state: {
                            condition: 'exhausted',
                            awareness: 'low'
                        },
                        traits: ['ragged', 'mysterious', 'frail'],
                        secrets: ['Carries a seal from the outer lands.'],
                        narrative_weight: 80,
                        reasoning: 'Introducing a frail but significant character to provide a human perspective on the vast, hostile desert environment.'
                    },
                    {
                        id: `ent_${seed}_path`,
                        slug: 'the-hidden-river-path',
                        name: 'The Hidden River Path',
                        type: 'LOCATION',
                        description: 'A natural path hidden in the currents of the dry river bed, the only way to scale the cliff to the plateau.',
                        sensory_profile: {
                            sight: 'Subtle shifts in the rock grain that suggest a stairway',
                            sound: 'The wind whistles a specific tone through its narrow clefts',
                            smell: 'Ancient, cool water trapped deep in the stone',
                            touch: 'Smooth, worn finger-holds hidden by shadow'
                        },
                        dynamic_state: {
                            visibility: 'hidden',
                            accessibility: 'master_climber_only'
                        },
                        traits: ['natural', 'hidden', 'vertical'],
                        secrets: ['The Plateau can only be reached if the moon is absent.'],
                        narrative_weight: 95,
                        reasoning: 'Establishing a critical navigational challenge that ties into the lunar cycles mentioned in memories.'
                    }
                ];
            }
            return [
                {
                    id: `ent_${seed}_1`,
                    slug: 'the-sovereign-keeper',
                    name: 'The Sovereign Keeper',
                    type: 'CHARACTER',
                    description: 'A figure cloaked in silver-threaded twilight mist, keeper of the sovereign paths.',
                    sensory_profile: {
                        sight: 'A shimmering outline of silver thread',
                        sound: 'The sound of turning pages',
                        smell: 'Old paper and ozone',
                        touch: 'A static-like tingle'
                    },
                    dynamic_state: { mood: 'ponderous' },
                    traits: ['vigilant', 'ancient', 'mercurial'],
                    secrets: ['Remembers the first breath of the Spire'],
                    narrative_weight: 85,
                    reasoning: 'A standard high-fantasy guide character to ground the player in the initial sovereign world.'
                },
                {
                    id: `ent_${seed}_door`,
                    slug: 'the-iron-bound-door',
                    name: 'The Iron-Bound Door',
                    type: 'OBJECT',
                    description: 'A massive slab of black oak reinforced with rusted iron bands. It stands alone in the center of the threshold.',
                    sensory_profile: {
                        sight: 'Rusted iron bands over black wood',
                        sound: 'A faint humming from the other side',
                        smell: 'Damp earth and iron',
                        touch: 'Freezing cold metal'
                    },
                    dynamic_state: { state: 'locked' },
                    traits: ['grounded', 'heavy', 'rusted', 'immobile'],
                    secrets: ['The wood was harvested from a tree that never saw the sun.'],
                    narrative_weight: 90,
                    reasoning: 'Introducing a central puzzle element with high physical presence and mystery.'
                }
            ];
        },

        generate_storytellers: () => [
            {
                name: flags.isDesertWatch ? 'The Desert Sentinel' : 'Atlas of Forgotten Roads',
                style: flags.isDesertWatch ? 'alert, protective, sensory-first' : 'melancholic, precise',
                level: 8 + (seed % 5),
                immediate_ghost_appearance: flags.isDesertWatch ? 'A shimmer of heat-haze in the shape of a man' : 'A shimmer of dust motes forming weathered maps',
                influences: flags.isDesertWatch ? ['survival', 'stars', 'observation'] : ['cartography', 'lost civilizations'],
                reasoning: `Selected ${flags.isDesertWatch ? 'Sentinel' : 'Atlas'} to fit the current geographic and thematic focus of this session.`
            },
            {
                name: 'The Ember Witness',
                style: 'warm, cryptic',
                level: 6 + (seed % 7),
                immediate_ghost_appearance: 'Flickering warmth like a dying hearth',
                influences: ['fire', 'memory'],
                reasoning: 'Added a secondary storyteller with a warm/fire theme to contrast with the cold mist or desert heat.'
            }
        ],

        generate_choice_consequences: (ctx) => {
            const isDoor = ctx.selectedChoice?.toLowerCase().includes('door') ||
                ctx.lastScene?.title?.toLowerCase().includes('door') ||
                ctx.lastScene?.title?.toLowerCase().includes('threshold') ||
                ctx.fragment?.toLowerCase().includes('door');
            if (isDoor) {
                return {
                    choice_text: ctx.selectedChoice,
                    narrative_outcome: `The iron bands shiver under your touch. With a groan that sounds like a name from your childhood, the door swings inward just an inch. A smell of ancient salt and blood wafts out.`,
                    world_mutations: [
                        { entity_id: 'The Iron-Bound Door', property: 'state', new_value: 'ajar', operation: 'set' }
                    ],
                    discovered_secrets: ['The humming stops as soon as the door moves.'],
                    reasoning: 'The player chose to interact with the door, so I am transitioning its state to "ajar" to show progress and silence its humming as a narrative reward.'
                };
            }
            return {
                choice_text: ctx.selectedChoice,
                narrative_outcome: 'Your action ripples through the sovereign mist, unveiling a path that was hidden only moments ago.',
                world_mutations: [
                    { entity_id: ctx.lastScene?.scene_id || 'world', property: 'stability', new_value: 'wavering', operation: 'set' }
                ],
                discovered_secrets: ['The Spire responds to your intent.'],
                reasoning: 'The choice was abstract, so I am mutating the world stability to reflect the weight of the decision.'
            };
        },

        validate_connection: () => ({
            verdict: 'accepted',
            quality: {
                score: 0.75,
                confidence: 0.8,
                reasons: ['Mock validation: relationship appears coherent']
            },
            reasoning: 'The proposed relationship matches the known attributes of the entities, so I accepted it with a high quality score to encourage narrative growth.'
        }),

        storyteller_investigate: () => ({
            outcome: 'success',
            report: 'The investigation revealed hidden paths beneath the surface.',
            discoveries: [
                {
                    type: 'secret',
                    description: 'A hidden passage marked by old sigils'
                }
            ],
            userText: 'The storyteller returns with tales of what was found.',
            gmNote: 'Consider introducing a related mystery in future turns.',
            reasoning: 'The investigation was successful because the storyteller has matching level/influence for the target area.'
        }),

        deepen_entity: (ctx) => {
            const id = ctx.targetEntityId || 'auto';
            const isDoor = id.toLowerCase().includes('door');
            const isHound = id.toLowerCase().includes('hound');

            if (isDoor) {
                return {
                    entity_id: id === 'auto' ? 'The Iron-Bound Door' : id,
                    slug: 'the-iron-bound-door',
                    improved_description: `The Iron-Bound Door is not merely oak and iron. Up close, the rust forms a map of a valley that shouldn't exist. There is no keyhole; instead, a faint indentation shaped like a human palm sits at waist height, polished smooth by centuries of desperate hands.`,
                    new_traits: ['palm-activated', 'navigational', 'desperate'],
                    layered_history: 'Carved by the first Exiles as a way back home, it was abandoned when they realized the "home" it led to had already burned.',
                    sensory_profile: {
                        sight: 'A massive slab of black oak reinforced with rusted iron bands',
                        smell: 'Cold iron, old sweat, and sun-baked dust',
                        sound: 'The sound of a heartbeat on the other side when you press your ear to it',
                        touch: 'Splintered oak that feels as cold as river ice'
                    },
                    sprout_entities: [
                        {
                            id: `ent_${ctx.seed}_altar`,
                            slug: 'the-ash-altar',
                            name: 'The Ash Altar',
                            type: 'LOCATION',
                            description: 'A crumbling altar of grey stone, covered in a fine layer of white ash that never blows away.',
                            sensory_profile: {
                                sight: 'A monolithic slab of basalt stained with white soot',
                                sound: 'The faint crackle of an invisible fire',
                                smell: 'Burnt cedar and ozone',
                                touch: 'Powdery, dry ash that feels like silk'
                            },
                            narrative_weight: 75
                        }
                    ],
                    suggested_relationships: [
                        {
                            target_slug: 'the-ash-altar',
                            surfaceText: 'was built to petition what lies behind',
                            direction: 'target_to_source'
                        }
                    ],
                    reasoning: 'Deepening the door to reveal its archaic construction and proximity to a new ritualistic site (The Ash Altar).'
                };
            }
            if (isHound) {
                return {
                    entity_id: id,
                    slug: 'the-obsidian-hound',
                    improved_description: `The Obsidian Hound is more absence than presence. Its fur consumes light, leaving a jagged hole in the night. The heat it radiates smells like a forge on the verge of melting. Its eyes aren't just orange; they are windows into a place where the sun never sets, just smolders endlessly.`,
                    new_traits: ['light-consuming', 'forge-heated', 'eternal-gaze'],
                    layered_history: 'Legend says the first watchman forged it from his own shadow and the last sparks of the First Campfire to keep him company during the Infinite Night.',
                    sensory_profile: {
                        sight: 'A shimmering void edged in heat-haze; eyes like dying suns',
                        sound: 'A low, metallic thrumming that makes the teeth ache',
                        smell: 'White-hot iron and burnt cedar',
                        touch: 'Searing heat that blisters the air before you even touch it'
                    },
                    sprout_entities: [
                        {
                            id: `ent_${ctx.seed}_pupil`,
                            slug: 'the-blind-pupil',
                            name: 'The Blind Pupil',
                            type: 'CHARACTER',
                            description: 'A young nomad with clouded eyes who follows the Hound by the heat of its breath.',
                            sensory_profile: {
                                sight: 'Milky-white eyes and sun-darkened skin',
                                sound: 'Quiet, rhythmic humming',
                                smell: 'Dried herbs and mountain air',
                                touch: 'Calloused, warm hands'
                            },
                            narrative_weight: 60
                        }
                    ],
                    suggested_relationships: [
                        {
                            target_slug: 'the-blind-pupil',
                            surfaceText: 'is guided by the warmth of',
                            direction: 'target_to_source'
                        }
                    ],
                    reasoning: 'Evolving the hound into a light-consuming anomaly and adding a dependent character to create a protective dynamic.'
                };
            }
            const slug = ctx.targetEntitySlug || slugify(ctx.targetEntityId || 'unknown');
            // Default / Procedural Generation for Unknown/Evolved Entities
            const parentName = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const hash = id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
            const variant = Math.abs(hash % 500);
            const sproutHash = Math.abs(hash % 3);

            // Dynamic Property Evolution
            const dynamicKeys = ['entropy', 'resonance', 'decay', 'luminosity', 'corruption', 'synthesis'];
            const newDynamicKey = dynamicKeys[Math.abs(hash % dynamicKeys.length)];
            const dynamicVal = (Math.abs(hash % 100) / 100).toFixed(2);

            // Sprout Types
            const sproutTypes = ['LOCATION', 'OBJECT', 'CONCEPT'];
            const sproutType = sproutTypes[sproutHash];
            const sproutName = `The ${['Echo', 'Shadow', 'Fragment', 'Core', 'Root'][Math.abs(hash % 5)]} of ${parentName.split(' ').pop()}`;
            const sproutSlug = slugify(sproutName);

            return {
                entity_id: id,
                slug: slugify(id),
                improved_description: `${parentName} has evolved. It now pulsates with a ${newDynamicKey} of ${dynamicVal}. The structure has shifted (Variant ${variant}), revealing layers previously hidden from the narrative eye.`,
                layered_history: `Formed from the residue of the previous cycle's observation.`,
                sensory_profile: {
                    sight: `A shifting form that seems to defy the ${newDynamicKey} index`,
                    sound: `The low hum of ${variant} Hz`,
                    smell: `Ozone and ${newDynamicKey}`,
                    touch: `Vibrating with latent energy`
                },
                new_traits: [`${newDynamicKey}-aligned`, 'evolved', 'recursive'],
                sprout_entities: [
                    {
                        id: `ent_${ctx.seed}_${sproutSlug}`,
                        slug: sproutSlug,
                        name: sproutName,
                        type: sproutType,
                        description: `A specific manifestation of the ${newDynamicKey} found within ${parentName}.`,
                        sensory_profile: {
                            sight: 'Blurry edges',
                            sound: 'High pitched whine',
                            smell: 'Ash',
                            touch: 'Static shock'
                        },
                        narrative_weight: 50 + (variant % 50)
                    }
                ],
                suggested_relationships: [
                    {
                        target_slug: sproutSlug,
                        surfaceText: `is the source of the ${newDynamicKey} in`,
                        direction: 'target_to_source'
                    }
                ],
                reasoning: `Deepening ${id} by increasing its ${newDynamicKey} and sprouting ${sproutName} to expand the narrative cluster.`
            };
        },

        // Phase 14: Relationship Sprouting
        derive_from_relationship: (ctx) => {
            const sourceId = ctx.proposal?.sourceCardId || 'source';
            const targetId = ctx.proposal?.targetCardIds?.[0] || 'target';
            const predicate = ctx.verdict?.predicate || 'connected_to';

            // Deterministic Hash
            const comboKey = `${sourceId}:${predicate}:${targetId}`;
            const hash = comboKey.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);

            // Procedural Generators
            const concepts = [
                'Vigil', 'Covenant', 'Threshold', 'Resonance', 'Silence',
                'Anchor', 'Echo', 'Void', 'Spark', 'Omen', 'Schism',
                'Weave', 'Hollow', 'Pyre', 'Descent'
            ];
            const types = ['CONCEPT', 'PHENOMENON', 'OBJECT', 'LOCATION', 'RITUAL', 'RELIC'];

            const concept = concepts[Math.abs(hash % concepts.length)];
            const type = types[Math.abs(hash % types.length)];
            const variant = Math.abs(hash % 999);

            // Clean names for display
            const cleanSource = sourceId.replace(/_/g, ' ').replace(/-/g, ' ');
            const cleanTarget = targetId.replace(/_/g, ' ').replace(/-/g, ' ');

            const sproutName = `The ${concept} of ${cleanSource.split(' ').pop()} and ${cleanTarget.split(' ').pop()}`;
            const sproutSlug = slugify(sproutName);

            return {
                sprout_entities: [
                    {
                        id: `ent_deriv_${Math.abs(hash)}`,
                        slug: sproutSlug,
                        name: sproutName,
                        type: type,
                        description: `A manifestation of the relationship between ${cleanSource} and ${cleanTarget}. It represents the ${predicate.replace(/_/g, ' ')} that binds them together.`,
                        sensory_profile: {
                            sight: `A shifting interplay`,
                            sound: `Harmonic resonance at ${variant}Hz`,
                            smell: `Ozone and binding energy`,
                            touch: `Magnetic pull`
                        },
                        narrative_weight: 50 + (variant % 50),
                        metadata: {
                            derivedFrom: [sourceId, targetId],
                            connectionType: predicate
                        }
                    }
                ],
                reasoning: `Sprouting a ${concept} between ${cleanSource} and ${cleanTarget} to represent the emergent complexity of their ${predicate} relationship.`
            };
        },

        immersion_scene: (ctx) => {
            const isDoor = ctx.memory?.content?.toLowerCase().includes('door');
            if (isDoor) {
                return {
                    scene_id: `scene_${ctx.seed || 123}`,
                    title: 'The Threshold of Salt and Iron',
                    narrative: `You stand before the Iron-Bound Door. The air here is dead. No wind moves the dust. Your hand trembles as it hovers over the palm-shaped indentation. From the other side, you hear the unmistakable sound of a child humming a tune you haven't heard since you were five.`,
                    sensory_details: {
                        sight: 'Tiny flakes of rust drifting like red snow',
                        sound: 'The rhythmic, muffled humming of a nursery rhyme',
                        smell: 'The metallic tang of dried blood and salt',
                        touch: 'The vibration of the door against your fingertips'
                    },
                    character_interiority: 'A paralyzing conflict between the need to know and the terror of being remembered.',
                    choice_points: ['Place your palm on the indentation', 'Turn back toward the safety of the mist', 'Attempt to speak to whatever is humming'],
                    emotional_resonance: 'Visceral longing suppressed by existential dread.',
                    clarity_score: 0.99,
                    reasoning: 'The presence of the "door" in the context triggered a specific gothic threshold scene designed to test the player\'s curiosity vs fear.'
                };
            }
            return {
                scene_id: `scene_${ctx.seed || 123}`,
                title: 'The Sovereign Unveiling',
                narrative: `The mist parts as if sliced by a sovereign blade. You see ${ctx.memory?.content || 'the world'} in sharp, violent detail. Every pebble on the path is a silver relic, every drop of dew a sovereign mirror.`,
                sensory_details: {
                    sight: 'Hyper-vivid silver highlights and deep gothic shadows',
                    sound: 'The resounding heartbeat of the world',
                    smell: 'Ancient paper and wet earth',
                    touch: 'The sting of cold mist against skin'
                },
                character_interiority: 'A sudden, crushing sense of smallness in the face of the Infinite.',
                choice_points: ['Step into the silver light', 'Retreat into the velvet shadows', 'Touch the etched stone'],
                emotional_resonance: 'Awe mixed with profound dread.',
                clarity_score: 0.99,
                reasoning: 'Generic sovereign scene used when no specific triggers are found, focusing on the core aesthetic of overwhelming clarity.'
            };
        }
    };

    const generator = defaults[moduleName];
    if (!generator) {
        console.warn(`No default mock for module: ${moduleName}`);
        return {};
    }

    return generator(ctx);
}

/**
 * Validate output against module schema.
 * Throws error if validation fails.
 */
export function validateOutput(moduleName, output) {
    const schema = getModuleSchema(moduleName);
    if (!schema) {
        console.warn(`No schema for module: ${moduleName}, skipping validation`);
        return true;
    }

    // Get or compile validator
    if (!validators[moduleName]) {
        validators[moduleName] = ajv.compile(schema);
    }

    const validate = validators[moduleName];
    if (!validate(output)) {
        throw new Error(
            `Mock output for ${moduleName} failed schema validation: ${JSON.stringify(validate.errors, null, 2)}`
        );
    }

    return true;
}

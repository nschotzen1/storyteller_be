import mongoose from 'mongoose';

/**
 * LLM Sample Schema - stores mock/real LLM outputs for each module call.
 * Each sample is tied to a sessionId, module, and step for traceability.
 */
const LLMSampleSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    moduleName: {
        type: String,
        required: true,
        enum: [
            'generate_memories',
            'generate_entities',
            'generate_storytellers',
            'validate_connection',
            'storyteller_investigate',
            'deepen_entity',
            'immersion_scene',
            'generate_choice_consequences'
        ],
        index: true
    },
    stepId: { type: String, required: true },
    promptVersion: { type: String, default: '1.0.0' },
    prompt: { type: String }, // The full prompt sent to the LLM
    input: { type: mongoose.Schema.Types.Mixed },  // context passed to module
    output: { type: mongoose.Schema.Types.Mixed, required: true },
    isMocked: { type: Boolean, default: true },
    qualityScore: { type: Number, min: 0, max: 1 },
    seed: { type: Number }
}, { timestamps: true });

LLMSampleSchema.index({ sessionId: 1, moduleName: 1 });
LLMSampleSchema.index({ moduleName: 1, qualityScore: -1 });

/**
 * Agent Understanding Schema - concise definitions + principles learned.
 * Accumulates across runs to improve mock generation.
 */
const AgentUnderstandingSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    version: { type: Number, default: 1 },
    definitions: {
        memories: { type: String },
        entities: { type: String },
        storytellers: { type: String },
        relationships: { type: String }
    },
    principles: [{ type: String }],
    relationshipPatterns: [{
        pattern: { type: String },
        frequency: { type: Number },
        examples: [{ type: String }]
    }]
}, { timestamps: true });

AgentUnderstandingSchema.index({ version: -1, createdAt: -1 });

/**
 * Recommendations Schema - code changes, prompt improvements, schema tweaks.
 * Generated after each run based on analysis of samples and events.
 */
const RecommendationSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    category: {
        type: String,
        enum: ['code_change', 'prompt_improvement', 'schema_tweak', 'new_rule', 'new_route'],
        required: true
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    description: { type: String, required: true },
    affectedModule: { type: String },
    rationale: { type: String },
    implemented: { type: Boolean, default: false }
}, { timestamps: true });

RecommendationSchema.index({ sessionId: 1, category: 1 });
RecommendationSchema.index({ implemented: 1, priority: 1 });

/**
 * Scenario Event Log - tracks each step execution during a scenario run.
 * Used for debugging and generating recommendations.
 */
const ScenarioEventLogSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, index: true },
    stepId: { type: String, required: true },
    action: { type: String, required: true },
    inputs: { type: mongoose.Schema.Types.Mixed },
    outputsSummary: { type: String },
    durationMs: { type: Number },
    success: { type: Boolean, default: true },
    error: { type: String }
}, { timestamps: true });

ScenarioEventLogSchema.index({ sessionId: 1, stepId: 1 });

// Export models
export const LLMSample = mongoose.model('LLMSample', LLMSampleSchema);
export const AgentUnderstanding = mongoose.model('AgentUnderstanding', AgentUnderstandingSchema);
export const Recommendation = mongoose.model('Recommendation', RecommendationSchema);
export const ScenarioEventLog = mongoose.model('ScenarioEventLog', ScenarioEventLogSchema);

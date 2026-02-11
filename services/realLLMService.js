import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getModuleSchema } from './llmModuleSchemas.js';
import * as promptService from './llmPromptService.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

/**
 * Perform a real LLM call to a specified provider.
 * 
 * @param {string} moduleName - The module (schema) to use.
 * @param {object} ctx - The narrative context.
 * @returns {Promise<object>} - Validated JSON response.
 */
export async function callRealLLM(moduleName, ctx) {
    const provider = process.env.LLM_PROVIDER || 'openai';
    const model = process.env.LLM_MODEL || (provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-20240620');

    const systemPrompt = promptService.getSystemPrompt(ctx.understanding);
    const userPrompt = promptService.getPromptForModule(moduleName, ctx);
    const schema = getModuleSchema(moduleName);

    console.log(`[RealLLM] Calling ${provider} (${model}) for module: ${moduleName}`);

    try {
        let result = null;

        if (provider === 'openai') {
            result = await callOpenAI(model, systemPrompt, userPrompt, schema);
        } else if (provider === 'anthropic') {
            result = await callAnthropic(model, systemPrompt, userPrompt, schema);
        } else {
            throw new Error(`Unsupported LLM provider: ${provider}`);
        }

        return {
            ...result,
            _meta: {
                fullPrompt: `${systemPrompt}\n\n[TASK]\n${userPrompt}`,
                provider,
                model
            }
        };
    } catch (error) {
        console.error(`[RealLLM] Error calling ${provider}:`, error.message);
        throw error;
    }
}

/**
 * Call OpenAI with Structured Outputs or JSON mode.
 */
async function callOpenAI(model, system, user, schema) {
    if (!openai) throw new Error('OPENAI_API_KEY not configured');

    const response = await openai.chat.completions.create({
        model,
        messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
        ],
        response_format: { type: 'json_object' } // We will enforce schema matching manually or via Zod if needed
    });

    const content = JSON.parse(response.choices[0].message.content);
    return content;
}

/**
 * Call Anthropic with JSON enforcement.
 */
async function callAnthropic(model, system, user, schema) {
    if (!anthropic) throw new Error('ANTHROPIC_API_KEY not configured');

    const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        system: system,
        messages: [
            { role: 'user', content: `${user}\n\nIMPORTANT: Return ONLY a raw JSON object matching the requested structure.` }
        ]
    });

    const content = JSON.parse(response.content[0].text);
    return content;
}

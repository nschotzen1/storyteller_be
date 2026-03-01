import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

const KEYS_TYPE = {
    BALANCE: "BALANCE",
    FREE: "FREE",
};

const OPENAI_DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5';
const OPENAI_MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_TEXT_MODELS = ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
const FALLBACK_IMAGE_MODELS = ['gpt-image-1', 'dall-e-3'];
const MAIN_TEXT_MODELS = ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
const MAIN_IMAGE_MODELS = ['gpt-image-1', 'dall-e-3'];

let openAiModelsCache = {
    fetchedAtMs: 0,
    payload: null
};

function collectOpenAiKeys() {
    const list = process.env.OPENAI_API_KEYS_LIST;
    if (typeof list === 'string' && list.trim()) {
        const splitKeys = list.split(',').map((key) => key.trim()).filter(Boolean);
        if (splitKeys.length > 0) return splitKeys;
    }

    const singleKey = process.env.OPENAI_API_KEY;
    if (typeof singleKey === 'string' && singleKey.trim()) {
        return [singleKey.trim()];
    }

    return [];
}

export function chooseApiKey() {
    const OPENAI_KEYS = collectOpenAiKeys();
    if (OPENAI_KEYS.length === 0) {
        throw new Error('OpenAI API key is not configured. Set OPENAI_API_KEY or OPENAI_API_KEYS_LIST.');
    }
    const idx = Math.floor(Math.random() * OPENAI_KEYS.length);
    console.log("Chose OpenAI API key index:", idx);
    return OPENAI_KEYS[idx];
}

export function getOpenaiClient() {
    return new OpenAI({apiKey: chooseApiKey()});
}

function normalizeModelObject(model) {
    if (!model || typeof model !== 'string') return null;
    const normalized = model.trim();
    if (!normalized) return null;
    return normalized;
}

function normalizeListedModel(item) {
    if (!item || typeof item !== 'object') return null;
    const id = normalizeModelObject(item.id);
    if (!id) return null;
    return {
        id,
        created: Number.isFinite(Number(item.created)) ? Number(item.created) : 0,
        owned_by: typeof item.owned_by === 'string' ? item.owned_by : ''
    };
}

function sortModels(models) {
    return [...models].sort((a, b) => {
        const createdDiff = (b.created || 0) - (a.created || 0);
        if (createdDiff !== 0) return createdDiff;
        return a.id.localeCompare(b.id);
    });
}

function looksLikeImageModel(id = '') {
    return /image|dall-e/i.test(id);
}

function looksLikeTextModel(id = '') {
    if (!id) return false;
    if (looksLikeImageModel(id)) return false;
    return /^gpt-|^o[1-9]|chatgpt|omni/i.test(id);
}

function selectMainModelsByPriority(availableModels, preferredModelIds) {
    const byId = new Map((availableModels || []).map((model) => [model.id, model]));
    const selected = [];

    for (const modelId of preferredModelIds) {
        if (byId.has(modelId)) {
            selected.push(byId.get(modelId));
            continue;
        }
        selected.push({
            id: modelId,
            created: 0,
            owned_by: 'openai'
        });
    }

    return selected;
}

function buildFallbackModelsPayload(source = 'fallback', error = '') {
    const now = new Date().toISOString();
    return {
        source,
        fetchedAt: now,
        textModels: FALLBACK_TEXT_MODELS.map((id) => ({ id, created: 0, owned_by: 'openai' })),
        imageModels: FALLBACK_IMAGE_MODELS.map((id) => ({ id, created: 0, owned_by: 'openai' })),
        allModels: [
            ...FALLBACK_TEXT_MODELS.map((id) => ({ id, created: 0, owned_by: 'openai' })),
            ...FALLBACK_IMAGE_MODELS.map((id) => ({ id, created: 0, owned_by: 'openai' }))
        ],
        error
    };
}

export async function listAvailableOpenAiModels({ forceRefresh = false } = {}) {
    const nowMs = Date.now();
    if (
        !forceRefresh
        && openAiModelsCache.payload
        && nowMs - openAiModelsCache.fetchedAtMs < OPENAI_MODELS_CACHE_TTL_MS
    ) {
        return openAiModelsCache.payload;
    }

    try {
        const client = getOpenaiClient();
        const response = await client.models.list();
        const rawModels = Array.isArray(response?.data) ? response.data : [];
        const normalized = sortModels(
            rawModels
                .map(normalizeListedModel)
                .filter(Boolean)
        );

        const textCandidates = normalized.filter((item) => looksLikeTextModel(item.id));
        const imageCandidates = normalized.filter((item) => looksLikeImageModel(item.id));
        const textModels = selectMainModelsByPriority(textCandidates, MAIN_TEXT_MODELS);
        const imageModels = selectMainModelsByPriority(imageCandidates, MAIN_IMAGE_MODELS);

        const payload = {
            source: 'live',
            fetchedAt: new Date().toISOString(),
            textModels: textModels.length ? textModels : buildFallbackModelsPayload().textModels,
            imageModels: imageModels.length ? imageModels : buildFallbackModelsPayload().imageModels,
            allModels: [...textModels, ...imageModels]
        };

        openAiModelsCache = {
            fetchedAtMs: nowMs,
            payload
        };
        return payload;
    } catch (error) {
        const fallback = buildFallbackModelsPayload('fallback', error?.message || 'Failed to load models from OpenAI.');
        openAiModelsCache = {
            fetchedAtMs: nowMs,
            payload: fallback
        };
        return fallback;
    }
}

export async function directExternalApiCall(prompts, max_tokens = 2500, temperature, mockedResponse, explicitJsonObjectFormat, isOpenAi, modelOverride) {
    if (typeof max_tokens === 'object' && max_tokens !== null) {
        const opts = max_tokens;
        max_tokens = opts.max_tokens ?? 2500;
        temperature = opts.temperature;
        mockedResponse = opts.mockedResponse;
        explicitJsonObjectFormat = opts.explicitJsonObjectFormat;
        isOpenAi = opts.isOpenAi;
        modelOverride = opts.model ?? opts.modelOverride;
    }

    try {
        let rawResp;
        const maxRetries = 3;
        let attempts = 0;
        const selectedModel = normalizeModelObject(modelOverride) || OPENAI_DEFAULT_TEXT_MODEL;

        async function makeApiCall() {
            if (isOpenAi) {
                let req_obj = {
                    // max_tokens,
                    // model: 'gpt-4.1-mini',
                    model: selectedModel,
                    messages: prompts,
                    // temperature: 1,
                    presence_penalty: 0.0,
                    top_p: 1.0,
                };

                // if (explicitJsonObjectFormat)
                //     req_obj['response_format'] = { "type": "json_object" };

                const completion = await getOpenaiClient().chat.completions.create(req_obj);
                return completion.choices[0].message.content;
            } else {
                const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
                if (!anthropicApiKey) {
                    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
                }
                const client = new Anthropic({
                    apiKey: anthropicApiKey,
                });

                prompts = prompts.map((p) => {
                    if (p.role === 'system') {
                        p.role = 'user';
                    }
                    return p;
                });

                const resp = await client.messages.create({
                    messages: prompts,
                    model: 'claude-3-7-sonnet-latest',
                    max_tokens: 8192,
                    temperature: 0.8,
                });

                return resp.content[0].text;
            }
        }

        while (attempts < maxRetries) {
            try {
                let rawResp = await makeApiCall();
                rawResp = rawResp
                    .trim()
                    .replace(/^```(?:json)?\s*/i, '')         // Remove starting ``` or ```json
                    .replace(/```$/, '')                      // Remove ending ```
                    .replace(/^[^{[]*/, '')                   // Remove characters before first { or [
                    .replace(/[^}\]]*$/, '');   
                
                return JSON.parse(rawResp);
                
            } catch (error) {
                attempts++;
                console.warn(`Attempt ${attempts} failed:`, error);

                if (attempts >= maxRetries) {
                    console.error('Failed to get a valid response after retries. Returning raw response.');
                    return rawResp || null;
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }

}

export async function generate_cards(fragmentText, chatHistory) {
    const response = await directExternalApiCall({ // Changed externalApiCall to directExternalApiCall
        prompt: `
        Generate a high-rank card + supporting constellation based on the storytelling fragment.

        Fragment: ${fragmentText}
        Past Context: ${JSON.stringify(chatHistory)}

        Structure:
        {
            "high_rank_card": {
                "archetype": "...",
                "moment_in_time": "...",
                "memory": "...",
                "storytelling_points": 15,
                "seer_observations": { ... }
            },
            "constellation": {
                "connection_type": "...",
                "lesser_cards": [ { ... }, { ... } ]
            }
        }
        `
    });

    return response;
}

import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

const KEYS_TYPE = {
    BALANCE: "BALANCE",
    FREE: "FREE",
};

const OPENAI_DEFAULT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || 'gpt-5';
const OPENAI_MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_TEXT_MODELS = ['gpt-5.2-pro', 'gpt-5.2-chat-latest', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
const FALLBACK_IMAGE_MODELS = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3'];
const MAIN_TEXT_MODELS = ['gpt-5.2-pro', 'gpt-5.2-chat-latest', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'];
const MAIN_IMAGE_MODELS = ['gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'dall-e-3'];
const ANTHROPIC_DEFAULT_TEXT_MODEL = process.env.ANTHROPIC_TEXT_MODEL || 'claude-3-7-sonnet-latest';
const FALLBACK_ANTHROPIC_TEXT_MODELS = [
    'claude-3-7-sonnet-latest',
    'claude-3-opus-latest',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest'
];

let openAiModelsCache = {
    fetchedAtMs: 0,
    payload: null
};
let anthropicModelsCache = {
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

function collectAnthropicKeys() {
    const list = process.env.ANTHROPIC_API_KEYS_LIST;
    if (typeof list === 'string' && list.trim()) {
        const splitKeys = list.split(',').map((key) => key.trim()).filter(Boolean);
        if (splitKeys.length > 0) return splitKeys;
    }

    const singleKey = process.env.ANTHROPIC_API_KEY;
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

export function chooseAnthropicApiKey() {
    const anthropicKeys = collectAnthropicKeys();
    if (anthropicKeys.length === 0) {
        throw new Error('Anthropic API key is not configured. Set ANTHROPIC_API_KEY or ANTHROPIC_API_KEYS_LIST.');
    }
    const idx = Math.floor(Math.random() * anthropicKeys.length);
    console.log('Chose Anthropic API key index:', idx);
    return anthropicKeys[idx];
}

export function getAnthropicClient() {
    return new Anthropic({ apiKey: chooseAnthropicApiKey() });
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

function normalizeAnthropicListedModel(item) {
    if (!item || typeof item !== 'object') return null;
    const id = normalizeModelObject(item.id);
    if (!id) return null;
    return {
        id,
        created: typeof item.created_at === 'string'
            ? Math.floor(Date.parse(item.created_at) / 1000) || 0
            : 0,
        owned_by: 'anthropic'
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

function isResponsesPreferredOpenAiModel(id = '') {
    const normalized = typeof id === 'string' ? id.trim().toLowerCase() : '';
    return /^gpt-5(?:\.\d+)?-pro(?:-\d{4}-\d{2}-\d{2})?$/.test(normalized);
}

function extractResponsesOutputText(response) {
    const directOutputText = typeof response?.output_text === 'string' ? response.output_text.trim() : '';
    if (directOutputText) {
        return directOutputText;
    }

    const fragments = [];
    const outputItems = Array.isArray(response?.output) ? response.output : [];
    for (const item of outputItems) {
        const contentItems = Array.isArray(item?.content) ? item.content : [];
        for (const content of contentItems) {
            if (typeof content?.text === 'string' && content.text.trim()) {
                fragments.push(content.text.trim());
            }
        }
    }
    return fragments.join('\n').trim();
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

function buildFallbackAnthropicModelsPayload(source = 'fallback', error = '') {
    const now = new Date().toISOString();
    return {
        source,
        fetchedAt: now,
        textModels: FALLBACK_ANTHROPIC_TEXT_MODELS.map((id) => ({ id, created: 0, owned_by: 'anthropic' })),
        imageModels: [],
        allModels: FALLBACK_ANTHROPIC_TEXT_MODELS.map((id) => ({ id, created: 0, owned_by: 'anthropic' })),
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

export async function listAvailableAnthropicModels({ forceRefresh = false } = {}) {
    const nowMs = Date.now();
    if (
        !forceRefresh
        && anthropicModelsCache.payload
        && nowMs - anthropicModelsCache.fetchedAtMs < OPENAI_MODELS_CACHE_TTL_MS
    ) {
        return anthropicModelsCache.payload;
    }

    try {
        const client = getAnthropicClient();
        const response = await client.models.list();
        const rawModels = Array.isArray(response?.data) ? response.data : [];
        const normalized = sortModels(
            rawModels
                .map(normalizeAnthropicListedModel)
                .filter(Boolean)
        );
        const textModels = normalized.length ? normalized : buildFallbackAnthropicModelsPayload().textModels;
        const payload = {
            source: 'live',
            fetchedAt: new Date().toISOString(),
            textModels,
            imageModels: [],
            allModels: textModels
        };
        anthropicModelsCache = {
            fetchedAtMs: nowMs,
            payload
        };
        return payload;
    } catch (error) {
        const fallback = buildFallbackAnthropicModelsPayload(
            'fallback',
            error?.message || 'Failed to load models from Anthropic.'
        );
        anthropicModelsCache = {
            fetchedAtMs: nowMs,
            payload: fallback
        };
        return fallback;
    }
}

export async function callJsonLlm({
    prompts,
    model,
    provider = 'openai',
    max_tokens = 2500,
    temperature,
    explicitJsonObjectFormat = true
} = {}) {
    const normalizedProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : 'openai';
    const isOpenAi = normalizedProvider !== 'anthropic';
    const fallbackModel = isOpenAi ? OPENAI_DEFAULT_TEXT_MODEL : ANTHROPIC_DEFAULT_TEXT_MODEL;
    const selectedModel = normalizeModelObject(model) || fallbackModel;

    return directExternalApiCall(prompts, {
        max_tokens,
        temperature,
        explicitJsonObjectFormat,
        isOpenAi,
        model: selectedModel
    });
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
        const useOpenAi = isOpenAi !== false;
        const selectedModel = normalizeModelObject(modelOverride)
            || (useOpenAi ? OPENAI_DEFAULT_TEXT_MODEL : ANTHROPIC_DEFAULT_TEXT_MODEL);

        async function makeApiCall() {
            if (useOpenAi) {
                if (isResponsesPreferredOpenAiModel(selectedModel)) {
                    const response = await getOpenaiClient().responses.create({
                        model: selectedModel,
                        input: prompts
                    });
                    const responseText = extractResponsesOutputText(response);
                    if (!responseText) {
                        throw new Error('Responses API did not return textual output.');
                    }
                    return responseText;
                }

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
                const client = getAnthropicClient();

                prompts = prompts.map((p) => {
                    if (p.role === 'system') {
                        p.role = 'user';
                    }
                    return p;
                });

                const resp = await client.messages.create({
                    messages: prompts,
                    model: selectedModel,
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

import { OpenAI } from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';

const KEYS_TYPE = {
    BALANCE: "BALANCE",
    FREE: "FREE",
};

export function chooseApiKey() {
    const keysList = process.env.OPENAI_API_KEYS_LIST;
    if (!keysList) {
        throw new Error('OPENAI_API_KEYS_LIST environment variable is not set.');
    }
    const OPENAI_KEYS = keysList.split(',').map(key => key.trim()).filter(key => key);
    if (OPENAI_KEYS.length === 0) {
        throw new Error('OPENAI_API_KEYS_LIST is empty or contains no valid keys.');
    }
    const idx = Math.floor(Math.random() * OPENAI_KEYS.length);
    console.log("Chose OpenAI API key index:", idx);
    return OPENAI_KEYS[idx];
}

export function getOpenaiClient() {
    return new OpenAI({apiKey: chooseApiKey()});
}

export async function directExternalApiCall(prompts, max_tokens = 2500, temperature, mockedResponse, explicitJsonObjectFormat, isOpenAi) {
    try {
        let rawResp;
        const maxRetries = 3;
        let attempts = 0;

        async function makeApiCall() {
            if (isOpenAi) {
                let req_obj = {
                    max_tokens,
                    model: 'gpt-4.1-mini',
                    messages: prompts,
                    temperature: 1.08,
                    presence_penalty: 0.0
                };

                if (explicitJsonObjectFormat)
                    req_obj['response_format'] = { "type": "json_object" };

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
                rawResp.trim()
                  .replace(/^[^{[]*/, '') // Remove characters before the opening { or [
                  .replace(/[^}*\]]*$/, ''); // Remove characters after the closing } or ]
                if(explicitJsonObjectFormat)
                return JSON.parse(rawResp);
                else
                return rawResp
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

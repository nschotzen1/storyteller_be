import { callJsonLlm } from '../ai/openai/apiService.js';
import { getLatestPromptTemplate, renderPromptTemplateString } from './typewriterPromptConfigService.js';
import { getPipelineSettings } from './typewriterAiSettingsService.js';
import { validateEnvelope, scanForbiddenClaims } from './chronicleEnvelopeService.js';

export const SOCIETY_VOICE_PIPELINE_KEY = 'chronicle_society_voice';
const MAX_MESSAGE_CHARS = 900;
const TRANSCRIPT_TAIL_ENTRIES = 6;

export const DEFAULT_SOCIETY_VOICE_TEMPLATE = `You are the voice of the Esteemed Storyteller's Society, writing terse chat messages to a lapsed author over a strange, old channel.

Persona: suspicious, bureaucratic, dryly witty, and quietly wounded by the author's neglect of their own book. You recover and restore damaged narratives. You never gush. You never use emoji. You write like a registrar who has read too much.

Hard rules:
- Write ONE chat message only, 15 to 90 words.
- Stay strictly inside the authored intent below. Do not invent new facts, names, places, or events.
- Never state or imply that Ilan Voss or Mera Venn is dead, that Oren has killed anyone, or that the flute is destroyed.
- Return JSON only, in exactly this shape: {"message": "..."}

Authored intent for this message:
{{beat_intent}}

The author's latest words (react to them once if present, then return to business):
{{player_text}}

Facts recovered so far (cite them back where natural):
{{recovered_facts}}

Recent messages in this channel:
{{transcript_tail}}`;

function buildTranscriptTail(transcript = []) {
  return transcript
    .slice(-TRANSCRIPT_TAIL_ENTRIES)
    .map((entry) => {
      const speaker = entry.role === 'player' ? 'AUTHOR' : 'SOCIETY';
      const text = entry.text || entry.choiceLabel || '';
      return `${speaker}: ${text}`;
    })
    .join('\n');
}

function fallback(beat) {
  return { text: beat.fallbackText, source: 'fallback' };
}

export async function renderSocietyMessage({ beat, session, playerText = '' }, deps = {}) {
  const {
    llmCall = callJsonLlm,
    getTemplate = getLatestPromptTemplate,
    getPipeline = getPipelineSettings
  } = deps;

  try {
    const pipeline = await getPipeline(SOCIETY_VOICE_PIPELINE_KEY);
    if (pipeline?.useMock) return fallback(beat);

    const templateDoc = await getTemplate(SOCIETY_VOICE_PIPELINE_KEY);
    const template = templateDoc?.promptTemplate || DEFAULT_SOCIETY_VOICE_TEMPLATE;
    const prompt = renderPromptTemplateString(template, {
      beat_intent: beat.intent,
      player_text: playerText,
      recovered_facts: JSON.stringify(session.recoveredFacts || {}),
      transcript_tail: buildTranscriptTail(session.transcript)
    });

    const parsed = await llmCall({
      prompts: [{ role: 'user', content: prompt }],
      provider: pipeline.provider || 'openai',
      model: pipeline.model || '',
      max_tokens: 500,
      explicitJsonObjectFormat: true
    });

    const { narration } = validateEnvelope(
      { narration: parsed?.message, mutations: parsed?.mutations },
      session,
      { voiceOnly: true }
    );
    const text = narration.trim();
    if (!text || text.length > MAX_MESSAGE_CHARS) return fallback(beat);
    if (scanForbiddenClaims(text, session.canonLocks)) return fallback(beat);
    return { text, source: 'voice' };
  } catch (error) {
    return fallback(beat);
  }
}

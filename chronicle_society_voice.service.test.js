import { jest } from '@jest/globals';
import {
  renderSocietyMessage,
  DEFAULT_SOCIETY_VOICE_TEMPLATE,
  SOCIETY_VOICE_PIPELINE_KEY
} from './services/chronicleSocietyVoiceService.js';

const beat = {
  id: 'm_accusation',
  kind: 'message',
  intent: 'Identify yourselves and cite the file number.',
  fallbackText: 'File 7,349-Dusk. The Society does not neglect stories.'
};

const session = {
  recoveredFacts: { pageCount: '214' },
  canonLocks: {
    forbiddenClaims: [
      { id: 'ilan_dead', pattern: 'ilan[^.!?]*\\b(dead|died|corpse|killed)\\b', note: 'Ilan is alive.' }
    ]
  },
  cells: [],
  pressure: { sources: {} },
  transcript: [
    { role: 'society', text: 'You are the author of record.' },
    { role: 'player', choiceLabel: 'I am.' }
  ]
};

const livePipeline = async () => ({ useMock: false, provider: 'openai', model: 'gpt-5-mini' });
const noTemplate = async () => null;

describe('chronicleSocietyVoiceService', () => {
  test('renders the voice message from the LLM reply', async () => {
    const llmCall = jest.fn(async () => ({ message: 'File 7,349-Dusk. We have been patient.' }));
    const result = await renderSocietyMessage(
      { beat, session, playerText: 'I am.' },
      { llmCall, getPipeline: livePipeline, getTemplate: noTemplate }
    );
    expect(result).toEqual({ text: 'File 7,349-Dusk. We have been patient.', source: 'voice' });
    const call = llmCall.mock.calls[0][0];
    expect(call.prompts[0].content).toContain('Identify yourselves and cite the file number.');
    expect(call.prompts[0].content).toContain('I am.');
    expect(call.explicitJsonObjectFormat).toBe(true);
  });

  test('falls back to authored text when the LLM call throws', async () => {
    const llmCall = jest.fn(async () => { throw new Error('provider down'); });
    const result = await renderSocietyMessage(
      { beat, session },
      { llmCall, getPipeline: livePipeline, getTemplate: noTemplate }
    );
    expect(result).toEqual({ text: beat.fallbackText, source: 'fallback' });
  });

  test('falls back when the reply is empty, oversized, or trips a forbidden claim', async () => {
    for (const message of ['', '   ', 'x'.repeat(1000), 'Ilan is dead. We regret to report it.']) {
      const llmCall = jest.fn(async () => ({ message }));
      const result = await renderSocietyMessage(
        { beat, session },
        { llmCall, getPipeline: livePipeline, getTemplate: noTemplate }
      );
      expect(result.source).toBe('fallback');
      expect(result.text).toBe(beat.fallbackText);
    }
  });

  test('ignores stray mutations in the reply (voice-only) but keeps the message', async () => {
    const llmCall = jest.fn(async () => ({
      message: 'The register is updated.',
      mutations: [{ type: 'increase_pressure', source: 'vossDanger', amount: 2 }]
    }));
    const result = await renderSocietyMessage(
      { beat, session },
      { llmCall, getPipeline: livePipeline, getTemplate: noTemplate }
    );
    expect(result).toEqual({ text: 'The register is updated.', source: 'voice' });
    expect(session.pressure.sources).toEqual({});
  });

  test('skips the LLM entirely when the pipeline is set to mock', async () => {
    const llmCall = jest.fn();
    const result = await renderSocietyMessage(
      { beat, session },
      { llmCall, getPipeline: async () => ({ useMock: true }), getTemplate: noTemplate }
    );
    expect(result).toEqual({ text: beat.fallbackText, source: 'fallback' });
    expect(llmCall).not.toHaveBeenCalled();
  });

  test('exports the pipeline key and a default template with the contract variables', () => {
    expect(SOCIETY_VOICE_PIPELINE_KEY).toBe('chronicle_society_voice');
    for (const variable of ['{{beat_intent}}', '{{player_text}}', '{{recovered_facts}}', '{{transcript_tail}}']) {
      expect(DEFAULT_SOCIETY_VOICE_TEMPLATE).toContain(variable);
    }
  });
});

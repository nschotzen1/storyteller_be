import { randomUUID } from 'crypto';
import { loadThorbataBible } from './thorbataBibleService.js';
import { renderSocietyMessage } from './chronicleSocietyVoiceService.js';

function ritualError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function questionView(beat) {
  return {
    beatId: beat.id,
    text: beat.text,
    options: beat.options.map(({ id, label }) => ({ id, label })),
    allowFreeText: Boolean(beat.allowFreeText)
  };
}

function applyEvidenceWrites(session, beat, answer = '') {
  for (const write of beat.writeEvidence || []) {
    session.evidence.push({
      id: randomUUID(),
      source: write.source,
      text: write.textTemplate.replace(/\{\{\s*answer\s*\}\}/g, answer),
      reliability: write.reliability,
      linkedCells: []
    });
  }
}

async function flushBeats(session, playerText, deps) {
  const { ritual } = await loadThorbataBible();
  const messages = [];

  while (session.ritual.cursor < ritual.beats.length) {
    const beat = ritual.beats[session.ritual.cursor];

    if (beat.kind === 'message') {
      const rendered = await renderSocietyMessage(
        { beat, session, playerText: beat.reactsToPlayer ? playerText : '' },
        deps
      );
      const entry = {
        at: new Date().toISOString(),
        role: 'society',
        beatId: beat.id,
        text: rendered.text,
        source: rendered.source,
        flags: beat.flags || {},
        ...(beat.timestampJump ? { timestampJump: beat.timestampJump } : {}),
        ...(beat.arrivesEarly ? { arrivesEarly: true } : {})
      };
      applyEvidenceWrites(session, beat);
      session.transcript.push(entry);
      messages.push(entry);
      session.ritual.cursor += 1;
      continue;
    }

    if (beat.kind === 'question') {
      return { messages, question: questionView(beat), act: session.act };
    }

    // act_transition
    session.act = beat.toAct;
    session.ritual.cursor += 1;
    return { messages, question: null, act: session.act };
  }

  return { messages, question: null, act: session.act };
}

export async function runRitualStart(session, deps = {}) {
  return flushBeats(session, '', deps);
}

export async function applyRitualAnswer(session, { choiceId, freeText = '' } = {}, deps = {}) {
  const { ritual } = await loadThorbataBible();
  const beat = ritual.beats[session.ritual?.cursor];
  if (!beat || beat.kind !== 'question') {
    throw ritualError('INVALID_RITUAL_STATE', 'No question is pending in the ritual');
  }
  const option = beat.options.find((o) => o.id === choiceId);
  if (!option) {
    throw ritualError('UNKNOWN_CHOICE', `Unknown choice for beat ${beat.id}: ${choiceId}`);
  }

  const safeFreeText = beat.allowFreeText && typeof freeText === 'string' ? freeText.trim().slice(0, 200) : '';
  if (beat.factKey) {
    session.recoveredFacts[beat.factKey] = option.factValue;
  }
  applyEvidenceWrites(session, beat, option.factValue || option.label);
  session.transcript.push({
    at: new Date().toISOString(),
    role: 'player',
    beatId: beat.id,
    choiceId,
    choiceLabel: option.label,
    ...(safeFreeText ? { freeText: safeFreeText } : {})
  });
  session.ritual.cursor += 1;

  const playerText = safeFreeText ? `${option.label} — ${safeFreeText}` : option.label;
  return flushBeats(session, playerText, deps);
}

export async function getPendingQuestion(session) {
  const { ritual } = await loadThorbataBible();
  const beat = ritual.beats[session.ritual?.cursor];
  return beat && beat.kind === 'question' ? questionView(beat) : null;
}

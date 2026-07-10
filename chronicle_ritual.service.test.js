import {
  runRitualStart,
  applyRitualAnswer,
  getPendingQuestion
} from './services/chronicleRitualService.js';
import { loadThorbataBible } from './services/thorbataBibleService.js';

// Deterministic voice: force the authored fallback path for every beat.
const deps = { getPipeline: async () => ({ useMock: true }) };

function buildSession() {
  return {
    chronicleId: 'test-chronicle',
    act: 'SOCIETY_CHAT',
    recoveredFacts: { pageCount: null, heroStance: null, chapterTitle: null, tavernDish: null, writingPlace: null },
    canonLocks: { forbiddenClaims: [] },
    character: { tendencies: {}, notes: [] },
    evidence: [],
    cells: [],
    pressure: { value: 0, threshold: 6, sources: {}, lastSceneAt: null },
    transcript: [],
    ritual: { cursor: 0 }
  };
}

async function answerPending(session, ...preferredChoiceIds) {
  const question = await getPendingQuestion(session);
  const choice =
    question.options.find((o) => preferredChoiceIds.includes(o.id)) || question.options[0];
  return applyRitualAnswer(session, { choiceId: choice.id }, deps);
}

describe('chronicleRitualService', () => {
  test('runRitualStart delivers the opening messages and stops on the first question', async () => {
    const session = buildSession();
    const result = await runRitualStart(session, deps);
    expect(result.messages.map((m) => m.beatId)).toEqual(['m_first_contact', 'm_accusation']);
    expect(result.messages[0].source).toBe('fallback');
    expect(result.question).toEqual({
      beatId: 'q_identity',
      text: expect.stringContaining('author'),
      options: [
        { id: 'opt_am', label: 'I am.' },
        { id: 'opt_dont_know', label: "I don't know what you're talking about." },
        { id: 'opt_who', label: 'Who is this?' }
      ],
      allowFreeText: true
    });
    expect(result.act).toBe('SOCIETY_CHAT');
    expect(session.transcript).toHaveLength(2);
  });

  test('applyRitualAnswer records the player, writes facts from the choice, and continues', async () => {
    const session = buildSession();
    await runRitualStart(session, deps);
    await applyRitualAnswer(session, { choiceId: 'opt_am', freeText: 'It has been years.' }, deps);
    const afterPages = await applyRitualAnswer(session, { choiceId: 'opt_214' }, deps);

    expect(session.recoveredFacts.pageCount).toBe('214');
    const playerEntries = session.transcript.filter((e) => e.role === 'player');
    expect(playerEntries[0]).toMatchObject({
      beatId: 'q_identity', choiceId: 'opt_am', choiceLabel: 'I am.', freeText: 'It has been years.'
    });
    expect(afterPages.question.beatId).toBe('q_hero_stance');
  });

  test('rejects unknown choices and answers with no pending question', async () => {
    const session = buildSession();
    await runRitualStart(session, deps);
    await expect(applyRitualAnswer(session, { choiceId: 'opt_nope' }, deps))
      .rejects.toMatchObject({ code: 'UNKNOWN_CHOICE' });

    const midMessageSession = buildSession();
    // cursor 0 points at a message beat, not a question
    await expect(applyRitualAnswer(midMessageSession, { choiceId: 'opt_am' }, deps))
      .rejects.toMatchObject({ code: 'INVALID_RITUAL_STATE' });
  });

  test('freeText on a non-flagged question is dropped, not stored', async () => {
    const session = buildSession();
    await runRitualStart(session, deps);
    await applyRitualAnswer(session, { choiceId: 'opt_am' }, deps);
    await applyRitualAnswer(session, { choiceId: 'opt_214', freeText: 'smuggled words' }, deps);
    const pagesEntry = session.transcript.find((e) => e.role === 'player' && e.beatId === 'q_page_count');
    expect(pagesEntry.freeText).toBeUndefined();
  });

  test('the full ritual walks to ARRIVAL_SCENE with all facts and evidence written', async () => {
    const session = buildSession();
    let result = await runRitualStart(session, deps);
    let guard = 0;
    while (result.question && guard < 20) {
      result = await answerPending(
        session, 'opt_am', 'opt_214', 'opt_heroine', 'opt_wolf', 'opt_eel_pie', 'opt_kolkata'
      );
      guard += 1;
    }
    expect(result.act).toBe('ARRIVAL_SCENE');
    expect(session.act).toBe('ARRIVAL_SCENE');
    expect(session.recoveredFacts).toEqual({
      pageCount: '214',
      heroStance: 'heroine',
      chapterTitle: 'The Wolf at the Manor Door',
      tavernDish: 'eel pie in black butter',
      writingPlace: 'kolkata room'
    });
    const sources = session.evidence.map((e) => e.source);
    expect(sources.filter((s) => s === 'society_note')).toHaveLength(2);
    const menuNote = session.evidence.find((e) => e.text.includes('eel pie in black butter'));
    expect(menuNote.reliability).toBe('suspect');
    const societyBeats = session.transcript.filter((e) => e.role === 'society').map((e) => e.beatId);
    const { ritual } = await loadThorbataBible();
    const authoredMessageBeats = ritual.beats.filter((b) => b.kind === 'message').map((b) => b.id);
    expect(societyBeats).toEqual(authoredMessageBeats);
    const jump = session.transcript.find((e) => e.beatId === 'm_parcel');
    expect(jump.timestampJump).toBe('three days later');
    expect(await getPendingQuestion(session)).toBeNull();
  });
});

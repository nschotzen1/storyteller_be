import { validateEnvelope, applyEnvelope } from './services/chronicleEnvelopeService.js';

function makeSession() {
  return {
    chronicleId: 'test-chronicle',
    canonLocks: {
      characters: ['mera_venn', 'ilan_voss'],
      locations: ['eel_and_seagull'],
      fixedEvents: [{ id: 'ilan_trapped', text: 'Ilan Voss is trapped alive.' }],
      forbiddenClaims: [
        { id: 'ilan_dead', pattern: 'ilan[^.!?]*\\b(dead|died|corpse|killed)\\b', note: 'Ilan is alive.' }
      ]
    },
    character: { tendencies: { caution: 0, nerve: 0, curiosity: 4, guile: 0, empathy: 0 }, notes: [] },
    evidence: [],
    cells: [
      { id: 'brannics_cellar', label: "Brannic's cellar", state: 'damaged', text: 'x', playerContributions: [], links: [], gmHooks: {} },
      { id: 'ilan_below_barrels', label: 'Below the barrels', state: 'damaged', text: 'y', playerContributions: [], links: [], gmHooks: {} }
    ],
    pressure: {
      value: 0, threshold: 6,
      sources: { wolfInstability: 0, vossDanger: 0, societySuspicion: 0, fluteDeadline: 0 },
      lastSceneAt: null
    },
    transcript: []
  };
}

describe('validateEnvelope', () => {
  test('accepts well-formed mutations and preserves narration', () => {
    const result = validateEnvelope({
      narration: 'The cellar listens.',
      societyNote: 'Archivist approves.',
      mutations: [
        { type: 'grow_cell', cellId: 'brannics_cellar', addedText: 'The third barrel sweats at low tide.' },
        { type: 'increase_pressure', source: 'vossDanger', amount: 1 }
      ]
    }, makeSession());
    expect(result.narration).toBe('The cellar listens.');
    expect(result.accepted).toHaveLength(2);
    expect(result.rejected).toHaveLength(0);
  });

  test('drops unknown mutation types', () => {
    const result = validateEnvelope({
      narration: '', mutations: [{ type: 'delete_everything' }]
    }, makeSession());
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/unknown mutation type/i);
  });

  test('rejects mutations referencing unknown cells', () => {
    const result = validateEnvelope({
      narration: '', mutations: [{ type: 'grow_cell', cellId: 'nonexistent', addedText: 'x' }]
    }, makeSession());
    expect(result.rejected[0].reason).toMatch(/unknown cell/i);
  });

  test('rejects text violating forbidden claims (canon lock)', () => {
    const result = validateEnvelope({
      narration: '',
      mutations: [{ type: 'grow_cell', cellId: 'brannics_cellar', addedText: 'Ilan was dead all along.' }]
    }, makeSession());
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/forbidden claim: ilan_dead/i);
  });

  test('rejects unknown pressure sources and invalid evidence sources', () => {
    const result = validateEnvelope({
      narration: '',
      mutations: [
        { type: 'increase_pressure', source: 'volcano', amount: 1 },
        { type: 'create_evidence', source: 'wikipedia', text: 'x', reliability: 'confirmed' }
      ]
    }, makeSession());
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(2);
  });

  test('voiceOnly mode rejects every mutation (Act 1 society voice)', () => {
    const result = validateEnvelope({
      narration: 'We found your book.',
      mutations: [{ type: 'increase_pressure', source: 'vossDanger', amount: 1 }]
    }, makeSession(), { voiceOnly: true });
    expect(result.narration).toBe('We found your book.');
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/voice-only/i);
  });
});

describe('applyEnvelope', () => {
  test('grow_cell appends a contribution and marks the cell restored', () => {
    const session = makeSession();
    const { accepted } = validateEnvelope({
      narration: '',
      mutations: [{ type: 'grow_cell', cellId: 'brannics_cellar', addedText: 'The third barrel sweats.' }]
    }, session);
    applyEnvelope(session, accepted, { actor: 'player' });
    const cell = session.cells.find((c) => c.id === 'brannics_cellar');
    expect(cell.state).toBe('restored');
    expect(cell.playerContributions).toEqual(['The third barrel sweats.']);
  });

  test('gm actor mutates rather than restores', () => {
    const session = makeSession();
    const { accepted } = validateEnvelope({
      narration: '',
      mutations: [{ type: 'grow_cell', cellId: 'brannics_cellar', addedText: 'Claw marks on the stair.' }]
    }, session);
    applyEnvelope(session, accepted, { actor: 'gm' });
    const cell = session.cells.find((c) => c.id === 'brannics_cellar');
    expect(cell.state).toBe('mutated');
    expect(cell.playerContributions).toEqual([]);
  });

  test('link_cells stamps createdBy from actor, never from input', () => {
    const session = makeSession();
    const { accepted } = validateEnvelope({
      narration: '',
      mutations: [{
        type: 'link_cells', from: 'brannics_cellar', to: 'ilan_below_barrels',
        predicate: 'conceals the way to', createdBy: 'author'
      }]
    }, session);
    applyEnvelope(session, accepted, { actor: 'player' });
    const cell = session.cells.find((c) => c.id === 'brannics_cellar');
    expect(cell.links[0]).toEqual({
      toCellId: 'ilan_below_barrels', predicate: 'conceals the way to', createdBy: 'player'
    });
  });

  test('create_cell adds a new cell with slug id; create_evidence gets an id; tendencies cap at 5', () => {
    const session = makeSession();
    const { accepted } = validateEnvelope({
      narration: '',
      mutations: [
        { type: 'create_cell', label: 'The Tide Bell', links: ['brannics_cellar'] },
        { type: 'create_evidence', source: 'player_restoration', text: 'A bell rope below the water line.', reliability: 'suspect' },
        { type: 'infer_character', tendency: 'curiosity', amount: 3, note: 'peered into the shaft' }
      ]
    }, session);
    applyEnvelope(session, accepted, { actor: 'player' });
    const created = session.cells.find((c) => c.label === 'The Tide Bell');
    expect(created.id).toBe('the_tide_bell');
    expect(created.state).toBe('restored');
    expect(created.links[0]).toEqual({ toCellId: 'brannics_cellar', predicate: 'relates to', createdBy: 'player' });
    expect(session.evidence[0].id).toBeTruthy();
    expect(session.evidence[0].source).toBe('player_restoration');
    expect(session.character.tendencies.curiosity).toBe(5);
  });

  test('increase_pressure raises source and total', () => {
    const session = makeSession();
    const { accepted } = validateEnvelope({
      narration: '',
      mutations: [{ type: 'increase_pressure', source: 'vossDanger', amount: 2 }]
    }, session);
    applyEnvelope(session, accepted, { actor: 'gm' });
    expect(session.pressure.sources.vossDanger).toBe(2);
    expect(session.pressure.value).toBe(2);
  });
});

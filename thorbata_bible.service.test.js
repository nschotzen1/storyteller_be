import {
  loadThorbataBible,
  buildInitialCells,
  buildCanonLocks
} from './services/thorbataBibleService.js';

describe('thorbataBibleService', () => {
  test('loads and validates the bible and chapter', async () => {
    const { bible, chapter } = await loadThorbataBible();
    expect(bible.chronicle).toBe('early-dusk');
    expect(bible.characters.map((c) => c.id)).toEqual(
      expect.arrayContaining(['mera_venn', 'oren_venn', 'brannic_pell', 'ilan_voss'])
    );
    expect(chapter.cells.length).toBeGreaterThanOrEqual(12);
    expect(chapter.routeCondition.requiredRestored).toEqual(
      ['brannics_cellar', 'ilan_below_barrels', 'tin_strip_warm']
    );
  });

  test('buildInitialCells stamps author provenance and play-time fields', async () => {
    const { chapter } = await loadThorbataBible();
    const cells = buildInitialCells(chapter);
    const brannics = cells.find((c) => c.id === 'brannics_cellar');
    expect(brannics.state).toBe('damaged');
    expect(brannics.playerContributions).toEqual([]);
    expect(brannics.links.length).toBeGreaterThan(0);
    for (const cell of cells) {
      for (const link of cell.links) {
        expect(link.createdBy).toBe('author');
        expect(cells.some((c) => c.id === link.toCellId)).toBe(true);
      }
    }
  });

  test('every cell link target exists and x_dog starts labeled X', async () => {
    const { chapter } = await loadThorbataBible();
    const cells = buildInitialCells(chapter);
    const xDog = cells.find((c) => c.id === 'x_dog');
    expect(xDog.label).toBe('X');
  });

  test('buildCanonLocks exposes locked ids and forbidden claims', async () => {
    const { bible } = await loadThorbataBible();
    const locks = buildCanonLocks(bible);
    expect(locks.characters).toEqual(
      expect.arrayContaining(['mera_venn', 'oren_venn', 'brannic_pell', 'ilan_voss'])
    );
    expect(locks.forbiddenClaims.length).toBeGreaterThanOrEqual(3);
    for (const claim of locks.forbiddenClaims) {
      expect(typeof claim.pattern).toBe('string');
      expect(() => new RegExp(claim.pattern, 'i')).not.toThrow();
    }
  });

  test('loadThorbataBible returns the act 1 ritual with intact rails', async () => {
    const { ritual } = await loadThorbataBible();
    expect(ritual.ritualId).toBe('early-dusk-act1');
    const kinds = ritual.beats.map((b) => b.kind);
    expect(kinds[kinds.length - 1]).toBe('act_transition');
    expect(ritual.beats[ritual.beats.length - 1].toAct).toBe('ARRIVAL_SCENE');

    const questionBeats = ritual.beats.filter((b) => b.kind === 'question');
    const factKeys = questionBeats.map((b) => b.factKey).filter(Boolean);
    expect(factKeys.sort()).toEqual(
      ['chapterTitle', 'heroStance', 'pageCount', 'tavernDish', 'writingPlace']
    );
    for (const beat of questionBeats) {
      expect(beat.options.length).toBeGreaterThanOrEqual(2);
      expect(beat.options.length).toBeLessThanOrEqual(4);
      if (beat.factKey) {
        for (const option of beat.options) {
          expect(typeof option.factValue).toBe('string');
          expect(option.factValue.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('every message beat carries authored intent and fallback text', async () => {
    const { ritual } = await loadThorbataBible();
    for (const beat of ritual.beats.filter((b) => b.kind === 'message')) {
      expect(beat.intent.length).toBeGreaterThan(20);
      expect(beat.fallbackText.length).toBeGreaterThan(20);
    }
  });

  test('forbidden-claim patterns compile at load time', async () => {
    const { bible } = await loadThorbataBible();
    for (const claim of bible.forbiddenClaims) {
      expect(() => new RegExp(claim.pattern, 'i')).not.toThrow();
    }
  });
});

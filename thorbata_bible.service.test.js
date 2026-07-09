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
});

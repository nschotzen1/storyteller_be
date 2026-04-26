import {
  getPublicNarrativeEntitySeed,
  getPublicNarrativeEntitySessionId,
  listPublicNarrativeEntitySeeds
} from './services/publicNarrativeEntitySeedService.js';

describe('public narrative entity seed service', () => {
  test('loads the five core canonical public entities', () => {
    expect(getPublicNarrativeEntitySessionId()).toBe('__public__');

    const seeds = listPublicNarrativeEntitySeeds();
    expect(seeds).toHaveLength(5);

    const externalIds = seeds.map((seed) => seed.externalId).sort();
    expect(externalIds).toEqual([
      'builtin:deck_of_cards',
      'builtin:defilers',
      'builtin:storyteller_archetype',
      'builtin:storytellers_society',
      'builtin:xerofag'
    ]);

    for (const seed of seeds) {
      expect(seed).toEqual(
        expect.objectContaining({
          session_id: '__public__',
          sessionId: '__public__',
          privacy: 'public',
          source: 'public_narrative_entity_seed',
          sourceRoute: 'seeds/public_narrative_entities.json',
          canonicalStatus: 'canonical'
        })
      );
      expect(typeof seed.name).toBe('string');
      expect(seed.name.length).toBeGreaterThan(0);
      expect(typeof seed.description).toBe('string');
      expect(seed.description.length).toBeGreaterThan(0);
      expect(typeof seed.lore).toBe('string');
      expect(seed.lore.length).toBeGreaterThan(0);
    }

    const xerofag = getPublicNarrativeEntitySeed('builtin:xerofag');
    expect(xerofag).toEqual(
      expect.objectContaining({
        name: 'The Xerofag',
        typewriterKeyText: 'THE XEROFAG',
        activeInTypewriter: true,
        storytelling_points: 14
      })
    );
    expect(xerofag.mockInspectionSignals.canine).toContain('hound');
    expect(xerofag.mockInspectionSignals.undead).toContain('grave');

    const defilers = getPublicNarrativeEntitySeed('builtin:defilers');
    expect(defilers).toEqual(
      expect.objectContaining({
        name: 'The Defilers',
        type: 'FACTION',
        subtype: 'Anti-storyteller order',
        storytelling_points: 18
      })
    );

    const society = getPublicNarrativeEntitySeed('builtin:storytellers_society');
    expect(society.attributes.philosophy.doctrine).toContain('particulars');

    const storyteller = getPublicNarrativeEntitySeed('builtin:storyteller_archetype');
    expect(storyteller.attributes.functions.intervene).toContain('Leaves a clue');

    const deck = getPublicNarrativeEntitySeed('builtin:deck_of_cards');
    expect(deck.attributes.cardBehavior.awakeningRule).toContain('specific');
  });
});

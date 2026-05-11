import { normalizeNarrativeEntityDocument } from './storyteller/utils.js';

describe('story-machine narrative entity normalization', () => {
  test('preserves Expeditionary Archive fields and maps them into canonical entity fields', () => {
    const normalized = normalizeNarrativeEntityDocument(
      {
        name: 'Flood Court of Saint Vey',
        internal_quality_audit: {
          is_it_modular: '8',
          concrete: '9'
        },
        prominence_score: '15',
        category: 'PLACE',
        interaction_verbs: ['visit', 'explore', 'return to'],
        scholar_discipline: 'Socio-Economist',
        what_we_know_so_far: 'A flood-marked court implies recurring water rights.',
        observed_appearance: 'Soot-dark blocks, wet lime seams, and rope-scarred posts.',
        unresolved_mysteries: 'Who controls passage when the river rises?',
        world_utility: 'Forces choices around access, debt, weather, and jurisdiction.',
        related_entities: ['Toll Ledger', 'Flood Wardens']
      },
      {
        sessionId: 'archive-session',
        source: 'text_to_entity',
        sourceRoute: '/api/textToEntity'
      }
    );

    expect(normalized).toEqual(expect.objectContaining({
      sessionId: 'archive-session',
      session_id: 'archive-session',
      source: 'text_to_entity',
      sourceRoute: '/api/textToEntity',
      name: 'Flood Court of Saint Vey',
      type: 'LOCATION',
      category: 'PLACE',
      importance: 15,
      prominenceScore: 15,
      description: 'Soot-dark blocks, wet lime seams, and rope-scarred posts.',
      relevance: 'Forces choices around access, debt, weather, and jurisdiction.',
      impact: 'Forces choices around access, debt, weather, and jurisdiction.',
      interactionVerbs: ['visit', 'explore', 'return to'],
      scholarDiscipline: 'Socio-Economist',
      whatWeKnowSoFar: 'A flood-marked court implies recurring water rights.',
      observedAppearance: 'Soot-dark blocks, wet lime seams, and rope-scarred posts.',
      unresolvedMysteries: 'Who controls passage when the river rises?',
      worldUtility: 'Forces choices around access, debt, weather, and jurisdiction.',
      relatedEntities: ['Toll Ledger', 'Flood Wardens'],
      connections: ['Toll Ledger', 'Flood Wardens']
    }));
    expect(normalized.internalQualityAudit).toEqual({
      is_it_modular: '8',
      concrete: '9'
    });
    expect(normalized.attributes).toEqual(expect.objectContaining({
      internal_quality_audit: {
        is_it_modular: '8',
        concrete: '9'
      },
      interaction_verbs: ['visit', 'explore', 'return to'],
      world_utility: 'Forces choices around access, debt, weather, and jurisdiction.'
    }));
  });
});

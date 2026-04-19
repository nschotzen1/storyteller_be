export const NARRATIVE_ENTITY_REQUIRED_FIELDS = [
  'session_id',
  'sessionId',
  'name',
  'externalId',
  'source'
];

export const NARRATIVE_ENTITY_JSON_SCHEMA = {
  type: 'object',
  required: NARRATIVE_ENTITY_REQUIRED_FIELDS,
  properties: {
    session_id: { type: 'string', minLength: 1 },
    sessionId: { type: 'string', minLength: 1 },
    playerId: { type: 'string' },
    mainEntityId: { type: 'string' },
    isSubEntity: { type: 'boolean' },
    name: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    lore: { type: 'string' },
    privacy: { type: 'string', enum: ['session', 'public', 'private'] },
    type: { type: 'string' },
    subtype: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    universalTraits: { type: 'array', items: { type: 'string' } },
    attributes: { type: 'object', additionalProperties: true },
    connections: { oneOf: [{ type: 'object', additionalProperties: true }, { type: 'array', items: { type: 'string' } }] },
    clusterName: { type: 'string' },
    category: { type: 'string' },
    importance: { type: 'number' },
    xp: { type: 'number' },
    tileDistance: { type: 'number' },
    familiarityLevel: { type: 'number' },
    reusabilityLevel: { oneOf: [{ type: 'number' }, { type: 'string' }] },
    relevance: { type: 'string' },
    impact: { type: 'string' },
    developmentCost: { type: 'string' },
    storytellingPointsCost: { type: 'number' },
    storytelling_points: { type: 'number' },
    urgency: { type: 'string' },
    nextLevelSpecifically: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], additionalProperties: true },
    hooks: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], additionalProperties: true },
    specificity: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], additionalProperties: true },
    externalId: { type: 'string', minLength: 1 },
    source: { type: 'string', minLength: 1 },
    sourceRoute: { type: 'string' },
    turn: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], additionalProperties: true },
    skillsAndRolls: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'], additionalProperties: true },
    evolutionState: { type: 'string' },
    evolutionNotes: { type: 'string' },
    typewriterKeyText: { type: 'string' },
    typewriterSource: { type: 'string' },
    introducedByStorytellerId: { type: 'string' },
    introducedByStorytellerName: { type: 'string' },
    sourceStorytellerKeySlot: { type: 'number' },
    activeInTypewriter: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: true
};

export const NARRATIVE_ENTITY_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sessionId', 'entities'],
  properties: {
    sessionId: { type: 'string' },
    playerId: { type: 'string' },
    count: { type: 'integer', minimum: 0 },
    entities: {
      type: 'array',
      items: NARRATIVE_ENTITY_JSON_SCHEMA
    }
  },
  additionalProperties: true
};

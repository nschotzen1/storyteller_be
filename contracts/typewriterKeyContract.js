export const TYPEWRITER_KEY_REQUIRED_FIELDS = [
  'session_id',
  'sessionId',
  'keyText',
  'insertText',
  'sourceType',
  'verificationKind'
];

export const TYPEWRITER_KEY_JSON_SCHEMA = {
  type: 'object',
  required: TYPEWRITER_KEY_REQUIRED_FIELDS,
  properties: {
    session_id: { type: 'string', minLength: 1 },
    sessionId: { type: 'string', minLength: 1 },
    playerId: { type: 'string' },
    entityId: { type: 'string' },
    entityName: { type: 'string' },
    keyText: { type: 'string', minLength: 1 },
    insertText: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    sourceType: { type: 'string', minLength: 1 },
    sourceRoute: { type: 'string' },
    sourceStorytellerId: { type: 'string' },
    sourceStorytellerName: { type: 'string' },
    sourceStorytellerKeySlot: { type: 'number' },
    verificationKind: { type: 'string', minLength: 1 },
    activeInTypewriter: { type: 'boolean' },
    knowledgeState: { type: 'string' },
    playerFacingTooltip: { type: 'string' },
    textureUrl: { type: 'string' },
    keyImageUrl: { type: 'string' },
    sortOrder: { type: 'number' },
    timesPressed: { type: 'integer', minimum: 0 },
    lastPressedAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' }
  },
  additionalProperties: true
};

export const TYPEWRITER_KEY_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['sessionId', 'typewriterKeys'],
  properties: {
    sessionId: { type: 'string' },
    playerId: { type: 'string' },
    count: { type: 'integer', minimum: 0 },
    typewriterKeys: {
      type: 'array',
      items: TYPEWRITER_KEY_JSON_SCHEMA
    }
  },
  additionalProperties: true
};

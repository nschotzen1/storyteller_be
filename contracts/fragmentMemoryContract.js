export const FRAGMENT_MEMORY_REQUIRED_FIELDS = [
  'memory_strength',
  'emotional_sentiment',
  'action_name',
  'estimated_action_length',
  'time_within_action',
  'actual_result',
  'related_through_what',
  'geographical_relevance',
  'temporal_relation',
  'organizational_affiliation',
  'consequences',
  'distance_from_fragment_location_km',
  'shot_type',
  'time_of_day',
  'whose_eyes',
  'interior/exterior',
  'what_is_being_watched',
  'location',
  'estimated_duration_of_memory',
  'memory_distance',
  'entities_in_memory',
  'currently_assumed_turns_to_round',
  'relevant_rolls',
  'action_level',
  'short_title',
  'dramatic_definition',
  'miseenscene'
];

export const FRAGMENT_MEMORY_PROPERTIES_JSON_SCHEMA = {
  memory_strength: { type: 'string' },
  emotional_sentiment: { type: 'string' },
  action_name: { type: 'string' },
  estimated_action_length: { type: 'string' },
  time_within_action: { type: 'string' },
  actual_result: { type: 'string' },
  related_through_what: { type: 'string' },
  geographical_relevance: { type: 'string' },
  temporal_relation: { type: 'string' },
  organizational_affiliation: { type: 'string' },
  consequences: { type: 'string' },
  distance_from_fragment_location_km: { type: 'integer' },
  shot_type: { type: 'string' },
  time_of_day: { type: 'string' },
  whose_eyes: { type: 'string' },
  'interior/exterior': { type: 'string' },
  what_is_being_watched: { type: 'string' },
  location: { type: 'string' },
  estimated_duration_of_memory: { type: 'integer', minimum: 1, maximum: 30 },
  memory_distance: { type: 'string' },
  entities_in_memory: { type: 'array', items: { type: 'string' } },
  currently_assumed_turns_to_round: { type: 'string' },
  relevant_rolls: { type: 'array', items: { type: 'string' } },
  action_level: { type: 'string' },
  short_title: { type: 'string' },
  dramatic_definition: { type: 'string' },
  miseenscene: { type: 'string' },
  front: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      imageUrl: { type: 'string' }
    },
    additionalProperties: false
  },
  back: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      imageUrl: { type: 'string' }
    },
    additionalProperties: false
  },
  front_image_url: { type: 'string' },
  back_image_url: { type: 'string' }
};

export const FRAGMENT_MEMORY_JSON_SCHEMA = {
  type: 'object',
  required: FRAGMENT_MEMORY_REQUIRED_FIELDS,
  properties: FRAGMENT_MEMORY_PROPERTIES_JSON_SCHEMA,
  additionalProperties: true
};

export const FRAGMENT_TO_MEMORIES_RESPONSE_SCHEMA = {
  type: 'object',
  required: ['memories'],
  properties: {
    memories: {
      type: 'array',
      minItems: 1,
      items: FRAGMENT_MEMORY_JSON_SCHEMA
    }
  },
  additionalProperties: true
};

const TYPEWRITER_PROMPT_DEFINITIONS = {
  story_continuation: {
    key: 'story_continuation',
    label: 'Story continuation',
    description: '/api/send_typewriter_text',
    settingsKey: 'story_continuation'
  },
  memory_creation: {
    key: 'memory_creation',
    label: 'Memory creation',
    description: '/api/fragmentToMemories memory extraction',
    settingsKey: 'memory_creation'
  },
  memory_card_front: {
    key: 'memory_card_front',
    label: 'Memory card front',
    description: '/api/fragmentToMemories front image prompt',
    settingsKey: 'texture_creation'
  },
  memory_card_back: {
    key: 'memory_card_back',
    label: 'Memory card back',
    description: '/api/fragmentToMemories back image prompt',
    settingsKey: 'texture_creation'
  },
  entity_creation: {
    key: 'entity_creation',
    label: 'Entity creation',
    description: '/api/textToEntity entity extraction',
    settingsKey: 'entity_creation'
  },
  entity_card_front: {
    key: 'entity_card_front',
    label: 'Entity card front',
    description: '/api/textToEntity front image prompt',
    settingsKey: 'texture_creation'
  },
  texture_creation: {
    key: 'texture_creation',
    label: 'Entity card back texture',
    description: '/api/textToEntity back texture generation',
    settingsKey: 'texture_creation'
  },
  storyteller_creation: {
    key: 'storyteller_creation',
    label: 'Storyteller creation',
    description: '/api/textToStoryteller persona generation',
    settingsKey: 'storyteller_creation'
  },
  messenger_chat: {
    key: 'messenger_chat',
    label: 'Messenger chat',
    description: '/api/messenger/chat assistant prompt',
    settingsKey: 'messenger_chat'
  },
  storyteller_mission: {
    key: 'storyteller_mission',
    label: 'Storyteller mission',
    description: '/api/sendStorytellerToEntity mission evaluation',
    settingsKey: 'storyteller_mission'
  },
  relationship_evaluation: {
    key: 'relationship_evaluation',
    label: 'Relationship evaluation',
    description: '/api/arena/relationships/* judgment prompt',
    settingsKey: 'relationship_evaluation'
  },
  storyteller_key_creation: {
    key: 'storyteller_key_creation',
    label: 'Storyteller key image',
    description: '/api/textToStoryteller key image prompt',
    settingsKey: 'illustration_creation'
  },
  illustration_creation: {
    key: 'illustration_creation',
    label: 'Storyteller illustration',
    description: '/api/textToStoryteller illustration prompt',
    settingsKey: 'illustration_creation'
  }
};

export function getTypewriterPromptDefinitions() {
  return Object.values(TYPEWRITER_PROMPT_DEFINITIONS).map((definition) => ({ ...definition }));
}

export function getTypewriterPromptDefinition(promptKey) {
  const definition = TYPEWRITER_PROMPT_DEFINITIONS[promptKey];
  return definition ? { ...definition } : null;
}

export function getTypewriterPromptKeys() {
  return Object.keys(TYPEWRITER_PROMPT_DEFINITIONS);
}

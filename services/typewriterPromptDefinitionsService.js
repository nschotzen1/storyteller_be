const TYPEWRITER_PROMPT_DEFINITIONS = {
  story_continuation: {
    key: 'story_continuation',
    label: 'Story continuation',
    description: '/api/send_typewriter_text',
    settingsKey: 'story_continuation'
  },
  xerofag_inspection: {
    key: 'xerofag_inspection',
    label: 'Xerofag inspection',
    description: '/api/shouldAllowXerofag',
    settingsKey: 'xerofag_inspection'
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
    description: '/api/memories/:memoryId/textToImage/front image prompt',
    settingsKey: 'texture_creation'
  },
  memory_card_back: {
    key: 'memory_card_back',
    label: 'Memory card back',
    description: '/api/memories/:memoryId/textToImage/back image prompt',
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
  storyteller_intervention: {
    key: 'storyteller_intervention',
    label: 'Storyteller intervention',
    description: '/api/send_storyteller_typewriter_text storyteller entrance continuation',
    settingsKey: 'storyteller_intervention'
  },
  typewriter_key_verification: {
    key: 'typewriter_key_verification',
    label: 'Typewriter key verification',
    description: '/api/typewriter/keys/shouldAllow textual key insertion judge',
    settingsKey: 'typewriter_key_verification'
  },
  messenger_chat: {
    key: 'messenger_chat',
    label: 'Messenger chat',
    description: '/api/messenger/chat assistant prompt',
    settingsKey: 'messenger_chat'
  },
  immersive_rpg_gm: {
    key: 'immersive_rpg_gm',
    label: 'Immersive RPG GM',
    description: '/api/immersive-rpg/chat GM orchestration prompt',
    settingsKey: 'immersive_rpg_gm'
  },
  seer_reading_orchestrator: {
    key: 'seer_reading_orchestrator',
    label: 'Seer Reading Orchestrator',
    description: '/api/seer/readings/:readingId/turn orchestration prompt',
    settingsKey: 'seer_reading_orchestrator'
  },
  seer_reading_card_generation: {
    key: 'seer_reading_card_generation',
    label: 'Seer Reading Card Generation',
    description: 'internal://seer-reading/cards/generate opening card-generation prompt',
    settingsKey: 'seer_reading_card_generation'
  },
  quest_generation: {
    key: 'quest_generation',
    label: 'Quest generation',
    description: '/api/quest/advance structured branch generation prompt',
    settingsKey: 'quest_generation'
  },
  quest_scene_authoring: {
    key: 'quest_scene_authoring',
    label: 'Quest scene authoring',
    description: '/api/admin/quest/authoring-draft structured scene editor prompt',
    settingsKey: 'quest_scene_authoring'
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

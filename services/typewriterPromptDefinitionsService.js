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
  },
  chronicle_society_voice: {
    key: 'chronicle_society_voice',
    label: 'Chronicle Society voice',
    description: '/api/chronicle/:id/chat/respond Act 1 Society message rendering',
    settingsKey: 'chronicle_society_voice'
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

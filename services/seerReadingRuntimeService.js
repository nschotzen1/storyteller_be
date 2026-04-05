import { randomUUID } from 'crypto';
import { getPipelineSettings } from './typewriterAiSettingsService.js';
import { getLatestPromptTemplate } from './typewriterPromptConfigService.js';
import { textToEntityFromText } from './textToEntityService.js';

const SEER_FIELD_TIERS = Object.freeze({
  0: [],
  1: ['short_title', 'whose_eyes', 'time_of_day', 'location', 'emotional_sentiment'],
  2: ['short_title', 'whose_eyes', 'time_of_day', 'location', 'emotional_sentiment', 'what_is_being_watched', 'entities_in_memory', 'temporal_relation', 'related_through_what'],
  3: ['short_title', 'whose_eyes', 'time_of_day', 'location', 'emotional_sentiment', 'what_is_being_watched', 'entities_in_memory', 'temporal_relation', 'related_through_what', 'action_name', 'dramatic_definition', 'actual_result', 'organizational_affiliation'],
  4: ['short_title', 'whose_eyes', 'time_of_day', 'location', 'emotional_sentiment', 'what_is_being_watched', 'entities_in_memory', 'temporal_relation', 'related_through_what', 'action_name', 'dramatic_definition', 'actual_result', 'organizational_affiliation', 'miseenscene'],
  5: ['short_title', 'whose_eyes', 'time_of_day', 'location', 'emotional_sentiment', 'what_is_being_watched', 'entities_in_memory', 'temporal_relation', 'related_through_what', 'action_name', 'dramatic_definition', 'actual_result', 'organizational_affiliation', 'miseenscene', 'consequences', 'relevant_rolls', 'estimated_action_length', 'action_level']
});

const SEER_TRIAD_POSITIONS = Object.freeze({
  before: Object.freeze({ x: -0.9, y: 0.35 }),
  during: Object.freeze({ x: 0, y: -0.6 }),
  after: Object.freeze({ x: 0.92, y: 0.32 })
});

const DEFAULT_SEER_PERSONA = Object.freeze({
  id: 'ritual-seer',
  label: 'Ritual Seer',
  voice: 'ritual witness',
  goals: [
    'Make one memory-thread more legible per turn.',
    'Preserve ambiguity when it is more interesting than certainty.',
    'Translate player answers into world-usable structure.'
  ],
  constraints: [
    'Exactly one dominant consequence per turn.',
    'Do not reveal the whole memory at once.',
    'Prefer specific questions over generic prompting.'
  ]
});

function firstDefinedString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function clampSeerClarity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function getSeerVisibleFieldsForTier(tier = 0) {
  const safeTier = Number.isFinite(Number(tier)) ? Math.max(0, Math.min(5, Number(tier))) : 0;
  return [...(SEER_FIELD_TIERS[safeTier] || [])];
}

function createSeerTranscriptEntry(role = 'seer', content = '', extra = {}) {
  return {
    id: `seer-turn-${randomUUID()}`,
    role,
    content: firstDefinedString(content),
    createdAt: new Date().toISOString(),
    ...extra
  };
}

function findSeerFocusCard(cards = []) {
  return cards.find((card) => card.focusState === 'active') || cards[0] || null;
}

function setSeerFocusedCard(cards = [], focusCardId = '') {
  return cards.map((card) => ({
    ...card,
    focusState: card.id === focusCardId ? 'active' : (card.focusState === 'resolved' ? 'resolved' : 'idle')
  }));
}

function findNextSeerFocusCard(cards = [], currentCardId = '') {
  const unresolved = cards.filter((card) => card.id !== currentCardId && firstDefinedString(card.status) !== 'claimed');
  if (!unresolved.length) return null;
  const sharpening = unresolved.find((card) => Number(card.revealTier) < 3 || firstDefinedString(card.status) === 'back_only');
  return sharpening || unresolved[0];
}

function findSeerFocusMemory(memories = []) {
  return memories.find((memory) => memory.focusState === 'active') || memories[0] || null;
}

function setSeerFocusedMemory(memories = [], focusMemoryId = '') {
  return memories.map((memory) => ({
    ...memory,
    focusState: memory.id === focusMemoryId ? 'active' : (memory.focusState === 'resolved' ? 'resolved' : 'idle')
  }));
}

function findNextSeerFocusMemory(memories = [], currentMemoryId = '') {
  const unresolved = memories.filter((memory) => memory.id !== currentMemoryId && Number(memory.revealTier) < 5);
  if (unresolved.length) {
    const during = unresolved.find((memory) => memory.temporalSlot === 'during');
    return during || unresolved[0];
  }
  return memories.find((memory) => memory.id !== currentMemoryId) || null;
}

function extractSeerEntityLabels(memory = {}) {
  const labels = [];
  const rawEntities = Array.isArray(memory?.raw?.entities_in_memory) ? memory.raw.entities_in_memory : [];
  rawEntities.forEach((label) => {
    const safeLabel = firstDefinedString(label);
    if (safeLabel) {
      labels.push(safeLabel);
    }
  });
  const witness = firstDefinedString(memory?.witness, memory?.raw?.whose_eyes);
  if (witness) {
    labels.push(witness);
  }
  return Array.from(new Set(labels));
}

function extractSeerCardEntityLabels(reading = {}, focusMemory = {}, focusCard = {}) {
  const labels = [
    ...(Array.isArray(reading?.entities) ? reading.entities.map((entity) => firstDefinedString(entity?.name)) : []),
    ...extractSeerEntityLabels(focusMemory),
    firstDefinedString(focusCard?.title)
  ].filter(Boolean);
  return Array.from(new Set(labels)).slice(0, 5);
}

function buildSeerCardSuggestions(focusCard = {}, focusMemory = {}, reading = {}) {
  const back = focusCard?.back || {};
  const front = focusCard?.front || {};
  const relationLabels = extractSeerCardEntityLabels(reading, focusMemory, focusCard);
  const promptsByTier = {
    0: {
      mode: 'single_choice',
      prompt: `What first rises from the ${firstDefinedString(focusCard?.kind, 'reading')} card?`,
      suggestions: [
        ...(Array.isArray(back.mood) ? back.mood : []),
        ...(Array.isArray(back.motifs) ? back.motifs : [])
      ].filter(Boolean).slice(0, 4)
    },
    1: {
      mode: 'short_text',
      prompt: `What does ${firstDefinedString(focusCard?.title, 'this card')} seem to be or want?`,
      suggestions: [
        firstDefinedString(front.summary),
        ...(Array.isArray(back.motifs) ? back.motifs : [])
      ].filter(Boolean).slice(0, 4)
    },
    2: {
      mode: 'tagged_inference',
      prompt: `Who or what does ${firstDefinedString(focusCard?.title, 'this card')} bind to?`,
      suggestions: relationLabels
    },
    3: {
      mode: 'short_text',
      prompt: firstDefinedString(focusCard?.status) === 'claimable'
        ? `What truth lets you keep ${firstDefinedString(focusCard?.title, 'this card')}?`
        : `What truth has ${firstDefinedString(focusCard?.title, 'this card')} made legible?`,
      suggestions: relationLabels
    }
  };
  return promptsByTier[Math.min(3, Math.max(0, Number(focusCard?.revealTier) || 0))] || promptsByTier[3];
}

function computeCardStatus(card = {}) {
  const revealTier = Number.isFinite(Number(card?.revealTier)) ? Number(card.revealTier) : 0;
  const linkedEntityIds = Array.isArray(card?.linkedEntityIds) ? card.linkedEntityIds : [];
  if (firstDefinedString(card?.status) === 'claimed') return 'claimed';
  if (revealTier >= 3 && linkedEntityIds.length) return 'claimable';
  if (revealTier >= 2) return 'front_revealed';
  if (revealTier >= 1) return 'sharpening';
  return 'back_only';
}

function syncSeerCardLayout(cards = [], spread = {}) {
  const existing = Array.isArray(spread?.cardLayout) ? spread.cardLayout : [];
  const total = Math.max(1, cards.length);
  return cards.map((card, index) => {
    const previous = existing.find((entry) => entry.id === card.id);
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total);
    return {
      id: card.id,
      kind: card.kind,
      label: firstDefinedString(card.title, 'Card'),
      x: previous?.x ?? Number((Math.cos(angle) * 1.18).toFixed(4)),
      y: previous?.y ?? Number((Math.sin(angle) * 0.62).toFixed(4)),
      focusState: card.focusState,
      status: card.status,
      clarity: clampSeerClarity(card.clarity),
      confidence: clampSeerClarity(card.confidence)
    };
  });
}

function createSeerEntityFromLabel(label = '', provenance = 'memory') {
  return {
    id: `seer-entity-${randomUUID()}`,
    name: firstDefinedString(label, 'Unnamed entity'),
    kind: 'generated_during_reading',
    status: 'suggested',
    provenance
  };
}

function computeSeerEntityNodePosition(memoryNode = {}, entityCount = 0) {
  const angle = -Math.PI / 4 + entityCount * 0.68;
  const radius = 0.78 + entityCount * 0.12;
  const originX = Number.isFinite(Number(memoryNode.x)) ? Number(memoryNode.x) : 0;
  const originY = Number.isFinite(Number(memoryNode.y)) ? Number(memoryNode.y) : 0;
  return {
    x: originX + Math.cos(angle) * radius,
    y: originY + Math.sin(angle) * radius
  };
}

function upsertSeerSpreadRelation(spread = {}, focusMemory = {}, entity = {}, options = {}) {
  const nextNodes = Array.isArray(spread.nodes) ? [...spread.nodes] : [];
  const nextEdges = Array.isArray(spread.edges) ? [...spread.edges] : [];
  const focusMemoryId = firstDefinedString(focusMemory.id);
  const entityId = firstDefinedString(entity.id);

  if (!focusMemoryId || !entityId) {
    return spread;
  }

  const memoryNode = nextNodes.find((node) => node.id === focusMemoryId) || {
    x: SEER_TRIAD_POSITIONS[focusMemory.temporalSlot]?.x ?? 0,
    y: SEER_TRIAD_POSITIONS[focusMemory.temporalSlot]?.y ?? 0
  };
  const entityNode = nextNodes.find((node) => node.id === entityId);
  if (!entityNode) {
    const position = computeSeerEntityNodePosition(
      memoryNode,
      nextNodes.filter((node) => node.kind === 'entity').length
    );
    nextNodes.push({
      id: entityId,
      kind: 'entity',
      label: firstDefinedString(entity.name, 'Unknown entity'),
      x: position.x,
      y: position.y
    });
  }

  const relationEdgeId = `edge-${focusMemoryId}-${entityId}`;
  const existingEdgeIndex = nextEdges.findIndex((edge) => edge.id === relationEdgeId);
  const strength = clampSeerClarity(options.strength ?? 0.62);
  const confidence = clampSeerClarity(options.confidence ?? 0.58);
  const relationEdge = {
    id: relationEdgeId,
    fromId: focusMemoryId,
    toId: entityId,
    status: firstDefinedString(options.status, 'forming'),
    strength,
    confidence,
    distance: Math.max(0.22, 0.78 - strength * 0.4),
    rationale: firstDefinedString(options.rationale, 'The seer senses a tightening pull.')
  };

  if (existingEdgeIndex >= 0) {
    nextEdges[existingEdgeIndex] = {
      ...nextEdges[existingEdgeIndex],
      ...relationEdge
    };
  } else {
    nextEdges.push(relationEdge);
  }

  return {
    ...spread,
    focusMemoryId,
    nodes: nextNodes,
    edges: nextEdges
  };
}

function buildSeerComposer(reading = {}) {
  const focusCard = findSeerFocusCard(reading.cards || []);
  const focusMemory = findSeerFocusMemory(reading.memories || []);
  if (firstDefinedString(reading.status) !== 'active') {
    return {
      disabled: true,
      mode: 'closed',
      prompt: 'The reading has closed.',
      suggestions: [],
      submitLabel: 'Closed'
    };
  }

  if (!focusCard && !focusMemory) {
    return {
      disabled: true,
      mode: 'idle',
      prompt: 'No card is in focus yet.',
      suggestions: [],
      submitLabel: 'Await'
    };
  }

  if (focusCard) {
    const composer = buildSeerCardSuggestions(focusCard, focusMemory, reading);
    return {
      disabled: false,
      mode: composer.mode,
      prompt: composer.prompt,
      suggestions: composer.suggestions,
      submitLabel: firstDefinedString(focusCard.status) === 'claimable' ? 'Seal' : 'Answer',
      focusCardId: focusCard.id,
      focusMemoryId: focusMemory?.id || ''
    };
  }

  const entityLabels = extractSeerEntityLabels(focusMemory).slice(0, 3);
  return {
    disabled: false,
    mode: 'tagged_inference',
    prompt: 'Who or what does this glimpse lean toward?',
    suggestions: entityLabels,
    submitLabel: 'Answer',
    focusMemoryId: focusMemory.id
  };
}

function buildGeneratedEntityPrompt({ reading, focusMemory, focusCard, playerReply }) {
  return [
    'Within a Seer Reading, derive exactly 1 reusable world entity from the player clarification.',
    `Fragment: "${firstDefinedString(reading?.fragment?.text)}"`,
    `Focused card kind: "${firstDefinedString(focusCard?.kind)}"`,
    `Focused card title: "${firstDefinedString(focusCard?.title)}"`,
    `Focused card summary: "${firstDefinedString(focusCard?.front?.summary, focusCard?.likelyRelationHint)}"`,
    `Focused memory title: "${firstDefinedString(focusMemory?.card?.title)}"`,
    `Witness: "${firstDefinedString(focusMemory?.witness, focusMemory?.raw?.whose_eyes)}"`,
    `Location: "${firstDefinedString(focusMemory?.location, focusMemory?.raw?.location)}"`,
    `What is being watched: "${firstDefinedString(focusMemory?.raw?.what_is_being_watched)}"`,
    `Related through what: "${firstDefinedString(focusMemory?.raw?.related_through_what)}"`,
    `Player clarification: "${firstDefinedString(playerReply)}"`,
    'Prefer an entity that can recur in future worldbuilding: person, faction, object, ritual, signal-system, role, place, or institution.',
    'Return the most specific reusable entity implied by the clarification.'
  ].join('\n');
}

function normalizeGeneratedEntity(entity = {}) {
  return {
    id: String(entity.id || entity._id || `seer-entity-${randomUUID()}`),
    name: firstDefinedString(entity.name, entity.entity_name, 'Unnamed entity'),
    kind: 'generated_during_reading',
    status: 'suggested',
    provenance: 'seer_orchestrator',
    sourceEntityId: firstDefinedString(entity.id, entity._id)
  };
}

async function createEntityFromService({ reading, focusMemory, focusCard, playerId, playerReply, forceMock = null }) {
  const entityPipeline = await getPipelineSettings('entity_creation');
  const entityPrompt = await getLatestPromptTemplate('entity_creation');
  const promptText = buildGeneratedEntityPrompt({ reading, focusMemory, focusCard, playerReply });
  const effectiveMock = typeof forceMock === 'boolean'
    ? forceMock
    : Boolean(entityPipeline?.useMock);
  const result = await textToEntityFromText({
    sessionId: firstDefinedString(reading.sessionId),
    playerId,
    text: promptText,
    entityCount: 1,
    includeCards: false,
    includeFront: false,
    includeBack: false,
    debug: effectiveMock,
    llmModel: firstDefinedString(entityPipeline?.model),
    llmProvider: firstDefinedString(entityPipeline?.provider, 'openai'),
    entityPromptTemplate: firstDefinedString(entityPrompt?.promptTemplate)
  });
  const rawEntity = Array.isArray(result?.entities) ? result.entities[0] : null;
  return {
    entity: rawEntity ? normalizeGeneratedEntity(rawEntity) : null,
    promptText,
    mocked: Boolean(result?.mocked || effectiveMock)
  };
}

function findEntityInReading(entities = [], requestedEntityId = '', replyText = '', focusMemory = {}) {
  const safeRequestedEntityId = firstDefinedString(requestedEntityId);
  const normalizedReply = firstDefinedString(replyText).toLowerCase();
  let entity = safeRequestedEntityId
    ? entities.find((candidate) => candidate.id === safeRequestedEntityId)
    : null;

  if (!entity && normalizedReply) {
    entity = entities.find((candidate) => normalizedReply.includes(firstDefinedString(candidate.name).toLowerCase()));
  }

  if (!entity) {
    const candidateLabels = extractSeerEntityLabels(focusMemory);
    entity = entities.find((candidate) =>
      candidateLabels.some((label) => firstDefinedString(candidate.name).toLowerCase() === label.toLowerCase())
    );
  }

  return entity || null;
}

function buildAvailableTools(reading = {}, focusMemory = null, focusCard = null) {
  const tools = [];

  if (focusCard && Number(focusCard.revealTier) < 3) {
    tools.push({
      id: 'reveal_card_tier',
      label: 'Reveal Card Tier',
      description: 'Advance the focused card to its next reveal tier.'
    });
  }

  if (focusCard && firstDefinedString(focusCard.status) === 'claimable') {
    tools.push({
      id: 'claim_card',
      label: 'Claim Card',
      description: 'Seal a fully revealed card into the reading result set.'
    });
  }

  if (focusCard && (!Array.isArray(focusCard.linkedEntityIds) || focusCard.linkedEntityIds.length === 0)) {
    tools.push({
      id: 'create_entity',
      label: 'Create Entity',
      description: 'Create a reusable entity from the focused card and player clarification.'
    });
    tools.push({
      id: 'propose_relation',
      label: 'Propose Relation',
      description: 'Bind the focused card to an existing or newly created entity.'
    });
  }

  if (Array.isArray(reading.apparitions) && reading.apparitions.length) {
    tools.push({
      id: 'invoke_storyteller',
      label: 'Invoke Storyteller',
      description: 'Offer or invoke an apparition as an interpretive force.'
    });
  }

  if ((reading.cards || []).length > 1) {
    tools.push({
      id: 'focus_card',
      label: 'Focus Card',
      description: 'Shift the ritual attention to a different card.'
    });
  }

  if ((reading.memories || []).length > 1) {
    tools.push({
      id: 'focus_memory',
      label: 'Focus Memory',
      description: 'Shift the ritual attention to a different glimpse.'
    });
  }

  const unresolved = Array.isArray(reading.unresolvedThreads) ? reading.unresolvedThreads.length : 0;
  if (
    unresolved > 0
    || (reading.cards || []).every((card) => Number(card.revealTier) >= 3)
    || (reading.memories || []).every((memory) => Number(memory.revealTier) >= 5)
  ) {
    tools.push({
      id: 'synthesize',
      label: 'Synthesize',
      description: 'Ask for or produce the thread binding the triad.'
    });
  }

  if (reading?.metadata?.enableDice === true) {
    tools.push({
      id: 'roll_dice',
      label: 'Roll Dice',
      description: 'Resolve a formal risk or omen through dice.'
    });
  }

  return tools;
}

function createToolRegistry() {
  return {
    focus_card: {
      id: 'focus_card',
      description: 'Shift the active card focus.',
      run: async (ctx, input) => {
        const focusCardId = firstDefinedString(input?.focusCardId);
        ctx.state.cards = setSeerFocusedCard(ctx.state.cards, focusCardId);
        ctx.state.spread = {
          ...ctx.state.spread,
          focusCardId,
          cardLayout: syncSeerCardLayout(ctx.state.cards, ctx.state.spread)
        };
        const focusedCard = ctx.state.cards.find((card) => card.id === focusCardId);
        ctx.result.transitionType = 'focus_shift';
        ctx.result.beat = 'card_attunement';
        ctx.result.spokenMessage = `This card answers now: ${firstDefinedString(focusedCard?.title, 'the next thread')}. Tell me what it wants from the vision.`;
      }
    },
    focus_memory: {
      id: 'focus_memory',
      description: 'Shift the active memory focus.',
      run: async (ctx, input) => {
        const focusMemoryId = firstDefinedString(input?.focusMemoryId);
        ctx.state.memories = setSeerFocusedMemory(ctx.state.memories, focusMemoryId);
        ctx.state.spread = {
          ...ctx.state.spread,
          focusMemoryId
        };
        const focusedMemory = ctx.state.memories.find((memory) => memory.id === focusMemoryId);
        ctx.result.transitionType = 'focus_shift';
        ctx.result.beat = 'memory_in_focus';
        ctx.result.spokenMessage = `Let us turn to ${firstDefinedString(focusedMemory?.card?.title, 'this glimpse')}. Speak what presses closest in it.`;
      }
    },
    reveal_card_tier: {
      id: 'reveal_card_tier',
      description: 'Advance the focused card by one reveal tier.',
      run: async (ctx, input) => {
        const focusCard = findSeerFocusCard(ctx.state.cards);
        if (!focusCard) return;
        const focusIndex = ctx.state.cards.findIndex((card) => card.id === focusCard.id);
        const nextTier = Math.min(3, Number(focusCard.revealTier || 0) + Number(input?.delta || 1));
        const updated = {
          ...focusCard,
          revealTier: nextTier,
          clarity: clampSeerClarity((focusCard.clarity || 0) + Number(input?.clarityDelta || 0.18)),
          confidence: clampSeerClarity((focusCard.confidence || 0) + Number(input?.confidenceDelta || 0.08))
        };
        updated.status = computeCardStatus(updated);
        ctx.state.cards[focusIndex] = updated;
        ctx.state.spread = {
          ...ctx.state.spread,
          focusCardId: updated.id,
          cardLayout: syncSeerCardLayout(ctx.state.cards, ctx.state.spread)
        };
        ctx.result.transitionType = updated.status === 'claimable' ? 'card_claim_available' : 'card_reveal';
        ctx.result.beat = updated.status === 'claimable' ? 'card_claim_available' : 'card_attunement';
        ctx.result.spokenMessage = updated.status === 'claimable'
          ? `${firstDefinedString(updated.title, 'The card')} stands open now. If the truth holds, it can be kept.`
          : `${firstDefinedString(updated.title, 'The card')} sharpens. Another edge of it comes into view.`;
      }
    },
    reveal_memory_tier: {
      id: 'reveal_memory_tier',
      description: 'Advance the focused memory by one reveal tier.',
      run: async (ctx, input) => {
        const focusMemory = findSeerFocusMemory(ctx.state.memories);
        if (!focusMemory) return;
        const focusIndex = ctx.state.memories.findIndex((memory) => memory.id === focusMemory.id);
        const nextTier = Number(focusMemory.revealTier) + Number(input?.delta || 1);
        const nextClarity = clampSeerClarity((focusMemory.clarity || 0) + Number(input?.clarityDelta || 0.17));
        const updated = {
          ...focusMemory,
          revealTier: Math.min(5, nextTier),
          clarity: nextClarity,
          visibleFields: getSeerVisibleFieldsForTier(Math.min(5, nextTier))
        };
        ctx.state.memories[focusIndex] = updated;
        ctx.result.transitionType = 'reveal';
        ctx.result.beat = updated.revealTier >= 5 ? 'cross_memory_synthesis' : 'memory_deepening';
        ctx.result.spokenMessage = updated.revealTier >= 5
          ? `The consequence shows itself. ${firstDefinedString(updated.card?.title, 'This glimpse')} stands nearly whole.`
          : `The glimpse sharpens. ${firstDefinedString(updated.card?.title, 'This vision')} yields another layer.`;
      }
    },
    create_entity: {
      id: 'create_entity',
      description: 'Create a reusable entity from the player clarification.',
      run: async (ctx, input) => {
        const focusCard = findSeerFocusCard(ctx.state.cards);
        const focusMemory = findSeerFocusMemory(ctx.state.memories);
        if (!focusMemory && !focusCard) return;
        const existing = findEntityInReading(ctx.state.entities, input?.entityId, ctx.playerReply, focusMemory);
        if (existing) {
          ctx.runtime.createdEntity = existing;
          ctx.runtime.createdEntityWasNew = false;
          return;
        }

        const candidateLabels = extractSeerEntityLabels(focusMemory);
        if (candidateLabels.length) {
          const localEntity = createSeerEntityFromLabel(
            candidateLabels[0],
            firstDefinedString(ctx.playerReply) ? 'player_reply' : 'memory'
          );
          ctx.state.entities.push(localEntity);
          ctx.runtime.createdEntity = localEntity;
          ctx.runtime.createdEntityWasNew = true;
          return;
        }

        const created = await createEntityFromService({
          reading: ctx.reading,
          focusMemory,
          focusCard,
          playerId: ctx.playerId,
          playerReply: ctx.playerReply,
          forceMock: ctx.mockMode
        });

        if (created.entity) {
          ctx.state.entities.push(created.entity);
          ctx.runtime.createdEntity = created.entity;
          ctx.runtime.createdEntityWasNew = true;
          ctx.runtime.createdEntityPromptText = created.promptText;
          ctx.runtime.createdEntityMocked = created.mocked;
        }
      }
    },
    propose_relation: {
      id: 'propose_relation',
      description: 'Bind the focused card to an entity in the spread.',
      run: async (ctx) => {
        const focusCard = findSeerFocusCard(ctx.state.cards);
        const focusMemory = findSeerFocusMemory(ctx.state.memories);
        if (!focusCard && !focusMemory) return;
        const focusMemoryIndex = focusMemory ? ctx.state.memories.findIndex((memory) => memory.id === focusMemory.id) : -1;
        const focusCardIndex = focusCard ? ctx.state.cards.findIndex((card) => card.id === focusCard.id) : -1;
        const entity = ctx.runtime.createdEntity || findEntityInReading(ctx.state.entities, '', ctx.playerReply, focusMemory);

        if (!entity) {
          ctx.state.unresolvedThreads = Array.from(new Set([
            ...ctx.state.unresolvedThreads,
            `The reading could not yet name what binds ${firstDefinedString(focusCard?.title, focusMemory?.card?.title, 'this thread')}.`
          ]));
          ctx.result.transitionType = 'dead_end';
          ctx.result.beat = 'seer_question_pending';
          ctx.result.spokenMessage = 'The pull remains indistinct. Speak again, more narrowly.';
          return;
        }

        if (focusCard && focusCardIndex >= 0) {
          const updatedCard = {
            ...focusCard,
            linkedEntityIds: Array.from(new Set([...(focusCard.linkedEntityIds || []), entity.id])),
            revealTier: Math.max(2, Number(focusCard.revealTier || 0)),
            clarity: clampSeerClarity((focusCard.clarity || 0) + 0.18),
            confidence: clampSeerClarity((focusCard.confidence || 0) + (ctx.runtime.createdEntityWasNew ? 0.22 : 0.3))
          };
          updatedCard.status = computeCardStatus(updatedCard);
          ctx.state.cards[focusCardIndex] = updatedCard;
        }

        let updatedMemory = focusMemory;
        if (focusMemory && focusMemoryIndex >= 0) {
          updatedMemory = {
            ...focusMemory,
            confirmedEntityIds: Array.from(new Set([...(focusMemory.confirmedEntityIds || []), entity.id])),
            candidateEntityIds: Array.from(new Set([...(focusMemory.candidateEntityIds || []), entity.id])),
            clarity: clampSeerClarity((focusMemory.clarity || 0) + 0.12)
          };
          ctx.state.memories[focusMemoryIndex] = updatedMemory;
        }

        ctx.state.spread = {
          ...upsertSeerSpreadRelation(ctx.state.spread, updatedMemory || {}, entity, {
          strength: updatedMemory?.clarity ?? 0.58,
          confidence: ctx.runtime.createdEntityWasNew ? 0.48 : 0.64,
          status: ctx.runtime.createdEntityWasNew ? 'forming' : 'confirmed',
          rationale: `${firstDefinedString(focusCard?.title, updatedMemory?.card?.title, 'The thread')} leans toward ${firstDefinedString(entity.name, 'an entity')}.`
        }),
          focusCardId: focusCard?.id || ctx.state.spread?.focusCardId || '',
          cardLayout: syncSeerCardLayout(ctx.state.cards, ctx.state.spread)
        };
        ctx.result.transitionType = ctx.runtime.createdEntityWasNew ? 'new_entity_created' : 'relation_strengthened';
        ctx.result.beat = 'card_attunement';
        ctx.result.spokenMessage = ctx.runtime.createdEntityWasNew
          ? `A new presence takes shape in the spread: ${firstDefinedString(entity.name)}. The reading has made it legible.`
          : `${firstDefinedString(focusCard?.title, updatedMemory?.card?.title, 'The thread')} now pulls clearly toward ${firstDefinedString(entity.name, 'that presence')}.`;
      }
    },
    advance_focus: {
      id: 'advance_focus',
      description: 'Move to the next unresolved card or into synthesis.',
      run: async (ctx) => {
        const focusCard = findSeerFocusCard(ctx.state.cards);
        if (!focusCard) return;
        const focusIndex = ctx.state.cards.findIndex((card) => card.id === focusCard.id);
        ctx.state.cards[focusIndex] = {
          ...ctx.state.cards[focusIndex],
          focusState: 'resolved'
        };
        const nextFocus = findNextSeerFocusCard(ctx.state.cards, focusCard.id);
        if (nextFocus) {
          ctx.state.cards = ctx.state.cards.map((card) => {
            if (card.id === nextFocus.id) {
              return { ...card, focusState: 'active' };
            }
            return card.id === focusCard.id ? { ...card, focusState: 'resolved' } : { ...card, focusState: card.focusState === 'resolved' ? 'resolved' : 'idle' };
          });
          ctx.state.spread = {
            ...ctx.state.spread,
            focusCardId: nextFocus.id,
            cardLayout: syncSeerCardLayout(ctx.state.cards, ctx.state.spread)
          };
          ctx.result.transitionType = 'focus_shift';
          ctx.result.beat = 'card_attunement';
          ctx.result.spokenMessage = `That card has yielded what it will for now. We turn next to ${firstDefinedString(nextFocus.title, 'the next pressure')}.`;
          return;
        }
        ctx.result.transitionType = 'synthesis';
        ctx.result.beat = 'cross_memory_synthesis';
        ctx.result.spokenMessage = 'The spread now stands in view. Name the thread that runs between the cards.';
      }
    }
  };
}

function cloneReadingState(reading = {}) {
  return {
    memories: Array.isArray(reading.memories) ? reading.memories.map((memory) => ({ ...memory })) : [],
    cards: Array.isArray(reading.cards) ? reading.cards.map((card) => ({ ...card, back: card?.back ? { ...card.back } : {}, front: card?.front ? { ...card.front } : {} })) : [],
    entities: Array.isArray(reading.entities) ? reading.entities.map((entity) => ({ ...entity })) : [],
    spread: reading.spread ? { ...reading.spread } : {},
    transcript: Array.isArray(reading.transcript) ? reading.transcript.map((entry) => ({ ...entry })) : [],
    unresolvedThreads: Array.isArray(reading.unresolvedThreads) ? [...reading.unresolvedThreads] : []
  };
}

export async function buildSeerOrchestratorEnvelope(reading = {}) {
  const pipeline = await getPipelineSettings('seer_reading_orchestrator');
  const prompt = await getLatestPromptTemplate('seer_reading_orchestrator');
  const focusMemory = findSeerFocusMemory(reading.memories || []);
  const focusCard = findSeerFocusCard(reading.cards || []);
  const availableTools = buildAvailableTools(reading, focusMemory, focusCard);
  const runtimeMockMode = typeof reading?.metadata?.demoMockMode === 'boolean'
    ? reading.metadata.demoMockMode
    : Boolean(pipeline?.useMock);
  return {
    runtimeId: 'seer-agent-runtime-v1',
    persona: DEFAULT_SEER_PERSONA,
    pipeline: {
      key: 'seer_reading_orchestrator',
      provider: firstDefinedString(pipeline?.provider, 'openai'),
      model: firstDefinedString(pipeline?.model),
      useMock: runtimeMockMode
    },
    prompt: {
      key: 'seer_reading_orchestrator',
      version: Number.isFinite(Number(prompt?.version)) ? Number(prompt.version) : null,
      source: firstDefinedString(prompt?.meta?.source)
    },
    availableTools
  };
}

function buildToolCall(toolId, input = {}, reason = '') {
  return {
    tool_id: toolId,
    input,
    reason: firstDefinedString(reason)
  };
}

export async function runSeerReadingTurn({
  reading,
  playerId = '',
  action = 'answer',
  message = '',
  focusMemoryId = '',
  focusCardId = '',
  entityId = '',
  mock = null
}) {
  const orchestrator = await buildSeerOrchestratorEnvelope(reading);
  const registry = createToolRegistry();
  const state = cloneReadingState(reading);
  const result = {
    transitionType: 'dead_end',
    beat: firstDefinedString(reading?.beat, 'seer_question_pending'),
    spokenMessage: '',
    toolCalls: []
  };
  const ctx = {
    reading,
    playerId: firstDefinedString(playerId),
    playerReply: firstDefinedString(message),
    mockMode: typeof mock === 'boolean' ? mock : null,
    state,
    result,
    runtime: {
      createdEntity: null,
      createdEntityWasNew: false,
      createdEntityPromptText: '',
      createdEntityMocked: false
    }
  };

  if (action === 'focus_card') {
    const focusTool = registry.focus_card;
    const toolInput = { focusCardId };
    result.toolCalls.push(buildToolCall(focusTool.id, toolInput, 'Player redirected the reading to another card.'));
    await focusTool.run(ctx, toolInput);
    state.transcript.push(createSeerTranscriptEntry('seer', result.spokenMessage, {
      kind: result.transitionType,
      focusCardId
    }));
  } else if (action === 'focus_memory') {
    const focusTool = registry.focus_memory;
    const toolInput = { focusMemoryId };
    result.toolCalls.push(buildToolCall(focusTool.id, toolInput, 'Player redirected the reading to another glimpse.'));
    await focusTool.run(ctx, toolInput);
    state.transcript.push(createSeerTranscriptEntry('seer', result.spokenMessage, {
      kind: result.transitionType,
      focusMemoryId: focusMemoryId
    }));
  } else {
    const focusCard = findSeerFocusCard(state.cards);
    const focusMemory = findSeerFocusMemory(state.memories);
    state.transcript.push(createSeerTranscriptEntry('player', ctx.playerReply, {
      kind: 'reply',
      playerId: ctx.playerId
    }));

    if (!focusCard && !focusMemory) {
      result.transitionType = 'dead_end';
      result.beat = 'seer_question_pending';
      result.spokenMessage = 'No active thread answers the ritual yet.';
    } else if (focusCard && Number(focusCard.revealTier) < 2) {
      const revealInput = { delta: 1, clarityDelta: 0.18, confidenceDelta: 0.08 };
      result.toolCalls.push(buildToolCall('reveal_card_tier', revealInput, 'The focused card is still mostly on its back side.'));
      await registry.reveal_card_tier.run(ctx, revealInput);
    } else if (focusCard && (!Array.isArray(focusCard.linkedEntityIds) || focusCard.linkedEntityIds.length === 0)) {
      const createReason = 'The reading needs a named presence to bind the glimpse.';
      result.toolCalls.push(buildToolCall('create_entity', { entityId }, createReason));
      await registry.create_entity.run(ctx, { entityId });
      const relationInput = {
        entity_id: ctx.runtime.createdEntity?.id || '',
        prompt_text: ctx.runtime.createdEntityPromptText || ''
      };
      result.toolCalls.push(buildToolCall('propose_relation', relationInput, 'The seer binds the glimpse to a named presence.'));
      await registry.propose_relation.run(ctx, relationInput);
    } else if (focusCard && Number(focusCard.revealTier) < 3) {
      const revealInput = { delta: 1, clarityDelta: 0.14, confidenceDelta: 0.12 };
      result.toolCalls.push(buildToolCall('reveal_card_tier', revealInput, 'The card can still sharpen before the focus moves.'));
      await registry.reveal_card_tier.run(ctx, revealInput);
    } else {
      result.toolCalls.push(buildToolCall('advance_focus', {}, 'The focused card has yielded its current visible structure.'));
      await registry.advance_focus.run(ctx, {});
    }

    state.transcript.push(createSeerTranscriptEntry('seer', result.spokenMessage, {
      kind: result.transitionType,
      focusMemoryId: state.spread?.focusMemoryId || findSeerFocusMemory(state.memories)?.id || '',
      focusCardId: state.spread?.focusCardId || findSeerFocusCard(state.cards)?.id || ''
    }));
  }

  const focusAfter = findSeerFocusMemory(state.memories);
  const focusCardAfter = findSeerFocusCard(state.cards);
  const lastTurn = {
    transitionType: result.transitionType,
    spokenMessage: result.spokenMessage,
    focusMemoryId: state.spread?.focusMemoryId || focusAfter?.id || '',
    focusCardId: state.spread?.focusCardId || focusCardAfter?.id || '',
    toolCalls: result.toolCalls,
    availableToolIds: orchestrator.availableTools.map((tool) => tool.id),
    runtimeId: orchestrator.runtimeId,
    personaId: orchestrator.persona.id,
    createdEntityPromptText: ctx.runtime.createdEntityPromptText || '',
    createdEntityMocked: ctx.runtime.createdEntityMocked
  };

  return {
    nextReadingFields: {
      memories: state.memories,
      cards: state.cards,
      entities: state.entities,
      spread: state.spread,
      transcript: state.transcript,
      unresolvedThreads: state.unresolvedThreads,
      beat: result.beat,
      lastTurn,
      orchestrator
    }
  };
}

export function buildSeerComposerPayload(reading = {}) {
  return buildSeerComposer(reading);
}

export function findActiveSeerMemory(reading = {}) {
  return findSeerFocusMemory(reading.memories || []);
}

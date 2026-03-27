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

  if (!focusMemory) {
    return {
      disabled: true,
      mode: 'idle',
      prompt: 'No glimpse is in focus yet.',
      suggestions: [],
      submitLabel: 'Await'
    };
  }

  const entityLabels = extractSeerEntityLabels(focusMemory).slice(0, 3);
  const promptsByTier = {
    0: {
      mode: 'single_choice',
      prompt: 'Name the first pressure in this glimpse.',
      suggestions: [focusMemory.sentiment, 'warning', 'ritual', 'labor'].filter(Boolean)
    },
    1: {
      mode: 'short_text',
      prompt: `What detail from ${firstDefinedString(focusMemory.card?.title, 'this glimpse')} presses hardest?`,
      suggestions: [focusMemory.witness, focusMemory.location, focusMemory.timeOfDay].filter(Boolean)
    },
    2: {
      mode: 'tagged_inference',
      prompt: 'Who or what does this glimpse lean toward?',
      suggestions: entityLabels
    },
    3: {
      mode: 'short_text',
      prompt: 'What truth is becoming legible here?',
      suggestions: [focusMemory.raw?.action_name, focusMemory.raw?.related_through_what].filter(Boolean)
    },
    4: {
      mode: 'short_text',
      prompt: 'What consequence follows from this glimpse?',
      suggestions: [focusMemory.raw?.actual_result, focusMemory.raw?.consequences].filter(Boolean)
    },
    5: {
      mode: 'short_text',
      prompt: 'What thread binds this glimpse to the others?',
      suggestions: []
    }
  };

  const composer = promptsByTier[Number(focusMemory.revealTier)] || promptsByTier[5];
  return {
    disabled: false,
    mode: composer.mode,
    prompt: composer.prompt,
    suggestions: composer.suggestions,
    submitLabel: 'Answer',
    focusMemoryId: focusMemory.id
  };
}

function buildGeneratedEntityPrompt({ reading, focusMemory, playerReply }) {
  return [
    'Within a Seer Reading, derive exactly 1 reusable world entity from the player clarification.',
    `Fragment: "${firstDefinedString(reading?.fragment?.text)}"`,
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

async function createEntityFromService({ reading, focusMemory, playerId, playerReply }) {
  const entityPipeline = await getPipelineSettings('entity_creation');
  const entityPrompt = await getLatestPromptTemplate('entity_creation');
  const promptText = buildGeneratedEntityPrompt({ reading, focusMemory, playerReply });
  const result = await textToEntityFromText({
    sessionId: firstDefinedString(reading.sessionId),
    playerId,
    text: promptText,
    entityCount: 1,
    includeCards: false,
    includeFront: false,
    includeBack: false,
    debug: Boolean(entityPipeline?.useMock),
    llmModel: firstDefinedString(entityPipeline?.model),
    llmProvider: firstDefinedString(entityPipeline?.provider, 'openai'),
    entityPromptTemplate: firstDefinedString(entityPrompt?.promptTemplate)
  });
  const rawEntity = Array.isArray(result?.entities) ? result.entities[0] : null;
  return {
    entity: rawEntity ? normalizeGeneratedEntity(rawEntity) : null,
    promptText,
    mocked: Boolean(result?.mocked || entityPipeline?.useMock)
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

function buildAvailableTools(reading = {}, focusMemory = null) {
  const tools = [];

  if (focusMemory && Number(focusMemory.revealTier) < 5) {
    tools.push({
      id: 'reveal_memory_tier',
      label: 'Reveal Memory Tier',
      description: 'Advance the focused memory to its next reveal tier.'
    });
  }

  if (focusMemory && (!Array.isArray(focusMemory.confirmedEntityIds) || focusMemory.confirmedEntityIds.length === 0)) {
    tools.push({
      id: 'create_entity',
      label: 'Create Entity',
      description: 'Create a reusable entity from the focused memory and player clarification.'
    });
    tools.push({
      id: 'propose_relation',
      label: 'Propose Relation',
      description: 'Bind the focused memory to an existing or newly created entity.'
    });
  }

  if (Array.isArray(reading.apparitions) && reading.apparitions.length) {
    tools.push({
      id: 'invoke_storyteller',
      label: 'Invoke Storyteller',
      description: 'Offer or invoke an apparition as an interpretive force.'
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
  if (unresolved > 0 || (reading.memories || []).every((memory) => Number(memory.revealTier) >= 5)) {
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
        const focusMemory = findSeerFocusMemory(ctx.state.memories);
        if (!focusMemory) return;
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
          playerId: ctx.playerId,
          playerReply: ctx.playerReply
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
      description: 'Bind the focused memory to an entity in the spread.',
      run: async (ctx) => {
        const focusMemory = findSeerFocusMemory(ctx.state.memories);
        if (!focusMemory) return;
        const focusIndex = ctx.state.memories.findIndex((memory) => memory.id === focusMemory.id);
        const entity = ctx.runtime.createdEntity || findEntityInReading(ctx.state.entities, '', ctx.playerReply, focusMemory);

        if (!entity) {
          ctx.state.unresolvedThreads = Array.from(new Set([
            ...ctx.state.unresolvedThreads,
            `The reading could not yet name what binds ${firstDefinedString(focusMemory.card?.title, 'this glimpse')}.`
          ]));
          ctx.result.transitionType = 'dead_end';
          ctx.result.beat = 'seer_question_pending';
          ctx.result.spokenMessage = 'The pull remains indistinct. Speak again, more narrowly.';
          return;
        }

        const updated = {
          ...focusMemory,
          confirmedEntityIds: Array.from(new Set([...(focusMemory.confirmedEntityIds || []), entity.id])),
          candidateEntityIds: Array.from(new Set([...(focusMemory.candidateEntityIds || []), entity.id])),
          clarity: clampSeerClarity((focusMemory.clarity || 0) + 0.12)
        };
        ctx.state.memories[focusIndex] = updated;
        ctx.state.spread = upsertSeerSpreadRelation(ctx.state.spread, updated, entity, {
          strength: updated.clarity,
          confidence: ctx.runtime.createdEntityWasNew ? 0.48 : 0.64,
          status: ctx.runtime.createdEntityWasNew ? 'forming' : 'confirmed',
          rationale: `${firstDefinedString(updated.card?.title, 'The glimpse')} leans toward ${firstDefinedString(entity.name, 'an entity')}.`
        });
        ctx.result.transitionType = ctx.runtime.createdEntityWasNew ? 'new_entity_created' : 'relation_strengthened';
        ctx.result.beat = 'seer_question_pending';
        ctx.result.spokenMessage = ctx.runtime.createdEntityWasNew
          ? `A new presence takes shape in the spread: ${firstDefinedString(entity.name)}. The reading has made it legible.`
          : `${firstDefinedString(updated.card?.title, 'The glimpse')} now pulls clearly toward ${firstDefinedString(entity.name, 'that presence')}.`;
      }
    },
    advance_focus: {
      id: 'advance_focus',
      description: 'Move to the next unresolved memory or into synthesis.',
      run: async (ctx) => {
        const focusMemory = findSeerFocusMemory(ctx.state.memories);
        if (!focusMemory) return;
        const focusIndex = ctx.state.memories.findIndex((memory) => memory.id === focusMemory.id);
        ctx.state.memories[focusIndex] = {
          ...ctx.state.memories[focusIndex],
          focusState: 'resolved'
        };
        const nextFocus = findNextSeerFocusMemory(ctx.state.memories, focusMemory.id);
        if (nextFocus) {
          ctx.state.memories = ctx.state.memories.map((memory) => {
            if (memory.id === nextFocus.id) {
              return { ...memory, focusState: 'active' };
            }
            return memory.id === focusMemory.id ? { ...memory, focusState: 'resolved' } : { ...memory, focusState: memory.focusState === 'resolved' ? 'resolved' : 'idle' };
          });
          ctx.state.spread = {
            ...ctx.state.spread,
            focusMemoryId: nextFocus.id
          };
          ctx.result.transitionType = 'focus_shift';
          ctx.result.beat = 'memory_in_focus';
          ctx.result.spokenMessage = `That glimpse has yielded what it will for now. We turn next to ${firstDefinedString(nextFocus.card?.title, 'the next pressure')}.`;
          return;
        }
        ctx.result.transitionType = 'synthesis';
        ctx.result.beat = 'cross_memory_synthesis';
        ctx.result.spokenMessage = 'The triad now stands in view. Name the thread that runs between them.';
      }
    }
  };
}

function cloneReadingState(reading = {}) {
  return {
    memories: Array.isArray(reading.memories) ? reading.memories.map((memory) => ({ ...memory })) : [],
    entities: Array.isArray(reading.entities) ? reading.entities.map((entity) => ({ ...entity })) : [],
    spread: reading.spread ? { ...reading.spread } : {},
    transcript: Array.isArray(reading.transcript) ? reading.transcript.map((entry) => ({ ...entry })) : [],
    unresolvedThreads: Array.isArray(reading.unresolvedThreads) ? [...reading.unresolvedThreads] : []
  };
}

async function buildOrchestratorEnvelope(reading = {}) {
  const pipeline = await getPipelineSettings('seer_reading_orchestrator');
  const prompt = await getLatestPromptTemplate('seer_reading_orchestrator');
  const focusMemory = findSeerFocusMemory(reading.memories || []);
  const availableTools = buildAvailableTools(reading, focusMemory);
  return {
    runtimeId: 'seer-agent-runtime-v1',
    persona: DEFAULT_SEER_PERSONA,
    pipeline: {
      key: 'seer_reading_orchestrator',
      provider: firstDefinedString(pipeline?.provider, 'openai'),
      model: firstDefinedString(pipeline?.model),
      useMock: Boolean(pipeline?.useMock)
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
  entityId = ''
}) {
  const orchestrator = await buildOrchestratorEnvelope(reading);
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
    state,
    result,
    runtime: {
      createdEntity: null,
      createdEntityWasNew: false,
      createdEntityPromptText: '',
      createdEntityMocked: false
    }
  };

  if (action === 'focus_memory') {
    const focusTool = registry.focus_memory;
    const toolInput = { focusMemoryId };
    result.toolCalls.push(buildToolCall(focusTool.id, toolInput, 'Player redirected the reading to another glimpse.'));
    await focusTool.run(ctx, toolInput);
    state.transcript.push(createSeerTranscriptEntry('seer', result.spokenMessage, {
      kind: result.transitionType,
      focusMemoryId: focusMemoryId
    }));
  } else {
    const focusMemory = findSeerFocusMemory(state.memories);
    state.transcript.push(createSeerTranscriptEntry('player', ctx.playerReply, {
      kind: 'reply',
      playerId: ctx.playerId
    }));

    if (!focusMemory) {
      result.transitionType = 'dead_end';
      result.beat = 'seer_question_pending';
      result.spokenMessage = 'No active glimpse answers the ritual yet.';
    } else if (Number(focusMemory.revealTier) < 3) {
      const revealInput = { delta: 1, clarityDelta: 0.17 };
      result.toolCalls.push(buildToolCall('reveal_memory_tier', revealInput, 'The focused memory is still incomplete.'));
      await registry.reveal_memory_tier.run(ctx, revealInput);
    } else if (!Array.isArray(focusMemory.confirmedEntityIds) || focusMemory.confirmedEntityIds.length === 0) {
      const createReason = 'The reading needs a named presence to bind the glimpse.';
      result.toolCalls.push(buildToolCall('create_entity', { entityId }, createReason));
      await registry.create_entity.run(ctx, { entityId });
      const relationInput = {
        entity_id: ctx.runtime.createdEntity?.id || '',
        prompt_text: ctx.runtime.createdEntityPromptText || ''
      };
      result.toolCalls.push(buildToolCall('propose_relation', relationInput, 'The seer binds the glimpse to a named presence.'));
      await registry.propose_relation.run(ctx, relationInput);
    } else if (Number(focusMemory.revealTier) < 5) {
      const revealInput = { delta: 1, clarityDelta: 0.14 };
      result.toolCalls.push(buildToolCall('reveal_memory_tier', revealInput, 'The memory can still deepen before the focus moves.'));
      await registry.reveal_memory_tier.run(ctx, revealInput);
    } else {
      result.toolCalls.push(buildToolCall('advance_focus', {}, 'The focused memory has yielded its full visible structure.'));
      await registry.advance_focus.run(ctx, {});
    }

    state.transcript.push(createSeerTranscriptEntry('seer', result.spokenMessage, {
      kind: result.transitionType,
      focusMemoryId: state.spread?.focusMemoryId || findSeerFocusMemory(state.memories)?.id || ''
    }));
  }

  const focusAfter = findSeerFocusMemory(state.memories);
  const lastTurn = {
    transitionType: result.transitionType,
    spokenMessage: result.spokenMessage,
    focusMemoryId: state.spread?.focusMemoryId || focusAfter?.id || '',
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

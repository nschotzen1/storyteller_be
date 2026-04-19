import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { callJsonLlm } from '../ai/openai/apiService.js';
import { generate_texture_by_fragment_and_conversation } from '../ai/openai/texturePrompts.js';
import { getNArchetypes } from '../ai/openai/promptsUtils.js';
import { generateEntitiesFromFragment, setEntitiesForSession, ensureDirectoryExists } from '../storyteller/utils.js';
import { textToImageOpenAi } from '../ai/textToImage/api.js';
import { renderPromptTemplateString } from './typewriterPromptConfigService.js';

export const DEFAULT_DESIRED_ENTITY_CATEGORIES = Object.freeze([
  'LOCATION',
  'ITEM',
  'NPC',
  'FLORA',
  'FAUNA',
  'EVENT',
  'FACTION'
]);

function normalizeConnections(connections) {
  if (!connections) {
    return '';
  }
  if (Array.isArray(connections)) {
    return connections
      .map((connection) => {
        if (!connection) {
          return '';
        }
        if (typeof connection === 'string') {
          return connection;
        }
        if (typeof connection.entity === 'string') {
          return connection.entity;
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }
  return String(connections);
}

function normalizeDesiredEntityCategoryToken(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!normalized) return '';

  if (normalized === 'PERSON' || normalized === 'CHARACTER' || normalized === 'CHARACTERS') {
    return 'NPC';
  }
  if (normalized === 'ORGANIZATION' || normalized === 'ORGANISATION' || normalized === 'GROUP') {
    return 'FACTION';
  }
  if (normalized === 'LOCATIONS') return 'LOCATION';
  if (normalized === 'ITEMS') return 'ITEM';
  if (normalized === 'FLORAS') return 'FLORA';
  if (normalized === 'FAUNAS') return 'FAUNA';
  if (normalized === 'EVENTS') return 'EVENT';
  if (normalized === 'FACTIONS') return 'FACTION';
  return normalized;
}

export function normalizeDesiredEntityCategories(
  rawCategories,
  fallback = DEFAULT_DESIRED_ENTITY_CATEGORIES
) {
  const tokens = [];
  if (Array.isArray(rawCategories)) {
    rawCategories.forEach((entry) => {
      if (Array.isArray(entry)) {
        entry.forEach((nestedEntry) => tokens.push(nestedEntry));
      } else {
        tokens.push(entry);
      }
    });
  } else if (typeof rawCategories === 'string') {
    tokens.push(...rawCategories.split(','));
  }

  const normalized = Array.from(
    new Set(tokens.map((entry) => normalizeDesiredEntityCategoryToken(entry)).filter(Boolean))
  );

  if (normalized.length) {
    return normalized;
  }
  return Array.isArray(fallback) ? [...fallback] : [...DEFAULT_DESIRED_ENTITY_CATEGORIES];
}

export function buildDesiredEntityCategoryPromptVariables(rawCategories) {
  const categories = normalizeDesiredEntityCategories(rawCategories);
  const categoriesCsv = categories.join(', ');
  const categoriesBullets = categories.map((category) => `- ${category}`).join('\n');
  const categoriesJson = JSON.stringify(categories);
  return {
    desiredEntityCategories: categoriesCsv,
    desired_entity_categories: categoriesCsv,
    desiredEntityCategoriesCsv: categoriesCsv,
    desired_entity_categories_csv: categoriesCsv,
    desiredEntityCategoriesBullets: categoriesBullets,
    desired_entity_categories_bullets: categoriesBullets,
    desiredEntityCategoriesJson: categoriesJson,
    desired_entity_categories_json: categoriesJson
  };
}

function buildFrontPrompt(entity, texturePrompt, fragmentText) {
  const nerType = entity.ner_type || 'ENTITY';
  const nerSubtype = entity.ner_subtype || 'General';
  const description = entity.description || 'No description provided.';
  const relevance = entity.relevance || 'No narrative context provided.';
  const connections = normalizeConnections(entity.connections);
  const textureLine = texturePrompt
    ? `Use the following texture as inspiration: ${texturePrompt}.`
    : `Use this fragment to set the tone: "${fragmentText}".`;

  return `Create a highly detailed RPG collector card front illustration for "${entity.name}".
The entity is categorized as "${nerType}" with a subtype of "${nerSubtype}".
The entity is described as: "${description}". Expand upon this description to craft vivid, concrete imagery for the illustration.
Narrative context: "${relevance}". ${entity.evolution_notes ? `On closer inspection: "${entity.evolution_notes}".` : ''}
${connections ? `Connections to consider: "${connections}".` : ''}
${textureLine}
Full-frame, cinematic quality, detailed, immersive, and cohesive. Include tasteful embellishments and flourishes that make it feel like a collector card.
No visible text besides the title: "${entity.name}".`;
}

function buildFrontPromptWithTemplate(entity, texturePrompt, fragmentText, promptTemplate = '') {
  if (!promptTemplate || !promptTemplate.trim()) {
    return buildFrontPrompt(entity, texturePrompt, fragmentText);
  }

  return renderPromptTemplateString(promptTemplate, {
    entity_name: entity?.name || 'Unnamed entity',
    ner_type: entity?.ner_type || 'ENTITY',
    ner_subtype: entity?.ner_subtype || 'General',
    description: entity?.description || 'No description provided.',
    relevance: entity?.relevance || 'No narrative context provided.',
    evolution_notes: entity?.evolution_notes || '',
    connections: normalizeConnections(entity?.connections),
    texture_prompt: texturePrompt || '',
    fragmentText: fragmentText || ''
  });
}

function selectTextureForEntity(textures, entity, idx) {
  if (!Array.isArray(textures) || textures.length === 0) {
    return null;
  }
  const byName = textures.find((texture) => texture && texture.text_for_entity === entity.name);
  if (byName) {
    return byName;
  }
  return textures[idx % textures.length];
}

function buildFallbackTexture(fragmentText, entityName) {
  return {
    text_for_entity: entityName,
    prompt: `Card texture: A worn, full-frame RPG card back inspired by "${fragmentText}". Abstract, cinematic, grainy, with subtle filigree and worn edges.`,
    font: 'Cormorant Garamond',
    font_size: '22px',
    font_color: 'weathered silver',
    card_material: 'aged parchment',
    major_cultural_influences_references: ['Numenera', 'The Broken Earth Trilogy', 'Dark Crystal', 'Moebius']
  };
}

async function generateTexturesForEntities(fragmentText, entities, llmModel = '', promptTemplate = '', llmProvider = 'openai') {
  if (!Array.isArray(entities) || entities.length === 0) {
    return [];
  }

  const prompts = typeof promptTemplate === 'string' && promptTemplate.trim()
    ? [{
      role: 'system',
      content: renderPromptTemplateString(promptTemplate, {
        fragmentText,
        entityCount: entities.length,
        entityNames: entities.map((entity) => entity.name).join('\n'),
        archetypes_json: JSON.stringify(getNArchetypes(entities.length || 4))
      })
    }]
    : generate_texture_by_fragment_and_conversation(
      fragmentText,
      '',
      entities,
      entities.length
    );

  if (!(typeof promptTemplate === 'string' && promptTemplate.trim()) && prompts?.[0]?.content) {
    const entityNames = entities.map((entity) => `- ${entity.name}`).join('\n');
    prompts[0].content += `\n\nEntity names (use exactly for text_for_entity, one per texture):\n${entityNames}`;
  }

  const response = await callJsonLlm({
    prompts,
    provider: llmProvider,
    model: llmModel,
    max_tokens: 2500,
    temperature: 1.03,
    explicitJsonObjectFormat: true
  });
  const textures = response?.textures ?? response;
  if (!Array.isArray(textures)) {
    return [];
  }
  return textures;
}

async function buildCardsForEntities({
  sessionId,
  entities,
  textures,
  fragmentText,
  includeFront,
  includeBack,
  mocked,
  imageModel,
  frontPromptTemplate
}) {
  const cards = [];

  for (let idx = 0; idx < entities.length; idx++) {
    const entity = entities[idx];
    const selectedTexture = includeBack ? selectTextureForEntity(textures, entity, idx) : null;
    const fallbackTexture = includeBack ? buildFallbackTexture(fragmentText, entity.name) : null;
    const texture = selectedTexture || fallbackTexture;

    const card = {
      entityId: entity.id,
      entityName: entity.name
    };

    // Prepare paths
    // We'll store in assets/:sessionId/cards/
    const cardsDirRel = `../../assets/${sessionId}/cards`;
    const cardsDirAbs = path.join(__dirname, cardsDirRel);
    await ensureDirectoryExists(cardsDirAbs);

    if (includeBack && texture) {
      let backUrl = null;
      if (mocked) {
        // Mock asset
        backUrl = '/assets/18bbfc07-17fd-4a14-80a9-eb23af9eac2f-0-2612330651.png';
      } else {
        const prompt = texture.prompt;
        const filename = `${entity.id}_back.png`;
        const localPath = path.join(cardsDirAbs, filename);

        // Call generation
        const result = await textToImageOpenAi(prompt, 1, localPath, false, 3, imageModel);
        if (result && result.localPath) {
          // Convert to web path: /assets/sessionId/cards/filename
          backUrl = `/assets/${sessionId}/cards/${filename}`;
        }
      }

      card.back = {
        prompt: texture.prompt,
        texture,
        imageUrl: backUrl
      };
    }

    if (includeFront) {
      let frontUrl = null;
      const prompt = buildFrontPromptWithTemplate(entity, texture?.prompt, fragmentText, frontPromptTemplate);

      if (mocked) {
        // Mock asset
        frontUrl = '/assets/1a0acb7f-ac32-40f5-8a69-5daf303fcc6b-0-1729994892.png';
      } else {
        const filename = `${entity.id}_front.png`;
        const localPath = path.join(cardsDirAbs, filename);

        // Call generation
        const result = await textToImageOpenAi(prompt, 1, localPath, false, 3, imageModel);
        if (result && result.localPath) {
          frontUrl = `/assets/${sessionId}/cards/${filename}`;
        }
      }

      card.front = {
        prompt,
        imageUrl: frontUrl
      };
    }
    cards.push(card);
  }

  return cards;
}

function extractQuotedPromptValue(text = '', label = '') {
  if (!text || !label) return '';
  const expression = new RegExp(`${label}:\\s*"([^"]+)"`, 'i');
  const match = String(text).match(expression);
  return match?.[1]?.trim() || '';
}

function extractSubEntitySubject(text = '') {
  if (!text) return '';
  const explicitAround = String(text).match(/around\s+([^:.,\n]+)\s*:/i);
  if (explicitAround?.[1]) {
    return explicitAround[1].trim();
  }
  const explicitTied = String(text).match(/tied to\s+([^.,\n]+)/i);
  return explicitTied?.[1]?.trim() || '';
}

function deriveMockType(kind = '') {
  switch (String(kind).trim().toLowerCase()) {
    case 'character':
    case 'person':
      return { ner_type: 'PERSON', ner_subtype: 'Witness' };
    case 'event':
      return { ner_type: 'EVENT', ner_subtype: 'Turning Point' };
    case 'skill':
    case 'practice':
      return { ner_type: 'SKILL', ner_subtype: 'Learned Practice' };
    case 'ritual':
      return { ner_type: 'CONCEPT', ner_subtype: 'Ritual Form' };
    case 'authority':
    case 'faction':
    case 'institution':
      return { ner_type: 'ORGANIZATION', ner_subtype: 'Order' };
    case 'item':
    case 'relic':
      return { ner_type: 'ITEM', ner_subtype: 'Relic' };
    case 'location':
    default:
      return { ner_type: 'LOCATION', ner_subtype: 'Watchpoint' };
  }
}

function buildSeerContextMockEntities(text = '', count = 3) {
  const focusKind = extractQuotedPromptValue(text, 'Focused card kind');
  const focusTitle = extractQuotedPromptValue(text, 'Focused card title');
  const witness = extractQuotedPromptValue(text, 'Witness');
  const location = extractQuotedPromptValue(text, 'Location');
  const playerClarification = extractQuotedPromptValue(text, 'Player clarification');
  const relatedThrough = extractQuotedPromptValue(text, 'Related through what');
  const primaryName = focusTitle || location;

  if (!primaryName) return [];

  const type = deriveMockType(focusKind);
  const leadEntity = {
    id: 'mock-entity-1',
    name: primaryName,
    ner_type: type.ner_type,
    ner_subtype: type.ner_subtype,
    description: playerClarification
      ? `${primaryName} takes on clearer shape in the reading: ${playerClarification}`
      : `${primaryName} stands out as a reusable thread made legible by the seer.`,
    relevance: relatedThrough
      ? `This thread matters because it binds the memory through ${relatedThrough}.`
      : `This thread matters because the reading keeps circling back to ${primaryName}.`,
    connections: [witness, location && location !== primaryName ? location : ''].filter(Boolean)
  };

  const supportEntities = [
    witness
      ? {
        id: 'mock-entity-2',
        name: witness,
        ner_type: 'PERSON',
        ner_subtype: 'Witness',
        description: `${witness} is the living angle through which this memory becomes legible.`,
        relevance: `Their relationship to ${primaryName} turns the thread from atmosphere into character history.`,
        connections: [primaryName]
      }
      : null,
    relatedThrough
      ? {
        id: 'mock-entity-3',
        name: relatedThrough.charAt(0).toUpperCase() + relatedThrough.slice(1),
        ner_type: 'CONCEPT',
        ner_subtype: 'Binding Motif',
        description: `${relatedThrough} acts as the thematic pressure connecting the visible facts in the spread.`,
        relevance: `It explains why ${primaryName} recurs instead of staying a one-off detail.`,
        connections: [primaryName, witness].filter(Boolean)
      }
      : null
  ].filter(Boolean);

  return [leadEntity, ...supportEntities].slice(0, count);
}

function buildMissionContextMockEntities(text = '', count = 3) {
  const mainSubject = extractSubEntitySubject(text);
  if (!mainSubject) return [];

  const rootToken = mainSubject
    .split(/\s+/)
    .filter(Boolean)
    .slice(-1)[0] || 'Thread';

  const templates = [
    {
      id: 'mock-entity-1',
      name: `${mainSubject} Weather Marks`,
      ner_type: 'ITEM',
      ner_subtype: 'Field Notes',
      description: `A reusable set of physical marks, scratches, and weather cues gathered from ${mainSubject}.`,
      relevance: `These marks turn the mission around ${mainSubject} into something another player can discover later.`,
      connections: [mainSubject]
    },
    {
      id: 'mock-entity-2',
      name: `${rootToken} Witness`,
      ner_type: 'PERSON',
      ner_subtype: 'Keeper',
      description: `A minor witness whose knowledge of ${mainSubject} is practical rather than ceremonial.`,
      relevance: `This witness can reopen the same thread in another reading or later scene.`,
      connections: [mainSubject]
    },
    {
      id: 'mock-entity-3',
      name: `${mainSubject} Storm Rite`,
      ner_type: 'SKILL',
      ner_subtype: 'Weather Reading',
      description: `A learned practice distilled from the mission around ${mainSubject}.`,
      relevance: `This skill turns investigation into a lasting character consequence.`,
      connections: [mainSubject]
    }
  ];

  return templates.slice(0, count);
}

function buildMockEntities(text = '', count = 3, desiredEntityCategories = DEFAULT_DESIRED_ENTITY_CATEGORIES) {
  const missionContextEntities = buildMissionContextMockEntities(text, count);
  if (missionContextEntities.length) {
    return missionContextEntities;
  }

  const seerContextEntities = buildSeerContextMockEntities(text, count);
  if (seerContextEntities.length) {
    return seerContextEntities;
  }

  const safeCount = Number.isFinite(Number(count)) ? Math.min(Math.max(1, Math.floor(Number(count))), 12) : 3;
  const categories = normalizeDesiredEntityCategories(desiredEntityCategories);
  const templatesByCategory = {
    LOCATION: {
      name: 'Emberline Waystation',
      ner_type: 'LOCATION',
      ner_subtype: 'Border Outpost',
      description: 'A soot-stained refuge of iron and red stone, lit by lanterns that never fully warm the air.',
      relevance: 'A waypoint rumored to sit on the edge of shifting jurisdictions.',
      connections: ['Ashward Toll', 'The Cindergate Courier']
    },
    ITEM: {
      name: 'Rain-Sealed Satchel',
      ner_type: 'ITEM',
      ner_subtype: 'Courier Relic',
      description: 'A dark leather satchel whose wax seals carry the smell of pine smoke and wet iron.',
      relevance: 'Its contents can redirect the next scene before anyone speaks of them aloud.',
      connections: ['Emberline Waystation', 'The Cindergate Courier']
    },
    NPC: {
      name: 'Cindergate Courier',
      ner_type: 'PERSON',
      ner_subtype: 'Messenger',
      description: 'A weather-hardened runner in layered leathers, carrying sealed pouches scented with smoke.',
      relevance: 'Brings secrets between settlements, often arriving just before unrest.',
      connections: ['Emberline Waystation']
    },
    FLORA: {
      name: 'Blackfen Reed',
      ner_type: 'FLORA',
      ner_subtype: 'Marsh Growth',
      description: 'Tall river reeds with soot-dark stems and silver undersides that flash under storm light.',
      relevance: 'They mark the wet boundaries where roads become memories and footprints vanish.',
      connections: ['Emberline Waystation']
    },
    FAUNA: {
      name: 'Latchwing',
      ner_type: 'FAUNA',
      ner_subtype: 'Carrion Bird',
      description: 'A sharp-beaked marsh bird that settles on rusted iron before rain turns serious.',
      relevance: 'Its sudden silence is treated as a bad sign by anyone who has crossed the pass at dusk.',
      connections: ['Emberline Waystation']
    },
    EVENT: {
      name: 'Ashward Toll',
      ner_type: 'EVENT',
      ner_subtype: 'Rite of Passage',
      description: 'A ritual tariff collected at dusk, marked by bell chimes and a sworn silence.',
      relevance: 'Signals a shift in authority and the start of a fragile truce.',
      connections: ['Emberline Waystation']
    },
    FACTION: {
      name: 'Watchers of the Ninth Bell',
      ner_type: 'ORGANIZATION',
      ner_subtype: 'Border Order',
      description: 'A disciplined river-watch order that inventories crossings, debts, and unusual arrivals.',
      relevance: 'Their records decide which strangers become guests and which become warnings.',
      connections: ['Emberline Waystation', 'Ashward Toll']
    }
  };

  return Array.from({ length: safeCount }).map((_, index) => {
    const requestedCategory = categories[index % categories.length];
    const template = templatesByCategory[requestedCategory] || {
      name: `${requestedCategory} Thread`,
      ner_type: requestedCategory,
      ner_subtype: 'Narrative Thread',
      description: `A reusable ${requestedCategory.toLowerCase()} thread drawn out of the fragment's pressure points.`,
      relevance: `This ${requestedCategory.toLowerCase()} exists because the fragment implies it strongly enough to matter beyond the moment.`,
      connections: []
    };
    if (index === 0) {
      return {
        id: 'mock-entity-1',
        ...template
      };
    }
    return {
      id: `mock-entity-${index + 1}`,
      ...template,
      name: `${template.name} ${index + 1}`
    };
  });
}

export async function textToEntityFromText({
  sessionId,
  playerId,
  text,
  entityCount = 8,
  desiredEntityCategories = DEFAULT_DESIRED_ENTITY_CATEGORIES,
  includeCards = false,
  includeFront = true,
  includeBack = true,
  debug = false,
  mainEntityId,
  isSubEntity = false,
  llmModel = '',
  llmProvider = 'openai',
  textureModel = '',
  mockTextures = false,
  entityPromptTemplate = '',
  texturePromptTemplate = '',
  frontPromptTemplate = ''
}) {
  const shouldMockTextures = Boolean(debug || mockTextures);
  const safeEntityCount = Number.isFinite(Number(entityCount))
    ? Math.min(Math.max(1, Math.floor(Number(entityCount))), 12)
    : 8;
  const normalizedDesiredEntityCategories = normalizeDesiredEntityCategories(desiredEntityCategories);

  if (debug) {
    const entities = buildMockEntities(text, safeEntityCount, normalizedDesiredEntityCategories);
    if (mainEntityId) {
      entities.forEach((entity) => {
        entity.mainEntityId = mainEntityId;
        entity.isSubEntity = Boolean(isSubEntity);
      });
    }
    entities.forEach((entity) => {
      entity.playerId = playerId || entity.playerId;
    });
    await setEntitiesForSession(sessionId, entities, playerId);

    let cards;
    if (includeCards) {
      // Mock textures for back
      const textures = includeBack ? entities.map(e => buildFallbackTexture(text, e.name)) : [];
      cards = await buildCardsForEntities({
        sessionId,
        entities,
        textures,
        fragmentText: text,
        includeFront,
        includeBack,
        mocked: true,
        imageModel: textureModel,
        frontPromptTemplate
      });
    }
    return {
      entities,
      cards,
      desiredEntityCategories: normalizedDesiredEntityCategories,
      mocked: true,
      mockedEntities: true,
      mockedTextures: true
    };
  }

  const entities = await generateEntitiesFromFragment(
    sessionId,
    text,
    1,
    undefined,
    {
      mainEntityId,
      isSubEntity,
      playerId,
      maxEntities: safeEntityCount,
      llmModel,
      llmProvider,
      entityPromptTemplate,
      desiredEntityCategories: normalizedDesiredEntityCategories
    }
  );
  let cards;

  if (includeCards) {
    const textures = includeBack && !shouldMockTextures
      ? await generateTexturesForEntities(text, entities, llmModel, texturePromptTemplate, llmProvider)
      : [];
    cards = await buildCardsForEntities({
      sessionId,
      entities,
      textures,
      fragmentText: text,
      includeFront,
      includeBack,
      mocked: shouldMockTextures,
      imageModel: textureModel,
      frontPromptTemplate
    });
  }

  return {
    entities,
    cards,
    desiredEntityCategories: normalizedDesiredEntityCategories,
    mocked: shouldMockTextures,
    mockedEntities: false,
    mockedTextures: shouldMockTextures
  };
}

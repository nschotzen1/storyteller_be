import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { directExternalApiCall } from '../ai/openai/apiService.js';
import { generate_texture_by_fragment_and_conversation } from '../ai/openai/texturePrompts.js';
import { getNArchetypes } from '../ai/openai/promptsUtils.js';
import { generateEntitiesFromFragment, setEntitiesForSession, ensureDirectoryExists } from '../storyteller/utils.js';
import { textToImageOpenAi } from '../ai/textToImage/api.js';
import { renderPromptTemplateString } from './typewriterPromptConfigService.js';

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

async function generateTexturesForEntities(fragmentText, entities, llmModel = '', promptTemplate = '') {
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

  const response = await directExternalApiCall(prompts, 2500, 1.03, undefined, true, true, llmModel);
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

function buildMockEntities() {
  return [
    {
      id: 'mock-entity-1',
      name: 'Emberline Waystation',
      ner_type: 'LOCATION',
      ner_subtype: 'Border Outpost',
      description: 'A soot-stained refuge of iron and red stone, lit by lanterns that never fully warm the air.',
      relevance: 'A waypoint rumored to sit on the edge of shifting jurisdictions.',
      connections: ['Ashward Toll', 'The Cindergate Courier']
    },
    {
      id: 'mock-entity-2',
      name: 'Cindergate Courier',
      ner_type: 'PERSON',
      ner_subtype: 'Messenger',
      description: 'A weather-hardened runner in layered leathers, carrying sealed pouches scented with smoke.',
      relevance: 'Brings secrets between settlements, often arriving just before unrest.',
      connections: ['Emberline Waystation']
    },
    {
      id: 'mock-entity-3',
      name: 'Ashward Toll',
      ner_type: 'EVENT',
      ner_subtype: 'Rite of Passage',
      description: 'A ritual tariff collected at dusk, marked by bell chimes and a sworn silence.',
      relevance: 'Signals a shift in authority and the start of a fragile truce.',
      connections: ['Emberline Waystation']
    }
  ];
}

export async function textToEntityFromText({
  sessionId,
  playerId,
  text,
  includeCards = false,
  includeFront = true,
  includeBack = true,
  debug = false,
  mainEntityId,
  isSubEntity = false,
  llmModel = '',
  textureModel = '',
  mockTextures = false,
  entityPromptTemplate = '',
  texturePromptTemplate = '',
  frontPromptTemplate = ''
}) {
  const shouldMockTextures = Boolean(debug || mockTextures);

  if (debug) {
    const entities = buildMockEntities();
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
      llmModel,
      entityPromptTemplate
    }
  );
  let cards;

  if (includeCards) {
    const textures = includeBack && !shouldMockTextures
      ? await generateTexturesForEntities(text, entities, llmModel, texturePromptTemplate)
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
    mocked: shouldMockTextures,
    mockedEntities: false,
    mockedTextures: shouldMockTextures
  };
}

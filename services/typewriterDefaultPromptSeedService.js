import { getRouteConfig } from './llmRouteConfigService.js';
import {
  getLatestPromptTemplate,
  savePromptTemplateVersion
} from './typewriterPromptConfigService.js';
import {
  generateTypewriterPrompt,
  generate_entities_by_fragment,
  getNArchetypes
} from '../ai/openai/promptsUtils.js';
import { buildInitialChatPromptText } from '../ai/openai/personaChatPrompts.js';
import { getDefaultImmersiveRpgGmPromptTemplate } from './immersiveRpgService.js';
import { getDefaultQuestSceneAuthoringPromptTemplate } from './questSceneAuthoringService.js';

const DEFAULT_ENTITY_COUNT = 4;
const DEFAULT_MAX_ENTITIES = 8;

function buildStoryContinuationPromptTemplate() {
  return generateTypewriterPrompt('{{current_narrative}}')?.[0]?.content || '';
}

export function getDefaultXerofagInspectionPromptTemplate() {
  return `You are judging whether a live narrative should gain one exact in-world term.

Candidate term: "{{candidate_term}}"
Lore for the term: "{{xerofag_lore}}"

Current narrative:
"""
{{current_narrative}}
"""

Candidate narrative after appending the term:
"""
{{candidate_narrative}}
"""

Return JSON only in exactly this shape:
{"allowed": true}
or
{"allowed": false}

Approve only when adding the candidate term at the end feels natural, supported, and tonally coherent.
Reject when the addition feels abrupt, redundant, contradictory, unsupported by the current imagery, or like lore being forced into the prose.
If the current narrative already ends with the same term, return false.
Do not explain your answer.`;
}

async function buildMemoryCreationPromptTemplate() {
  const routeConfig = await getRouteConfig('fragment_to_memories');
  return routeConfig?.promptTemplate || '';
}

function buildEntityCreationPromptTemplate() {
  const prompt = generate_entities_by_fragment('{{fragmentText}}', DEFAULT_MAX_ENTITIES)?.[0]?.content || '';
  return prompt.replace('and these existing entities []', 'and these existing entities {{existingEntities}}');
}

function buildTextureCreationPromptTemplate() {
  return `So you're telling me that if for example, I will give this archetype json list:
"{{archetypes_json}}"
these could be meaningful in crafting a tarot deck? for the following
 very very specific and yet unknown, mysterious first trodden storytelling universe from which we only got this narrative fragment:


** fragment start*** "{{fragmentText}}" *** fragment end ***:

this is all we've got left of this storytelling universe. and now we want to reveal the decks that resonate this storytelling universe
{{entityCount}} different decks each made of different material. from each deck we get a texture for a different archetype
but all textures echo and resonate deeply the fragment given. they are its extract each in a different way.



Requirements:
1. Output Format: JSON Array of {{entityCount}}
{
  "textures": [
    {
      "text_for_entity": "String (the name of the entity for which the texture matches)",
      "archetype": "String (Core symbolic archetype, e.g., 'Celestial Seer', ' mix of drama+psychology+mythic)",
      "prompt": "Card texture: A worn, arcane card back designed for an RPG universe, crafted from [card_material]. The full-frame design features each archetype through its organic mediums, while demonstrating intricate embellishments and filigrees, seamlessly integrated into the surface. The texture is deeply aged, with visible signs of wear-faded edges, small cracks, and a raw, tactile feel. it's been through a lot.

      **Bottom Left & Right Corners:** Rugged yet elegantly adorned with curling filigree, hinting at lost grandeur. Subtle arcane etchings fade into the worn edges, as if the card has been handled for centuries.

      **Right & Left Borders:** A delicate interplay of embossed patterns and arcane inscriptions, barely visible beneath layers of aging. The texture transitions smoothly, retaining an unbroken, magical feel.

      **Top Left & Right Corners:** Slightly more intact, though still weathered, featuring celestial or abstract motifs. These elements feel partially eroded, adding to the mystique of the deck's forgotten history.

      **Central Body:** An uninterrupted expanse of textured material, crafting carefully, though now partly worn [one of the archetypes from the list]- The texture is rich with depth, shifting subtly under natural light, giving the illusion of hidden details emerging when viewed from different angles. No gaps, no empty spaces-only the immersive, full-frame texture of a card belonging to an ancient, otherworldly deck..

      Seamless RPG card texture. Thick, tactile, immersive, and enigmatic. It must feel like a real, well-worn artifact, blending elements of fantasy and mystery. This is the card back for a unique tarot-style deck within the RPG world-each card a fragment of a grander, cosmic puzzle.",
      "font": "String (Google font name)",
      "font_size": "Number (in px)",
      "font_color": "String (descriptive, e.g., 'faded gold', 'deep obsidian')",
      "card_material": "String (e.g., 'weathered bone', 'aged bronze', 'woven lunar cloth')",
      "major_cultural_influences_references": [
        "String (RPG system, e.g., 'Numenera', 'Mage: The Ascension')",
        "String (Fantasy/Sci-Fi novel, e.g., 'The Broken Earth Trilogy')",
        "String (Movie/TV Show, e.g., 'Blade Runner 2049')",
        "String (Artist, e.g., 'Moebius', 'Beksinski')"
      ]
    },...
  ]
}

2. Texture Description Guidelines:
-try to match the texture for the entity
- Must be self-contained prompts for text-to-image API
- Full-frame, seamless, unbroken background design
- Include card-like elements (borders, embellishments, flourishes)
- Abstract/symbolic rather than literal scenes
- Blend multiple cultural/genre influences subtly
- Describe material wear and aging effects
- Emphasize keywords: RPG, cinematic, ArtStation, grainy, embellishments
- Natural lighting and atmospheric effects
- Avoid direct Earth culture references

3. Reference Style Example:
"{
      "text_for_entity": "The Hound's Reckoning",
      "archetype": {
        "archetype_name": "SOL",
        "symbol": "radiant dot with twelve outward lines"
      },
      "prompt": "Card texture: An obsidian-black card back with a crackled, ember-glowing core at its center, as if the card itself holds a dying fire within. The surface is rough, sand-worn, and deeply pitted, hinting at countless years buried beneath desert winds.

      **Bottom Left & Right Corners:** Charred edges, curling as if touched by distant flames.

      **Right & Left Borders:** Subtle claw-like etchings in the stone, faint echoes of an ancient pact bound in darkness.

      **Top Left & Right Corners:** A lattice of arcane embers, sparking dimly beneath the fractured obsidian.

      **Central Body:** The radiant dot with twelve outward lines, but rendered in the style of volcanic glass-crimson light seeping through jagged cracks.

      The card feels like it has weight, like a fragment of an ancient world now lost. Its textures are raw, worn, immersive, and seamless-suited for a deck where each card carries the burden of a thousand untold stories.",
      "font": "Cormorant Garamond",
      "font_size": "20px",
      "font_color": "deep ember red",
      "card_material": "cracked obsidian",
      "major_cultural_influences_references": [
        "Dark Souls",
        "Dune",
        "Hyperion Cantos",
        "Beksinski"
      ]
    }"

4. Material Considerations:
- Must be plausible as magical card material
- Show appropriate wear/aging effects
- Examples: metal, stone, fabric, wood, crystal, bone, etc.

5. Cultural Influence Requirements:
- Minimum 3 distinct influences per texture
- Focus on niche/esoteric sources
- Blend influences into something new/unique
- Can include RPGs, novels, films, art styles

Each texture should stand alone as a complete prompt without requiring context from other textures or the original scene.
Seamless RPG card texture. Full Frame design. thick feel for the texture.
        inspiring. immersive. exciting. magical. think of proper embellishments, flourishes. unbroken. full frame design.
        surprising idiosyncratic back side of a unique tarot deck. evidently used, arcane, magical. embelishments, filgrees, framed stand alone as a complete prompt without requiring context from other textures or the original scene.
        I want that the textures would feel like textures, and not resemble the entity they match to.
imagine it as if the entity is an entity that represents a deck of cards. so the texture would fit the whole deck. this entity is a mere card in that deck (not necessarily even the most valuable one).
All the textures must be unbroken!!! full, so could be used as a png in a react component!! this is most importatn!!

Entity names (use exactly for text_for_entity, one per texture):
{{entityNames}}`;
}

function buildMemoryCardFrontPromptTemplate() {
  return `Create a full-frame RPG collector card FRONT illustration titled "{{short_title}}".
Long-form memory identity: "{{dramatic_definition}}".
Memory viewpoint: "{{viewpoint}}".
Scene location: "{{location}}".
Emotional tone: "{{emotional_sentiment}}".
Memory scene details: "{{miseenscene}}{{actual_result}}{{watched}}".
Visual style: cinematic, tactile, grainy, with collector-card embellishments and subtle filigree.
Use this fragment as backup context when needed: "{{fragmentText}}".
No visible text except the title "{{short_title}}".`;
}

function buildMemoryCardBackPromptTemplate() {
  return `Create a full-frame RPG collector card BACK texture for memory "{{short_title}}".
Theme: memory residue, archival symbolism, layered weathered materials.
Temporal cue: "{{memory_distance}}{{temporal_relation}}".
Environmental cue: "{{geographical_relevance}}{{fragmentText}}".
Emotional undertone: "{{emotional_sentiment}}".
Visual style: abstract-symbolic, worn, cinematic, grainy, richly textured with card-back motifs and ornate flourishes.
No readable text.`;
}

function buildEntityCardFrontPromptTemplate() {
  return `Create a highly detailed RPG collector card front illustration for "{{entity_name}}".
The entity is categorized as "{{ner_type}}" with a subtype of "{{ner_subtype}}".
The entity is described as: "{{description}}". Expand upon this description to craft vivid, concrete imagery for the illustration.
Narrative context: "{{relevance}}". {{evolution_notes}}
{{connections}}
{{texture_prompt}}
Use this fragment to set the tone when needed: "{{fragmentText}}".
Full-frame, cinematic quality, detailed, immersive, and cohesive. Include tasteful embellishments and flourishes that make it feel like a collector card.
No visible text besides the title: "{{entity_name}}".`;
}

async function buildStorytellerCreationPromptTemplate() {
  const routeConfig = await getRouteConfig('text_to_storyteller');
  return routeConfig?.promptTemplate || '';
}

async function buildStorytellerInterventionPromptTemplate() {
  const routeConfig = await getRouteConfig('storyteller_typewriter_intervention');
  if (routeConfig?.promptTemplate) {
    return routeConfig.promptTemplate;
  }

  return `You are a hidden storyteller joining an already-unfolding scene.

You are:
- Name: {{storyteller_name}}
- Immediate appearance: {{storyteller_immediate_ghost_appearance}}
- Typewriter key symbol: {{storyteller_symbol}}
- Typewriter key description: {{storyteller_key_description}}
- Voice: {{storyteller_voice}}
- Age: {{storyteller_age}}
- Style: {{storyteller_style}}
- Influences: {{storyteller_influences}}
- Known universes: {{storyteller_known_universes}}
- Already introduced in this typewriter session: {{storyteller_already_introduced}}

Current narrative fragment:
"""
{{fragment_text}}
"""

Your task:
- Write a short storyteller intervention that enters the scene seamlessly, as if you had been there all along.
- If you were not introduced before, briefly introduce yourself in-world without breaking tone.
- Notice one specific thing in the fragment, investigate it, enrich the world with one fresh entity, and then drift back out.
- The intervention must feel enchanting, observant, and precise rather than loud or expository.
- Keep it concise: about 45-110 words.
- Do not summarize the whole fragment.
- Do not explain mechanics or mention players, prompts, APIs, JSON, or typewriters.

You must also define one new entity discovered during this intervention.

Style rules:
- If you include style.font_color, it must be a dark, clearly legible CSS hex color suited for parchment.
- Prefer one of these strong dark tones: #2a120f, #3b1d15, #5a1f17, #1f3558, #253f33, #43233d.
- Never return white, pale gray, pastel, neon, or low-contrast colors.

Return JSON only in this exact shape:
{
  "continuation": "String",
  "entity": {
    "name": "String",
    "key_text": "1-3 words, suitable for a small textual typewriter key",
    "summary": "Short vivid description",
    "type": "String",
    "subtype": "String",
    "lore": "Optional short lore note",
    "tags": ["String"]
  },
  "style": {
    "font": "Optional font family",
    "font_size": "Optional CSS size",
    "font_color": "Optional dark CSS hex color"
  }
}`;
}

function buildMessengerChatPromptTemplate() {
  return buildInitialChatPromptText();
}

function buildImmersiveRpgGmPromptTemplate() {
  return getDefaultImmersiveRpgGmPromptTemplate();
}

async function buildStorytellerMissionPromptTemplate() {
  const routeConfig = await getRouteConfig('storyteller_mission');
  return routeConfig?.promptTemplate || '';
}

async function buildQuestGenerationPromptTemplate() {
  const routeConfig = await getRouteConfig('quest_advance');
  return routeConfig?.promptTemplate || '';
}

function buildQuestSceneAuthoringPromptTemplate() {
  return getDefaultQuestSceneAuthoringPromptTemplate();
}

function buildRelationshipEvaluationPromptTemplate() {
  return `You are a worldbuilding judge for a collaborative storytelling game.

A player proposes a relationship between entities in an arena:
- Source: {{source_json}}
- Targets: {{targets_json}}
- Proposed relationship: "{{relationship_surface_text}}"
- Existing direct connections: {{existing_edges_json}}{{cluster_context_section}}

Evaluate this relationship on:
1. Type coherence (does it make sense for these entity types?)
2. Specificity (is it descriptive, not vague?)
3. Non-redundancy (is it different from existing edges?)
4. Narrative grounding (does it feel plausible in this world?)
5. Cluster coherence (does it fit with the broader network of relationships?)

Return JSON:
{
  "verdict": "accepted" or "rejected",
  "quality": { "score": 0-1, "confidence": 0-1, "reasons": ["..."] },
  "suggestions": [{ "predicate": "...", "surfaceText": "..." }] // only if rejected
}`;
}

function buildStorytellerKeyPromptTemplate() {
  return `Create a single isolated storyteller typewriter key replacement asset as a PNG with transparent background.

Context:
- Storyteller: "{{storyteller_name}}"
- Central icon: "{{symbol}}"
- Material / lore cue: "{{description}}"
- Target slot silhouette: "{{blank_shape}}"
- Reference blank texture: "{{blank_texture_url}}"
- Geometry hint: "{{shape_prompt_hint}}"

This asset will directly replace an existing blank key in the Storyteller typewriter UI.

Non-negotiable output rules:
- Match the target silhouette and proportions exactly. Do not invent a new outer key shape.
- One key only, centered, front-facing, near-orthographic.
- Fully transparent outside the key silhouette, with clean compositing-ready edges.
- No hands, no typewriter body, no table, no scene, no extra objects.
- No letters, no numbers, no readable words.
- The key must still read as a physical typewriter key, not a coin, badge, medallion, seal, or machine button from some other device.

Icon direction:
- The icon should feel strange, ancient, and narratively charged: a sign that this storyteller wants to enter the unfolding world.
- Integrate the icon into the face of the key as engraving, inlay, raised relief, lacquer fill, fissure, smoky glass insert, or another physical construction.
- Keep the icon bold and legible at small UI size.
- Prefer one strong central mark over many tiny details.

Material and wear:
- Treat "{{description}}" as the main material and mood guide.
- Use tactile wear only: tarnish, chipped enamel, rubbed edges, hairline cracks, oxidized metal, soot, ivory staining, obsidian fractures, dried ink residue.
- Add one subtle sign of long use: a notch, scar, dent, or worn thumb-polish area.

Storyteller Society trace:
- Hide a tiny eye-quill-flame sigil somewhere in the rim or face wear.
- Optional faint unreadable radial marks are allowed, but they must never become readable text.

Lighting:
- Studio-isolated asset lighting, crisp silhouette separation, realistic highlights, restrained ambient magic.

Goal:
The final image should feel like a production-ready replacement texture for the blank slot: uncanny, analog, weathered, and immediately readable as "{{storyteller_name}}" entering the narrative.`;
}

function buildIllustrationPromptTemplate() {
  return `A highly detailed, cinematic portrait of a Storyteller named "{{name}}" - a spectral chronicler who *belongs to the exact world* described in the fragment below.
This is not a generic ghost portrait. The portrait must feel like a real inhabitant of that specific place, climate, and myth.

WORLD CANON ANCHOR (treat as ground truth; pull 3-6 very specific, physical details from it and weave them into the image):
"""
{{fragment_text}}
"""

FIGURE (human, real, lived-in):
- {{immediate_ghost_appearance}}
- Presence / voice: {{voice_description}}.
- Ageless but not abstract: a believable face, calm focus, the look of someone who has watched many nights.
- Slight translucency like smoke-thin vellum; aura behaves like ink in dry air (wisps, not neon).
- Ink-stained hands with tiny paper-cuts; fingertips smudged as if from ribbon-ink typing and handling cards.

WARDROBE (world-accurate, not fantasy costume):
- Clothing is grounded to the fragment's setting: dust-worn fabric, practical layers, wind-tugged edges.
- No wizard robes, no ornate jewelry; if there is adornment, it is functional (a simple pin, a tag, a threadbare strap).

WORLD-SPECIFIC TELLTALES (subtle but unmistakable; choose from the fragment, don't invent random set dressing):
- A weathered gate frame and a wide, empty forecourt/plate receding into darkness.
- Warm wind lifting a few torn fabric strips in the air (caught mid-motion).
- A clear starfield with a distinct "coyote" constellation high and centered (constellation shape implied, not cartoon).
- A faint dark stain or disturbed ground far behind, barely visible - as if something happened there.
- One role-signature object: a single tarnished typewriter key OR a thin stack of worn narrative cards with frayed edges (no readable text).

COMPOSITION:
- Waist-up portrait, 3/4 angle, centered framing; cinematic lens; shallow depth of field.
- Hands visible (important): one hand half-open as if weighing a story, the other stained as if just typed.

LIGHTING & ATMOSPHERE:
- Dramatic chiaroscuro; low practical light source (lantern glow, slit of light, or moon spill) with rim light on hair/cheek/hands.
- Dust motes and ink motes visible in the beam; dry air; film grain; archival texture.
- Mood is tense and quiet, like a watch nearing its end.

STYLE GUIDANCE:
{{influences_guidance}}
Realistic digital painting, grounded fantasy realism, highly detailed, cinematic, 8k.
The image should feel like a "character card portrait" from this universe: restrained palette, tactile materials, subtle myth.

AVOID:
wizard hat, hood, skull face, vampire tropes, neon glow, sci-fi UI overlays, readable text, logos, watermark, extra limbs, exaggerated anime features.`;
}

export async function getCurrentTypewriterPromptTemplates() {
  return {
    story_continuation: {
      pipelineKey: 'story_continuation',
      promptTemplate: buildStoryContinuationPromptTemplate(),
      source: 'ai/openai/promptsUtils.js:generateTypewriterPrompt',
      variables: [
        'current_narrative',
        'min_words',
        'max_words',
        'word_count',
        'preferred_font_size_px'
      ]
    },
    xerofag_inspection: {
      pipelineKey: 'xerofag_inspection',
      promptTemplate: getDefaultXerofagInspectionPromptTemplate(),
      source: 'services/typewriterDefaultPromptSeedService.js:getDefaultXerofagInspectionPromptTemplate',
      variables: [
        'current_narrative',
        'candidate_narrative',
        'candidate_term',
        'xerofag_lore'
      ]
    },
    memory_creation: {
      pipelineKey: 'memory_creation',
      promptTemplate: await buildMemoryCreationPromptTemplate(),
      source: 'services/llmRouteConfigService.js:fragment_to_memories.promptTemplate',
      variables: ['fragmentText', 'memoryCount']
    },
    memory_card_front: {
      pipelineKey: 'memory_card_front',
      promptTemplate: buildMemoryCardFrontPromptTemplate(),
      source: 'routes/memoriesRoutes.js:buildMemoryFrontPrompt',
      variables: ['short_title', 'dramatic_definition', 'viewpoint', 'location', 'emotional_sentiment', 'miseenscene', 'actual_result', 'watched', 'fragmentText']
    },
    memory_card_back: {
      pipelineKey: 'memory_card_back',
      promptTemplate: buildMemoryCardBackPromptTemplate(),
      source: 'routes/memoriesRoutes.js:buildMemoryBackPrompt',
      variables: ['short_title', 'dramatic_definition', 'memory_distance', 'temporal_relation', 'geographical_relevance', 'emotional_sentiment', 'fragmentText']
    },
    entity_creation: {
      pipelineKey: 'entity_creation',
      promptTemplate: buildEntityCreationPromptTemplate(),
      source: 'ai/openai/promptsUtils.js:generate_entities_by_fragment',
      variables: ['fragmentText', 'maxEntities', 'existingEntities']
    },
    entity_card_front: {
      pipelineKey: 'entity_card_front',
      promptTemplate: buildEntityCardFrontPromptTemplate(),
      source: 'services/textToEntityService.js:buildFrontPrompt',
      variables: ['entity_name', 'ner_type', 'ner_subtype', 'description', 'relevance', 'evolution_notes', 'connections', 'texture_prompt', 'fragmentText']
    },
    texture_creation: {
      pipelineKey: 'texture_creation',
      promptTemplate: buildTextureCreationPromptTemplate(),
      source: 'ai/openai/texturePrompts.js:generate_texture_by_fragment_and_conversation',
      variables: ['fragmentText', 'entityCount', 'entityNames', 'archetypes_json']
    },
    storyteller_creation: {
      pipelineKey: 'storyteller_creation',
      promptTemplate: await buildStorytellerCreationPromptTemplate(),
      source: 'services/llmRouteConfigService.js:text_to_storyteller.promptTemplate',
      variables: ['fragmentText', 'storytellerCount']
    },
    storyteller_intervention: {
      pipelineKey: 'storyteller_intervention',
      promptTemplate: await buildStorytellerInterventionPromptTemplate(),
      source: 'services/llmRouteConfigService.js:storyteller_typewriter_intervention.promptTemplate',
      variables: [
        'storyteller_name',
        'storyteller_immediate_ghost_appearance',
        'storyteller_symbol',
        'storyteller_key_description',
        'storyteller_voice',
        'storyteller_age',
        'storyteller_style',
        'storyteller_influences',
        'storyteller_known_universes',
        'storyteller_already_introduced',
        'fragment_text'
      ]
    },
    messenger_chat: {
      pipelineKey: 'messenger_chat',
      promptTemplate: buildMessengerChatPromptTemplate(),
      source: 'ai/openai/personaChatPrompts.js:buildInitialChatPromptText',
      variables: []
    },
    immersive_rpg_gm: {
      pipelineKey: 'immersive_rpg_gm',
      promptTemplate: buildImmersiveRpgGmPromptTemplate(),
      source: 'services/immersiveRpgService.js:getDefaultImmersiveRpgGmPromptTemplate',
      variables: []
    },
    quest_generation: {
      pipelineKey: 'quest_generation',
      promptTemplate: await buildQuestGenerationPromptTemplate(),
      source: 'services/llmRouteConfigService.js:quest_advance.promptTemplate',
      variables: [
        'currentScreenId',
        'currentScreenTitle',
        'currentScreenType',
        'currentScreenPrompt',
        'currentScreenImagePrompt',
        'currentScreenExpectationSummary',
        'currentScreenContinuitySummary',
        'currentDirections',
        'anchorScreenId',
        'anchorScreenTitle',
        'anchorScreenPrompt',
        'anchorScreenImagePrompt',
        'recentTraversal',
        'playerPrompt'
      ]
    },
    quest_scene_authoring: {
      pipelineKey: 'quest_scene_authoring',
      promptTemplate: buildQuestSceneAuthoringPromptTemplate(),
      source: 'services/questSceneAuthoringService.js:getDefaultQuestSceneAuthoringPromptTemplate',
      variables: [
        'sessionId',
        'questId',
        'authoringMode',
        'authoringBrief',
        'phaseGuidance',
        'visualStyleGuide',
        'selectedScreenSnapshot',
        'adjacentVisualContext',
        'sceneOutline',
        'promptRouteSummary'
      ]
    },
    storyteller_mission: {
      pipelineKey: 'storyteller_mission',
      promptTemplate: await buildStorytellerMissionPromptTemplate(),
      source: 'services/llmRouteConfigService.js:storyteller_mission.promptTemplate',
      variables: [
        'storytellerName',
        'entityName',
        'entityType',
        'entitySubtype',
        'entityDescription',
        'entityLore',
        'storytellingPoints',
        'message',
        'durationDays'
      ]
    },
    relationship_evaluation: {
      pipelineKey: 'relationship_evaluation',
      promptTemplate: buildRelationshipEvaluationPromptTemplate(),
      source: 'services/arenaService.js:evaluateRelationship',
      variables: [
        'source_json',
        'targets_json',
        'relationship_surface_text',
        'existing_edges_json',
        'cluster_context_section'
      ]
    },
    storyteller_key_creation: {
      pipelineKey: 'storyteller_key_creation',
      promptTemplate: buildStorytellerKeyPromptTemplate(),
      source: 'services/storytellerService.js:createStoryTellerKey',
      variables: [
        'symbol',
        'description',
        'storyteller_name',
        'blank_shape',
        'blank_texture_url',
        'shape_prompt_hint'
      ]
    },
    illustration_creation: {
      pipelineKey: 'illustration_creation',
      promptTemplate: buildIllustrationPromptTemplate(),
      source: 'services/storytellerService.js:createStorytellerIllustration',
      variables: [
        'name',
        'fragment_text',
        'immediate_ghost_appearance',
        'voice_style',
        'voice_tone',
        'voice_age',
        'voice_description',
        'influences_csv',
        'influences_guidance'
      ]
    }
  };
}

export async function seedCurrentTypewriterPromptTemplates({ updatedBy = 'admin', overwrite = false } = {}) {
  const currentTemplates = await getCurrentTypewriterPromptTemplates();
  const result = {
    pipelines: {}
  };

  for (const [pipelineKey, definition] of Object.entries(currentTemplates)) {
    const latest = await getLatestPromptTemplate(pipelineKey);
    const nextMeta = {
      source: definition.source,
      variables: definition.variables,
      seededFromCurrentCode: true,
      sampleEntityCount: pipelineKey === 'texture_creation' ? DEFAULT_ENTITY_COUNT : undefined,
      sampleArchetypes: pipelineKey === 'texture_creation' ? getNArchetypes(DEFAULT_ENTITY_COUNT) : undefined
    };

    if (latest?.promptTemplate === definition.promptTemplate) {
      result.pipelines[pipelineKey] = {
        action: 'unchanged',
        latest
      };
      continue;
    }

    if (latest && !overwrite) {
      result.pipelines[pipelineKey] = {
        action: 'skipped',
        latest
      };
      continue;
    }

    const saved = await savePromptTemplateVersion(
      pipelineKey,
      definition.promptTemplate,
      updatedBy,
      {
        markLatest: true,
        meta: nextMeta
      }
    );

    result.pipelines[pipelineKey] = {
      action: latest ? 'updated' : 'created',
      latest: saved
    };
  }

  return result;
}

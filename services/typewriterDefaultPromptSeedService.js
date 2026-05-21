import { getRouteConfig } from './llmRouteConfigService.js';
import {
  getLatestPromptTemplate,
  savePromptTemplateVersion
} from './typewriterPromptConfigService.js';

const TYPEWRITER_PROMPT_TEMPLATE_KEYS = [
  'story_continuation',
  'xerofag_inspection',
  'storyteller_creation',
  'storyteller_intervention',
  'typewriter_key_verification',
  'storyteller_key_creation',
  'illustration_creation'
];

function buildStoryContinuationPromptTemplate() {
  return `{{current_fragment}}

what is the first image that comes to your mind reading this fragment? what do you see? what do you hear? I want it blurry, a glimpse. then continue the story seamlessly {{max_words}} words max and no less than {{min_words}} words. (of course the story has to feel integral, cohesive) return in JSON format: {"glimpse":"Str","style":["inspired by"],"genre":"Str","surprising":1,"grounded":1,"ascope/pmessi_awareness":1,"pivotal":1,"are_you_being_generic_on_me":1,"dare_to_name_names?":1,"specificity":1,"are_the_surroundings_clear":1,"are_you_imposing_cultural_references":1,"new_named_entities":[],"readable":1,"easy_to_follow":1,"narration_style":["First-person"],"itchy_fingers":1,"continuation":"Str","are_you_proud_of_yourself":1}`;
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

Your role in this intervention:
- The continuation prompt and current fragment are composed by the backend before this text.
- Follow the active storyteller stage guideline exactly: {{storyteller_stage_guideline}}
- Current stage: {{storyteller_stage_label}} / {{storyteller_stage_id}}
- First person allowed now: {{storyteller_first_person_allowed}}
- Current-scene intervention allowed now: {{storyteller_current_scene_intervention_allowed}}
- Enter as an added observer with your own narrative voice, as if you had been nearby all along.
- If you were not introduced before, introduce yourself briefly and naturally in-world.
- Notice one precise detail in the current fragment.
- Something about that detail should trouble, remind, or alert you because of what you already know about this storytelling universe.
- From that realization, introduce exactly one new entity that is NOT explicitly mentioned in the current fragment.
- That entity may be any broad NER-like thing: item, location, person, flora, fauna, event, creature, relic, force, ritual, sign, etc.
- Say what you already know or suspect about that entity.
- Then leave the scene, allowing the original narrative to continue after you withdraw.

Narrative rules:
- Do not retell or summarize the whole fragment.
- Do not take over the main narrative for long.
- Do not explain mechanics or mention players, prompts, APIs, JSON, or typewriters.
- Do not make the intervention feel like exposition notes; it must feel like living prose.
- The new entity must feel specifically connected to something in the fragment, not randomly inserted.
- The storyteller should sound observant, precise, slightly haunted, and already familiar with the wider world.
- The intervention should begin with presence, move to recognition, then to the new entity, then to withdrawal.

Length:
- Keep it concise: about 55-120 words.

Writing guidance:
- Prefer first-person voice for the storyteller.
- Ground the intervention in one concrete sensory or visual cue from the fragment.
- Introduce only one fresh entity.
- Give that entity one memorable, concrete association or danger.
- End with a graceful exit, not a cliffhanger speech.

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
    "key_text": "1-3 words, suitable for a small pressable textual typewriter key",
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

async function buildTypewriterKeyVerificationPromptTemplate() {
  const routeConfig = await getRouteConfig('typewriter_key_verification');
  if (routeConfig?.promptTemplate) {
    return routeConfig.promptTemplate;
  }

  return `You are judging whether a saved textual typewriter key may be appended to a live narrative.

Current narrative:
"""
{{current_narrative}}
"""

Candidate narrative after appending the key text:
"""
{{candidate_narrative}}
"""

Key label shown on the keyboard: "{{key_text}}"
Exact text to append: "{{insert_text}}"
Source type: "{{source_type}}"

Entity context:
- Name: {{entity_name}}
- Description: {{entity_description}}
- Lore: {{entity_lore}}
- Type: {{entity_type}}
- Subtype: {{entity_subtype}}

Return JSON only in this exact shape:
{
  "allowed": true,
  "reason": "Optional short explanation"
}

Rules:
- Approve only when appending the key text at the end feels natural, supported, and tonally coherent.
- Reject when the addition feels abrupt, redundant, contradictory, or unsupported by the current fragment.
- Prefer restraint. This is an insertion check, not a worldbuilding opportunity.
- The entity context is background guidance only. Do not force the key in just because the entity is interesting.
- Keep reason short and practical if provided.`;
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
  const templates = {
    story_continuation: {
      pipelineKey: 'story_continuation',
      promptTemplate: buildStoryContinuationPromptTemplate(),
      source: 'services/typewriterDefaultPromptSeedService.js:buildStoryContinuationPromptTemplate',
      variables: [
        'current_fragment',
        'min_words',
        'max_words'
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
        'storyteller_task',
        'storyteller_known_context',
        'storyteller_stage_id',
        'storyteller_stage_label',
        'storyteller_stage_guideline',
        'storyteller_first_person_allowed',
        'storyteller_current_scene_intervention_allowed',
        'storyteller_archetype_label',
        'fragment_text'
      ]
    },
    typewriter_key_verification: {
      pipelineKey: 'typewriter_key_verification',
      promptTemplate: await buildTypewriterKeyVerificationPromptTemplate(),
      source: 'services/llmRouteConfigService.js:typewriter_key_verification.promptTemplate',
      variables: [
        'current_narrative',
        'candidate_narrative',
        'transaction_text',
        'before_context',
        'after_context',
        'transaction_id',
        'key_text',
        'insert_text',
        'entity_name',
        'entity_description',
        'entity_lore',
        'entity_type',
        'entity_subtype',
        'source_type'
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
  return Object.fromEntries(
    TYPEWRITER_PROMPT_TEMPLATE_KEYS
      .map((key) => [key, templates[key]])
      .filter(([, definition]) => Boolean(definition))
  );
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
      seededFromCurrentCode: true
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

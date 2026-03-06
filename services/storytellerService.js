// Service functions for Storyteller logic

/**
 * Generates the prompt for the AI to create storytellers based on a narrative fragment.
 * @param {string} fragmentText - The narrative fragment.
 * @returns {string} The formatted prompt string.
 */
export function generateStoryTellerForFragmentPrompt(fragmentText, numberOfStoryTellers = 3) {
  // Ensure fragmentText is a string and escape it properly if it were to be directly injected into a JSON string,
  // though here it's part of a larger text block.
  const safeFragmentText = typeof fragmentText === 'string' ? fragmentText : "";

  return `You are the keeper of the Storyteller Society—a shifting fellowship of storyteller ghosts, each with a voice, history, and interest of their own. 

Whenever a new narrative fragment is written, a beacon flares. Summon ${numberOfStoryTellers} distinct, original Society storytellers drawn to the energy, mood, and promise of the surviving fleeting fragment.
they've been in this storytelling universe, they know something about it.

this is the desired data structure! json array of ${numberOfStoryTellers} storyteller objects:

[{name: Unique and evocative; never repeats.
immediate_ghost_appearance: A fleeting, cinematic moment—how the ghost appears, sounds, or feels.
typewriter_key:
  symbol: An icon or image archetype that will appear on their typewriter key.  
  description: Vivid sensory detail—the color, material, texture, aura, of that typewriter key.
influences: 3–6 invented writers, RPGs, genres, or mythic traditions that shape their style.
known_universes: 1–3 original worlds or universes they’ve shaped. evocative and concrete.
level: Their power (1–20) as in D&D levels. the more complex and rich the fragment is the more it summons greater storytellers.
voice_creation:
  voice: Gender or vocal archetype (e.g., “female”, “male”, “nonbinary”, “clockwork”, etc.)
  age: Apparent or ageless.
  style: Cadence, emotional tone, and vocal texture.
},..more objects with the same structure as above to reach ${numberOfStoryTellers} storytellers]
Instructions:
Each storyteller must feel alive, unique, and chosen for this fragment—never generic, never repeating names, symbols, or universes.
No real or famous writers—Society storytellers are only your own invention.


Here's the fragment that has flared as a beacon: "${safeFragmentText}"
Are there any storytellers who see that beacon and arrive? 
Remember, we want  a JSON array. of ${numberOfStoryTellers} storytellers who vary in levels.
Output only a JSON array!! of ${numberOfStoryTellers} storyteller objects. No extra text!
 
`;
}

/**
 * Generates a prompt for sending a storyteller on a mission tied to a narrative entity.
 * @param {object} params
 * @returns {string}
 */
export function generateSendStorytellerToEntityPrompt({
  storyteller,
  entity,
  storytellingPoints,
  message,
  durationDays
}) {
  const storytellerName = storyteller?.name || 'Unknown Storyteller';
  const entityName = entity?.name || 'Unknown Entity';
  const entityType = entity?.type || entity?.ner_type || 'ENTITY';
  const entitySubtype = entity?.subtype || entity?.ner_subtype || 'General';
  const entityDescription = entity?.description || 'No description.';
  const entityLore = entity?.lore || '';
  const durationText = Number.isFinite(durationDays) ? `${durationDays} days` : 'an unknown duration';

  return `You are the Storyteller Society mission desk. Assign ${storytellerName} to investigate "${entityName}".

Mission context:
- Entity type: ${entityType} / ${entitySubtype}
- Entity description: ${entityDescription}
- Entity lore: ${entityLore}
- Storytelling points budget: ${storytellingPoints}
- Expected duration: ${durationText}
- Message to the storyteller: "${message}"

Return a JSON object with this exact shape:
{
  "outcome": "success|failure|delayed",
  "userText": "A short, direct message to the player describing the outcome. Leave empty if no response.",
  "gmNote": "A short GM-facing note on what is most interesting about the entity and how to show it.",
  "subEntitySeed": "1-3 sentences describing new sub-entities related to the original entity (for generation)."
}

Rules:
- Keep userText and gmNote under 60 words each.
- Always include subEntitySeed, even on failure or delay.
- Output only JSON, no extra text.`;
}

import path from 'path';
import { textToImageOpenAi } from '../ai/textToImage/api.js';
import { ensureDirectoryExists } from '../storyteller/utils.js';
import { renderPromptTemplateString } from './typewriterPromptConfigService.js';
// Assuming sanitizeName is either exported from api.js or we define a local version.
// If not exported, let's define a simple one here for now.
function sanitizeName(name) {
  if (!name || typeof name !== 'string') {
    // Return a default or throw an error, based on desired handling
    return 'default_storyteller_name';
  }
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/\s+/g, '_');
}

/**
 * Creates an image for the storyteller's typewriter key using a text-to-image service.
 * @param {object} typewriterKey - Object containing symbol and description for the key.
 * @param {string} sessionId - The current session ID.
 * @param {string} storytellerName - The name of the storyteller, for unique file naming.
 * @param {boolean} [shouldMockImage=false] - Whether to use a mock image response.
 * @returns {Promise<object|null>} An object with imageUrl and localPath, or null if image generation fails.
 */
export async function createStoryTellerKey(
  typewriterKey,
  sessionId,
  storytellerName,
  shouldMockImage = false,
  imageModelOverride = '',
  promptTemplate = ''
) {
  if (!typewriterKey || !typewriterKey.symbol || !typewriterKey.description) {
    console.error('Invalid typewriterKey provided to createStoryTellerKey');
    return null;
  }

  const { symbol, description } = typewriterKey;
  const blankShape = typeof typewriterKey.blank_shape === 'string'
    ? typewriterKey.blank_shape
    : 'blank storyteller slot';
  const blankTextureUrl = typeof typewriterKey.blank_texture_url === 'string'
    ? typewriterKey.blank_texture_url
    : '';
  const shapePromptHint = typeof typewriterKey.shape_prompt_hint === 'string'
    ? typewriterKey.shape_prompt_hint
    : 'front-facing typewriter key silhouette';
  const defaultPrompt = `Create a single isolated storyteller typewriter key asset as a PNG with transparent background.

This key must replace a predefined blank key slot in the UI.
- Slot silhouette name: "${blankShape}"
- Slot reference texture path: "${blankTextureUrl || 'not provided'}"
- Geometry guidance: ${shapePromptHint}

Non-negotiable output rules:
- Preserve the outer silhouette and proportions of the slot exactly. Do not invent a different key shape.
- One key only, centered, front-facing, orthographic or near-orthographic.
- No table, no hands, no typewriter body, no scene dressing, no extra objects, no visible background.
- The transparent area outside the key silhouette must stay fully empty.
- No letters, no numbers, no readable words. The only focal mark is the symbol.

Storyteller identity:
- Central symbol: "${symbol}"
- Material / lore cue: ${description}

Design direction:
- The key is a real analog artifact from the Storyteller Society, weathered by use.
- Build the symbol into the face of the key as an inlay, engraving, raised relief, cutout, or fused material event.
- Keep the symbol bold and legible at small UI size.
- The face should still read as a typewriter key, not a coin, badge, medallion, amulet, or button from another machine.

Surface + wear:
- Physical textures only: tarnish, pitting, hairline cracks, rubbed edges, oxidized metal, worn enamel, stained ivory, smoky glass, chipped lacquer, or obsidian abrasions as appropriate to the description.
- The rim and face should show age and repeated presses.
- Add a subtle narrative charge: faint glow, embering seam, ink shimmer, ghost residue, or dormant pulse, but keep it restrained and physical.

Storyteller Society infusion:
- Hide a tiny eye-quill-flame sigil somewhere in the rim, underside shadow, or worn impression.
- Optional radial runes or etched guidance marks around the symbol, but they must remain unreadable fragments.
- Include one scar, notch, or imperfection suggesting the key has a history inside the order.

Lighting:
- Studio-style isolated asset lighting with realistic highlights and soft contact shadow inside the key only.
- Emphasize material realism and crisp silhouette separation.

The final result should feel like a production-ready UI asset that can directly replace the blank slot texture.`
    .trim();
  const prompt = typeof promptTemplate === 'string' && promptTemplate.trim()
    ? renderPromptTemplateString(promptTemplate, {
      symbol,
      description,
      storyteller_name: storytellerName || '',
      blank_shape: blankShape,
      blank_texture_url: blankTextureUrl,
      shape_prompt_hint: shapePromptHint
    })
    : defaultPrompt;
  // Sanitize storytellerName for use in file path
  const saneName = sanitizeName(storytellerName);

  // Define the path for the image. Note: __dirname is not available in ES modules by default in the same way.
  // We construct paths relative to a known root or make them absolute.
  // Given `ai/textToImage/api.js` uses `path.join(__dirname, '../../assets', ...)`
  // and this service is likely at `services/storytellerService.js`,
  // the relative path to assets would be `../assets`.
  // Or, more robustly, ensure paths are constructed from the project root.
  // For now, let's assume 'assets' is a top-level directory accessible like this:
  const baseAssetPath = path.resolve(process.cwd(), 'assets'); // process.cwd() gives the root of the project
  const imageDir = path.join(baseAssetPath, sessionId, 'storyteller_keys');
  const imageFileName = `${saneName}_key.png`;
  const localImagePath = path.join(imageDir, imageFileName);

  try {
    await ensureDirectoryExists(imageDir);

    console.log(`Generating image for ${storytellerName} at ${localImagePath} with prompt: ${prompt}`);

    // textToImageOpenAi expects samples, localPath, shouldMock
    // textToImageOpenAi(prompt, samples, localPath, shouldMock, maxRetries)
    const imageResult = await textToImageOpenAi(prompt, 1, localImagePath, shouldMockImage, 3, imageModelOverride);

    return {
      imageUrl: imageResult.url, // This could be the public URL from OpenAI
      localPath: imageResult.localPath // This is where it's saved locally
    };
  } catch (error) {
    console.error(`Error in createStoryTellerKey for ${storytellerName}:`, error);
    return null;
  }
}

/**
 * Creates an illustration for the storyteller using a text-to-image service.
 * @param {object} storyteller - The storyteller object.
 * @param {string} sessionId - The current session ID.
 * @param {boolean} [shouldMockImage=false] - Whether to use a mock image response.
 * @returns {Promise<object|null>} An object with imageUrl and localPath, or null if image generation fails.
 */
export async function createStorytellerIllustration(
  storyteller,
  sessionId,
  shouldMockImage = false,
  imageModelOverride = '',
  promptTemplate = ''
) {
  if (!storyteller || !storyteller.name) {
    console.error('Invalid storyteller provided to createStorytellerIllustration');
    return null;
  }

  const { fragmentText, name, immediate_ghost_appearance, voice_creation, influences } = storyteller;

const voiceDesc = voice_creation
  ? `${voice_creation.style} ${voice_creation.voice}, ${voice_creation.age}`
  : "mysterious figure";

const influencesDesc =
  influences && influences.length
    ? `Influence labels: ${influences.join(", ")}. Translate these into concrete visuals (palette, materials, lighting, era cues) instead of vague fantasy tropes.`
    : "";

const defaultPrompt = `
A highly detailed, cinematic portrait of a Storyteller named "${name}" — a spectral chronicler who *belongs to the exact world* described in the fragment below.
This is not a generic ghost portrait. The portrait must feel like a real inhabitant of that specific place, climate, and myth.

WORLD CANON ANCHOR (treat as ground truth; pull 3–6 very specific, physical details from it and weave them into the image):
"""
${fragmentText}
"""

FIGURE (human, real, lived-in):
- ${immediate_ghost_appearance}
- Presence / voice: ${voiceDesc}.
- Ageless but not abstract: a believable face, calm focus, the look of someone who has watched many nights.
- Slight translucency like smoke-thin vellum; aura behaves like ink in dry air (wisps, not neon).
- Ink-stained hands with tiny paper-cuts; fingertips smudged as if from ribbon-ink typing and handling cards.

WARDROBE (world-accurate, not fantasy costume):
- Clothing is grounded to the fragment’s setting: dust-worn fabric, practical layers, wind-tugged edges.
- No wizard robes, no ornate jewelry; if there is adornment, it is functional (a simple pin, a tag, a threadbare strap).

WORLD-SPECIFIC TELLTALES (subtle but unmistakable; choose from the fragment, don’t invent random set dressing):
- A weathered gate frame and a wide, empty forecourt/plate receding into darkness.
- Warm wind lifting a few torn fabric strips in the air (caught mid-motion).
- A clear starfield with a distinct “coyote” constellation high and centered (constellation shape implied, not cartoon).
- A faint dark stain or disturbed ground far behind, barely visible — as if something happened there.
- One role-signature object: a single tarnished typewriter key OR a thin stack of worn narrative cards with frayed edges (no readable text).

COMPOSITION:
- Waist-up portrait, 3/4 angle, centered framing; cinematic lens; shallow depth of field.
- Hands visible (important): one hand half-open as if weighing a story, the other stained as if just typed.

LIGHTING & ATMOSPHERE:
- Dramatic chiaroscuro; low practical light source (lantern glow, slit of light, or moon spill) with rim light on hair/cheek/hands.
- Dust motes and ink motes visible in the beam; dry air; film grain; archival texture.
- Mood is tense and quiet, like a watch nearing its end.

STYLE GUIDANCE:
${influencesDesc}
Realistic digital painting, grounded fantasy realism, highly detailed, cinematic, 8k.
The image should feel like a “character card portrait” from this universe: restrained palette, tactile materials, subtle myth.

AVOID:
wizard hat, hood, skull face, vampire tropes, neon glow, sci-fi UI overlays, readable text, logos, watermark, extra limbs, exaggerated anime features.
`.trim();

  const prompt = typeof promptTemplate === 'string' && promptTemplate.trim()
    ? renderPromptTemplateString(promptTemplate, {
      name,
      fragment_text: fragmentText || '',
      immediate_ghost_appearance: immediate_ghost_appearance || '',
      voice_style: voice_creation?.style || '',
      voice_tone: voice_creation?.voice || '',
      voice_age: voice_creation?.age || '',
      voice_description: voiceDesc,
      influences_csv: Array.isArray(influences) ? influences.join(', ') : '',
      influences_guidance: influencesDesc || 'Translate the fragment into concrete palette, materials, lighting, and era cues instead of vague fantasy tropes.'
    })
    : defaultPrompt;


  const saneName = sanitizeName(name);
  const baseAssetPath = path.resolve(process.cwd(), 'assets');
  const imageDir = path.join(baseAssetPath, sessionId, 'storyteller_illustrations');
  const imageFileName = `${saneName}_illustration.png`;
  const localImagePath = path.join(imageDir, imageFileName);

  try {
    await ensureDirectoryExists(imageDir);

    console.log(`Generating illustration for ${name} at ${localImagePath} with prompt: ${prompt}`);

    const imageResult = await textToImageOpenAi(prompt, 1, localImagePath, shouldMockImage, 3, imageModelOverride);

    return {
      imageUrl: imageResult.url,
      localPath: imageResult.localPath
    };
  } catch (error) {
    console.error(`Error in createStorytellerIllustration for ${name}:`, error);
    return null;
  }
}

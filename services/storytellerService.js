// Service functions for Storyteller logic

/**
 * Generates the prompt for the AI to create storytellers based on a narrative fragment.
 * @param {string} fragmentText - The narrative fragment.
 * @returns {string} The formatted prompt string.
 */
export function generateStoryTellerForFragmentPrompt(fragmentText) {
  // Ensure fragmentText is a string and escape it properly if it were to be directly injected into a JSON string,
  // though here it's part of a larger text block.
  const safeFragmentText = typeof fragmentText === 'string' ? fragmentText : "";

  return `You are the keeper of the Storyteller Society—a shifting fellowship of storyteller ghosts, each with a voice, history, and palette all their own.

Whenever a new narrative fragment is written, a beacon flares. Summon 3 distinct, original Society storytellers drawn to the energy, mood, and promise of the surviving fleeting fragment.

For each storyteller, return:

name: Unique and evocative; never repeats.
immediate_ghost_appearance: A fleeting, cinematic moment—how the ghost appears, sounds, or feels.
typewriter_key:
  symbol: A single magical icon or image on their typewriter key.
  description: Vivid sensory detail—the color, material, texture, aura, or sound of the key.
influences: 3–6 invented writers, RPGs, genres, or mythic traditions that shape their style.
known_universes: 1–3 original worlds or universes they’ve shaped.
level: Their power (1–20).
voice_creation:
  voice: Gender or vocal archetype (e.g., “female”, “male”, “nonbinary”, “clockwork”, etc.)
  age: Apparent or ageless.
  style: Cadence, emotional tone, and vocal texture.

Instructions:
Each storyteller must feel alive, unique, and chosen for this fragment—never generic, never repeating names, symbols, or universes.
No real or famous writers—Society storytellers are only your own invention.
Output only a JSON array of storyteller objects. No extra text.

Here's the fragment that has flared as a beacon: "${safeFragmentText}"
Are there any storytellers who see that beacon and arrive? Return them as a JSON array.
`;
}

import path from 'path';
import { textToImageOpenAi, ensureDirectoryExists } from '../ai/textToImage/api.js';
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
export async function createStoryTellerKey(typewriterKey, sessionId, storytellerName, shouldMockImage = false) {
  if (!typewriterKey || !typewriterKey.symbol || !typewriterKey.description) {
    console.error('Invalid typewriterKey provided to createStoryTellerKey');
    return null;
  }

  const { symbol, description } = typewriterKey;
  const prompt = `A close-up of a unique, vintage typewriter key. The key prominently features the symbol "${symbol}". The key's material and aura are defined by: "${description}". Cinematic, detailed, macro shot.`;

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
    const imageResult = await textToImageOpenAi(prompt, 1, localImagePath, shouldMockImage);

    if (imageResult && imageResult.url) {
      console.log(`Image generated for ${storytellerName}: ${imageResult.url}`);
      // The URL from textToImageOpenAi might be a remote URL or could be a file path.
      // The function currently returns { revised_prompt, url, localPath }
      // We should return what's most useful, probably the localPath for server-side access
      // and url if it's a web-accessible URL.
      return {
        imageUrl: imageResult.url, // This could be the public URL from OpenAI
        localPath: imageResult.localPath // This is where it's saved locally
      };
    } else {
      console.error(`Image generation failed for ${storytellerName}. Result:`, imageResult);
      return null;
    }
  } catch (error) {
    console.error(`Error in createStoryTellerKey for ${storytellerName}:`, error);
    return null;
  }
}

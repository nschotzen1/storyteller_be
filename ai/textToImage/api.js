import fs from 'fs'; // fs.createWriteStream will remain sync for pipeline, fs.unlink also.
import https from 'https';
import path from 'path';
import fetch from 'node-fetch';



import { generate_texture_by_fragment_and_conversation, directExternalApiCall, getOpenaiClient } from '../openai/promptsUtils.js';
import { developEntityprompt } from '../openai/morePrompts.js';
import { 
    saveTextures, 
    getFragment, 
    getSessionChat, 
    setTexture, 
    generateEntitiesFromFragment, 
    getEntitiesForSession, 
    setEntitiesForSession,
    ensureDirectoryExists // Import the new utility
} from '../../storyteller/utils.js';

import { promisify } from 'util';
import stream from 'stream'; // Imported stream
const pipeline = promisify(stream.pipeline); // Used stream.pipeline

import stabilityClient from 'stability-client';
const { generateAsync } = stabilityClient;

// Define the API options
const API_TYPES = {
  STABLE_DIFFUSION: {
    url: 'https://openai.com/api/textToImage/stable_diffusion',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer <sk-12DRm1jAa3In5XalwbVahkxBK5VhWzAqKc7KDmBsBodSxCnE>' // Placeholder token
    }
  },
  // Add other APIs here as needed...
};

export function responseToTextureModels(response) {
  return response.output.map(imageUrl => ({
    status: response.status,
    generationTime: response.generationTime,
    id: response.id,
    imageUrl: imageUrl,
    width: response.meta.W,
    height: response.meta.H,
    prompt: response.meta.prompt,
  }));
}


export async function downloadImage(url, path) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Request Failed With Status Code: ${res.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(path);
            res.pipe(file);

            file.on('finish', () => {
                resolve();
            });

            file.on('error', (err) => {
                fs.unlink(path, () => {}); // Delete the file async if we have an error
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function textToImageOpenAi(prompt, samples=1, localPath, shouldMock= false, maxRetries=3){
  if(shouldMock)
  {
    return {
      url: `https://oaidalleapiprodscus.blob.core.windows.net/private/org-QEgcgJZRR8O5I4TU81OtIzQr/user-x8YFabEYMtNouC3KDRNrvqNt/img-DyFU8k9br5ifd27AbfL65YlI.png?st=2023-11-23T23%3A06%3A28Z&se=2023-11-24T01%3A06%3A28Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2023-11-23T20%3A18%3A16Z&ske=2023-11-24T20%3A18%3A16Z&sks=b&skv=2021-08-06&sig=ePHJceNpabp6Sb8CH5try7uAN3QdzapO6YSAPTkHJ9U%3D`,
      revised_prompt:`Compose a 1024x1024 full-frame Art Nouveau style illustration influenced by the chilling aura of Siberian folklore for the front side of an RPG character creation card named 'A Wisp Lantern' in Noto Sans font. The scene is bathed in a soft, icy blue light showcasing an ethereal lantern that gives an impression of being made from the chill of a mountaintop. The lantern cage resembles crystalline formations of frost and inside, a blue wisp dances like a flickering flame. This creates long, intric…ld. The scene encapsulates the cold, mysterious aura of a high mountain summit and the secrets of an ancient lighthouse. Remember to use intricate filigree designs inspired by icicles, and flourishes suggesting gusts of wind and snow to embellish the design. This grainy, cinematic, impressionistic artwork should evoke a sense of discovery evocative of a core game book, inviting players to immerse themselves into the character creation process via the selection of this collector's edition card.`
    }
  }
  
  else{
    
    for (let attempt=1; attempt <= maxRetries; attempt+1) {
      try {
        const response = await getOpenaiClient().images.generate({
          model: "dall-e-2",
          prompt,
          size: "1024x1024",
          n: samples,
        });
  
        const { revised_prompt, url } = response.data[0];
        // const {revised_prompt, url} = {url:"https://i.ibb.co/4VWg3y9/Dusk.png", revised_prompt:"asf"}
        await downloadImage(url, localPath);
        return { revised_prompt, url, localPath };
      } catch (e) {
        prompt += 'I need this prompt to work. So revise anything that use need to revise. any content policy issue should be smoothed by revising the issues. please!'  
        if(e.message.includes('must be length 1000'))
            prompt = prompt.slice(0, 950)
          console.log('Attempt', attempt + 1, 'failed for OpenAI DALL-E 3:', e);
        let sleepTo = 5* (attempt^2)
        
        await sleep(sleepTo)
      }
    }
  
    console.log('All attempts failed for OpenAI DALL-E 3');
    return { revised_prompt: null, url: null, localPath: null };
    
  } 
  
}
export function characterCreationOptionPrompt(cardStats){
  const { title, illustration, texture, category, subcategory } = cardStats;
const prompt = `Create a cinematic RPG collector card for ${category}/${subcategory}: "${title}". 

Illustration: ${illustration}

The card should be rooted in an in-game scene, as if captured in a moment of action or interaction, with a grainy, cinematic quality. Use the texture "${texture}" as a guideline for the artistic theme and style, infusing the image with embellishments and artistic flourishes that fit the RPG universe.

Focus on a dynamic POV composition, where the scene unfolds as seen through the eyes of a character within the game world.`;
return prompt;
}

export function bookDeteriorationPrompt(deteriorationLevel, detioriationDescription){
  let deteriorationLevelDesc = ''
  if(deteriorationLevel == 1){
    deteriorationLevelDesc = 'DETERIORATION LEVEL 1(out of 4): Early stages of Deterioration'
  }
  else if(deteriorationLevel == 2){
    deteriorationLevelDesc = 'DETERIORATION LEVEL 2(out of 4): Advanced stages of Deterioration'
  }
  else if(deteriorationLevel == 3){
    deteriorationLevelDesc = 'DETERIORATION LEVEL 3 (out of 4): Severe Damage! '
  }
  else{
    deteriorationLevelDesc = 'DETERIORATION LEVEL 4 (out of 4): almost complete destruction! '
  }
  const prompt = `${deteriorationLevel}:
  ${deteriorationLevelDesc}
  Create an image showing advanced deterioration (Level ${deteriorationLevel}) in a realistic, gritty, and documentary style. The scene is a location where a unique, faded book is subtly present but not the focus. The book should blend into the background, noticeable only upon closer inspection. Emphasize the environmental effects on the book, such as sand and sunlight. The book should be less prominent, almost hidden, and deeply integrated into its surroundings, like being partially covered by sand or near old machinery. Use cinematic techniques like deep shadows, light flares, and a dramatic interplay of light and dark for a moody atmosphere. Add rich textural details to highlight the raw, rugged aspect and introduce narrative elements to suggest the past life of the location. The image should have a vintage, film-like quality with grainy texture, soft focus, subdued colors, vignetting, and natural imperfections like light leaks or scratches. The book should not dominate the scene but be an integral, unemphasized part of it.
  `
  return prompt
}

export function storytellerDetectiveFirstArrivalIllustrationPrompt(texture, scene){
  const prompt = `first take this texture and breath it in: "overall texture, essence and vibe of this scene:
  "${texture}"
  it should be in the deepest layers and motiffs and influences of this illustration. this is the core!!
  
  now to where we're at:
  
  this is the story of the storyteller detective. as he gets into a foreign realm, which is at the last stages of deterioration and becoming totally lost and forgotten. The Storyteller detective is almost at the location of the resing place of the last book telling the tales of this once great storytelling universe. he's almost at the location . we acoompany the storyteller detective in the last scene of the journey of finding this going to be forever lost book and storytelling realm.
  we will focus on this last process of  the storyteller detective's journey . 
  it's going to be a sequence of narrative description woven with a series of options of continuations by the user (who is the storyteller himself, of this decaying soon to be forgotten storytelling  realm ) 
  
  
  
  but this is the scene I want you to make an illustration of 
  and by this is how the storyteller detective reached to that place 
  where the book should be: pay attention to every detail in it, and try to feel it. make us feel its gritty physicality. breath the location and the scene. 
  pay attention to places, people, items climate described in it: 
  "${scene}
  
  "Pay really close attention to all the details here: people, places, climate, atmosphere, items, mode of transportation. 
  do not lightly add details that will have a major storytelling effect.
  
  
  Create an image showing this scene in a realistic, gritty, and documentary style. Use cinematic techniques like deep shadows, light flares, and a dramatic interplay of light and dark for a moody atmosphere. Add rich textural details to highlight the raw, rugged aspect and introduce narrative elements to suggest the past life of the location. The image should have a vintage, film-like quality with grainy texture, soft focus, subdued colors, vignetting, and natural imperfections like light leaks or scratches. The book should not dominate the scene but be an integral, unemphasized part of it. add a sense of sad poeticness, and sense of urgency. be inspired by Akira Kurosawa all the way to Quentin Tarantino,. I want it raw...gritty,...natural light. rugged. the details are important: gender, how many people, the location, the time of day, the climate. I want to feel that we're caught in a moment. in the middle of something. the sense of urgency. it is not staged. it's as it happens. the storyteller detective face cannot be clearly seen.`

}


export function characterCreationOptionPrompt2(cardStats){
  const {title, font, illustration, description, texture, category, subcategory} = cardStats;
  const prompt = `${category}/${subcategory}/${title}(${font}):
  create an virtual RPG collector card: 
  
  ${illustration}
  
  use this texture as a guideline for artistic themese and style, and feel:
  
  "${texture}". 
  Use embellishments, and flourishes. 
  Make it a POV composition. whatever in that card is being seen by someone's perspective. it's rooted and grounded, taken within its context. 
  It's taken from a scene- it's less a presentation rather seeing it as might present itself within a scene context.`
  return prompt
  
}

export async function textToImage(prompt, samples=1, dirPath){ // Changed path to dirPath for clarity
  try {
    // Use the new ensureDirectoryExists
    await ensureDirectoryExists(dirPath);
  
    const { res, images } = await generateAsync({
      prompt: `${prompt}`,
      apiKey: 'sk-12DRm1jAa3In5XalwbVahkxBK5VhWzAqKc7KDmBsBodSxCnE', // Placeholder API Key
      samples: samples,
      engine: 'stable-diffusion-xl-1024-v1-0',
      outDir: dirPath, // Use dirPath
      steps: 40,
      width: 1024,
      height: 1024,
      seed: 0,
      samples: 1,
    })
    console.log(images)
    return images.map((img) => {
      return img.filePath.replace(/^.*\/assets/, '/assets');
    });
  
  } catch (e) {
    console.log(e)
  }
};

export async function generateTextureImgFromPrompt(prompt, apiKey, apiOptions = {}, samples=4) {
  // Merge with default options
  const options = {
    width: '512',
    height: '512',
    samples,
    num_inference_steps: '20',
    guidance_scale: 7.5,
    safety_checker: 'yes',
    multi_lingual: 'no',
    panorama: 'no',
    self_attention: 'no',
    upscale: 'no',
    
    ...apiOptions,
  };

  const response = await fetch('https://stablediffusionapi.com/api/v3/text2img', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: apiKey,
      prompt: prompt,
      ...options,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const data = await response.json();
  const textureModels = responseToTextureModels(data);
  await Promise.all(textureModels.map(textureModel => saveTextureModelToDB(textureModel)));
  return textureModels;
}

export function textureJSONToPrompt(textureJson){
  const {category, prompt, font, card_material, major_cultural_influences_references } = textureJson
  
  const resPrompt = `${category} RPG card Texture: Create a full-frame card texture that captures the essence of ${category}, 
  incorporating this vision:"${prompt}".
  . The design should feature a texture appearing on ${card_material}. 
  The background should be inspired by ${major_cultural_influences_references}. 
  Ensure the title of the category ${category}, is prominently displayed in the ${font} font , making it a key element of the design. 
  This design should be suitable for use as a PNG texture in a React app component, 
  reflecting the unique aspects of the card's category enhance the card like quality of the design. 
  ensure the category is presented too`
  return resPrompt;
  
  
}

export function getRandomCategory() {
  const items = ["Item", "Skill", "Location", "Character", "Event", "Place of Rest", "Creature", "Landscape", "Climate"];
  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}




// Helper to safely create directories - This function will be removed
// export function createDirectorySafely(directoryPath) {
//   try {
//     if (!fs.existsSync(directoryPath)) {
//       fs.mkdirSync(directoryPath, { recursive: true });
//     }
//   } catch (error) {
//     console.error(`Error creating directory: ${directoryPath}`, error);
//     throw error;
//   }
// }

function sanitizeName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Invalid name provided. It must be a non-empty string.');
  }
  return name.replace(/\s+/g, '_'); // Replace spaces with underscores
}


export async function developEntity({sessionId, entityId, developmentPoints}){

        // Await getFragment (assumption: it fetches some game fragment data)
        const fragment = await getFragment(sessionId);

      
        // Fetch all entities related to the session
        let entities = await getEntitiesForSession(sessionId);
        
        // Find the chosen entity
        const entityIndex = entities.findIndex(e => e.id === entityId);
        if (entityIndex === -1) {
          throw Error("could not find entity")
        }
        // Create a minimized field list of the rest of the entities
        const restOfEntities = entities
            .filter(e => e.id !== entityId)
            .map(({ id, name, type }) => ({ id, name, type })); // Adjust fields as needed
        
        // Await entity development function
        const entity = entities[entityIndex]
        const prompt = developEntityprompt(entity, restOfEntities, fragment, developmentPoints);
        // Call external API
        const externalApiResponse = await directExternalApiCall([prompt], 2500, undefined, undefined, true, undefined);
        entities[entityIndex] = updatedEntity
        await setEntitiesForSession(sessionId, entities);

  
}


// Main function
export async function generateTextureOptionsByText({
  sessionId,
  shouldMockImage,
  openAiMock = '',
  turn,
  generateIllustrations = false
} = {}) {
  try {
    const fragment = await getFragment(sessionId);
    const allSessions = await getSessionChat(sessionId);
    const storytellerConversation = allSessions
      .filter((i) => i.role !== '2user')
      .map((i, idx) => `${idx}: ${i.content}`)
      .join("\n");

    const entitiesApiResponse = await generateEntitiesFromFragment(sessionId, fragment, turn);
    // const { metadata, clusters, entities } = entitiesApiResponse;
    let subset = entitiesApiResponse.map(e => {
      return {
        name: e.name,
        ner_type: e.ner_type,
        ner_subtype: e.ner_subtype,
        description: e.description,
        relevance: e.relevance
      };
    });
    
    subset = JSON.stringify(subset)

    
    
    const generateTexturesPrompt = generate_texture_by_fragment_and_conversation(fragment, storytellerConversation, subset);
    let textureJsons = await directExternalApiCall(generateTexturesPrompt, 2500, 1.03, openAiMock, true, true);

    
    if (textureJsons.textures)  
      textureJsons = textureJsons.textures
    // Ensure textureJsons are available
    if (!textureJsons || textureJsons.length === 0) {
      throw new Error("No textures generated.");
    }

    const textures = await Promise.all(textureJsons.map(async (textureJson, index) => {
      const id = index; // Assign a unique ID (could also use a UUID generator)
      textureJson.id = id; // Add the ID to the texture

      const subfolderPath = path.join(__dirname, '../../assets', `${sessionId}/textures/${id}`);
      await ensureDirectoryExists(subfolderPath); // Use new async function

      const url = await textToImageOpenAi(
        `worn old and decayed RPG card texture titled: ${textureJson.text_for_entity}  written in this font (${textureJson.font})...made out of 
        ${textureJson.card_material}. try to think how you can use the archetype: ${textureJson.archetype} and define it in the texture illustration:
. work from the material itself. as if a master craftsman is doing it with proper tools.
this is the overall texture description ${textureJson.prompt}. immerse yourself in it. Remember, it has to be Seamless RPG card texture. Full Frame design!!. 
thick feel for the texture. 
        inspiring. immersive. exciting. magical. think of proper embellishments, flourishes. unbroken. full frame design. 
        evidently used, arcane, magical. embelishments, filgrees, frames. surprising idiosyncratic back side of a unique tarot deck. 
        the most important thing for it is that it would be full frame! rugged, worn, deteriorated state, grainy, raw! natural light. 
        nothing but the title: ${textureJson.text_for_entity} written on the card. rough , raw, feel the material. FULL FRAME. NO TEXT but title!!!. UNBROLEN.`,
        1,
        `${subfolderPath}/${id}.png`,
        shouldMockImage
      );

      return { url, textureJson };
    }));

    // Save textures to database
    await saveTextures(sessionId, textures);

    // Optionally generate illustrations
    let illustrations = await generateIllustrationsForEntities(entitiesApiResponse, textures, sessionId, shouldMockImage);

    

    // Combine results and return
    return {
      entitiesWithIllustrations: illustrations,
      texturesWithUrls: textures
    };
  } catch (error) {
    console.error("Error in generateTextureOptionsByText:", error);
    throw error;
  }
}


// Illustration generation function (assumed to be part of this module or imported elsewhere if used by exported functions)
// This function was not previously exported, if it's meant to be used externally, it should be exported.
// For now, keeping it as an internal helper. If it's called by exported functions, it's fine.
async function generateIllustrationsForEntities(entities, textures, sessionId, shouldMockImage) {
  textures = textures.map( texture => { 
    if(texture.hasOwnProperty('textureJson')){
      texture = {texture, ...texture.textureJson}
  }
  if(texture.hasOwnProperty('url')){
      texture.localPath = texture.url.localPath
  }
  if(texture.hasOwnProperty('texture')){
      texture.localPath = texture.texture.url.localPath
      delete texture.texture
  }
  return {session_id: sessionId, ...texture}})
  return await Promise.all(entities.map(async (entity, idx) => {
    const selectedTexture = textures.find(texture => texture.text_for_entity === entity.name) || textures[idx % textures.length];
    const illustrationPrompt = `
    Create a highly detailed and immersive RPG collector card front illustration for '${entity.name}'.
    The entity is categorized as '${entity.ner_type}' with a subtype of '${entity.ner_subtype}'.
    The entity is described as: "${entity.description}". Expand upon this description to craft vivid, concrete imagery for the illustration.
    Narrative context: '${entity.relevance}'.
    On closer inspection: '${entity.evolution_notes}'.
    Connections to consider: '${entity.connections.join(', ')}'.
    Use the following texture as inspiration: ${selectedTexture.prompt}. Explore how elements of this texture can be incorporated into the entity's depiction to make it suitable as a card in this texture's deck.
    Ensure the texture aligns with the entity's attributes and narrative role.
    Full-frame, cinematic quality, ArtStation-level detail. Incorporate thoughtful embellishments, flourishes, and ensure the design is seamless and visually cohesive.
    Develop the entity's visual representation by uniting its description, narrative significance, and the artistic aesthetics of the texture into a distinct and memorable design. remember
    to feel the texture, and try to extract the entity and its essence and its promiment features. immerse us in specificities.
    and most importantly, no text in the entity beside its title:${entity.name} ...the rest is the illustration of the entity. 
  `;


    const subfolderPath = path.join(__dirname, '../../assets', `${sessionId}/illustrations/${idx}`);
    await ensureDirectoryExists(subfolderPath); // Use new async function
    mock_illustrations = false
    if(process.env["MOCK_ILLUSTRATION"] == 'true')
      mock_illustrations = true
    const url = await textToImageOpenAi(illustrationPrompt, 1, `${subfolderPath}/${sanitizeName(entity.name)}.png`, mock_illustrations);

    return { url, entity, selectedTexture };
  }));
}


// {
//   "action_name": "open_deck",
//   "deckId": "texture3",
//   "relevant_entities": []
// },
// {
//   "action_name": "flip_card",
//   "deckId": "texture4",
//   "relevant_entities": ["entity42"]
// },
// {
//   "action_name": "develop",
//   "deckId": "texture1",
//   "relevant_entities": [
//     { "entity18": 5 }  // 5 storytelling points invested in developing entity18
//   ]
// },
// {
//   "action_name": "acquire",
//   "deckId": "texture3",
//   "relevant_entities": ["entity1", "entity47", "entity18"]
// }
export async function generateStorytellerSeerReaction({ sessionId, turn, action }) {
  const fragment = await getFragment(sessionId);
  
  const allSessions = await getSessionChat(sessionId);
  const storytellerConversation = allSessions
    .filter(item => item.role !== '2user')
    .map((item, idx) => `${idx}: ${item.content}`)
    .join("\n");

  let currentDeck = await getCurrentDeck(sessionId, turn);
  const { action_name, relevant_entities, deckId } = action;

  let summaryOfAction = '';
  let entitiesIllustrationDescription = '';

  if (action_name === 'develop') {
    const devEntry = relevant_entities[0];
    const entityId = Object.keys(devEntry)[0];
    const developmentPoints = devEntry[entityId];

    const currentEntity = await getEntity(sessionId, entityId);
    const updatedEntity = await developEntity({ sessionId, entityId, developmentPoints });

    const currentSubset = createEntitySubset(currentEntity);
    const updatedSubset = createEntitySubset(updatedEntity);

    summaryOfAction = `User chose to develop ${currentEntity.name}. Initial stats: ${currentSubset}. Developed stats: ${updatedSubset}.`;

  } else if (action_name === 'choose_another_deck') {
    const newDeck = getDeck(deckId);
    summaryOfAction = `User closed current deck ${currentDeck} and chose deck ${newDeck}.`;
    await setCurrentDeck(newDeck);

  } else if (action_name === 'flip_card') {
    entitiesIllustrationDescription = await generateIllustrationsForEntities(relevant_entities);
    summaryOfAction = `User flipped card(s) ${relevant_entities}. Revealed illustrations: ${entitiesIllustrationDescription}.`;

  } else if (action_name === 'acquire') {
    await acquireEntities(relevant_entities);
    summaryOfAction = `User chose to acquire entities: ${relevant_entities}.`;

  } else if (action_name === 'open_deck') {
    summaryOfAction = `User opened deck ${deckId}, revealing new cards.`;
  }

  // Call the storyteller seer to generate a narrative response.
  const { textualResponse, conciseNewEntitiesSummaryForGM } = await callforStorytellerSeer(
    fragment,
    summaryOfAction,
    currentDeck,
    relevant_entities
  );

  if (conciseNewEntitiesSummaryForGM) {
    await createNewEntities(sessionId, fragment, conciseNewEntitiesSummaryForGM);
  }

  return textualResponse;
}


// This function `generateIllustrationsForEntities` was defined above already.
// If it was meant to be a different function or an export, it needs clarification.
// Assuming it's the same internal helper function. If it needs to be exported, add 'export'.
// async function generateIllustrationsForEntities(entities, textures, sessionId, shouldMockImage) { ... }


export async function generateTextureOptionsByText1(sessionId, shouldMockImage=false, openAiMock=''){

  const fragment = await getFragment(sessionId)
  const allSessions = await getSessionChat(sessionId);
  const storytellerConversation = allSessions.filter((i)=> { return i.role != '2user'}).map((i, idx)=> {return `${idx}: ${i.content}`}).join("\n")

  const generateTexturesPrompt = generate_texture_by_fragment_and_conversation(fragment, storytellerConversation);
  const [entities, textureJsons] = await Promise.all([
    generateEntitiesFromFragment(sessionId, fragment),
    directExternalApiCall(generateTexturesPrompt, 2500, 1.03, openAiMock, false)
  ]);

  const mockEntities = [{
    "name": "Lotus Insignia",
    "ner_type": "Symbol",
    "ner_subtype": "Emblem",
    "importance": 5,
    "description": "A stylized lotus that appears both on the map and in an old painting in Elizabeth's living room, suggesting a deep connection to her family or past.",
    "lore": "The lotus insignia is a recurring symbol that may represent a family crest or a significant cultural or mystical emblem within the universe.",
    "attributes": ["symbolic", "recurring", "mystical"],
    "connections": [
      {
        "entity": "Mysterious Map",
        "type": "depicted_on"
      },
      {
        "entity": "Old Painting",
        "type": "depicted_on"
      }
    ],
    "universal_traits": ["mystical", "heritage-linked", "central"]
  }]
  
  // const textureJsons = [{
  //   "prompt": "Visualize a texture that embodies the essence of an ancient, weathered stone, akin to the crumbling walls of a forgotten manor, veiled in ivy. This texture suggests the passage of time, with etched symbols and faint, mystical runes that hint at hidden knowledge and lost stories. The color scheme is a blend of dusky greys and muted greens, reflecting the encroachment of nature over man-made structures. The edges of the card feature delicate, vine-like flourishes, subtly framing the texture in a way that enhances its ancient feel. This seamless, full-frame design captures the mystical and adventurous spirit of an RPG, blending elements of dark fantasy and the natural world.",
  //   "font": "Cinzel",
  //   "card_material": "Stone",
  //   "major_cultural_influences_references": ["GURPS Fantasy", "The Name of the Wind", "Pan's Labyrinth", "Gustave Doré"]
  // }, {
  //   "prompt": "Imagine a texture reminiscent of ancient parchment, marked with the wisdom of ages. This design incorporates ethereal, glowing sigils that seem to float above the surface, representing the arcane knowledge and secrets hidden within the universe. The background is a rich, aged cream with subtle variations in color, simulating the look of old paper that has traveled through time. Around the edges, intricate scrollwork and esoteric symbols blend seamlessly, inviting the viewer into a world of discovery and ancient magic. The texture is designed to evoke the feeling of holding a piece of history in your hand, a gateway to untold stories.",
  //   "font": "Merriweather",
  //   "card_material": "Parchment",
  //   "major_cultural_influences_references": ["Dungeons & Dragons", "The Dark Tower series", "The Witcher series", "Albrecht Dürer"]
  // }, {
  //   "prompt": "Envision a texture that captures the essence of deep, shadowy waters, reflecting the moonlight. This design features a fluid, shimmering surface, with colors shifting between dark blues and silver, embodying the mysterious and often treacherous nature of the storyteller's journey. Abstract shapes and swirls suggest the movement of water, with occasional glimpses of hidden depths below. The card's border is adorned with aquatic motifs and faint, luminescent runes, suggesting a connection to ancient maritime lore. This texture brings to life the eerie, contemplative moments beside the water, under a moonlit sky.",
  //   "font": "Alegreya",
  //   "card_material": "Ivory",
  //   "major_cultural_influences_references": ["Call of Cthulhu RPG", "The Shadow Over Innsmouth", "Pirates of the Caribbean", "Hokusai"]
  // }, {
  //   "prompt": "Craft a texture evoking a mystical forest scene, where the boundary between the natural and the supernatural blurs. The base is a rich tapestry of deep forest greens and earthy browns, overlaid with patterns that mimic the intricate weave of tree roots and branches. Embedded within the texture are symbols and icons that speak of ancient druidic rituals and the enduring spirits of the forest. The card's edges are detailed with leafy embellishments and fine, thorn-like flourishes, framing the design in a celebration of the wild, untamed aspects of nature. This texture invites the holder into a world where magic infuses every leaf and stone, a key to untold adventures.",
  //   "font": "Tangerine",
  //   "card_material": "Wood",
  //   "major_cultural_influences_references": ["The Elder Scrolls", "The Mists of Avalon", "Princess Mononoke", "John William Waterhouse"]
  // }]
  
  const textures = await Promise.all(textureJsons.map(async (textureJson, index) => {
    // Create a subfolder for the texture
    // {textureName: Str, DecorativeStyle:Str, description:String, font:String, artisticInfluences:[KeyWords], genre:Str. }
    // textureJson.category = getRandomCategory()
    textureJson.ner_subtype = entities[Math.min(index, entities.length - 1)].ner_subtype
    textureJson.category = entities[Math.min(index, entities.length - 1)].ner_type
    textureJson.universal_traits = entities[Math.min(index, entities.length - 1)].universal_traits
    textureJson.prompt = textureJSONToPrompt(textureJson)
    textureJson.prompt =  `"RPG collector card texture prompt category: ${textureJson.category}, subcategory:${textureJson.ner_subtype}, card attributes:${textureJson.universal_traits}:
     SEAMLESS. UNCUT FULL FRAME:"${textureJson.prompt} NO TEXT. ARTSTATION WINNER. FULL FRAME"!!`
    
    const subfolderPath = path.join(__dirname, '../../assets', `${sessionId}/textures/${Math.floor(Math.random() * 1000)}`);
    await ensureDirectoryExists(subfolderPath); // Use new async function

    // const url = await textToImageOpenAi(`${textureJson.prompt}. Seamless texture. Full Frame design. thick feel for the texture. real material: raw, grainy, cinematic, handheld, film quality, rough, rugged, time worn. inspiring. immersive. exciting. natural light. think of proper embellishments, flourishes. .unbroken. full frame design. surprising idiosyncertic backsdie a unique tarot deck. evidently used ..arcane, magical`, 1, `${subfolderPath}/${index}.png`, shouldMockImage);
    const url = await textToImageOpenAi(`${textureJson.prompt}. Seamless texture. Full Frame design. thick feel for the texture. inspiring. immersive. exciting. magical. think of proper embellishments, flourishes. .unbroken. full frame design. surprising idiosyncertic backsdie a unique tarot deck. evidently used ..arcane, magical`, 1, `${subfolderPath}/${index}.png`, shouldMockImage);
    // const url = await textToImageOpenAi(`CREATE AN RPG COLLECTOR CARD TEXTURE OUT OF THIS GUIDELINE JSON:${JSON.stringify(texturePrompt)}`, 1, `${subfolderPath}/${index}.png`, shouldMockImage);
    
    return {url, textureJson, index}
  }));
  await saveTextures(sessionId, textures)
  
  
  return textures;
}

// module.exports removed, functions are exported individually.

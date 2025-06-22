import fs from 'fs';
import mongoose from 'mongoose';
import * as fsPromises from 'fs/promises';
import { NarrativeFragment, ChatMessage } from '../models/models.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Local AI utility imports
import { generateStorytellerGuidance, generate_cards, generate_seer_response } from "../ai/openai/cardReadingPrompts.js";
import { 
  generate_texture_by_fragment_and_conversation, 
  directExternalApiCall, 
  generateMasterStorytellerChat, 
  generateMasterStorytellerConclusionChat, 
  askForBooksGeneration,
  generateStorytellerSummaryPropt, 
  generateStorytellerDetectiveFirstParagraphSession, 
  generateStorytellerDetectiveFirstParagraphLetter, 
  generate_entities_by_fragment 
} from "../ai/openai/promptsUtils.js";
import { textToImageOpenAi } from '../ai/textToImage/api.js';

// Import 'text' from express, aliasing if necessary (though its usage here is unusual)
import { text as expressText } from 'express';

// Setup __dirname and __filename for ES6 modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths using the new __dirname
const storytellerSessions = path.join(__dirname, 'db', 'storytelling.json');
const scriptTemplates = path.join(__dirname, 'script_templates', 'script_templates.json');
const sessionsScenes = path.join(__dirname, 'script_templates', 'sessions_scenes.json');
// const sessionDataStructre = {chat: [], fragment:'', textures:[], currentTexture:-1, character:[]}

export async function ensureDirectoryExists(dirPath) {
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Log the error or handle specific errors if needed, but mkdir with recursive:true
    // usually doesn't error if the directory already exists.
    // It might error for other reasons (e.g., permissions).
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error; // Re-throw the error if it's not an ignorable one
  }
}

export function mapEntity(rawEntity) {
  // Create a new object with the mapped keys.
  // For keys that exist in multiple forms (like universal_traits),
  // you might merge them.
  const normalized = {};

  // Basic info:
  normalized.name = rawEntity.name || 'Unnamed';
  normalized.description = rawEntity.description || '';
  normalized.lore = rawEntity.lore || '';
  normalized.session_id = rawEntity.session_id
  // Classification:
  normalized.type = rawEntity.ner_type || '';
  normalized.subtype = rawEntity.ner_subtype || '';

  // Traits & Attributes:
  // Merge both possible keys for universal traits.
  let traits = [];
  if (rawEntity.universal_traits) traits = traits.concat(rawEntity.universal_traits);
  if (rawEntity['universal traits']) traits = traits.concat(rawEntity['universal traits']);
  // Remove duplicates:
  normalized.universalTraits = Array.from(new Set(traits));
  
  normalized.attributes = rawEntity.attributes || {};
  normalized.connections = rawEntity.connections || {};
  normalized.clusterName = rawEntity.cluster_name || '';
  normalized.category = Array.isArray(rawEntity.category) ? rawEntity.category.join(',') : rawEntity.category || '';


  // Metrics & Costs:
  normalized.importance = Number(rawEntity.importance) || 0;
  normalized.xp = Number(rawEntity.xp) || 0;
  normalized.tileDistance = Number(rawEntity.tile_distance) || 0;
  normalized.familiarityLevel = Number(rawEntity.familiarity_level) || 0;
  normalized.reusabilityLevel = Number(rawEntity.reusability_level) || 0;
  normalized.relevance = rawEntity.relevance
  normalized.impact = rawEntity.impact
  normalized.developmentCost = rawEntity.developmentCost
  normalized.storytellingPointsCost = Number(rawEntity.storytelling_points_cost) || 0;
  normalized.urgency = rawEntity.urgency

  // Other/Additional:
  normalized.nextLevelSpecifically = rawEntity.next_level_specifically || null;
  normalized.hooks = rawEntity.hooks || null;
  normalized.specificity = rawEntity.specificity || null;
  normalized.externalId = rawEntity.id ? String(rawEntity.id) : '';
  normalized.turn = rawEntity.turn || null;
  normalized.skillsAndRolls = rawEntity.skills_and_rolls || null;
  normalized.evolutionState = rawEntity.evolution_state || '';
  normalized.evolutionNotes = rawEntity.evolution_notes || '';

  return normalized;
}



const entitySchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  
  // Basic Info
  name: { type: String, required: true },
  description: { type: String },
  lore: { type: String },
  
  // Classification/Type Info
  type: { type: String },           // from ner_type
  subtype: { type: String },        // from ner_subtype
  
  // Traits & Attributes
  universalTraits: { type: [String] },  // merging "universal_traits" and "universal traits"
  attributes: { type: mongoose.Schema.Types.Mixed },
  connections: { type: mongoose.Schema.Types.Mixed },
  clusterName: { type: String },    // from cluster_name
  category: { type: String },
  
  // Metrics & Costs
  importance: { type: Number },
  xp: { type: Number },
  tileDistance: { type: Number },   // from tile_distance
  familiarityLevel: { type: Number },
  reusabilityLevel: { type: Number },
  relevance: { type: String },
  impact: { type: String },
  developmentCost: { type: String },
  storytellingPointsCost: { type: Number },
  urgency: { type: String },
  
  // Other/Additional Data
  nextLevelSpecifically: { type: mongoose.Schema.Types.Mixed },
  hooks: { type: mongoose.Schema.Types.Mixed },
  specificity: { type: mongoose.Schema.Types.Mixed },
  externalId: { type: String },     // from id (renamed to avoid conflict)
  turn: { type: mongoose.Schema.Types.Mixed },
  skillsAndRolls: { type: mongoose.Schema.Types.Mixed },
  evolutionState: { type: String },
  evolutionNotes: { type: String }
});

export const NarrativeEntity = mongoose.model('NarrativeEntity', entitySchema);

const narrativeTextureSchema = new mongoose.Schema({
    session_id: { type: String, required: true },
    texture: { type: String },
    localPath: { type: String },
    prompt: { type: String },
    font: { type: String },
    card_material: { type: String },
    major_cultural_influences_references: { type: [String] },
    category: { type: String },
    ner_subtype: { type: String },
    ner_type: { type: String },
    universal_traits: { type: [String] },
    archetype: { type: String },
    defined_archetype: { type: String },
    id: { type: String },
    font_size: { type: String },
    font_color: { type: String },
    text_for_entity: { type: String }
  });
  
export const NarrativeTexture = mongoose.model('NarrativeTexture', narrativeTextureSchema);

/**
 * @typedef {object} TypewriterKey
 * @property {string} symbol - The symbol on the typewriter key.
 * @property {string} description - A description of the typewriter key.
 */

/**
 * @typedef {object} VoiceCreation
 * @property {string} voice - The voice type (e.g., 'female', 'male', 'androgynous').
 * @property {string} age - The apparent age or age range of the voice (e.g., 'late 20s', 'ancient').
 * @property {string} style - Descriptive style of the voice (e.g., 'calm, luminous', 'gruff, mechanical').
 */

/**
 * Represents a Storyteller profile.
 * This is the structure expected to be stored in MongoDB and returned by the API.
 * @typedef {object} StorytellerProfile
 * @property {string} name - The unique name of the storyteller.
 * @property {string} immediate_ghost_appearance - A description of the storyteller's initial manifestation.
 * @property {TypewriterKey} typewriter_key - Details about the storyteller's unique typewriter key.
 * @property {string[]} influences - An array of influential works, authors, or concepts.
 * @property {string[]} known_universes - An array of universe names or tags this storyteller is associated with.
 * @property {number} level - A numerical level or power indicator for the storyteller.
 * @property {VoiceCreation} voice_creation - Details about the storyteller's voice characteristics.
 */
// Storyteller Schema
const StorytellerSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  immediate_ghost_appearance: { type: String },
  typewriter_key: {
    symbol: { type: String },
    description: { type: String }
  },
  influences: { type: [String] },
  known_universes: { type: [String] },
  level: { type: Number },
  voice_creation: {
    voice: { type: String },
    age: { type: String },
    style: { type: String }
  }
});
export const Storyteller = mongoose.model('Storyteller', StorytellerSchema);

export async function generate_storyteller(fragment, universe_tags, influences, excluded_names = []) {
  const mockStorytellerPath = path.join(__dirname, 'db', 'mock_storytellers.json');
  let storytellerProfile;

  const readMockStorytellersAndSelectOne = async () => {
    try {
      const data = await fsPromises.readFile(mockStorytellerPath, 'utf8');
      let profiles = JSON.parse(data);
      if (Array.isArray(excluded_names) && excluded_names.length > 0) {
        profiles = profiles.filter(profile => !excluded_names.includes(profile.name));
      }
      if (profiles.length === 0) {
        console.error("No storyteller profiles available after filtering.");
        return null;
      }
      return profiles[Math.floor(Math.random() * profiles.length)];
    } catch (error) {
      console.error("Error reading or parsing mock_storytellers.json:", error);
      throw error;
    }
  };

  if (process.env.MOCK_STORYTELLER_MODE === 'true' || process.env.ENABLE_LLM_STORYTELLER !== 'true') {
    console.log("Using mock storyteller generation logic.");
    storytellerProfile = await readMockStorytellersAndSelectOne();
  } else {
    // LLM API Call Logic (currently stubbed to use mock data)
    const prompt = `--- LLM PROMPT ---
Generate a unique storyteller profile.
Fragment context: ${fragment}
Universe Tags: ${Array.isArray(universe_tags) ? universe_tags.join(', ') : universe_tags}
Influences: ${Array.isArray(influences) ? influences.join(', ') : influences}
Excluded Names: ${Array.isArray(excluded_names) ? excluded_names.join(', ') : excluded_names}
Expected JSON Structure: { name, immediate_ghost_appearance, typewriter_key: {symbol, description}, influences, known_universes, level, voice_creation: {voice, age, style} }
--- END LLM PROMPT ---`;
    console.log(prompt);

    console.log("LLM Storyteller generation is stubbed. Using mock data for now.");
    storytellerProfile = await readMockStorytellersAndSelectOne();
  }

  if (storytellerProfile) {
    try {
      const savedStoryteller = await Storyteller.findOneAndUpdate(
        { name: storytellerProfile.name },
        storytellerProfile,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log('Storyteller profile upserted to MongoDB:', savedStoryteller.name);
    } catch (error) {
      console.error('Error upserting storyteller profile to MongoDB:', error);
      // Depending on requirements, you might want to throw error or handle it differently
      // For now, we log the error and proceed to return the originally fetched/generated profile
    }
  }

  // TODO: Future Vector DB Integration
  // If a vector database is in use, the storyteller profile (or relevant parts)
  // would also be processed and upserted/indexed here.
  // For example: await upsertToVectorDB(storytellerProfile);

  return storytellerProfile;
}

// New Schemas and Models

// SessionState Schema
const SessionStateSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  turn: { type: Number, default: 0 },
  currentTextureId: { type: String }, // For chooseTextureForSessionId
  textures: [mongoose.Schema.Types.Mixed], // For setTexture
  chatHistory: [mongoose.Schema.Types.Mixed], // For setChatSessions
  detectiveHistory: [mongoose.Schema.Types.Mixed], // For setSessionDetectiveCreation
  characterCreationData: [mongoose.Schema.Types.Mixed], // For setCharecterCreation & setCharacterCreationQuestionAndOptions
  discussionSummary: { type: String }, // For getPreviousDiscussionSummary
  lastUpdatedAt: { type: Date, default: Date.now }
});
export const SessionState = mongoose.model('SessionState', SessionStateSchema);

// SceneTemplate Schema (Note: This seems more like for pre-defined templates, write operations are not specified for this in the task)
const SceneTemplateSchema = new mongoose.Schema({
  sceneName: { type: String, required: true, unique: true },
  sceneGeneralDirectionGuideline: { type: String },
  necessaryBackground: { type: String },
  description: [mongoose.Schema.Types.Mixed],
  promptFunction: { type: String },
  order: { type: Number }
});
export const SceneTemplate = mongoose.model('SceneTemplate', SceneTemplateSchema);

// SessionSceneState Schema
const SessionSceneStateSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  sceneName: { type: String, required: true }, // Added as it's likely needed context
  currentStep: { type: Number, default: 0 },
  currentOrder: { type: Number, default: 0 },
  currentInfluences: {type: mongoose.Schema.Types.Mixed},
  lastUpdatedAt: { type: Date, default: Date.now }
});
export const SessionSceneState = mongoose.model('SessionSceneState', SessionSceneStateSchema);

// GeneratedContent Schema (Note: Write operations are not specified for this in the task)
const GeneratedContentSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, index: true },
  contentType: { type: String, enum: ['prefix', 'image_prompt', 'story_continuation'] },
  contentData: mongoose.Schema.Types.Mixed,
  turn: { type: Number },
  createdAt: { type: Date, default: Date.now }
});
export const GeneratedContent = mongoose.model('GeneratedContent', GeneratedContentSchema);


// Connect to MongoDB (adjust connection string as needed)
mongoose.connect('mongodb://localhost:27017/storytelling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log("Connected to MongoDB.");
}).catch(err => {
  console.error("MongoDB connection error:", err);
});

export async function getSessionTextures(sessionId){
  allData = await getStorytellerDb()
  if (!allData[sessionId]) {
      allData[sessionId] = initSessionDataStructure()
  }
  return allData[sessionId].textures

}


export const setTexture = async (sessionId, texture) => {
  // Refactored to use MongoDB
  try {
    await SessionState.findOneAndUpdate(
      { sessionId: sessionId },
      { 
        $push: { textures: texture },
        $set: { lastUpdatedAt: new Date() } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(`Error in setTexture for sessionId ${sessionId}:`, error);
    throw error;
  }
};


export async function saveTextures(sessionId, textures){
  try {

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
      if (texture.hasOwnProperty('font_size')) {
        texture.font_size = String(texture.font_size);
      }
      if (texture.hasOwnProperty('archetype')) {
        texture.archetype = String(texture.archetype);
      }
      
      return {id: Math.random().toString(36).substring(2, 10), session_id: sessionId, ...texture}})
    
    const entities = await NarrativeTexture.insertMany(
      textures
    );
    console.log("created textures:", textures);
    return entities;
  } catch (error) {
    console.error("Error creating textures:", error);
    throw error;
  }
}

export async function chooseTextureForSessionId(sessionId, textureId){
  // Refactored to use MongoDB
  try {
    await SessionState.findOneAndUpdate(
      { sessionId: sessionId },
      { 
        $set: { currentTextureId: textureId, lastUpdatedAt: new Date() } 
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(`Error in chooseTextureForSessionId for sessionId ${sessionId}:`, error);
    throw error;
  }
}

export async function getChosenTexture(sessionId){
  allData = await getStorytellerDb()
  return allData[sessionId].textures.find((texture) => { return texture.index == allData[sessionId].currentTexture})
}


// The setFragment function: update if exists, or insert a new document.
export async function setFragment(sessionId, fragment, turn) {
  try {
    // Find a document by session_id and turn, update its fragment,
    // or create a new document if none exists.
    const updatedDoc = await NarrativeFragment.findOneAndUpdate(
      { session_id: sessionId, turn: turn },      // Query: match session_id and turn
      { $set: { fragment: fragment } },             // Update: set the fragment field
      { new: true, upsert: true }                   // Options: return the new doc, upsert if not found
    );
    console.log("Fragment set:", updatedDoc);
    return updatedDoc;
  } catch (error) {
    console.error("Error setting fragment:", error);
    throw error;
  }
}

export async function getFragment(sessionId, turn) {
  try {
    // Find a document by session_id and turn, update its fragment,
    // or create a new document if none exists.
    const fragment = await NarrativeFragment.findOne(
      { session_id: sessionId, turn: turn },      // Query: match session_id and turn
      
    );
    fragment_text = fragment.fragment
    console.log(`Got Fragment: ${fragment_text}`);
    return fragment_text;
  } catch (error) {
    console.error("Error setting fragment:", error);
    throw error;
  }
}


export const setEntitiesForSession = async(sessionId, jsonEntities) => {
  try {
    // Find a document by session_id and turn, update its fragment,
    // or create a new document if none exists.
    jsonEntities = jsonEntities.map( e => { return mapEntity(e)})
    const entities = await NarrativeEntity.insertMany(
      jsonEntities
    );
    console.log("created entity:", entities);
    return entities;
  } catch (error) {
    console.error("Error creating entities:", error);
    throw error;
  }
}

  
export async function getEntitiesForSession(sessionId) {
    try {
      // Find a document by session_id and turn, update its fragment,
      // or create a new document if none exists.
      const entities = await NarrativeEntity.find(
        { session_id: sessionId },      // Query: match session_id and turn
        
      );
      console.log(`Got Entites: ${entities}`);
      return fragment;
    } catch (error) {
      console.error("Error getting entities:", error);
      throw error;
    }
  }



// Example usage:
// setFragment("session1", { content: "New narrative fragment content" }, 1)
//   .then(doc => console.log("Operation successful:", doc))
//   .catch(err => console.error("Operation failed:", err));


export const getStorytellerDb = async (storagePath=storytellerSessions) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };
  export const getScenesDb = async (storagePath=scriptTemplates) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };

  export const getSessionssDb = async (storagePath=sessionsScenes) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };
  export const setChatSessions = async (sessionId, chatSession) => {
    // Refactored to use MongoDB
    try {
      await SessionState.findOneAndUpdate(
        { sessionId: sessionId },
        { 
          $set: { chatHistory: chatSession, lastUpdatedAt: new Date() } 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      console.error(`Error in setChatSessions for sessionId ${sessionId}:`, error);
      throw error;
    }
  };

  // const setEntitiesForSession = async(sessionId, entities) => {
  //   allData = await getStorytellerDb();
  //   if (!allData[sessionId]) {
  //     allData[sessionId] = initSessionDataStructure()
  //   }
  //   allData[sessionId].entities = entities
  //   await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));

  // }

  // const getEntitiesForSession = async(sessionId) =>{
  //   allData = await getStorytellerDb();
  //   if (!allData[sessionId]) {
  //     allData[sessionId] = initSessionDataStructure()
  //   }
  //   return allData[sessionId].entities
  // }

  export const setSessionDetectiveCreation = async (sessionId, detectiveHistory) => {
    // Refactored to use MongoDB
    try {
      await SessionState.findOneAndUpdate(
        { sessionId: sessionId },
        { 
          $set: { detectiveHistory: detectiveHistory, lastUpdatedAt: new Date() } 
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      console.error(`Error in setSessionDetectiveCreation for sessionId ${sessionId}:`, error);
      throw error;
    }
  };

  // async function setFragment(sessionId, fragment){
  //   allData = await getStorytellerDb()
  //   if (!allData[sessionId]) {
  //       allData[sessionId] = initSessionDataStructure()
  //   }
  //   allData[sessionId].fragment = fragment
  //   await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  // }
  

  // async function getFragment(sessionId){
  //   allData = await getStorytellerDb()
  //   return allData[sessionId].fragment
  // }


  export async function updateTurn(sessionId){
    // Refactored to use MongoDB
    try {
      const updatedSession = await SessionState.findOneAndUpdate(
        { sessionId: sessionId },
        { 
          $inc: { turn: 1 },
          $set: { lastUpdatedAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return updatedSession.turn;
    } catch (error) {
      console.error(`Error in updateTurn for sessionId ${sessionId}:`, error);
      // Decide on error handling: throw or return a default/error indicator
      throw error; 
    }
  }

  export async function getTurn(sessionId){
    allData = await getStorytellerDb()
    return allData[sessionId].turn
  }


  export function saveTextureToFileSystem(sessionId, texturePrompt, index){
    const subfolderPath = path.join(__dirname, '../assets', String(sessionId));
    const textureSubfolderName = `texture_${index}_${Math.floor(Math.random() * (100) + 1)}`;
    const textureSubfolderPath = path.join(subfolderPath, textureSubfolderName);
    
    if (!fs.existsSync(textureSubfolderPath)){ 
      fs.mkdirSync(textureSubfolderPath);
    }
    
    fs.writeFileSync(path.join(textureSubfolderPath, 'texture_prompt.json'), JSON.stringify(texturePrompt));
  }

  export function saveFragmentToFileSystem(sessionId, fragment){
    const subfolderPath = path.join(__dirname, '../assets', String(sessionId));
  
    if (!fs.existsSync(subfolderPath)){
      fs.mkdirSync(subfolderPath);
    }
  
    fs.writeFileSync(path.join(subfolderPath, 'original_prompt.txt'), fragment);
    return subfolderPath
  }
  
  // There are two definitions of saveFragment. Removing the first one.
  // async function saveFragment(sessionId, fragment, turn){
  //   saveFragmentToFileSystem(sessionId, fragment)
  //   await setFragment(sessionId, fragment)
  // }

  export async function saveFragment(sessionId, fragment, turn){
    await setFragment(sessionId, fragment, turn)
  }
  

  export function initSessionDataStructure(){
    return  {entities: [], chat: [], fragment:'', textures:[], currentTexture:-1, character: [], detective:[],
    discussion_summary: '', turn:0};
  }
  
  export async function getSessionChat(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].chat
  }

  export async function getSessionDetectiveCreation(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].detective
  }

  export async function getCharacterCreation(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].charecter
  }

  export const setCharecterCreation = async (sessionId, characterSession) => {
    // Refactored to use MongoDB
    try {
      await SessionState.findOneAndUpdate(
        { sessionId: sessionId },
        { 
          $set: { characterCreationData: characterSession, lastUpdatedAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      console.error(`Error in setCharecterCreation for sessionId ${sessionId}:`, error);
      throw error;
    }
  };


  
  export async function setCharacterCreationQuestionAndOptions(sessionId, data){
    // Refactored to use MongoDB
    try {
      await SessionState.findOneAndUpdate(
        { sessionId: sessionId },
        { 
          $push: { characterCreationData: data },
          $set: { lastUpdatedAt: new Date() }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (error) {
      console.error(`Error in setCharacterCreationQuestionAndOptions for sessionId ${sessionId}:`, error);
      throw error;
    }
  }

  export async function getCharacterCreationSession(sessionId){
    allData = await getStorytellerDb()
    if(! allData[sessionId].character)
      allData[sessionId].character = []
   return allData[sessionId].character
 }

 export async function getPreviousDiscussionSummary(sessionId){
    // Read part remains from JSON for now
    let allData = await getStorytellerDb(); // This still reads from JSON
    if (!allData[sessionId] || !allData[sessionId].discussion_summary) {
        const previousDiscussion = await getSessionChat(sessionId); // Reads from JSON
        const discussionText = previousDiscussion.map((i) => { return i.content }).join("\n");
        const originalFragment = await getFragment(sessionId); // Reads from DB
        const texture = await getChosenTexture(sessionId); // Reads from JSON

        const summarize_prompt = generateStorytellerSummaryPropt(discussionText, originalFragment, texture.url.revised_prompt);
        const summary_resp = await directExternalApiCall([{ role: 'system', content: summarize_prompt }], 2500, 1);
        
        // Write part refactored to MongoDB
        try {
            await SessionState.findOneAndUpdate(
                { sessionId: sessionId },
                { 
                  $set: { discussionSummary: summary_resp, lastUpdatedAt: new Date() }
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (error) {
            console.error(`Error saving discussionSummary to DB for sessionId ${sessionId}:`, error);
            // Decide if we should throw or perhaps still update the JSON as a fallback / log error
        }
        // For consistency with the task (reads from JSON), update the in-memory allData for current call
        if (!allData[sessionId]) allData[sessionId] = initSessionDataStructure();
        allData[sessionId].discussion_summary = summary_resp;
        // await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData)); // Original JSON write, removed as per task for this specific field
        return summary_resp; // Return the newly generated summary
    }
    return allData[sessionId].discussion_summary; // Return summary from JSON if already present
 }
  

// async function chatWithstoryteller(sessionId, fragmentText, userInput='', mockedStorytellerResponse=null){

//     const chatHistory = await getSessionChat(sessionId);
//     let masterResponse
//     // Save user input with role
//     if (userInput) {
//         chatHistory.push({ role: 'user', content: userInput });
//     }

    
//     if (chatHistory.filter((c)=> {return c.role =='system'}).length  <= 4) {
//         const prompts = generateMasterStorytellerChat(fragmentText);
//         masterResponse = await directExternalApiCall(prompts.concat(chatHistory), 2500, 1, mockedStorytellerResponse);

//         // Save master response with role
//         if (masterResponse) {
//             chatHistory.push({ role: 'system', content: masterResponse });
//         }
//     } else if (chatHistory.filter((c)=> {return c.role =='master'}).length  === 5) {
//         const conclusionPrompts = generateMasterStorytellerConclusionChat(previousMessages);
//         const resFromExternalApi = await directExternalApiCall(conclusionPrompts);
//         const { storyteller_response: masterResponse } = resFromExternalApi;

//         // Save master response with role
//         if (masterResponse) {
//             chatHistory.push({ role: 'system', content: masterResponse });
//         }
//     }
//     await setChatSessions(sessionId, chatHistory);
//     return masterResponse;
// }


// Function 1: Generate Texture Descriptions (Text-to-Text)
export async function generateTexturesTextToText(sessionId, fragment, storytellerConversation, subset, openAiMock) {
    const generateTexturesPrompt = generate_texture_by_fragment_and_conversation(fragment, storytellerConversation, subset);
    let textureJsons = await directExternalApiCall(generateTexturesPrompt, 2500, 1.03, openAiMock, true, true);

    if (textureJsons.textures) {
        textureJsons = textureJsons.textures;
    }

    if (!textureJsons || textureJsons.length === 0) {
        throw new Error("No textures generated.");
    }

    return textureJsons;
}

// createDirectorySafely is already defined above and exported.
// function createDirectorySafely(directoryPath) {
//   try {
//     if (!fs.existsSync(directoryPath)) {
//       fs.mkdirSync(directoryPath, { recursive: true });
//     }
//   } catch (error) {
//     console.error(`Error creating directory: ${directoryPath}`, error);
//     throw error;
//   }
// }


// Function 2: Convert Texture Descriptions to Images (Text-to-Image)
export async function generateTexturesTextToImage(sessionId, textureJsons, shouldMockImage) {
  // Assuming textToImageOpenAi is available in the current scope (it's imported from ../ai/textToImage/api.js)
  // const { textToImageOpenAi } = require('../ai/textToImage/api'); // This line would be problematic in ES6
    return await Promise.all(textureJsons.map(async (textureJson, index) => {
        const id = index; // Assign a unique ID (could also use a UUID generator)
        textureJson.id = id; // Add the ID to the texture

        const subfolderPath = path.join(__dirname, '../../assets', `${sessionId}/textures/${id}`);
        createDirectorySafely(subfolderPath);

        const url = await textToImageOpenAi(
            `worn old and decayed RPG card texture titled: ${textureJson.text_for_entity}  written in this font (${textureJson.font})...made out of 
            ${textureJson.card_material}. try to think how you can use the archetype: ${textureJson.archetype} and define it in the texture illustration:
            work from the material itself. as if a master craftsman is doing it with proper tools.
            This is the overall texture description: ${textureJson.prompt}. Immerse yourself in it. 

            - Seamless RPG card texture (Full Frame Design)
            - Thick feel for the texture.
            - Inspiring. Immersive. Exciting. Magical.
            - Proper embellishments, flourishes, filigrees, and frames.
            - Evidently used, arcane, magical.
            - The most important thing: FULL FRAME! Rugged, worn, deteriorated state, grainy, raw! Natural light.
            - NOTHING but the title: ${textureJson.text_for_entity} written on the card. Rough, raw, feel the material. 
            - FULL FRAME. NO TEXT but the title!!! UNBROKEN.

            `,
            1,
            `${subfolderPath}/${id}.png`,
            shouldMockImage
        );

        return { url, textureJson };
    }));
}


export async function generateTextures(sessionId, fragment, storytellerConversation, subset, openAiMock, shouldMockImage) {
  // Step 1: Generate Text-based Texture Descriptions
  const textureJsons = await generateTexturesTextToText(sessionId, fragment, storytellerConversation, subset, openAiMock);

  // Step 2: Convert Textures to Images
  const textures = await generateTexturesTextToImage(sessionId, textureJsons, shouldMockImage);

  // Step 3: Save Textures to Database
  await saveTextures(sessionId, textures);

  return textures;
}

export async function chatWithStoryteller(sessionId, fragmentText, userInput = '', mockedStorytellerResponse = null) {
  let chatHistory = await getSessionChat(sessionId);
  let masterResponse;

  // Save user input with role
  if (userInput) {
      chatHistory.push({ role: 'user', content: userInput });
  }

  // Determine progress in the conversation
  const systemMessages = chatHistory.filter((c) => c.role === 'system').length;

  if (systemMessages <=2) {
      // **Phase 1: Storyteller Seer Introduction (Initial Insight)**
      const prompts = generateMasterStorytellerChat(fragmentText);
      masterResponse = await directExternalApiCall(prompts.concat(chatHistory), 2500, 1, mockedStorytellerResponse);
      
      chatHistory.push({ role: 'system', content: masterResponse });

  } else if (systemMessages === 3) {



    const entitiesApiResponse = await generateEntitiesFromFragment(sessionId, fragmentText, 1);
      let coreEntities = entitiesApiResponse.map(e => ({
          name: e.name,
          ner_type: e.ner_type,
          ner_subtype: e.ner_subtype,
          description: e.description,
          relevance: e.relevance
      }));
      coreEntities = JSON.stringify(coreEntities);

      // Generate world textures at this stage, ensuring more narrative substance
      const textures = await generateTextures(sessionId, fragmentText, masterResponse, coreEntities, false, false);
      chatHistory.push({ role: 'entities', content: coreEntities });
      chatHistory.push({ role: 'textures', content: textures });
      
      // **Phase 3: Secondary Entities & World Expansion**
      const secondaryEntitiesResponse = await generateEntitiesFromFragment(sessionId, fragmentText, 2, coreEntities);
      let secondaryEntities = secondaryEntitiesResponse.map(e => ({
          name: e.name,
          ner_type: e.ner_type,
          ner_subtype: e.ner_subtype,
          description: e.description,
          relevance: e.relevance
      }));
      secondaryEntities = JSON.stringify(secondaryEntities);

      chatHistory.push({ role: 'secondary_entities', content: secondaryEntities });
      const relevantChat = chatHistory.filter((c)=> {return (c.role =='system' || c.role =='user')})
      // Generate deeper Seer observations based on new world knowledge
      const prompts = generateMasterStorytellerChat(fragmentText);
      
      const refinedStorytellerGuidancePrompt = generateStorytellerGuidance(fragmentText, chatHistory);
      const allPrompts = prompts.concat(relevantChat).concat(refinedStorytellerGuidancePrompt)
      masterResponse = await directExternalApiCall(allPrompts, 2500, 1, mockedStorytellerResponse);
      
      chatHistory.push({ role: 'system', content: masterResponse });

  } else {
      // **Phase 4: Cards Reveal (Memory Visions & Constellations)**
      if (!chatHistory.some(c => c.role === 'cards')) {
          // Use both primary & secondary entities to form a meaningful card constellation
          const entities = JSON.parse(chatHistory.find(c => c.role === 'entities').content);
          const secondaryEntities = JSON.parse(chatHistory.find(c => c.role === 'secondary_entities').content);
          const textures = JSON.parse(chatHistory.find(c => c.role === 'textures').content);
          const texture = textures[Math.floor(Math.random() * textures.length)];
          const cardsJson = await generate_cards(fragmentText, chatHistory, [...entities, ...secondaryEntities], texture);
          chatHistory.push({ role: 'cards', content: JSON.stringify(cardsJson) });
      }

      // Generate Seer’s response to the cards
      const cardsJson = JSON.parse(chatHistory.find(c => c.role === 'cards').content);
      const seerResponse = await generate_seer_response(cardsJson, texture);

      chatHistory.push({ role: 'system', content: seerResponse });
      masterResponse = seerResponse;
  }

  await setChatSessions(sessionId, chatHistory);
  return masterResponse;
}

export async function generateEntitiesFromFragment(sessionId, fragmentText, turn=1, existinEntities){
  const maxEntities = 8
  let commonEntities = []
  if(process.env["MOCK_ENTIITIES"] == 'true')
    commonEntities = [{"id":"ru6k9uuw","turn":4,"familiarity_level":4,"reusability_level":"High fantasy setting","ner_type":"LOCATION","ner_subtype":"Volcanic Crater","description":"An immense volcanic crater shrouded in dense fog, with glimpses of a lush jungle within its depths.","name":"Fogbound Crater","relevance":"The crater is the central location of the narrative fragment, representing both a destination and a mystery.","impact":"Potentially hiding ancient secrets or dangers, it presents exploration opportunities and environmental challenges.","skills_and_rolls":["Survival","Perception","Nature Lore"],"development_cost":"5, 10, 15, 20","storytelling_points_cost":18,"urgency":"Immediate","connections":["Kimia","Elivirio","Ancient stone markers"],"tile_distance":0,"evolution_state":"New","evolution_notes":"Introduced as a major narrative location."},{"id":"t00uky8x","turn":4,"familiarity_level":3,"reusability_level":"Jungle exploration","ner_type":"FLORA","ner_subtype":"Exotic Jungle","description":"A lush jungle teeming with vibrant plant life, hidden within the crater.","name":"Crater Jungle","relevance":"The jungle is a potential source of resources or clues within the crater.","impact":"Offers opportunities for foraging and discovery, but may also hide dangers.","skills_and_rolls":["Botany","Stealth","Tracking"],"development_cost":"5, 10, 15, 20","storytelling_points_cost":15,"urgency":"Near Future","connections":["Fogbound Crater"],"tile_distance":1,"evolution_state":"New","evolution_notes":"Revealed as part of the crater's interior."},{"id":"myxshov9","turn":4,"familiarity_level":5,"reusability_level":"Fantasy characters","ner_type":"PERSON","ner_subtype":"Guide","description":"A character with long black braided hair, knowledgeable about the crater's secrets.","name":"Elivirio","relevance":"Elivirio is a guide and key figure in navigating the crater, holding knowledge about its hidden paths.","impact":"His knowledge is crucial for progress, potentially unlocking new paths or lore.","skills_and_rolls":["Navigation","Lore","Persuasion"],"development_cost":"5, 10, 15, 20","storytelling_points_cost":8,"urgency":"Immediate","connections":["Kimia","Fogbound Crater"],"tile_distance":0,"evolution_state":"Expanded","evolution_notes":"Further developed as a knowledgeable guide character."},{"id":"310xnsfn","turn":4,"familiarity_level":4,"reusability_level":"Archaeological sites","ner_type":"ITEM","ner_subtype":"Ancient Marker","description":"Half-buried stone markers with worn symbols, hinting at ancient civilizations.","name":"Volcanic Markers","relevance":"These markers potentially reveal the history of the crater and guide adventurers.","impact":"Could lead to new discoveries or unlock hidden areas within the crater.","skills_and_rolls":["Archaeology","History","Decipher Script"],"development_cost":"5, 10, 15, 20","storytelling_points_cost":12,"urgency":"Near Future","connections":["Fogbound Crater","Elivirio"],"tile_distance":1,"evolution_state":"New","evolution_notes":"Introduced as elements of historical significance."},{"id":"1k4jsfkh","turn":4,"familiarity_level":3,"reusability_level":"Geological features","ner_type":"CONCEPT","ner_subtype":"Natural Phenomenon","description":"Thick fog that blankets the crater, obscuring visibility and adding mystery.","name":"Fog Blanket","relevance":"The fog adds an element of mystery and challenge to the exploration of the crater.","impact":"Limits visibility, creating navigation challenges and atmospheric tension.","skills_and_rolls":["Survival","Navigation","Perception"],"development_cost":"5, 10, 15, 20","storytelling_points_cost":10,"urgency":"Immediate","connections":["Fogbound Crater","Crater Jungle"],"tile_distance":0,"evolution_state":"New","evolution_notes":"Introduced as an environmental condition affecting exploration."}]
  else {
    const prompts = generate_entities_by_fragment(fragmentText, maxEntities);
    if(! existinEntities)
      existinEntities = []
    const  response = await directExternalApiCall(prompts.concat(existinEntities), max_tokens = 6000, temperature=0.7, mockedResponse=null, explicitJsonObjectFormat=true, isOpenAi=true);
    let { clusters, entities} = response
    if(entities.card_backs){
      entities = entities.card_backs
    }
    commonEntities = entities
  }

  commonEntities = commonEntities.map(e => {
    return {
        id: Math.random().toString(36).substring(2, 10), // Generate a random string
        turn: turn,
        ...e,
        session_id: sessionId,
    };
  });
  
  await setEntitiesForSession(sessionId, commonEntities);
  return commonEntities
  
}



export function storytellerDetectivePrologueScene(){
  return `And so, it became to be that it was  ___ (1. a term that describes the time , like: "almost midnight", "right about noon", "in the thick fog of an early morning", "just as the sun began to set", "the early hours of morning", "half past 4 in the afternoon ", time of day, e.g., night/dark/noon) as the storyteller detective finally approached  ___ (2.a/an/the FOUND_ structure that stands out in where it's located, it's a rather an unusual place to find such a structure. how it relates to the specificity of the surroundings).  it was  ___ (3. more specific description, based on knowledge and synthesis, also mentioning the material/materials and physicality of the structure) 
  " ___" (4. (direct speech of the storyteller detective) + (verb: how the detective said it). direct speech: a subjective observative given by a very specific storyteller detective, who finally reaches to that specific structure and reacts differently to it . referencing about that structure, in the specificity of this location and also in the more wider surroundings) 
  as ___ (5. pronoun: he/she/they (determines gender))  ___ (6. specific single word verb indicating dismounting or stopping a very specific mode of transportation the storyteller detective used to get here), 
  ___ (pronoun based on previously chosen gender (5)- so it should be known ) ___ (7. action of securing a very distinct mode of  transportation and a short yet descriptive and detailedof the mode of transportation). 
  Then, taking ___ (8. object/s from a storage item, e.g., backpack), ___ (pronoun) proceeded 
  to ___ (9. action indicating moving deeper into the location, looking for a specific place where that item/items from the storage should be used).
  __(10.something that catches the detective's attention in the location and structure that suggests something unexpected) . " ____(11. direct speech by the storyteller detective reacting to (10) and how it gave  the understanding of the immediate urgency following in which finding the book in here, and references to the detective's attitude and character in the light of that ) might be?"`
}

export function getSpecificGuidlineForStep(stepNo){
  if(stepNo == 2)
    return `(next choise: 2.FOUND_ OBJECT/PHENOMENON/STRUCTURE/RELIC - now for this choice, give a first impression, crude, a raw glimpse, vague, what it seems to be like....but whatever you choose, always remain CONCRETE in your description, and images. FACTUAL, GROUNDED, NO GENERIC BANALIC SUPERFICIAL IMAGERY!! DO NOT INTERPRET, JUST OBSERVE! BE Himengway) `
  else if(stepNo == 9)
    return `[specific guideline for choice 9: introduce the storyteller detective's voice, revealing their gender. This moment captures the detective's first detailed observation, characterized by their unique perspective and minimal but profound commentary. Emphasize the detective's deep knowledge, deductive reasoning, and the significance of their findings through a memorable, distinct character expression. just very few words, that have a whole breadth of knowledge and deduction and assumptions behind themץ Use specific, concise language REFRAIN FROM ANY GENERIC COMMENTING. use body gestures to convey the detective's interaction with their discovery, making their character and insights vivid and impactful. Aim for a strong, quirky character moment that stands out. refrain from any metaphors that aren't grounded, factual, and specific.  don't be shy of mentioning specific names, locations, events, assertions, deductions! we should feel we stumble into an already existing universe(though not exactly ours...could be alternative history one of earth or completely different). the storyteller detective notices something very specific. he/she/they make a very careful precise observation and following deduction] `
  else
    return `(ensure the seamless direct continuation and the logic of the current narrative. you may make fine adjustments to the script template to ensure the cohesive and natural seamless unfolding of the narrative! make it captivating!all options should be grounded, show don't tell. don't interpret. remain using the senses and factual facts. minimalism and subtle suggestion is ALWAYS ADVISED!)`
}

export function journalEntryTemplateScene(){
  return `But instead of getting right in, the storyteller detective took out what seemed to be like a ___(1. material, or texture, or a sequence of adjectives verbs describing the physicality of the journal)  journal. it was worn. she skimmed it fast, back and forth, until she found the page she was looking for: and then as fast as she was searching for it, she tore it off the journal. she did the same for two more times. she folded them neatly. the she took out a ___(2. medium of writing) and started to write:  "I finally found it" ___(1. describing how the storyteller detective wrote those words, the instrument for writing and how the words look on the page markings that show excitement. either font size, exclamantion marks, boldness., penmanship, style..etc). The ___(2. a specific place or entity. factual. grounded. specific, it's a location with a name, not generic. SPECIFIC). she she  starts to draw hastily a map of her surroundings that shows___(3. key geographical elements and maybe roads, with marking her current location as the destination of the map suggesting the last piece of the journey that she made to get there). she adds then a small legend to her amateurish map showing __(4. shortlist of items in the map legend).  she adds a few arrows pointed toward ___(5. where do they point in the map). and continues to write.
  "not much of a map maker I know...but , you'll have to work with that, I guess.
  oh..and you have to look for this...or I mean..it would look different, of course.. but try to find it:. she stops and draws.   this time it looks like   ___(6. some sort of entity, a place, an item, a creature, flora, fauna). she writes under it ___(7. the title she gives to her drawing and mention of how the font and writing style looks like).she then circles around it and writes: "FIND IT!!!" 
  
  she continues to write: "and last but not least, 
  this is where you need to stay the first night you arrive to :  ___(8. options for specific places in our world which would be in the distance of 5 days journey suitable to have the initial scene as a location for a movie) Don't worry. from there you'll need to travel to ___(9. the exact location that would be suitable for a location for the COMPLETE_NARRATIVE  ) by ___(10. means of transportation). it's much worse than it sounds, i'm afraid... jokes aside. make sure you know at least something about ___(11. some skill or knowledge). you'll need it. and also don't forget to bring ___(12). you'll thank me later.  I will send the fragments, I promise. whatever is left of them, I guess. you have to remember what you wrote. You ARE the storyteller". Then, the storyteller detective takes out a ___(13. specific model of camera 100-70 years old), and takes a picture of ___(14. some entity or entities that are present in the current scene, with shot size and composition). continues writing: "I hope you'll get that picture too. That's it. i'm getting in. I will see you on the other side". `
}

export async function getSceneStepForSessionId(sessionId){
  const db = await getScenesDb();
  const sessionDb = await getSessionssDb()
  if (! (sessionId in sessionDb.sessions))
  {
    sessionDb.sessions[sessionId] = {step:0, order:0, current_influences:{}}
    await fsPromises.writeFile(sessionsScenes, JSON.stringify(sessionDb));  
  }
    
  let scene_order = sessionDb.sessions[sessionId].order
  let step = sessionDb.sessions[sessionId].step
  const {scene_name, scene_general_direction_guideline, necessary_background, 
      description, prompt_function, order} = db.scenes[scene_order]
  return {prompt_function, scene_name, scene_general_direction_guideline, necessary_background, step: description[step]}  
}

export async function updateSessionScenePosition(sessionId, newPos={}){
  // This function originally read from getScenesDb and getSessionssDb (JSON files)
  // and then wrote back to sessionsScenes.json.
  // Refactoring write to MongoDB (SessionSceneState model). Read remains from JSON for now.

  const scenes_db = await getScenesDb(); // Reads from JSON
  const sessions_db = await getSessionssDb(); // Reads from JSON
  
  let sceneName; // Need to determine sceneName, assuming it's part of session data or newPos.
                 // For now, let's assume a default or it needs to be passed in.
                 // This is a gap from the original structure not having sceneName in sessions_db.sessions[sessionId]

  let updateData = {};
  if (Object.keys(newPos).length > 0) {
    updateData.currentStep = newPos.step !== undefined ? newPos.step : sessions_db.sessions[sessionId]?.step;
    updateData.currentOrder = newPos.order !== undefined ? newPos.order : sessions_db.sessions[sessionId]?.order;
    sceneName = newPos.sceneName || sessions_db.sessions[sessionId]?.sceneName || 'defaultScene'; // Determine sceneName
  } else {
    const currentSessionSceneData = sessions_db.sessions[sessionId];
    if (!currentSessionSceneData) {
        console.error(`Session data not found for sessionId ${sessionId} in JSON files.`);
        // Initialize with defaults if not found, or handle error
        updateData.currentStep = 0;
        updateData.currentOrder = 0;
        sceneName = 'defaultScene'; // Fallback scene name
    } else {
        const { step, order } = currentSessionSceneData;
        sceneName = currentSessionSceneData.sceneName || 'defaultScene'; // Fallback scene name
        if (scenes_db.scenes[order] && scenes_db.scenes[order].description.length == step) {
            updateData.currentOrder = order + 1;
            updateData.currentStep = 0;
        } else {
            updateData.currentOrder = order;
            updateData.currentStep = step + 1;
        }
    }
  }
  updateData.lastUpdatedAt = new Date();

  if (!sceneName) {
    console.error("Scene name could not be determined for updateSessionScenePosition.");
    // Fallback or error handling
    sceneName = "unknownScene"; 
  }


  try {
    await SessionSceneState.findOneAndUpdate(
      { sessionId: sessionId, sceneName: sceneName }, // Assuming sceneName is key; might need adjustment
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(`Error in updateSessionScenePosition for sessionId ${sessionId}:`, error);
    throw error;
  }

  // Original JSON write is removed:
  // sessions_db.sessions[sessionId]= {...sessions_db.sessions[sessionId], ...newPos};
  // await fsPromises.writeFile(sessionsScenes, JSON.stringify(sessions_db));
}


export function findSuffix(mainStr, suffixStr) {
  return mainStr.endsWith(suffixStr);
}

export async function findCurrentInflunences(sessionId, conversationHistory, userInput) {
  if (conversationHistory.length === 0) return []; 

  const prevAssistant = conversationHistory[conversationHistory.length - 1];
  let foundInfluences = {}; 
  try {
    const prevContentObj = JSON.parse(prevAssistant.content);
    
    if (prevContentObj.options && Array.isArray(prevContentObj.options)) {
      prevContentObj.options.forEach(option => {
        if (findSuffix(userInput, option.continuation)) {
          
          foundInfluences = option.influences || {}
        }
      });
    }
  } catch (e) {
    console.error('Could not parse JSON object for influences:', prevAssistant);
  }

  let sessionDb = await getSessionssDb()
  if(Object.keys(foundInfluences).length > 1){
    sessionDb.sessions[sessionId].current_influences = foundInfluences
    await fsPromises.writeFile(sessionsScenes, JSON.stringify(sessionDb))
  }
  return sessionId in sessionDb.sessions && sessionDb.sessions[sessionId].current_influences ? 
  sessionDb.sessions[sessionId].current_influences : {};
}


export async function storytellerDetectiveFirstParagraphCreation(sessionId, userInput=''){

  const detectiveHistory = await getSessionDetectiveCreation(sessionId);
  const scene = await getSceneStepForSessionId(sessionId)
  let masterResponse
  // Save user input with role
  if (userInput) {
      // const specifcGuidlineForStep = getSpecificGuidlineForStep(detectiveHistory.length)
      // detectiveHistory.push({ role: 'user', content: userInput + `[${specifcGuidlineForStep}]`});
      
      const currentInfluences = await findCurrentInflunences(sessionId, detectiveHistory, userInput)
      if(Object.keys(currentInfluences).length > 1)
        scene.step['current_influences'] = currentInfluences

    
      detectiveHistory.push({ role: 'user', content: userInput + `[next step guideline:${JSON.stringify(scene.step)}. Ensure to add what's in script_template_for_step to the current_narrative. and to make the narrative FULLY COHESIVE. TRY to give options that will take to different directions. AND KEEP IT INTERESTING!]`});
      
  }

  

  let prompts = []
  if(scene.prompt_function == 'STORYTELLER_DETECTIVE_PROLOGUE'){
    const scene =  storytellerDetectivePrologueScene()
    prompts = generateStorytellerDetectiveFirstParagraphSession(scene);  
  }
  else if(scene.prompt_function == 'STORYTELLER_DETECTIVE_JOURNAL'){
    scene = journalEntryTemplateScene()
    prompts = generateStorytellerDetectiveFirstParagraphLetter(scene)
  }
  
  // const mockedResponse = {
  //   "current_narrative": "It was almost",
  //   "choices": {
  //     "choice_1": {
  //       "options": [
  //         {
  //           "continuation": "dusk",
  //           "storytelling_points": 1
  //         },
  //         {
  //           "continuation": "midnight",
  //           "storytelling_points": 2
  //         },
  //         {
  //           "continuation": "early morning",
  //           "storytelling_points": 1
  //         },
  //         {
  //           "continuation": "noon",
  //           "storytelling_points": 1
  //         },
  //         {
  //           "continuation": "the breaking of dawn",
  //           "storytelling_points": 3
  //         }
  //       ]
  //     }
  //   }
  // }
  console.log(`prompts ${JSON.stringify(prompts)}`)
  newNarrativeOptions = await directExternalApiCall(prompts.concat(detectiveHistory), 2500, 1.03);

  // Save response with role
  if (newNarrativeOptions) {
    detectiveHistory.push({ role: 'assistant', content: JSON.stringify(newNarrativeOptions) });
  }
  await setSessionDetectiveCreation(sessionId, detectiveHistory);
  await updateSessionScenePosition(sessionId)
  return newNarrativeOptions;
}

// module.exports removed, functions are exported individually.



// "step_number": 4,
// "step_title": "Location Element",
// "step_description": "the specific element in the location, with maybe references to climate, flora and possible fauna that the FOUND/OJBECT in step 2 relates to",
// "step_guideline": "Use sensory details to bring the setting to life, including any relevant climate, flora, and possible fauna. This should help in creating a vivid, immersive scene.",
// "influences_direction":"refine the current influences, and return again 'influences' in the JSON. add a twist to them. more elements, surprising. fit the options to the influences.",
// "script_template_for_step": "the ___ (4. specific element in the location, with maybe references to climate, flora and possible fauna)"
// },
// {
// "step_number": 5,
// "step_title": "Detailed Observation",
// "step_guideline":".refine the influences and add them again as 'influences' key in the JSON. and make them more subtle fitting to each option you give. Do not make direct reference to the influences in the narrative. the understanding is based only on sensory pereceived details of what the storyteller detective makes of the scene, far from understanding",
// "script_template_for_step": "On a closer look, it appeared to be ___ (5. very initial understanding of the FOUND object/phenomenon/structure. the 'it' refers to the object/structure that was found! MAKE SURE TO USE THE WORDS GIVEN and continue the narrative accordingly. it has to make sense logically )"
// },


// {
// "step_number": 6,
// "step_guideline": "fuse new energy into the influences, take a new direction that will fit but be surprising. make use of fantasy novels, niche rpg campaign settings, moods, and genres",
// "script_template_for_step": "it was a ___ (6. more specific description, based on knowledge and synthesis)"
// },
// {
// "step_number": 7,
// "step_guideline": "focus on the tactile and visual aspects of the materials involved. Describe how they contribute to the object's age, origin, and significance in a vivid, sensory-rich manner. This step should add depth to the reader's understanding of the object's history and importance.",
// "script_template_for_step": "made of ____(7. material/materials physicality)"
// },
// {
// "step_number": 8,
// "step_guideline": "using ONLY sensual description, try to convey the specificity of the object. let us believe that we're witnessing something concrete, through the perception of the storyteller detective. rich in meaning and context. think of various cultures, climates, influences, genres and moods. be factual, sensory description. only show. do NOT interpret at all.",
// "script_template_for_step": "___ (8. more elaborate description of the object that brings to light further knowledge and expanse)"
// },
// {
// "step_number": 9,
// "step_title": "Subjective Observation",
// "step_description": "a subjective observation by the storyteller detective that hints of the plot and the detective's understanding of the scene, and his previous investigation about it",
// "step_guideline": "find a mixture of two famous detectives/hero characters. try to think how would they talk. this is a direct quote. the 'voice' of the character. make the storyteller detective observation personal, and intruiging, subjective...puzzled, reflective, but factual, grounded. NOT GENERIC",
// "script_template_for_step": "\"Such a ___ (9. direct speech by the storyteller detective, a personal reflection on the surrounding as a whole, and some detail about it, that puzzles the storyteller detective.)"
// },
// {
// "step_number": 10,
// "step_title": "Narrative Delivery",
// "step_description": "verb indicating the way the storyteller detective said it, making the storyteller detective character be more specific and intriguing",
// "step_guideline": "Choose a verb that reflects the storyteller detective's manner of speech or reaction, adding depth to their character and how they engage with the discovery.",
// "script_template_for_step": "(verb indicating the way the storyteller detective said it, making the storyteller detective character be more specific and intriguing) the storyteller detective"
// },
// {
const fs = require('fs'); 
const fsPromises = require('fs').promises; 

const path = require('path')
const { directExternalApiCall, generateMasterStorytellerChat, generateMasterStorytellerConclusionChat, askForBooksGeneration,
  generateStorytellerSummaryPropt, generateStorytellerDetectiveFirstParagraphSession, generateStorytellerDetectiveFirstParagraphLetter, generate_entities_by_fragment } = require("../ai/openai/promptsUtils");
const { text } = require('express');
const storytellerSessions = path.join(__dirname, 'db', 'storytelling.json');
const scriptTemplates = path.join(__dirname, 'script_templates', 'script_templates.json');
const sessionsScenes = path.join(__dirname, 'script_templates', 'sessions_scenes.json');
// const sessionDataStructre = {chat: [], fragment:'', textures:[], currentTexture:-1, character:[]}

const getStorytellerDb = async (storagePath=storytellerSessions) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };
  const getScenesDb = async (storagePath=scriptTemplates) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };

  const getSessionssDb = async (storagePath=sessionsScenes) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };
  const setChatSessions = async (sessionId, chatSession) => {
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].chat = chatSession
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  };

  const setEntitiesForSession = async(sessionId, entities) => {
    allData = await getStorytellerDb();
    if (!allData[sessionId]) {
      allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].entities = entities
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));

  }

  const getEntitiesForSession = async(sessionId) =>{
    allData = await getStorytellerDb();
    if (!allData[sessionId]) {
      allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].entities
  }

  const setSessionDetectiveCreation = async (sessionId, detectiveHistory) => {
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].detective = detectiveHistory
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  };

  async function setFragment(sessionId, fragment){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].fragment = fragment
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  }

  async function getFragment(sessionId){
    allData = await getStorytellerDb()
    return allData[sessionId].fragment
  }

  async function setFragment(sessionId, fragment){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].fragment = fragment
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  }

  async function updateTurn(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].turn += 1
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
    return allData[sessionId].turn
  }


  function saveTextureToFileSystem(sessionId, texturePrompt, index){
    const subfolderPath = path.join(__dirname, '../assets', String(sessionId));
    const textureSubfolderName = `texture_${index}_${Math.floor(Math.random() * (100) + 1)}`;
    const textureSubfolderPath = path.join(subfolderPath, textureSubfolderName);
    
    if (!fs.existsSync(textureSubfolderPath)){ 
      fs.mkdirSync(textureSubfolderPath);
    }
    
    fs.writeFileSync(path.join(textureSubfolderPath, 'texture_prompt.json'), JSON.stringify(texturePrompt));
  }

  function saveFragmentToFileSystem(sessionId, fragment){
    const subfolderPath = path.join(__dirname, '../assets', String(sessionId));
  
    if (!fs.existsSync(subfolderPath)){
      fs.mkdirSync(subfolderPath);
    }
  
    fs.writeFileSync(path.join(subfolderPath, 'original_prompt.txt'), fragment);
    return subfolderPath
  }
  
  
  async function saveFragment(sessionId, fragment){
    saveFragmentToFileSystem(sessionId, fragment)
    await setFragment(sessionId, fragment)
  }
  

  function initSessionDataStructure(){
    return  {entities: [], chat: [], fragment:'', textures:[], currentTexture:-1, character: [], detective:[],
    discussion_summary: '', turn:0};
  }
  
  async function getSessionChat(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].chat
  }

  async function getSessionDetectiveCreation(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].detective
  }

  async function getCharacterCreation(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].charecter
  }

  const setCharecterCreation = async (sessionId, characterSession) => {
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].character = characterSession
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  };


  async function getSessionTextures(sessionId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    return allData[sessionId].textures

  }

  
  const setTexture = async (sessionId, texture) => {
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].textures.push(texture)
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  };
  

  async function saveTextures(sessionId, textures){
    for(i=0; i<textures.length; i+=1){
      saveTextureToFileSystem(sessionId, textures[i], i)
    }
    
    await setTexture(sessionId, textures)
  }

  async function chooseTextureForSessionId(sessionId, textureId){
    allData = await getStorytellerDb()
    if (!allData[sessionId]) {
        allData[sessionId] = initSessionDataStructure()
    }
    allData[sessionId].currentTexture = textureId
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  }

  async function getChosenTexture(sessionId){
    allData = await getStorytellerDb()
    return allData[sessionId].textures.find((texture) => { return texture.index == allData[sessionId].currentTexture})
  }

  async function setCharacterCreationQuestionAndOptions(sessionId, data){
     allData = await getStorytellerDb()
     if (!allData[sessionId]) {
      allData[sessionId] = initSessionDataStructure()
    }
    if(! allData[sessionId].character)
      allData[sessionId].character = [];
    allData[sessionId].character.push(data)
    await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
  }

  async function getCharacterCreationSession(sessionId){
    allData = await getStorytellerDb()
    if(! allData[sessionId].character)
      allData[sessionId].character = []
   return allData[sessionId].character
 }

 async function getPreviousDiscussionSummary(sessionId){
    allData = await getStorytellerDb()
    if(! allData[sessionId].discussion_summary){
      const previousDiscussion = await getSessionChat(sessionId);  
      const discussionText = previousDiscussion.map((i) => { return i.content}).join("\n")
      const originalFragment = await getFragment(sessionId)
      const texture = await getChosenTexture(sessionId);
      const summarize_prompt = generateStorytellerSummaryPropt(discussionText, originalFragment, texture.url.revised_prompt);
      const summary_resp = await directExternalApiCall([{role: 'system', content:summarize_prompt}], 2500, 1);
      allData[sessionId].discussion_summary = summary_resp;
      await fsPromises.writeFile(storytellerSessions, JSON.stringify(allData));
    }
    return allData[sessionId].discussion_summary
 }
  

async function chatWithstoryteller(sessionId, fragmentText, userInput='', mockedStorytellerResponse=null){

    const chatHistory = await getSessionChat(sessionId);
    let masterResponse
    // Save user input with role
    if (userInput) {
        chatHistory.push({ role: 'user', content: userInput });
    }

    
    if (chatHistory.filter((c)=> {return c.role =='system'}).length  <= 4) {
        const prompts = generateMasterStorytellerChat(fragmentText);
        masterResponse = await directExternalApiCall(prompts.concat(chatHistory), 2500, 1, mockedStorytellerResponse);

        // Save master response with role
        if (masterResponse) {
            chatHistory.push({ role: 'system', content: masterResponse });
        }
    } else if (chatHistory.filter((c)=> {return c.role =='master'}).length  === 5) {
        const conclusionPrompts = generateMasterStorytellerConclusionChat(previousMessages);
        const resFromExternalApi = await directExternalApiCall(conclusionPrompts);
        const { storyteller_response: masterResponse } = resFromExternalApi;

        // Save master response with role
        if (masterResponse) {
            chatHistory.push({ role: 'system', content: masterResponse });
        }
    }
    await setChatSessions(sessionId, chatHistory);
    return masterResponse;
}

async function generateEntitiesFromFragment(sessionId, fragmentText, turn=1){
  const maxEntities = 8
  const prompts = generate_entities_by_fragment(fragmentText, maxEntities);
  const  response = await directExternalApiCall(prompts, max_tokens = 6000, temperature=0.7, mockedResponse=null, explicitJsonObjectFormat=true, isOpenAi=false);
  let { clusters, entities} = response
  if(entities.card_backs){
    entities = entities.card_backs
  }
  entities = entities.map(e => {
    return {
        id: Math.random().toString(36).substring(2, 10), // Generate a random string
        turn: turn,
        ...e
    };
  });

  await setEntitiesForSession(sessionId, entities);
  return entities
  
}



function storytellerDetectivePrologueScene(){
  return `And so, it became to be that it was  ___ (1. a term that describes the time , like: "almost midnight", "right about noon", "in the thick fog of an early morning", "just as the sun began to set", "the early hours of morning", "half past 4 in the afternoon ", time of day, e.g., night/dark/noon) as the storyteller detective finally approached  ___ (2.a/an/the FOUND_ structure that stands out in where it's located, it's a rather an unusual place to find such a structure. how it relates to the specificity of the surroundings).  it was  ___ (3. more specific description, based on knowledge and synthesis, also mentioning the material/materials and physicality of the structure) 
  " ___" (4. (direct speech of the storyteller detective) + (verb: how the detective said it). direct speech: a subjective observative given by a very specific storyteller detective, who finally reaches to that specific structure and reacts differently to it . referencing about that structure, in the specificity of this location and also in the more wider surroundings) 
  as ___ (5. pronoun: he/she/they (determines gender))  ___ (6. specific single word verb indicating dismounting or stopping a very specific mode of transportation the storyteller detective used to get here), 
  ___ (pronoun based on previously chosen gender (5)- so it should be known ) ___ (7. action of securing a very distinct mode of  transportation and a short yet descriptive and detailedof the mode of transportation). 
  Then, taking ___ (8. object/s from a storage item, e.g., backpack), ___ (pronoun) proceeded 
  to ___ (9. action indicating moving deeper into the location, looking for a specific place where that item/items from the storage should be used).
  __(10.something that catches the detective's attention in the location and structure that suggests something unexpected) . " ____(11. direct speech by the storyteller detective reacting to (10) and how it gave  the understanding of the immediate urgency following in which finding the book in here, and references to the detective's attitude and character in the light of that ) might be?"`
}

function getSpecificGuidlineForStep(stepNo){
  if(stepNo == 2)
    return `(next choise: 2.FOUND_ OBJECT/PHENOMENON/STRUCTURE/RELIC - now for this choice, give a first impression, crude, a raw glimpse, vague, what it seems to be like....but whatever you choose, always remain CONCRETE in your description, and images. FACTUAL, GROUNDED, NO GENERIC BANALIC SUPERFICIAL IMAGERY!! DO NOT INTERPRET, JUST OBSERVE! BE Himengway) `
  else if(stepNo == 9)
    return `[specific guideline for choice 9: introduce the storyteller detective's voice, revealing their gender. This moment captures the detective's first detailed observation, characterized by their unique perspective and minimal but profound commentary. Emphasize the detective's deep knowledge, deductive reasoning, and the significance of their findings through a memorable, distinct character expression. just very few words, that have a whole breadth of knowledge and deduction and assumptions behind themץ Use specific, concise language REFRAIN FROM ANY GENERIC COMMENTING. use body gestures to convey the detective's interaction with their discovery, making their character and insights vivid and impactful. Aim for a strong, quirky character moment that stands out. refrain from any metaphors that aren't grounded, factual, and specific.  don't be shy of mentioning specific names, locations, events, assertions, deductions! we should feel we stumble into an already existing universe(though not exactly ours...could be alternative history one of earth or completely different). the storyteller detective notices something very specific. he/she/they make a very careful precise observation and following deduction] `
  else
    return `(ensure the seamless direct continuation and the logic of the current narrative. you may make fine adjustments to the script template to ensure the cohesive and natural seamless unfolding of the narrative! make it captivating!all options should be grounded, show don't tell. don't interpret. remain using the senses and factual facts. minimalism and subtle suggestion is ALWAYS ADVISED!)`
}

function journalEntryTemplateScene(){
  return `But instead of getting right in, the storyteller detective took out what seemed to be like a ___(1. material, or texture, or a sequence of adjectives verbs describing the physicality of the journal)  journal. it was worn. she skimmed it fast, back and forth, until she found the page she was looking for: and then as fast as she was searching for it, she tore it off the journal. she did the same for two more times. she folded them neatly. the she took out a ___(2. medium of writing) and started to write:  "I finally found it" ___(1. describing how the storyteller detective wrote those words, the instrument for writing and how the words look on the page markings that show excitement. either font size, exclamantion marks, boldness., penmanship, style..etc). The ___(2. a specific place or entity. factual. grounded. specific, it's a location with a name, not generic. SPECIFIC). she she  starts to draw hastily a map of her surroundings that shows___(3. key geographical elements and maybe roads, with marking her current location as the destination of the map suggesting the last piece of the journey that she made to get there). she adds then a small legend to her amateurish map showing __(4. shortlist of items in the map legend).  she adds a few arrows pointed toward ___(5. where do they point in the map). and continues to write.
  "not much of a map maker I know...but , you'll have to work with that, I guess.
  oh..and you have to look for this...or I mean..it would look different, of course.. but try to find it:. she stops and draws.   this time it looks like   ___(6. some sort of entity, a place, an item, a creature, flora, fauna). she writes under it ___(7. the title she gives to her drawing and mention of how the font and writing style looks like).she then circles around it and writes: "FIND IT!!!" 
  
  she continues to write: "and last but not least, 
  this is where you need to stay the first night you arrive to :  ___(8. options for specific places in our world which would be in the distance of 5 days journey suitable to have the initial scene as a location for a movie) Don't worry. from there you'll need to travel to ___(9. the exact location that would be suitable for a location for the COMPLETE_NARRATIVE  ) by ___(10. means of transportation). it's much worse than it sounds, i'm afraid... jokes aside. make sure you know at least something about ___(11. some skill or knowledge). you'll need it. and also don't forget to bring ___(12). you'll thank me later.  I will send the fragments, I promise. whatever is left of them, I guess. you have to remember what you wrote. You ARE the storyteller". Then, the storyteller detective takes out a ___(13. specific model of camera 100-70 years old), and takes a picture of ___(14. some entity or entities that are present in the current scene, with shot size and composition). continues writing: "I hope you'll get that picture too. That's it. i'm getting in. I will see you on the other side". `
}

async function getSceneStepForSessionId(sessionId){
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

async function updateSessionScenePosition(sessionId, newPos={}){
  const scenes_db = await getScenesDb()
  const sessions_db = await getSessionssDb()
  if(! Object.keys(newPos).length)
  {
    const {step, order} = sessions_db.sessions[sessionId]
    if(scenes_db.scenes[order].description.length == step)
      newPos = {order:order+1, step:0}
    else
      newPos = {order:order, step:step+1}
  }
  sessions_db.sessions[sessionId]= {...sessions_db.sessions[sessionId], ...newPos}
  await fsPromises.writeFile(sessionsScenes, JSON.stringify(sessions_db));
}


function findSuffix(mainStr, suffixStr) {
  return mainStr.endsWith(suffixStr);
}

async function findCurrentInflunences(sessionId, conversationHistory, userInput) {
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


async function storytellerDetectiveFirstParagraphCreation(sessionId, userInput=''){

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



module.exports = {
    chatWithstoryteller,
    saveFragment,
    updateTurn,
    getFragment,
    saveTextures,
    chooseTextureForSessionId,
    getSessionChat,
    setTexture,
    getChosenTexture,
    setCharacterCreationQuestionAndOptions,
    getCharacterCreationSession,
    getPreviousDiscussionSummary,
    storytellerDetectiveFirstParagraphCreation,
    generateEntitiesFromFragment,
    getEntitiesForSession,
    setEntitiesForSession
};



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
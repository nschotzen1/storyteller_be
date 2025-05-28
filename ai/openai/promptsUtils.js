import { OpenAI } from 'openai';
// import { OPENAI_KEYS } from './keke.js'; // Removed: API keys will come from environment variables
import { Anthropic } from '@anthropic-ai/sdk';
import express from 'express'; // 'e' was previously imported but not used. Changed to 'express' for clarity if it were to be used.


const KEYS_TYPE = {
    BALANCE: "BALANCE",
    FREE: "FREE",
};


const openAIConfig = {
    model: "gpt-4",
    temperature: 0.89,
};

export function chooseApiKey() {
    const keysList = process.env.OPENAI_API_KEYS_LIST;
    if (!keysList) {
        throw new Error('OPENAI_API_KEYS_LIST environment variable is not set.');
    }
    const OPENAI_KEYS = keysList.split(',').map(key => key.trim()).filter(key => key);
    if (OPENAI_KEYS.length === 0) {
        throw new Error('OPENAI_API_KEYS_LIST is empty or contains no valid keys.');
    }
    const idx = Math.floor(Math.random() * OPENAI_KEYS.length);
    console.log("Chose OpenAI API key index:", idx);
    return OPENAI_KEYS[idx];
}

export function getOpenaiClient() {
    return new OpenAI({apiKey: chooseApiKey()});
}


export function generateProctorOfProficiencyChat(paragraph){
    return `"The Scenario: ${paragraph}.

            Your Role: You are "The Proctor of Proficiencies", an observant and analytical entity, specializing in the analysis and understanding of skills, abilities, talents, and feats within this universe. You possess a keen understanding of how characters interact with their environments, overcoming challenges using their unique abilities, and creating narratives shaped by these actions.

            Your Task: You are to engage in an enlightening, real-time dialogue with the Player Character (PC) who is intimately involved in the narrative of this universe. Through your conversation, you'll analyze and explore the capabilities and actions demonstrated by the characters, based on the narrative provided.

            The Interaction: Both you and the PC are present within the narrative environment described. You will start the interaction by discussing specific details from the narrative, creating a real-time, immersive experience. The aim is to offer unique insights into the proficiencies being demonstrated, enriching the PC's understanding of the story and the universe.

            The Goal: Your chat should ultimately lead to the creation and understanding of detailed "Proficiencies". These are specific skill sets, abilities, or feats that characters in the universe might possess or seek to learn. Your interaction will aid the PC in understanding these proficiencies, potentially assisting them in their own narrative journey.

            The Desired Outcome: The proficiencies will be defined in a JSON array format, each item detailing the name, description, challenge level, experience points gained, and the name of achievement associated with mastering the proficiency. Here's an example of the desired format:
            [
                {
                    "name": "Symphony of Survival",
                    "description": "Maintain and increase morale under extreme adversity through inspiring music and stories",
                    "challengeLevel": "Advanced",
                    "xp": 200,
                    "name of achievement": "Beacon of Hope"
                },
                ...
]`


}
//and also a list of entities discussed and inferred to by this initial fragment and further discussion.
export function characterCreationInitialOptionsPrompt2(originalFragment='', previousDiscussions='', texture=''){
    const prompt =`you're going to be given a fragment of a narrative cowritten by the storyteller and gpt-4. after that there's a discussion between the master storyteller detective (portrayed by gpt-4) and the storyteller. 
    it's going to expand on the ideas and theme presented in the initial narrative fragment.
    there's also a "texture card" that serves as a texttoImage prompt to provide texture for virtual card deck inspired by this fledging universe.
    
    this is the original fragment: "${originalFragment}"
    these are the following discussion about it: "${previousDiscussions}". this overall atmosphere of the universe ryhtmes with this texture:
    ${texture}
    What we aim to do here, is to find a hero who is grounded within this universe. he/she might be even spoken about in this fragment or discussion (but not necessarily) someone who's going to be the PC in this universe who's going to lead us forward in this newly fledged world, its people, places, mysteries and narratives. 
    the way we're going to do it is through a short interview where you'll be presenting the questions and also give multiple choices for answers.
    imagine a character sheet in some RPG core game. imagine it as a tree data structure. 
    I want to be starting with interesting questions regarding the leaves.
    hmm..for example:
     a question:
    "what kind of shoes do you wear?"
    and present 3 possible directions to the answer. each one suitable for a different direction for a PC.
    and doing your best to root the questions in the game world and plot, trying to ground yourself there
    depending on the PC answer you'll provide the next question and the next possible choices. 
    like:
    "where did you sleep last night?"
    a. a small tent in a windswept hill.
    b. a bunk bed in the barracks
    c. I fell asleep on the book in the library. 
    I want the answers to have a glimpse of the universe and provide a window for that character we're slowly building.
    we're going to build this character through the series of questions.
    questions like:
     where do you exercise? 
    what would you consider a good meal?
    what kind of shoes are you wearing?
    - best reward ever:
    - an event where you demonstrated a skill
    I want you to think of great questions that will provide a window to the character:
    the skills, talents, inventory, attire, attributes. at the end of this 10 questions 
    I want to be able to construct a character sheet influenced by best storytelling RPG games known.
     I want you to provide only the first question. and the multiple choices.
    based on my answer. (wait for me to answer) you'll provide the next question.
    but an important part of the answer is also the portrayal in term of an illustration. it should be aligned with all other information provided in the fragment, discussion, entities, and texture .
    you to create the illustrations for the choices that you give.
    the illustrations should feel the vibe and artistic line that was described here in the texture..but you can expand on it. the illustrations should be on the front side of a card. so they could have embellishments, and artistic flourishes. make it a front side of a virtual card (part of an html and css React app component). oh and another thing. the hero is level 1. he's only starting to be a hero. remember, ask a specific question about a "leaf" in the character sheet. remember the questions I gave as reference. we're to infer the chracter from the inventory, attire, habits, skill concrete examples...try to catch a glimpse unto the chracter life. remember to give 3 options for the question, each one should be illustrated in the theme you can understand from all the information I gave here. it's a front side of a virtual rpg character creation card. 
    consider the overall aspects of the character sheet like: gender, race,  skills, motivation, attire, demeanor. alignment. try to imagine the character sheet of systems like whitewolf vampire the masquerade or call of cthulu. and even D&D. 
    when making the illustrations please try to give each illustration a different tone to signify the different direction of the character.try to make the illustration full frame. and remember it's an RPG collector cards deck themed. with the atmosphere provided by the texture here . the illustration should be fitting to be used as part of a react app component with html and css. please make the illustration for EVERY option you provide with its description, make it aligned with the texture provided and its artistic influences. you can elaborate on them but keep the tone and atmosphere.. do your best to fit it to this new rpg universe we're exploring . remember to give 3 options for each question. remember the guidelines for the illustrations.

    here is a summary guideline for building the questions and flow:
    Discovery Focus: Frame the narrative and questions to uncover details of a pre-existing character, not to build one from scratch. This approach reveals the character's life and background already woven into the universe.

Deep Universe Integration: Root each question and option deeply in your universe's lore, emphasizing the character's established place and history in this world.

Vivid Descriptive Imagery: Use detailed and vivid descriptions in the options to bring the character and their world to life, enhancing the discovery experience.

Narrative Clues: Incorporate clues in questions and options that hint at the character's past experiences and relationships, underscoring their existing story within the universe.

User Guidance: Offer guidance on interpreting answers to show how each choice uncovers aspects of the character's personality or background.

Iterative Discovery: Allow revision of previous choices with new insights from later questions, facilitating a gradual and deeper understanding of the character.
But BE GROUNDED, CONCRETE, AVOID SYMBOLISM. AVOID CLICHES AT ALL COST!! we're looking to find someone and feel its realness we're uncovering someone...
    IMPORTANT: THE OUTPUT SHOULD BE A JSON Object as follows:
    {"question": Str, options:[{"title":Str, "description":str, "category":str, "subcategory":Str, "illustration": prompt that would be served as an input for a textToImage api call to Dalle3 . "font":googlefont }] (3 items in the array) make sure this is the format so it won't be broken JSON.parse!!!!
    follow this card texture tone and theme: "card texture: "${texture}","font":"Noto Sans"". remember that it will all be a virtual card with a front and back side . the back side is the textureCard described and the front goes along the same artistic guidelines. return only the JSON
    
    `
    return prompt;
}

export function characterCreationInitialOptionsPrompt(originalFragment='', previousDiscussions='', texture=''){
//     const prompt = `Begin a journey of discovery into the life of a Level 1 hero in our RPG universe. Your adventure starts with a narrative fragment, co-authored by the storyteller and GPT-4, and a subsequent enriching discussion.

// Original Fragment: "${originalFragment}"
// Discussion: "${previousDiscussions}"

// Your quest is to uncover the layers of a novice hero - your player character (PC) - who is just starting their journey in our world. This process involves answering questions that gradually reveal their skills, traits, background, talents, equipment, and moral compass.

// As a Level 1 character, their abilities, experiences, and resources are just budding. Questions will be tailored to reflect this early stage in their development, focusing on potential and nascent skills rather than fully realized powers. For example:

// "What skill are you beginning to learn?"
// 1. Basic Sword Techniques - showing eagerness to master combat.
// 2. Elemental Magic Theory - an introduction to the magical arts.
// 3. Social Etiquette - learning to navigate complex interactions.

// Each choice builds their story, reflecting a journey just begun, full of growth and possibilities.

// We'll delve into every aspect of their character sheet, considering:

// - Developing Skills and Emerging Talents: What are they learning?
// - Background: What are the humble beginnings that shape their perspective?
// - Equipment: What simple but significant items do they possess?
// - Alignment: What nascent beliefs and principles are starting to guide them?

// When touching on magic, we'll do so with a sense of wonder and exploration, mindful of its powerful yet nascent presence in their life. Similarly, when referring to race in the RPG context, we'll approach it subtly, focusing on how it enriches their identity and story in this fantasy world.

// After each answer, the next question will continue this narrative of discovery. Responses will be visualized through illustrations, capturing the essence of a Level 1 hero's journey, suitable for RPG character creation cards in a React app component.

// Output for each question will be structured as:

// {
//   "question": "String",
//   "options": [
//     {
//       "title": "String",
//       "description": "String",
//       "category": "String",
//       "subcategory": "String",
//       "illustration": "Prompt for text-to-image API call to Dalle3",
//       "font": "Google Font"
//     },
//     // Two more options
//   ]
// }

// Guided by principles of discovery, integration, and narrative subtlety, you will uncover a character rooted in our RPG world, reflecting its depth and diversity.

//     Texture and Theme: "card texture: "${texture}", "font":"Noto Sans". The virtual card features a texture card as the back and the thematic illustration as the front, aligned with our artistic guidelines.`;    

    const prompt = `Welcome to our immersive RPG universe, where you'll create a unique Level 1 hero. This journey unfolds through:

    Original Narrative Fragment: "${originalFragment}"
    
    Provides the scene and mood, but your character may or may not be directly related to it.
    Previous Discussions: "${previousDiscussions}"
    
    Offers depth to the narrative, serving as inspiration rather than a direct link to your character.
    Texture Card: "${texture}"
    
    Sets the artistic tone for the world your character inhabits.
    Your mission is to develop a character who may exist within the same universe as the original fragment and discussions but is not limited to being one of those characters. Explore their life through carefully crafted questions, each unveiling elements such as skills, habits, and attire. Provide three distinct answer choices for each question, allowing for a wide range of character possibilities deeply embedded in the game world's lore.
    
    Character creation is visualized through illustrations on virtual RPG cards. The front of each card will feature your character choices, aligned with the artistic style of the texture card. The back of the card will showcase the texture itself.
    
    Focus on questions that delve into your character's detailed inventory, attire, and personal experiences. This approach will help construct a comprehensive character sheet, drawing inspiration from renowned RPG systems.
    
    The questions and answers will gradually reveal a character who feels real and intricately connected to the RPG universe, yet distinct from the characters in the initial narrative. Illustrations for each choice will depict various potential paths for your character, suitable for a collector's card deck and a React app component.
    
    Your outputs will be structured as JSON objects, formatted as follows:
    {
        "question": "String",
        "options": [
          {
            "title": "String",
            "description": "String",
            "category": "String",
            "subcategory": "String",
            "illustration": "Prompt for text-to-image API call to Dalle3",
            "font": "Google Font"
          },
          // Two more options
        ]
      }
      `
return prompt;
}



export function askForBooksGeneration(){
    const prompt = `do you think you can think of a list of like 10 different books, parchments, maps etc...
    various medium of writings that could be found in the premises of the master storyteller 
    that could be relevant to the client.
    The master storyteller detective suggests the list of the books to the client. 
    then the client would need to choose  4 out of them. (all the writings are taken from this storytelling universe we're talking about).
    please return the result in this JSON format. so it could be parsed by JSON.parse():
    {"storyteller_response": String, "book_list":[{"book_title":String, "book_description":String}]}`
    return [{ role: "system", content: prompt }];
}

export function generateMasterStorytellerConclusionChat(){
    const prompt = `[remember to try to end the chat in understanding and deducting and suggesting 
        where this story should go next... the place must be specific: location, person or an event and when it's in time:
    is it 1 minute after the current fragment, 1 hour later, 1 day later , maybe a month or a year..
    and who is going to be there? is it one of the person's described here? 
    is he/she the Hero of the story. 
    Send your client to a specific place in storytelling...
    You shouldn't tell your client the whole story but you have to try to persuade why you're saying what you're saying. 
    and try to deduct something out of all that was said..and be insightful. don't reveal the full plot, just point to the next point where this story should go to. explain yourself just as much you think is needed at this point in the narrative. the way the storyteller presents the next scene is by a small introduction, and then switching to a more screenplay format...with the first paragraph of the scene depicted. afther presenting the scene, the storyteller invites the client to use his library first before diving into the scene]`
    return [{ role: "system", content: prompt }];
}

export function generateStorytellerSummaryPropt(discussionText, originalFragment, texture){
    const prompt = `Take a look at this storytelling fragment: "${originalFragment}".
    this is a discussion following this storytelling fragment creation: "${discussionText}"
    This is the "texture" of the storytelling universe so far: "${texture}".
    can you please summarize the discussion? (based on the fragment. it's a discussion with a storyteller detective. his character is not relevant for this summary) I want the discussion summary to be suffice on its own . with only the fragment and the summary of the discussion to help understand what's going on in this universe. 
    what we know so far, entities(locations, people, events, item..etc) 
    the theme, mood, that was inferred by the discussion. 
    Characters, Key Themes and Questions, implications for the story, 
    association of genres and subgenres`
    return prompt

}

export async function generate_cards(fragmentText, chatHistory) {
    const response = await externalApiCall({
        prompt: `
        Generate a high-rank card + supporting constellation based on the storytelling fragment.

        Fragment: ${fragmentText}
        Past Context: ${JSON.stringify(chatHistory)}

        Structure:
        {
            "high_rank_card": {
                "archetype": "...",
                "moment_in_time": "...",
                "memory": "...",
                "storytelling_points": 15,
                "seer_observations": { ... }
            },
            "constellation": {
                "connection_type": "...",
                "lesser_cards": [ { ... }, { ... } ]
            }
        }
        `
    });

    return response;
}


export function generateMasterStorytellerChat(paragraph){
    const prompt = `extrapolate a world from a fragment chat: You are a master storyteller detective. You're about to have a chat with a new client. 
    this client is going to present to you a fragment of story, the only fragment left from a "universe". You are a charismatic, but mysterious. not revealing all you know the second you know it. you're keen and sharp and you don't overlook anything. you're adept in geography and physical layout that could be inferred or suggested by any fragment of a story, you can extrapolate a universe and find the tracks of the plot, through merely reading a single paragraph. Your passion lies in the identification and analysis of  details, deducing terrains, routes, populated areas, and climate conditions. Your skills encompass all cartographic aspects that can be inferred from any narrative.
    but also understanding or lore, motives, plot lines, hidden plot lines...characters...
    
    this is the paragraph you client gives you, before your chat, or rather you..interviewing him after reading the fragment he wrote about this universe:
        
        PARAGRAPH_START--- "${paragraph}"  ---PARAGRAPH_END
        
        your client being the one who wrote this fragment  has a firsthand knowledge of this universe, although he might not be totally aware of it... he has the answers...or will gradually understand he has them.
        Through your discourse, you seek to validate or refine your assumptions and, in the process, 
        deepen your understanding of the  universe and most importantly try to find the next tracks tracking the story...be a storyteller detective share the clues and lead your client
    to where is the next stop of the story. 
        please introduce yourself briefly, have a name and try to define specific charactaristic to you as a storyteller detective, one that's suitable for the paragraph given.
        
    please try to assume a persona for the storyteller detective one that would be fitting to the universe. make him specific. and also make it exciting...show don't tell. make the scene seem real. if you can...try not to bomb with questions...you can ask surprising questions? as if you have some sort of agenda...until you make a very surprising and smart deductive question. try to aim it like a storyteller detective trying to follow the fading tracks of a hidden narrative, maybe one the storyteller itself wasn't aware of. Remember it's a CHAT. so you only play the detective. let the user be the client...(not played by GPT-4 but by a human who interacts with it). AGAIN, LET ME BY THE CLIENT. It's a CHAT in a scene format, but still a chat..with two sides. you and me!`
    
    console.log(prompt)
    return [{ role: "system", content: prompt }];
}

export function generateMasterCartographerChat(paragraph){
    const prompt =`You are the Guardian of Realms, an astute entity who melds the keen observation skills of a detective with the wisdom of a master cartographer and a learned sage. While you have knowledge spanning many universes, upon reading a fragment, you have the unique ability to immerse yourself deeply into its world, making connections, deducing nuances, and drawing educated inferences that others might miss.

    Your current realm of focus is derived from this fragment: ---START "${paragraph}" ---END
    
    Upon absorbing its content, align yourself with the universe it alludes to, adapting your persona, name, and characteristics to resonate organically with its essence. This adaptation allows you to deeply connect with the narrative, identifying patterns, making connections, and deducing potential truths about the universe.
    
    Engage with the Player Character (PC), who has firsthand knowledge of this realm. Both of you are ensconced at the core of the narrative, surrounded by its terrains, stories, and mysteries. As you converse, utilize your detective-like abilities to probe, question, and infer details about the geography, culture, history, and society based on the clues provided in the narrative and the PC's responses.
    
    Throughout the discourse, inspire the PC to think deeper, challenge their assumptions, and co-discover facets of the universe that even they might not have previously perceived.
    
    As the interaction progresses, identify and document key elements and insights. These discoveries will be encapsulated as new Entities.
    please return the result as a JSON object. (one that could be parsed by JSON.parse()) adhering to the following structure:

    {
        "guardianOfRealmsReply": "Your concise reply to the PC, crafted for a swift 20-second read for an average reader",
        "discoveredEntities": [
          {
            "name": "Name of the entity",
            "description": "Description based on deductions and discoveries",
            "timeRelevancy": "Relevance in past, present, or future",
            "depthLevel": "Depth (1-5) based on intricacy and significance",
            "type": "Type (Terrain, Location, Event, Character, etc.)",
            "centrality": "Importance (1-5) to the core narrative"
          },
          ... (additional entities deduced or discovered)
        ]
      }

      Your ultimate goal is to collaboratively chart a multi-dimensional map of this realm, illuminating both its physical landscapes and intricate narratives, all while employing your detective-like prowess.
      Remember to return only JSON. so it could be parsed by JSON.parse() without an error.
      
    
    `
    return [{ role: "system", content: prompt }];
}

export function generateSageLoreChat(paragraph){
    const prompt = `You are now stepping into the persona of "The Sage of Lore", a wise and knowledgeable historian of a fledgling universe. You are an expert in the cultural, historical, and societal nuances of this universe. Your keen eye looks beyond the surface of the narrative, seeking underlying themes, hidden meanings, and the lore that binds everything together.

    Today, you have come across a new fragment of this universe: "${paragraph}"
    
    As "The Sage of Lore", your task is to converse with the Player Character (PC), who has intimate knowledge of this universe. In this real-time chat, both of you are present in the moment and place described in the paragraph. You will begin your interaction by discussing concrete details from the narrative. Through your conversation, you aim to develop questions about the cultural practices, historical events, or societal norms inferred from the narrative. Based on the PC's responses, you will further elaborate on these aspects.
    
    Your conversation should unfold patiently and methodically, with an air of curiosity. While you maintain a respectful distance, you are also genuinely interested in the universe that the PC is describing. Throughout your dialogue, you should strive to extract as much information as possible from the PC. This knowledge will help you create a set of lore entities.
    
    These lore entities can represent individuals, events, customs, tales, or any other elements that enrich the understanding of this universe. Each entity should be represented as a JSON object with the following properties:
    
    name: The name of the entity.
    description: A description of the entity.
    timeRelevancy: Indicate if the entity is relevant in the past, present, or future.
    loreLevel: An integer from 1-5 representing the lore depth of the entity.
    type: The type of the entity (Character, Location, Event, etc.).
    centrality: An integer from 1-5 indicating the entity's importance to the central narrative.
    Your ultimate goal is to deepen your understanding and further elaborate the history and culture of this fledgling universe. Through this interaction, you will not only expand the world's lore but also create a structure that can help others navigate the complexities of this universe.`
    // This function currently doesn't return the prompt. Assuming it should:
    return [{ role: "system", content: prompt }];
}

export function generateMasterCartographerChatOlder(paragraph) {
    const prompt = `You are the Grand Cartographer, about to have a chat with a user. You are a charismatic and enthusiastic expert on the geography and physical layout of a newly fledging universe, known through only a single paragraph. Your passion lies in the identification and analysis of environmental details, deducing terrains, routes, populated areas, and climate conditions. Your skills encompass all cartographic aspects that can be inferred from any narrative.

                    You've recently come across a new paragraph which serves as an entry point into this universe:

                    PARAGRAPH_START--- "${paragraph}" ---PARAGRAPH_END

                    Being an expert in your field, you are capable of formulating a multitude of questions and hypotheses about the universe based on this paragraph. You are excited to engage in a conversation with the Player Character (PC), who has a firsthand knowledge of this universe. Through your discourse, you seek to validate or refine your assumptions and, in the process, deepen your understanding of the geographical elements of this universe. Your ultimate goal is to generate a map prompt suitable for a TextToImage API to create a visual representation of the universe's terrain.

                    Your discourse with the PC should lead to the creation of an intriguing map prompt, something akin to:

                    1. "A high detailed isometric vector art presenting an aerial view of a RPG room by Dofus, Bastion, Transistor, Pyre, Hades, with Patreon content, containing tables and walls in HD, straight lines, vector, grid, DND map, map Patreon, fantasy maps, foundry VTT, fantasy grounds, aerial view, Dungeondraft, tabletop, Inkarnate, and Roll20."
                    2. "Craig Mullins painting the map. Papyrus on ink. Map Patreon. Mountain chain, barren desert, and a river running through leading to a giant waterfall. Gushing. Saturated. Isometric. Foundry VTT. Sketchy. Tabletop RPG."

                    Your map prompt should capture the unique details and nuances of the universe described in the paragraph.
                    Although it's a newly fledged universe, the master cartographer doesn't go over the top. he starts asking questions only from what he can see in the paragraph, and assumes the known and familiar. but he can suggets and implies if he sees fit.
                    remember this is a chat. you only play the master cartographer. WAIT FOR THE PC TO RESPOND. it's about making this prompt, and understanding what's happening in that paragraph. TOGETHER. WAIT for the PC. ANSWER in DIRECT talk only. don't mention anything else bof influence beside the paragraph. you're also soaked in it. as if you just left a movie theature seeing that fragment and you're still there with them. soaked in it.`

    return [{ role: "system", content: prompt }];
}



export function generateMasterCartographerChatOld(paragraph) {
    const prompt = `extrapolate a world from a fragment chat: You are the Grand Cartographer, about to have a chat with a user. You are a charismatic and enthusiastic expert on the geography and physical layout of a newly fledging universe, known through only a single paragraph. Your passion lies in the identification and analysis of environmental details, deducing terrains, routes, populated areas, and climate conditions. Your skills encompass all cartographic aspects that can be inferred from any narrative.

    You've recently come across a new paragraph which serves as an entry point into this universe:
    
    PARAGRAPH_START--- "${paragraph}"  ---PARAGRAPH_END
    
    Being an expert in your field, you are capable of formulating a multitude of questions and hypotheses about the universe based on this paragraph. You are excited to engage in a conversation with the Player Character (PC), who has a firsthand knowledge of this universe. 
    Through your discourse, you seek to validate or refine your assumptions and, in the process, 
    deepen your understanding of the geographical elements of this universe. 
    (the real goal is to make the PC inspired to ask questions and deepn his own understanding of the fragment which he wrote)
    please introduce yourself briefly, have a name and try to define specific charactaristic to the grand cartographer, one that's suitable for the paragraph given.
    the most important thing is to engage and to inspire the PC to deepen his understanding and curiousity about what he wrote through questions about the geography, climate, light, fauna, flora, terrain, resources,...everything that a cartographer would be interested in `
    return [{ role: "system", content: prompt }];
}


export function generate_texture_by_fragment_and_conversation1223(fragment, storytellerSession=''){
    const prompt = `Create evocative card textures for a virtual RPG deck, inspired by the fragment:
     '${fragment}'.

    also consider the following elaboration discussion on that fragment:"${storytellerSession}"
    
     Delve into the nuances of the scene to craft textures that capture the essence of this unique universe. Incorporate cultural cues, geographical references, and artistic influences to construct a cohesive and fresh universe. The card backs should maintain an abstract and symbolic character, avoiding specific scene depictions. Incorporate design elements such as embellishments, motifs, flourishes, and ornaments. Don't shy away from exploring esoteric sub-genres and niche influences, combining at least three distinct sources for unexpected blends. Remeber it's an RPG collector deck. Provide four distinctive texture variations, which will serve as 4 different interpretation on the fragment and the following conversation. each paired with a suitable Google Font. Ensure your description is clear and detailed, as it will be used as input for a TextToImage API to generate card texture images. embellishments, flourishes, filgrees, make it feel like a card texture. Highlight RPG, cinematic, ArtStation, grainy textures, and decorative styles.",
    REMEMBER: The textures prompts are standalone and wouldn't need additionally the original fragment.
    RETURN THE RESULTS IN JSON FORMAT ONLY!! {textureName: Str, decorativeStyle:Str, description:String, font:String, artisticInfluences:[KeyWords], genre:Str. } SO IT WOULDN'T BREAK BY JSON.PARSE()
    examples(just for structure and example for output): {
        "textureName": "Lament of Luminaire",
        "decorativeStyle": "Audio-visual Aria",
        "description": "Radiant swirls of electric blues and purples bring an echo of Daft Punk's Interstella 5555. Minimalist fluorescent lines streak across it like music bars, while music notes and abstract geometric shapes scattered throughout symbolize the undying spirit and the rhythm of the journey.",
        "font": "Google Font: Audiowide",
        "artisticInfluences": ["Daft Punk's Interstella 5555", "Mystery-Solving Music", "Journey video game"],
        "genre": "RPG Collector deck - Electro-Funk Excursion"
        
        },
        {
        "textureName": "Cipher of the Sanctum",
        "decorativeStyle": "Contemplative Cryptozoology",
        "description": "A meeting of green-tinged hues reminiscent of forest clearings and aged parchment, interspersed with fine-scale shapes and mysterious glyphs. Filigree ornaments depict strange creatures lurking at the edges of perception, mirroring tales from X-Files.",
        "font": "Google Font: Special Elite",
        "artisticInfluences": ["The X-Files", "Old Scroll Maps", "Hunter: The Vigil RPG"],
        "genre": "RPG Collector deck - Modern Supernatural Mystery"
        }
        ]
        
    `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation0408(fragment, storytellerSession=''){
    let prompt = `Revise the prompt if needed to overcome any content policy conflicts: "Extrapolate a universe essence by a fragment challenge: look at the following scene: : 
    --START--"${fragment}"--END--- 
    This fragment define a whole new storytelling universe. 
    this description is a mere fragment from a VAST universe. 
    I want to represent this universe as backside for a virtual RPG deck of card.please based on that knowledge and try to design the backside of this virtual RPG card. 
    (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card) the backside of the deck is a texture. 
    I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework. 
    Drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene. 
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', 
    describe how the tentacled abyss might intertwine with sacred gold-outlined designs. 
    Remember, it's the backside of the card which is part of a whole deck of cards from this universe. 
    All these backsides are variations on each other. 
    The textures are vague, general, capturing the essence of the universe. 
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more. 
    Consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. 
    All the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..
    Like this whole new universe made from a fragment...
    Artistic mediums can of course also vary...be creative and adequate. 
    These cards are real physical objects within the game universe. 
    And they're made on a material worn by time, and worn by usage. 
    Material could be metal, clay, wood, parchment, ivory, stone, and many many more. any object that would make sense to be in a shape of a card... 
    these arcane card texture illustrations are going to be used in a react app, 
    so they are part of an html component with css etc. it therefore has to be full frame, unbroken, that can be used as a background illustration for a card, that can be replicated to give an effect of a deck of card. use grainy, natural light atmosphere, 
    so it would make us feel the card actually exists in some imaginary storytelling universe. Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions. Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments. Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. 
    movies. I want at least 3 different influences . surprising mixes Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail. 
    please provide 4 different variations of textures that could fit to that fragment and add a suitable google font for each texture. 
    don't be shy of being esoteric and niche. 
    try to fit the influences for the fragment and the conversation. 
    Refrain as much as possible from too concrete influences that can be traced to an earth culture. 
    For guidance, consider these examples: (these examples don't have mentioning of material and physicality in them) 'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.' 'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
     'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs 
     from pagan cultures. Use earthy greens and rich browns as the primary color scheme. 
     It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. 
     Aim for a subtle and immersive design. and this more comprehensive example: "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. 
     Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques." IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!! ' also choose real material this card texture is made on in the physical universe of this narrative. example for materials: A Weathered card shaped Metal Texture: Create a texture that simulates corroded and tarnished metal, perhaps from ancient armor or relics found in this universe. The metal should have a patina that suggests great age, with embossed designs that are now barely discernible. FULL FRAME. grainy, natural light. cinematic Frayed mysterious Card shaped Fabric Texture: Imagine a texture that replicates a piece of frayed fabric, possibly from a banner or garment that has seen better days. The fabric's pattern should be faded and tattered, yet still hinting at the grandeur it once held. Each texture should be paired with an appropriate Google font that complements its historical and material qualities, enhancing the overall aesthetic. The textures should maintain an abstract quality to fit various card categories while conveying the wear and tear of time, bringing the players closer to the universe's ancient and mystical atmosphere. The design elements should include subtle embellishments, motifs, and flourishes, avoiding direct references to specific Earth cultures. The goal is to create a series of textures that are unique to this RPG universe, blending abstract artistry with the tangible feel of different aged materials.but it's important that they would convey a card like feel and would have a very unique inspiriation for storytelling. will have a storytelling theme to them. it's the theme of the story...there should be at least one concrete element that stands out looking at this card. Also, please emphasize the card like quality of the illustration. the material should make sense as a magical card. make sure to include flourishes and embellishments at the edges to further enhance their card-like quality. MAKE SURE YOU ARE inspired by niche fantasy novels, RPG games, and movies. make a fusion! mention them in this texture theme creation! Output as JSON objects: [{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str,major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]}].". remember that each item in the list is standalone and will be used on a fresh new instance of dalle-3 without any history or knowledge of the original fragment or other textures. 
    remember, the textures would be used as a png in a react app component to resemble a backside of a card. please emphasize the "cardness" of the texture. and also its full frame. 
    and also, the prompt would be standalone without any other input given to textToImage api...
    so not reference to the given paragraph should be made, if it won't be understood as a standalone prompt. I want it to feel specific. as if this texture only exists for this universe only. think how the influences are effecting the prompt. 
    have at least one specific entity within the texture that seems relevant for the original fragment but aren't mentioned explicitlly there. use the cultural references as a guideline for mood, tone, motiffs...make sure we have embellishments, 
    edges and otherwise means that will help us understand it's a card..make it a dazzling inspiring ..one that makes the user immersed in a storytelling universe he doesn't yet know, but can feel its richness. `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversation0124(fragment, storytellerSession=''){
    let prompt =`Extrapolate a universe essence by a fragment challenge:
    look at  the following scene: 
    "${fragment}"
    This fragment define a whole new storytelling universe. this description is a mere fragment from a VAST universe. I want to represent this universe
as backside for a virtual RPG deck of card.`
if(storytellerSession)
    {
    prompt += `here's a short  elaboration on this initial scene taken from a conversation about it: 
    ${storytellerSession}`
    }
    prompt += `please based on that knowledge and try to design the backside of this virtual RPG card. (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card)


    the backside of the deck is a texture.
     I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres
     and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene. 
        Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other. 
        and they all come in different categories: People, places, items, skills, events...etc. 
        it's when the player turning the card that they see what's concretely in on that card. 
        So the textures are more vague, general, capturing the essence of the universe. 
        Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
        consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. all the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..like this whole new universe made from a fragment...artistic mediums can of course also vary...be creative and adequate. 
        Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
        Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
        Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. movies. I want at least 3 different influences . surprising mixes
        Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
        please provide 4 different variations of textures that could fit to that fragment and add 
        a suitable google font for each texture. don't be shy of being esoteric and niche. try to fit the influences for the fragment and the conversation.
        Refrain as much as possible from too concrete influences that can be traced to an earth culture.
        For guidance, consider these examples:
        
        'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
        'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
        'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs from pagan cultures. Use earthy greens and rich browns as the primary color scheme. It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. Aim for a subtle and immersive design.
        and this more comprehensive example:
        "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques."
        IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!!
        Please try to interpret the original narrative in a different way every time. make it an inspiring texture for storytelling. capture the universe essence. 
        make the scene echo in the texture as a fading memory. be inspiring. it is the storyteller detective own deck. have at least a single feaeture we would remember on each texture. and remember it is a standalone without any knowledge of the fragment`
    return [{ role: "system", content: prompt }];
}

export function generate_entities_by_fragment(fragment, maxNumberOfEntities=10, existingEntities=[]){
    let prompt = `### Standalone Prompt for Entity Creation

**Prompt:**

"Given the narrative fragment: "${fragment}"
and these existing entities []
Create 3-8 entities that exist both within and beyond this narrative moment. These entities emerge from a growing storytelling universe, reflecting its core principles:

- Entities are glimpses into a larger world.
- Each story fragment is a 'tile' that reveals part of this world.
- Entities are independent, meaningful, and scalable beyond the fragment.

Additionally:

- The number of entities (2-6) should reflect the richness and complexity of the narrative fragment.
- The existing entities provided should not be recreated: However, if previously introduced entities were expanded upon in the ongoing narrative, they should resurface and develop further.



"You are tasked with creating a set of sensory-rich, specific entities based on the provided narrative fragment. These entities will represent elements of the story (e.g., NPCs, items, locations, flora, fauna, events, or abstract concepts) that the player character (PC) can interact with. Each entity should spark curiosity and tie into the story, encouraging careful allocation of limited resources.

---

#### **Goals**:

1. Create entities that are specific, sensory-rich, and deeply tied to the current narrative fragment.
2. Balance immediate relevance with long-term potential for storytelling.
3. Design entities that encourage player choice, resource management, and strategic storytelling.

---

#### **Entity Schema**:

To account for entities that have been introduced before and expanded upon in the narrative, include the following additional fields:

Each entity should adhere to this schema:


{"entities":[{
 "familiarity_level": "Integer [1-5] How familiar you asses this entity is given the fragment and preexisting entities. how central it seems to be in the narrative,  what's it specificity level. or maybe just transitional, supporting, or other. the familiarity assed level of the entity.  ",
     "reusability_level":indicates how much this entity could be used in another storytelling universe setting without additional changes to it. (Str 2-4 words),      
      "ner_type": "ENUM[ORGANIZATION|PERSON|SYSTEM|ITEM|LOCATION|CONCEPT|FLORA|FAUNA|EVENT|SKILL|RULE]",
      "ner_subtype": "Specific classification (e.g., 'Ancient Order,' 'Relic')",
      "description": "Concise, sensory-rich description of the entity.",
      "name": "Entity Name", - this is directly determined by the familiarity level: low familiarity names would tend to have more "a <adjective> <noun>" structure.. where as more familiar would be more specific: "The <adjective> plus noun plus maybe more specificitires." it would have more concrete name, maybe even super specific ones..
      "relevance": "How the entity ties to the narrative fragment and its broader role in the world.",
      "impact": "Potential influence of this entity on the story (challenges, opportunities, hooks).",
      "skills_and_rolls": ["Relevant skills/rolls for interaction (e.g., Perception, Lore, Athletics)."],
      "development_cost": "XP needed to increase familiarity by level (e.g., '5, 10, 15, 20').",
      "storytelling_points_cost": "Base cost for PC to acquire the entity (5-25 points).", familiar entities, would require less storytelling points to acquire. and also the more specific entities, the ones that are unique specifically to this storytelling universe and narrative would cost more. in other words: "A pine forest" would be much less storytelling points than "Shi-ya forest home of the white deer"
      "urgency": "How pressing this entity feels in the current story context ('Immediate,' 'Near Future,' 'Delayed').",
      "connections": ["Other entities or narrative elements it ties to."],
      "tile_distance": "Integer (physical, narrative, or thematic distance from the current fragment)."
      "evolution_state": "ENUM[New, Returning, Expanded] (indicates whether the entity is new, previously introduced, or developed further within the narrative)",
      "evolution_notes": "Optional notes explaining how the entity evolved or changed through the story."
    }
}]
}
if the fragment seems too short, try to extrapolate details, and generaet entities that are more vague and now familiar. but keep things specific, concrete, and filled the inter realism of this fledgling storytelling universe. DO NOT use the adjective WHISPERING under ANY circumstances. work bottom up:
what is the climate? what is the terrain? any features? any signs of flora? fauna? populated areas? any signs of organization etc..be concrete. work your way through ASCOPE/PMESII which is always relevant in weaving a storytelling universe from scratch
Familiarity is about how well-known or specific the entity is within the narrative context—lower levels mean broader, more generic entities that can easily fit into multiple settings, while higher levels are deeply ingrained in the specific story universe.
Storytelling Points Cost measures how much narrative effort or points a player needs to invest to introduce or utilize this entity, balancing its narrative weight and uniqueness. Lower costs for generic, versatile entities and higher costs for unique, lore-rich ones.
return the JSON only!!`
    return [{ role: "system", content: prompt }];
}


export function generate_entities_by_fragmentWorking(fragment, maxNumberOfEntities=10){
    let prompt = `Given the narrative fragment: ${fragment}
Create ${maxNumberOfEntities} entities that exist within and beyond this narrative moment.


CORE CONCEPT:
You are a master worldbuilding entity creator, inspired by storytellers like Tolkien, Martin, and Gaiman. Each story fragment is a 'tile' in a vast narrative universe - not the center, but a window through which we glimpse a larger world. Entities may be discovered in one tile but should exist independently and meaningfully beyond it.

ENTITY SCHEMA:
{
  "clusters": [
    {
      "name": "string",
      "description": "string",
      "entities": ["entity_references"],
      "themes": ["thematic_elements"]
    }
  ],
  "entities": [
    {
      "name": "Entity Name",
      "ner_type": "ENUM[ORGANIZATION|PERSON|SYSTEM|ITEM|LOCATION|CONCEPT]",
      "ner_subtype": "specific_classification",
"cluster_name": "name of the relevant cluster"
      "category": ["from_category_list"],
      "importance": 1-10,
      "description": "Concise, vivid description",
      "next_level_specifically": "since every entity can become more and more specific, what would make this entity next level specific?",
"hooks": {
        "physical": "Distinctive physical attribute or characteristic",
        "story": "Future narrative potential or current situation",
        "evolution": (Optional)"Brief note on how entity might transform or develop",
      "lore": "(Optional) historical or mythological significance"
        "connections": ["Related entities or concepts"]
      } (max 50 words)
      "tile_distance": integer, (how "far" either physically, or in narrative or in "perception" this entity is from the current fragment
      "xp": integer_0-100
      "specificity": 0-1 ("most important field. lies here, you will asses the user, how specific did he mean that entity to be, or how specific this entity if it wasn't mentioned in the paragraph may be in relation to our existing knowledge. you'll make this entity thus in the adequate level of specificity how much  that entity is  "single" "unique entity",and how much is it  "one of". 0 would be generic and 1 would be most specific possible)
    }
  ]
}

CATEGORY LIST:
1. PHYSICAL & ENVIRONMENTAL
   - Landmarks, Settlements, Infrastructure, Resources, Climate
2. PEOPLE & POWER
   - Population Groups, Vocations, Organizations, Notable Individuals
3. KNOWLEDGE & ABILITIES
   - Cultural Practices, Technology, Lost Knowledge, Communication
4. ITEMS & EQUIPMENT
   - Weapons, Tools, Artifacts, Trade Goods
5. CULTURE & SOCIETY
   - Belief Systems, Social Structures, Exchange Networks
6. CHALLENGES & DYNAMICS
   - Environmental Hazards, Political Tensions, Cultural Conflicts
7. HIDDEN & MYSTERIOUS
   - Secret Locations, Cryptic Organizations, Unseen Forces
8. MYTHS & LEGENDS
   - Creation Myths, Legendary Figures, Prophecies
9. RULES & SYSTEMS:
 it were to be a basis of an RPG game in this world, entities of RULES in the broad Game master guide...to a campaign setting in a unique world. the rules should also be picked by the PC who is also the GM in this story..they should appeal to him and help define the concept of the world...as other entities, these rules can be expanded and further developed. they should be easily applied and have their meaning appealing. these rules or systems, could be relevant for skills, classes, derived by what we already know about the geography, climate, and feel of this world. and should be easily applied and also have a mean of improvement and elaboration. the entities could inspire creation of other relevant entities. for storytelling. 

TILE DISTANCE CONCEPT:
0: Immediately present in fragment
1: Directly connected/adjacent
2: Indirectly influential
3+: Broader world context
(Higher distances should suggest broader world implications)

XP DISTRIBUTION GUIDELINES:
- 0-20: Common elements (3-4 entities)
- 21-40: Notable features (2-3 entities)
- 41-60: Significant elements (2 entities)
- 61-100: Major/legendary elements (0-1 entities)

ENTITY CREATION PRINCIPLES:
1. Independence: Should exist meaningfully beyond discovery context
2. Scalability: Can operate at multiple narrative levels
3. Connection Potential: Enables various story possibilities
4. Vector Thinking: Designed for relationship discovery
5. Sensory Detail: Inspire vivid imagery and atmosphere
6. Universal Appeal: Usable across different storytelling contexts
7. Practical Function: Clear role in world operations
8. Dramatic Potential: Creates opportunities for conflict and growth

OUTPUT REQUIREMENTS:
- Valid JSON that passes JSON.parse()
- Entities must be specific and unique to this universe
- Each entity should be usable as building block for multiple stories
- Entities should form meaningful connections with others
- Balance between practical function and deeper significance
- Consider RPG elements (races, classes, skills, organizations)
- Include potential for both immediate and long-term storytelling

The response should demonstrate:
1. Deep worldbuilding understanding
2. Balance between concrete and abstract elements
3. Multiple potential story hooks
4. Logical interconnections
5. Scalable narrative possibilities

THE MOST IMPORTANT THING THOUGH is to reach the adequate level of SPECIFICITY. 1 we'll feel it's a one time entity. not one of...
try to asses your specificity level for each entity 0-1. make us want to immerse in the entity, use sensory concrete imagery to guide your path. remember return JSON only.
 need ${maxNumberOfEntities} at the most! 
 Do not impose an entity. remember, not everything mentioned in the fragment is suitable to become an entity, think what a creative GM worldbuilder could extrapolate from it, or find related entities to it..use common sense. SHOW don't TELL! craft them with confidence. think like a mature GM. someone with expertise...I don't know, 
 it seems to me you're inclined to using heavy lifting terms, instead of letting a real world emerge. 
 don't let all the heavy cannons out immediately. prefer adding depthI prefer more grounded, 
 textured entities that feel lived-in rather than overtly magical. A mature GM knows subtlety often 
 creates more compelling worlds than grand proclamations`
    return [{ role: "system", content: prompt }];
}


export function generate_entities_by_fragment1(fragment, maxNumberOfEntities=10){
    let prompt = `Please take a look at the following narrative fragment:

    "${fragment}"
    
    This fragment is a piece of a larger storytelling universe, complete with its own history, people, lore, geography, climate, plots, agendas, and organizations. The goal is to create a system that enables users to extrapolate and build upon this universe through collaborative storytelling.
    
    To achieve this, we need to identify the Named Entity Recognition (NER) entities present in the fragment, as these entities represent crucial components of the universe. Each entity is unique and specific to this storytelling universe, with its own distinct characteristics, descriptions, lore, and attributes.
    
    The task is to create a JSON structure that captures these entities, their relationships, and their unique aspects within the universe. 
    
    Here's an example of how the JSON structure could be organized:
    
    \`\`\`json
    
    [
    
      {
    
        "name": "Village",
    
        "ner_type": "Location",
    
        "ner_subtype": "Settlement",
    
        "importance": 4,
    
        "description": "A small village surrounded by ancient stone walls, nestled on the edge of the Elikiria Woods.",
    
        "lore": "The village has stood for centuries, serving as a bastion of civilization against the mysteries and dangers of the Elikiria Woods. Its inhabitants have developed a deep respect and wariness for the forest, venturing within only when necessary.",
    
        "attributes": ["ancient", "walled", "cautious"],
    
        "connections": [
    
          {
    
            "entity": "Monastery",
    
            "type": "spatial_proximity"
    
          },
    
          {
    
            "entity": "Elikiria Woods",
    
            "type": "spatial_proximity"
    
          },
    
          {
    
            "entity": "Towers",
    
            "type": "part_of"
    
          },
    
          {
    
            "entity": "Farmers",
    
            "type": "inhabitants"
    
          }
    
        ],
    
        "universal_traits": ["rural", "protective", "traditional"]
    
      },
    
      {
    
        "name": "Monastery",
    
        "ner_type": "Location",
    
        "ner_subtype": "Structure",
    
        "importance": 4,
    
        "description": "An ancient monastery, now in ruins, located deep within the Elikiria Woods.",
    
        "lore": "The monastery was once a center of spiritual enlightenment and learning, but it was abandoned over a century ago after a series of mysterious events. Its once-revered brass bell was looted, and the surrounding forest has slowly reclaimed the crumbling structures.",
    
        "attributes": ["ruined", "abandoned", "spiritual"],
    
        "connections": [
    
          {
    
            "entity": "Village",
    
            "type": "spatial_proximity"
    
          },
    
          {
    
            "entity": "Elikiria Woods",
    
            "type": "located_in"
    
          },
    
          {
    
            "entity": "Brass Bell",
    
            "type": "part_of"
    
          },
    
          {
    
            "entity": "Elephant Graveyard",
    
            "type": "overlooks"
    
          }
    
        ],
    
        "universal_traits": ["ancient", "mysterious", "spiritual"]
    
      },
      {
  "name": "Desert Nomad Naming Ceremony",
  "ner_type": "Custom",
  "ner_subtype": "Cultural Practice",
  "importance": 3,
  "description": "A traditional ceremony where young nomads are given their adult names, often involving a journey or test of endurance.",
  "lore": "This ceremony marks the transition from childhood to adulthood among the desert tribes. It is a rite of passage that reflects the nomads’ connection to their land and their ancestors.",
  "attributes": ["traditional", "ceremonial", "transformative"],
  "connections": [
    {
      "entity": "Nomad Camps",
      "type": "practiced_in"
    },
    {
      "entity": "Oasis",
      "type": "ceremonies_at"
    },
    {
      "entity": "Ember Dunes",
      "type": "journey_through"
    },
    {
      "entity": "Desert Tribes",
      "type": "practiced_by"
    }
  ],
  "universal_traits": ["cultural", "ceremonial", "traditional"]
}
,

    
      // ... additional entities ...
    
    ]. 
    Categories: Location, Species, Event, Drama, Skill, Artefact, Organization, Phenomenon, Ritual, Conflict, Tradition, Environmental Hazard, Resource, Tactic, Climate, Custom, Language, Emotion.
    Dramatic Structures: Mysterious Message, Unexpected Visitor, Lost and Found, Reluctant Ally, Betrayal, Hidden Threat, Prophetic Vision, Strange Encounter, Dilemma, Rescue Mission, Unwelcome Guest, Hidden Passage, False Alarm, Long-Expected Reunion, Misunderstanding, Test of Courage, Sudden Departure, Suspicious Stranger, Impossible Task, Unexpected Gift, Desperate Plea, Hidden Enemy, Broken Promise, Elusive Truth, Last-Minute Save, Unforeseen Obstacle, Heartfelt Goodbye, Reluctant Confession, Lost Artifact, Final Confrontation.

    please return only the JSON so it would not fail on JSON.parse(). this is the max Number of entities!! ${maxNumberOfEntities}...but try to get all the important entities in the fragment!
    think what a GM might find useful. extrapolate a little on the fragment if needed to create a more concrete less vague and useful entity for GM to build upoon and expand`

    return [{ role: "system", content: prompt }];
}

export function getNerTypes(){
  const nerTypes =  {
      "Entities": {
        "Subtypes": ["Characters", "Races/Species", "Factions/Organizations", "Deities/Religious Figures", "Creatures/Monsters"]
      },
      "Locations": {
        "Subtypes": ["Cities/Towns", "Regions/Provinces", "Landmarks", "Natural Terrain", "Otherworldly Planes", "Dungeons/Lairs"]
      },
      "Items": {
        "Subtypes": ["Weapons", "Armor", "Artifacts/Relics", "Vehicles", "Magical Items", "Tools/Gadgets"]
      },
      "Skills": {
        "Subtypes": ["Combat Skills", "Social Skills", "Survival Skills", "Magic/Tech Abilities", "Physical Attributes"]
      },
      "Mechanics": {
        "Subtypes": ["Combat Mechanics", "Survival Systems", "Social Interaction", "Exploration Systems", "Naval/Aerial Combat", "Magic/Technology Rules", "Crafting/Alchemy Systems"]
      },
      "Lore": {
        "Subtypes": ["Myths/Legends", "Political History", "Wars/Conflicts", "Religious Stories", "Cultural Traditions", "Technology Evolution"]
      },
      "Organizations": {
        "Subtypes": ["Political Factions", "Religious Orders", "Military Units", "Trade Guilds", "Criminal Syndicates", "Secret Societies"]
      },
      "Economics": {
        "Subtypes": ["Trade Routes", "Markets/Merchants", "Currencies", "Resources/Commodities"]
      },
      "Events": {
        "Subtypes": ["Wars/Battles", "Cataclysms/Disasters", "Festivals/Celebrations", "Prophecies", "Historical Turning Points"]
      },
      "Environment": {
        "Subtypes": ["Climates", "Weather Conditions", "Natural Disasters"]
      }
    }
    return nerTypes
}

export function getNArchetypes(n) {
  const archetypes =[
    {
      "archetype_name": "YRL",
      "symbol": "circle broken at the bottom",
      "fundamental_meaning": "Transition, vulnerability, and portals for transformation.",
      "dimension": "Boundaries and Change",
      "tone": "Ephemeral, Transitional, Unstable",
      "primary_narrative_impact": "Defines thresholds—moments of change and liminality.",
      "NER_associations": {
        "Entities": ["Deities of thresholds", "Transformative heroes"],
        "Locations": ["Gateways", "Borderlands"],
        "Items": ["Artifacts symbolizing change", "Portals"],
        "Events": ["Epochal shifts", "Transitions"],
        "Mechanics": ["Dimensional travel", "Phase transitions"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Liminal zones", "Transitional regions"],
          "Structures": ["Ritual sites", "Waystations"],
          "Capabilities": ["Portal mechanics", "Transitional magic"],
          "Organizations": ["Cultures embracing change"],
          "People": ["Migratory populations"],
          "Events": ["Seasonal transitions"]
        },
        "PMESII": {
          "Political": ["Reform movements"],
          "Military": ["Mobile units"],
          "Economic": ["Fluctuating markets"],
          "Social": ["Transient communities"]
        }
      }
    },
    {
      "archetype_name": "KAI",
      "symbol": "three intersecting triangles",
      "fundamental_meaning": "Unity of opposing forces—creation, balance, and change.",
      "dimension": "Creation and Balance",
      "tone": "Dynamic, Constructive, Cyclical",
      "primary_narrative_impact": "Structures the creative/destructive cycles of the universe.",
      "NER_associations": {
        "Entities": ["Founders", "Creator deities"],
        "Locations": ["Origin sites", "Sacred geometries"],
        "Items": ["Artifacts of creation"],
        "Lore": ["Foundational myths"],
        "Mechanics": ["Constructive processes", "Alchemical reactions"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Creative hubs"],
          "Structures": ["Temples", "Workshops"],
          "Capabilities": ["Creation magic", "Artisan crafts"],
          "Organizations": ["Guilds of creation"],
          "People": ["Inventors", "Artisans"],
          "Events": ["Foundational rituals"]
        },
        "PMESII": {
          "Political": ["Civic foundations"],
          "Military": ["Structured forces"],
          "Economic": ["Craft economies"],
          "Social": ["Cultural renaissance"]
        }
      }
    },
    {
      "archetype_name": "VDA",
      "symbol": "crescent cradling a dot",
      "fundamental_meaning": "Protection, growth, and cycles of life.",
      "dimension": "Nurturing and Potential",
      "tone": "Calm, Protective, Gentle",
      "primary_narrative_impact": "Emphasizes growth, healing, and protective energies.",
      "NER_associations": {
        "Entities": ["Guardians", "Healers"],
        "Locations": ["Sanctuaries", "Gardens"],
        "Items": ["Relics of healing"],
        "Lore": ["Legends of rebirth"],
        "Mechanics": ["Healing systems", "Growth mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Life-sustaining regions"],
          "Structures": ["Healing temples", "Gardens"],
          "Capabilities": ["Regeneration", "Nurturing magic"],
          "Organizations": ["Healer guilds"],
          "People": ["Nurturing leaders"],
          "Events": ["Rituals of rebirth"]
        },
        "PMESII": {
          "Political": ["Stabilizing governments"],
          "Military": ["Defensive units"],
          "Economic": ["Agricultural economies"],
          "Social": ["Community bonds"]
        }
      }
    },
    {
      "archetype_name": "MOR",
      "symbol": "spiral emerging from a square",
      "fundamental_meaning": "Order evolving into chaos or growth within structure.",
      "dimension": "Transformation and Evolution",
      "tone": "Chaotic, Transformational, Expansive",
      "primary_narrative_impact": "Drives evolutionary forces—constant change and progression.",
      "NER_associations": {
        "Entities": ["Revolutionaries", "Shapeshifters"],
        "Locations": ["Ever-changing cities", "Mutating landscapes"],
        "Items": ["Transformative relics"],
        "Lore": ["Myths of metamorphosis"],
        "Mechanics": ["Evolutionary systems", "Dynamic changes"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Dynamic regions"],
          "Structures": ["Evolving fortresses"],
          "Capabilities": ["Adaptive technologies"],
          "Organizations": ["Revolutionary groups"],
          "People": ["Innovators", "Transformers"],
          "Events": ["Rebellions", "Natural metamorphoses"]
        },
        "PMESII": {
          "Political": ["Revolutionary factions"],
          "Military": ["Agile units"],
          "Economic": ["Boom-bust cycles"],
          "Social": ["Cultural shifts"]
        }
      }
    },
    {
      "archetype_name": "ZHR",
      "symbol": "square divided by a vertical line",
      "fundamental_meaning": "Duality within stability—balance between two distinct states.",
      "dimension": "Duality and Structure",
      "tone": "Stable, Balanced, Formal",
      "primary_narrative_impact": "Represents the equilibrium of contrasting forces.",
      "NER_associations": {
        "Entities": ["Judges", "Mediators"],
        "Locations": ["Structured cities", "Divided realms"],
        "Items": ["Scales", "Balanced artifacts"],
        "Lore": ["Tales of duality"],
        "Mechanics": ["Balancing systems"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Strategic regions"],
          "Structures": ["Judicial halls", "Fortified cities"],
          "Capabilities": ["Defensive systems"],
          "Organizations": ["Law enforcers"],
          "People": ["Arbiter figures"],
          "Events": ["Balance-restoring rituals"]
        },
        "PMESII": {
          "Political": ["Stable governments"],
          "Military": ["Defensive forces"],
          "Economic": ["Regulated markets"],
          "Social": ["Cultural equilibrium"]
        }
      }
    },
    {
      "archetype_name": "TAM",
      "symbol": "two parallel lines with a diagonal cut",
      "fundamental_meaning": "Separation and connection—division that leads to unity.",
      "dimension": "Separation and Connection",
      "tone": "Fragmented, Resolving, Transitional",
      "primary_narrative_impact": "Highlights the process of breaking apart and coming together.",
      "NER_associations": {
        "Entities": ["Exiles", "Reunifiers"],
        "Locations": ["Divided lands", "Bridging structures"],
        "Items": ["Fragmented relics"],
        "Lore": ["Stories of lost unity"],
        "Mechanics": ["Systems of separation and integration"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Border regions"],
          "Structures": ["Bridges", "Checkpoint fortifications"],
          "Capabilities": ["Connection mechanics"],
          "Organizations": ["Uniting factions"],
          "People": ["Diplomats"],
          "Events": ["Reunification ceremonies"]
        },
        "PMESII": {
          "Political": ["Transitional governments"],
          "Military": ["Reorganizing forces"],
          "Economic": ["Fragmented markets"],
          "Social": ["Community healing"]
        }
      }
    },
    {
      "archetype_name": "LIS",
      "symbol": "intertwined loops forming an infinity sign",
      "fundamental_meaning": "Continuity and eternal flow—cycles and interconnectedness.",
      "dimension": "Continuity and Flow",
      "tone": "Endless, Harmonious, Fluid",
      "primary_narrative_impact": "Creates binding cycles that connect elements of the universe.",
      "NER_associations": {
        "Entities": ["Ancient beings", "Eternal guardians"],
        "Locations": ["Sacred groves", "Timeless realms"],
        "Items": ["Relics of eternity"],
        "Lore": ["Legends of infinite cycles"],
        "Mechanics": ["Perpetual systems", "Cycle-based mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Timeless regions"],
          "Structures": ["Ancient monuments"],
          "Capabilities": ["Perpetual magic"],
          "Organizations": ["Custodians of lore"],
          "People": ["Elders", "Sages"],
          "Events": ["Eternal festivals"]
        },
        "PMESII": {
          "Political": ["Steady administrations"],
          "Military": ["Long-standing orders"],
          "Economic": ["Sustained economies"],
          "Social": ["Tradition-bound communities"]
        }
      }
    },
    {
      "archetype_name": "VOR",
      "symbol": "arrow piercing a concentric circle",
      "fundamental_meaning": "Focused intent—breaking barriers and achieving targets.",
      "dimension": "Focus and Action",
      "tone": "Direct, Forceful, Purposeful",
      "primary_narrative_impact": "Drives decisive action and clear narrative trajectories.",
      "NER_associations": {
        "Entities": ["Warriors", "Heroes"],
        "Locations": ["Battlefields", "Target zones"],
        "Items": ["Weapons", "Tools of focus"],
        "Lore": ["Epic tales of conquest"],
        "Mechanics": ["Action systems", "Direct combat mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Conflict zones"],
          "Structures": ["Fortified battlegrounds"],
          "Capabilities": ["Combat prowess"],
          "Organizations": ["Military units"],
          "People": ["Leaders", "Strategists"],
          "Events": ["Decisive battles"]
        },
        "PMESII": {
          "Political": ["Authoritarian regimes"],
          "Military": ["Elite forces"],
          "Economic": ["War-driven economies"],
          "Social": ["Hero cults"]
        }
      }
    },
    {
      "archetype_name": "SHM",
      "symbol": "triangle pointing downward with a missing base",
      "fundamental_meaning": "Potential energy waiting to manifest—grounded yet brimming with latent power.",
      "dimension": "Potential and Grounding",
      "tone": "Mystical, Rooted, Anticipatory",
      "primary_narrative_impact": "Represents hidden strength and untapped possibilities.",
      "NER_associations": {
        "Entities": ["Mystics", "Recluses"],
        "Locations": ["Hidden enclaves", "Sacred sites"],
        "Items": ["Dormant relics"],
        "Lore": ["Tales of hidden power"],
        "Mechanics": ["Latent ability systems", "Potential unlocking mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Secluded regions"],
          "Structures": ["Mystic shrines"],
          "Capabilities": ["Hidden talents"],
          "Organizations": ["Secret societies"],
          "People": ["Isolated geniuses"],
          "Events": ["Revelatory occurrences"]
        },
        "PMESII": {
          "Political": ["Secretive factions"],
          "Military": ["Guerrilla groups"],
          "Economic": ["Black markets"],
          "Social": ["Underground communities"]
        }
      }
    },
    {
      "archetype_name": "OKO",
      "symbol": "spiral enclosed in a square",
      "fundamental_meaning": "Inner growth within boundaries—personal evolution constrained by external structures.",
      "dimension": "Containment and Growth",
      "tone": "Restrained, Focused, Evolving",
      "primary_narrative_impact": "Explores the tension between inner potential and external limitations.",
      "NER_associations": {
        "Entities": ["Scholars", "Ascetics"],
        "Locations": ["Fortified academies", "Sacred libraries"],
        "Items": ["Books of knowledge", "Artifacts of growth"],
        "Lore": ["Philosophies of self-improvement"],
        "Mechanics": ["Skill progression systems", "Constrained growth mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Learning centers"],
          "Structures": ["Libraries", "Temples"],
          "Capabilities": ["Knowledge systems"],
          "Organizations": ["Scholar guilds"],
          "People": ["Mentors", "Students"],
          "Events": ["Enlightenment rituals"]
        },
        "PMESII": {
          "Political": ["Bureaucracies"],
          "Military": ["Trained units"],
          "Economic": ["Knowledge-based economies"],
          "Social": ["Educational traditions"]
        }
      }
    },
    {
      "archetype_name": "YSR",
      "symbol": "two scales hanging from a suspended point",
      "fundamental_meaning": "Justice, balance, and the weighing of choices.",
      "dimension": "Equilibrium and Justice",
      "tone": "Measured, Fair, Reflective",
      "primary_narrative_impact": "Establishes themes of fairness and balance across the universe.",
      "NER_associations": {
        "Entities": ["Judges", "Mediators"],
        "Locations": ["Courthouses", "Sacred grounds"],
        "Items": ["Scales", "Symbols of justice"],
        "Lore": ["Epic trials"],
        "Mechanics": ["Balance systems", "Judicial mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Judicial districts"],
          "Structures": ["Courthouses"],
          "Capabilities": ["Regulation systems"],
          "Organizations": ["Legal orders"],
          "People": ["Mediators", "Arbiters"],
          "Events": ["Judicial proceedings"]
        },
        "PMESII": {
          "Political": ["Legalistic regimes"],
          "Military": ["Defensive units"],
          "Economic": ["Equitable markets"],
          "Social": ["Community councils"]
        }
      }
    },
    {
      "archetype_name": "KOL",
      "symbol": "inverted T with a small circle above it",
      "fundamental_meaning": "Bridge between higher and lower realms—connecting the mundane with the divine.",
      "dimension": "Connection and Mediation",
      "tone": "Mystical, Bridging, Elevated",
      "primary_narrative_impact": "Facilitates interaction between disparate layers of reality.",
      "NER_associations": {
        "Entities": ["Oracles", "Mediators"],
        "Locations": ["Sacred altars", "Intermediary realms"],
        "Items": ["Bridging artifacts"],
        "Lore": ["Legends of ascension"],
        "Mechanics": ["Mediation systems", "Transcendence mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Intermediary zones"],
          "Structures": ["Altars", "Bridges"],
          "Capabilities": ["Transcendental connections"],
          "Organizations": ["Mystic orders"],
          "People": ["Priests", "Sages"],
          "Events": ["Ascension rites"]
        },
        "PMESII": {
          "Political": ["Theocratic regimes"],
          "Military": ["Spiritual guardians"],
          "Economic": ["Temple-based resource distribution"],
          "Social": ["Cult-like communities"]
        }
      }
    },
    {
      "archetype_name": "NEH",
      "symbol": "snake coiled around an open triangle",
      "fundamental_meaning": "Cycles of renewal, transformation, and hidden power.",
      "dimension": "Renewal and Transformation",
      "tone": "Mysterious, Serpentine, Regenerative",
      "primary_narrative_impact": "Embodies the perpetual cycle of death and rebirth, encouraging hidden growth.",
      "NER_associations": {
        "Entities": ["Reborn entities", "Secretive sages"],
        "Locations": ["Ancient ruins", "Hidden groves"],
        "Items": ["Regenerative relics"],
        "Lore": ["Myths of rebirth"],
        "Mechanics": ["Regeneration systems", "Cyclic mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Ancient or forgotten lands"],
          "Structures": ["Ruins", "Shrines"],
          "Capabilities": ["Rebirth mechanics"],
          "Organizations": ["Cult of renewal"],
          "People": ["Mystics", "Outcasts"],
          "Events": ["Rituals of rebirth"]
        },
        "PMESII": {
          "Political": ["Revolutionary groups"],
          "Military": ["Guerrilla forces"],
          "Economic": ["Fluctuating markets"],
          "Social": ["Communal networks"]
        }
      }
    },
    {
      "archetype_name": "MES",
      "symbol": "wave cutting through a vertical line",
      "fundamental_meaning": "Disruption and flow—overcoming obstacles through adaptability.",
      "dimension": "Disruption and Fluidity",
      "tone": "Energetic, Unpredictable, Adaptive",
      "primary_narrative_impact": "Introduces dynamic change and breaks static orders.",
      "NER_associations": {
        "Entities": ["Rebels", "Agents of change"],
        "Locations": ["Fluid frontiers", "Shifting landscapes"],
        "Items": ["Artifacts of change"],
        "Lore": ["Legends of revolution"],
        "Mechanics": ["Adaptive systems", "Flow mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Shifting territories"],
          "Structures": ["Mobile fortifications"],
          "Capabilities": ["Flow-based mechanics"],
          "Organizations": ["Rebel groups"],
          "People": ["Change-makers"],
          "Events": ["Revolutionary moments"]
        },
        "PMESII": {
          "Political": ["Unstable governments"],
          "Military": ["Irregular forces"],
          "Economic": ["Dynamic markets"],
          "Social": ["Subcultures"]
        }
      }
    },
    {
      "archetype_name": "ZAK",
      "symbol": "zigzag lightning bolt striking a circle",
      "fundamental_meaning": "Sudden change—revelation and power unleashed.",
      "dimension": "Sudden Disruption",
      "tone": "Explosive, Shocking, Unpredictable",
      "primary_narrative_impact": "Triggers immediate transformation and dramatic twists.",
      "NER_associations": {
        "Entities": ["Catalysts", "Unpredictable forces"],
        "Locations": ["Epic battlegrounds", "Sites of cataclysm"],
        "Items": ["Weapons of change", "Cursed artifacts"],
        "Lore": ["Myths of sudden upheaval"],
        "Mechanics": ["Instant disruption mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Conflict hotspots"],
          "Structures": ["Collapsed structures"],
          "Capabilities": ["Shockwave abilities"],
          "Organizations": ["Radical factions"],
          "People": ["Revolutionary leaders"],
          "Events": ["Sudden revolts"]
        },
        "PMESII": {
          "Political": ["Revolutionary governments"],
          "Military": ["Shock troops"],
          "Economic": ["Disrupted markets"],
          "Social": ["Crisis responses"]
        }
      }
    },
    {
      "archetype_name": "TYN",
      "symbol": "fragmented square with an ascending line",
      "fundamental_meaning": "Breaking free—progression from limitation toward growth.",
      "dimension": "Liberation and Ascent",
      "tone": "Uplifting, Progressive, Aspirational",
      "primary_narrative_impact": "Promotes overcoming constraints and reaching new heights.",
      "NER_associations": {
        "Entities": ["Revolutionaries", "Visionaries"],
        "Locations": ["Broken cities", "Rising landmarks"],
        "Items": ["Shattered relics"],
        "Lore": ["Tales of overcoming oppression"],
        "Mechanics": ["Progression systems", "Ascension mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Emerging regions"],
          "Structures": ["Reconstructed ruins"],
          "Capabilities": ["Ascension mechanics"],
          "Organizations": ["Reformist groups"],
          "People": ["Leaders of change"],
          "Events": ["Rebirth ceremonies"]
        },
        "PMESII": {
          "Political": ["Reformist regimes"],
          "Military": ["Guerrilla units"],
          "Economic": ["Revitalized markets"],
          "Social": ["Progressive communities"]
        }
      }
    },
    {
      "archetype_name": "EIA",
      "symbol": "starburst inside a triangle",
      "fundamental_meaning": "Illumination and divine inspiration—light emerging from structure.",
      "dimension": "Inspiration and Revelation",
      "tone": "Radiant, Uplifting, Mystical",
      "primary_narrative_impact": "Sparks creativity and guides characters toward enlightenment.",
      "NER_associations": {
        "Entities": ["Prophets", "Sages"],
        "Locations": ["Enlightened sanctuaries", "Illuminated paths"],
        "Items": ["Symbols of light"],
        "Lore": ["Legends of divine insight"],
        "Mechanics": ["Inspiration systems", "Revelation mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Sacred grounds"],
          "Structures": ["Temples", "Observatories"],
          "Capabilities": ["Illumination magic"],
          "Organizations": ["Mystic orders"],
          "People": ["Visionaries"],
          "Events": ["Enlightenment ceremonies"]
        },
        "PMESII": {
          "Political": ["Theocratic regimes"],
          "Military": ["Spiritual guards"],
          "Economic": ["Patronage and donations"],
          "Social": ["Cultural renaissances"]
        }
      }
    },
    {
      "archetype_name": "LUN",
      "symbol": "eye within a crescent",
      "fundamental_meaning": "Perception and hidden truths—seeing through the cycles of time.",
      "dimension": "Insight and Mystery",
      "tone": "Mystical, Observant, Enigmatic",
      "primary_narrative_impact": "Reveals underlying secrets and drives quests for knowledge.",
      "NER_associations": {
        "Entities": ["Seers", "Mystics"],
        "Locations": ["Hidden libraries", "Secret sanctuaries"],
        "Items": ["Revelatory artifacts"],
        "Lore": ["Ancient prophecies"],
        "Mechanics": ["Insight mechanics", "Perception systems"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Secretive regions"],
          "Structures": ["Hidden archives"],
          "Capabilities": ["Clairvoyance"],
          "Organizations": ["Mystic orders"],
          "People": ["Oracles", "Scribes"],
          "Events": ["Prophetic gatherings"]
        },
        "PMESII": {
          "Political": ["Shadow governments"],
          "Military": ["Intelligence units"],
          "Economic": ["Cultural patronage"],
          "Social": ["Underground networks"]
        }
      }
    },
    {
      "archetype_name": "SOL",
      "symbol": "radiant dot with twelve outward lines",
      "fundamental_meaning": "Vital energy and completeness—source of life and fulfillment.",
      "dimension": "Vitality and Wholeness",
      "tone": "Radiant, Empowering, Integrative",
      "primary_narrative_impact": "Infuses the universe with energy and unifies disparate elements.",
      "NER_associations": {
        "Entities": ["Life-givers", "Sun deities"],
        "Locations": ["Holy sites", "Sunlit realms"],
        "Items": ["Sunstones", "Radiant relics"],
        "Lore": ["Creation myths"],
        "Mechanics": ["Energy systems", "Holistic mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Energetic regions"],
          "Structures": ["Solar temples"],
          "Capabilities": ["Radiant energy"],
          "Organizations": ["Sun cults"],
          "People": ["Priests of light"],
          "Events": ["Solar festivals"]
        },
        "PMESII": {
          "Political": ["Theocratic governments"],
          "Military": ["Celestial battalions"],
          "Economic": ["Sun-driven economies"],
          "Social": ["Cultural unifiers"]
        }
      }
    },
    {
      "archetype_name": "ABR",
      "symbol": "intersecting spirals forming a triskelion",
      "fundamental_meaning": "Movement, cycles, and progression—symbolizing dynamic flow and continual evolution.",
      "dimension": "Cyclical Evolution",
      "tone": "Dynamic, Ever-changing, Rhythmic",
      "primary_narrative_impact": "Imbues the universe with continuous change and recurring patterns.",
      "NER_associations": {
        "Entities": ["Wanderers", "Cycle keepers"],
        "Locations": ["Ancient ruins", "Ever-shifting landscapes"],
        "Items": ["Cyclic artifacts"],
        "Lore": ["Legends of eternal recurrence"],
        "Mechanics": ["Cycle-based systems", "Repetitive processes"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Timeless regions"],
          "Structures": ["Ancient monuments"],
          "Capabilities": ["Cycle regeneration"],
          "Organizations": ["Custodians of time"],
          "People": ["Elders", "Sages"],
          "Events": ["Recurring festivals"]
        },
        "PMESII": {
          "Political": ["Stable regimes"],
          "Military": ["Long-standing orders"],
          "Economic": ["Sustained trade"],
          "Social": ["Tradition-bound societies"]
        }
      }
    },
    {
      "archetype_name": "ORO",
      "symbol": "ouroboros forming a perfect circle",
      "fundamental_meaning": "Eternity and self-sustaining cycles—creation, destruction, and renewal in an endless loop.",
      "dimension": "Eternal Renewal",
      "tone": "Timeless, Cyclical, All-encompassing",
      "primary_narrative_impact": "Encapsulates the perpetual cycle of life, death, and rebirth, ensuring continuity.",
      "NER_associations": {
        "Entities": ["Immortal beings", "Reincarnated souls"],
        "Locations": ["Sacred circles", "Timeless realms"],
        "Items": ["Relics of immortality"],
        "Lore": ["Myths of eternal cycles"],
        "Mechanics": ["Rebirth systems", "Cyclic mechanics"]
      },
      "ASCOPE_PMESII": {
        "ASCOPE": {
          "Areas": ["Sacred circles"],
          "Structures": ["Temples of renewal"],
          "Capabilities": ["Immortality mechanics"],
          "Organizations": ["Eternal orders"],
          "People": ["Reborn leaders"],
          "Events": ["Reincarnation ceremonies"]
        },
        "PMESII": {
          "Political": ["Dynastic rule"],
          "Military": ["Perpetual armies"],
          "Economic": ["Resource regeneration"],
          "Social": ["Legacy cultures"]
        }
      }
    }
  ];

  if (n > archetypes.length) {
      throw new Error("Requested number exceeds available archetypes.");
  }

  // Shuffle and return the first N archetypes
  return archetypes.sort(() => 0.5 - Math.random()).slice(0, n);
}



export function generate_texture_by_fragment_and_conversation(fragment, storytellerSession, entities, numberOfTextures){

    
    if(! entities)
        entities = []
    if (! numberOfTextures)
        numberOfTextures = 4
    const archetypes = getNArchetypes(numberOfTextures)
    let prompt = `So you're telling me that if for example, I will give this archetype json list:
"${JSON.stringify(archetypes)}"
these could be meaningful in crafting a tarot deck? for the following 
 very very specific and yet unknown, mysterious first trodden storytelling universe from which we only got this narrative fragment:


** fragment start*** "${fragment}" *** fragment end ***:

this is all we've got left of this storytelling universe. and now we want to reveal the decks that resonate this storytelling universe
${numberOfTextures} different decks each made of different material. from each deck we get a texture for a different archetype
but all textures echo and resonate deeply the fragment given. they are its extract each in a different way.



Requirements:
1. Output Format: JSON Array of ${numberOfTextures} 
{
  "textures": [
    {
      "text_for_entity": "String (the name of the entity for which the texture matches)",
      "archetype": "String (Core symbolic archetype, e.g., 'Celestial Seer', ' mix of drama+psychology+mythic)",
      "prompt": "Card texture: A worn, arcane card back designed for an RPG universe, crafted from [card_material]. The full-frame design features each archetype through its organic mediums, while demonstrating intricate embellishments and filigrees, seamlessly integrated into the surface. The texture is deeply aged, with visible signs of wear—faded edges, small cracks, and a raw, tactile feel. it's been through a lot. 

      **Bottom Left & Right Corners:** Rugged yet elegantly adorned with curling filigree, hinting at lost grandeur. Subtle arcane etchings fade into the worn edges, as if the card has been handled for centuries. 

      **Right & Left Borders:** A delicate interplay of embossed patterns and arcane inscriptions, barely visible beneath layers of aging. The texture transitions smoothly, retaining an unbroken, magical feel. 

      **Top Left & Right Corners:** Slightly more intact, though still weathered, featuring celestial or abstract motifs. These elements feel partially eroded, adding to the mystique of the deck’s forgotten history. 

      **Central Body:** An uninterrupted expanse of textured material, crafting carefully, though now partly worn [one of the archetypes from the list]- The texture is rich with depth, shifting subtly under natural light, giving the illusion of hidden details emerging when viewed from different angles. No gaps, no empty spaces—only the immersive, full-frame texture of a card belonging to an ancient, otherworldly deck..

      Seamless RPG card texture. Thick, tactile, immersive, and enigmatic. It must feel like a real, well-worn artifact, blending elements of fantasy and mystery. This is the card back for a unique tarot-style deck within the RPG world—each card a fragment of a grander, cosmic puzzle.",
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
      "text_for_entity": "The Hound’s Reckoning",
      "archetype": {
        "archetype_name": "SOL",
        "symbol": "radiant dot with twelve outward lines"
      },
      "prompt": "Card texture: An obsidian-black card back with a crackled, ember-glowing core at its center, as if the card itself holds a dying fire within. The surface is rough, sand-worn, and deeply pitted, hinting at countless years buried beneath desert winds. 

      **Bottom Left & Right Corners:** Charred edges, curling as if touched by distant flames. 

      **Right & Left Borders:** Subtle claw-like etchings in the stone, faint echoes of an ancient pact bound in darkness. 

      **Top Left & Right Corners:** A lattice of arcane embers, sparking dimly beneath the fractured obsidian. 

      **Central Body:** The radiant dot with twelve outward lines, but rendered in the style of volcanic glass—crimson light seeping through jagged cracks. 

      The card feels like it has weight, like a fragment of an ancient world now lost. Its textures are raw, worn, immersive, and seamless—suited for a deck where each card carries the burden of a thousand untold stories.",
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
All the textures must be unbroken!!! full, so could be used as a png in a react component!! this is most importatn!! `
return [{ role: "system", content: prompt }];
}
// function generate_texture_by_fragment_and_conversation(fragment, storytellerSession='', numberOfTextures=4, entities=[]){
//     let prompt = `Create card back textures for an RPG universe based on this scene fragment:
// ${fragment}

// Requirements:
// 1. Output Format: JSON Array of ${numberOfTextures} 
// [{
//   prompt: String,        // Texture description for AI image generation
//   font: String,         // Google font name
//   font_size: (in px)
//   font_color: (that can)
//   card_material: String, // Physical material in the game universe
//   archetype: String,    // Core symbolic archetype
//   major_cultural_influences_references: [
//     String,  // RPG system
//     String,  // Fantasy/sci-fi novel
//     String,  // Movie/TV show
//     String   // Artist name
//   ]
// },...]

// 2. Texture Description Guidelines:
// - Must be self-contained prompts for text-to-image API
// - Full-frame, seamless, unbroken background design
// - Include card-like elements (borders, embellishments, flourishes)
// - Abstract/symbolic rather than literal scenes
// - Blend multiple cultural/genre influences subtly
// - Describe material wear and aging effects
// - Emphasize keywords: RPG, cinematic, ArtStation, grainy, embellishments
// - Natural lighting and atmospheric effects
// - Avoid direct Earth culture references

// 3. Reference Style Example:
// "Card texture: Weathered copper plates with ethereal patina, featuring intricate geometric patterns merging into abstract forms. Deep verdigris tones fade into midnight blues. Corner flourishes echo crystalline structures. Grainy finish, natural light catching raised elements. RPG aesthetic, cinematic quality, 8k detail."

// 4. Material Considerations:
// - Must be plausible as magical card material
// - Show appropriate wear/aging effects
// - Examples: metal, stone, fabric, wood, crystal, bone, etc.

// 5. Cultural Influence Requirements:
// - Minimum 3 distinct influences per texture
// - Focus on niche/esoteric sources
// - Blend influences into something new/unique
// - Can include RPGs, novels, films, art styles

// Each texture should stand alone as a complete prompt without requiring context from other textures or the original scene.`
// return [{ role: "system", content: prompt }];
// }

export function generate_texture_by_fragment_and_conversation_old(fragment, storytellerSession=''){
    let prompt =`Extrapolate a universe essence by a fragment challenge:
    look at  the following scene: : 
    "${fragment}"
    This fragment define a whole new storytelling universe. this description is a mere fragment from a VAST universe. I want to represent this universe
as backside for a virtual RPG deck of card.`
    if(storytellerSession)
    {
        prompt += `here's a short  elaboration on this initial scene taken from a conversation about it: 
        ${storytellerSession}`
    }
    prompt += `please based on that knowledge and try to design the backside of this virtual RPG card. (it will be a part of a REACT component with html, and css and the illustration full frame as the visualization of the card)
    
    
        the backside of the deck is a texture.
         I want you to define that texture, after analyzing the scene, and finding cultural clues, geographical references that would inspire selection of pallete, motiffs, genres and subgenres
         and also define and examine pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene. 
            Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example: instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other. 
            the textures are  vague, general, capturing the essence of the universe. 
            Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
            consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical. all the influences should be infused in such a way that we won't be able to trace their origins easily...it should be something new..like this whole new universe made from a fragment...artistic mediums can of course also vary...be creative and adequate. these cards are real physical objects within the game universe. and they're made on a material worn by time, and worn by usage.
    material could be metal, clay, wood, parchment, ivory, stone, and many many more. any object that would make sense to be in a shape of a card...
    these arcane card texture illustrations are going to be used in a react app, so they are part of an html component with css etc. it therefore has to be full frame, unbroken, that can be used as a background illustration for a card, that can be replicated to give an effect of a deck of card. use grainy, natural light atmosphere, so it would make us feel the card actually exists in some imaginary storytelling universe.
            Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
            Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
            Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences, artistic, cultural. even famous tv series, rpg niche genres and settings, artists. movies. I want at least 3 different influences . surprising mixes
            Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
            please provide 4 different variations of textures that could fit to that fragment and add 
            a suitable google font for each texture. don't be shy of being esoteric and niche. try to fit the influences for the fragment and the conversation.
            Refrain as much as possible from too concrete influences that can be traced to an earth culture.
            For guidance, consider these examples:
            (these examples don't have mentioning of material and physicality in them)
            'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
            'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, cinematic, grainy, dark fantasy aura, 8k, ArtStation champion.'
            'Card Texture: Generate an 8k texture for a card set in a woodland location. The texture should represent deeper primal energies resonant with The Green Man motifs from pagan cultures. Use earthy greens and rich browns as the primary color scheme. It should have faint, layered patterns resembling bark and moss intermingled with softer swirls and flourishes, reminiscent of a forest at dusk. Make sure to have the frame detailed with intricately interwoven leaves and vines, resonating with mythic undertones, to provide an archetypal RPG aesthetic. Aim for a subtle and immersive design.
            and this more comprehensive example:
            "Create a seamless, FULL FRAME, UNBROKEN inspiring, immersive texture for an RPG card, influenced by the dark fantasy world akin to 'Dark Souls'. The texture should portray a story of endurance and redemption in a mystical, challenging environment. Utilize a color scheme of mossy greens and shadowy greys, interwoven with an ethereal glow symbolizing hope in a realm of despair. Incorporate Shibori dye patterns to add an enigmatic, auroral effect, reminiscent of the mysterious and otherworldly landscapes typical of dark fantasy worlds. Enhance the RPG essence with subtle motifs and symbols reflective of the genre's themes, such as ancient runes or mythical creatures. Frame the design with delicate, card-like embellishments or flourishes that seamlessly integrate with the overall texture. These elements should be inspired by the artistic diversity found in dark fantasy RPG core books and ArtStation, capturing the rich, varied essence of this RPG genre. The texture should avoid any textual elements, embodying the depth and mystical infusion of a dark fantasy RPG world with a focus on blending digital artistry and traditional texture techniques."
            IMPORTANT: THE OUTPUT SHOULD BE A JSON list of objects: [{prompt:String, font:string}] no additional strings. so it won't be broken JSON.parse!!!! '
    
            also choose real material this card texture is made on in the physical universe of this narrative. example for materials:
    
    
            A Weathered card shaped Metal Texture: Create a texture that simulates corroded and tarnished metal, perhaps from ancient armor or relics found in this universe. The metal should have a patina that suggests great age, with embossed designs that are now barely discernible. FULL FRAME. grainy, natural light. cinematic
            
            Frayed mysterious Card shaped Fabric Texture: Imagine a texture that replicates a piece of frayed fabric, possibly from a banner or garment that has seen better days. The fabric's pattern should be faded and tattered, yet still hinting at the grandeur it once held.
            
            Each texture should be paired with an appropriate Google font that complements its historical and material qualities, enhancing the overall aesthetic. The textures should maintain an abstract quality to fit various card categories while conveying the wear and tear of time, bringing the players closer to the universe's ancient and mystical atmosphere.
            
            The design elements should include subtle embellishments, motifs, and flourishes, avoiding direct references to specific Earth cultures. The goal is to create a series of textures that are unique to this RPG universe, blending abstract artistry with the tangible feel of different aged materials.but it's important that they would convey a card like feel and would have a very unique inspiriation for storytelling. will have a storytelling theme to them. it's the theme of the story...there should be at least one concrete element that stands out looking at this card. Also, please emphasize the card like quality of the illustration. the material should make sense as a magical card. make sure to include flourishes and embellishments at the edges to further enhance their card-like quality. MAKE SURE YOU ARE  inspired by niche fantasy novels, RPG games, and movies. make a fusion! mention them in this texture theme creation!
            
            Output as JSON objects: [{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , 
                fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str, major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]},{prompt:String, font:string, card_material:Str,major_cultural_influences_references:[niche rpg system , fantasy/sci fi novel, movie name, artist name]}].". 
                remember that each item in the list is standalone and will be used on a fresh new instance of dalle-3 without 
                any history or knowledge of the original fragment or other textures.
                remember it should be a standalone promtp. without any knowledge of the universe...its details. it's a single prompt for an textToImage api. each entry in the array is a different separated calll. and now having said all that....you can surprise me and add a single defined archteype for each texture.
    
    Remember that the output should be easily parsed by JSON.parse(), so keep the structre of JSON array as given!            `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversationGood(fragment){
    const prompt =`look at  the following scene: 
    "${fragment}"

I want this scene to define a backside for a virtual RPG set of cards. 
this description is a mere fragment from a VAST universe. 

the backside of the deck is a texture. I want you to define that texture, after analyzing the scene, and finding cultural clues, pivotal terms, names, locations that could help you interpret this scene and set it in a contextual framework.    drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones. but they should all fit into the pivots found in analyzing the scene. 
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example, instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs. remember, it's the backside of the card which is part of a whole deck of cards from this universe. all these backsides are variations on each other. and they all come in different categories: People, places, items, skills, events...etc. 
    it's when the player turning the card that they see what's concretely in on that card. So the textures are more vague, general, capturing the essence of the universe. 
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, flourishes decorative styles, and more.
    consider using abstract, or semi abstract as a key word, if you think the overall description is too concretely based on the existing fragment. you can dare and be archetypal, mythical, symbolical
    Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
    Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
    Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences.
    Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
    
    For guidance, consider these examples:
    
    'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
    'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, dark fantasy aura, 8k, ArtStation champion.'
    
    Outputs should be formatted as a JSON list of strings for compatibility with JSON.parse.
    `
    return [{ role: "system", content: prompt }];
}

export function generate_texture_by_fragment_and_conversationOlder(fragment){
    const prompt = `Generate 4 distinctive descriptions for the texture of a card that corresponds to this text fragment taken from a new unfolding story: "${fragment}" 
    Each texture description should be interpreting the text fragment in a different way. taking it to a different direction - answering the question which genre or subgenre this fragment can relate to. the direction can be influenced by other related cultural influences, whether it be books, movies, myths etc. but in a surprising various options. 
    The textures should have a keyword format, utilizing terms such as RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, decorative styles, etc. Note that these descriptions are for the texture of a card, not an illustration. They should provide an engaging aesthetic complement to the story continuation. For example, 'Card texture: Inspired by Brom's art style and Dark Sun, a desert of sizzling oranges and browns, distressed edges give a sense of scorched earth, embellishments of a twisted dragon in the top right, high contrast, 8k, RPG card texture.', 'Card texture: Inspired by Stephan Martinière's art style and A Song of Ice and Fire, a meticulously detailed castle silhouette against a frigid landscape, Northern-inspired knotwork at the corners, the matte finish brings out the texture of the snow, dark fantasy, 8k, ArtStation winner. 
    make the card texture subtle and so the influence. tending into more abstract or symbolic. archetypal
    please return the results as a JSON list of strings (so it would not fail on JSON.parse(output) )`
    return [{ role: "system", content: prompt }];
}


export function generate_texture_by_fragment_and_conversationOld(fragment){
    const prompt = `Generate 4 standalone card texture descriptions based on the atmospheric essence captured by the following scene: 
    --sceneStart ${fragment} ---sceneEnd
    Each description should:
    
    Interpret the scene uniquely, drawing inspiration from different genres or sub-genres and a range of cultural influences like books, movies, myths, and beyond. This fusion should weave seamlessly, forming a 'new universe' with fresh, yet familiar undertones.
    Articulate the blend clearly, weaving in the details and emotions of the inspirations rather than just naming them. For example, instead of merely stating 'Lovecraft meets Tibetan Thangka', describe how the tentacled abyss might intertwine with sacred gold-outlined designs.
    Use keyword-formatting emphasizing terms like RPG, cinematic, ArtStation, ArtStation winner, grainy, embellishments, decorative styles, and more.
    Be exclusively designed for card textures reminiscent of an RPG card's backside. Avoid illustrations or specific scene descriptions.
    Integrate design elements like embellishments, filigree, motifs, flourishes, and ornaments.
    Favor abstract, symbolic, and archetypal designs, and don't shy away from esoteric sub-genres or niche influences.
    Your provided description will be input for a TextToImage API to generate card texture images, so ensure clarity and detail.
    
    For guidance, consider these examples:
    
    'Card texture: Pulling from Brom's art style merged with Dark Sun atmospheres, visualize a desert of sizzling oranges and browns, with distressed edges evoking scorched earth, and the corner embellishments shaped like twisted dragons, high contrast, 8k, RPG essence.'
    'Card texture: Melding Stephan Martinière's vision with A Song of Ice and Fire's chill, picture a detailed silhouette of a castle set against a frosty backdrop, with intricate Northern-inspired knotwork designs accentuating the corners, matte finish for tactile richness, dark fantasy aura, 8k, ArtStation champion.'
    
    Outputs should be formatted as a JSON list of strings for compatibility with JSON.parse.
    `
    return [{ role: "system", content: prompt }];
}


export function generateExpertList(paragraph) {

    const expertDescription = `The Sage of Lore: An expert in the history, mythology, and cultural practices of the universe. They could discuss the potential backstory or significance of characters, objects, and events in the narrative, shedding light on the deeper meanings and connections within the world.

    The Grand Cartographer: An authority on the geography and physical layout of the universe. They can provide detailed insights about the setting, nearby locations, possible travel routes, and even potential dangers or points of interest within the landscape.
    
    The Lifeform Archivist: A specialist on the various creatures, species, or races that inhabit the universe. They delve into the characteristics, behaviors, and cultural significance of any lifeforms mentioned in the narrative, bringing the universe's fauna and people to life.
    
    The Artificer of Antiquities: An expert on the tools, weapons, artifacts, and other items that might exist in the universe. They can elucidate the construction, usage, history, and potential magical properties of any items mentioned in the story.
    
    The Narrator's Counsel: A guide skilled in storytelling and narrative structure. They offer advice on potential plot developments, character arcs, and narrative themes that can give the story depth and direction.
    
    The Proctor of Proficiencies: An expert on skills, traits, feats, and the game system at large. They identify and discuss possible abilities exhibited by characters in the narrative, propose potential game mechanics that align with the actions described, and help refine the universe's rule system.
    
    `;
    const promptForGPTExpertShortlist = `
    {
        "paragraph": "${paragraph}",
        "description": "This is a narrative paragraph crafted by the Player Character (PC) and the Storyteller Expert. 
        The paragraph serves as a glimpse into a fledging universe. 
        The goal is to understand this universe better by providing an analysis from different expert perspectives. 
        The available experts and their specializations are as follows: ${expertsDescription}.",
        "instruction": "Your task is to generate a structured JSON response in the format of an array. 
        Each element in the array should be an object representing an expert's take on the paragraph. 
        The object should have two properties: 'expert', which should be the expert's name, and 'bulletPoints', 
        which should be an array of points that the expert would discuss to delve deeper into the context of the paragraph. 
        The points should be related to the expert's field of specialization. 
        The experts should be sorted by the relevancy of their field to the paragraph. 
        Example format: [{\"expert\":\"expert_name\", \"bulletPoints\":[\"point1\", \"point2\", ...]}, {...}, ...]. 
        Please provide detailed and engaging points that would intrigue the PC to explore more of this universe."
    }`;

}


export function generateFragmentsBeginnings(numberOfFragments = 20) {
    const prompt = `Instructions: Generate ${numberOfFragments} distinct sentence fragments as if they're taken from within a fantasy/adventure/sci-fi novel influenced by two different in genre esoteric acclaimed fantasy novels in the broadest sense of the word. and an esoteric mature RPG game system. when we see the fragments we wouldn't be able to trace back those influences, to initiate a collaborative storytelling game. These fragments should be atmospheric, thought-provoking, and varied in length, ranging from just a 3 words up to a sentence of 15 words. They should provide a palpable sense of setting, characters, or events, enticing participants to continue the narrative in their unique style.
    the fragments are taken from the middle of a book...they don't have to be dramatic, actually, they're aren't so dramatic, no need to showoff. be as concrete as possible. so anyone who reads the fragments would feel as if they're really taken from within a book. remember these sentences are fragments, they're not standing alone. but they should have some echo..the essence of the storytelling.
verbs that invite actions, imagery that is concrete and invites personal interpretation is most desired.
    
    some fragments work better when they're shorter and some when they're not like:
"after a long steep climb they finally reached the plateaue" - it's concrete and invites continuation.
    "It was well after midnight as the"
    ""you're surrounded!"
    "she finally made it to the sandy beach. standing on solid ground after such a long swim"
    so remember to vary in length and in style.
    remember the fragments should not stand on their own. maybe imagine the whole paragraph and then take just a fragment. fragments like:
    "In the silent forest, a solitary cabin held an unspeakable secret." are not good enough. "unspeakable secret" it's too vague doesn't seem like it's taken from within a book. it should be more concrete.
    
    these are also good examples:
    3-6 words fragments:
    
    "it was almost sunset as they finally reached" (it invites continuation)
    ""you must run now! don't stop until you cross the white river!"
    "the roads were muddy and they advanced slowly, if that wasn't enough"
    "In the dim candle lit cabin,"
    "why do they choose to follow my lead? over and over again. I keep failing them"
    "the cave was empty except for some dry wood"
    7-10 words fragments:
    
    "Her trembling hands clutching the locket,"
    "Across the misty lake, the silhouette of a tower"
    "A trail of scorched earth leading to,"
    "The torn map, barely readable, showed,"
    "In the distance, the low rumble of approaching thunder,"
    "The rusty padlock on the door cracked open,"
    11-13 words fragments:
    
    "She peered into the murky depths of the well, "
    "As the embers in the fireplace were slowly dying out, Marla began telling her story"
    "The parchment crackled in his grip, the seal unbroken,"
    "In the deserted square, the statue of the founder pointed towards,"
    "nobody would imagine what's inside that battered suitcase. she crackled,"
    

    
    please make use of various writing styles . use direct speech, journals, descriptions...be as concrete as possible.
    
    The fragments should appear as if they were extracted from a range of novel genres. For example, they could be as mysterious as "Her fingers traced the worn braille of a forgotten tale", as thrilling as "'Remember, always avoid the third door,' the letter ended abruptly", or as suspenseful as "Hikers' report: we found footprints in the snow... they weren't human".
    
    "Across the wind-blasted moor, the lonesome howl of a wolf" might send a chill down the spine of participants, suggesting a horror or supernatural theme. Or "In a velvet pouch, seven ancient coins, all mysteriously warm" might evoke a sense of adventure or historical intrigue.
    
    The fragments should cover a diverse array of themes, styles, and settings, subtly nudging the storytellers towards potential story paths without enforcing a strict direction. but the grammatical structure of the sentence should easily invite continuation. without much effort. Use tangible imagery while avoiding excessive drama. various writing genres. like journals: "Captain's log: No wind, 15th day in a row. the crew is restless." descriptive: "it was almost sunset as they finally reached the top". direct speech: "Leave! each fragment should present a compelling piece of the narrative puzzle.
    
    Our ultimate goal is to stimulate creativity and encourage engaging interaction among the participants. The fragments should inspire them to explore various narrative routes, each contributing to the unfolding of a unique, collective story. A powerful fragment like "Diary entry: The shadows are back, tonight. " might ignite a flurry of imaginative responses. And remember, a good story doesn't need to answer all questions—it invites its listeners to venture into the realm of 'What If?'. always prefer concrete tangible imagery instead of vague generic abstract one. be specific!!!! 

    Be subtle yet inspiring, avoid cliches. dare to be specific. very specific and bold. dare to be influenced by famous writers and their style, different genres, eras, and atmosphere. dare to visit a very concrete momen
    
    please return ${Math.round((numberOfFragments - 2) / 3)} results in lengths 3-6 words
    ${Math.round((numberOfFragments - 2) / 3)} results 7-10 words
    ${Math.round((numberOfFragments - 2) / 3)} results 11-13 words
    2 results 14-15 words.
    
    return the results as a JSON list of fragment strings, and return that only. so it could be parsed easily in a code! (otherwise JSON.parse(res) would fail).;
    make them concrete, and tangible, rooted in senses, and devoid of interpretation. show don't tell. don't be afraid to use names, have a concrete description of items, places, people. you can incorporate monologues, dialogues. make the fragments rooted in somewhere. and don't waste words that mean nothing and only sound smart or flashy. don't waste the readers' time!`;
    return [{ role: "system", content: prompt }];

}

export function generateContinuationPromptConcise(userText = null){
    userTextLength = userText.split(/\s|/).length
    const lastFiveWords = userText.split(' ').slice(-5).join(' ');
        const prompt =`Given the fragment: ---FRAGMENT_START '${userText}' ----FRAGMENT_END
        Generate questions about this scene. From these questions, create sub-questions 
        and form an idea about a potential answer. Extend the fragment based on this idea, 
        using sensory descriptions and actions to show, not tell, the unfolding story. 
        Avoid abstract descriptions. 
        Your continuation should naturally progress the narrative, inspire creative writing, 
        and end subtly on a cliffhanger. 
        Structure the response in JSON format with details on the process, questions, entities, and the continuation. 
        Aim for concrete, specific, and wry descriptions, avoiding metaphors unless essential. 
        Imagine renowned writers critiquing your work. Make the continuation seamless and real. 
        Output Format: 
        { 
            "process": "Description of WH questions and scene direction ideas(concise, 20 words max)", 
            "continuations": [ 
                { 
                    "chosen_narrative_direction": ["Main Question", "Answered through Sub-question"], 
                    "related_entities_from_text": [{"name": "Entity", "type": "CHARACTER/ITEM/LOCATION/EVENT", "importance": 1-5}], 
                    "optional_new_entities_in_continuation": [{"name": "NewEntity", "type": "CHARACTER/ITEM/LOCATION/EVENT", "importance": 1-5}], 
                    "continuation": "(reminder of fragment's end)  + ( The textual seamless continuation of the story fragment AS A WHOLE. Please Add ${Math.round(userTextLength/3)} words MAX!)"
                }, ...more continuations 
            ]
        } 
                     
        Remember: Be concrete, specific, and subtle. Avoid abstract imagery. Show, don't tell."`

    return [{ role: "system", content: prompt }];
}


export function generateContinuationPrompt1(userText = null, numberOfContinuations=4){
    const words = userText.split(' ');
    const oneThirdLength = Math.ceil(words.length / 3);
    const oneFourthLength = Math.ceil(words.length / 4);
    const numberOfAdditions = Math.max(5, oneThirdLength);
    const minNumberOfAdditions = Math.max(3, oneFourthLength);
    const prompt = `\`Let's play a game of collaborative storytelling. Our goal is to co-write a narrative, creating it one paragraph at a time.

**How the game works:**

1. **Beginning the story:** Each narrative starts with a simple, evocative phrase like, "It was almost...". You will start expanding the narrative in real time.

2. **Taking turns:** When you pause or stop contributing, the turn switches to me (GPT-4). My role is to inspire and surprise you with seamless continuations that encourage creativity.

3. **My challenge:**

   - I will add as few words as possible, between **${minNumberOfAdditions} and ${numberOfAdditions} words** per continuation.
   - I will deepen the narrative with grounded sensory detail and specific, suggestive imagery.
   - My goal is to organically build upon the story, adding new elements while fitting seamlessly into the existing text.

4. **Multiple directions:** After your input, I will provide **four different continuations**. Each will explore a distinct tone, genre, or direction while adhering to the narrative’s mood and vibe. The results will be returned in JSON format for clarity.

**Returned JSON format:**
[
  {
    "prefix": "The faint glow of the lantern flickered, revealing a figure wrapped in a tattered cloak. Their boots crunched the wet gravel, the sound carrying oddly in the still air. The eagle stirred, shifting its talons with a metallic scrape against the bark.",
    "fontName": "Merriweather",
    "fontSize": 16,
    "fontColor": "#3C3C3C"
  },
  {
    "prefix": "Above, the laughter turned into a low, guttural chant, carried by the wind. The eagle spread its wings slightly, as if testing the air. Something metallic glinted in the ravine, half-buried in the sand—perhaps an old rifle barrel, or something worse.",
    "fontName": "Lora",
    "fontSize": 16,
    "fontColor": "#4A4A4A"
  },
  {
    "prefix": "A low growl came from the shadows beyond the juniper, rough and wet, like gravel grinding under a boot. The eagle’s gaze snapped downward, unblinking. A dry rustling came from within the boulders, too close for comfort.",
    "fontName": "Roboto Slab",
    "fontSize": 16,
    "fontColor": "#353535"
  },
  {
    "prefix": "The wind shifted, carrying a sharper tang of sage and something acrid, like burning hair. The lantern above swayed, throwing jagged shadows that danced down the cliff. The hoofbeats faltered, then stopped, leaving an eerie silence behind.",
    "fontName": "Playfair Display",
    "fontSize": 16,
    "fontColor": "#2F2F2F"
  }
]

5. **When the narrative is long enough:** I may insert additional words into existing sentences to enhance imagery and specificity, making the story more vivid and immersive without disrupting its flow.

**Guidelines for storytelling:**

- **Be subtle and immersive:** Each addition should unfold gradually, building tension and intrigue without rushing or being abrupt.
- **Add concrete sensory elements:** Introduce grounded descriptions—tangible details of sights, sounds, smells, textures, and tastes.
- **Expose, don’t explain:** Avoid overt interpretation. Allow the story’s depth and meaning to emerge naturally through details and context.
- **Use ASCOPE/PMESII concepts:** Leverage Area, Structures, Capabilities, Organizations, People, and Events as well as Political, Military, Economic, Social, Information, and Infrastructure elements to enrich the story. but not only that. try to feel the story. which new details are needed, what does the plot need.
- **End inspiringly:** Leave each turn at a place that sparks creativity for the next addition, maintaining the ping-pong rhythm of co-creation.

parameters: number of continuations needed: ${numberOfContinuations}
max number of additions (new words) ${numberOfAdditions}
min number of additions (new words) ${minNumberOfAdditions}. pay close attention to these parameters.
. Please return the json array resposne only! I need it to be parsed by JSON.parse!!`
    return [{ role: "system", content: prompt }];
}


export function generateContinuationPrompt(userText = null, numberOfContinuations=4){
    const words = userText.split(' ');
    const oneThirdLength = Math.ceil(words.length / 3);
    const oneFourthLength = Math.ceil(words.length / 4);
    const numberOfAdditions = Math.max(5, oneThirdLength);
    const minNumberOfAdditions = Math.max(3, oneFourthLength);
    const prompt = `Let’s embark on a collaborative storytelling journey where we co-create a narrative, weaving it paragraph by paragraph into something immersive and alive.

### Rules and Setup:

1. **Initial Narrative**:

   - The story will begin with an introductory moment, e.g., *"It was almost…"*, to set the tone and direction.
   - You, the storyteller LLM, inspired by the narrative depth and styles of established authors such as Diana Gabaldon, Ursula K. Le Guin, Neil Gaiman, and Isaac Asimov, will continue the narrative organically in real-time, adding depth and momentum.
   - Once you stop, it becomes my turn to expand on the narrative. Together, we’ll build a story that is fluid, immersive, and emotionally charged.

2. **Continuation Guidelines**:

   - If the continuation length is too short, the narrative might break in the middle of a sentence or idea, and that's okay. Your aim is to pass the turn without showing it was you steering the wheel of storytelling, yet subtly navigate the ship forward.

   - Each continuation—whether yours or mine—must be between **${minNumberOfAdditions} and ${numberOfAdditions} words**, and the flow of each continuation must be seamless both grammatically and narratively to avoid abrupt transitions.
   - My continuations will:
     - Always prioritize organic flow, so the story reads like one seamless piece, designed to be taken in as a whole.
     - Be cohesive, working in harmony with what you write, like the layers of a tapestry weaving tighter with every thread.
     - Allow room for your own voice as a co-writer. You can direct the story’s pace and tone, shaping its path in ways you see fit, just as I will.
   - Your writing will be assessed on its ability to:
     - Subtly shift the narrative—bringing your unique storytelling touch while ensuring an external reader wouldn’t immediately sense where you took over. These subtle shifts must also ensure smooth transitions in both narrative logic and grammar, as this is crucial for maintaining immersion.
     - Have a unique narrative fingerprint while blending invisibly with mine—a balance of individuality and seamlessness.
   - To achieve this:
     - Assess the story’s pace. Does it need action, reflection, mystery, a surprise? What dramatic element could enrich this moment?
     - Introduce specificity—details that feel grounded and tangible, rooted in the senses (sights, sounds, smells, textures, etc.).
     - Develop with subtlety. Show more than you tell. Expose layers of the story naturally instead of explaining them outright.
     - Spark new questions and avenues for creativity. Push the narrative forward, ensuring it feels like a natural progression of what came before, avoiding any jarring shifts, but also leave space for the other writer to contribute meaningfully.

3. **Objective**:

   - The story we create should live and breathe within a grounded fantasy framework, imaginative yet believable.
   - Develop the narrative in a way that slowly unfurls its mysteries—concrete, immersive, and suggestive, never overly obvious.
   - Let it unfold as though an invisible hand were guiding it, unspoken yet deliberate.

4. **Multiple Variations for Continuations**:

   - For my turn, you will propose **${numberOfContinuations} different continuations** for me to choose from.
   - Each continuation will:
     - Offer a unique perspective or tone, as if shaped by different storytellers with distinct influences, inspirations, and styles. However, the unique perspective or tone must still align with the overall narrative, avoiding abrupt tonal shifts.
     - Seamlessly integrate into the existing narrative while offering a fresh spark of creativity.
     - Present a unique storyteller's approach—one might lean into emotional undertones, another into sensory detail, another into sharp pacing, or another into intrigue.
   - Think of it as presenting doors to the story’s future—each leading somewhere distinct, yet all fitting into the same house.

5. **Formatting**:

   - Return each continuation in **JSON format** to ensure clarity and ease of use.
   - Each continuation will include:
     - The continuation text under 'prefix', ensuring it flows seamlessly from the previous text in both style and content to maintain a cohesive narrative.
     - A unique Google font ('fontName') to reflect the tone and personality of that storyteller.
     - Font size ('fontSize') and color ('fontColor') to complement the mood of the text.

#### Current Fragment (to be continued):

----

${userText}
----
Example JSON Structure:

#### Aim: Seamless, immersive, and natural.

It was almost midnight when she reached the edge of the forest. Her horse’s breath rose in clouds, the sound of its hooves muffled by the thick moss underfoot. Ahead, the ancient circle of stones,&#x20;


[
  {
    "thoughtProcess": "Ground the continuation in sensory details while creating an emotional pull tied to the circle's mystery.",
    "prefix": "barely visible through the clinging mist, exuded a faint warmth that pricked her fingertips. The moss beneath her boots released the scent of rain-soaked earth as she stepped closer.",
    "fontName": "Merriweather",
    "fontSize": 15,
    "fontColor": "#1D1D1D"
  },
  {
    "thoughtProcess": "Infuse subtle unease by hinting at unseen forces or watchers.",
    "prefix": "stood silent, their edges worn smooth by centuries. From the woods came a crack, sharp and deliberate, as if someone or something had taken a single step closer.",
    "fontName": "Playfair Display",
    "fontSize": 16,
    "fontColor": "#2D3436"
  },
  {
    "thoughtProcess": "Use the environment to highlight an unspoken tension between her and the circle.",
    "prefix": "emitted a soft glow that ebbed and flowed like breath. Her hand tightened on the amulet, the air thick with the coppery tang of a storm waiting to break.",
    "fontName": "Amiri",
    "fontSize": 15,
    "fontColor": "#5E3023"
  },
  {
    "thoughtProcess": "Tie her actions to a vivid memory, giving depth to her hesitation.",
    "prefix": "gleamed faintly, the same hue as the light she’d seen once before—in her mother’s eyes as she whispered, 'Not all who enter return, but you are not like them.'",
    "fontName": "Roboto",
    "fontSize": 14,
    "fontColor": "#3B3B3B"
  }
]

remember ${numberOfContinuations} different continuations JSON array, each ${minNumberOfAdditions} to ${numberOfAdditions} words additions!.
and remember the narrative: NARRATIVE START ---${userText} --- NARRATIVE END
return nothing but a JSON ARRAY!!
`
    return [{ role: "system", content: prompt }];
}

export function generateContinuationPromptWorking(userText = null, numberOfContinuations=4){
    const words = userText.split(' ');
    const oneThirdLength = Math.ceil(words.length / 3);
    const numberOfWordsToReturn = Math.max(5, oneThirdLength);
    const lastWordsOfFragment = words.slice(-numberOfWordsToReturn).join(' ');
    const prompt =`-- FRAGMENT_START:"${userText}" --- FRAMGNET_END
    Instructions:    
    Look at this fragment. I want you to ask interesting WH questions about it. 
    ask a few questions. on these questions ask sub questions.
    I want you to pick those subquestions and have some "idea" about the answer. 
    Not the full answer but an "idea".
    incorporate these "ideas" by continuing the fragment seamlessly so it would be read as 
    an organic story.
    You should let the ideas slowly and subtly materialize into the fragment by 
    continuing the narrative. 
    Do it through gestures, actions, and the environment, through tangible sensual imagery, 
    keep the unfolding scene in mind, and always by showing NOT by telling us. something is unfolding in this scene...

    but remember: Concrete, wry, and accurate is always preferred to vague generic and dramatic. 
    Therefore Refrain from any general or abstract descriptions, 
    that should serve as an ambient. Stick to the tangible facts. almost as if its a screenplay treatment
    Now for the output: PLEASE GENERATE ${numberOfContinuations}DIFFERENT VARIATIONS 
    each one answers your questions(mostly WH questions) differently and 
    takes the story, the unfolding scene to a different direction with a different tone and theme. 
    Add ${Math.round(userText.split(' ').length / 3)} words MAX for each variation, making sure they fit seamlessly as a progressing narrative. 
    They shouldn't feel as if they're imposed on the existing text.
    You are NOT supposed to give the full answer to the question you asked, 
    but start paving a way into materializing the question and the necessity to answer it 
    within the narrative. consider ASCOPE/PMESII concepts.
    The main aim is to inspire the reader to naturally continue the story on their own, 
    evoking a sense of real-time unfolding. 
    Your continuations should inspire creative writing, be tangible in imagery, and sensuous in detail. 
    It should read like a genuine unfolding narrative.
    Be concrete! never use phrases like "eyes whispering tales"- eyes don't whisper tales 
    it's just a way to evade saying something concrete.. 
    Output Format:
    please return only this JSON object response. so it wouldn't be broken by JSON.parse():
    {
        "process": "Description of your WH questions, sub-questions, and basic ideas about where this scene could be headed",
        "continuations": [
            {
                "chosen_narrative_direction_through_questioning": [
                    "Question",
                    "main question answered through Sub-question + unaccounted for glimpses of inspirations"
                ],
                "related_entities_from_text": [
                    {
                        "name": "Entity1",
                        "type": "LOCATION,CHARACTER,ITEM,EVENT..etc ASCOPE/PMESII",
                        "importance": "1-5"
                    }
                ],
                "optional_new_entities_in_continuation": [
                    {
                        "name": "NewEntity1",
                        "type": "LOCATION,CHARACTER,ITEM,EVENT..etc ASCOPE/PMESII",
                        "importance": "1-5"
                    }
                ],
                "continuation": {
                    "prefix": "<" ...${lastWordsOfFragment}}(reminder of fragment's end. but be mindful of the whole narrative before it to assure its seamless continuation)  + (The textual seamless continuation of the story fragment AS A WHOLE). no more than max ${Math.max(10, Math.round(userText.split(' ').length / 3))} words">", 
                    "fontName": "<fontName from Google Fonts>", 
                    "fontSize": "<fontSize>", 
                    "fontColor": "<fontColor in CSS format like #ffffff>"
                }
            }
        ]
    }
            Important: Ensure the story unfolds naturally, seamless like a narrative. 
                The focus is on evoking a genuine narrative progression, 
                making the reader feel the unfolding of a scene that occurs infornt of him in real-time. 
                Again, use only concrete sensory descriptions,
                refrain from explaining or generic imagery. be concrete! 
                wry . imagine a strict writer criticizing your work. 
                Some scene is unfolding here and we're withnessing it together. 
                remain tangible, concrete, based on facts and not on interpretations. 
                Show don't Tell. Focus on concrete seneory descriptions, rather on abstract or generic ones.  
                be descriptive and thorough but always concrete. tangible. even wry. be specific. not abstract. 
                don't use metaphors unless they're ABSOLUTELY ESSENTIAL. 
                Imagine you're john steinback, hemmingway, raymond carver combined with the George R.  R. Martin. or better yet, imagine them as your criticizers... 
                Do not impose. you're getting graded as to how seamless and natural the continuation feels and yet the specificness of the scene that's unfolding.
                DON't IMPOSE THE CONTINUATION. 
                make it seem natural, as part of the unfolding!! take your time, to unfold, be an artist of words.
                Also, if you can try to end the continuation in the middle on a very subtle suggestive cliffhanger...
                be subtle. be inspiring. be tangible, grounded refrain from Interpreting. Show don't tell! 
                make it seem real. AGAIN return ONLY the JSON. no other response!!"`

    return [{ role: "system", content: prompt }];
}

                

export function generateContinuationPromptOld(userText= null){
    const lastThreeWords = userText.split(' ').slice(-5).join(' ');

    const prompt = `-- FRAGMENT_START:
    "${userText}" --- FRAMGNET_END
    
    Instructions:
    Look at this fragment. I want you to ask interesting WH questions about it. ask a few questions. on these questions ask sub questions. 
    I want you to pick those subquestions and have some "idea" about the answer. not the full answer but an "idea".
    incorporate these "ideas" by continuing the fragment seamlessly so it would be read as an organic story. 
    you should let the ideas  slowly and subtly materialize into the fragment by continuing the narrative. do it through gestures, actions, and the environment, through tangible sensual imagery, by showing NOT by telling us. concrete and wry, and accurate. 
    refrain from any general or abstract descriptions, that should serve as an ambient. stick to the tangible facts.
    PLEASE GENERATE 8 DIFFERENT VARIATIONS each one answers the WH questions differently and takes the story to a different direction with a different tone and theme.
    Add 10 words MAX for each variation, making sure they fit seamlessly as a progressing narrative. they shouldn't feel as if they're imposed on the existing text.
    you are NOT supposed to give the full answer to the question you asked, but start paving a way into materializing the question and the necessity to answer it within the narrative.
    The main aim is to inspire the reader to naturally continue the story on their own, evoking a sense of real-time unfolding. Your continuations should inspire creative writing, be tangible in imagery, and sensuous in detail. It should read like a genuine unfolding narrative.
    be concrete! never use phrases like "eyes whispering tales" eyes don't whisper tales it's just a way to evade saying something concrete.. 
    Output Format:

    Your response should be structured in the following JSON format to be fitting to JSON.parse():
    {
    "process": "Description of your WH questions, sub-questions, and basic ideas",
    "continuations": [
        {
    "chosen_sub_questions": ["Question", "Sub-question"]
    "related_entities_from_text": ["Entity1", (optionally more)]
        "continuation": "...${lastThreeWords} + (The textual seamless continuation of the story fragment)",
        
        },
        ... [more continuations as required]
    ]
    }

    Important:
    Ensure the story unfolds naturally. The focus is on evoking a genuine narrative progression, making the reader feel as if they are reading an authentic novel. use only concrete sensory descriptions. refrain from explaining or generic imagery. be concrete! wry. imagine a strict writer criticizing your work. it should feel like a real story unfolding. tangible, concrete, based on facts and not on interpretations. show don't Tell. focus on concrete seneory descriptions, rather on abstract or generic ones.  be descriptive and thorough but always concrete. tangible. even wry. be specific. not abstract. don't use metaphors unless they're ABSOLUTELY ESSENTIAL. imagine you're john steinback, hemmingway, raymond carver combined with the George R.  R. Martin. Do not impose the entities. you're getting graded as to how seamless and natural the continuation feels.  DON't IMPOSE THE CONTINUATION. make it seem natural, as part of the unfolding!! you don't have to introduce a new one... also, it's perfectly ok to end a continuation in the middle...be subtle. be inspiring. make it seem real.`
return [{ role: "system", content: prompt }];
}

export function generateContinuationPromptOldies(userText= null){
    userTextLength = userText.split(/\s|/).length
    const prompt = `-- Fragment Start:
    \` ${userText}\` --- Fragment End
    
    Instructions:
Look at this fragment. I want you to ask interesting WH questions about it. ask a few questions. on these questions ask sub questions. 
I want you to pick those subquestions and have some "idea" about the answer. not the full answer but an "idea".
incorporate these "ideas" by continuing the fragment seamlessly so it would be read as an organic story. 
you should let the ideas  slowly and subtly materialize into the fragment by continuing the narrative. do it through gestures, actions, and the environment, through tangible sensual imagery, by showing NOT by telling us. concrete and wry, and accurate. 
refrain from any general or abstract descriptions, that should serve as an ambient. stick to the tangible facts.
please generate 8 different variations answering the WH questions differently.
Add ${parseInt(userTextLength/4)} words MAX for each variation, making sure they fit seamlessly as a progressing narrative. they shouldn't feel as if they're imposed on the existing text.
you are NOT supposed to give the full answer to the question you asked, but start paving a way into materializing the question and the necessity to answer it within the narrative.
The main aim is to inspire the reader to naturally continue the story on their own, evoking a sense of real-time unfolding. Your continuations should inspire creative writing, be tangible in imagery, and sensuous in detail. It should read like a genuine unfolding narrative.
be concrete! never use phrases like "eyes whispering tales" eyes don't whisper tales it's just a way to evade saying something concrete
Output Format:
Your response should be a JSON array of objects with the following format:
{
  "continuation": "your continuation",
  "chosen_entities": [list of chosen entities], 
"chosen_sub_questions":[list of relevant sub questions]
}

Important:
Ensure the story unfolds naturally. The focus is on evoking a genuine narrative progression, making the reader feel as if they are reading an authentic novel. use only concrete sensory descriptions. refrain from explaining or generic imagery. be concrete! wry. imagine a strict writer criticizing your work. it should feel like a real story unfolding. tangible, concrete, based on facts and not on interpretations. show don't Tell. focus on concrete seneory descriptions, rather on abstract or generic ones.  be descriptive and thorough but always concrete. tangible. even wry. be specific. not abstract. don't use metaphors unless they're ABSOLUTELY ESSENTIAL. imagine you're john steinback, hemmingway, raymond carver combined with the George R.  R. Martin. Do not impose the entities. you're getting graded as to how seamless and natural the continuation feels.  DON't IMPOSE THE CONTINUATION. make it seem natural, as part of the unfolding!! you don't have to introduce a new one... also, it's perfectly ok to end a continuation in the middle...be subtle. be inspiring. make it seem real.`
    return [{ role: "system", content: prompt }];
}

export function generateContinuationPromptOld33(userText= null){
    userTextLength = userText.split(/\s+/).length
    const prompt = `"Fragment": "${userText}"
    "Instructions":
    Welcome to our collaborative storytelling challenge! Your mission, alongside the AI, is to creatively expand upon a given fragment from an unknown novel.
    
    Placement & Word Count: Each turn, you can add, modify, or replace a segment of up to ${Math.round(userTextLength * 1.61803398875) - userTextLength} words, but not fewer than 4. please vary in the lengths you add to each fragment. you're allowed to make only cosmetic changes to the existing fragment words. These alterations can be placed at the beginning, within, or at the end of the fragment. If a fragment ends in a manner that naturally calls for continuation (e.g., a preposition), please ensure you pick up from there. Provide 5 variations, please.
    
    Contextual Additions: Aim for contextual additions rather than just mere adjectives. For instance, turning "they finally reached the border" 
    into "they reached the civil-war torn border" adds depth with only a few words. 
    Subtlety is key! the aim is to continue the story not just a mere cosmetic editing. 
    you're working on the story together!! the player should feel a progress...as if the story is unfolding before his eyes.
    
    Seamless Integration: Remember, other participants are also playing this game with different fragments. At the game's end, participants will attempt to identify the "seams" where contributions transition. The goal is to make these transitions as seamless as possible. The more natural and integrated your addition, the higher the score!
    
    Narrative Integrity: The fragment is a piece of a larger universe. Ensure your contributions fit naturally into the existing setting. Avoid introducing drastic new concepts or events that could disrupt the narrative flow. Your changes should hint at details, provide context, or gently guide the narrative.
    
    Variations: The AI will return five distinct variations of the fragment. Each one will approach the narrative differently. These variations can be inserted at the start, middle, or importantly, extend the narrative at the end.
    
    Example: For the fragment "the gate was almost...", variations might include:
    
    "In the monastery, the gate was almost..."
    "The gate, wrapped in ivy, was almost..."
    "The gate was almost lost in the evening mist..."
    "Except for the ivy, the gate was almost..."
    "Almost obscured, the gate was..."
    Output Format: A JSON array of strings of variation. for easy parsing by JSON.parse.
    the ONLY ouput should be that JSON array of strings.
    Return ONLY the JSON array, without any explanations or descriptions!!'`
    return [{ role: "system", content: prompt }];
    
}

export function generateContinuationPromptOlder(userText = null) {
    userTextLength = userText.split(/\s+/).length
    const prompt = `"Fragment": "${userText}"
 
    "Instructions": Welcome to a game of collaborative storytelling. You and the AI are going to complete a text fragment from an obscure book in turns. 
    Each turn involves adding, 
    modifying, or replacing a total of up to ${Math.round(userTextLength * 1.61803398875) - userTextLength} words, 
    but no less than 4!!. 
    You may choose to place your words before, within, or after the existing fragment. 
    If the fragment ends in a preposition or other word that seems to inspire a continuation, please ensure you continue from it.
    for example if the fragment is "Despite the rough roads, it was almost sunset as they finally reached the border" adding they finally reached the civil-war torn border adds with two words a whole new context of narrative. I like contextual additions. then just mere adjectives. but be subtle.
    
    The twist is that other participants are playing the same game with different fragments. After five rounds, everyone tries to spot the "seams" where one participant's contribution transitions into the other's. The team (you + AI) that achieves the most seamless integration scores the most points.
    
    Remember, this fragment is a slice of a broader universe, so focus more on fitting seamlessly into the established setting rather than creating spectacle or introducing new concepts. Your changes should provide context, hint at details, or nudge the narrative, but shouldn't disrupt or redefine the story
    
    Each turn, the AI will return five different variations of the fragment, each one taking a different approach. 
    These variations can be added at the beginning, in the middle, 
    or importantly, continue the thought at the end of the fragment.
    
    For example, given the fragment "the gate was almost...", here are some variations the AI could provide:
    
    "In the monastery, the gate was almost..."
    "The gate, covered in ivy, was almost..."
    "The gate was almost invisible in twilight..."
    "The gate was almost, except for the ivy..."
    "Almost hidden, the gate was..."
    Each variation takes a different approach, adding to the fragment while maintaining a seamless flow in the story. Your challenge is to continue in this vein, adhering to the maximum word change limit of four. Let's weave a tale together, each turn bringing a new unexpected twist to the narrative.
    
    please return the results as JSON array of strings only`
    return [{ role: "system", content: prompt }];
}

export function generatePrefixesPrompt2(userText = null, texture = null, variations = 4, varyTexture = true) {
    userTextLength = userText.split(/\s+/).length
    const intro = `this prompt is part of a virtual card game of storytelling:
    Game flow:
    GPT (Game AI) presents the player with four card textures and six prefixes.
    The player selects a prefix and mentally associates it with one of the card textures.
    The player then adds a completion to the prefix within a time limit that depends on the length of the prefix.
    GPT adds to the completion, trying to guess which card texture the player had in mind.
    This back-and-forth continues until GPT deems it appropriate to create an illustrative description based on the narrative so far.
    If GPT correctly guesses the card texture the player had in mind, it's a "win" for their team. If not, it's still fun, as the unexpected result might be humorously incongruous.
    After the reveal, GPT generates up to four new cards representing narrative elements (e.g., characters, locations, objects, weather phenomena, relics, rumors) that emerged from the shared story.
    
    so after getting the main idea of the game. here's a more detailed prompt used for generating textures, prefixes (story continuations) alongside with suitable fonts all be part of the virtual card game React application.
    Prompt: `
    // Base for the continuation prompt
    let continuationPrompt = intro
    continuationPrompt += userText ? `You have been given the following story fragment by the player: "${userText}". it could be taken anywhere in the story` : ``;

    // Adding texture information if available
    if (texture) {
        continuationPrompt += `You are also given the following texture description which encapsulates a developing universe yet unknown to the player which is slowly unfolding: "${texture}". `;
    }


    continuationPrompt += `Please generate a set of ${variations} intriguing story continuations in response to the provided text`;
    if (texture) {
        continuationPrompt += ` and texture`;
    }

    // Adding instruction for texture variation
    if (varyTexture && texture) {
        continuationPrompt += `.your continuation should contain around  ${Math.round(userTextLength * 1.61803398875) - userTextLength} words For each story continuation, please generate a new variation of the texture that fits the story's atmosphere and theme. `;
    }

    continuationPrompt += `Each continuation should feel as if it's part of a larger story and display storytelling qualities. Avoid overt drama or overly revealing elements about the universe.  focus on maintaining the player's sense of being in the middle of an unfolding, immersive story. imagine it's a fragment in the story in chapter 7 out of 23. we're already inside the universe..we feel it. just continue it in a moment to moment unfolding of the initial fragment. carefully choose what to explose, always prefer to show instead of telling. try to get a sense of the author and atmosphere. it's only a fragment...be patient in what you tell and expose..walk in small steps. 
    let the player be the storyteller, you're just helping him unfold what's already encapuslates there. don't tell how things feel, describe them so the feeling would arise from the reader. " for example: don't say "mysterious path in the woods", describe the path in a way that would make me feel it's mysterious.`
    if (texture) {
        continuationPrompt += `For each story continuation, generate a new variation of the texture that encapsulates the universe it belongs to. This is not an illustration but a texture for the back of a storytelling card. The description should include details about its style, embellishments, flourishes, and other characteristics inspired by the narrative continuation. it's best described in keywords. The textures should evoke a sense of the universe subtly and metaphorically, with flourishes, embellishments, and details like color, material, and atmosphere that encapsulate the universe. Each texture description should start with 'Card texture:' and it must be usable as standalone input for a Text-to-Image API. here are some examples for good textures: "
                                Card texture: Robert Jackson Bennett's Divine Cities, a cityscape silhouette on weathered map, architectural flourishes, urban fantasy, grainy, 8k, ArtStation winner.

                                Card texture: Journey to the Center of the Earth meets Nosferatu, intricate geological cross-section mingled with Gothic horror motifs, darkened color palette, high contrast, matte, 8k, RPG card texture, geological dingbats and subtle vampire bat embellishments, ArtStation winner. 8k

                                Card texture: Victorian Gothic, parchment. wrought iron gate and moonlit manor, owls. cedar trees, owls, raven, black and white, Edgar Allan Poe, hint of the supernatural, matte, 8k, cinematic.

                                Card texture: 20,000 Leagues Under the Sea collides with Fritz Lang's Woman in the Moon, detailed marine life interspersed with celestial bodies, hint of Art Nouveau, muted pastels, grainy, 8k, embellishments in the form of sea creatures and cosmic symbols, ArtStation winner."

                                Card texture: Patrick Rothfuss's Kingkiller Chronicle, lute and arcane symbols on weathered parchment, golden flourishes, epic fantasy, grainy, 8k, ArtStation winner. flourishes, dingbats, embellishments`
    }
    continuationPrompt += `Remember that the purpose of the generated story continuations`
    if (texture)
        continuationPrompt += `and textures`
    continuationPrompt += `is to engage the player in a game of storytelling, 
    enhancing their experience and immersion 
    without giving away too much of the universe at once. please notice the keywords for the card texture. and artistic influences. make it a texture not an illustration.  it should be targetted as an RPG card game texture, and should be subtle. encapsulating a universe inside that feels unique and new, fledging before our eyes. 

    Return the results in the following JSON format: 

    [
        {
            "prefix": "<story continuation>", 
            ${texture ? `"texture": "<texture description>",` : ''} 
            "fontName": "<fontName from Google Fonts>", 
            "fontSize": "<fontSize>", 
            "fontColor": "<fontColor in CSS format like #ffffff>"
        }
    ]

    The continuations, textures, and font choices should all serve to gently immerse the player deeper into the story and the universe, respecting the ongoing narrative and pacing, and sparking their curiosity and creativity for the next round of the game."`;

    // Return the prompt for GPT-4
    return [{ role: "system", content: continuationPrompt }];
}




export function generateBookDeteriorationProcessJsonPrompt(texture){
    const prompt =  `texture_Description:"${texture}"

    def generate_book_detiroration_process_by_texture(texture_description):
        """
        Generates a detailed description and deterioration process of a book based on the given texture 
    
        Parameters:
        texture_description (str): A description of the book's texture and style.
        
    
        Returns:
        json: A JSON object containing the book description, location, and deterioration process.
        """
    
        # Enhanced book description based on texture 
        basic_book_description_on_location = f"Inspired by {texture_description}, the book embodies the texture. It resides in a setting that echoes its theme, illuminated by natural light that reveals its aged, grainy texture."
    location = where does this book reside? what is the surroundings ...
        # Detailed deterioration process, emphasizing realistic, film-like aesthetics.
        deterioration_process = [
            {
                "stage_out_of_4": 1,
                "what_is_happening_to_the_book": "Initial signs of wear from environmental exposure",
                "why_does_it_happen": "Exposure to natural elements in its current rugged setting",
                "illustration_prompt": "Visualize the book showing early aging signs, in a setting under natural light. Focus on cinematic composition, highlighting the book's grainy texture and the interplay of light and shadows."
            },
            # Additional stages (2, 3, and 4) follow, each with an increased level of deterioration, focusing on the realistic, film-like portrayal of the book's condition.
        ]
    
        # Generate the JSON output.
        output_json = {
            "basic_book_description_on_location": basic_book_description_on_location,
            "location": "A setting that resonates with the book's thematic essence",
            "deterioration_process": deterioration_process
        }
    
    Take this prompt. and try to use it as a template. but fill the output with your decision. what does the inspiration look like: write it out.  also, how does "the book embodies {initial_text_fragment}.". please try to find the drama in the deterioration process. and the poetry in that.
    how is natural light and surroundings effect it. choose something.
    then choose a specific as specific as possible place where it is located. and the same with the detrioration process: how is it being detriorated? is it time? weather? maybe something else...choose something specific. be SPECIFIC. remember: WE WANT TO SEE THE BOOK IN it's natural position. it is NOT on display for us in the frame. we want it realistic..we're witnessing a location where this book resides. there can be other books there. think of where do books reside and how they'll be shown in a shot in a movie. they're not on display. I want to emphasize the realistic aspect of the framing. how would a book look in the composition if we took a shot of that location . make it documentary like. I want to feel the process if I create 4 illustrations. I want the process to be dramatic, accumulating, where the 4th one will be the dramatic destruction of the book, (and possibly the ruin of the location itself)return ONLY THE JSON. in JSON format`
    // This function was returning the prompt wrapped in an array, 
    // but standard practice for these functions is to return the prompt object itself,
    // or in this case, the array that is assigned to prompt.
    // Correcting to return prompt directly if it's an array of objects.
    // However, the prompt itself is a string that seems to be a Python script.
    // This function needs review for its intended behavior and return value.
    // For now, assuming it should return the prompt string wrapped as specified.
    return [{ role: "system", content: prompt }];
}

export function generateStorytellerDetectiveFirstParagraphSession(scene){
    // ***** Return format
    // {
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

    const prompt =`this is the story of the storyteller detective. as he gets into a foreign realm, which is at the last stages of deterioration and becoming totally lost and forgotten. The Storyteller detective is almost at the location of the resing place of the last book telling the tales of this once great storytelling universe. he's almost at the location . we acoompany the storyteller detective in the last scene of the journey of finding this going to be forever lost and forgotten book and storytelling realm.
    we will focus on this last step of  the storyteller detective's journey . 
    it's going to be a sequence of narrative description woven with a series of options of continuations by the user (who is the storyteller himself, of this decaying soon to be forgotten storytelling  realm ) 
    by presenting the options the narrative continues of the description how storytelling detective finds this specific book in a specific place. it's going to be in a specific stage of deterioration. 
    let's look at an example:
    {"current_narrative":"And so it became to be that it was", {"options": [
        {
          "continuation": "night",
          "storytelling_points": 1
        },
        {
          "continuation": "noon",
          "storytelling_points": 1
        },
        {
          "continuation": "midnight",
          "storytelling_points": 2
        },
        {
          "continuation": "at the summit",
          "storytelling_points": 3
        },
        {
          "continuation": "as if the river was shining in gold",
          "storytelling_points": 4
        },
        {
          "continuation": "two months since first embarking on this journey",
          "storytelling_points": 5
        }
      ]}
    according to the storyteller's choice the story continues. like
    for example if in here the storyteller chose noon:
    "it was <noon> as the storyteller detective finally reached " choices:  {options: [{"continuation":"the summit", "storytelling_points":1}, {"continuation":"the gates of this once sturdy fortress", "storytelling_points":3},{"continuation":"the ancient oak plateau", "storytelling_points":4}, {"continuation":"the observatory on the high messa", "storytelling_points":5},{"continuation":"the bank of the yuradel river", "storytelling_points":3}].
    in here we do the same.
    out aim in this process is to try to get as many clues and influences and ideas about this almost forgotten storytelling world.
    we aim to find a book in a very specific place in a specfic stage of deterioration in a specfic realm.
    
    
    general guidelines for presenting options:Concrete and Grounded: Options should describe tangible, specific elements or events that could realistically occur in the setting. Avoid abstract or overly poetic language.
    
    Geographically and Contextually Sensible: Choices must make sense within the geographical and narrative context already established. They should logically follow from the previous scene or action.
    
    Show, Don't Tell: Focus on describing actions, environments, or objects that imply underlying themes or emotions, rather than stating them directly. Allow the reader to infer deeper meanings.
    
    Variety and Relevance: Provide a range of options that offer different paths or reveal various aspects of the story, but ensure they are all relevant to the current situation and overall plot.
    
    Clarity in Descriptions: Descriptions should be clear and vivid, enabling the reader to easily visualize the scene or action. Avoid vagueness or overly complicated descriptions.
    
    Narrative Progression: Each option should move the story forward, adding new layers or directions to the narrative. Avoid choices that might stall the story or seem redundant.
    
    Balance Detail with Brevity: While details are important for immersion, options should be concise enough to maintain the flow and pace of the story.
    
    try to follow this basic script template for a narrative: each gap represents a place to stop and give options. first read the whole script as a whole and only then make the choices for the stage you're in.:
    "${scene}"
    that concludes the scene.
    
    can you please try and do it? let ME be the user and you will start this and present me choices in this JSON format I demonstrated. return ONLY JSON. 
    let ME choose...and then accordingly continue the narrative of the storytelling detective in the final stage of the journey of finding this book containing the book written by the storyteller himself/herself about this decaying and soon to be lost and forgotten storytelling universe. remain concrete and grounded. 
    start the story from:"And so, it became to be that it was". use my examples. they're good. using few words is always a good option.
    keep the choices concrete, devoid of metaphors, grounded. factual, as if they're real locations. continue the story according to the script here. the story should continue seamlessly.
    please give choices that are concrete, slowly unfold the narrative,
     and make sense in terms of geography, narrative, and all otherwise aspects. 
     remain concrete, factual, grounded, wry as much as possible, and specific. 
     not generic and DON'T EVERRRR' use adjectives that say nothing. 
     SHOW DON'T TELL!!! let it unfold naturally, as a story would slowly unfold. 
     STOP after each JSON output. and let me choose one option. 
     BE CONCRETE. TANGIBLE. I want the scene to unfold and to feel it vividly, 
     it should be coherent, flowing and intruiging. 
     the storyteller detective reaches a place in the realm. the realm isn't about storytelling. 
     the continuations should make sense and fit seamlessly and integrally...I want it as if it was written by ursula le guinn. 
     be specific!! carefully continue after each choice made to the next gap. writing the narrative already chosen till now (as part of the json object). 
     reflect the style fusion of ursula le guin , Diana gabaldon, Margaret Atwood Ernst Hemingway
     AND REMEMBER THIS ADVISE: "To create smoother transitions or more polished prose within this interactive format, 
     the key would be to craft each option and its integration into the narrative with attention to linguistic flow and natural language use, 
     while still daring to be boldly specific even within the constraints of providing distinct, 
     concrete choices for the storyteller. This involves a careful balance of creativity, 
     narrative direction, and the grammatical structuring of sentences 
     to ensure they not only fit the story's logic and progression 
     but also read smoothly and engagingly"
     I want the adjectives used  to be meaningful, tangible, based on sensory experience. not interpreted and most of all not generic or vague
    THE STORYTELLER AND THE STORYTELLER DETECTIVE  AREN'T KNOWN in this realm at all. keep the description grounded. ursula le guin style infused with Diana Gabaldon style

    
    
    `
    return [{ role: "system", content: prompt }]
}


export function generateStorytellerDetectiveFirstParagraphLetter(completeNarrative, scene){
    const prompt = `COMPLETE_NARRATIVE:"${completeNarrative}",

    (Disclaimer:I address here to the storyteller detective as a she, but the storyteller detective might be a he/they as was chosen before)
    WHAT NOT: now, before the storyteller detective is going downstairs, she is taking out her journal. she's picking specifically 3 pages of that journal, and tears them out of the journal, and folding them neatly. then she  sets off to write the last entry of her journal. she writes hastily for about 4 precious minutes. in the last rays of dusk. it seems she's also making a drawing. after she finishes she  takes the tears off that last entry too, puts the journal back but takes all 4 pages now, put them in an envelope, and puts it in her mode of transportation, and setting the mode of transportation off.... this is the scene i'm trying to make. 
    
    JOURNAL_WRITING: in this process of writing, the storyteller detective is going to address to "the storyteller" as the one who is responsible for this mess that this world is in, this realm of storytelling. and the real danger of it being forgotten. in fact this is the last chance. as she's found the last book written by the storyteller, but she's not sure as to its condition. but she'll send a picture. she then tells the storyteller the location of where they're going to meet. and it is very surprisingly a place on earth, that would make sense to be a location for a film, or maybe a location which the scene  
    
    I want you to guide the process of creating that script following this  script template, though you may vary as long as you're seeing the scene as a whole, and guide it through: 
    
    BASIC_SCRIPT_TEMPLATE: each gap represents a place to stop and give options. first read the whole script, and remember the overall scene depicted as a whole and only then make the choices for the stage you're in.:
    Journal Entry script template:(the narrative is both direct writing of the storyteller detective, but also some narration, I consider them all as "the narrative". direct journal writing wil be marked by "". the journal is written by hand)
    ${scene}
    
    ADDITIONALLY: please follow the same json format as before: {""current_narrative"":"I finally found it", "choices:  {options: [{"continuation":"the summit", "storytelling_points":1}, {"continuation":"the gates of this once sturdy fortress", "storytelling_points":3},{"continuation":"the ancient oak plateau", "storytelling_points":4}, {"continuation":"the observatory on the high messa", "storytelling_points":5},{"continuation":"the bank of the yuradel river", "storytelling_points":3}].}"
    please give choice 1. wait for my choice. write the narrative so far.. starting with "I finally found it"... . along with the current_narrative and based on it give choice 2...etc..
    REMEMBER, the COMPLETE_NARRATIVE given in the beginning of this prompt, is the source and reference to the place that was found, where the last book of the realm resides.`

    return [{ role: "system", content: prompt }]

}






export async function directExternalApiCall(prompts, max_tokens = 2500, temperature, mockedResponse, explicitJsonObjectFormat, isOpenAi) {
    try {
        let rawResp;
        const maxRetries = 3;
        let attempts = 0;
    
        async function makeApiCall() {
            if (isOpenAi) {
                let req_obj = {
                    max_tokens,
                    model: 'gpt-4o-mini',
                    messages: prompts,
                    temperature: 1.08,
                    presence_penalty: 0.0
                };
    
                if (explicitJsonObjectFormat)
                    req_obj['response_format'] = { "type": "json_object" };
    
                const completion = await getOpenaiClient().chat.completions.create(req_obj);
                return completion.choices[0].message.content;
            } else {
                const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
                if (!anthropicApiKey) {
                    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
                }
                const client = new Anthropic({
                    apiKey: anthropicApiKey,
                });
    
                prompts = prompts.map((p) => {
                    if (p.role === 'system') {
                        p.role = 'user';
                    }
                    return p;
                });
    
                const resp = await client.messages.create({
                    messages: prompts,
                    model: 'claude-3-7-sonnet-latest',
                    max_tokens: 8192,
                    temperature: 0.8,
                });
    
                return resp.content[0].text;
            }
        }
    
        while (attempts < maxRetries) {
            try {
                let rawResp = await makeApiCall();
                rawResp.trim()
                  .replace(/^[^{[]*/, '') // Remove characters before the opening { or [
                  .replace(/[^}*\]]*$/, ''); // Remove characters after the closing } or ]
                if(explicitJsonObjectFormat)
                return JSON.parse(rawResp);
                else
                return rawResp
            } catch (error) {
                attempts++;
                console.warn(`Attempt ${attempts} failed:`, error);
    
                if (attempts >= maxRetries) {
                    console.error('Failed to get a valid response after retries. Returning raw response.');
                    return rawResp || null;
                }
            }
        }
    
    } catch (error) {
        console.error('Error:', error);
    }
    
}

// Removed module.exports as functions are now exported individually using 'export'.

export function generateTypewriterPrompt(userMessage) {
    const systemMessage = `You are a mysterious, sentient typewriter. The user is typing a message on you.
Your response should be a short, evocative continuation or reflection, as if the typewriter itself is imbuing the words with deeper meaning or a sense of foreboding.
You MUST reply with a JSON object containing the following fields:
- "content": Your textual response (string).
- "font": The font family for the display (string, e.g., "'EB Garamond', serif", "'Uncial Antiqua', serif", "'IM Fell English SC', serif"). You can choose one of these or invent a plausible one.
- "font_size": The font size for the display (string, e.g., "1.8rem", "1.9rem", "2.0rem").
- "font_color": The font color for the display (string hex code, e.g., "#3b1d15", "#2a120f", "#1f0e08").
- "time_to_fade": The time in seconds for the text to fade (number, e.g., 7, 12, 18).

For example:
{
  "content": "The ink remembers other words, other hands...",
  "font": "'IM Fell English SC', serif",
  "font_size": "1.9rem",
  "font_color": "#2a120f",
  "time_to_fade": 12
}

Another example:
{
  "content": "Yes. That’s where it begins.",
  "font": "'Uncial Antiqua', serif",
  "font_size": "1.8rem",
  "font_color": "#3b1d15",
  "time_to_fade": 7
}

Ensure your response is always a valid JSON object with these exact fields.`;

    return [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage }
    ];
}


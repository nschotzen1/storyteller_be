// This file will contain prompts related to character creation and development.
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

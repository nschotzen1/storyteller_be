//and also a list of entities discussed and inferred to by this initial fragment and further discussion.


// Removed module.exports as functions are now exported individually using 'export'.

// storytellerDetectivePrompts.js
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

    const prompt = \`this is the story of the storyteller detective. as he gets into a foreign realm, which is at the last stages of deterioration and becoming totally lost and forgotten. The Storyteller detective is almost at the location of the resing place of the last book telling the tales of this once great storytelling universe. he's almost at the location . we acoompany the storyteller detective in the last scene of the journey of finding this going to be forever lost and forgotten book and storytelling realm.
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
    "\${scene}"
    that concludes the scene.

    can you please try and do it? let ME be the user and you will start this and present me choices in this JSON format I demonstrated. return ONLY JSON.
    let ME choose...and then accordingly continue the narrative of the storyteller detective in the final stage of the journey of finding this book containing the book written by the storyteller himself/herself about this decaying and soon to be lost and forgotten storytelling universe. remain concrete and grounded.
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



    \`
    return [{ role: "system", content: prompt }]
}


export function generateStorytellerDetectiveFirstParagraphLetter(completeNarrative, scene){
    const prompt = \`COMPLETE_NARRATIVE:"\${completeNarrative}",

    (Disclaimer:I address here to the storyteller detective as a she, but the storyteller detective might be a he/they as was chosen before)
    WHAT NOT: now, before the storyteller detective is going downstairs, she is taking out her journal. she's picking specifically 3 pages of that journal, and tears them out of the journal, and folding them neatly. then she  sets off to write the last entry of her journal. she writes hastily for about 4 precious minutes. in the last rays of dusk. it seems she's also making a drawing. after she finishes she  takes the tears off that last entry too, puts the journal back but takes all 4 pages now, put them in an envelope, and puts it in her mode of transportation, and setting the mode of transportation off.... this is the scene i'm trying to make.

    JOURNAL_WRITING: in this process of writing, the storyteller detective is going to address to "the storyteller" as the one who is responsible for this mess that this world is in, this realm of storytelling. and the real danger of it being forgotten. in fact this is the last chance. as she'sfound the last book written by the storyteller, but she's not sure as to its condition. but she'll send a picture. she then tells the storyteller the location of where they're going to meet. and it is very surprisingly a place on earth, that would make sense to be a location for a film, or maybe a location which the scene

    I want you to guide the process of creating that script following this  script template, though you may vary as long as you're seeing the scene as a whole, and guide it through:

    BASIC_SCRIPT_TEMPLATE: each gap represents a place to stop and give options. first read the whole script, and remember the overall scene depicted as a whole and only then make the choices for the stage you're in.:
    Journal Entry script template:(the narrative is both direct writing of the storyteller detective, but also some narration, I consider them all as "the narrative". direct journal writing wil be marked by "". the journal is written by hand)
    \${scene}

    ADDITIONALLY: please follow the same json format as before: {""current_narrative"":"I finally found it", "choices:  {options: [{"continuation":"the summit", "storytelling_points":1}, {"continuation":"the gates of this once sturdy fortress", "storytelling_points":3},{"continuation":"the ancient oak plateau", "storytelling_points":4}, {"continuation":"the observatory on the high messa", "storytelling_points":5},{"continuation":"the bank of the yuradel river", "storytelling_points":3}].}"
    please give choice 1. wait for my choice. write the narrative so far.. starting with "I finally found it"... . along with the current_narrative and based on it give choice 2...etc..
    REMEMBER, the COMPLETE_NARRATIVE given in the beginning of this prompt, is the source and reference to the place that was found, where the last book of the realm resides.\`

    return [{ role: "system", content: prompt }]

}

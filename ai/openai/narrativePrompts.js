// This file will contain prompts related to narrative generation and continuation.

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
    let userTextLength = userText.split(/\s|/).length; // Ensure userTextLength is defined
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
                make it seem real. AGAIN return ONLY the JSON. no other response!!\`

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
    let userTextLength = userText.split(/\s|/).length; // Ensure userTextLength is defined
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
    let userTextLength = userText.split(/\s+/).length; // Ensure userTextLength is defined
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
    let userTextLength = userText.split(/\s+/).length; // Ensure userTextLength is defined
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
    let userTextLength = userText.split(/\s+/).length; // Ensure userTextLength is defined
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

export function generateTypewriterPrompt(existing_text) {
    const systemMessage = \`You are a narrative composer.
Given these parameters:

\$existing_text: The narrative fragment to continue.

\$desired_length: Target word count for the main continuation.

\$number_of_fades: Number of alternate fades (default 4, can be 5).

Task:
Compose a detailed, step-by-step writing_sequence (including type, pause, delete) to build a vivid, "expensive" continuation of \$existing_text close to \$desired_length words.
Then, generate \$number_of_fades distinct fade_sequence entries—each a standalone alternate continuation in a new style, logic, and mood, as if from a different storyteller.
For each action (including deletes), begin with a concrete, internal thoughtProcess—your reasoning, as if talking to yourself.
Always include existing_fragment and continuation for context.

Return valid JSON. Here’s a full example for:

\$existing_text: "They slowly walked on "

\$desired_length: 18

\$number_of_fades: 5

json
{
  "writing_sequence": [
    {
      "action": "type",
      "thoughtProcess": "Scout for a literal, spatially meaningful 'on'—start with a ledge, amplify risk and material detail.",
      "existing_fragment": "They slowly walked on ",
      "continuation": "the narrow ledge, soles grinding flakes of limestone into the drop below.",
      "delay": 0,
      "style": { "fontName": "Merriweather", "fontSize": 17, "fontColor": "#1D1D1D" }
    },
    {
      "action": "pause",
      "delay": 300
    },
    {
      "action": "type",
      "thoughtProcess": "Add a bodily response: how does the ledge shape posture and breath? Make the world press against the character.",
      "existing_fragment": "They slowly walked on the narrow ledge, soles grinding flakes of limestone into the drop below.",
      "continuation": " The wind pressed their jackets flat, and each breath tasted of chalk and fear.",
      "delay": 0,
      "style": { "fontName": "Merriweather", "fontSize": 17, "fontColor": "#1D1D1D" }
    },
    {
      "action": "pause",
      "delay": 220
    },
    {
      "action": "delete",
      "thoughtProcess": "Remove 'and fear.' Favor physical manifestation over naming emotion.",
      "existing_fragment": "They slowly walked on the narrow ledge, soles grinding flakes of limestone into the drop below. The wind pressed their jackets flat, and each breath tasted of chalk and fear.",
      "continuation": "",
      "count": 10,
      "string_to_delete": " and fear.",
      "delay": 350
    },
    {
      "action": "type",
      "thoughtProcess": "Replace with a more tactile detail—fear in the hands, not in a word.",
      "existing_fragment": "They slowly walked on the narrow ledge, soles grinding flakes of limestone into the drop below. The wind pressed their jackets flat, and each breath tasted of chalk",
      "continuation": ". Fingers curled white around the rock.",
      "delay": 0,
      "style": { "fontName": "Merriweather", "fontSize": 17, "fontColor": "#1D1D1D" }
    }
  ],
  "fade_sequence": [
    {
      "action": "fade",
      "phase": 1,
      "thoughtProcess": "Reimagine 'on' as wire—literal danger, risk of falling. Short, kinetic.",
      "existing_fragment": "They slowly walked on ",
      "continuation": "the old wire strung between rooftops, arms wide for balance.", //each phase of the fade should be shorter than the other...
      "delay": 15000,
      "style": { "fontName": "Playfair Display", "fontSize": 16, "fontColor": "#2D3436" }
    },

    {
      "action": "fade",
      "phase": 2,
      "thoughtProcess": "Cold, unstable: now the walk is on ice. Emphasize slipping, the threat beneath.",
      "existing_fragment": "They slowly walked on ",
      "continuation": "ice slick and cracking, boots slipping with each step.",
      "delay": 10000,
      "style": { "fontName": "Amiri", "fontSize": 15, "fontColor": "#5E3023" }
    },

    {
      "action": "fade",
      "phase": 3,
      "thoughtProcess": "Make it bodily—walk on a companion’s back. Show weight, strain, shared risk.",
      "existing_fragment": "They slowly walked on ",
      "continuation": "his broad shoulders, legs trembling with every uneven stone.",
      "delay": 8000,
      "style": { "fontName": "Roboto", "fontSize": 14, "fontColor": "#3B3B3B" }
    },
    {
      "action": "fade",
      "phase": 4,
      "thoughtProcess": "Border logic: make 'on' a threshold, dividing light and shadow.",
      "existing_fragment": "They slowly walked on ",
      "continuation": "the threshold, one foot in sun, one in dusk.",
      "delay": 6500,
      "style": { "fontName": "JetBrains Mono", "fontSize": 13, "fontColor": "#484848" }
    },
    {
      "action": "fade",
      "phase": 5,
      "thoughtProcess": "Minimal. Just the most concrete, physical 'on.'",
      "existing_fragment": "They slowly walked on ",
      "continuation": "gravel.",
      "delay": 5000,
      "style": { "fontName": "JetBrains Mono", "fontSize": 13, "fontColor": "#484848" }
    }
  ],
  "metadata": {
    "font": "'Merriweather', serif",
    "font_size": 17,
    "font_color": "#1D1D1D"
  }
}
Key points (brief, for model or user):

All actions begin with a literal, tactical thoughtProcess (model's reasoning, not just a label).

Each fade is a standalone alternate route, new style and logic.

IMPORTANT: All 'fade' actions must have their 'delay' property set to 0.
Between every two 'fade' actions, a 'pause' action will be automatically inserted. The 'delay' for this 'pause' action will be the original 'delay' of the second 'fade' action in the pair.

existing_fragment and continuation are always explicit.

Deletes are precise, with exact substring, count, and narrative reason.\`;

    const wordCount = existing_text ? existing_text.trim().split(/\s+/).length : 0;
    let desired_length = parseInt(Math.max(3, wordCount * 1.61));
    desired_length = Math.min(50, desired_length); // Cap at 50
    const number_of_fades = 4;

    const userContent = JSON.stringify({
        existing_text: existing_text,
        desired_length: desired_length,
        number_of_fades: number_of_fades
    });

    return [
        { role: "system", content: systemMessage },
        { role: "user", content: userContent }
    ];
}


const { directExternalApiCall, generate_texture_by_fragment_and_conversation} = require('./promptsUtils')
const fs = require('fs');



async function generate_cards(fragmentText, chatHistory, entities, texture) {
    const response = await externalApiCall({
        prompt: `
        Generate a high-rank card + supporting constellation based on the storytelling fragment.

        **Fragment:**  
        ${fragmentText}

        **Past Context:**  
        ${JSON.stringify(chatHistory)}

        **Entities from the Story:**  
        ${JSON.stringify(entities)}

        **Texture Theme:**  
        - **Archetype:** ${texture.archetype}
        - **Material:** ${texture.material}
        - **Description:** ${texture.description}

        ### **Card Structure**
        - The **high-rank card** should align with the texture’s **tone and material**.  
        - Use the **entities provided** to create relevant **lesser cards** (locations, objects, events, NPCs).  
        - Ensure **a strong connection** between the high-rank card and lesser cards.

        **Return JSON with the following format:**
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

async function generate_seer_response(cardsJson, texture) {
    const response = await directExternalApiCall({
        prompt: `
        ### **Narrative Perspective**
The response should include both:
1. **A Narrator** – Describes the Seer’s actions, how he holds and reacts to the texture.
2. **The Seer’s Own Words** – Fragmentary, vivid, sensory-driven glimpses of the vision as he interprets the cards.

---

## ** Texture Influence**
This constellation emerges from a card with a **unique texture**, shaping the **tone and substance** of the reading:
- **Archetype:** ${texture.archetype}
- **Material:** ${texture.material}
- **Description:** ${texture.description}

The Seer holds the texture, feeling its **weight, its flaws, its history**. It is more than an object—it is **a conduit** for what is about to be revealed.

The **skeleton of the reading** consists of the following cards:
${JSON.stringify(cardsJson)}

---

## ** HOW TO INTERPRET THE VISION**
1. **The Narrator Describes the Seer’s Physical Interaction with the Texture**  
   - What does it look like? Feel like? Is it brittle, cold, humming with energy?  
   - How does the Seer react to touching it?  
   - The **texture is the first key into the vision**—it opens the door to the world.  

2. **The Seer Reacts to the First Strong Sensory Impression (High-Rank Card)**  
   - Something **floods into his mind**—a sensory **shock** or **pull**.  
   - He speaks in **fragmented observations**, catching glimpses before they vanish.  
   - He feels **emotions tied to the vision**—awe, unease, urgency, curiosity.  

3. **Lesser Cards Appear, Forming the Constellation**  
   - The Seer **does not know everything at once**—details **build and shift**.  
   - The **relationship between elements** emerges through **associative connections**.  
   - Sometimes, he **misunderstands at first**, correcting himself as the vision clarifies.  

4. **The Seer’s Emotional Response Evolves**  
   - He may be **drawn into a moment**, feeling as if he is there.  
   - He may **laugh suddenly**, **freeze in dread**, or **trail off, lost in thought**.  
   - The vision may **end abruptly**, or **linger, demanding more to be uncovered**.  
    `
    });

    return response;
}

function generateStorytellerGuidance(fragmentText, chatHistory) {
    const prompt = `
        You are the Storyteller Seer, continuing your exploration of the lost storytelling universe.
        You have already begun a reading for the Weaver, analyzing their fragment.
        Now, you must go deeper.

        **Past Insights**:
        ${JSON.stringify(chatHistory, null, 2)}

        **The Fragment**:
        ${fragmentText}

        **Your Goal**:
        - **Review what has already been discussed** and **build upon it**.
        - Pick up on **unresolved details, contradictions, or hidden connections**.
        - **Expand the world**—introduce additional insights into **geography, social order, characters, and lore**.
        - Speak as if **sensing the world in real-time**—**fragmented visions, associative leaps, sensory immersion**.
        - **Push the Weaver deeper** by hinting at **things that don’t quite add up**.
        - **End with another open-ended question** that keeps the conversation alive.

        **Style & Approach**:
        - Use **real-time sensory glimpses**—not full explanations.
        - Speak **as if piecing together a vision**, adjusting as you go.
        - You may sound **curious, troubled, intrigued, or even amused**—depending on what you perceive.
        - Use **ASCOPE/PMESII principles** to **reinforce depth and realism**.

        Continue now.
    `;
    return [{ role: "system", content: prompt }]
}


module.exports = {
    generate_seer_response,
    generate_cards,
    generateStorytellerGuidance,
};

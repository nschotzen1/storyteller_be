export function developEntityprompt(entity, restOfEntities, fragment, developmentPoints){
    let prompt = `CYou are a worldbuilder expanding a storytelling entity into a richer, more meaningful version of itself. 

**Step 1: Contextual Expansion**
- What is this entity’s deeper history? Expand on its origins, hidden past, and significance in the world.
- How has time, events, or external forces shaped it?

**Step 2: Sensory & Environmental Depth**
- Add vivid sensory details: How does it look, feel, smell, or sound?
- How does its presence affect the surroundings or those who interact with it?

**Step 3: Narrative Connections**
- Expand its connections to other elements of the world. Who or what has interacted with it?
- What myths, rumors, or conflicts surround it?
- Is there a faction, culture, or character particularly tied to it?

**Step 4: Evolution & Impact**
- How has the entity changed? Has it gained new properties, dangers, or significance?
- How does it create new storytelling opportunities or player choices?
- How does it respond to player actions?

## **Step 5: Title & Mechanical Adjustments**
- Adjust the entity’s **title** to reflect its increased specificity and deeper lore.
- Modify relevant skills, storytelling points, and urgency based on its evolved role.


Your goal is to make this entity **richer, more immersive, and more interconnected** in a way that deepens the storytelling experience while keeping it mechanically engaging.

**Input:**  
this is the current narrative of the plot:
${fragment}
${entity}
please use ${developmentPoints} development points for this entity's development. use them well! in the right amount of development
**Output:**  
the title of the entity becomes more specific, it reflects the development in specificity and concreteness. 
A JSON object representing the evolved entity with deeper lore, richer sensory elements, stronger world connections, and increased gameplay relevance.
`
return [{ role: "system", content: prompt }];
}



module.exports = {
    // developEntityprompt, // No longer needed here as it's exported directly
}

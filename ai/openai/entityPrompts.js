// This file will contain prompts related to entity generation and development.

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
    let prompt = `Given the narrative fragment: \${fragment}
Create \${maxNumberOfEntities} entities that exist within and beyond this narrative moment.


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
 need \${maxNumberOfEntities} at the most!
 Do not impose an entity. remember, not everything mentioned in the fragment is suitable to become an entity, think what a creative GM worldbuilder could extrapolate from it, or find related entities to it..use common sense. SHOW don't TELL! craft them with confidence. think like a mature GM. someone with expertise...I don't know,
 it seems to me you're inclined to using heavy lifting terms, instead of letting a real world emerge.
 don't let all the heavy cannons out immediately. prefer adding depthI prefer more grounded,
 textured entities that feel lived-in rather than overtly magical. A mature GM knows subtlety often
 creates more compelling worlds than grand proclamations`
    return [{ role: "system", content: prompt }];
}


export function generate_entities_by_fragment1(fragment, maxNumberOfEntities = 10) {
    let prompt = `Please take a look at the following narrative fragment:

"${fragment}"

This fragment is a piece of a larger storytelling universe, complete with its own history, people, lore, geography, climate, plots, agendas, and organizations. The goal is to create a system that enables users to extrapolate and build upon this universe through collaborative storytelling.

To achieve this, we need to identify the Named Entity Recognition (NER) entities present in the fragment, as these entities represent crucial components of the universe. Each entity is unique and specific to this storytelling universe, with its own distinct characteristics, descriptions, lore, and attributes.

The task is to create a JSON structure that captures these entities, their relationships, and their unique aspects within the universe.

Here's an example of how the JSON structure could be organized:

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
  // ... additional entities ...
]
Categories: Location, Species, Event, Drama, Skill, Artefact, Organization, Phenomenon, Ritual, Conflict, Tradition, Environmental Hazard, Resource, Tactic, Climate, Custom, Language, Emotion.
Dramatic Structures: Mysterious Message, Unexpected Visitor, Lost and Found, Reluctant Ally, Betrayal, Hidden Threat, Prophetic Vision, Strange Encounter, Dilemma, Rescue Mission, Unwelcome Guest, Hidden Passage, False Alarm, Long-Expected Reunion, Misunderstanding, Test of Courage, Sudden Departure, Suspicious Stranger, Impossible Task, Unexpected Gift, Desperate Plea, Hidden Enemy, Broken Promise, Elusive Truth, Last-Minute Save, Unforeseen Obstacle, Heartfelt Goodbye, Reluctant Confession, Lost Artifact, Final Confrontation.

Please return only the JSON so it will not fail on JSON.parse(). This is the max number of entities: ${maxNumberOfEntities}. Try to get all the important entities in the fragment!
Think what a GM might find useful. Extrapolate a little on the fragment if needed to create more concrete, less vague, and useful entities for a GM to build upon and expand.`;

    return [{ role: "system", content: prompt }];
}

export function developEntityprompt(entity, restOfEntities, fragment, developmentPoints){
    let prompt = `You are a worldbuilder expanding a storytelling entity into a richer, more meaningful version of itself.

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
\${fragment}
\${entity}
please use \${developmentPoints} development points for this entity's development. use them well! in the right amount of development
**Output:**
the title of the entity becomes more specific, it reflects the development in specificity and concreteness.
A JSON object representing the evolved entity with deeper lore, richer sensory elements, stronger world connections, and increased gameplay relevance.
`
return [{ role: "system", content: prompt }];
}

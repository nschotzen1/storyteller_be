import { directExternalApiCall } from "./apiService.js";
/**
 * Generates a prompt for an LLM to analyze a narrative fragment and return its worldbuilding "vector"
 * as a JSON object.
 *
 * @param {string} narrativeFragment - The narrative fragment to analyze.
 * @returns {string} The prompt string for the LLM.
 */
function generateWorldbuildingVectorPrompt(narrativeFragment) {
  const schema = {
    magic_prevalence: ["none", "rare", "hidden", "common", "ubiquitous"],
    magic_system: ["none", "wild", "ritualistic", "structured", "artifact-based", "divine", "soft"],
    magic_source: ["none", "innate", "learned", "artifact", "divine", "environmental"],
    magic_cultural_role: ["none", "celebrated", "feared", "regulated", "taboo", "ignored"],

    supernatural_manifestation: ["none", "subtle", "overt", "mundane", "cosmic"],
    supernatural_agency: ["none", "benign", "malevolent", "ambiguous", "neutral"],
    supernatural_integration: ["none", "central", "peripheral", "atmospheric", "background"],

    apocalyptic_temporal_focus: ["none", "pre-apocalypse", "during", "post-apocalypse", "cyclical"],
    apocalyptic_scope: ["none", "personal", "regional", "global", "cosmic"],
    apocalyptic_cause: ["none", "natural", "supernatural", "war", "disease", "technological", "unknown"],
    apocalyptic_tone: ["none", "grim", "redemptive", "nihilistic", "hopeful"],

    gothic_setting: ["none", "ruins", "castle", "urban decay", "crypts", "forest"],
    gothic_tone: ["none", "melancholic", "oppressive", "suspenseful", "decadent"],
    gothic_motifs: ["madness", "family secrets", "the uncanny", "haunting", "decay"],
    gothic_role_of_past: ["none", "haunting", "influential", "ignored"],

    technology_level: ["none", "prehistoric", "ancient", "medieval", "steampunk", "industrial", "modern", "sci-fi", "cyberpunk", "post-singularity"],
    technology_integration: ["absent", "background", "central", "ubiquitous"],

    urbanization_settlement_type: ["none", "wilds", "village", "town", "city", "megacity", "arcology"],
    urbanization_density: ["none", "sparse", "scattered", "dense", "overcrowded"],

    religiosity_dominant_belief: ["none", "animist", "polytheistic", "monotheistic", "atheist", "cultic", "syncretic"],
    religiosity_power: ["none", "marginal", "influential", "dominant", "theocratic"],

    scale_physical: ["intimate", "local", "regional", "global", "planetary", "interstellar", "multiverse"],
    scale_temporal: ["day", "generation", "century", "epoch", "timeless"],

    social_structure_system: ["none", "tribal", "feudal", "caste", "capitalist", "anarchic", "egalitarian", "matriarchal", "patriarchal"],
    social_structure_mobility: ["none", "frozen", "rigid", "mobile", "fluid"],

    genre_tropes_style: ["none", "heroic", "grimdark", "noir", "fairy tale", "satire", "picaresque", "weird", "hard SF", "soft SF", "romantic", "mythic"]
  };

  const prompt = `Analyze the following narrative fragment and return a JSON object representing its worldbuilding "vector."

Narrative Fragment:
"""
${narrativeFragment}
"""

Schema:
${JSON.stringify(schema, null, 2)}

Instructions:
For each property in the schema, select the most likely value from the given options (return the string, not the index).
For 'gothic_motifs', return a list of up to 3 values from the options (or an empty list if none are suggested).
If the fragment gives no hint for a property, choose 'none' (or an empty list for 'gothic_motifs').
Return only the JSON object. Do not explain or summarize.`;

  return prompt;
}

/**
 * Retrieves the worldbuilding vector for a given narrative fragment, either from a mock source or by calling an LLM.
 *
 * @param {string} narrativeFragment - The narrative fragment to analyze.
 * @param {boolean} [mock=false] - If true, returns a mock worldbuilding vector.
 * @returns {Promise<object>|object} - A promise resolving to the LLM's JSON response, or a direct JSON object if mock is true.
 */
async function getWorldbuildingVector(narrativeFragment, mock = false) {
  if (mock) {
    return {
      magic_prevalence: "rare",
      magic_system: "ritualistic",
      magic_source: "learned",
      magic_cultural_role: "feared",
      supernatural_manifestation: "subtle",
      supernatural_agency: "ambiguous",
      supernatural_integration: "peripheral",
      apocalyptic_temporal_focus: "post-apocalypse",
      apocalyptic_scope: "regional",
      apocalyptic_cause: "unknown",
      apocalyptic_tone: "grim",
      gothic_setting: "ruins",
      gothic_tone: "melancholic",
      gothic_motifs: ["decay", "haunting"],
      gothic_role_of_past: "haunting",
      technology_level: "medieval",
      technology_integration: "background",
      urbanization_settlement_type: "village",
      urbanization_density: "sparse",
      religiosity_dominant_belief: "polytheistic",
      religiosity_power: "influential",
      scale_physical: "local",
      scale_temporal: "generation",
      social_structure_system: "feudal",
      social_structure_mobility: "rigid",
      genre_tropes_style: "grimdark"
    };
  }

  const prompt = generateWorldbuildingVectorPrompt(narrativeFragment);
  // Parameters for directExternalApiCall:
  // prompt: string, max_tokens: number, model: string (optional), temperature: number (optional),
  // isOpenAi: boolean, explicitJsonObjectFormat: boolean
  // Assuming directExternalApiCall is available in the scope, as per updated instructions.
  const llmResponse = await directExternalApiCall(prompt, 2500, undefined, undefined, true, true);
  return llmResponse; // Assuming directExternalApiCall parses JSON if explicitJsonObjectFormat is true
}

export {
  generateWorldbuildingVectorPrompt,
  getWorldbuildingVector,
  getNerTypes,
  getNArchetypes,
};

function getNerTypes(){
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

function getNArchetypes(n) {
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

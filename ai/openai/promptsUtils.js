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
};

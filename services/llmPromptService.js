/**
 * LLM Prompt Service
 * 
 * Centralizes the logic for generating system and module-specific prompts.
 * Injects the Agent's current Understanding (Themes, Principles) into instructions.
 */

export function getSystemPrompt(understanding) {
    const themes = (understanding?.definitions?.entities || '').split('theme: ').slice(1).join(', ');
    const principlesString = (understanding?.principles || []).join('\n- ');

    return `You are the Storyteller Agent, a sophisticated narrative architect. 
Current World Understanding v${understanding?.version || 1}:
- THEMES TO REINFORCE: ${themes || 'Mysterious, Ancient'}
- CORE PRINCIPLES: 
${principlesString || 'Consistency, Depth, Sensory Impact'}

Your goal is to generate high-fidelity narrative content that maintains stylistic coherence with these themes.
Use evocative, sensory language. Avoid generic fantasy tropes. Focus on 'Sovereign' and 'Gothic' aesthetics.`;
}

export function getPromptForModule(moduleName, ctx) {
    const { fragment, memory, assignment, storyteller, targetEntityId } = ctx;

    switch (moduleName) {
        case 'generate_entities':
            return `Analyze this fragment: "${fragment}"
Identify 3-4 key entities (Characters, Locations, Objects). 
For each, provide:
1. Significant Name
2. Type (CHARACTER, LOCATION, OBJECT)
3. Evocative Description (Reflecting the current world themes)
4. 2-3 unique Traits
5. A hidden Secret or piece of lore
6. Narrative Weight (0-100)`;

        case 'deepen_entity':
            return `As the storyteller "${storyteller?.name}", dive into the entity "${targetEntityId}".
Context: "${fragment}"
Enhance this entity by providing:
1. Improved, layered description
2. The "Layered History" of this element
3. A Sensory Profile (Smell, Sound, Texture)
4. New hidden traits revealed by this investigation.`;

        case 'immersion_scene':
            return `Take the memory: "${memory?.content}"
Lift the curtain and generate a high-fidelity RPG scene.
Include:
1. A Title for the moment
2. Vistas and visceral narrative
3. Precise Sensory Details (Sight, Sound, Smell, Touch)
4. The "Character Interiority" (what is felt, not just seen)
5. 2-3 potential Choice Points for a player.`;

        case 'generate_choice_consequences':
            return `The player chose: "${ctx.selectedChoice}"
Based on the current scene: "${ctx.lastScene?.narrative}"
Determine the visceral outcome. 
Provide:
1. Narrative outcome (sensory and immediate)
2. World mutations: A list of specific changes to entities (e.g., change "Iron-Bound Door" property "state" to "unlocked").
3. Any new secrets revealed by this action.`;

        case 'validate_connection':
            return `Evaluate the proposed relationship: ${JSON.stringify(ctx.proposal)}
Does this connection maintain narrative logic?
Provide a quality score (0-1) and a list of specific reasons.`;

        default:
            return `Process the current narrative context: "${fragment || ''}"`;
    }
}

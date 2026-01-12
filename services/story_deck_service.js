import { StoryEntity, StorySpread } from '../models/story_models.js';

/**
 * Get the current active spread for a session or generate a new one if none exists (or if previous one is completed? No, strictly idempotent for now).
 * Implementation details:
 * - Checks for an existing spread for this sessionId that is NOT fully chosen?
 * - Or just returns the most recent one?
 * - Requirement: "Check if there is an existing, not-yet-chosen spread... If yes, return it."
 * 
 * @param {string} sessionId 
 * @param {string} universeKey 
 */
export async function getOrGenerateSpread(sessionId, universeKey = "mariposa_world") {
    // Find latest spread for this session
    const existingSpread = await StorySpread.findOne({ sessionId, universe_key: universeKey }).sort({ createdAt: -1 });

    // Check if it exists and if it is "not-yet-chosen". 
    // "Not-yet-chosen" implies at least one position has null chosen_entity_id.
    if (existingSpread) {
        const isFullyChosen = existingSpread.positions.every(p => p.chosen_entity_id);
        if (!isFullyChosen) {
            // Return existing spread with populated options
            return await existingSpread.populate('positions.options');
        }
    }

    // Generate newly
    const positions = ["PLACE", "HERO", "KEYSTONE", "STORYTELLER"];
    const spreadPositions = [];

    for (const posType of positions) {
        // Pick 3 random options for this type
        // Note: In production this should be more sophisticated (avoid repeats, weighted, etc.)
        const options = await StoryEntity.aggregate([
            { $match: { type: posType, universe_keys: universeKey } },
            { $sample: { size: 3 } }
        ]);

        // Fallback if fewer than 3 options exist
        const optionIds = options.map(o => o._id);

        spreadPositions.push({
            position: posType,
            options: optionIds,
            chosen_entity_id: null
        });
    }

    const newSpread = await StorySpread.create({
        sessionId,
        universe_key: universeKey,
        positions: spreadPositions
    });

    return await newSpread.populate('positions.options');
}

/**
 * Record user choices for a spread.
 * @param {string} sessionId 
 * @param {string} spreadId 
 * @param {object} choices - key: position (PLACE, etc.), value: entityId
 */
export async function chooseSpreadOption(sessionId, spreadId, choices) {
    const spread = await StorySpread.findOne({ _id: spreadId, sessionId });

    if (!spread) {
        throw new Error("Spread not found or does not belong to this session.");
    }

    // Validate and update each choice
    for (const [position, chosenId] of Object.entries(choices)) {
        const posIndex = spread.positions.findIndex(p => p.position === position);
        if (posIndex === -1) {
            // Or just ignore extra keys? Let's be strict for POC.
            continue;
        }

        const posObj = spread.positions[posIndex];

        // Validate that chosenId is one of the options
        // posObj.options is an array of ObjectIds (or populated docs if we loaded them, but findOne usually just gives IDs unless populated)
        // We didn't populate above, so they are IDs. 
        // Need to ensuring matching string representations
        const validOption = posObj.options.some(optId => optId.toString() === chosenId);

        if (!validOption) {
            throw new Error(`Invalid choice for ${position}: ${chosenId} is not in the options.`);
        }

        spread.positions[posIndex].chosen_entity_id = chosenId;
    }

    await spread.save();
    return spread;
}

import { directExternalApiCall } from "./openai/apiService.js";
import { getFragment, getEntitiesForSession, setEntitiesForSession } from "../storyteller/utils.js";
import { generateInitialChatPrompt } from "./openai/personaChatPrompts.js";

async function developEntity({sessionId, entityId, developmentPoints}){

    // Await getFragment (assumption: it fetches some game fragment data)
    const fragment = await getFragment(sessionId);

  
    // Fetch all entities related to the session
    let entities = await getEntitiesForSession(sessionId);
    
    // Find the chosen entity
    const entityIndex = entities.findIndex(e => e.id === entityId);
    if (entityIndex === -1) {
      throw Error("could not find entity")
    }
    // Create a minimized field list of the rest of the entities
    const restOfEntities = entities
        .filter(e => e.id !== entityId)
        .map(({ id, name, type }) => ({ id, name, type })); // Adjust fields as needed
    
    // Await entity development function
    const entity = entities[entityIndex]
    const promptMessages = generateInitialChatPrompt(); // Corrected function call, result is an array
    // Call external API
    const externalApiResponse = await directExternalApiCall(promptMessages, 2500, undefined, undefined, true, undefined);
    await setEntitiesForSession(sessionId, entities);


}

const {  generateTextureImgFromPrompt, textToImage, generateTextureOptionsByText, textToImageOpenAi, characterCreationOptionPrompt} = require("./api.js");
const { characterCreationForSessionId } = require("../../character/utils.js")
const { chatWithstoryteller, saveFragment, chooseTextureForSessionId } = require("../../storyteller/utils.js")
const { optionsMock, fragment, userResponses, mockedStorytellerResponses, mockedTextureOptionsPrompts } = require("./mocks.js")

const shouldMockImage = false
const shouldMockUser = false
async function main() {
    
    const sessionId = 175 //Math.floor(Math.random() * (3000) + 1);
    
    
    for (let i = 0; i < shouldMockUser? userResponses.length: 4; i++) {
        const userResp = userResponses[i];
        // const storytellerResp = await chatWithstoryteller(sessionId, fragment, userResp, mockedStorytellerResponses[i]);
        const storytellerResp = await chatWithstoryteller(sessionId, fragment, userResp);
        console.log('asdf', storytellerResp)
    }

    await saveFragment(sessionId, fragment)
    // const textures = await generateTextureOptionsByText(fragment, sessionId, shouldMockImage, mockedTextureOptionsPrompts);
    const textures = await generateTextureOptionsByText(sessionId, shouldMockImage);
    
    await chooseTextureForSessionId(sessionId, 6)
    
    
    const choices = ['', '2', '1', '3', '4'];
    for (const choice of choices) {
        const boo = await characterCreationForSessionId(sessionId, choice, optionsMock);
        console.log('asdf')
    }
        
    
    console.log('ss')
}



// Run the main function
main().catch(error => {
    console.error('Error:', error);
});
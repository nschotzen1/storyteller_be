const { directExternalApiCall, characterCreationInitialOptionsPrompt } = require("../ai/openai/promptsUtils.js")
const {  textToImageOpenAi, characterCreationOptionPrompt} = require("../ai/textToImage/api.js")
const {  getChosenTexture, getSessionChat, getFragment, getCharacterCreationSession, setCharacterCreationQuestionAndOptions, getPreviousDiscussionSummary } = require("../storyteller/utils.js")
const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs')
const characterCreationSessionsDbPath = path.join(__dirname, 'db', 'characterCreationSessions.json');
const shouldMock = true



const getCharacterSessions = async (storagePath=characterCreationSessionsDbPath) => {
    try {
        const data = await fsPromises.readFile(storagePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        // If file doesn't exist, return an empty object
        return {};
    }
  };
  
  const setCharacterSessions = async (sessions, storagePath=characterCreationSessionsDbPath) => {
    await fsPromises.writeFile(storagePath,sessions);
  };

  
  

  async function textToImageGenerateCharacterCards(options, sessionId, texture, question) {
    let imgPromises = options.map((option, idx) => {
        try {
            const subfolderPath = path.join(__dirname, '../../assets', `${sessionId}/character/${Math.floor(Math.random() * 1000)}`);
            if (!fs.existsSync(subfolderPath)){
                  fs.mkdirSync(subfolderPath, { recursive: true });
            }
            const imagePrompt = characterCreationOptionPrompt({ ...option, texture, option_number:idx });
            return textToImageOpenAi(imagePrompt, 1, `${subfolderPath}/${idx}.png`)
                   .then(imageResult => ({...option, ...imageResult, imagePrompt}))
                   .catch(error => ({...option, error: error.message}));
        } catch (error) {
            return {...option, error: error.message};
        }
    });


    
    try {
        const imgResults = await Promise.all(imgPromises);
        // Process cardsData to save in a database or use further.
        return imgResults;
    } catch (error) {
        console.error('Error in generating character cards:', error);
        // Handle or propagate the error as needed
    }
}


function stylizePreviousChat(characterSession) {
  return characterSession.map((entry, i) => {
    if (entry.role === 'user') {
      return entry;
    }
    if (entry.role === 'system' && entry.cardsData) {
      let content = {
        question: entry.content,
        options: entry.cardsData.map(card => ({
          title: card.title,
          description: card.description,
          illustration: card.illustration,
          font: card.font,
          category: card.category,
          subcategory: card.subcategory,
          index: i
        }))
      };
      return { role: 'system', content: JSON.stringify(content) };
    }
    return entry; // Return the original entry if it doesn't meet the above conditions
  });
}


async function characterCreationForSessionId(sessionId, userInput=null, optionsMock){
  const previousDiscussionSummary = await getPreviousDiscussionSummary(sessionId)
  const originalFragment = await getFragment(sessionId)
  const texture = await getChosenTexture(sessionId);
  const initialPrompt = [{
    role: 'system',
    content: characterCreationInitialOptionsPrompt(originalFragment, previousDiscussionSummary, texture.url.revised_prompt)
  }];
  const characterSession = await getCharacterCreationSession(sessionId)
  const previouschatPresentation = stylizePreviousChat(characterSession)
  if(userInput != ''){
    characterSession.push({ role: 'user', content: `the user chose this: ${userInput}.` })
    await setCharacterCreationQuestionAndOptions(sessionId, { role: 'user', content: userInput })
  }
  
  const {question, options} = await directExternalApiCall(initialPrompt.concat(previouschatPresentation), max_tokens = 2500, temperature=1.03);
  
  characterSession.push({ role: 'system', content: question, options });
  // await setCharacterCreationQuestionAndOptions(sessionId, question, options)
  cardsData = await textToImageGenerateCharacterCards(options, sessionId, texture.url.revised_prompt);
  await setCharacterCreationQuestionAndOptions(sessionId, { role: 'system', content: question, options, cardsData })
  return cardsData;
}


module.exports = {
    characterCreationForSessionId
  };
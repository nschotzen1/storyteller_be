import express from 'express';
import cors from 'cors';
import { access, mkdir, readdir, readFile, writeFile } from 'fs/promises'; // Assuming fs.promises was used for these
import { writeFileSync as writeFileSyncFsSync, existsSync, mkdirSync } from 'fs'; // For fsSync operations
import pathNode from 'path'; // Renaming to avoid conflict with the existing 'path' import if any, or to be more explicit.

// Assuming these are named exports from the respective files
import { directExternalApiCall, generateMasterCartographerChat, generatePrefixesPrompt2, generateFragmentsBeginnings, 
  generateContinuationPrompt, generateMasterStorytellerChat, generateMasterStorytellerConclusionChat, askForBooksGeneration } from "./ai/openai/promptsUtils.js";
import { generateTextureImgFromPrompt, generateTextureOptionsByText, developEntity } from "./ai/textToImage/api.js";
import { chatWithStoryteller, saveFragment, updateTurn, getTurn, storytellerDetectiveFirstParagraphCreation, generateEntitiesFromFragment } from './storyteller/utils.js';

const DEMO_MODE = false;

import { fileURLToPath } from 'url';
// import path from 'path'; // This was duplicated, pathNode is used above from 'path'

const __filename = fileURLToPath(import.meta.url);
const __dirname = pathNode.dirname(__filename);




const ensureDirectoryExists = async (dirPath) => {
  try {
      await access(dirPath);  // Try accessing the path, changed from fs.access
  } catch (error) {
      if (error.code === 'ENOENT') {
          // The path doesn't exist, so create the directory
          await mkdir(dirPath, { recursive: true });  // Using recursive to ensure all nested directories are created, changed from fs.mkdir
      } else {
          throw error;  // Rethrow other errors
      }
  }
};

const writeContentToFile = async (subfolderName, fileName, content)=> {
  const subfolderPath = pathNode.join(__dirname, '/assets', subfolderName); // path changed to pathNode

  await ensureDirectoryExists(subfolderPath);
  const rnd = Math.floor(Math.random() * 11);
  writeFileSyncFsSync(pathNode.join(subfolderPath, `${fileName}${rnd}.json`), JSON.stringify(content)); // path changed to pathNode, fsSync.writeFileSync changed to writeFileSyncFsSync
}

// Usage example:
// let userText = "She cautiously braced herself against the side of the wagon, her hands trembling slightly as she felt the rough wood under her fingertips.";
// let texture = "Card texture: 'Inspired by Don Maitz's art style and Elric of Melniboné, oil paint texture forms a tumultuous sea, storm-inspired swirls drift towards the edges, a hidden rune in the bottom left corner for fans to find, epic fantasy, grainy, 8k, ArtStation winner.";
// Absolutely! I would be happy to help. Let's start with structuring the prompt. Here is a rough template for your consideration:

// Prompt Template:

// ```
// {
//   "model": "text-davinci-004",
//   "prompt": "[User's Prefix] $START_{story_continuation_1}$END ${texture_1} $START_{story_continuation_2}$END ${texture_2} $START_{story_continuation_3}$END ${texture_3} $START_{story_continuation_4}$END ${texture_4}",
//   "max_tokens": 500,
//   "temperature": 0.6,
//   "top_p": 1,
//   "frequency_penalty": 0,
//   "presence_penalty": 0
// }
// ```
// The `${story_continuation_n}` are placeholders for the continuation of the story, where `n` is the number of the continuation. `${texture_n}` are placeholders for the texture prompts. These will be replaced by the generated story and texture.

// To ensure the quality and continuity of the story, we'll be using the `$START` and `$END` special tokens. They tell the model where to start and stop the story or the texture. The model will generate text between these tokens.

// Now, let's define the structure of the texture prompts:

// Each texture should include the following elements:

// 1. Inspiration: This could be derived from a book, series, culture, art style, or any sort of cultural creation. For instance, "Inspired by ancient Celtic heritage and the stone circles in [User's Prefix]".

// 2. Visual Description: This includes the main colors, patterns, embellishments, or visuals that can be found in the texture. For instance, "Stone grey and earthy greens, embellishments of ancient Celtic knots, the grainy feel of aged stone."

// 3. Overall Feel: This could include the genre (epic fantasy, grimdark, high fantasy, etc.), the finish (matte, grainy, glossy, etc.), or the contrast (high, low). For instance, "Epic fantasy, grainy, high contrast".

// 4. Other specifics: This includes any other specifics you want to mention. For instance, the size (8k), the platform (ArtStation), or if it's a winner (ArtStation winner). For instance, "8k, RPG card texture."

// So, the overall texture prompt could look like this:

// "Inspired by ancient Celtic heritage and the stone circles in [User's Prefix]. Stone grey and earthy greens, embellishments of ancient Celtic knots, the grainy feel of aged stone. Epic fantasy, grainy, high contrast. 8k, RPG card texture."

// The same can be altered as per the story generated by GPT-4. This approach should ensure a consistent quality and continuity in the story, as well as textures that match the theme and feel of the story. Let me know if this is what you had in mind.
// let userText = "it wasn't even dark";
// let texture = "Card texture: 'Janny Wurts's Wars of Light and Shadow, vibrant magic symbols, color-splashed flourishes, epic fantasy, grainy, 8k, ArtStation winner.";

let userText = "The rain soaked their clothes, turning the earth to mud.";
let texture = "Card texture: 'Janny Wurts's Wars of Light and Shadow, vibrant magic symbols, color-splashed flourishes, epic fantasy, grainy, 8k, ArtStation winner.";

const prefixesPrompt = generatePrefixesPrompt2(userText, texture, 4, true);

console.log(prefixesPrompt);

const app = express();
app.use(express.json());
app.use(cors());

const titles = ["Title 1", "Title 2", "Title 3"]; // Update with your actual titles
const fontNames = ["Arial", "Verdana", "Times New Roman"]; // Update with your actual font names

const getTextureFiles = async (folderNumber) => {
    let dir = pathNode.join(__dirname, 'assets', 'textures', folderNumber.toString()); // path changed to pathNode
    let files = await readdir(dir); // fs.readdir changed to readdir
    return files.filter(file => file.endsWith('.jpeg') || file.endsWith('.png'));
}

function getResponseTexturePrompts(response) {
    return response.map(item => item.texture);
}
  
  
function getResponsePrefixes(response) {
return response.prefixes;
}
  

app.post('/api/storytellingOld', async (req, res) => {
    try {
        console.log('req req ')
      const { userText, textureId } = req.body;
      const texturePrompt = textureId ? await getTexturePromptFromDatabase(textureId) : null;
      const gpt4Prompt =  generatePrefixesPrompt(userText, texturePrompt);
      const gpt4Response = await directExternalApiCall(gpt4Prompt);
    
      // Extracting texture prompts and prefixes
      const texturePrompts = getResponseTexturePrompts(gpt4Response);
      const prefixes = getResponsePrefixes(gpt4Response);
  
      // Generating texture images from prompts
      
      const textureImages = await Promise.all(texturePrompts.map(generateTextureImgFromPrompt));
  
      // Sending the result back to the client
      res.json({
        textureImages,
        prefixes
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.post('/api/storytelling', async (req, res) => {
    try {
        const sanitizeString = (str) => {
          return str.replace(/[^a-zA-Z0-9-_]/g, '_');  // Replace any character that's not a letter, number, underscore, or dash with an underscore
        }
      
        const { userText, textureId, sessionId } = req.body; 
        const turn = await getTurn(sessionId)
  
        await saveFragment(sessionId, userText, turn)
        const prompts = generateContinuationPrompt(userText);
        const prefixes = await directExternalApiCall(prompts, 2500, 1.04);
        const firstThreeWords = sanitizeString(userText.split(' ').slice(0, 3).join('_'));
        const subfolderName = `${firstThreeWords}_${sessionId}}`;  
        await writeContentToFile(subfolderName, 'prefixes', prefixes)
    
        const demo2 = `[{"prefix":"its paw prints melded with frost, hinting","fontName":"Merriweather","fontSize":"16","fontColor":"#665D1E"},{"prefix":"a faint, almost imperceptible scent of sage followed, weaving","fontName":"Crimson Text","fontSize":"16","fontColor":"#4A403A"},{"prefix":"the locals whispered of an ancient spirit, guarding","fontName":"Lora","fontSize":"16","fontColor":"#3E2C2C"},{"prefix":"tracks veered towards the old oak grove, long known","fontName":"Playfair Display","fontSize":"16","fontColor":"#543D3F"}]`
        // Sending the result back to the client
        const demo = `'{"prefixes":[{"prefix":"\". With panic in her eyes, she glanced back briefly, revealing shadows flickering through the trees behind them.\"","fontName":"Roboto","fontSize":"12","fontColor":"#333333"},{"prefix":"\". Gripping my hand tighter, her familiar warmth provided a fleeting comfort amidst the chaos.\"","fontName":"Merriweather","fontSize":"14","fontColor":"#444444"},{"prefix":"\". A thick fog began to descend, obscuring the path ahead, yet the sound of rushing water beckoned them forward.\"","fontName":"Lato","fontSize":"14","fontColor":"#555555"},{"prefix":"\". Just as hope wavered, an old boat, hidden among the reeds, promised a silent escape across the water.\"","fontName":"Open Sans","fontSize":"14","fontColor":"#666666"}],"current_narrative":"\"Run! Now! and don't look back until you reach the river!,\" she said"}'`
        res.json({
          // prefixes : prefixes.continuations.map((e) => {return e.continuation}),
          prefixes,
          current_narrative: userText
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  app.post('/api/storytelling2', async (req, res) => {
    try {
        const sanitizeString = (str) => {
          return str.replace(/[^a-zA-Z0-9-_]/g, '_');  // Replace any character that's not a letter, number, underscore, or dash with an underscore
        }
      
        const { userText, textureId, sessionId } = req.body;  
        let prefixes = []
        if( ! DEMO_MODE){
          prefixes = await storytellerDetectiveFirstParagraphCreation(sessionId, userText);
    
          const firstThreeWords = sanitizeString(userText.split(' ').slice(0, 3).join('_'));
          const subfolderName = `${firstThreeWords}_${sessionId}}`;  
          await writeContentToFile(subfolderName, 'prefixes', prefixes)
        }
        else{
          prefixes = {
            "current_narrative": "It was almost",
            "choices": {
          "choice_1": {
            "options": [
              {
                "continuation": "dusk",
                "storytelling_points": 1,
                "fontName": "Tangerine", // Replace with your default font name
                "fontSize": "100px", // Replace with your default font size
                "fontColor": "black" // Rep
              },
              {
                "continuation": "midnight",
                "storytelling_points": 2,
                "fontName": "Tangerine", // Replace with your default font name
                "fontSize": "70px", // Replace with your default font size
                "fontColor": "black" // Rep
              },
              {
                "continuation": "early morning",
                "storytelling_points": 1,
                "fontName": "Tangerine", // Replace with your default font name
                "fontSize": "70px", // Replace with your default font size
                "fontColor": "black" // Rep
              },
              {
                "continuation": "noon",
                "storytelling_points": 1,
                "fontName": "Tangerine", // Replace with your default font name
                "fontSize": "70px", // Replace with your default font size
                "fontColor": "black" // Rep
              },
              {
                "continuation": "the breaking of dawn",
                "storytelling_points": 3,
                "fontName": "Tangerine", // Replace with your default font name
                "fontSize": "70px", // Replace with your default font size
                "fontColor": "black" // Rep
              }
            ]
          }
            }
          }
        }
    
      
        // Sending the result back to the client
        res.json({
          prefixes: prefixes.options.map(option => ({
            prefix: option.continuation,
            storytelling_points: option.storytelling_points,
            fontName: "Tangerine", // Replace with your default font name
            fontSize: "60px", // Replace with your default font size
            fontColor: "black" // Replace with your default font color
          })),
          current_narrative: prefixes.current_narrative
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  



app.get('/charactercreation', async (req, res)=> {
  const sessionId = req.query.sessionId || 'Unknown Session';
  const userInput = req.query.userInput || '';
  const data = await characterCreationFlow(sessionId);
  res.json( data);
})


app.get('/chatWithMaster', async (req, res) => {

  const sanitizeString = (str) => {
    return str.replace(/[^a-zA-Z0-9-_]/g, '_');  // Replace any character that's not a letter, number, underscore, or dash with an underscore
  }

  const masterName = req.query.masterName || 'Unknown Master';
  const userInput = req.query.userInput || '';
  const sessionId = req.query.sessionId || 'Unknown Session';
  const fragmentText = req.query.fragmentText || '';

  masterResponse = await chatWithStoryteller(sessionId, fragmentText, userInput)

  // res.json({ text: masterResponse, books: book_list });
  res.json({ text: masterResponse });
});

app.get('/createCharacter', async (req, res) => {
  const sessionId = req.query.sessionId || 'Unknown Session';

  // Initialize or retrieve the character creation session
  const characterSessions = await getCharacterSessions();
  if (!characterSessions[sessionId]) {
    characterSessions[sessionId] = {
      step: 'initial',
      data: {}
    };
  }
});
  

app.get('/chatWithMasterWorking', async (req, res) => {

  const sanitizeString = (str) => {
    return str.replace(/[^a-zA-Z0-9-_]/g, '_');  // Replace any character that's not a letter, number, underscore, or dash with an underscore
  }
  const masterName = req.query.masterName || 'Unknown Master';
  const userInput = req.query.userInput || '';
  const sessionId = req.query.sessionId || 'Unknown Session';
  const fragmentText = req.query.fragmentText || '';
  const mock = req.query.mock === 'true';
  

  const chatSessions = await getChatSessions();
  let isNewChat = false;
  if (!chatSessions[sessionId]) {
    chatSessions[sessionId] = [];
    isNewChat = true;
  }

  // Save user input with role
  if(userInput)
    chatSessions[sessionId].push({ role: 'user', content: userInput });

  const previousMessages = chatSessions[sessionId];
  if(! mock){
    prompts = generateMasterCartographerChat(fragmentText);
    if(previousMessages.length > 0)
      prompts = prompts.concat(previousMessages)
    const res = await directExternalApiCall(prompts);
    // const masterResponse = `Hello, ${masterName}. Session ID: ${sessionId}. fragment: ${fragmentText} Previous messages: ${previousMessages}. You said: "${userInput}"`;
    const {guardianOfRealmsReply : masterResponse, discoveredEntities} = res
    const firstThreeWords = sanitizeString(fragmentText.split(' ').slice(0, 3).join('_'));
    const subfolderName = `${firstThreeWords}_${sessionId}}`;  
    writeContentToFile(subfolderName, 'prefixes', res)

    // Save master response with role
    if(masterResponse)
      chatSessions[sessionId].push({ role: 'system', content: masterResponse });
    await setChatSessions(chatSessions);

    res.json({ text: masterResponse });
  }
  else{
    const masterResponse = `Hello, ${masterName}. Session ID: ${sessionId}. fragment: ${fragmentText} Previous messages: ${previousMessages}. You said: "${userInput}"`
    res.json({ text: masterResponse });
  }
});


const rawData = [
  // your entities here
];

// Function to process raw data into groups
function processEntitiesToGroups(data) {
  let groups = [];
  let processedIds = new Set();

  data.forEach(entity => {
      if (!processedIds.has(entity.name)) {
          let group = [];
          let queue = [entity];

          while (queue.length) {
              let current = queue.shift();
              if (!processedIds.has(current.name)) {
                  processedIds.add(current.name);
                  group.push(current);
                  current.connections.forEach(connection => {
                      let connectedEntity = data.find(e => e.name === connection.entity);
                      if (connectedEntity && !processedIds.has(connectedEntity.name)) {
                          queue.push(connectedEntity);
                      }
                  });
              }
          }

          if (group.length) {
              groups.push(group);
          }
      }
  });

  return groups;
}


async function checkIfEnoughStorytellingPoints(sessionId, developmentPoints) {
  // Simulate checking storytelling points
  return true;
}



app.post('/api/developEntity', async (req, res) => {
  try {
      const { sessionId, entityId, development_points: developmentPoints } = req.body;
      
      if (!sessionId || !entityId || developmentPoints === undefined) {
          return res.status(500).json({ error: 'Missing required parameters' });
      }

      const hasEnoughPoints = await checkIfEnoughStorytellingPoints(sessionId, developmentPoints);
      if (!hasEnoughPoints) {
          return res.status(400).json({ error: 'Not enough storytelling points' });
      }

      updatedEntity = await developEntity({sessionId, entityId, developmentPoints})
    
      
      return res.status(200).json({ success: true, updatedEntity });
  } catch (error) {
      console.error('Error in developEntity:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
  }
});





app.post('/api/generateTextures', async (req, res)=> {
  // const cardsMock = [{"url":"/assets/Shore,_At_last_2023-10-02_21:43/texture_0/0.png","cover":"","title":"working title","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":2867},{"url":"/assets/Shore,_At_last_2023-10-02_21:43/texture_1/1.png","cover":"","title":"working title","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":10726},{"url":"/assets/Shore,_At_last_2023-10-02_21:43/texture_2/2.png","cover":"","title":"working title","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":51101},{"url":"/assets/Shore,_At_last_2023-10-02_21:43/texture_3/3.png","cover":"","title":"working title","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":52179}]

  const fragment = req.body.userText || null;
  const sessionId = req.body.sessionId 
  
  const turn = await updateTurn(sessionId)
  
  await saveFragment(sessionId, fragment)
  let cards2 = []
  if(1 == 1){
    const { texturesWithUrls: textures, entitiesWithIllustrations: illustrations } = await generateTextureOptionsByText({sessionId, turn});

    const cards = illustrations.map((illustration, idx) => {
      const texture = textures.find((t) => t.textureJson.id === illustration.selectedTexture.id);
  
      if (!texture) {
        console.warn(`No matching texture found for illustration with ID: ${illustration.selectedTexture.textureJson.id}`);
        return null;
      }
  
      const getValidPath = (path) => {
          // Ensure path is defined before calling string methods on it
          if (!path) return '';  
          return path.includes('/assets') ? path.substring(path.indexOf('/assets')) : path;
      };
  
      return {
        entityId: illustration.entity.id,
        id: idx, // Use the texture ID as the card ID
        front: {
          url: getValidPath(illustration.url.localPath),
          title: illustration.entity.name,
          fontName: illustration.entity.font || "Arial",
          fontSize: `${texture.textureJson.font_size || 14}px`,
          fontColor: texture.textureJson.font_color || "#acc6e0",
        },
        back: {
          url: getValidPath(texture.url.localPath),
          title: illustration.entity.name,
          fontName: texture.textureJson.font || "Arial",
          fontSize: `${texture.textureJson.font_size || 14}px`,
          fontColor: texture.textureJson.font_color || "#acc6e0",
          nerType: illustration.entity.ner_type,
          nerSubtype: illustration.entity.ner_subtype,
          xp: illustration.entity.xp,
          description: illustration.entity.description
        },
      };
  });
  
  // Filter out unmatched cards
  const filteredCards = cards.filter((card) => card !== null);

  console.log(filteredCards);

  cards2 = filteredCards;

  }
  else{
    let cardsMock =   JSON.parse('[{"url":"/assets/ich54uald1c/textures/160/0.png","cover":"","fontName":"Arial ","title":"Location", "fontSize":"32px","fontColor":"red","id":74504},{"url":"/assets/ich54uald1c/textures/253/1.png","title":"Item", "cover":"","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":39190},{"title":"SKILL", "url":"/assets/ich54uald1c/textures/517/2.png","cover":"","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":12938},{"title":"Organization", "url":"/assets/ich54uald1c/textures/28/3.png","cover":"","fontName":"Arial ","fontSize":"32px","fontColor":"red","id":21509}]')
  cardsMock = cardsMock.map((card, index) => {
    return {...card, deck: index % 4};
  });
    cardsMock = cardsMock.concat(cardsMock)
    cards2 = cardsMock.map((e, idx) => { return {entityId:'123123s', id: idx, 'front': e, 'back':e}})
  }
  

  

  
  res.json({
    cards: cards2
  });
})

app.post('/api/generateEntities', async (req, res)=> {
  const fragment = req.body.userText || null;
  const sessionId = req.body.sessionId 
  const entities = await generateEntitiesFromFragment(sessionId, fragment)
  const groupedEntities = processEntitiesToGroups(entities);
})

app.get('/api/prefixes', async (req, res) => {
    const texture = req.query.texture || null;
    const numberOfPrefixes = req.query.numberOfPrefixes || 10; // If number of prefixes is not provided, default to 1
  
    // const prompts = generateFragmentsBeginnings(texture, numberOfPrefixes);
    // const prefixes = await directExternalApiCall(prompts);
    const prefixes = [{"fontName":"Tangerine", 
    "prefix": `it wasn't unusual for them to see wolf tracks so close to the farm, but this one was different  , its grand size imprinting a distinct story on the soft soil"`,
    "fontSize":"34px"}
    ,
    {"fontName":"Tangerine", 
    "prefix": "It was almost dark as they finally reached",
    "fontSize": "34px",},
    {"fontName":"Tangerine", 
    "prefix": "she grasped her amulet strongly, as the horses started gallopping",
    "fontSize": "34px",},
    {"fontName":"Tangerine", 
    "prefix": "Run! Now! and don't look back until you reach the river",
    "fontSize": "34px",},
    {"fontName":"Tangerine", 
    "fontSize": "34px",
    "prefix": "I admit it, seeing the dark woods for the first time was scary"}
    ]  
    console.log(`returning prefixes ${prefixes}`)
    res.json(prefixes);
  });

  
  

app.get('/api/cards', async (req, res) => {
    const n = req.query.n || 4;
    try {
        let cards = [];

        const folderNumber = 31//Math.floor(Math.random() * 33) + 1;
        for (let i = 0; i < n; i++) {
            
          const textures = await getTextureFiles(folderNumber);
          const textureIndex = Math.floor(Math.random() * textures.length);


            const promptsFilePath = pathNode.join(__dirname, `assets/textures/${folderNumber}/prompts.json`); // path changed to pathNode
            let prompts = {};
            try {
                const promptsData = await readFile(promptsFilePath, 'utf-8'); // fs.readFile
                prompts = JSON.parse(promptsData);
            } catch (e) {
                console.warn(`Could not read or parse prompts.json for folder ${folderNumber}:`, e);
                // Keep prompts as {} or handle error as appropriate
            }
            // console.log(JSON.stringify(prompts))
            const titleIndex = prompts?.cardTitles ? Math.floor(Math.random() * prompts.cardTitles.length) : 0;

            cards.push({
                // url: `/assets/textures/${folderNumber}/${textures[textureIndex]}`,
                url: `/assets/textures/books/${i+1}.png`,
                cover: "", // Add logic for cover
                title: prompts.cardTitles && prompts.cardTitles.length > 0  ? prompts.cardTitles[titleIndex].title : "working title",
                fontName: prompts.cardTitles && prompts.cardTitles.length > 0 ? prompts.cardTitles[titleIndex].font : "Arial ",
                fontSize: prompts.cardTitles && prompts.cardTitles.length > 0 ? `${parseInt(parseInt(prompts.cardTitles[titleIndex].size)*1.3)}px` : "32px",
                fontColor: prompts.cardTitles && prompts.cardTitles.length > 0 ? prompts.cardTitles[titleIndex].color : "red",
                id: parseInt(Math.random() * 100000),
                deck: i
            });
        }
        const cardsMock2 = cards.map(e => { return {'front': e, 'back':e}})
        console.log(`Returning cards ${JSON.stringify(cards)}`);
        res.json(cards);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

app.use('/assets', express.static(pathNode.join(__dirname, 'assets'))); // path changed to pathNode
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

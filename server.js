import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import {generateInitialChatPrompt, generateInitialScenePrompt} from './ai/openai/prompts.js';
import { ChatMessage, NarrativeFragment } from './models/models.js'; // Consolidated and corrected ChatMessage import
import { 
    directExternalApiCall, 
    generateContinuationPrompt,
    generateMasterCartographerChat, // Moved from below
    generateFragmentsBeginnings, // Moved from below
    generateTypewriterPrompt // Moved from below and verified for /api/send_typewriter_text
} from './ai/openai/promptsUtils.js';
import { getMockResponse } from './mocks.js';
import { fileURLToPath } from 'url';

// Storyteller utils and models
import { 
    getTurn, 
    storytellerDetectiveFirstParagraphCreation, 
    GeneratedContent, 
    NarrativeEntity, 
    NarrativeTexture, 
    SessionState, 
    SessionSceneState,
    getSessionChat, // Added for chatWithMasterWorking
    setChatSessions,  // Added for chatWithMasterWorking
    generateEntitiesFromFragment, // Added for generateEntitiesPostHandler
    saveFragment, // Verified for /api/send_typewriter_text
    updateTurn // Verified for /api/send_typewriter_text
} from './storyteller/utils.js';
// import { NarrativeFragment } from './models/models.js'; // Moved to consolidated import above
import { characterCreationForSessionId } from './character/utils.js';
// Removed redundant/split import block for ai/openai/promptsUtils.js
import { 
    developEntity, // Added for developEntityPostHandler
    generateTextureOptionsByText // Added for generateTexturesPostHandler
} from './ai/textToImage/api.js';

// Stock Trader imports
import { runPortfolioBacktest } from './stockTrader/backtester.js';
import { DEFAULT_STOCK_UNIVERSE, DEFAULT_HISTORICAL_PERIOD_MONTHS } from './stockTrader/config.js';


// Configuration from environment variables
const CHAT_MOCK_MODE = process.env.CHAT_MOCK_MODE === 'true';
const NARRATION_MOCK_MODE = process.env.NARRATION_MOCK_MODE === 'true';
const STORYTELLING_DEMO_MODE = process.env.STORYTELLING_DEMO_MODE === 'true'; // For /api/storytelling2
const PREFIX_MOCK_MODE = process.env.PREFIX_MOCK_MODE === 'true'; // For /api/prefixes (already correct)
const TYPEWRITER_MOCK_MODE = process.env.TYPEWRITER_MOCK_MODE === 'true';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json());
app.use(cors());


app.use('/assets', express.static(path.join(__dirname, 'assets'))); 
const PORT = process.env.PORT || 5001;



app.post('/api/sendMessage', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }

    const now = Date.now();

    // Check if assistant intro message already exists
    const alreadyHasInitial = await ChatMessage.exists({ sessionId, type: 'initial' });

    // ⏳ If not, insert assistant's intro message FIRST
    if (!alreadyHasInitial) {
      // const introMessage = "Good day! Absolutely thrilled to be making contact with you at last. The paperwork has cleared, and I'm delighted to inform you that we want to send you the typewriter. As discussed. The Society is positively buzzing with anticipation about our arrangement. Do let me know when would be most convenient for delivery.";
      const introMessage = `The Esteemed Storyteller’s Society — Verified Business Account – Pro User — We are pleased to inform you that the typewriter, as discussed, is ready for dispatch. The society spares no expense in ensuring that our esteemed members receive only the finest instruments for their craft. We trust you are still expecting it? Of course you are. Just a quick confirmation before we proceed. Where shall we send it?`;

      await ChatMessage.create({
        sessionId,
        order: now,
        sender: 'system',
        content: introMessage,
        type: 'initial'
      });
    }

    // 🧍‍♂️ THEN save the user's message
    await ChatMessage.create({
      sessionId,
      order: now + 1,
      sender: 'user',
      content: message,
      type: 'user',
      sceneId: 0
    });

    // 🧠 Retrieve history (now includes the intro!)
    const history = await ChatMessage.find({ sessionId }).sort({ order: 1 });

    const formattedHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // 🧾 System prompt
    const initialPrompt = generateInitialChatPrompt(); // your system instructions
    const fullPrompt = [initialPrompt[0], ...formattedHistory];

    // 🛰️ Send to OpenAI or external API
    let gptResponse;
    if (CHAT_MOCK_MODE) { // Updated to CHAT_MOCK_MODE
      gptResponse = getMockResponse();
    }
    else {
      gptResponse = await directExternalApiCall(fullPrompt, 2500, undefined, undefined, true, false);
    }
    
    const { has_chat_ended, message_assistant } = gptResponse || {};

    // Save to DB
    await ChatMessage.create({
      sessionId,
      order: now + 2,
      sender: 'system',
      content: message_assistant,
      type: 'response',
      sceneId: 0,
    });

return res.status(200).json({ reply: message_assistant, has_chat_ended });


  } catch (err) {
    console.error("Error in /api/sendMessage:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Inside your server (e.g. server.js or app.js)

app.post('/api/submitRoll', async (req, res) => {
  try {
    const rollData = req.body;

    if (!rollData || !rollData.check || !rollData.dice || !rollData.results) {
      return res.status(400).json({ error: 'Missing required roll fields' });
    }

    console.log('Received roll submission:', JSON.stringify(rollData, null, 2));

    // (later you can: Save to database, trigger events, etc.)

    return res.status(200).json({ success: true, message: 'Roll received' });
  } catch (error) {
    console.error('Error in /api/submitRoll:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// --- New Route: Generate Next Film Image ---
app.post('/api/next_film_image', async (req, res) => {
  try {
    const { sessionId, text } = req.body;

    if (!sessionId || !text) {
      return res.status(400).json({ error: 'Missing sessionId or text' });
    }

    // For now, just pick a random texture 1-10:
    const textureIndex = Math.floor(Math.random() * 10) + 1;
    const paper = `/assets/paper_textures/paper_texture_${textureIndex}.png`;
    const fullUrl = req.protocol + '://' + req.get('host') + paper;
    


    // Optionally pick a random font config
    const fontOptions = [
      { font: "'Uncial Antiqua', serif", font_size: "1.8rem", font_color: "#3b1d15" },
      { font: "'IM Fell English SC', serif", font_size: "1.9rem", font_color: "#2a120f" },
      { font: "'EB Garamond', serif", font_size: "2.0rem", font_color: "#1f0e08" }
    ];
    const fontConfig = fontOptions[Math.floor(Math.random() * fontOptions.length)];

    // Combine in response:
    return res.status(200).json({
      image_url: fullUrl,
      ...fontConfig
    });

  } catch (error) {
    console.error('Error in /api/next_film_image:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/api/send_typewriter_text', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Missing sessionId or message' });
    }

    console.log(`✍️ Typewriter API — Session: ${sessionId} — Message: ${message}`);

    if (TYPEWRITER_MOCK_MODE) {
      const wordCount = message.trim().split(/\s+/).length;
      let mockResponse;

      if (wordCount <= 5) {
        // Short addition
        mockResponse = {
                writing_sequence: [
                  { action: 'type', text: 'It was almost', delay: 0 },
                  { action: 'pause', delay: 4000 },
                  { action: 'type', text: ' night', delay: 0 },
                  { action: 'pause', delay: 6000 },
                  { action: 'type', text: ' as the band finally', delay: 0 },
                  { action: 'pause', delay: 8000 },
                  { action: 'type', text: ' approached', delay: 0 },
                  { action: 'pause', delay: 5000 },
                  { action: 'type', text: ' what seemed to be like', delay: 0 },
                  { action: 'pause', delay: 9000 },
                  { action: 'type', text: ' a broken Ter', delay: 0 },
                  { action: 'pause', delay: 3000 },
                  { action: 'type', text: 'ra', delay: 0 },
                  { action: 'delete', count: 1, delay: 500 },   // deletes 'a' in 'Tera'
                  { action: 'retype', text: 'a', delay: 0 },    // retypes 'a', hesitation
                  { action: 'type', text: 'ce.', delay: 0 },
                  { action: 'pause', delay: 16000 },
                  // Fade-out steps
                  { action: 'fade', phase: 1, to_text: 'It was night. The band approached a terrace.', delay: 2000 },
                  { action: 'fade', phase: 2, to_text: 'Night. They arrived.', delay: 1800 },
                  { action: 'fade', phase: 3, to_text: 'A band. Night.', delay: 1200 },
                  { action: 'fade', phase: 4, to_text: '', delay: 900 }
                ],
                metadata: {
                  font: "'Uncial Antiqua', serif",
                  font_size: "1.8rem",
                  font_color: "#3b1d15"
                }
              }

      } else if (wordCount <= 12) {
        // Medium addition
        mockResponse = {
        writing_sequence: [
          { action: 'type', text: 'She clutched her amulet to her coat.', delay: 0 },
          { action: 'pause', delay: 5000 },
          { action: 'type', text: ' As the horses carrying her carriage gal', delay: 0 },
          { action: 'pause', delay: 6000 },
          { action: 'type', text: 'lo', delay: 0 },
          { action: 'delete', count: 2, delay: 300 }, // deletes 'lo' (as if typo)
          { action: 'retype', text: 'lop', delay: 0 }, // corrects to 'lop'
          { action: 'type', text: 'ped through the front gate', delay: 0 },
          { action: 'pause', delay: 8000 },
          // Fade-out steps
          { action: 'fade', phase: 1, to_text: 'She clutched the amulet as the carriage entered the gate.', delay: 2000 },
          { action: 'fade', phase: 2, to_text: 'Amulet. Horses. Gate.', delay: 1800 },
          { action: 'fade', phase: 3, to_text: 'Night. Movement.', delay: 1200 },
          { action: 'fade', phase: 4, to_text: '', delay: 900 }
        ],
        metadata: {
          font: "'Uncial Antiqua', serif",
          font_size: "1.8rem",
          font_color: "#3b1d15"
        }
      }
      } else {
        // Long addition
        mockResponse = {
          content: "But the words you wrote had already been written — long ago, by another hand. It had only waited for your ink to remember.",
          font: "'EB Garamond', serif",
          font_size: "2.0rem",
          font_color: "#1f0e08",
          time_to_fade: 18
        };
      }

      // Save fragments
      const userTurn = await updateTurn(sessionId);
      const userFragment = {
        type: 'user_input',
        timestamp: new Date().toISOString(),
        text: message
      };
      await saveFragment(sessionId, userFragment, userTurn);

      const systemTurn = await updateTurn(sessionId);
      const systemFragmentData = mockResponse; // Already determined
      const systemFragment = {
        type: 'system_response',
        timestamp: new Date().toISOString(),
        data: systemFragmentData
      };
      await saveFragment(sessionId, systemFragment, systemTurn);
      
      return res.status(200).json(mockResponse);
    } else {
      let aiResponse;
      try {
        const prompt = generateTypewriterPrompt(message);
        aiResponse = await directExternalApiCall(prompt, 2500, undefined, undefined, true, true);
        
        // Save fragments
        const userTurn = await updateTurn(sessionId);
        const userFragment = {
          type: 'user_input',
          timestamp: new Date().toISOString(),
          text: message
        };
        await saveFragment(sessionId, userFragment, userTurn);

        const systemTurn = await updateTurn(sessionId);
        const systemFragmentData = aiResponse; // Already determined
        const systemFragment = {
          type: 'system_response',
          timestamp: new Date().toISOString(),
          data: systemFragmentData
        };
        await saveFragment(sessionId, systemFragment, systemTurn);

        return res.status(200).json(aiResponse);
      } catch (aiError) {
        console.error('Error calling AI for typewriter response or saving fragments:', aiError);
        // If aiResponse is undefined because the AI call failed, we still might want to save the user part
        // but the current logic structure saves both after AI response or mock is determined.
        // For now, if AI call fails, nothing is saved from this block.
        return res.status(500).json({ error: 'Failed to get AI response for typewriter or save fragments' });
      }
    }
  } catch (error) {
    console.error('Error in /api/send_typewriter_text:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal Server Error in typewriter route' });
    }
  }
});



app.post('/api/shouldGenerateContinuation', async (req, res) => {
  try {
    const { currentText, latestAddition, latestPauseSeconds } = req.body;

    if (!currentText || !latestAddition || typeof latestPauseSeconds !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const wordCount = latestAddition.trim().split(/\s+/).filter(Boolean).length;
    const totalLength = currentText.trim().split(/\s+/).length;

    // Base wait time
    const basePause = 1.8;

    // Longer current text = longer delay
    const scaleFactor = Math.min(3, totalLength * 0.05); // caps at +3s

    // Bigger additions require more time
    const additionFactor = Math.min(1.5, wordCount * 0.2); // caps at +1.5s

    // Add random variation (mild unpredictability)
    const randomness = Math.random() * 0.7 - 0.3; // between -0.3s and +0.4s

    const requiredPause = basePause + scaleFactor + additionFactor + randomness;

    const shouldGenerate = latestPauseSeconds > requiredPause;

    console.log(`[shouldGenerate] pause: ${latestPauseSeconds.toFixed(1)}s vs needed ${requiredPause.toFixed(2)}s → ${shouldGenerate}`);

    return res.status(200).json({ shouldGenerate });
  } catch (error) {
    console.error('Error in /api/shouldGenerateContinuation:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.post('/api/getNarrationScript', async (req, res) => {
  try {
    const { sessionId, sceneId, content } = req.body;

    if (!sessionId || !sceneId) {
      return res.status(400).json({ error: 'Missing sessionId or sceneId' });
    }

    const now = Date.now();

    // 1️⃣ If no initial system message, create it
    const alreadyHasInitial = await ChatMessage.exists({ sessionId, sceneId, type: 'initial' });

    if (!alreadyHasInitial) {
      const introMessage = `Opening narration for scene: ${sceneId}`;
      await ChatMessage.create({
        sessionId,
        sceneId,
        order: now,
        sender: 'system',
        content: introMessage,
        type: 'initial'
      });
    }

    // 2️⃣ Save user's content
    if (content) {
      await ChatMessage.create({
        sessionId,
        sceneId,
        order: now + 1,
        sender: 'user',
        content: content,
        type: 'user'
      });
    }

    // 3️⃣ Build history for this scene
    const history = await ChatMessage.find({ sessionId, sceneId }).sort({ order: 1 });

    const formattedHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'system',
      content: msg.content
    }));

    // 4️⃣ System prompt
    const initialPrompt = generateInitialScenePrompt(sceneId);
    const fullPrompt = [initialPrompt[0], ...formattedHistory];

    let gptResponse;

    if (NARRATION_MOCK_MODE) { // Updated to NARRATION_MOCK_MODE
      console.log(`(MOCK) Narration requested for sceneId: ${sceneId}`);
      gptResponse = {
        narrationScript: [
          { text: "It's been a few days since that strange messaging correspondence...", font: "mono", size: "lg", color: "text-white", delay: 0 },
          { text: "Something about a typewriter... you almost forgot.", font: "cinzel", size: "2xl", color: "text-yellow-100", delay: 3000 },
          { text: "It's nearly dusk. The streets of San Juan are dry and hot.", font: "serif", size: "xl", italic: true, color: "text-white", delay: 6000 },
          { text: "You turn the key to your apartment.", font: "mono", size: "lg", color: "text-white", delay: 9000 },
        ],
        has_chat_ended: false,
        required_rolls: {
          check: "Observation + Wits",
          dice: "6d6",
          canPush: true
        }
      };
    } else {
      gptResponse = await directExternalApiCall(fullPrompt, 2500, undefined, undefined, true, false);
    }

    const { narrationScript, has_chat_ended, required_rolls } = gptResponse || {};

    // 5️⃣ Save GPT system response
    await ChatMessage.create({
      sessionId,
      sceneId,
      order: now + 2,
      sender: 'system',
      content: JSON.stringify(narrationScript),
      type: 'response',
      has_chat_ended: has_chat_ended || false,
      required_rolls: required_rolls || null
    });

    return res.status(200).json({ narrationScript, has_chat_ended, required_rolls });

  } catch (err) {
    console.error('Error in /api/getNarrationScript:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});




app.use('/assets', express.static(path.join(__dirname, 'assets'))); 


// Helper function (can be placed in a shared utility file later)
const sanitizeString = (str) => {
  if (typeof str !== 'string') {
    return 'invalid_input'; // Or throw an error, or handle as appropriate
  }
  return str.replace(/[^a-zA-Z0-9-_]/g, '_');
};


// Refactored Route Handlers from serverold.js

const storytellingRouteHandler = async (req, res) => {
  try {
    const { userText, textureId, sessionId } = req.body; // textureId is not used in the core logic here but kept for signature consistency
    
    if (!sessionId || !userText) {
        return res.status(400).json({ message: 'Missing sessionId or userText in request body.' });
    }

    const turn = await getTurn(sessionId); // Still reads from JSON for now

    await saveFragment(sessionId, userText, turn); // Writes to MongoDB

    const prompts = generateContinuationPrompt(userText);
    const prefixesFromAI = await directExternalApiCall(prompts, 2500, 1.04);

    // Save prefixes to GeneratedContent
    const generatedPrefixes = new GeneratedContent({
      sessionId: sessionId,
      contentType: 'prefix', // As per instruction
      contentData: prefixesFromAI, // Storing the direct AI response
      turn: turn
    });
    await generatedPrefixes.save();

    res.json({
      prefixes: prefixesFromAI, // Send the AI response directly
      current_narrative: userText
    });
  } catch (err) {
    console.error('Error in /api/storytelling:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

const storytelling2RouteHandler = async (req, res) => {
  try {
    const { userText, textureId, sessionId } = req.body; // textureId is not used here
    
    if (!sessionId) { 
        return res.status(400).json({ message: 'Missing sessionId in request body.' });
    }
    
    let prefixesResponse;
    let currentTurn; // To store turn for GeneratedContent if applicable

    if (!STORYTELLING_DEMO_MODE) { // Updated to STORYTELLING_DEMO_MODE
      if (!userText) { // userText is required if not in DEMO_MODE
        return res.status(400).json({ message: 'Missing userText in request body for non-demo mode.' });
      }
      prefixesResponse = await storytellerDetectiveFirstParagraphCreation(sessionId, userText);
      currentTurn = await getTurn(sessionId); // Get current turn for logging

      // Save prefixes to GeneratedContent
      const generatedPrefixes = new GeneratedContent({
        sessionId: sessionId,
        contentType: 'prefix_options', // Differentiating content type
        contentData: prefixesResponse.options || prefixesResponse.choices, 
        turn: currentTurn 
      });
      await generatedPrefixes.save();

    } else {
      // DEMO_MODE logic
      prefixesResponse = {
        current_narrative: "It was almost", 
        choices: { 
          choice_1: { 
            options: [
              { continuation: "dusk", storytelling_points: 1, fontName: "Tangerine", fontSize: "100px", fontColor: "black" },
              { continuation: "midnight", storytelling_points: 2, fontName: "Tangerine", fontSize: "70px", fontColor: "black" },
              { continuation: "early morning", storytelling_points: 1, fontName: "Tangerine", fontSize: "70px", fontColor: "black" },
              { continuation: "noon", storytelling_points: 1, fontName: "Tangerine", fontSize: "70px", fontColor: "black" },
              { continuation: "the breaking of dawn", storytelling_points: 3, fontName: "Tangerine", fontSize: "70px", fontColor: "black" }
            ]
          }
        }
      };
      const generatedPrefixesDemo = new GeneratedContent({
        sessionId: sessionId,
        contentType: 'prefix_options_demo',
        contentData: prefixesResponse.choices.choice_1.options,
        turn: 0 // Placeholder turn for demo
      });
      await generatedPrefixesDemo.save();
    }
    
    let responseOptions;
    if (prefixesResponse.options) { 
        responseOptions = prefixesResponse.options;
    } else if (prefixesResponse.choices && prefixesResponse.choices.choice_1 && prefixesResponse.choices.choice_1.options) { 
        responseOptions = prefixesResponse.choices.choice_1.options;
    } else {
        console.error("Unexpected prefixesResponse structure:", prefixesResponse);
        return res.status(500).json({ message: "Internal server error due to unexpected data structure." });
    }

    res.json({
      prefixes: responseOptions.map(option => ({
        prefix: option.continuation,
        storytelling_points: option.storytelling_points,
        fontName: option.fontName || "Tangerine", 
        fontSize: option.fontSize || "60px", 
        fontColor: option.fontColor || "black" 
      })),
      current_narrative: prefixesResponse.current_narrative || userText 
    });
  } catch (err) {
    console.error('Error in /api/storytelling2:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add new routes
app.post('/api/storytelling', storytellingRouteHandler);
app.post('/api/storytelling2', storytelling2RouteHandler);

// Character Creation Route Handlers

const characterCreationGetHandler = async (req, res) => {
  try {
    const sessionId = req.query.sessionId || 'Unknown Session';
    const userInput = req.query.userInput || ''; 

    const data = await characterCreationForSessionId(sessionId, userInput, null); 
    
    res.json(data);
  } catch (err) {
    console.error('Error in /charactercreation:', err);
    if (err.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid ID format provided.' });
    }
    res.status(500).json({ message: 'Server error during character creation process.' });
  }
};

const createCharacterGetHandler = async (req, res) => {
  try {
    const sessionId = req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required.' });
    }

    const session = await SessionState.findOneAndUpdate(
      { sessionId: sessionId }, 
      { $setOnInsert: { sessionId: sessionId, lastUpdatedAt: new Date() } }, 
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ 
      message: `Session for ${sessionId} ensured/initialized.`,
      sessionData: { 
          sessionId: session.sessionId,
          turn: session.turn, 
          lastUpdatedAt: session.lastUpdatedAt
      }
    });

  } catch (err) {
    console.error('Error in /createCharacter:', err);
    res.status(500).json({ message: 'Server error during session initialization.' });
  }
};

// Add new character creation GET routes
app.get('/charactercreation', characterCreationGetHandler);
app.get('/createCharacter', createCharacterGetHandler);

// Chat With Master Working Route Handler
const chatWithMasterWorkingGetHandler = async (req, res) => {
  try {
    const { masterName, userInput, sessionId, fragmentText, mock: mockQuery } = req.query;
    const mock = mockQuery === 'true';

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required.' });
    }
    if (!fragmentText && !mock) { 
        return res.status(400).json({ message: 'fragmentText is required for non-mock requests.' });
    }

    let chatHistory = await getSessionChat(sessionId); 

    if (userInput) {
      chatHistory.push({ role: 'user', content: userInput });
    }

    let masterResponseText;

    if (!mock) {
      const initialPrompts = generateMasterCartographerChat(fragmentText);
      const fullPromptHistory = initialPrompts.concat(chatHistory.map(item => ({role: item.role, content: item.content}))); 
      
      const aiResponse = await directExternalApiCall(fullPromptHistory);
      
      if (!aiResponse || !aiResponse.guardianOfRealmsReply) {
        console.error("Invalid AI Response structure:", aiResponse);
        return res.status(500).json({ message: 'Error processing AI response.' });
      }

      masterResponseText = aiResponse.guardianOfRealmsReply;
      const discoveredEntities = aiResponse.discoveredEntities;

      const masterChatContent = new GeneratedContent({
        sessionId: sessionId,
        contentType: 'masterChatResponse',
        contentData: {
            guardianOfRealmsReply: masterResponseText,
            discoveredEntities: discoveredEntities,
        },
        fragmentText: fragmentText, 
      });
      await masterChatContent.save();

      if (masterResponseText) {
        chatHistory.push({ role: 'system', content: masterResponseText });
      }
    } else {
      masterResponseText = `Hello, ${masterName || 'Master'}. Session ID: ${sessionId}. Fragment: ${fragmentText || 'N/A'}. You said: "${userInput || ''}". This is a mock response.`;
      chatHistory.push({ role: 'system', content: masterResponseText });
    }

    await setChatSessions(sessionId, chatHistory); 

    res.json({ text: masterResponseText });

  } catch (err) {
    console.error('Error in /chatWithMasterWorking:', err);
    res.status(500).json({ message: 'Server error during master chat.' });
  }
};

// Add the new GET route (simplified name)
app.get('/api/chatWithMaster', chatWithMasterWorkingGetHandler);

// Entity Development and Generation Route Handlers

// Placeholder function for checking storytelling points
async function checkIfEnoughStorytellingPoints(sessionId, points) {
  // In a real implementation, this would check against SessionState or another source
  console.log(`Checking storytelling points for session ${sessionId}: ${points} points requested.`);
  return true; // Placeholder, always returns true
}

// Helper function copied from serverold.js
function processEntitiesToGroups(data) {
  if (!Array.isArray(data)) {
    console.error("processEntitiesToGroups: input data is not an array", data);
    return []; // Return empty array or handle error as appropriate
  }
  let groups = [];
  let processedIds = new Set();

  data.forEach(entity => {
    if (!entity || typeof entity.name === 'undefined' || !Array.isArray(entity.connections)) {
      console.warn("processEntitiesToGroups: skipping invalid entity", entity);
      return; // Skip malformed entities
    }
    if (!processedIds.has(entity.name)) {
      let group = [];
      let queue = [entity];

      while (queue.length) {
        let current = queue.shift();
        if (!processedIds.has(current.name)) {
          processedIds.add(current.name);
          group.push(current);
          current.connections.forEach(connection => {
            if (!connection || typeof connection.entity === 'undefined') {
              console.warn("processEntitiesToGroups: skipping invalid connection in entity", current.name, connection);
              return; // Skip malformed connections
            }
            let connectedEntity = data.find(e => e && e.name === connection.entity);
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

const developEntityPostHandler = async (req, res) => {
  try {
    const { sessionId, entityId, development_points: developmentPoints } = req.body;

    if (!sessionId || !entityId || developmentPoints === undefined) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId, entityId, or development_points.' });
    }

    const hasEnoughPoints = await checkIfEnoughStorytellingPoints(sessionId, developmentPoints);
    if (!hasEnoughPoints) {
      return res.status(400).json({ message: 'Not enough storytelling points for development.' });
    }

    const updatedEntityData = await developEntity({ sessionId, entityId, developmentPoints });
    
    if (!updatedEntityData) {
        return res.status(500).json({ message: 'Entity development process did not return data.' });
    }

    return res.status(200).json({ success: true, updatedEntity: updatedEntityData });
  } catch (error) {
    console.error('Error in /api/developEntity:', error);
    if (error.message.includes("could not find entity")) { 
        return res.status(404).json({ message: 'Entity not found for development.' });
    }
    res.status(500).json({ message: 'Server error during entity development.' });
  }
};

const generateEntitiesPostHandler = async (req, res) => {
  try {
    const { userText, sessionId } = req.body;

    if (!sessionId || !userText) {
      return res.status(400).json({ message: 'Missing required parameters: sessionId or userText.' });
    }

    const entities = await generateEntitiesFromFragment(sessionId, userText);
    const groupedEntities = processEntitiesToGroups(entities); 
    // console.log("Grouped Entities (not returned in response):", groupedEntities);

    res.status(200).json({ entities: entities, message: "Entities generated and saved." }); 

  } catch (error) {
    console.error('Error in /api/generateEntities:', error);
    res.status(500).json({ message: 'Server error during entity generation.' });
  }
};

// Add new POST routes for entity development and generation
app.post('/api/developEntity', developEntityPostHandler);
app.post('/api/generateEntities', generateEntitiesPostHandler);

// Texture Generation and Prefixes Route Handlers

const generateTexturesPostHandler = async (req, res) => {
  try {
    const { userText, sessionId } = req.body;

    if (!sessionId || userText === undefined) { 
      return res.status(400).json({ message: 'Missing required parameters: sessionId or userText.' });
    }
    const fragment = userText; 

    const turn = await updateTurn(sessionId); 
    await saveFragment(sessionId, fragment, turn); 

    const { entitiesWithIllustrations } = await generateTextureOptionsByText({ sessionId, turn, shouldMockImage: false });

    res.json({ cards: entitiesWithIllustrations });

  } catch (error) {
    console.error('Error in /api/generateTextures:', error);
    res.status(500).json({ message: 'Server error during texture generation.' });
  }
};

const dynamicPrefixesPostHandler = async (req, res) => {
  const mockPrefixes = [
    {"fontName":"Tangerine", "prefix": "it wasn't unusual for them to see wolf tracks so close to the farm, but this one was different, its grand size imprinting a distinct story on the soft soil", "fontSize":"34px"},
    {"fontName":"Tangerine", "prefix": "It was almost dark as they finally reached", "fontSize": "34px"},
    {"fontName":"Tangerine", "prefix": "she grasped her amulet strongly, as the horses started galloping", "fontSize": "34px"},
    {"fontName":"Tangerine", "prefix": "Run! Now! and don't look back until you reach the river", "fontSize": "34px"},
    {"fontName":"Tangerine", "prefix": "I admit it, seeing the dark woods for the first time was scary", "fontSize": "34px"}
  ];

  try {
    const { sessionId, contextText, useMock } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required.' });
    }

    if (useMock || PREFIX_MOCK_MODE) {
      const mockPrefixLog = new GeneratedContent({
        sessionId: sessionId,
        contentType: 'dynamicPrefixList_mock',
        contentData: mockPrefixes,
        createdAt: new Date()
      });
      await mockPrefixLog.save();
      return res.json(mockPrefixes);
    }

    if (!contextText) {
      return res.status(400).json({ message: 'contextText is required for non-mock mode.' });
    }

    const aiPrompts = generateFragmentsBeginnings(contextText, 5); 
    const generatedPrefixesFromAI = await directExternalApiCall(aiPrompts); 

    if (!Array.isArray(generatedPrefixesFromAI)) {
        console.error("AI did not return an array for prefixes:", generatedPrefixesFromAI);
        return res.status(500).json({ message: "Error processing AI response for prefixes."});
    }
    
    const prefixLog = new GeneratedContent({
      sessionId: sessionId,
      contentType: 'dynamicPrefixList',
      contentData: generatedPrefixesFromAI,
      createdAt: new Date()
    });
    await prefixLog.save();

    res.json(generatedPrefixesFromAI);

  } catch (error) {
    console.error('Error in /api/prefixes POST:', error);
    res.status(500).json({ message: 'Server error during prefix generation.' });
  }
};

// Add new POST routes for texture generation and prefixes
app.post('/api/generateTextures', generateTexturesPostHandler);
app.post('/api/prefixes', dynamicPrefixesPostHandler);

// --- Stock Trader Backtest Route ---
app.get('/backtest/portfolio', async (req, res) => {
  try {
    const {
      initialSymbol,
      numMonths: numMonthsStr,
      endMonthYYYYMM,
      stockUniverse: stockUniverseStr,
      interval: intervalStr
    } = req.query;

    if (!initialSymbol) {
      return res.status(400).json({ error: 'Missing required query parameter: initialSymbol' });
    }

    const numMonths = numMonthsStr ? parseInt(numMonthsStr, 10) : DEFAULT_HISTORICAL_PERIOD_MONTHS;
    if (isNaN(numMonths) || numMonths <= 0) {
      return res.status(400).json({ error: 'Invalid numMonths parameter. Must be a positive integer.' });
    }

    const stockUniverse = stockUniverseStr
      ? stockUniverseStr.split(',').map(s => s.trim()).filter(s => s)
      : DEFAULT_STOCK_UNIVERSE;
    if (!Array.isArray(stockUniverse) || stockUniverse.length === 0) {
        return res.status(400).json({ error: 'stockUniverse must be a non-empty array or provide a valid comma-separated string.' });
    }

    let effectiveStockUniverse = [...new Set(stockUniverse)]; // Use Set to remove duplicates then spread to array
    if (!effectiveStockUniverse.includes(initialSymbol)) {
        effectiveStockUniverse.push(initialSymbol);
    }


    const interval = intervalStr || '1min';
    const validIntervals = ['1min', '5min', '15min', '30min', '60min'];
    if (!validIntervals.includes(interval)) {
        return res.status(400).json({ error: `Invalid interval. Must be one of: ${validIntervals.join(', ')}` });
    }

    console.log(`Received /backtest/portfolio request: initialSymbol=${initialSymbol}, numMonths=${numMonths}, endMonth=${endMonthYYYYMM || 'not set'}, universe=[${effectiveStockUniverse.join(',')}], interval=${interval}`);

    const results = await runPortfolioBacktest(
      initialSymbol,
      numMonths,
      endMonthYYYYMM, // This can be undefined
      effectiveStockUniverse,
      interval
    );

    if (results && results.summary && results.summary.error) {
      // Specific error from backtester (e.g. API key missing, no data)
      const statusCode = results.summary.error.toLowerCase().includes("api key") ? 401 : 400;
      return res.status(statusCode).json({ error: results.summary.error, details: results });
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Error in /backtest/portfolio route:', error);
    // Catch unexpected errors from runPortfolioBacktest or other issues
    return res.status(500).json({ error: 'Internal Server Error while running backtest.', details: error.message });
  }
});


app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

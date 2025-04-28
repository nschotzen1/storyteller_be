
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import generateInitialChatPrompt from './ai/openai/prompts.js';
import ChatMessage  from './models/models.js';
import { directExternalApiCall } from './ai/openai/promptsUtils.js';
import { getMockResponse } from './mocks.js';
import { fileURLToPath } from 'url';


let CHAT_MOCK = true; // Set to false to use the actual OpenAI API
let NARRATION_MOCK = true; // Toggle mock mode here or in your config


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
      type: 'user'
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
    if (CHAT_MOCK) {
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
      type: 'response'
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

    if (NARRATION_MOCK) {
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


app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

// migrate.js
const mongoose = require('mongoose');
const fs = require('fs').promises;

// 1. Connect to MongoDB (adjust the connection string as needed)
mongoose.connect('mongodb://localhost:27017/storytelling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// 2. Define Schemas and Models

// Option A: Using a "data" field to store arbitrary fields
const entitySchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
});

const textureSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
});

const chatSchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
});

const Entity = mongoose.model('Entity', entitySchema);
const Texture = mongoose.model('Texture', textureSchema);
const Chat = mongoose.model('Chat', chatSchema);

// ---
// Option B (Alternate):
// If you prefer to store fields at the top level without a fixed schema, you could do:
//
// const flexibleEntitySchema = new mongoose.Schema(
//   {
//     session_id: { type: String, required: true },
//     // No explicit fields for the inner data – all keys are allowed.
//   },
//   { strict: false }
// );
// const FlexibleEntity = mongoose.model('FlexibleEntity', flexibleEntitySchema);
//
// This approach lets you query on arbitrary keys directly, but you lose some control
// over the shape of your documents.
// ---

// 3. (Optional) Field Mapping Function
// If you want to remap field names to a common standard, define your mapping here.
function mapFields(obj, mapping = {}) {
  const newObj = {};
  for (const key in obj) {
    // If there's a mapping for this key, use the new key; otherwise, keep the original.
    const mappedKey = mapping[key] || key;
    newObj[mappedKey] = obj[key];
  }
  return newObj;
}

// 4. Main Migration Function
async function migrate() {
  try {
    // Read the JSON file from disk.
    const filePath = '/Users/shlomo.chotzen/Documents/GitHub/game/storyteller_be/storyteller/db/storytelling.json';
    const fileData = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileData);

    // Assume the JSON file has the following structure:
    // {
    //   "session_id": "someSessionId",
    //   "entities": [ { ... }, { ... }, ... ],
    //   "chat": [ { ... }, { ... }, ... ],
    //   "textures": [ { ... }, { ... }, ... ]
    // }

    const session_id = jsonData.session_id;
    const entities = jsonData.entities || [];
    const textures = jsonData.textures || [];
    const chat = jsonData.chat || [];

    // (Optional) Define a mapping for common field names if needed.
    // For example: map 'oldName' to 'newName'. Adjust as needed.
    const fieldMapping = {
      // Example:
      // "oldField1": "commonField1",
      // "oldField2": "commonField2",
    };

    // Insert each entity as a separate document.
    for (const entity of entities) {
      const mappedEntity = mapFields(entity, fieldMapping);
      const newEntity = new Entity({
        session_id,
        data: mappedEntity,
      });
      await newEntity.save();
    }

    // Insert each texture as a separate document.
    for (const texture of textures) {
      const mappedTexture = mapFields(texture, fieldMapping);
      const newTexture = new Texture({
        session_id,
        data: mappedTexture,
      });
      await newTexture.save();
    }

    // Insert each chat message as a separate document.
    for (const chatMessage of chat) {
      const mappedChat = mapFields(chatMessage, fieldMapping);
      const newChat = new Chat({
        session_id,
        data: mappedChat,
      });
      await newChat.save();
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close the Mongoose connection when done.
    mongoose.connection.close();
  }
}

// Run the migration.
migrate().catch(error => {
    console.error('Migration failed:', error);
  });

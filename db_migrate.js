// migrate.js
const mongoose = require('mongoose');
const fs = require('fs').promises;

// 1. Connect to MongoDB (adjust the connection string as needed)
mongoose.connect('mongodb://localhost:27017/storytelling', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connect('mongodb://localhost:27017/storytelling', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'connection error:'));
  db.once('open', () => {
    console.log('Connected to MongoDB.');
  });
  
  // 2. Define the schema and model for narrative_fragments
  const narrativeFragmentSchema = new mongoose.Schema({
    session_id: { type: String, required: true },
    fragment: { type: mongoose.Schema.Types.Mixed, required: true },
    turn: { type: Number },
  });

  

const entitySchema = new mongoose.Schema({
  session_id: { type: String, required: true },
  
  // Basic Info
  name: { type: String, required: true },
  description: { type: String },
  lore: { type: String },
  
  // Classification/Type Info
  type: { type: String },           // from ner_type
  subtype: { type: String },        // from ner_subtype
  
  // Traits & Attributes
  universalTraits: { type: [String] },  // merging "universal_traits" and "universal traits"
  attributes: { type: mongoose.Schema.Types.Mixed },
  connections: { type: mongoose.Schema.Types.Mixed },
  clusterName: { type: String },    // from cluster_name
  category: { type: String },
  
  // Metrics & Costs
  importance: { type: Number },
  xp: { type: Number },
  tileDistance: { type: Number },   // from tile_distance
  familiarityLevel: { type: Number },
  reusabilityLevel: { type: Number },
  relevance: { type: Number },
  impact: { type: Number },
  developmentCost: { type: Number },
  storytellingPointsCost: { type: Number },
  urgency: { type: Number },
  
  // Other/Additional Data
  nextLevelSpecifically: { type: mongoose.Schema.Types.Mixed },
  hooks: { type: mongoose.Schema.Types.Mixed },
  specificity: { type: mongoose.Schema.Types.Mixed },
  externalId: { type: String },     // from id (renamed to avoid conflict)
  turn: { type: mongoose.Schema.Types.Mixed },
  skillsAndRolls: { type: mongoose.Schema.Types.Mixed },
  evolutionState: { type: String },
  evolutionNotes: { type: String }
});

const narrativeTextureSchema = new mongoose.Schema({
    session_id: { type: String, required: true },
    texture: { type: String },
    localPath: { type: String },
    prompt: { type: String },
    font: { type: String },
    card_material: { type: String },
    major_cultural_influences_references: { type: [String] },
    category: { type: String },
    ner_subtype: { type: String },
    ner_type: { type: String },
    universal_traits: { type: [String] },
    archetype: { type: String },
    defined_archetype: { type: String },
    id: { type: String },
    font_size: { type: Number },
    font_color: { type: String },
    text_for_entity: { type: String }
  });
  
const NarrativeTexture = mongoose.model('NarrativeTexture', narrativeTextureSchema);
const NarrativeEntity = mongoose.model('NarrativeEntity', entitySchema);
const NarrativeFragment = mongoose.model('NarrativeFragment', narrativeFragmentSchema);
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

async function migrateFragments(data) {
    try {
      for (const sessionId of Object.keys(data)) {
        const sessionObj = data[sessionId];
        if (sessionObj.hasOwnProperty('fragment')) {
            const fragment = sessionObj.fragment;
            // Check if the fragment is a string and has more than 3 words
            if (typeof fragment === 'string') {
              const wordCount = fragment.split(/\s+/).filter(Boolean).length;
              if (wordCount > 3) {
                const narrativeFragment = new NarrativeFragment({
                  session_id: sessionId,
                  fragment: fragment,
                });
                await narrativeFragment.save();
                console.log(`Saved fragment for session: ${sessionId}`);
              } else {
                console.log(`Fragment in session ${sessionId} has less than 4 words. Skipping...`);
              }
            } else {
              console.log(`Fragment in session ${sessionId} is not a string. Skipping...`);
            }
          } else {
            console.log(`No fragment found for session: ${sessionId}`);
          }
      }
      console.log('Migration complete.');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }


  // Helper function to recursively flatten nested arrays of entities.
function flattenEntities(entities) {
    let result = [];
    for (const item of entities) {
      if (Array.isArray(item)) {
        result = result.concat(flattenEntities(item));
      } else if (typeof item === 'object' && item !== null) {
        result.push(item);
      }
    }
    return result;
  }
  
  // Function to collect all unique field names from all entities in the parsed data.
  function collectEntityFields(parsedData) {
    const fieldSet = new Set();
    let i=0
  
    // Iterate over each session in the parsed data.
    for (const sessionId of Object.keys(parsedData)) {
        i++
      const session = parsedData[sessionId];
      console.log(`${sessionId} ${i}`)
      entities = session.entities
      if (!Array.isArray(entities) && typeof entities === 'object' && Array.isArray(entities.entities)) {
        entities = entities.entities;
      }
        
      if (entities) {
        // Flatten the entities in case some are nested arrays.
        const flattenedEntities = flattenEntities(entities);
        flattenedEntities.forEach(entity => {
          Object.keys(entity).forEach(key => {
            fieldSet.add(key);
          });
        });
      }
    }
    return fieldSet
}

function mapEntity(rawEntity) {
    // Create a new object with the mapped keys.
    // For keys that exist in multiple forms (like universal_traits),
    // you might merge them.
    const normalized = {};
  
    // Basic info:
    normalized.name = rawEntity.name || 'Unnamed';
    normalized.description = rawEntity.description || '';
    normalized.lore = rawEntity.lore || '';
  
    // Classification:
    normalized.type = rawEntity.ner_type || '';
    normalized.subtype = rawEntity.ner_subtype || '';
  
    // Traits & Attributes:
    // Merge both possible keys for universal traits.
    let traits = [];
    if (rawEntity.universal_traits) traits = traits.concat(rawEntity.universal_traits);
    if (rawEntity['universal traits']) traits = traits.concat(rawEntity['universal traits']);
    // Remove duplicates:
    normalized.universalTraits = Array.from(new Set(traits));
    
    normalized.attributes = rawEntity.attributes || {};
    normalized.connections = rawEntity.connections || {};
    normalized.clusterName = rawEntity.cluster_name || '';
    normalized.category = Array.isArray(rawEntity.category) ? rawEntity.category.join(',') : rawEntity.category || '';

  
    // Metrics & Costs:
    normalized.importance = Number(rawEntity.importance) || 0;
    normalized.xp = Number(rawEntity.xp) || 0;
    normalized.tileDistance = Number(rawEntity.tile_distance) || 0;
    normalized.familiarityLevel = Number(rawEntity.familiarity_level) || 0;
    normalized.reusabilityLevel = Number(rawEntity.reusability_level) || 0;
    normalized.relevance = Number(rawEntity.relevance) || 0;
    normalized.impact = Number(rawEntity.impact) || 0;
    normalized.developmentCost = Number(rawEntity.development_cost) || 0;
    normalized.storytellingPointsCost = Number(rawEntity.storytelling_points_cost) || 0;
    normalized.urgency = Number(rawEntity.urgency) || 0;
  
    // Other/Additional:
    normalized.nextLevelSpecifically = rawEntity.next_level_specifically || null;
    normalized.hooks = rawEntity.hooks || null;
    normalized.specificity = rawEntity.specificity || null;
    normalized.externalId = rawEntity.id ? String(rawEntity.id) : '';
    normalized.turn = rawEntity.turn || null;
    normalized.skillsAndRolls = rawEntity.skills_and_rolls || null;
    normalized.evolutionState = rawEntity.evolution_state || '';
    normalized.evolutionNotes = rawEntity.evolution_notes || '';
  
    return normalized;
  }
  
async function migrateEntities(parsedData) {
    const fieldSet = new Set();
    let i=0
  
    // Iterate over each session in the parsed data.
    for (const sessionId of Object.keys(parsedData)) {
        i++
      const session = parsedData[sessionId];
      console.log(`${sessionId} ${i}`)
      entities = session.entities
      if (!Array.isArray(entities) && typeof entities === 'object' && Array.isArray(entities.entities)) {
        entities = entities.entities;
      }
        
      if (entities) {
        // Flatten the entities in case some are nested arrays.
        const flattenedEntities = flattenEntities(entities);
        for (entity of flattenedEntities){
           normalizedEntity = mapEntity(entity)
           const newEntity = new NarrativeEntity({session_id:sessionId, ...normalizedEntity});
            await newEntity.save();
            console.log(`Saved entity for session ${sessionId}`);

        };
      }
    }
    return fieldSet
}
async function migrateTextures(parsedData) {
    let i = 0;
    // Iterate over each session in the parsed data.
    fieldSet = new Set()
    for (const sessionId of Object.keys(parsedData)) {
      i++;
      const session = parsedData[sessionId];
      console.log(`${sessionId} ${i}`);
      
      // Get the textures array.
      let textures = session.textures;
      // If textures is not a simple array but an object with a textures array, then use that.
      if (!Array.isArray(textures) && typeof textures === 'object' && Array.isArray(textures.textures)) {
        textures = textures.textures;
      }
      if (i ==14)
        console.log('adsf')
      if (textures) {
        // Flatten the textures in case some are nested.
        const flattenedTextures = flattenEntities(textures);
        for (let texture of flattenedTextures) {
          // Here you might add a mapping function for textures similar to mapEntity,
          // but for now we simply save the texture as is.
        
            if(texture.hasOwnProperty('textureJson')){
                texture = {texture, ...texture.textureJson}
            }
            if(texture.hasOwnProperty('url')){
                texture.localPath = texture.url.localPath
            }
            if(texture.hasOwnProperty('texture')){
                texture.localPath = texture.texture.url.localPath
                delete texture.texture
            }

            const newTexture = new NarrativeTexture({ session_id: sessionId, ...texture,
                archetype: texture.defined_archetype || texture.archetype });
            await newTexture.save();
          console.log(`Saved texture for session ${sessionId}`);
        }
      }
    }
    console.log("All textures processed.");
    console.log(fieldSet)
   
  }
// 4. Main Migration Function
async function migrate() {
  try {
    // Read the JSON file from disk.
    const filePath = '/Users/shlomo.chotzen/Documents/GitHub/game/storyteller_be/storyteller/db/storytelling.json';
    const fileData = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(fileData);
    sessionData = jsonData['etjui1gubsb']
    console.log('asdf')
    await migrateTextures(jsonData)
    

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

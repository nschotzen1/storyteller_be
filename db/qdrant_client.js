// db/qdrant_client.js
// This file initializes the Qdrant client and provides utility functions for Qdrant.
// Environment Variables:
// - QDRANT_URL: (Optional) URL for the Qdrant instance. Defaults to 'http://localhost:6333'.
// - MOCK_MODE: (Handled in calling functions like in storyteller/utils.js) If 'true', Qdrant operations may be bypassed.

import { QdrantClient } from '@qdrant/js-client-rest';

export const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
export const COLLECTION_NAME = 'storyteller_entities';
export const VECTOR_SIZE = 384; // Matches Supabase/gte-small
export const DISTANCE_METRIC = 'Cosine';

export const qdrantClient = new QdrantClient({ url: QDRANT_URL });

export async function ensureQdrantCollection() {
  try {
    const collectionsResponse = await qdrantClient.getCollections();
    const collectionExists = collectionsResponse.collections.some(
      (collection) => collection.name === COLLECTION_NAME
    );

    if (!collectionExists) {
      console.log(`Collection '${COLLECTION_NAME}' does not exist. Creating...`);
      await qdrantClient.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: DISTANCE_METRIC,
        },
      });
      console.log(`Collection '${COLLECTION_NAME}' created successfully.`);
    } else {
      console.log(`Collection '${COLLECTION_NAME}' already exists.`);
    }
  } catch (error) {
    console.error(`Error ensuring Qdrant collection '${COLLECTION_NAME}':`, error);
    // Depending on the application's needs, you might want to re-throw the error
    // or handle it in a way that allows the app to continue in a degraded state.
    throw error;
  }
}

// Example of how this might be called at application startup
// (This call itself would be in server.js or similar, not here)
// ensureQdrantCollection().catch(err => {
//   console.error("Failed to initialize Qdrant collection on startup:", err);
//   process.exit(1); // Or handle appropriately
// });

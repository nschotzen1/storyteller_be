import mongoose from 'mongoose';
import { TypewriterKey } from '../models/models.js';
import { ensureMongoConnection } from '../services/mongoConnectionService.js';
import {
  getPublicNarrativeEntitySessionId,
  listPublicNarrativeEntitySeeds,
  upsertPublicNarrativeEntitySeeds
} from '../services/publicNarrativeEntitySeedService.js';
import { NarrativeEntity, upsertNarrativeEntity } from '../storyteller/utils.js';

async function main() {
  await ensureMongoConnection({ allowFailure: false });

  const privacyBackfill = await NarrativeEntity.updateMany(
    { privacy: { $exists: false } },
    { $set: { privacy: 'session' } }
  );
  const savedEntities = await upsertPublicNarrativeEntitySeeds(upsertNarrativeEntity);
  const savedByExternalId = new Map(
    savedEntities.map((entity) => [entity.externalId, entity])
  );

  const keyUpdates = [];
  for (const seed of listPublicNarrativeEntitySeeds()) {
    if (!seed.typewriterKeyText) continue;
    const entity = savedByExternalId.get(seed.externalId);
    if (!entity) continue;

    const keyUpdate = await TypewriterKey.updateMany(
      {
        keyText: seed.typewriterKeyText,
        sourceType: seed.typewriterSource || 'builtin'
      },
      {
        $set: {
          entityId: entity._id,
          entityName: seed.name || '',
          insertText: seed.name || seed.typewriterKeyText,
          description: seed.description || '',
          activeInTypewriter: seed.activeInTypewriter !== false
        }
      }
    );
    keyUpdates.push({
      externalId: seed.externalId,
      keyText: seed.typewriterKeyText,
      modifiedCount: keyUpdate.modifiedCount
    });
  }

  console.log(JSON.stringify({
    publicSessionId: getPublicNarrativeEntitySessionId(),
    privacyBackfilled: privacyBackfill.modifiedCount,
    upsertedEntities: savedEntities.map((entity) => ({
      id: String(entity._id),
      externalId: entity.externalId,
      name: entity.name,
      privacy: entity.privacy,
      storytelling_points: entity.storytelling_points
    })),
    keyUpdates
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

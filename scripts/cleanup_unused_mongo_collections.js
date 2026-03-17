import mongoose from 'mongoose';
import { getMongoUri } from '../services/mongoConnectionService.js';

const LEGACY_COLLECTIONS = [
  {
    name: 'generatedcontents',
    reason: 'Legacy prefix logging from server.js; not used by the primary server_new.js runtime.'
  },
  {
    name: 'narrativetextures',
    reason: 'Old texture persistence path used by legacy storyteller helpers, not by current runtime routes.'
  },
  {
    name: 'scenetemplates',
    reason: 'Schema exists without any non-test runtime usage.'
  },
  {
    name: 'sessionscenestates',
    reason: 'Legacy scene-position state used by dormant storyteller flow helpers.'
  },
  {
    name: 'sessionstates',
    reason: 'Legacy storyteller/session state store not referenced by server_new.js routes.'
  },
  {
    name: 'sessionvectors',
    reason: 'Model is defined but only appears in commented legacy code.'
  },
  {
    name: 'storyentities',
    reason: 'Story deck prototype storage used by legacy server.js endpoints, not by server_new.js.'
  },
  {
    name: 'storyspreads',
    reason: 'Story deck prototype storage used by legacy server.js endpoints, not by server_new.js.'
  }
];

function parseArgs(argv) {
  return {
    drop: argv.includes('--drop'),
    json: argv.includes('--json')
  };
}

async function inspectLegacyCollections(db, { drop = false } = {}) {
  const existingCollections = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existingCollections.map((entry) => entry.name));
  const results = [];

  for (const candidate of LEGACY_COLLECTIONS) {
    const exists = existingNames.has(candidate.name);
    const count = exists ? await db.collection(candidate.name).countDocuments({}) : 0;

    let dropped = false;
    if (drop && exists) {
      await db.dropCollection(candidate.name);
      dropped = true;
    }

    results.push({
      ...candidate,
      exists,
      count,
      dropped
    });
  }

  return results;
}

function formatSummary({ mongoUri, drop, results }) {
  const existing = results.filter((entry) => entry.exists);
  const dropped = results.filter((entry) => entry.dropped);
  const totalDocs = existing.reduce((sum, entry) => sum + entry.count, 0);

  return {
    mongoUri,
    mode: drop ? 'drop' : 'dry-run',
    candidateCount: results.length,
    existingCandidateCount: existing.length,
    totalDocumentsAcrossCandidates: totalDocs,
    droppedCollections: dropped.map((entry) => entry.name),
    results
  };
}

function printHumanSummary(summary) {
  console.log(`Mongo URI: ${summary.mongoUri}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`Existing legacy candidates: ${summary.existingCandidateCount}/${summary.candidateCount}`);
  console.log(`Documents across candidates: ${summary.totalDocumentsAcrossCandidates}`);

  for (const entry of summary.results) {
    const status = entry.dropped
      ? 'dropped'
      : entry.exists
        ? 'present'
        : 'missing';
    console.log(`- ${entry.name}: ${status}, count=${entry.count} :: ${entry.reason}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mongoUri = getMongoUri();

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });

  try {
    const results = await inspectLegacyCollections(mongoose.connection.db, options);
    const summary = formatSummary({ mongoUri, drop: options.drop, results });

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    printHumanSummary(summary);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('cleanup_unused_mongo_collections failed:', error);
  process.exit(1);
});

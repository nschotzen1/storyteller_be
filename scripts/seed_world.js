import mongoose from 'mongoose';
import { runScenario } from '../services/scenarioRunnerService.js';

/**
 * Seed World (v100)
 * 
 * Usage: NODE_ENV=test node scripts/seed_world.js "My fragment text"
 */
async function main() {
    process.env.NODE_ENV = 'test';
    const mongoUri = 'mongodb://localhost:27017/storytelling_test';
    const fragment = process.argv[2] || "A silent forest where the trees whisper secrets of the first age.";

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
    }

    console.log(`--- SEEDING WORLD ---`);
    console.log(`Fragment: "${fragment}"`);

    try {
        const result = await runScenario({
            fragment,
            players: { count: 1 },
            steps: [] // No steps, just seed initial state
        });

        console.log(`\n[SUCCESS] World seeded. SessionID: ${result.sessionId}`);
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();

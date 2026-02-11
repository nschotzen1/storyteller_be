import mongoose from 'mongoose';
import { runScenario } from '../services/scenarioRunnerService.js';
import { Arena } from '../models/models.js';

/**
 * Master Runner (v100)
 * 
 * Usage: NODE_ENV=test node scripts/master_runner.js [scenario_type]
 */
async function main() {
    process.env.NODE_ENV = 'test';
    const mongoUri = 'mongodb://localhost:27017/storytelling_test';
    const type = process.argv[2] || 'desert_watch';

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(mongoUri);
    }

    console.log(`--- STORYTELLER MASTER RUNNER: ${type.toUpperCase()} ---`);

    const scenarioConfigs = {
        desert_watch: {
            fragment: `the night sky was clear, endless stars in the vast heavens. there was no moon, not even Silveranu, the moon of the nomads.`,
            players: { count: 1 },
            steps: [
                {
                    id: 'deepen_hound',
                    action: 'ENTITY_DEEPENING',
                    target_entity_id: 'the-obsidian-hound'
                },
                {
                    id: 'connect_path_hound',
                    action: 'PLACE_AND_CONNECT',
                    source_card_id: 'the-hidden-river-path',
                    target_card_ids: ['the-obsidian-hound'],
                    relationship: {
                        surfaceText: 'is guarded by',
                        direction: 'source_to_target'
                    }
                }
            ]
        },
        threshold: {
            fragment: `You stand before the Iron-Bound Door. The Threshold is silent.`,
            players: { count: 1 },
            steps: [
                {
                    id: 'open_door',
                    action: 'PLAYER_CHOICE',
                    choice_index: 0
                }
            ]
        },
        inn_cycle: {
            fragment: `The Spire cast its long, sovereign shadow over the Inn. A child was humming a forgotten tune near the broken well.`,
            players: { count: 1 },
            steps: [
                {
                    id: 'deepen_door',
                    action: 'ENTITY_DEEPENING',
                    target_entity_id: 'the-iron-bound-door'
                }
            ]
        },
        branching_fate: {
            fragment: `A faded memory of stars falling into the sea. You hold a silver key that hums with static.`,
            players: { count: 1 },
            steps: [
                {
                    id: 'first_choice',
                    action: 'PLAYER_CHOICE',
                    choice_index: 1
                }
            ]
        }
    };

    const config = scenarioConfigs[type];
    if (!config) {
        console.error(`Unknown scenario type: ${type}`);
        process.exit(1);
    }

    try {
        const result = await runScenario(config);
        console.log(`\n[SUCCESS] Session ${result.sessionId} complete.`);

        // Final Reporting
        const arenaDoc = await Arena.findOne({ sessionId: result.sessionId });
        console.log('\n--- FINAL ARENA STATE ---');
        arenaDoc.arena.entities.forEach(ent => {
            console.log(`- [${ent.slug}] ${ent.name}: ${ent.description?.slice(0, 60)}...`);
        });

        if (result.evolutionBridge) {
            console.log('\n--- EVOLUTIONARY BRIDGE (Next Generation) ---');
            console.log(`NEW SEED: ${result.evolutionBridge.nextIterationSeed}`);
            console.log(`GUIDANCE: ${result.evolutionBridge.instructionalGuidance}`);

            if (result.evolutionBridge.physics) {
                const p = result.evolutionBridge.physics;
                console.log(`\n--- NARRATIVE PHYSICS (v120) ---`);
                console.log(`MASS:    ${p.totalMass} (Entity Weights)`);
                console.log(`ENERGY:  ${p.bindingEnergy.toFixed(2)} (Binding Strength)`);
                console.log(`DENSITY: ${p.density.toFixed(3)} (Energy/Mass)`);
            }

            console.log(`BRAIN V: ${result.evolutionBridge.brainVersion}`);
        }

    } catch (err) {
        console.error('Master runner failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

main();

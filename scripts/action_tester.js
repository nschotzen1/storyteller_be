import mongoose from 'mongoose';
import { runScenario } from '../services/scenarioRunnerService.js';
import * as neo4jService from '../services/neo4jService.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/storyteller_db';

// --- CLI ARGUMENT PARSING ---
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        action: null,
        mock: true,
        session: null,
        target: 'auto',
        source: 'auto',
        interactive: false
    };

    if (args.length === 0) {
        config.interactive = true;
        return config;
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--action' && args[i + 1]) config.action = args[++i];
        else if (arg === '--real') config.mock = false;
        else if (arg === '--session' && args[i + 1]) config.session = args[++i];
        else if (arg === '--target' && args[i + 1]) config.target = args[++i];
        else if (arg === '--source' && args[i + 1]) config.source = args[++i];
        else if (arg === '--interactive') config.interactive = true;
    }
    return config;
}

// --- INTERACTIVE PROMPTS ---
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getInteractiveConfig() {
    console.log('\n--- Action Tester: Interactive Mode ---');
    console.log('1. ENTITY_DEEPENING');
    console.log('2. PLACE_AND_CONNECT');
    console.log('3. ACQUIRE_STORYTELLER');
    console.log('4. SEND_STORYTELLER');

    const choice = await question('\nSelect Action (1-4): ');
    const actions = {
        '1': 'ENTITY_DEEPENING',
        '2': 'PLACE_AND_CONNECT',
        '3': 'ACQUIRE_STORYTELLER',
        '4': 'SEND_STORYTELLER'
    };

    const action = actions[choice] || 'ENTITY_DEEPENING';
    const mode = await question('Mode (mock/real) [default: mock]: ');
    const target = await question('Target Entity/ID [default: auto]: ');

    let source = 'auto';
    if (action === 'PLACE_AND_CONNECT') {
        source = await question('Source Entity/ID [default: auto]: ');
    }

    return {
        action,
        mock: mode.toLowerCase() !== 'real',
        target: target || 'auto',
        source: source || 'auto',
        session: `test_session_${Date.now()}`
    };
}

// --- TEST RUNNER ---
async function runTestAction(config) {
    console.log(`\n[ActionTester] Running ${config.action} (Mock: ${config.mock})`);

    const scenarioConfig = {
        sessionId: config.session || `test_${Date.now()}`,
        mock: config.mock,
        seed: Date.now(),
        universe: { generate_storytellers: true },
        steps: []
    };

    if (config.action === 'ENTITY_DEEPENING') {
        scenarioConfig.steps.push({
            id: 'test_deepen',
            action: 'ENTITY_DEEPENING',
            target_entity_id: config.target
        });
    } else if (config.action === 'PLACE_AND_CONNECT') {
        scenarioConfig.steps.push({
            id: 'test_connect',
            action: 'PLACE_AND_CONNECT',
            source_card_id: config.source,
            target_card_ids: [config.target]
        });
    } else if (config.action === 'ACQUIRE_STORYTELLER') {
        scenarioConfig.steps.push({
            id: 'test_acquire',
            action: 'ACQUIRE_STORYTELLER',
            target_storyteller_id: config.target
        });
    } else if (config.action === 'SEND_STORYTELLER') {
        scenarioConfig.steps.push({
            id: 'test_mission',
            action: 'SEND_STORYTELLER',
            target_storyteller_id: config.target
        });
    }

    try {
        const result = await runScenario(scenarioConfig);
        console.log('\n--- TEST RESULT ---');
        console.log(`Success: true`);
        console.log(`Session: ${result.sessionId}`);

        // Log event outputs
        if (result.eventLog && result.eventLog.length > 0) {
            result.eventLog.forEach(log => {
                console.log(`\nStep: ${log.stepId} (${log.action})`);
                console.log(`Output: ${log.outputsSummary}`);
            });
        }

        // Check if anything sprouted
        const graph = await neo4jService.exportGraphSnapshot(result.sessionId);
        console.log(`\nEntities in Graph: ${graph.nodes?.length || 0}`);

    } catch (err) {
        console.error('\n[ActionTester] Execution Failed:', err.message);
    }
}

async function main() {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI);
    }

    let config = parseArgs();
    if (config.interactive) {
        config = await getInteractiveConfig();
    } else if (!config.action) {
        console.log('Usage: node scripts/action_tester.js --action [deepen|connect|acquire|mission] [--real] [--target ID]');
        process.exit(1);
    }

    // Map short names
    const actionMap = {
        'deepen': 'ENTITY_DEEPENING',
        'connect': 'PLACE_AND_CONNECT',
        'acquire': 'ACQUIRE_STORYTELLER',
        'mission': 'SEND_STORYTELLER'
    };
    if (actionMap[config.action]) config.action = actionMap[config.action];

    await runTestAction(config);

    await mongoose.connection.close();
    await neo4jService.closeNeo4j();
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5001/api/brewing';

async function runVerification() {
    try {
        console.log('--- Starting Verification ---');

        // 1. Create Room
        console.log('1. Creating Room...');
        const createRes = await fetch(`${BASE_URL}/rooms`, { method: 'POST' });
        const { roomId } = await createRes.json();
        console.log(`   Room Created: ${roomId}`);

        if (!roomId) throw new Error('No roomId returned');

        // 2. Join Player 1
        console.log('2. Joining Player 1...');
        const join1Res = await fetch(`${BASE_URL}/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maskId: 'fox', displayName: 'The Fox' })
        });
        const p1Data = await join1Res.json();
        const p1Id = p1Data.playerId;
        console.log(`   Player 1 Joined: ${p1Id}`);

        // 3. Join Player 2
        console.log('3. Joining Player 2...');
        const join2Res = await fetch(`${BASE_URL}/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ maskId: 'stag', displayName: 'The Stag' })
        });
        const p2Data = await join2Res.json();
        const p2Id = p2Data.playerId;
        console.log(`   Player 2 Joined: ${p2Id}`);

        // 4. Ready Up
        console.log('4. Players Readying...');
        await fetch(`${BASE_URL}/rooms/${roomId}/players/${p1Id}/ready`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ready: true })
        });
        await fetch(`${BASE_URL}/rooms/${roomId}/players/${p2Id}/ready`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ready: true })
        });
        console.log('   Players Ready.');

        // 5. Start Game
        console.log('5. Starting Game...');
        const startRes = await fetch(`${BASE_URL}/rooms/${roomId}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const startState = await startRes.json();
        if (startState.phase !== 'brewing') throw new Error('Game did not start');
        console.log('   Game Started. Active Player:', startState.turn.activePlayerId);

        const activePlayer = startState.turn.activePlayerId;
        if (activePlayer !== p1Id) console.warn('   Note: Active player is not P1 (expected first joiner usually, but logic might vary)');

        // 6. Submit Ingredient
        console.log(`6. Submitting Ingredient by ${activePlayer}...`);
        const submitRes = await fetch(`${BASE_URL}/rooms/${roomId}/turn/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-player-id': activePlayer
            },
            body: JSON.stringify({ ingredient: 'Moonlight' })
        });
        const submitJson = await submitRes.json();
        console.log('   Submission Result:', submitJson);

        // 7. Wait for Brewmaster
        console.log('7. Waiting for Brewmaster (4s)...');
        await new Promise(r => setTimeout(r, 4000));

        // 8. Check State
        console.log('8. Checking State...');
        const finalRes = await fetch(`${BASE_URL}/rooms/${roomId}`);
        const finalState = await finalRes.json();

        const vials = finalState.brew.vials;
        console.log(`   Vials count: ${vials.length}`);
        if (vials.length > 0) {
            console.log('   Latest Vial:', vials[vials.length - 1].title);
            console.log('   Summary:', finalState.brew.summaryLines);
        } else {
            throw new Error('No vials generated after timeout!');
        }

        console.log('--- Verification Success ---');

    } catch (err) {
        console.error('--- Verification Failed ---');
        console.error(err);
        process.exit(1);
    }
}

runVerification();

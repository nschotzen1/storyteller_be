
import { textToEntityFromText } from '../services/textToEntityService.js';

async function verifyMockMode() {
    console.log('Verifying Text To Entity - Mock Mode...');
    const result = await textToEntityFromText({
        sessionId: 'test-session',
        text: 'A test fragment',
        includeCards: true,
        includeFront: true,
        includeBack: true,
        debug: true
    });

    if (!result.entities || result.entities.length === 0) {
        console.error('FAILED: No entities returned in mock mode.');
        process.exit(1);
    }

    if (!result.cards || result.cards.length === 0) {
        console.error('FAILED: No cards returned in mock mode.');
        process.exit(1);
    }

    const firstCard = result.cards[0];
    if (!firstCard.front || !firstCard.front.imageUrl) {
        console.error('FAILED: Card front missing imageUrl in mock mode.');
        console.log('Card front:', firstCard.front);
        process.exit(1);
    }

    if (!firstCard.back || !firstCard.back.imageUrl) {
        console.error('FAILED: Card back missing imageUrl in mock mode.');
        console.log('Card back:', firstCard.back);
        process.exit(1);
    }

    if (firstCard.front.imageUrl !== '/assets/1a0acb7f-ac32-40f5-8a69-5daf303fcc6b-0-1729994892.png') {
        console.error(`FAILED: Unexpected front mock URL. Got: ${firstCard.front.imageUrl}`);
        process.exit(1);
    }

    if (firstCard.back.imageUrl !== '/assets/18bbfc07-17fd-4a14-80a9-eb23af9eac2f-0-2612330651.png') {
        console.error(`FAILED: Unexpected back mock URL. Got: ${firstCard.back.imageUrl}`);
        process.exit(1);
    }

    console.log('SUCCESS: Mock mode verified correctly.');
}

verifyMockMode().catch(err => {
    console.error('An error occurred:', err);
    process.exit(1);
});

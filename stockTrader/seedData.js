// stockTrader/seedData.js
import fs from 'fs/promises';
import path from 'path';
import { fetchIntradayData } from './dataFetcher.js'; // Assumes this can still make live calls
import {
  TARGET_STOCKS_FOR_LOCAL_DATA,
  TARGET_MONTH_FOR_LOCAL_DATA,
  ALPHA_VANTAGE_API_KEY
} from './config.js';

const SCRIPT_NAME = '[SeedDataScript]';
const API_CALL_DELAY_MS = 15000; // 15 seconds delay for Alpha Vantage free tier (5 calls/min allows 12s, 15s is safer)

// Helper to ensure __dirname is available in ES modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---

const LOCAL_DATA_DIR = path.join(__dirname, 'localData');

async function seedData() {
  console.log(`${SCRIPT_NAME} Starting data seeding process...`);

  if (!ALPHA_VANTAGE_API_KEY || ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error(`${SCRIPT_NAME} Error: ALPHA_VANTAGE_API_KEY is not set in stockTrader/config.js. Cannot fetch data.`);
    return;
  }

  try {
    await fs.mkdir(LOCAL_DATA_DIR, { recursive: true }); // Ensure localData directory exists
    console.log(`${SCRIPT_NAME} Target stocks: ${TARGET_STOCKS_FOR_LOCAL_DATA.join(', ')}`);
    console.log(`${SCRIPT_NAME} Target month: ${TARGET_MONTH_FOR_LOCAL_DATA}`);
    console.log(`${SCRIPT_NAME} Interval for seeding: 1min`);

    for (let i = 0; i < TARGET_STOCKS_FOR_LOCAL_DATA.length; i++) {
      const symbol = TARGET_STOCKS_FOR_LOCAL_DATA[i];
      const interval = '1min'; // Hardcoded for seeding as per plan
      const month = TARGET_MONTH_FOR_LOCAL_DATA;

      console.log(`${SCRIPT_NAME} Fetching data for ${symbol}, month ${month}, interval ${interval}...`);

      // IMPORTANT: This fetchIntradayData call assumes it will perform a LIVE API call.
      // If fetchIntradayData is modified in a subsequent step to prioritize local files,
      // this seeder might need adjustment or fetchIntradayData needs a 'forceLive' flag.
      // For now, we assume it makes a live call as it was originally designed.
      const data = await fetchIntradayData(symbol, month, interval);

      if (data && Object.keys(data).length > 0) {
        const fileName = `${symbol}_${month}_${interval}.json`;
        const filePath = path.join(LOCAL_DATA_DIR, fileName);
        try {
          await fs.writeFile(filePath, JSON.stringify(data, null, 2));
          console.log(`${SCRIPT_NAME} Successfully saved data for ${symbol} to ${filePath}`);
        } catch (writeError) {
          console.error(`${SCRIPT_NAME} Error writing file ${filePath} for ${symbol}:`, writeError);
        }
      } else {
        console.warn(`${SCRIPT_NAME} No data received or data was empty for ${symbol}, month ${month}. Skipping save.`);
      }

      if (i < TARGET_STOCKS_FOR_LOCAL_DATA.length - 1) { // No delay after the last call
        console.log(`${SCRIPT_NAME} Waiting ${API_CALL_DELAY_MS / 1000} seconds before next API call...`);
        await new Promise(resolve => setTimeout(resolve, API_CALL_DELAY_MS));
      }
    }
    console.log(`${SCRIPT_NAME} Data seeding process completed.`);

  } catch (error) {
    console.error(`${SCRIPT_NAME} An unexpected error occurred during the seeding process:`, error);
  }
}

// Make the script runnable from command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedData();
}

// Export for potential programmatic use if ever needed, though primarily a script
export { seedData };

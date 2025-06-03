// stockTrader/scanner.js
import { analyzeRecentClimbPattern } from './scannerCore.js'; // Import from new core file
import {
  ALPHA_VANTAGE_API_KEY,
  DEFAULT_STOCK_UNIVERSE,
  NEW_STOCK_CLIMB_PERCENTAGE_MAX
} from './config.js';

// analyzeRecentClimbPattern function has been moved to scannerCore.js

/**
 * Scans a list of stocks to find a candidate based on recent climb patterns
 * using pre-fetched monthly data.
 *
 * @param {string[]} stockList - Array of stock symbols to scan.
 * @param {object} allStocksMonthData - Object where keys are symbols and values are their pre-fetched intraday data for the target month.
 *                                      e.g., { "AAPL": aaplDataForMonth, "MSFT": msftDataForMonth }
 * @returns {string|null} The symbol of the first matching stock, or null if none found.
 */
export function findNewStockCandidate( // No longer async
  stockList = DEFAULT_STOCK_UNIVERSE,
  allStocksMonthData = {} // Expects { SYMBOL: monthData, ... }
) {
  // API key check can remain as a general safeguard, though this function itself won't call API directly.
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    // This warning is less critical here now, but doesn't hurt.
    // console.error('[Scanner] Warning: Alpha Vantage API key is not set. This might affect data sources if not purely local.');
  }

  console.log(`[Scanner] Starting scan for new stock candidate from list: [${stockList.join(', ')}] using pre-fetched monthly data.`);
  let reasonsForNoCandidates = [];

  for (const symbol of stockList) {
    const symbolMonthData = allStocksMonthData[symbol];

    if (!symbolMonthData || Object.keys(symbolMonthData).length === 0) {
      const reason = `[${symbol}] Scanner: Data for symbol not found or empty in provided allStocksMonthData. Skipping.`;
      console.warn(reason);
      reasonsForNoCandidates.push(reason);
      continue;
    }

    // console.log(`[Scanner] Evaluating symbol: ${symbol} using its provided monthly data.`);
    const analysisResult = analyzeRecentClimbPattern(symbol, symbolMonthData); // Not async

    if (analysisResult.error) {
      const reason = `[${symbol}] Scanner analysis error: ${analysisResult.error}`;
      console.warn(reason);
      reasonsForNoCandidates.push(reason);
      continue;
    }

    const { gain_current_15min, gain_previous_15min, is_currently_climbing, latest_price } = analysisResult;
    // console.log(`[Scanner] Analysis for ${symbol}: Current15mGain=${gain_current_15min.toFixed(2)}, Prev15mGain=${gain_previous_15min.toFixed(2)}, Climbing=${is_currently_climbing}, LatestPrice=${latest_price}`);

    if (!is_currently_climbing) {
      const reason = `[${symbol}] Scanner: Not a candidate: Not climbing in current 15min (gain: ${gain_current_15min.toFixed(2)}). Latest price from month end: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`;
      console.log(reason);
      reasonsForNoCandidates.push(reason);
      continue;
    }

    if (gain_previous_15min <= 0) {
      const reason = `[${symbol}] Scanner: Not a candidate: Previous 15min period was not a climb (gain: ${gain_previous_15min.toFixed(2)}). Current 15m gain: ${gain_current_15min.toFixed(2)}. Latest price from month end: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`;
      console.log(reason);
      reasonsForNoCandidates.push(reason);
      continue;
    }

    if (gain_current_15min > (gain_previous_15min * NEW_STOCK_CLIMB_PERCENTAGE_MAX)) {
      const reason = `[${symbol}] Scanner: Not a candidate: Current 15min climb gain (${gain_current_15min.toFixed(2)}) is > ${NEW_STOCK_CLIMB_PERCENTAGE_MAX * 100}% of previous 15min climb gain (${gain_previous_15min.toFixed(2)}). Latest price from month end: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`;
      console.log(reason);
      reasonsForNoCandidates.push(reason);
      continue;
    }

    console.log(`[Scanner] SUCCESS: ${symbol} IS A CANDIDATE! Current 15m gain (end of month): ${gain_current_15min.toFixed(2)}, Previous 15m gain: ${gain_previous_15min.toFixed(2)}. Latest price from month end: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`);
    return symbol;
  }

  console.log("[Scanner] No suitable candidate found after checking all stocks with provided monthly data.");
  if (reasonsForNoCandidates.length > 0 && reasonsForNoCandidates.length === stockList.length) {
      console.log("[Scanner] Summary of reasons for no candidates:"); // Updated log
      reasonsForNoCandidates.forEach(reason => console.log(reason));
  } else if (stockList.length === 0) {
      console.log("[Scanner] Stock list for scanning was empty.");
  }
  return null;
}

// --- Example Usage (comment out or remove for integration) ---
// Example usage would now need to involve pre-fetching data for allStocksMonthData
// or using this function within a context where that data is already available (like the backtester).
/*
async function exampleScannerUsage() {
  // This is a conceptual example. In a real scenario, allStocksMonthData would be populated
  // by fetching data for TARGET_MONTH_FOR_LOCAL_DATA for each stock in DEFAULT_STOCK_UNIVERSE.
  // For example, using a loop and the refactored fetchIntradayData that can load from local.

  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE' && ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) {
     // If live calls are needed for some reason by other parts, or if seeding is the only way to get data
    console.warn("Warning: Running scanner example might be limited if data isn't seeded and live calls are off for general fetching.");
  }

  // For a direct test, you'd first need to ensure data exists, e.g. by running seedData.js
  // Then, load it here for the example:
  // const exampleStockList = ['AAPL', 'MSFT'];
  // const allStocksDataForExample = {};
  // for (const symbol of exampleStockList) {
  //    // This would use fetchIntradayData, which now prioritizes local.
  //    // This assumes TARGET_MONTH_FOR_LOCAL_DATA is what you want to scan.
  //    allStocksDataForExample[symbol] = await fetchIntradayData(symbol, TARGET_MONTH_FOR_LOCAL_DATA, '1min');
  // }
  // console.log("Running scanner example with potentially fetched/loaded data...");
  // const candidate = findNewStockCandidate(exampleStockList, allStocksDataForExample);


  // More direct mock for testing the function structure:
  const mockStockData = {
      "AAPL": { /* ... a full month of AAPL data ... */ },
      "MSFT": { /* ... a full month of MSFT data ... */ }
  };
  // Fill mockStockData with actual structure if you want to run this example block.
  // For now, it's more of a placeholder.

  console.log("Running scanner example with placeholder data structure...");
  // To make this runnable, you'd need to populate mockStockData or load from files.
  // const candidate = findNewStockCandidate(DEFAULT_STOCK_UNIVERSE, mockStockData);


  // Example: Assuming you have run seedData.js and have local files for TARGET_STOCKS_FOR_LOCAL_DATA
  // This is more complex for a simple example here because we need to actually load that data first.
  // The backtester is a better place to see this function in action.

  console.log("Scanner example: findNewStockCandidate is designed to be used with pre-fetched data.");
  console.log("Its direct invocation for example purposes would require manual data loading here,");
  console.log("or running it in an environment like the backtester where data is pre-loaded.");

  // if (candidate) {
  //   console.log(`Scanner Example Result: Found candidate - ${candidate}`);
  // } else {
  //   console.log("Scanner Example Result: No candidate found with the provided data.");
  // }
}

// exampleScannerUsage();
*/

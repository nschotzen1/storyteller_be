// stockTrader/scanner.js
import { fetchIntradayData } from './dataFetcher.js';
import { ALPHA_VANTAGE_API_KEY, DEFAULT_STOCK_UNIVERSE, NEW_STOCK_CLIMB_PERCENTAGE_MAX } from './config.js';

/**
 * Helper to get the 'YYYY-MM' string for the previous month.
 */
function getPreviousMonthYYYYMM() {
  const date = new Date();
  date.setDate(1); // Go to the first day of the current month
  date.setMonth(date.getMonth() - 1); // Go to the previous month
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Analyzes historical data for a stock to find current and past climb gains.
 * This is a simplified analysis. A robust implementation would need more sophisticated pattern detection.
 *
 * @param {object} intradayData - Object where keys are timestamps and values are OHLCV data.
 *                                Example: { '2023-05-26 15:59:00': { '1. open': '130.00', '4. close': '130.05' ... }, ... }
 * @returns {object|null} - Object with { currentClimbGain, pastClimbGain } or null if pattern not found.
 */
function analyzeClimbingPattern(intradayData) {
  if (!intradayData || Object.keys(intradayData).length < 20) { // Need some minimal data
    // console.log("Not enough data points to analyze climbing pattern.");
    return null;
  }

  const sortedTimestamps = Object.keys(intradayData).sort();
  const prices = sortedTimestamps.map(ts => parseFloat(intradayData[ts]['4. close']));

  if (prices.some(isNaN)) {
    // console.log("NaN found in prices, cannot analyze.");
    return null;
  }

  let climbs = []; // Stores { startPrice, peakPrice, gain } for each climb
  let currentClimb = null;

  for (let i = 1; i < prices.length; i++) {
    const currentPrice = prices[i];
    const prevPrice = prices[i-1];

    if (currentPrice >= prevPrice) { // Price is climbing or flat
      if (!currentClimb) {
        currentClimb = { startPrice: prevPrice, peakPrice: currentPrice };
      } else {
        currentClimb.peakPrice = Math.max(currentClimb.peakPrice, currentPrice);
      }
    } else { // Price dropped, current climb (if any) ended
      if (currentClimb) {
        currentClimb.gain = currentClimb.peakPrice - currentClimb.startPrice;
        if (currentClimb.gain > 0) { // Only consider climbs with actual gain
          climbs.push(currentClimb);
        }
        currentClimb = null;
      }
    }
  }
  // If still in a climb at the end of the data
  if (currentClimb) {
    currentClimb.gain = currentClimb.peakPrice - currentClimb.startPrice;
    if (currentClimb.gain > 0) {
      climbs.push(currentClimb);
    }
  }

  if (climbs.length < 2) {
    // console.log(`Not enough distinct climbs found. Found ${climbs.length}.`);
    return null; // Need at least a current and a past climb
  }

  // Check if the most recent data segment is a climb
  const lastPrice = prices[prices.length - 1];
  const secondLastPrice = prices[prices.length - 2];
  const isCurrentlyClimbing = lastPrice >= secondLastPrice;

  if (!isCurrentlyClimbing) {
    // console.log("Stock is not currently climbing based on the very last tick.");
    // This could be a stricter check, but for now, we rely on the last identified climb segment.
  }

  const currentClimbDetails = climbs[climbs.length - 1];
  const pastClimbDetails = climbs[climbs.length - 2];

  // console.log("Identified current climb:", currentClimbDetails);
  // console.log("Identified past climb:", pastClimbDetails);

  return {
    currentClimbGain: currentClimbDetails.gain,
    pastClimbGain: pastClimbDetails.gain,
  };
}


/**
 * Scans a list of stocks to find a candidate that is climbing up,
 * with the current climb being NEW_STOCK_CLIMB_PERCENTAGE_MAX or less than its previous period of climbing up.
 *
 * @param {string[]} stockList - Array of stock symbols to scan.
 * @param {string} [interval='1min'] - The interval for intraday data.
 * @returns {Promise<string|null>} The symbol of the first matching stock, or null if none found.
 */
export async function findNewStockCandidate(stockList = DEFAULT_STOCK_UNIVERSE, interval = '1min') {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('Error: Alpha Vantage API key is not set in stockTrader/config.js for scanner.');
    return null;
  }

  const monthToFetch = getPreviousMonthYYYYMM();
  console.log(`Scanner: Will attempt to fetch data for month ${monthToFetch} for analysis of ${stockList.length} stocks.`);

  for (const symbol of stockList) {
    console.log(`Scanning ${symbol}...`);
    const intradayData = await fetchIntradayData(symbol, monthToFetch, interval);

    if (intradayData) {
      const analysis = analyzeClimbingPattern(intradayData);
      if (analysis && analysis.pastClimbGain > 0 && analysis.currentClimbGain > 0) {
        console.log(`Analyzed ${symbol}: Current Gain=${analysis.currentClimbGain.toFixed(2)}, Past Gain=${analysis.pastClimbGain.toFixed(2)}`);
        if (analysis.currentClimbGain <= (analysis.pastClimbGain * NEW_STOCK_CLIMB_PERCENTAGE_MAX)) {
          console.log(`SUCCESS: ${symbol} is a candidate! Current climb gain (${analysis.currentClimbGain.toFixed(2)}) is <= ${NEW_STOCK_CLIMB_PERCENTAGE_MAX*100}% of past climb gain (${analysis.pastClimbGain.toFixed(2)}).`);
          return symbol;
        }
      }
    } else {
      console.warn(`Scanner: No data fetched for ${symbol} for month ${monthToFetch}.`);
    }
    // Alpha Vantage free tier allows 5 calls per minute. Add delay to be safe.
    // 2 calls per stock (potentially, if we refine data fetching) would be 2 * N calls.
    // For now, 1 call per stock as we fetch one month.
    await new Promise(resolve => setTimeout(resolve, 13000)); // Approx 4-5 calls per minute
  }

  console.log("Scanner: No suitable stock candidate found from the list.");
  return null;
}

// --- Example Usage (comment out or remove for integration) ---
/*
(async () => {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log("Please set your Alpha Vantage API key in stockTrader/config.js to run the scanner example.");
    return;
  }
  console.log("Running scanner example...");
  const candidate = await findNewStockCandidate(['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA']);
  // const candidate = await findNewStockCandidate(); // Uses DEFAULT_STOCK_UNIVERSE

  if (candidate) {
    console.log(`
Scanner Example Result: Found candidate - ${candidate}`);
  } else {
    console.log("
Scanner Example Result: No candidate found.");
  }
})();
*/

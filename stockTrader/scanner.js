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
 * Analyzes recent intraday data for a stock to determine climb patterns
 * based on the last two 15-minute windows.
 *
 * @param {string} symbol - The stock symbol.
 * @returns {Promise<object|null>} Object with { gain_current_15min, gain_previous_15min, is_currently_climbing, latest_price, error }
 *                                 Returns null or object with error if analysis cannot be performed.
 */
export async function analyzeRecentClimbPattern(symbol) {
  // Fetch latest 100 data points (1-minute interval)
  const intradayData = await fetchIntradayData(symbol, null, '1min'); // month=null for latest compact

  if (!intradayData) {
    // console.warn(`[${symbol}] analyzeRecentClimbPattern: No intraday data returned by fetcher.`);
    return { error: 'No intraday data returned by fetcher.', gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  const sortedTimestamps = Object.keys(intradayData).sort();

  if (sortedTimestamps.length < 30) { // Need at least 30 points for two full 15-min windows and their start/end points
    // console.warn(`[${symbol}] analyzeRecentClimbPattern: Insufficient data points (${sortedTimestamps.length}). Need at least 30.`);
    return { error: `Insufficient data points (${sortedTimestamps.length}). Need at least 30.`, gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  // Extract closing prices in chronological order (latest price at the end)
  const prices = sortedTimestamps.map(ts => parseFloat(intradayData[ts]['4. close']));

  if (prices.some(isNaN)) {
    // console.warn(`[${symbol}] analyzeRecentClimbPattern: Contains NaN prices.`);
    return { error: 'Data contains NaN prices.', gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  // We need prices at T0, T-15, T-30 (approximately, based on 1-minute intervals)
  // Array is sorted chronologically, so latest price is at prices[prices.length - 1]

  const p_T0 = prices[prices.length - 1];                 // Latest price
  const p_T_minus_15 = prices[prices.length - 1 - 15];    // Price 15 minutes ago
  const p_T_minus_30 = prices[prices.length - 1 - 30];    // Price 30 minutes ago

  if (typeof p_T0 === 'undefined' || typeof p_T_minus_15 === 'undefined' || typeof p_T_minus_30 === 'undefined') {
      // This check is somewhat redundant due to sortedTimestamps.length < 30, but good for safety.
      // console.warn(`[${symbol}] analyzeRecentClimbPattern: Not enough data points for T0, T-15, T-30 price points after mapping.`);
      return { error: 'Could not define T0, T-15, T-30 price points.', gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: p_T0 };
  }

  const gain_current_15min = p_T0 - p_T_minus_15;
  const gain_previous_15min = p_T_minus_15 - p_T_minus_30;
  const is_currently_climbing = gain_current_15min > 0;

  return {
    gain_current_15min,
    gain_previous_15min,
    is_currently_climbing,
    latest_price: p_T0,
    error: null
  };
}


/**
 * Scans a list of stocks to find a candidate based on recent 15-minute climb patterns.
 * The chosen stock should be currently climbing, have had a positive climb in the previous 15-min window,
 * and its current 15-min climb gain should be no more than NEW_STOCK_CLIMB_PERCENTAGE_MAX
 * of its previous 15-min climb gain.
 *
 * @param {string[]} stockList - Array of stock symbols to scan. Defaults to DEFAULT_STOCK_UNIVERSE.
 * @param {string} [interval='1min'] - This parameter is currently not directly used by analyzeRecentClimbPattern
 *                                     as it defaults to '1min' for fetching compact data, but kept for signature consistency.
 * @returns {Promise<string|null>} The symbol of the first matching stock, or null if none found.
 */
export async function findNewStockCandidate(stockList = DEFAULT_STOCK_UNIVERSE, interval = '1min') {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('[Scanner] Error: Alpha Vantage API key is not set in stockTrader/config.js.');
    return null;
  }

  console.log(`[Scanner] Starting scan for new stock candidate from list: [${stockList.join(', ')}]`);
  let reasonsForNoCandidates = []; // To collect reasons if no stock is found

  for (const symbol of stockList) {
    // console.log(`[Scanner] Evaluating symbol: ${symbol}`);
    const analysisResult = await analyzeRecentClimbPattern(symbol); // This function fetches its own data

    if (analysisResult.error) {
      const reason = `[${symbol}] Analysis error: ${analysisResult.error}`;
      console.warn(reason);
      reasonsForNoCandidates.push(reason);
      // Delay even on error to manage API rate, as an API call was attempted
      await new Promise(resolve => setTimeout(resolve, 13000));
      continue;
    }

    const { gain_current_15min, gain_previous_15min, is_currently_climbing, latest_price } = analysisResult;
    // console.log(`[Scanner] Analysis for ${symbol}: Current15mGain=${gain_current_15min.toFixed(2)}, Prev15mGain=${gain_previous_15min.toFixed(2)}, Climbing=${is_currently_climbing}, LatestPrice=${latest_price}`);

    if (!is_currently_climbing) {
      const reason = `[${symbol}] Not a candidate: Not climbing in current 15min (gain: ${gain_current_15min.toFixed(2)}). Latest price: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`;
      console.log(reason);
      reasonsForNoCandidates.push(reason);
      await new Promise(resolve => setTimeout(resolve, 13000));
      continue;
    }

    if (gain_previous_15min <= 0) {
      const reason = `[${symbol}] Not a candidate: Previous 15min period was not a climb (gain: ${gain_previous_15min.toFixed(2)}). Current 15m gain: ${gain_current_15min.toFixed(2)}. Latest price: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`;
      console.log(reason);
      reasonsForNoCandidates.push(reason);
      await new Promise(resolve => setTimeout(resolve, 13000));
      continue;
    }

    if (gain_current_15min > (gain_previous_15min * NEW_STOCK_CLIMB_PERCENTAGE_MAX)) {
      const reason = `[${symbol}] Not a candidate: Current 15min climb gain (${gain_current_15min.toFixed(2)}) is > ${NEW_STOCK_CLIMB_PERCENTAGE_MAX * 100}% of previous 15min climb gain (${gain_previous_15min.toFixed(2)}). Latest price: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`;
      console.log(reason);
      reasonsForNoCandidates.push(reason);
      await new Promise(resolve => setTimeout(resolve, 13000));
      continue;
    }

    // If all conditions pass
    console.log(`[Scanner] SUCCESS: ${symbol} IS A CANDIDATE! Current 15m gain: ${gain_current_15min.toFixed(2)}, Previous 15m gain: ${gain_previous_15min.toFixed(2)}. Latest price: ${latest_price !== null ? latest_price.toFixed(2) : 'N/A'}`);
    return symbol;

    // The delay has been moved inside the loop conditions to ensure it runs after each symbol processing that involves an API call.
  }

  console.log("[Scanner] No suitable candidate found after checking all stocks.");
  if (reasonsForNoCandidates.length > 0 && reasonsForNoCandidates.length === stockList.length) {
      console.log("[Scanner] Summary of reasons for no candidates (or errors):");
      reasonsForNoCandidates.forEach(reason => console.log(reason));
  } else if (stockList.length === 0) {
      console.log("[Scanner] Stock list for scanning was empty.");
  }
  return null;
}

// --- Example Usage (comment out or remove for integration) ---
// The example usage would now primarily test findNewStockCandidate with analyzeRecentClimbPattern
// The old analyzeClimbingPattern and getPreviousMonthYYYYMM are no longer used by findNewStockCandidate.
// They could be removed if they are not used by any other part of the application.
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

// stockTrader/scannerCore.js

/**
 * Analyzes a given month's intraday data for a stock to determine climb patterns
 * based on the last two 15-minute windows (i.e., last 30 minutes of the provided data).
 *
 * @param {string} symbol - The stock symbol (for logging purposes).
 * @param {object|null} monthIntradayData - The pre-fetched intraday data for a specific month.
 *                                          Object where keys are timestamps and values are OHLCV data.
 * @returns {object} Object with { gain_current_15min, gain_previous_15min, is_currently_climbing, latest_price, error }
 */
export function analyzeRecentClimbPattern(symbol, monthIntradayData) {
  if (!monthIntradayData) {
    // console.warn(`[${symbol}] analyzeRecentClimbPattern: No intraday data provided.`);
    return { error: 'No intraday data provided.', gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  const sortedTimestamps = Object.keys(monthIntradayData).sort();

  // Ensure we are looking at the last 30 data points of the provided dataset
  if (sortedTimestamps.length < 30) {
    // console.warn(`[${symbol}] analyzeRecentClimbPattern: Insufficient data points in provided dataset (${sortedTimestamps.length}). Need at least 30.`);
    return { error: `Insufficient data points in provided dataset (${sortedTimestamps.length}). Need at least 30.`, gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  // Extract closing prices from the entire provided dataset
  const allPrices = sortedTimestamps.map(ts => parseFloat(monthIntradayData[ts]['4. close']));

  if (allPrices.some(isNaN)) {
    // console.warn(`[${symbol}] analyzeRecentClimbPattern: Provided data contains NaN prices.`);
    return { error: 'Provided data contains NaN prices.', gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  // Focus on the last 30 relevant prices from the end of the dataset
  const pricesToAnalyze = allPrices.slice(-30); // Get the last 30 elements for analysis

  // Prices for T0, T-15, T-30 relative to the end of this 30-point slice
  // pricesToAnalyze[0] is T-29 (effectively T-30 for gain calc), pricesToAnalyze[14] is T-15, pricesToAnalyze[29] is T0
  const p_T0 = pricesToAnalyze[29];              // Latest price in the 30-point slice (end of dataset)
  const p_T_minus_15 = pricesToAnalyze[14];      // Price 15 minutes ago from end of dataset (middle of the 30-point slice)
  const p_T_minus_30 = pricesToAnalyze[0];       // Price 30 minutes ago from end of dataset (start of the 30-point slice)


  // This check is essential as array access might be out of bounds if slice logic changes or data is malformed.
  if (typeof p_T0 === 'undefined' || typeof p_T_minus_15 === 'undefined' || typeof p_T_minus_30 === 'undefined') {
      // console.warn(`[${symbol}] analyzeRecentClimbPattern: Could not define T0, T-15, T-30 price points from the end of the dataset. Length: ${pricesToAnalyze.length}`);
      return { error: 'Could not define T0, T-15, T-30 price points from the end of the dataset.', gain_current_15min: 0, gain_previous_15min: 0, is_currently_climbing: false, latest_price: null };
  }

  const gain_current_15min = p_T0 - p_T_minus_15;
  const gain_previous_15min = p_T_minus_15 - p_T_minus_30;
  const is_currently_climbing = gain_current_15min > 0;

  return {
    gain_current_15min,
    gain_previous_15min,
    is_currently_climbing,
    latest_price: p_T0, // This is the latest price from the provided month's dataset
    error: null
  };
}

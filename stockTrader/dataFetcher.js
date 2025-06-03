// stockTrader/dataFetcher.js
import fetch from 'node-fetch';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ALPHA_VANTAGE_API_KEY,
  ALPHA_VANTAGE_BASE_URL,
  ALLOW_LIVE_API_CALLS_FOR_BACKTESTING,
  TARGET_MONTH_FOR_LOCAL_DATA
} from './config.js';

// Helper to ensure __dirname is available in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---
const LOCAL_DATA_DIR = path.join(__dirname, 'localData');

/**
 * Fetches intraday (minute-by-minute) stock data for a given symbol.
 * Prioritizes loading from local files if available and live calls are disabled or for specific scenarios.
 * If 'month' is provided, it attempts to load that specific month's data.
 * If 'month' is not provided (requesting 'latest' data):
 *   - If live calls are disabled, it defaults to loading `TARGET_MONTH_FOR_LOCAL_DATA`.
 *   - If live calls are enabled, it proceeds to fetch latest 'compact' data from API.
 *
 * @param {string} symbol The stock symbol (e.g., 'IBM').
 * @param {string} [month=null] The month for which to fetch data, in 'YYYY-MM' format. Optional.
 * @param {string} [interval='1min'] Time interval: '1min', '5min', '15min', '30min', '60min'.
 * @returns {Promise<object|null>} A promise that resolves to the time series data object, or null if an error occurs.
 */
export async function fetchIntradayData(symbol, month = null, interval = '1min') {
  let effectiveMonth = month;
  let triedLocalSpecificMonth = false; // Flag to track if we tried loading a specific month locally

  if (month === null) { // Request for "latest" data
    if (!ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) {
      effectiveMonth = TARGET_MONTH_FOR_LOCAL_DATA;
      console.log(`[LocalData] 'Latest data' request for ${symbol} in local-only mode; defaulting to TARGET_MONTH_FOR_LOCAL_DATA: ${effectiveMonth}`);
      // This makes month non-null, so local file check will proceed for this effectiveMonth
    }
    // If live calls are allowed and month is null, effectiveMonth remains null, skipping local specific month check initially.
  }

  if (effectiveMonth) { // This means month was provided OR it was defaulted for local-only "latest" request
    const localFilePath = path.join(LOCAL_DATA_DIR, `${symbol}_${effectiveMonth}_${interval}.json`);
    console.log(`[LocalData] Attempting to load local data for ${symbol} from: ${localFilePath}`);
    triedLocalSpecificMonth = true;
    try {
      const fileContent = await fsPromises.readFile(localFilePath, 'utf-8');
      const localData = JSON.parse(fileContent);
      console.log(`[LocalData] Successfully loaded data for ${symbol}, month ${effectiveMonth}, interval ${interval} from ${localFilePath}.`);
      return localData;
    } catch (err) {
      console.warn(`[LocalData] Failed to load or parse local data for ${symbol}, month ${effectiveMonth} from ${localFilePath}. Error: ${err.message}`);
      if (!ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) {
        console.warn(`[LocalData] Live API calls disabled. Cannot fetch ${symbol}, month ${effectiveMonth} after local failure. Returning null.`);
        return null;
      }
      // If live calls allowed, proceed to API fetch for this specific month.
      // Note: The original 'month' parameter must be used for the API call if it was specified.
      // If 'effectiveMonth' was from TARGET_MONTH_FOR_LOCAL_DATA due to month=null and local-only,
      // and that failed, we already returned null above.
      // So, if we reach here with live calls allowed, it implies 'month' was originally specified, or 'month' was null and live calls are on.
    }
  }

  // --- Live API Call Logic ---
  // Proceed if:
  // 1. 'month' was null, live calls are allowed (for 'latest' compact data).
  // 2. 'month' was specified, local read failed, and live calls are allowed.

  if (!ALLOW_LIVE_API_CALLS_FOR_BACKTESTING && month === null && !triedLocalSpecificMonth) {
    // This covers the edge case: latest requested, live calls off, but TARGET_MONTH_FOR_LOCAL_DATA was not used (e.g. if we change logic later)
    // However, current logic for (month === null && !ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) already sets effectiveMonth,
    // so this specific path might be redundant if the previous block (if !ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) after catch handles it.
    // For safety, keeping a check that if live calls are off, and we haven't found local data for a 'latest' request, we bail.
    console.warn(`[DataFetcher] Live API calls disabled for 'latest' data request for ${symbol}. Local data attempt for ${TARGET_MONTH_FOR_LOCAL_DATA} already handled. Returning null.`);
    return null;
  }


  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('[LIVE API Call Failed] Alpha Vantage API key is not set. Cannot make live API call.');
    return null;
  }

  const validIntervals = ['1min', '5min', '15min', '30min', '60min'];
  if (!validIntervals.includes(interval)) {
    // This validation is now after local check, ensure it's fine or move earlier if local name depends on it.
    // It's fine here as local file name uses interval too.
    console.error(`[DataFetcher] Invalid interval '${interval}'. Must be one of ${validIntervals.join(', ')}.`);
    return null;
  }

  const params = new URLSearchParams({
    function: 'TIME_SERIES_INTRADAY',
    symbol: symbol,
    interval: interval,
    apikey: ALPHA_VANTAGE_API_KEY,
    datatype: 'json'
  });

  // Use the original 'month' parameter for determining API call type (full or compact)
  if (month) {
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      console.error(`[DataFetcher] Invalid month format '${month}' for live API call. Must be YYYY-MM.`);
      return null;
    }
    params.append('month', month);
    params.append('outputsize', 'full');
  } else { // Original request was for 'latest' data
    params.append('outputsize', 'compact');
  }

  const url = `${ALPHA_VANTAGE_BASE_URL}?${params.toString()}`;
  const logContext = `symbol=${symbol}, month=${month || 'latest (compact)'}, interval=${interval}, outputsize=${params.get('outputsize')}`;

  console.log(`[LIVE API Call Start] Fetching Alpha Vantage: ${logContext}, url=${url.replace(ALPHA_VANTAGE_API_KEY, 'YOUR_API_KEY_REDACTED')}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[LIVE API Call Failed] HTTP Error for ${logContext}: ${response.status} ${response.statusText}. URL: ${url.replace(ALPHA_VANTAGE_API_KEY, 'YOUR_API_KEY_REDACTED')}`);
      const errorBody = await response.text();
      console.error('[LIVE API Call Failed] Error body:', errorBody);
      return null;
    }

    const data = await response.json();

    if (data['Error Message']) {
      console.error(`[LIVE API Call Failed] Alpha Vantage API Error for ${logContext}: ${data['Error Message']}`);
      return null;
    }

    const timeSeriesKey = Object.keys(data).find(key => key.startsWith('Time Series ('));
    if (!timeSeriesKey || !data[timeSeriesKey]) {
      console.error(`[LIVE API Call Failed] Time series data not found for ${logContext} in API response.`);
      console.log('[LIVE API Call Info] API Response structure:', data);
      return null;
    }

    const pointCount = Object.keys(data[timeSeriesKey]).length;
    console.log(`[LIVE API Call Success] Fetched ${logContext}. Received ${pointCount} data points.`);
    return data[timeSeriesKey];

  } catch (error) {
    console.error(`[LIVE API Call Error] Network or parsing error for ${logContext}:`, error);
    return null;
  }
}

// Example usage (can be commented out or removed later)
// Note: To test local data fetching, ensure ALLOW_LIVE_API_CALLS_FOR_BACKTESTING = false in config.js
// and run seedData.js first for the TARGET_MONTH_FOR_LOCAL_DATA and relevant stocks.
/*
(async () => {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log("Please set your Alpha Vantage API key in stockTrader/config.js to run the example.");
    return;
  }
  const symbol = 'IBM'; // Example symbol
  const symbol = 'IBM'; // Example symbol

  // Example 1: Fetch data for a specific month
  // const month = '2023-05'; // Example month: May 2023
  // console.log(`Attempting to fetch data for ${symbol} for month ${month}`);
  // const intradayDataMonth = await fetchIntradayData(symbol, month, '1min');
  // if (intradayDataMonth) {
  //   console.log(`Successfully fetched data for month ${month}. Number of data points:`, Object.keys(intradayDataMonth).length);
  //   const firstKeyMonth = Object.keys(intradayDataMonth)[0];
  //   if (firstKeyMonth) {
  //       console.log(`First data point [${firstKeyMonth}]:`, intradayDataMonth[firstKeyMonth]);
  //   } else {
  //       console.log('No data points returned for month fetch.');
  //   }
  // } else {
  //   console.log(`Failed to fetch intraday data for month ${month}.`);
  // }

  // Example 2: Fetch latest compact data (no month specified)
  console.log(`Attempting to fetch latest compact data for ${symbol}`);
  const intradayDataLatest = await fetchIntradayData(symbol, null, '1min');

  if (intradayDataLatest) {
    console.log('Successfully fetched latest compact data. Number of data points:', Object.keys(intradayDataLatest).length);
    const firstKeyLatest = Object.keys(intradayDataLatest)[0];
    if (firstKeyLatest) {
        console.log(`First data point [${firstKeyLatest}]:`, intradayDataLatest[firstKeyLatest]);
    } else {
        console.log('No data points returned for latest compact fetch.');
    }
  } else {
    console.log('Failed to fetch latest compact intraday data.');
  }
})();
*/

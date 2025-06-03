// stockTrader/dataFetcher.js
import fetch from 'node-fetch';
import { ALPHA_VANTAGE_API_KEY, ALPHA_VANTAGE_BASE_URL } from './config.js';

/**
 * Fetches intraday (minute-by-minute) stock data for a given symbol.
 * If 'month' is provided, it fetches data for that specific month.
 * If 'month' is not provided, it fetches the latest ~100 data points (compact).
 *
 * @param {string} symbol The stock symbol (e.g., 'IBM').
 * @param {string} [month=null] The month for which to fetch data, in 'YYYY-MM' format (e.g., '2023-05'). Optional.
 * @param {string} [interval='1min'] Time interval: '1min', '5min', '15min', '30min', '60min'.
 * @returns {Promise<object|null>} A promise that resolves to the time series data object, or null if an error occurs.
 */
export async function fetchIntradayData(symbol, month = null, interval = '1min') {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('Error: Alpha Vantage API key is not set in stockTrader/config.js.');
    console.error('Please obtain a free API key from https://www.alphavantage.co/support/#api-key and update the config file.');
    return null;
  }

  const validIntervals = ['1min', '5min', '15min', '30min', '60min'];
  if (!validIntervals.includes(interval)) {
    console.error(`Error: Invalid interval '${interval}'. Must be one of ${validIntervals.join(', ')}.`);
    return null;
  }

  const params = new URLSearchParams({
    function: 'TIME_SERIES_INTRADAY',
    symbol: symbol,
    interval: interval,
    apikey: ALPHA_VANTAGE_API_KEY,
    datatype: 'json'
  });

  let fetchDescription;

  if (month) {
    // Validate YYYY-MM format for month if provided
    const monthRegex = /^\d{4}-\d{2}$/;
    if (!monthRegex.test(month)) {
      console.error(`Error: Invalid month format '${month}'. Must be in YYYY-MM format (e.g., '2023-01').`);
      return null;
    }
    params.append('month', month);
    params.append('outputsize', 'full');
    fetchDescription = `month: ${month}, interval: ${interval}`;
  } else {
    params.append('outputsize', 'compact'); // Fetch latest 100 data points
    fetchDescription = `latest compact data, interval: ${interval}`;
  }

  const url = `${ALPHA_VANTAGE_BASE_URL}?${params.toString()}`;

  console.log(`[API Call Start] Fetching Alpha Vantage: symbol=${symbol}, month=${month || 'latest'}, interval=${interval}, outputsize=${params.get('outputsize')}, url=${url.replace(ALPHA_VANTAGE_API_KEY, 'YOUR_API_KEY_REDACTED')}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[API Call Failed] HTTP Error for ${symbol} (${month || 'latest'}): ${response.status} ${response.statusText}. URL: ${url.replace(ALPHA_VANTAGE_API_KEY, 'YOUR_API_KEY_REDACTED')}`);
      const errorBody = await response.text();
      console.error('[API Call Failed] Error body:', errorBody); // Keep for debugging
      return null;
    }

    const data = await response.json();

    if (data['Error Message']) {
      console.error(`[API Call Failed] Alpha Vantage API Error for ${symbol} (${month || 'latest'}): ${data['Error Message']}`);
      return null;
    }

    const timeSeriesKey = Object.keys(data).find(key => key.startsWith('Time Series ('));
    if (!timeSeriesKey || !data[timeSeriesKey]) {
      console.error(`[API Call Failed] Time series data not found for ${symbol} (${month || 'latest'}) in API response.`);
      console.log('[API Call Info] API Response structure:', data);
      return null;
    }

    const pointCount = Object.keys(data[timeSeriesKey]).length;
    console.log(`[API Call Success] Fetched ${symbol} (${month || 'latest'}, ${interval}). Received ${pointCount} data points.`);
    return data[timeSeriesKey];

  } catch (error) {
    console.error(`[API Call Error] Network or parsing error for ${symbol} (${month || 'latest'}):`, error);
    return null;
  }
}

// Example usage (can be commented out or removed later)
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

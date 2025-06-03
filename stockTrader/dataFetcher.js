// stockTrader/dataFetcher.js
import fetch from 'node-fetch';
import { ALPHA_VANTAGE_API_KEY, ALPHA_VANTAGE_BASE_URL } from './config.js';

/**
 * Fetches intraday (minute-by-minute) stock data for a given symbol and month.
 *
 * @param {string} symbol The stock symbol (e.g., 'IBM').
 * @param {string} month The month for which to fetch data, in 'YYYY-MM' format (e.g., '2023-05').
 * @param {string} interval Time interval: '1min', '5min', '15min', '30min', '60min'. Defaults to '1min'.
 * @returns {Promise<object|null>} A promise that resolves to the time series data object, or null if an error occurs.
 *                                  The data is an object where keys are timestamps and values are OHLCV data.
 *                                  Example: { '2023-05-26 15:59:00': { '1. open': '130.00', ... }, ... }
 */
export async function fetchIntradayData(symbol, month, interval = '1min') {
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

  // Validate YYYY-MM format for month
  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(month)) {
    console.error(`Error: Invalid month format '${month}'. Must be in YYYY-MM format (e.g., '2023-01').`);
    return null;
  }

  const params = new URLSearchParams({
    function: 'TIME_SERIES_INTRADAY',
    symbol: symbol,
    interval: interval,
    month: month,
    outputsize: 'full', // Fetch full data for the specified month
    apikey: ALPHA_VANTAGE_API_KEY,
    datatype: 'json'
  });

  const url = `${ALPHA_VANTAGE_BASE_URL}?${params.toString()}`;

  console.log(`Fetching intraday data for ${symbol}, month: ${month}, interval: ${interval} from ${url.replace(ALPHA_VANTAGE_API_KEY, 'YOUR_API_KEY')}`); // Log URL without exposing key

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error fetching data from Alpha Vantage: ${response.status} ${response.statusText}`);
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return null;
    }

    const data = await response.json();

    if (data['Error Message']) {
      console.error(`Alpha Vantage API Error: ${data['Error Message']}`);
      return null;
    }

    // The relevant data is under a key like "Time Series (1min)"
    const timeSeriesKey = Object.keys(data).find(key => key.startsWith('Time Series ('));
    if (!timeSeriesKey || !data[timeSeriesKey]) {
      console.error('Error: Time series data not found in API response for the specified symbol/month.');
      console.log('API Response:', data); // Log the response if data is not in expected format
      // This can happen if the symbol is invalid for the given month or for various other API reasons.
      return null;
    }

    // Data successfully fetched and parsed
    // The data is an object where keys are timestamps (e.g., "2023-05-26 15:59:00")
    // and values are objects with "1. open", "2. high", "3. low", "4. close", "5. volume".
    return data[timeSeriesKey];

  } catch (error) {
    console.error('Network or parsing error while fetching intraday data:', error);
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
  const month = '2023-05'; // Example month: May 2023

  console.log(`Attempting to fetch data for ${symbol} for month ${month}`);
  const intradayData = await fetchIntradayData(symbol, month, '1min');

  if (intradayData) {
    console.log('Successfully fetched data. Number of data points:', Object.keys(intradayData).length);
    // console.log('Sample data point:', intradayData[Object.keys(intradayData)[0]]);
    const firstKey = Object.keys(intradayData)[0];
    if (firstKey) {
        console.log(`First data point [${firstKey}]:`, intradayData[firstKey]);
    } else {
        console.log('No data points returned.');
    }
  } else {
    console.log('Failed to fetch intraday data.');
  }
})();
*/

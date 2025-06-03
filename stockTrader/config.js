// stockTrader/config.js

export const ALPHA_VANTAGE_API_KEY = 'YOUR_API_KEY_HERE'; // Replace with your actual Alpha Vantage API key
export const PHI = 1.61803398875; // The golden ratio

// Algorithm Parameters (can be tuned)
export const SELL_OFF_TOLERANCE_FACTOR = 1 / PHI; // Example: price can drop by x / PHI
export const NEW_STOCK_CLIMB_PERCENTAGE_MAX = 0.50; // New stock's current climb <= 50% of its previous climb

// Backtesting Parameters
export const DEFAULT_HISTORICAL_PERIOD_MONTHS = 1; // Default number of months for backtesting
export const DEFAULT_STOCK_UNIVERSE = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA']; // Example stock universe (Nasdaq/S&P500 subset)

// API Configuration
export const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

// Local Data Testing Configuration
export const TARGET_MONTH_FOR_LOCAL_DATA = '2023-05'; // Target month for local data seeding and testing
export const TARGET_STOCKS_FOR_LOCAL_DATA = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA']; // Target stocks for local data
export const ALLOW_LIVE_API_CALLS_FOR_BACKTESTING = false; // Set to true to allow fallback to live API if local data not found

// It's good practice to inform the user if the API key is missing.
if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
  console.warn("ALPHA_VANTAGE_API_KEY is not set in stockTrader/config.js. Please obtain a free API key from https://www.alphavantage.co/support/#api-key and update the config file.");
}

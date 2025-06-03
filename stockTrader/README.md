# Stock Trading Algorithm & Backtester Module

This module implements a configurable stock trading algorithm, a backtesting engine to simulate its performance on historical data, and a stock scanner to find new trading candidates. It is designed to integrate with the main Express application.

## Core Components

-   **`config.js`**: Holds configuration variables, including the Alpha Vantage API key, algorithm parameters (like PHI, sell-off tolerance), and backtesting defaults (like the default stock universe). **This file requires user configuration.**
-   **`dataFetcher.js`**: Responsible for fetching historical minute-by-minute stock data from the Alpha Vantage API.
-   **`algorithm.js`**: Contains the `StockTracker` class, which implements the core trading logic. It tracks a single stock, identifies "climbing up" periods, calculates accumulated gain (`x`), and applies the primary sell condition: sell if the price drops from the climb's peak by more than `x / PHI` (where PHI is the golden ratio).
-   **`scanner.js`**: Implements the `findNewStockCandidate` function. It analyzes a list of stocks by fetching their recent intraday data (latest ~100 1-minute data points). It determines if a stock is a candidate by:
        1.  Checking if the stock is climbing in the most recent 15-minute window (gain > 0).
        2.  Verifying that the 15-minute window immediately preceding it was also a climb (its gain > 0).
        3.  Ensuring the gain in the current 15-minute climb is 50% or less than the gain of the previous 15-minute climb.
-   **`backtester.js`**: Contains the `runPortfolioBacktest` function. This orchestrates the backtest by:
    -   Fetching data for a universe of stocks over a specified period.
    -   Processing price data chronologically on a unified timeline.
    -   Using `StockTracker` to make trading decisions for the currently held stock.
    -   When a stock is sold, it uses `scanner.js` to find a new candidate stock.
    -   Records all simulated trades and provides a performance summary.
-   **`algorithm.test.js`**: Unit tests for the `StockTracker` class.
-   **`scanner.test.js`**: Unit tests for the `analyzeRecentClimbPattern` function in `scanner.js`.

## Setup

1.  **Alpha Vantage API Key**: This module requires an API key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key) to fetch stock data. Free keys are available but come with rate limits (e.g., 5 requests per minute, 100-500 per day).
2.  **Configure API Key**:
    *   Locate the file `stockTrader/config.js`.
    *   Replace `'YOUR_API_KEY_HERE'` with your actual Alpha Vantage API key for the `ALPHA_VANTAGE_API_KEY` constant.

    ```javascript
    // stockTrader/config.js
    export const ALPHA_VANTAGE_API_KEY = 'YOUR_ACTUAL_API_KEY'; // <--- SET THIS
    // ... other configurations
    ```

## Running a Backtest

Backtests are initiated by making a GET request to an Express route on the running server.

**Route:** `GET /backtest/portfolio`

**Query Parameters:**

-   `initialSymbol` (string, **required**): The stock symbol to start the backtest with (e.g., `AAPL`, `MSFT`).
-   `numMonths` (integer, optional): The number of past months to include in the backtest. Defaults to `1` (or the value in `config.js`).
-   `endMonthYYYYMM` (string, format 'YYYY-MM', optional): Specifies the most recent month to include in the backtest period. If not provided, the backtest will use the most recently completed months leading up to the current date. For example, if today is July 15, 2024, and `numMonths=1` without `endMonthYYYYMM`, it will likely test June 2024. If `endMonthYYYYMM=2023-05` and `numMonths=3`, it will test March, April, and May 2023.
-   `stockUniverse` (string, comma-separated, optional): A list of stock symbols to consider for scanning when a new stock is needed (e.g., `AAPL,MSFT,GOOGL,TSLA`). Defaults to the list in `config.js`. The `initialSymbol` will be automatically included in this universe if not already present.
-   `interval` (string, optional): The time interval for the stock data. Defaults to `'1min'`. Supported values: `'1min'`, `'5min'`, `'15min'`, `'30min'`, `'60min'`.

**Example URLs (assuming the server runs on `http://localhost:5001`):**

-   Run a backtest starting with `AAPL` for the last 2 months, considering `AAPL`, `MSFT`, `TSLA` for scanning, using `5min` interval data:
    ```
    http://localhost:5001/backtest/portfolio?initialSymbol=AAPL&numMonths=2&stockUniverse=AAPL,MSFT,TSLA&interval=5min
    ```
-   Run a backtest starting with `NVDA` for the last 1 month (using default universe and interval):
    ```
    http://localhost:5001/backtest/portfolio?initialSymbol=NVDA&numMonths=1
    ```
-   Run a backtest starting with `AMD` for 3 months ending in October 2023:
    ```
    http://localhost:5001/backtest/portfolio?initialSymbol=AMD&numMonths=3&endMonthYYYYMM=2023-10
    ```

**Expected Response:**

The route will return a JSON object containing:
-   `trades`: An array of all simulated trades, each with details like symbol, buy/sell timestamps, buy/sell prices, and profit/loss.
-   `summary`: An object with overall performance metrics like total profit/loss, number of trades, etc.
-   An `error` field may be present if issues occurred (e.g., API key missing, no data).

## Unit Tests

Unit tests have been implemented for the core algorithm (`StockTracker` in `algorithm.js`).
To run these tests:

```bash
npm test
```
This command will execute Jest and run all `*.test.js` files in the project.

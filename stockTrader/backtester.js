// stockTrader/backtester.js (Modified for portfolio)
import { fetchIntradayData } from './dataFetcher.js';
import { StockTracker, Signal, StockStatus } from './algorithm.js'; // Assuming StockStatus might be useful for logging/state checking
import { findNewStockCandidate } from './scanner.js';
import { ALPHA_VANTAGE_API_KEY, DEFAULT_STOCK_UNIVERSE, DEFAULT_HISTORICAL_PERIOD_MONTHS } from './config.js';

/**
 * Helper function to get the year and month string for 'n' months ago from a given date.
 */
function getYearMonthString(currentDate, monthsAgo) {
  const targetDate = new Date(currentDate);
  targetDate.setMonth(targetDate.getMonth() - monthsAgo);
  const year = targetDate.getFullYear();
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-indexed
  return `${year}-${month}`;
}

/**
 * Runs a portfolio backtest, dynamically switching stocks based on sell signals and scanner results.
 *
 * @param {string} initialSymbol The starting stock symbol.
 * @param {number} numMonths The number of past months to backtest.
 * @param {string} [endMonthYYYYMM] The most recent month to include in 'YYYY-MM' format. Defaults to the month before current.
 * @param {string[]} [stockUniverse=DEFAULT_STOCK_UNIVERSE] Array of stock symbols to consider for scanning.
 * @param {string} [interval='1min'] The interval for intraday data.
 * @returns {Promise<object>} An object containing backtest results.
 */
export async function runPortfolioBacktest(
  initialSymbol,
  numMonths = DEFAULT_HISTORICAL_PERIOD_MONTHS,
  endMonthYYYYMM,
  stockUniverse = DEFAULT_STOCK_UNIVERSE,
  interval = '1min'
) {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('Error: Alpha Vantage API key is not set in stockTrader/config.js.');
    return { trades: [], summary: { error: 'API key not set.' } };
  }

  console.log(`Starting PORTFOLIO backtest. Initial: ${initialSymbol}, Universe: [${stockUniverse.join(', ')}], Period: ${numMonths} month(s) ending ${endMonthYYYYMM || 'last available month'}`);

  const allStocksData = {}; // { symbol: { timestamp: ohlcv, ... }, ... }
  const allUniqueTimestamps = new Set();
  const trades = [];

  const today = new Date();
  let baseDateForMonthCalc = today;
  if (endMonthYYYYMM) {
    const [year, month] = endMonthYYYYMM.split('-').map(Number);
    baseDateForMonthCalc = new Date(year, month - 1, 15);
  }

  // 1. Fetch data for ALL stocks in the universe for the entire period
  console.log("\n--- Phase 1: Fetching all historical data ---");
  for (const symbol of stockUniverse) {
    allStocksData[symbol] = {};
    console.log(`Fetching data for ${symbol}...`);
    for (let i = numMonths - 1; i >= 0; i--) {
      let monthToFetch;
      if (endMonthYYYYMM) {
        monthToFetch = getYearMonthString(baseDateForMonthCalc, i);
      } else {
        monthToFetch = getYearMonthString(new Date(today.getFullYear(), today.getMonth(), 1), i + 1);
      }

      // console.log(`  Fetching ${symbol} for month: ${monthToFetch}`);
      const monthlyData = await fetchIntradayData(symbol, monthToFetch, interval);
      if (monthlyData) {
        // console.log(`  Fetched ${Object.keys(monthlyData).length} points for ${symbol} in ${monthToFetch}.`);
        for (const ts in monthlyData) {
          allStocksData[symbol][ts] = monthlyData[ts];
          allUniqueTimestamps.add(ts);
        }
      } else {
        // console.warn(`  No data for ${symbol} in ${monthToFetch}.`);
      }
      // Delay between API calls for different months of the *same stock* is handled by fetchIntradayData implicitly if needed
      // However, explicit delay if fetching many symbols * many months
      if (stockUniverse.length * numMonths > 5) { // Heuristic for many calls
         await new Promise(resolve => setTimeout(resolve, 12000)); // AlphaVantage free tier: ~5 calls/min
      }
    }
    console.log(`Finished fetching data for ${symbol}. Total points: ${Object.keys(allStocksData[symbol]).length}`);
  }

  const sortedGlobalTimeline = Array.from(allUniqueTimestamps).sort();
  if (sortedGlobalTimeline.length === 0) {
    console.error("No historical data found for any stock in the universe for the specified period.");
    return { trades: [], summary: { totalPL: 0, tradesCount: 0, error: 'No data found for universe.' } };
  }
  console.log(`--- Data fetching complete. Unified timeline has ${sortedGlobalTimeline.length} unique timestamps ---`);

  // 2. Main Backtesting Loop
  console.log("\n--- Phase 2: Running simulation ---");
  let currentSymbol = initialSymbol;
  let currentTracker = new StockTracker(currentSymbol);
  let holdingStock = false;
  let buyPrice = 0;
  let buyTimestamp = '';
  let lastScanTime = 0; // To avoid scanning too frequently if no stock is held

  for (const timestamp of sortedGlobalTimeline) {
    const currentTickDataForSymbol = currentSymbol ? allStocksData[currentSymbol]?.[timestamp] : null;

    if (!holdingStock) {
      if (currentSymbol && currentTickDataForSymbol) {
        // Attempt to buy currentSymbol
        buyPrice = parseFloat(currentTickDataForSymbol['4. close']);
        if (isNaN(buyPrice)) {
            console.warn(`[${currentSymbol}@${timestamp}] Invalid buy price: ${currentTickDataForSymbol['4. close']}. Skipping buy.`);
            continue;
        }
        buyTimestamp = timestamp;
        holdingStock = true;
        // currentTracker should be already initialized for currentSymbol (either initial or after scan)
        console.log(`[${currentSymbol}@${timestamp}] --- Portfolio BUY at ${buyPrice} ---`);
        currentTracker.processMinuteData({ ...currentTickDataForSymbol, timestamp, close: buyPrice }); // Process this tick to start climb
      } else if (!currentSymbol) {
        // No current symbol to trade, try to scan periodically
        const now = Date.now(); // Using system time for scan frequency, not backtest time
        if (now - lastScanTime > 60000) { // Scan at most once per minute (of real time) to find a new stock
            console.log(`[Timeline@${timestamp}] Currently not holding. Scanning for new stock...`);
            // Ensure stockUniverse is not empty and filters out potential nulls if any were added
            const candidateUniverse = stockUniverse.filter(s => s && typeof s === 'string');
            if (candidateUniverse.length === 0) {
                console.log(`[Timeline@${timestamp}] No valid stock universe to scan from.`);
                lastScanTime = now; // Update scan time even if universe is empty
                continue;
            }
            const newCandidate = await findNewStockCandidate(candidateUniverse);
            if (newCandidate) {
                console.log(`[Timeline@${timestamp}] Scanner found new candidate: ${newCandidate}`);
                currentSymbol = newCandidate;
                currentTracker = new StockTracker(currentSymbol); // Prepare for next buy opportunity
            } else {
                console.log(`[Timeline@${timestamp}] Scanner found no new candidate. Will remain without a stock.`);
                currentSymbol = null; // Explicitly stay null
            }
            lastScanTime = now;
        }
      }
      // If currentSymbol is set but no data for it at this specific global timestamp, just wait for its data.
    } else { // Holding stock
      if (!currentTickDataForSymbol) {
        // Data gap for the currently held stock on the global timeline.
        // console.warn(`[${currentSymbol}@${timestamp}] Data gap for held stock. Holding.`);
        continue;
      }

      const tickPrice = parseFloat(currentTickDataForSymbol['4. close']);
       if (isNaN(tickPrice)) {
            console.warn(`[${currentSymbol}@${timestamp}] Invalid tick price in held stock: ${currentTickDataForSymbol['4. close']}. Holding.`);
            // Consider how StockTracker handles this. It might need previousPrice to be set.
            // For now, the tracker's own NaN check should handle it.
            // currentTracker.previousPrice = tickPrice; // Potentially problematic if tracker expects valid previous.
            // Let's rely on tracker's internal handling for now.
            const signal = currentTracker.processMinuteData({ ...currentTickDataForSymbol, timestamp, close: tickPrice }); // it will return HOLD
            continue;
        }

      const signal = currentTracker.processMinuteData({ ...currentTickDataForSymbol, timestamp, close: tickPrice });

      if (signal === Signal.SELL) {
        const sellPrice = tickPrice;
        const profitOrLoss = sellPrice - buyPrice;
        trades.push({
          symbol: currentSymbol,
          buyTimestamp,
          buyPrice,
          sellTimestamp: timestamp,
          sellPrice,
          profitOrLoss,
        });
        console.log(`[${currentSymbol}@${timestamp}] --- Portfolio SELL at ${sellPrice} --- P&L: ${profitOrLoss.toFixed(2)}`);

        const soldSymbol = currentSymbol;
        holdingStock = false;
        currentSymbol = null;
        currentTracker = null;
        buyPrice = 0;
        buyTimestamp = '';

        console.log(`[Timeline@${timestamp}] Sold ${soldSymbol}. Scanning for new stock (excluding ${soldSymbol})...`);
        const candidateUniverse = stockUniverse.filter(s => s && typeof s === 'string' && s !== soldSymbol);
        if (candidateUniverse.length === 0) {
            console.log(`[Timeline@${timestamp}] No valid stock universe to scan from after selling ${soldSymbol}.`);
            lastScanTime = Date.now(); // Update scan time
            currentSymbol = null; // Ensure it stays null
            continue;
        }
        const newCandidate = await findNewStockCandidate(candidateUniverse);
        if (newCandidate) {
          console.log(`[Timeline@${timestamp}] Scanner found new candidate: ${newCandidate}`);
          currentSymbol = newCandidate;
          currentTracker = new StockTracker(currentSymbol);
        } else {
          console.log(`[Timeline@${timestamp}] Scanner found no new candidate after selling ${soldSymbol}. Will wait.`);
          currentSymbol = null; // No stock to track now
        }
        lastScanTime = Date.now();
      }
    }
  }

  const totalPL = trades.reduce((sum, trade) => sum + trade.profitOrLoss, 0);
  const summary = {
    initialSymbol,
    stockUniverse: stockUniverse.join(', '),
    totalPL: parseFloat(totalPL.toFixed(2)),
    tradesCount: trades.length,
    dataPointsInTimeline: sortedGlobalTimeline.length,
  };

  console.log("\n--- Portfolio Backtest Finished ---");
  console.log("Summary:", summary);
  return { trades, summary };
}


// --- Example Usage (comment out or remove for integration) ---
/*
(async () => {
  if (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE') {
    console.log("Please set your Alpha Vantage API key in stockTrader/config.js to run the portfolio backtest example.");
    return;
  }

  // Use a smaller universe for example to manage API calls
  const exampleUniverse = ['AAPL', 'MSFT', 'GOOGL'];
  const exampleInitialSymbol = exampleUniverse[0]; // Start with the first stock in the example universe
  const monthsToTest = 1; // Test for 1 month for brevity in example

  console.log("Running portfolio backtest example...");
  // Example: Test for the last 'monthsToTest' completed months.
  // Using a slightly longer interval for testing to reduce data points if '1min' is too much for free tier over several stocks.
  const results = await runPortfolioBacktest(
    exampleInitialSymbol,
    monthsToTest,
    undefined, // Let it default to previous month(s)
    exampleUniverse,
    '5min' // Using 5min interval for example
  );

  if (results && results.trades) {
    console.log("\n--- Portfolio Backtest Example Results ---");
    console.log("Trades:", JSON.stringify(results.trades, null, 2));
    console.log("Summary:", results.summary);
  } else {
    console.log("Portfolio backtest example did not produce results or encountered an error.");
  }
})();
*/

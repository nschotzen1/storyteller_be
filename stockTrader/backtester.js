// stockTrader/backtester.js
import { fetchIntradayData } from './dataFetcher.js';
import { StockTracker, Signal, StockStatus } from './algorithm.js';
import { findNewStockCandidate } from './scanner.js';
import {
  ALPHA_VANTAGE_API_KEY,
  DEFAULT_STOCK_UNIVERSE,
  DEFAULT_HISTORICAL_PERIOD_MONTHS,
  ALLOW_LIVE_API_CALLS_FOR_BACKTESTING,
  TARGET_MONTH_FOR_LOCAL_DATA
} from './config.js';

// getYearMonthString might still be needed if ALLOW_LIVE_API_CALLS_FOR_BACKTESTING is true
// and multi-month live fetching is fully supported. For now, it might be simplified.
function getYearMonthString(currentDate, monthsAgo) {
  const targetDate = new Date(currentDate);
  targetDate.setMonth(targetDate.getMonth() - monthsAgo);
  const year = targetDate.getFullYear();
  const month = (targetDate.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Runs a portfolio backtest, dynamically switching stocks.
 * Prioritizes local data for TARGET_MONTH_FOR_LOCAL_DATA if ALLOW_LIVE_API_CALLS_FOR_BACKTESTING is false.
 *
 * @param {string} initialSymbol The starting stock symbol.
 * @param {number} numMonths The number of past months (largely ignored if in local-only mode).
 * @param {string} [endMonthYYYYMM] The most recent month (largely ignored if in local-only mode).
 * @param {string[]} [stockUniverse=DEFAULT_STOCK_UNIVERSE] Array of stock symbols.
 * @param {string} [interval='1min'] The interval for intraday data (fixed to '1min' in local-only mode).
 * @returns {Promise<object>} An object containing backtest results.
 */
export async function runPortfolioBacktest(
  initialSymbol,
  numMonths = DEFAULT_HISTORICAL_PERIOD_MONTHS, // Will be largely ignored in local-only mode
  endMonthYYYYMM, // Will be largely ignored in local-only mode
  stockUniverse = DEFAULT_STOCK_UNIVERSE,
  interval = '1min' // Will be fixed to '1min' for local data from TARGET_MONTH
) {
  // API key check is crucial if live calls might be made
  if (ALLOW_LIVE_API_CALLS_FOR_BACKTESTING && (ALPHA_VANTAGE_API_KEY === 'YOUR_API_KEY_HERE')) {
    console.error('[Backtester] Error: Alpha Vantage API key is not set and live API calls are enabled. Set API key or disable live calls.');
    return { trades: [], summary: { error: 'API key not set for live calls.' } };
  }

  let effectiveStockUniverse = [...new Set([initialSymbol, ...stockUniverse])];
  const effectiveInterval = '1min'; // Scanner and local data are based on 1min interval analysis.
  const trades = [];

  if (!ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) {
    console.log(`[Backtester] Running in LOCAL DATA mode for month: ${TARGET_MONTH_FOR_LOCAL_DATA}, interval: ${effectiveInterval}`);
    console.log(`[Backtester] Universe: [${effectiveStockUniverse.join(', ')}]`);
  } else {
    console.log(`[Backtester] Running in LIVE API mode. Initial: ${initialSymbol}, Universe: [${effectiveStockUniverse.join(', ')}], Period: ${numMonths} month(s) ending ${endMonthYYYYMM || 'last available month'}, interval: ${interval}`);
  }

  const allStocksData = {}; // Structure: { SYMBOL: dataForTargetMonth, ... }
  const allUniqueTimestamps = new Set();

  console.log("\n--- Phase 1: Fetching historical data ---");
  if (!ALLOW_LIVE_API_CALLS_FOR_BACKTESTING) {
    for (const symbol of effectiveStockUniverse) {
      const dataForOneMonth = await fetchIntradayData(symbol, TARGET_MONTH_FOR_LOCAL_DATA, effectiveInterval);
      if (dataForOneMonth && Object.keys(dataForOneMonth).length > 0) {
        allStocksData[symbol] = dataForOneMonth;
        Object.keys(dataForOneMonth).forEach(ts => allUniqueTimestamps.add(ts));
        console.log(`[Backtester] Loaded ${Object.keys(dataForOneMonth).length} local data points for ${symbol} for ${TARGET_MONTH_FOR_LOCAL_DATA}.`);
      } else {
        console.warn(`[Backtester] No local data found or data empty for ${symbol} for ${TARGET_MONTH_FOR_LOCAL_DATA}. It will be excluded.`);
        effectiveStockUniverse = effectiveStockUniverse.filter(s => s !== symbol);
      }
    }
  } else {
    // Simplified live fetching: Focus on a single month period for consistency with allStocksData structure
    // This means numMonths > 1 or complex endMonthYYYYMM logic for live mode is simplified here.
    console.warn("[Backtester] Live API data fetching is simplified to target one month period for this refactor (endMonthYYYYMM or TARGET_MONTH_FOR_LOCAL_DATA).");
    const today = new Date();
    let monthToFetchLive;
    if (endMonthYYYYMM) {
        monthToFetchLive = endMonthYYYYMM;
    } else {
        // Default to TARGET_MONTH_FOR_LOCAL_DATA if no specific end month, or a more complex date calc for "last month"
        // For simplicity, let's use TARGET_MONTH_FOR_LOCAL_DATA as a fallback if endMonthYYYYMM is not set.
        // A more robust live mode might use getYearMonthString(today, 1) for "last completed month".
        monthToFetchLive = TARGET_MONTH_FOR_LOCAL_DATA;
        console.log(`[Backtester] Live mode: endMonthYYYYMM not specified, defaulting to TARGET_MONTH_FOR_LOCAL_DATA (${monthToFetchLive}) for fetching.`);
    }

    for (let i = 0; i < effectiveStockUniverse.length; i++) {
      const symbol = effectiveStockUniverse[i];
      console.log(`[Backtester] Fetching LIVE data for ${symbol}, month ${monthToFetchLive}, interval ${interval}`);
      const dataForOneMonth = await fetchIntradayData(symbol, monthToFetchLive, interval);
      if (dataForOneMonth && Object.keys(dataForOneMonth).length > 0) {
        allStocksData[symbol] = dataForOneMonth;
        Object.keys(dataForOneMonth).forEach(ts => allUniqueTimestamps.add(ts));
        console.log(`[Backtester] Fetched ${Object.keys(dataForOneMonth).length} live data points for ${symbol} for ${monthToFetchLive}.`);
      } else {
        console.warn(`[Backtester] No live data found or data empty for ${symbol} for ${monthToFetchLive}. It will be excluded.`);
        effectiveStockUniverse = effectiveStockUniverse.filter(s => s !== symbol);
        i--; // Adjust index due to removal
      }
      // Delay between API calls for different symbols in live mode
      if (i < effectiveStockUniverse.length - 1 && effectiveStockUniverse.length > 1) {
         await new Promise(resolve => setTimeout(resolve, 15000)); // Using a fixed 15s delay
      }
    }
  }

  const sortedGlobalTimeline = Array.from(allUniqueTimestamps).sort();
  if (sortedGlobalTimeline.length === 0) {
    console.error("[Backtester] No historical data loaded for any stock in the universe. Cannot proceed.");
    return { trades: [], summary: { totalPL: 0, tradesCount: 0, error: 'No data found for any stock in universe.' } };
  }
  console.log(`[Backtester] Data fetching complete. Unified timeline has ${sortedGlobalTimeline.length} unique timestamps.`);

  // 2. Main Backtesting Loop
  console.log("\n--- Phase 2: Running simulation ---");

  // Ensure initialSymbol has data, otherwise, try to pick first from effectiveStockUniverse
  if (!allStocksData[initialSymbol] || Object.keys(allStocksData[initialSymbol]).length === 0) {
    console.warn(`[Backtester] Data for initialSymbol '${initialSymbol}' not found or empty. Attempting to use first available stock from universe.`);
    initialSymbol = effectiveStockUniverse.find(s => allStocksData[s] && Object.keys(allStocksData[s]).length > 0) || null;
    if (!initialSymbol) {
      console.error("[Backtester] No data available for any stock in the universe. Cannot start simulation.");
      return { trades: [], summary: { totalPL: 0, tradesCount: 0, error: 'No data for any stock to start simulation.'}};
    }
    console.log(`[Backtester] New initialSymbol: ${initialSymbol}`);
  }

  let currentSymbol = initialSymbol;
  let currentTracker = new StockTracker(currentSymbol); // Initialize with the (potentially new) initialSymbol
  let holdingStock = false;
  let buyPrice = 0;
  let buyTimestamp = '';
  // Removed lastScanTime, will attempt scan on every applicable tick if not holding

  for (const timestamp of sortedGlobalTimeline) {
    const tickDataForCurrentSymbol = currentSymbol ? allStocksData[currentSymbol]?.[timestamp] : null;

    if (!holdingStock) {
      if (currentSymbol && tickDataForCurrentSymbol) {
        buyPrice = parseFloat(tickDataForCurrentSymbol['4. close']);
        if (isNaN(buyPrice)) {
          console.warn(`[${currentSymbol}@${timestamp}] Invalid buy price: ${tickDataForCurrentSymbol['4. close']}. Skipping buy.`);
          continue;
        }
        buyTimestamp = timestamp;
        holdingStock = true;
        console.log(`[${currentSymbol}@${timestamp}] --- Portfolio BUY at ${buyPrice} ---`);
        currentTracker.processMinuteData({ ...tickDataForCurrentSymbol, timestamp, close: buyPrice });
      } else if (!currentSymbol) {
        // Not holding and no current symbol, try to find one
        // console.log(`[Timeline@${timestamp}] Currently not holding. Scanning for new stock...`);
        const candidateUniverse = effectiveStockUniverse.filter(s => s && typeof s === 'string');
        if (candidateUniverse.length > 0) {
          const newCandidate = findNewStockCandidate(candidateUniverse, allStocksData); // Pass allStocksData
          if (newCandidate) {
            console.log(`[Timeline@${timestamp}] Scanner found new candidate: ${newCandidate}. Will attempt to buy on next tick.`);
            currentSymbol = newCandidate;
            currentTracker = new StockTracker(currentSymbol);
          } else {
            // console.log(`[Timeline@${timestamp}] Scanner found no new candidate. Will remain without a stock for this tick.`);
            currentSymbol = null; // Explicitly stay null
          }
        } else {
            // console.log(`[Timeline@${timestamp}] No valid stock universe to scan from.`);
        }
      }
    } else { // Holding stock
      if (!tickDataForCurrentSymbol) {
        // console.warn(`[${currentSymbol}@${timestamp}] Data gap for held stock. Holding.`);
        continue;
      }
      const tickPrice = parseFloat(tickDataForCurrentSymbol['4. close']);
      if (isNaN(tickPrice)) {
        console.warn(`[${currentSymbol}@${timestamp}] Invalid tick price in held stock: ${tickDataForCurrentSymbol['4. close']}. Holding.`);
        currentTracker.processMinuteData({ ...tickDataForCurrentSymbol, timestamp, close: tickPrice }); // Let tracker handle it
        continue;
      }
      const signal = currentTracker.processMinuteData({ ...tickDataForCurrentSymbol, timestamp, close: tickPrice });

      if (signal === Signal.SELL) {
        const sellPrice = tickPrice;
        const profitOrLoss = sellPrice - buyPrice;
        trades.push({ symbol: currentSymbol, buyTimestamp, buyPrice, sellTimestamp: timestamp, sellPrice, profitOrLoss });
        console.log(`[${currentSymbol}@${timestamp}] --- Portfolio SELL at ${sellPrice} --- P&L: ${profitOrLoss.toFixed(2)}`);

        const soldSymbol = currentSymbol;
        holdingStock = false;
        currentSymbol = null;
        currentTracker = null;
        buyPrice = 0;
        buyTimestamp = '';

        console.log(`[Timeline@${timestamp}] Sold ${soldSymbol}. Scanning for new stock (excluding ${soldSymbol})...`);
        const candidateUniverse = effectiveStockUniverse.filter(s => s && typeof s === 'string' && s !== soldSymbol);
        if (candidateUniverse.length === 0) {
          console.log(`[Timeline@${timestamp}] No valid stock universe to scan from after selling ${soldSymbol}.`);
          currentSymbol = null;
        } else {
          const newCandidate = findNewStockCandidate(candidateUniverse, allStocksData); // Pass allStocksData
          if (newCandidate) {
            console.log(`[Timeline@${timestamp}] Scanner found new candidate: ${newCandidate}. Will attempt to buy on next tick.`);
            currentSymbol = newCandidate;
            currentTracker = new StockTracker(currentSymbol);
          } else {
            console.log(`[Timeline@${timestamp}] Scanner found no new candidate after selling ${soldSymbol}. Will wait.`);
            currentSymbol = null;
          }
        }
      }
    }
  }

  const totalPL = trades.reduce((sum, trade) => sum + trade.profitOrLoss, 0);
  const summary = {
    mode: ALLOW_LIVE_API_CALLS_FOR_BACKTESTING ? 'Live API' : 'Local Data',
    testedMonth: ALLOW_LIVE_API_CALLS_FOR_BACKTESTING ? (endMonthYYYYMM || TARGET_MONTH_FOR_LOCAL_DATA) : TARGET_MONTH_FOR_LOCAL_DATA,
    initialSymbol: initialSymbol, // This might have changed if original initialSymbol had no data
    stockUniverse: effectiveStockUniverse.join(', '),
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

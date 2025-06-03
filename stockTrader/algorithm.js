// stockTrader/algorithm.js
import { PHI, SELL_OFF_TOLERANCE_FACTOR } from './config.js';

export const StockStatus = {
  IDLE: 'IDLE', // Not currently in a climb, or just sold/reset
  CLIMBING: 'CLIMBING', // Price is consistently >= previous price
  PEAKED_DIPPING: 'PEAKED_DIPPING', // Price dropped below the climb's peak, but not yet below sell threshold
};

export const Signal = {
  HOLD: 'HOLD',
  SELL: 'SELL',
  // We might add BUY later, but the primary focus is the sell logic based on user spec
};

export class StockTracker {
  constructor(symbol) {
    this.symbol = symbol;
    this.status = StockStatus.IDLE;
    this.previousPrice = null;

    this.climbStartPrice = 0;
    this.climbPeakPrice = 0;
    this.climbAccumulatedGainX = 0;
    this.sellDropAmount = 0; // The actual value of x / PHI

    console.log(`StockTracker initialized for ${symbol}`);
  }

  resetClimbState() {
    this.status = StockStatus.IDLE;
    this.climbStartPrice = 0;
    this.climbPeakPrice = 0;
    this.climbAccumulatedGainX = 0;
    this.sellDropAmount = 0;
    // this.previousPrice remains as is, to be used for next comparison.
    console.log(`[${this.symbol}] Climb state reset. Status: ${this.status}`);
  }

  /**
   * Processes a new price tick (minute data).
   * @param {object} priceTick - Object containing { close: number, timestamp: string, ... }
   *                             We primarily use 'close' price. Timestamp for logging.
   * @returns {string} Signal (HOLD, SELL)
   */
  processMinuteData(priceTick) {
    const currentPrice = parseFloat(priceTick.close);
    const timestamp = priceTick.timestamp;

    if (isNaN(currentPrice)) {
      console.warn(`[${this.symbol}@${timestamp}] Invalid current price: ${priceTick.close}. Holding.`);
      return Signal.HOLD;
    }

    if (this.previousPrice === null) {
      this.previousPrice = currentPrice;
      // console.log(`[${this.symbol}@${timestamp}] Initializing previousPrice: ${currentPrice}. Status: ${this.status}. Holding.`);
      return Signal.HOLD;
    }

    let signal = Signal.HOLD;

    // console.log(`[${this.symbol}@${timestamp}] Processing: Current: ${currentPrice}, Previous: ${this.previousPrice}, Status: ${this.status}, Peak: ${this.climbPeakPrice}, X: ${this.climbAccumulatedGainX}, SellDrop: ${this.sellDropAmount}`);

    switch (this.status) {
      case StockStatus.IDLE:
        if (currentPrice >= this.previousPrice) {
          this.status = StockStatus.CLIMBING;
          this.climbStartPrice = this.previousPrice; // Start of the climb is the last stable/lower price
          this.climbPeakPrice = currentPrice;
          this.climbAccumulatedGainX = this.climbPeakPrice - this.climbStartPrice;
          this.sellDropAmount = this.climbAccumulatedGainX * SELL_OFF_TOLERANCE_FACTOR;
          // console.log(`[${this.symbol}@${timestamp}] Status -> CLIMBING. Start: ${this.climbStartPrice}, Peak: ${this.climbPeakPrice}, X: ${this.climbAccumulatedGainX}, SellDrop: ${this.sellDropAmount}`);
        }
        break;

      case StockStatus.CLIMBING:
        if (currentPrice >= this.previousPrice) { // Climb continues
          if (currentPrice > this.climbPeakPrice) { // New peak
            this.climbPeakPrice = currentPrice;
            this.climbAccumulatedGainX = this.climbPeakPrice - this.climbStartPrice;
            this.sellDropAmount = this.climbAccumulatedGainX * SELL_OFF_TOLERANCE_FACTOR;
            // console.log(`[${this.symbol}@${timestamp}] CLIMBING: New peak. Peak: ${this.climbPeakPrice}, X: ${this.climbAccumulatedGainX}, SellDrop: ${this.sellDropAmount}`);
          }
          // else: still climbing but not a new peak, X and sellDropAmount don't change
        } else { // Price dropped, climb is broken
          this.status = StockStatus.PEAKED_DIPPING;
          // console.log(`[${this.symbol}@${timestamp}] Status -> PEAKED_DIPPING. Peak was: ${this.climbPeakPrice}, X was: ${this.climbAccumulatedGainX}`);
          // Check immediate sell condition if gain was positive
          if (this.climbAccumulatedGainX > 0 && currentPrice < (this.climbPeakPrice - this.sellDropAmount)) {
            // console.log(`[${this.symbol}@${timestamp}] PEAKED_DIPPING: SELL triggered. Price ${currentPrice} < ${this.climbPeakPrice - this.sellDropAmount}`);
            signal = Signal.SELL;
            this.resetClimbState();
          }
        }
        break;

      case StockStatus.PEAKED_DIPPING:
        if (this.climbAccumulatedGainX > 0 && currentPrice < (this.climbPeakPrice - this.sellDropAmount)) {
          // console.log(`[${this.symbol}@${timestamp}] PEAKED_DIPPING: SELL triggered. Price ${currentPrice} < ${this.climbPeakPrice - this.sellDropAmount}`);
          signal = Signal.SELL;
          this.resetClimbState();
        } else if (currentPrice >= this.previousPrice && currentPrice > this.climbPeakPrice) {
          // It started climbing again AND made a new absolute peak for this overall climb sequence
          this.status = StockStatus.CLIMBING;
          this.climbPeakPrice = currentPrice; // Update the peak
          this.climbAccumulatedGainX = this.climbPeakPrice - this.climbStartPrice; // Recalculate X based on original climbStartPrice
          this.sellDropAmount = this.climbAccumulatedGainX * SELL_OFF_TOLERANCE_FACTOR;
          // console.log(`[${this.symbol}@${timestamp}] Status -> CLIMBING (Resumed from dip to new peak). Peak: ${this.climbPeakPrice}, X: ${this.climbAccumulatedGainX}, SellDrop: ${this.sellDropAmount}`);
        } else if (currentPrice < this.previousPrice) {
          // Still dipping, but not sold yet. Or, price is flat/slightly up but below original peak.
          // No change in status, just waiting.
          // console.log(`[${this.symbol}@${timestamp}] PEAKED_DIPPING: Still dipping/flat, no sell. Price: ${currentPrice}`);
        }
        // If currentPrice >= this.previousPrice but currentPrice <= this.climbPeakPrice, it means it's ticking up
        // but hasn't recovered to a new high for the *original* climb. We stay in PEAKED_DIPPING,
        // continuing to monitor against the original climb's peak and sellDropAmount.
        break;
    }

    this.previousPrice = currentPrice;
    return signal;
  }
}

// Example Usage (can be uncommented for direct testing if needed)
/*
const tracker = new StockTracker('TEST');
const mockPriceData = [
  { timestamp: '2023-01-01 09:30:00', close: '100.00' }, // Initial
  { timestamp: '2023-01-01 09:31:00', close: '100.00' }, // Idle, price >= prev -> Climb starts
  { timestamp: '2023-01-01 09:32:00', close: '101.00' }, // Climbing, new peak
  { timestamp: '2023-01-01 09:33:00', close: '102.00' }, // Climbing, new peak
  { timestamp: '2023-01-01 09:34:00', close: '103.00' }, // Climbing, new peak (X = 3, Peak=103, Start=100)
  { timestamp: '2023-01-01 09:35:00', close: '102.50' }, // Breaks climb -> Peaked_Dipping. Sell if 102.50 < (103 - 3/PHI) = 103 - 1.85 = 101.15. No sell.
  { timestamp: '2023-01-01 09:36:00', close: '101.50' }, // Peaked_Dipping. Sell if 101.50 < 101.15. No sell.
  { timestamp: '2023-01-01 09:37:00', close: '101.00' }, // Peaked_Dipping. Sell if 101.00 < 101.15. SELL.
  { timestamp: '2023-01-01 09:38:00', close: '101.50' }, // Idle...
  { timestamp: '2023-01-01 09:39:00', close: '102.00' }, // Idle, price >= prev -> Climb starts
];

mockPriceData.forEach(tick => {
  const signal = tracker.processMinuteData(tick);
  console.log(`[${tracker.symbol}@${tick.timestamp}] Price: ${tick.close}, Status: ${tracker.status}, Peak: ${tracker.climbPeakPrice}, X: ${tracker.climbAccumulatedGainX}, SellDrop: ${tracker.sellDropAmount}, Signal: ${signal}`);
});
*/

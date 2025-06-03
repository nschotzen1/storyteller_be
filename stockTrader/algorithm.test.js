// stockTrader/algorithm.test.js
import { StockTracker, StockStatus, Signal } from './algorithm.js'; // Assuming test file is in stockTrader/
import { SELL_OFF_TOLERANCE_FACTOR, PHI } from './config.js'; // Assuming test file is in stockTrader/

describe('StockTracker', () => {
  let tracker;
  const symbol = 'TEST';

  beforeEach(() => {
    tracker = new StockTracker(symbol);
    // Manually set previousPrice for predictable tests after first tick
    // For tests starting from IDLE, it's okay for previousPrice to be null initially.
  });

  test('should initialize with correct default state', () => {
    expect(tracker.symbol).toBe(symbol);
    expect(tracker.status).toBe(StockStatus.IDLE);
    expect(tracker.previousPrice).toBeNull();
    expect(tracker.climbStartPrice).toBe(0);
    expect(tracker.climbPeakPrice).toBe(0);
    expect(tracker.climbAccumulatedGainX).toBe(0);
    expect(tracker.sellDropAmount).toBe(0);
  });

  test('first tick should set previousPrice and return HOLD', () => {
    const signal = tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    expect(tracker.previousPrice).toBe(100);
    expect(signal).toBe(Signal.HOLD);
    expect(tracker.status).toBe(StockStatus.IDLE);
  });

  test('should remain IDLE if price declines on second tick', () => {
    tracker.processMinuteData({ close: '100', timestamp: 'T1' }); // Initial tick
    const signal = tracker.processMinuteData({ close: '99', timestamp: 'T2' });
    expect(signal).toBe(Signal.HOLD);
    expect(tracker.status).toBe(StockStatus.IDLE);
  });

  test('should transition to CLIMBING on price increase', () => {
    tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    tracker.processMinuteData({ close: '101', timestamp: 'T2' });
    expect(tracker.status).toBe(StockStatus.CLIMBING);
    expect(tracker.climbStartPrice).toBe(100);
    expect(tracker.climbPeakPrice).toBe(101);
    expect(tracker.climbAccumulatedGainX).toBe(1);
    expect(tracker.sellDropAmount).toBe(1 * SELL_OFF_TOLERANCE_FACTOR);
  });

  test('should update peak and X while CLIMBING', () => {
    tracker.processMinuteData({ close: '100', timestamp: 'T1' }); // init prevPrice = 100
    tracker.processMinuteData({ close: '101', timestamp: 'T2' }); // status CLIMBING, peak 101, start 100, X=1
    tracker.processMinuteData({ close: '102', timestamp: 'T3' }); // status CLIMBING, peak 102, start 100, X=2
    expect(tracker.status).toBe(StockStatus.CLIMBING);
    expect(tracker.climbPeakPrice).toBe(102);
    expect(tracker.climbAccumulatedGainX).toBe(2);
    expect(tracker.sellDropAmount).toBe(2 * SELL_OFF_TOLERANCE_FACTOR);
  });

  test('should transition to PEAKED_DIPPING if price drops but above threshold', () => {
    // X = 10, Peak = 110, Start = 100. Sell if price < 110 - (10 / PHI) = 110 - 6.18 = 103.82
    tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    tracker.processMinuteData({ close: '110', timestamp: 'T2' }); // Climb X=10
    expect(tracker.climbAccumulatedGainX).toBe(10);
    expect(tracker.sellDropAmount).toBeCloseTo(10 * (1/PHI)); // Approx 6.18

    const signal = tracker.processMinuteData({ close: '105', timestamp: 'T3' }); // Drop to 105
    expect(tracker.status).toBe(StockStatus.PEAKED_DIPPING);
    expect(signal).toBe(Signal.HOLD);
  });

  test('should SELL if price drops below threshold after a climb', () => {
    // X = 10, Peak = 110, Start = 100. Sell if price < 110 - (10 / PHI) approx 103.82
    tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    tracker.processMinuteData({ close: '110', timestamp: 'T2' }); // Climb X=10

    const signal = tracker.processMinuteData({ close: '103', timestamp: 'T3' }); // Drop to 103
    expect(tracker.status).toBe(StockStatus.IDLE); // Reset after sell
    expect(signal).toBe(Signal.SELL);
    expect(tracker.climbAccumulatedGainX).toBe(0); // Check reset
  });

  test('should resume CLIMBING and update peak if price recovers above previous peak from PEAKED_DIPPING', () => {
    // X = 10, Peak = 110, Start = 100. Sell if price < 103.82
    tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    tracker.processMinuteData({ close: '110', timestamp: 'T2' }); // Climb X=10, Peak=110
    tracker.processMinuteData({ close: '105', timestamp: 'T3' }); // PEAKED_DIPPING
    expect(tracker.status).toBe(StockStatus.PEAKED_DIPPING);

    // Recover and make new peak
    const signal = tracker.processMinuteData({ close: '112', timestamp: 'T4' });
    expect(tracker.status).toBe(StockStatus.CLIMBING);
    expect(signal).toBe(Signal.HOLD);
    expect(tracker.climbPeakPrice).toBe(112);
    expect(tracker.climbStartPrice).toBe(100); // Original start price
    expect(tracker.climbAccumulatedGainX).toBe(12);
    expect(tracker.sellDropAmount).toBeCloseTo(12 * SELL_OFF_TOLERANCE_FACTOR);
  });

  test('should remain PEAKED_DIPPING if price recovers but not above previous peak', () => {
    // X = 10, Peak = 110, Start = 100. Sell if price < 103.82
    tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    tracker.processMinuteData({ close: '110', timestamp: 'T2' }); // Climb X=10, Peak=110
    tracker.processMinuteData({ close: '105', timestamp: 'T3' }); // PEAKED_DIPPING
    expect(tracker.status).toBe(StockStatus.PEAKED_DIPPING);

    // Partial recovery but still below original peak
    const signal = tracker.processMinuteData({ close: '108', timestamp: 'T4' });
    expect(tracker.status).toBe(StockStatus.PEAKED_DIPPING); // Stays dipping
    expect(signal).toBe(Signal.HOLD);
    expect(tracker.climbPeakPrice).toBe(110); // Original peak
    expect(tracker.climbStartPrice).toBe(100);
    expect(tracker.climbAccumulatedGainX).toBe(10); // Original X
  });

  test('should handle NaN price input gracefully', () => {
    tracker.processMinuteData({ close: '100', timestamp: 'T1' });
    // Mock console.warn to check if it's called
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const signal = tracker.processMinuteData({ close: 'not-a-number', timestamp: 'T2' });
    expect(signal).toBe(Signal.HOLD);
    expect(tracker.status).toBe(StockStatus.IDLE); // Remains IDLE as no valid price tick processed after first
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid current price'));

    consoleWarnSpy.mockRestore();
  });

  test('should not sell if accumulated gain X is zero', () => {
    tracker.processMinuteData({ close: '100', timestamp: 'T1' }); // previousPrice = 100
    tracker.processMinuteData({ close: '100', timestamp: 'T2' }); // status CLIMBING, peak 100, start 100, X=0
    expect(tracker.status).toBe(StockStatus.CLIMBING);
    expect(tracker.climbAccumulatedGainX).toBe(0);

    const signal = tracker.processMinuteData({ close: '99', timestamp: 'T3' }); // Price drops
    // The status becomes PEAKED_DIPPING because currentPrice < previousPrice, even if X=0.
    // This behavior is fine, as the sell condition specifically checks for X > 0.
    expect(tracker.status).toBe(StockStatus.PEAKED_DIPPING);
    expect(signal).toBe(Signal.HOLD); // Should not sell as sell condition relies on X > 0
  });

});

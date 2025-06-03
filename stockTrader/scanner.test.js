// stockTrader/scanner.test.js
import { analyzeRecentClimbPattern } from './scanner.js';
import { fetchIntradayData } from './dataFetcher.js'; // Import to mock

jest.mock('./dataFetcher.js'); // Automatically mocks fetchIntradayData

const createMockData = (pricesArray) => {
  const data = {};
  pricesArray.forEach((price, i) => {
    // Create timestamps roughly one minute apart for simplicity
    const timestamp = `2023-01-01 00:${String(i).padStart(2, '0')}:00`;
    data[timestamp] = {
      '1. open': String(price), // Mock other fields too for completeness
      '2. high': String(price + 0.5),
      '3. low': String(price - 0.5),
      '4. close': String(price),
      '5. volume': String(1000 + i*10)
    };
  });
  return data;
};

describe('analyzeRecentClimbPattern', () => {
  beforeEach(() => {
    // Clears all instances and calls to constructor and all methods:
    fetchIntradayData.mockClear();
  });

  test('should correctly analyze a clear climb in current and previous 15-min windows', async () => {
    // Prices for 35 minutes: T-34 to T0
    // T-30 to T-15 (previous window): 100 -> 105 (gain = 5)
    // T-15 to T0 (current window): 105 -> 110 (gain = 5)
    const prices = [
      // prices[0] is T-34, prices[4] is T-30 (index for p_T_minus_30 is prices.length - 1 - 30 which is 34-30 = 4)
      // prices[19] is T-15 (index for p_T_minus_15 is prices.length - 1 - 15 which is 34-15 = 19)
      // prices[34] is T0 (index for p_T0 is prices.length - 1 which is 34)
      // So we need at least 31 data points to have index 30 for p_T_minus_30 if using length-1-30
      // The logic is prices[length-1] is T0, prices[length-1-15] is T-15, prices[length-1-30] is T-30
      // For 35 data points (indices 0 to 34):
      // p_T0 = prices[34]
      // p_T_minus_15 = prices[34-15] = prices[19]
      // p_T_minus_30 = prices[34-30] = prices[4]
      ...Array(5).fill(0), // Dummy for T-34 to T-30 to align indices, actual p_T_minus_30 is prices[4]
      100, // prices[4] -> p_T_minus_30
      101, 102, 103, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, // 14 points after p_T_minus_30
      105, // prices[19] -> p_T_minus_15 (gain_previous = 105-100 = 5)
      106, 107, 108, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109, // 14 points after p_T_minus_15
      110  // prices[34] -> p_T0 (gain_current = 110-105 = 5)
    ];
    fetchIntradayData.mockResolvedValue(createMockData(prices));

    const result = await analyzeRecentClimbPattern('TEST');
    expect(fetchIntradayData).toHaveBeenCalledWith('TEST', null, '1min');
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(110);
    expect(result.gain_previous_15min).toBeCloseTo(5); // 105 - 100
    expect(result.gain_current_15min).toBeCloseTo(5);  // 110 - 105
    expect(result.is_currently_climbing).toBe(true);
  });

  test('should detect current climb when previous window was a decline', async () => {
    const prices = [ // 35 points
      ...Array(5).fill(0),
      105, // p_T_minus_30 = prices[4]
      104, 103, 102, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101,
      100, // p_T_minus_15 = prices[19] (gain_previous = 100-105 = -5)
      101, 102, 103, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104,
      105  // p_T0 = prices[34] (gain_current = 105-100 = 5)
    ];
    fetchIntradayData.mockResolvedValue(createMockData(prices));

    const result = await analyzeRecentClimbPattern('TEST');
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(105);
    expect(result.gain_previous_15min).toBeCloseTo(-5);
    expect(result.gain_current_15min).toBeCloseTo(5);
    expect(result.is_currently_climbing).toBe(true);
  });

  test('should detect current decline', async () => {
    const prices = [ // 35 points
      ...Array(5).fill(0),
      100, // p_T_minus_30 = prices[4]
      101, 102, 103, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104,
      105, // p_T_minus_15 = prices[19] (gain_previous = 105-100 = 5)
      104, 103, 102, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101,
      100  // p_T0 = prices[34] (gain_current = 100-105 = -5)
    ];
    fetchIntradayData.mockResolvedValue(createMockData(prices));

    const result = await analyzeRecentClimbPattern('TEST');
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(100);
    expect(result.gain_previous_15min).toBeCloseTo(5);
    expect(result.gain_current_15min).toBeCloseTo(-5);
    expect(result.is_currently_climbing).toBe(false);
  });

  test('should return error for insufficient data (less than 30 points)', async () => {
    const prices = Array(29).fill(100); // Only 29 data points
    fetchIntradayData.mockResolvedValue(createMockData(prices));

    const result = await analyzeRecentClimbPattern('TEST');
    expect(result.error).toMatch(/Insufficient data points/);
    expect(result.is_currently_climbing).toBe(false); // Default on error
  });

  test('should return error if fetchIntradayData returns null', async () => {
    fetchIntradayData.mockResolvedValue(null);

    const result = await analyzeRecentClimbPattern('TEST');
    expect(result.error).toBe('No intraday data returned by fetcher.');
  });

  test('should return error if data contains NaN prices', async () => {
    // Need at least 30 points for the main logic path before NaN check usually.
    // Let's make sure one of the relevant points (T0, T-15, T-30) would be NaN.
    const prices = Array(35).fill(100);
    prices[prices.length - 1 - 15] = NaN; // p_T_minus_15 is NaN
    fetchIntradayData.mockResolvedValue(createMockData(prices));

    const result = await analyzeRecentClimbPattern('TEST');
    // The `prices.some(isNaN)` check should catch this.
    expect(result.error).toBe('Data contains NaN prices.');
  });

  test('should handle flat price scenario correctly', async () => {
    const prices = Array(35).fill(100); // All prices are 100
    fetchIntradayData.mockResolvedValue(createMockData(prices));

    const result = await analyzeRecentClimbPattern('TEST');
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(100);
    expect(result.gain_previous_15min).toBeCloseTo(0);
    expect(result.gain_current_15min).toBeCloseTo(0);
    expect(result.is_currently_climbing).toBe(false); // Gain is not > 0
  });
});

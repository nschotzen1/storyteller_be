// stockTrader/scanner.test.js

import { findNewStockCandidate } from './scanner.js'; // Function to test
// Import analyzeRecentClimbPattern from scannerCore.js for mocking.
// It will be replaced by jest.fn() due to the mock setup below.
import { analyzeRecentClimbPattern as mockedAnalyzeRecentClimbPattern } from './scannerCore.js';
import { NEW_STOCK_CLIMB_PERCENTAGE_MAX, DEFAULT_STOCK_UNIVERSE } from './config.js';

// Mock scannerCore.js to mock its analyzeRecentClimbPattern export
jest.mock('./scannerCore.js', () => ({
  __esModule: true,
  analyzeRecentClimbPattern: jest.fn(),
}));

// Helper function to create mock intraday data (can be shared by both test suites)
const createMockData = (pricesArray) => {
  const data = {};
  pricesArray.forEach((price, i) => {
    const timestamp = `2023-01-01 00:${String(i).padStart(2, '0')}:00`;
    data[timestamp] = {
      '1. open': String(price),
      '2. high': String(price + 0.5),
      '3. low': String(price - 0.5),
      '4. close': String(price),
      '5. volume': String(1000 + i*10)
    };
  });
  return data;
};

// Test suite for the actual implementation of analyzeRecentClimbPattern from scannerCore.js
describe('analyzeRecentClimbPattern from scannerCore.js (Actual Implementation)', () => {
  // Import the actual function for this test suite using jest.requireActual
  const { analyzeRecentClimbPattern: actualAnalyzeRecentClimbPattern } = jest.requireActual('./scannerCore.js');

  test('should correctly analyze a clear climb in current and previous 15-min windows', () => {
    const prices = [
      ...Array(5).fill(0), 100,
      101, 102, 103, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104,
      105,
      106, 107, 108, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109, 109,
      110
    ];
    const mockData = createMockData(prices);
    const result = actualAnalyzeRecentClimbPattern('TEST', mockData);
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(110);
    expect(result.gain_previous_15min).toBeCloseTo(5);
    expect(result.gain_current_15min).toBeCloseTo(5);
    expect(result.is_currently_climbing).toBe(true);
  });

  test('should detect current climb when previous window was a decline', () => {
    const prices = [
      ...Array(5).fill(0), 105,
      104, 103, 102, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101,
      100,
      101, 102, 103, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104,
      105
    ];
    const mockData = createMockData(prices);
    const result = actualAnalyzeRecentClimbPattern('TEST', mockData);
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(105);
    expect(result.gain_previous_15min).toBeCloseTo(-5);
    expect(result.gain_current_15min).toBeCloseTo(5);
    expect(result.is_currently_climbing).toBe(true);
  });

  test('should detect current decline', () => {
    const prices = [
      ...Array(5).fill(0), 100,
      101, 102, 103, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104,
      105,
      104, 103, 102, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101, 101,
      100
    ];
    const mockData = createMockData(prices);
    const result = actualAnalyzeRecentClimbPattern('TEST', mockData);
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(100);
    expect(result.gain_previous_15min).toBeCloseTo(5);
    expect(result.gain_current_15min).toBeCloseTo(-5);
    expect(result.is_currently_climbing).toBe(false);
  });

  test('should return error for insufficient data (less than 30 points)', () => {
    const prices = Array(29).fill(100);
    const mockData = createMockData(prices);
    const result = actualAnalyzeRecentClimbPattern('TEST', mockData);
    expect(result.error).toMatch(/Insufficient data points/);
    expect(result.is_currently_climbing).toBe(false);
  });

  test('should return error if monthIntradayData is null', () => {
    const result = actualAnalyzeRecentClimbPattern('TEST', null);
    expect(result.error).toBe('No intraday data provided.');
  });

  test('should return error if data contains NaN prices', () => {
    const prices = Array(35).fill(100);
    prices[prices.length - 1 - 15] = NaN;
    const mockData = createMockData(prices);
    const result = actualAnalyzeRecentClimbPattern('TEST', mockData);
    expect(result.error).toBe('Provided data contains NaN prices.');
  });

  test('should handle flat price scenario correctly', () => {
    const prices = Array(35).fill(100);
    const mockData = createMockData(prices);
    const result = actualAnalyzeRecentClimbPattern('TEST', mockData);
    expect(result.error).toBeNull();
    expect(result.latest_price).toBe(100);
    expect(result.gain_previous_15min).toBeCloseTo(0);
    expect(result.gain_current_15min).toBeCloseTo(0);
    expect(result.is_currently_climbing).toBe(false);
  });
});


describe('findNewStockCandidate', () => {
  let mockAllStocksMonthData;

  beforeEach(() => {
    // mockedAnalyzeRecentClimbPattern is the jest.fn() from the mock setup
    mockedAnalyzeRecentClimbPattern.mockClear();

    mockAllStocksMonthData = {
      'AAPL': createMockData(Array(35).fill(100)),
      'MSFT': createMockData(Array(35).fill(200)),
      'GOOG': createMockData(Array(35).fill(300)),
    };
  });

  test('should return a candidate if criteria are met for the first stock', () => {
    mockedAnalyzeRecentClimbPattern
      .mockReturnValueOnce({ gain_current_15min: 5, gain_previous_15min: 10, is_currently_climbing: true, latest_price: 105, error: null });

    const result = findNewStockCandidate(['AAPL', 'MSFT'], mockAllStocksMonthData);
    expect(result).toBe('AAPL');
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledTimes(1);
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledWith('AAPL', mockAllStocksMonthData['AAPL']);
  });

  test('should return the first candidate if multiple meet criteria', () => {
    mockedAnalyzeRecentClimbPattern.mockImplementation(symbol => {
        if (symbol === 'AAPL_FAIL') return { gain_current_15min: 10, gain_previous_15min: 1, is_currently_climbing: false, latest_price: 110, error: null };
        if (symbol === 'MSFT') return { gain_current_15min: 2, gain_previous_15min: 10, is_currently_climbing: true, latest_price: 202, error: null };
        if (symbol === 'GOOG') return { gain_current_15min: 1, gain_previous_15min: 5, is_currently_climbing: true, latest_price: 301, error: null };
        return { error: 'Unknown symbol in mock' };
    });

    mockAllStocksMonthData['AAPL_FAIL'] = createMockData(Array(35).fill(100));

    const result = findNewStockCandidate(['AAPL_FAIL','MSFT', 'GOOG'], mockAllStocksMonthData);
    expect(result).toBe('MSFT');
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledWith('AAPL_FAIL', mockAllStocksMonthData['AAPL_FAIL']);
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledWith('MSFT', mockAllStocksMonthData['MSFT']);
    expect(mockedAnalyzeRecentClimbPattern).not.toHaveBeenCalledWith('GOOG', mockAllStocksMonthData['GOOG']);
  });

  test('should return null if no stock meets criteria (all fail ratio)', () => {
    mockedAnalyzeRecentClimbPattern.mockReturnValue({
      gain_current_15min: 6,
      gain_previous_15min: 10,
      is_currently_climbing: true,
      latest_price: 106,
      error: null
    });
    const result = findNewStockCandidate(['AAPL', 'MSFT'], mockAllStocksMonthData);
    expect(result).toBeNull();
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledTimes(2);
  });

  test('should return null if analysis returns error for all stocks', () => {
    mockedAnalyzeRecentClimbPattern.mockReturnValue({ error: 'Test analysis error', gain_current_15min:0, gain_previous_15min:0, is_currently_climbing:false, latest_price:0 });
    const result = findNewStockCandidate(['AAPL', 'MSFT'], mockAllStocksMonthData);
    expect(result).toBeNull();
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledTimes(2);
  });

  test('should return null for an empty stock list', () => {
    const result = findNewStockCandidate([], mockAllStocksMonthData);
    expect(result).toBeNull();
    expect(mockedAnalyzeRecentClimbPattern).not.toHaveBeenCalled();
  });

  test('should skip symbols with no data in allStocksMonthData and return null if none have data', () => {
    const result = findNewStockCandidate(['XYZ', 'ABC'], mockAllStocksMonthData);
    expect(result).toBeNull();
    expect(mockedAnalyzeRecentClimbPattern).not.toHaveBeenCalled();
  });

  test('should skip symbol with no data and pick next valid one', () => {
    mockedAnalyzeRecentClimbPattern.mockImplementation(symbol => {
      if (symbol === 'GOOG') {
        return { gain_current_15min: 1, gain_previous_15min: 5, is_currently_climbing: true, latest_price: 301, error: null };
      }
      return { error: 'Data not mocked for this symbol' };
    });

    const specificMockData = {
        'MSFT': null,
        'GOOG': createMockData(Array(35).fill(300))
    };

    const result = findNewStockCandidate(['MSFT', 'GOOG'], specificMockData);
    expect(result).toBe('GOOG');
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledTimes(1);
    expect(mockedAnalyzeRecentClimbPattern).toHaveBeenCalledWith('GOOG', specificMockData['GOOG']);
  });
});

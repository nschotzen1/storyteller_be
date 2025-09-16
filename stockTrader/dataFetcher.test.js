// stockTrader/dataFetcher.test.js
// Note: Actual import of fetchIntradayData will be done dynamically within tests after mocking config
import fsPromises from 'fs/promises';
import fetch from 'node-fetch'; // This is the actual node-fetch, will be mocked by jest.mock
import path from 'path';
import { fileURLToPath } from 'url';

// Config values will be imported dynamically or via jest.requireActual within tests if needed for assertions.
// We primarily mock them via jest.doMock.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // This will be project_root/stockTrader/

// This MOCK_LOCAL_DATA_DIR should mirror the LOCAL_DATA_DIR in dataFetcher.js
const MOCK_LOCAL_DATA_DIR = path.join(__dirname, 'localData');


jest.mock('fs/promises');
jest.mock('node-fetch');

describe('fetchIntradayData', () => {
  const mockSymbol = 'TEST';
  const mockSpecificMonth = '2023-01'; // A specific month for testing local file load
  const mockInterval = '1min';
  const mockTimeSeriesData = { "2023-01-01 10:00:00": { "4. close": "150.00" } };

  // Path for a specific month's local file
  const specificMonthLocalFilePath = path.join(MOCK_LOCAL_DATA_DIR, `${mockSymbol}_${mockSpecificMonth}_${mockInterval}.json`);

  beforeEach(() => {
    jest.resetModules(); // Crucial for re-importing module with new mocked config
    fsPromises.readFile.mockReset();
    fsPromises.mkdir.mockReset(); // dataFetcher.js doesn't use mkdir, but good practice if it did.
    fetch.mockClear(); // Clear call history for node-fetch mock

    // Default mock for fetch (successful, but no relevant data unless overridden)
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ "Meta Data": "Default mock response" }),
    });
  });

  test('should load data from local file if it exists and live calls disabled (specific month)', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: false,
      ALPHA_VANTAGE_API_KEY: 'TEST_KEY_VALID' // Needs to be valid to pass initial check if any
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');

    fsPromises.readFile.mockResolvedValue(JSON.stringify(mockTimeSeriesData));

    const data = await fetchIntradayData(mockSymbol, mockSpecificMonth, mockInterval);
    expect(fsPromises.readFile).toHaveBeenCalledWith(specificMonthLocalFilePath, 'utf-8');
    expect(data).toEqual(mockTimeSeriesData);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should return null if local file not found and live calls disabled (specific month)', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: false,
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');
    fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });

    const data = await fetchIntradayData(mockSymbol, mockSpecificMonth, mockInterval);
    expect(fsPromises.readFile).toHaveBeenCalledWith(specificMonthLocalFilePath, 'utf-8');
    expect(data).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should return null if local file is corrupted (JSON parse error) and live calls disabled', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: false,
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');
    fsPromises.readFile.mockResolvedValue("invalid json");

    const data = await fetchIntradayData(mockSymbol, mockSpecificMonth, mockInterval);
    expect(fsPromises.readFile).toHaveBeenCalledWith(specificMonthLocalFilePath, 'utf-8');
    expect(data).toBeNull(); // Or specific error object if you change behavior
    expect(fetch).not.toHaveBeenCalled();
  });

  test('given month=null and live calls disabled, should try to load TARGET_MONTH_FOR_LOCAL_DATA', async () => {
    const testTargetMonth = '2023-05'; // Explicitly define for this test
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: false,
      TARGET_MONTH_FOR_LOCAL_DATA: testTargetMonth,
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');

    const targetMonthFilePath = path.join(MOCK_LOCAL_DATA_DIR, `${mockSymbol}_${testTargetMonth}_${mockInterval}.json`);
    fsPromises.readFile.mockResolvedValueOnce(JSON.stringify(mockTimeSeriesData));

    const data = await fetchIntradayData(mockSymbol, null, mockInterval);
    expect(fsPromises.readFile).toHaveBeenCalledWith(targetMonthFilePath, 'utf-8');
    expect(data).toEqual(mockTimeSeriesData);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('should make live API call if local file not found and live calls enabled (specific month)', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: true,
      ALPHA_VANTAGE_API_KEY: 'TEST_KEY_VALID'
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');

    fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ [`Time Series (${mockInterval})`]: mockTimeSeriesData }),
    });

    const data = await fetchIntradayData(mockSymbol, mockSpecificMonth, mockInterval);
    expect(fsPromises.readFile).toHaveBeenCalledWith(specificMonthLocalFilePath, 'utf-8');
    expect(fetch).toHaveBeenCalled();
    const fetchUrl = fetch.mock.calls[0][0];
    expect(fetchUrl).toContain(`symbol=${mockSymbol}`);
    expect(fetchUrl).toContain(`month=${mockSpecificMonth}`);
    expect(fetchUrl).toContain("outputsize=full");
    expect(data).toEqual(mockTimeSeriesData);
  });

  test('should return null if local file not found, live calls enabled, but live call returns API error', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: true,
      ALPHA_VANTAGE_API_KEY: 'TEST_KEY_VALID'
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');

    fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' });
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ "Error Message": "Invalid API call" }),
    });

    const data = await fetchIntradayData(mockSymbol, mockSpecificMonth, mockInterval);
    expect(fsPromises.readFile).toHaveBeenCalledWith(specificMonthLocalFilePath, 'utf-8');
    expect(fetch).toHaveBeenCalled();
    expect(data).toBeNull();
  });

  test('should make live API call for "latest" data (month=null) if live calls enabled', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: true,
      ALPHA_VANTAGE_API_KEY: 'TEST_KEY_VALID'
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ [`Time Series (${mockInterval})`]: mockTimeSeriesData }),
    });

    const data = await fetchIntradayData(mockSymbol, null, mockInterval);
    // Based on current fetchIntradayData logic: if month is null and live calls are enabled,
    // it does NOT attempt a local read with TARGET_MONTH_FOR_LOCAL_DATA first.
    expect(fsPromises.readFile).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalled();
    const fetchUrl = fetch.mock.calls[0][0];
    expect(fetchUrl).toContain(`symbol=${mockSymbol}`);
    expect(fetchUrl).toContain("outputsize=compact");
    expect(fetchUrl).not.toContain("month=");
    expect(data).toEqual(mockTimeSeriesData);
  });

   test('should return null if API key is missing and live call is attempted (specific month)', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: true,
      ALPHA_VANTAGE_API_KEY: 'YOUR_API_KEY_HERE' // Simulate missing key
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');
    fsPromises.readFile.mockRejectedValue({ code: 'ENOENT' }); // Force attempt of live call

    const data = await fetchIntradayData(mockSymbol, mockSpecificMonth, mockInterval);
    expect(data).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

   test('should return null if API key is missing and live call for "latest" is attempted', async () => {
    jest.doMock('./config.js', () => ({
      __esModule: true,
      ...jest.requireActual('./config.js'),
      ALLOW_LIVE_API_CALLS_FOR_BACKTESTING: true,
      ALPHA_VANTAGE_API_KEY: 'YOUR_API_KEY_HERE' // Simulate missing key
    }));
    const { fetchIntradayData } = await import('./dataFetcher.js');

    const data = await fetchIntradayData(mockSymbol, null, mockInterval); // month is null
    expect(data).toBeNull();
    expect(fsPromises.readFile).not.toHaveBeenCalled(); // Should not attempt local read for default month if trying live "latest"
    expect(fetch).not.toHaveBeenCalled();
  });
});

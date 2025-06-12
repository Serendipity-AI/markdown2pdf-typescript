import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';
import { pollConversionStatus } from '../helpers.js';
import { Markdown2PdfError } from '../types.js';
import { M2PDF_TIMEOUTS, M2PDF_POLL_INTERVAL, M2PDF_API_URL } from '../constants.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils.js', () => ({
  withTimeout: jest.fn(),
  sleep: jest.fn(),
  buildUrl: jest.fn(),
}));

const mockedAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;
const mockedAxiosIsAxiosError = axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>;
const mockedWithTimeout = require('../utils.js').withTimeout as jest.MockedFunction<any>;
const mockedSleep = require('../utils.js').sleep as jest.MockedFunction<any>;
const mockedBuildUrl = require('../utils.js').buildUrl as jest.MockedFunction<any>;

describe('pollConversionStatus', () => {
  const mockPath = '/api/conversion/status/test-123';
  const mockStatusUrl = 'https://qa.api.markdown2pdf.ai/api/conversion/status/test-123';
  const mockMetadataUrl = 'https://qa.api.markdown2pdf.ai/api/metadata/test-123';
  const mockDownloadUrl = 'https://cdn.example.com/test.pdf';

  const mockPendingResponse = {
    status: 200,
    data: { status: 'Processing' }
  } as AxiosResponse;

  const mockDoneResponse = {
    status: 200,
    data: { 
      status: 'Done',
      path: mockMetadataUrl
    }
  } as AxiosResponse;

  const mockMetadataResponse = {
    status: 200,
    data: { url: mockDownloadUrl }
  } as AxiosResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedBuildUrl.mockReturnValue(mockStatusUrl);
    mockedWithTimeout.mockImplementation((promise: Promise<any>) => promise);
    mockedSleep.mockResolvedValue(undefined);
    mockedAxiosIsAxiosError.mockReturnValue(false);
    
    // Mock Date.now for timeout testing
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('successful polling', () => {
    it('should return download URL when conversion is immediately done', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)  // Status check
        .mockResolvedValueOnce(mockMetadataResponse);  // Metadata fetch

      const result = await pollConversionStatus(mockPath);

      expect(mockedBuildUrl).toHaveBeenCalledWith(mockPath, M2PDF_API_URL);
      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.REQUEST
      );
      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.METADATA
      );
      expect(mockedAxiosGet).toHaveBeenCalledWith(mockStatusUrl);
      expect(mockedAxiosGet).toHaveBeenCalledWith(mockMetadataUrl);
      expect(result).toBe(mockDownloadUrl);
      expect(mockedSleep).not.toHaveBeenCalled();
    });

    it('should poll multiple times until conversion is done', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce(mockPendingResponse)  // First poll - pending
        .mockResolvedValueOnce(mockPendingResponse)  // Second poll - pending
        .mockResolvedValueOnce(mockDoneResponse)     // Third poll - done
        .mockResolvedValueOnce(mockMetadataResponse); // Metadata fetch

      const result = await pollConversionStatus(mockPath);

      expect(mockedAxiosGet).toHaveBeenCalledTimes(4);
      expect(mockedSleep).toHaveBeenCalledWith(M2PDF_POLL_INTERVAL);
      expect(mockedSleep).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockDownloadUrl);
    });
  });

  describe('timeout handling', () => {
    it('should throw timeout error when polling exceeds timeout limit', async () => {
      const mockDateNow = jest.spyOn(Date, 'now');
      mockDateNow
        .mockReturnValueOnce(1000000)  // Initial time
        .mockReturnValueOnce(1000000 + M2PDF_TIMEOUTS.POLLING + 1000); // Exceed timeout

      mockedAxiosGet.mockResolvedValue(mockPendingResponse);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow(`Status polling timed out after ${M2PDF_TIMEOUTS.POLLING}ms`);
    });

    it('should continue polling if within timeout limit', async () => {
      const mockDateNow = jest.spyOn(Date, 'now');
      mockDateNow
        .mockReturnValueOnce(1000000)  // Initial time
        .mockReturnValueOnce(1000000 + M2PDF_TIMEOUTS.POLLING - 1000)  // Within timeout
        .mockReturnValueOnce(1000000 + M2PDF_TIMEOUTS.POLLING - 1000); // Still within

      mockedAxiosGet
        .mockResolvedValueOnce(mockPendingResponse)  // First poll
        .mockResolvedValueOnce(mockDoneResponse)     // Second poll - done
        .mockResolvedValueOnce(mockMetadataResponse); // Metadata

      const result = await pollConversionStatus(mockPath);
      expect(result).toBe(mockDownloadUrl);
    });
  });

  describe('polling errors', () => {
    it('should throw error on non-200 status response', async () => {
      const errorResponse = { ...mockPendingResponse, status: 500 };
      mockedAxiosGet.mockResolvedValueOnce(errorResponse);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow('Polling error');
    });

    it('should throw error when done but no path provided', async () => {
      const responseWithoutPath = {
        status: 200,
        data: { status: 'Done' }  // Missing path
      } as AxiosResponse;
      
      mockedAxiosGet.mockResolvedValueOnce(responseWithoutPath);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow("Missing 'path' field pointing to final metadata.");
    });

    it('should throw error on metadata fetch failure', async () => {
      const metadataErrorResponse = { ...mockMetadataResponse, status: 404 };
      
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(metadataErrorResponse);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow('Failed to retrieve metadata.');
    });

    it('should throw error when metadata response missing URL', async () => {
      const metadataWithoutUrl = {
        status: 200,
        data: {}  // Missing url field
      } as AxiosResponse;
      
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(metadataWithoutUrl);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow('Missing final download URL in metadata response.');
    });
  });

  describe('network errors', () => {
    it('should throw Markdown2PdfError on axios network error during polling', async () => {
      const networkError = new Error('Network error');
      mockedAxiosIsAxiosError.mockReturnValue(true);
      mockedAxiosGet.mockRejectedValueOnce(networkError);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow('Polling failed: Network error');
    });

    it('should throw Markdown2PdfError on axios network error during metadata fetch', async () => {
      const networkError = new Error('Metadata fetch failed');
      mockedAxiosIsAxiosError.mockReturnValue(true);
      
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)
        .mockRejectedValueOnce(networkError);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow('Polling failed: Metadata fetch failed');
    });

    it('should re-throw non-axios errors', async () => {
      const customError = new Markdown2PdfError('Custom error');
      mockedAxiosIsAxiosError.mockReturnValue(false);
      mockedAxiosGet.mockRejectedValueOnce(customError);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow(customError);
    });
  });

  describe('timeout integration', () => {
    it('should use correct timeout for status requests', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(mockMetadataResponse);

      await pollConversionStatus(mockPath);

      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.REQUEST
      );
    });

    it('should use correct timeout for metadata requests', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(mockMetadataResponse);

      await pollConversionStatus(mockPath);

      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.METADATA
      );
    });

    it('should throw timeout error from withTimeout', async () => {
      const timeoutError = new Error('Request timeout');
      mockedWithTimeout.mockRejectedValueOnce(timeoutError);

      await expect(pollConversionStatus(mockPath))
        .rejects.toThrow(timeoutError);
    });
  });

  describe('URL building', () => {
    it('should build status URL correctly', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(mockMetadataResponse);

      await pollConversionStatus(mockPath);

      expect(mockedBuildUrl).toHaveBeenCalledWith(mockPath, M2PDF_API_URL);
    });
  });

  describe('different status values', () => {
    it('should continue polling for "Processing" status', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce({ status: 200, data: { status: 'Processing' } } as AxiosResponse)
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(mockMetadataResponse);

      const result = await pollConversionStatus(mockPath);

      expect(mockedSleep).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockDownloadUrl);
    });

    it('should continue polling for "Queued" status', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce({ status: 200, data: { status: 'Queued' } } as AxiosResponse)
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(mockMetadataResponse);

      const result = await pollConversionStatus(mockPath);

      expect(mockedSleep).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockDownloadUrl);
    });

    it('should continue polling for any non-"Done" status', async () => {
      mockedAxiosGet
        .mockResolvedValueOnce({ status: 200, data: { status: 'Unknown' } } as AxiosResponse)
        .mockResolvedValueOnce(mockDoneResponse)
        .mockResolvedValueOnce(mockMetadataResponse);

      const result = await pollConversionStatus(mockPath);

      expect(mockedSleep).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockDownloadUrl);
    });
  });
});
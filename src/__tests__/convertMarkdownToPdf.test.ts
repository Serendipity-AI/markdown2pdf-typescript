import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';
import { convertMarkdownToPdf } from '../convertMarkdownToPdf.js';
import { Markdown2PdfError, OfferDetails } from '../types.js';
import { M2PDF_TIMEOUTS, M2PDF_API_URL } from '../constants.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils.js', () => ({
  withTimeout: jest.fn(),
  createConversionPayload: jest.fn(),
}));

// Mock the helper functions
jest.mock('../helpers.js', () => ({
  handlePayment: jest.fn(),
  pollConversionStatus: jest.fn(),
  downloadPdf: jest.fn(),
}));

const mockedAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockedAxiosIsAxiosError = axios.isAxiosError as jest.MockedFunction<typeof axios.isAxiosError>;
const mockedWithTimeout = require('../utils.js').withTimeout as jest.MockedFunction<any>;
const mockedCreateConversionPayload = require('../utils.js').createConversionPayload as jest.MockedFunction<any>;
const mockedHandlePayment = require('../helpers.js').handlePayment as jest.MockedFunction<any>;
const mockedPollConversionStatus = require('../helpers.js').pollConversionStatus as jest.MockedFunction<any>;
const mockedDownloadPdf = require('../helpers.js').downloadPdf as jest.MockedFunction<any>;

describe('convertMarkdownToPdf', () => {
  const mockMarkdown = '# Test Document\n\nThis is a test.';
  const mockPaymentHandler = jest.fn() as any;
  const mockPayload = { markdown: mockMarkdown, title: 'Test', date: 'January 1, 2025' };
  const mockPath = '/api/conversion/path-123';
  const mockDownloadUrl = 'https://cdn.example.com/test.pdf';
  const mockPdfBuffer = Buffer.from('pdf content');

  const mockSuccessResponse = {
    status: 200,
    data: { path: mockPath }
  } as AxiosResponse;

  const mock402Response = {
    status: 402,
    data: {
      offers: [{
        id: 'offer-123',
        amount: 1000,
        currency: 'USD',
        description: 'PDF Conversion'
      }],
      payment_context_token: 'token-456',
      payment_request_url: 'https://api.example.com/payment'
    }
  } as AxiosResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedWithTimeout.mockImplementation((promise: Promise<any>) => promise);
    mockedCreateConversionPayload.mockReturnValue(mockPayload);
    mockedPollConversionStatus.mockResolvedValue(mockDownloadUrl);
    mockedDownloadPdf.mockResolvedValue(mockPdfBuffer);
    mockedHandlePayment.mockResolvedValue(undefined);
    mockedAxiosIsAxiosError.mockReturnValue(false);
    
    // Mock Date methods
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
    jest.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('January 1, 2025');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('input validation', () => {
    it('should throw error for empty markdown', async () => {
      await expect(convertMarkdownToPdf('', { onPaymentRequest: mockPaymentHandler }))
        .rejects.toThrow('Invalid markdown input: must be a non-empty string');
    });

    it('should throw error for non-string markdown', async () => {
      await expect(convertMarkdownToPdf(null as any, { onPaymentRequest: mockPaymentHandler }))
        .rejects.toThrow('Invalid markdown input: must be a non-empty string');
    });

    it('should throw error when no payment handler provided', async () => {
      await expect(convertMarkdownToPdf(mockMarkdown, {}))
        .rejects.toThrow('Payment required but no handler provided.');
    });
  });

  describe('successful conversion flow', () => {
    it('should convert markdown to PDF successfully on first try', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      const result = await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler,
        title: 'Custom Title',
        returnBytes: true
      });

      expect(mockedCreateConversionPayload).toHaveBeenCalledWith(
        mockMarkdown,
        'Custom Title',
        'January 1, 2025'
      );
      expect(mockedAxiosPost).toHaveBeenCalledWith(
        `${M2PDF_API_URL}/v1/markdown`,
        mockPayload
      );
      expect(mockedPollConversionStatus).toHaveBeenCalledWith(mockPath);
      expect(mockedDownloadPdf).toHaveBeenCalledWith(mockDownloadUrl, {
        downloadPath: undefined,
        returnBytes: true
      });
      expect(result).toBe(mockPdfBuffer);
    });

    it('should use default title when not provided', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      expect(mockedCreateConversionPayload).toHaveBeenCalledWith(
        mockMarkdown,
        'Markdown2PDF.ai converted document',
        'January 1, 2025'
      );
    });

    it('should use custom date when provided', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler,
        date: 'December 25, 2024'
      });

      expect(mockedCreateConversionPayload).toHaveBeenCalledWith(
        mockMarkdown,
        'Markdown2PDF.ai converted document',
        'December 25, 2024'
      );
    });

    it('should save to file when downloadPath provided', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);
      mockedDownloadPdf.mockResolvedValue('/path/to/file.pdf');

      const result = await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler,
        downloadPath: '/path/to/file.pdf'
      });

      expect(mockedDownloadPdf).toHaveBeenCalledWith(mockDownloadUrl, {
        downloadPath: '/path/to/file.pdf',
        returnBytes: false
      });
      expect(result).toBe('/path/to/file.pdf');
    });
  });

  describe('payment handling via 402 response', () => {
    it('should handle payment required via 402 response status', async () => {
      mockedAxiosPost
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      const expectedOffer: OfferDetails = {
        offer_id: 'offer-123',
        amount: 1000,
        currency: 'USD',
        description: 'PDF Conversion',
        payment_context_token: 'token-456',
        payment_request_url: 'https://api.example.com/payment'
      };

      expect(mockedHandlePayment).toHaveBeenCalledWith(expectedOffer, mockPaymentHandler);
      expect(mockedAxiosPost).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockPdfBuffer);
    });

    it('should handle payment required via axios error with 402 status', async () => {
      const axios402Error = {
        response: mock402Response,
        message: 'Payment Required'
      };
      mockedAxiosIsAxiosError.mockReturnValue(true);
      
      mockedAxiosPost
        .mockRejectedValueOnce(axios402Error)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      const expectedOffer: OfferDetails = {
        offer_id: 'offer-123',
        amount: 1000,
        currency: 'USD',
        description: 'PDF Conversion',
        payment_context_token: 'token-456',
        payment_request_url: 'https://api.example.com/payment'
      };

      expect(mockedHandlePayment).toHaveBeenCalledWith(expectedOffer, mockPaymentHandler);
      expect(result).toBe(mockPdfBuffer);
    });

    it('should handle offer with empty description', async () => {
      const responseWithoutDescription = {
        ...mock402Response,
        data: {
          ...mock402Response.data,
          offers: [{
            ...mock402Response.data.offers[0],
            description: undefined
          }]
        }
      };

      mockedAxiosPost
        .mockResolvedValueOnce(responseWithoutDescription)
        .mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      expect(mockedHandlePayment).toHaveBeenCalledWith(
        expect.objectContaining({ description: '' }),
        mockPaymentHandler
      );
    });
  });

  describe('error handling', () => {
    it('should throw error on non-200/402 response status', async () => {
      const errorResponse = { ...mockSuccessResponse, status: 500 };
      mockedAxiosPost.mockResolvedValueOnce(errorResponse);

      await expect(convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      })).rejects.toThrow('Initial request failed: 500');
    });

    it('should throw error on axios network error', async () => {
      const networkError = new Error('Network error');
      mockedAxiosIsAxiosError.mockReturnValue(true);
      mockedAxiosPost.mockRejectedValueOnce(networkError);

      await expect(convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      })).rejects.toThrow('Request failed: Network error');
    });

    it('should re-throw non-axios errors', async () => {
      const customError = new Markdown2PdfError('Custom error');
      mockedAxiosIsAxiosError.mockReturnValue(false);
      mockedAxiosPost.mockRejectedValueOnce(customError);

      await expect(convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      })).rejects.toThrow(customError);
    });

    it('should throw timeout error when conversion takes too long', async () => {
      const mockDateNow = jest.spyOn(Date, 'now');
      mockDateNow
        .mockReturnValueOnce(1000000)  // Initial time
        .mockReturnValueOnce(1000000 + M2PDF_TIMEOUTS.POLLING + 1000); // Exceed timeout

      mockedAxiosPost.mockResolvedValue(mock402Response);

      await expect(convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      })).rejects.toThrow(`Conversion timed out after ${M2PDF_TIMEOUTS.POLLING}ms`);
    });

    it('should propagate polling errors', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);
      const pollingError = new Markdown2PdfError('Polling failed');
      mockedPollConversionStatus.mockRejectedValueOnce(pollingError);

      await expect(convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      })).rejects.toThrow(pollingError);
    });

    it('should propagate download errors', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);
      const downloadError = new Markdown2PdfError('Download failed');
      mockedDownloadPdf.mockRejectedValueOnce(downloadError);

      await expect(convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      })).rejects.toThrow(downloadError);
    });
  });

  describe('retry logic', () => {
    it('should retry after successful payment', async () => {
      mockedAxiosPost
        .mockResolvedValueOnce(mock402Response)  // Payment required
        .mockResolvedValueOnce(mock402Response)  // Still payment required
        .mockResolvedValueOnce(mockSuccessResponse); // Finally success

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      expect(mockedAxiosPost).toHaveBeenCalledTimes(3);
      expect(mockedHandlePayment).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple payment rounds within timeout', async () => {
      const mockDateNow = jest.spyOn(Date, 'now');
      mockDateNow
        .mockReturnValueOnce(1000000)  // Initial time
        .mockReturnValueOnce(1000000 + 1000)  // First retry
        .mockReturnValueOnce(1000000 + 2000)  // Second retry
        .mockReturnValueOnce(1000000 + 3000); // Final attempt

      mockedAxiosPost
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mock402Response)
        .mockResolvedValueOnce(mockSuccessResponse);

      const result = await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      expect(mockedHandlePayment).toHaveBeenCalledTimes(2);
      expect(result).toBe(mockPdfBuffer);
    });
  });

  describe('integration with other functions', () => {
    it('should use withTimeout for requests', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.REQUEST
      );
    });

    it('should pass correct parameters to createConversionPayload', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler,
        title: 'Test Title',
        date: 'Custom Date'
      });

      expect(mockedCreateConversionPayload).toHaveBeenCalledWith(
        mockMarkdown,
        'Test Title',
        'Custom Date'
      );
    });

    it('should handle all downloadPdf options correctly', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler,
        downloadPath: '/custom/path.pdf',
        returnBytes: true
      });

      expect(mockedDownloadPdf).toHaveBeenCalledWith(mockDownloadUrl, {
        downloadPath: '/custom/path.pdf',
        returnBytes: true
      });
    });
  });

  describe('date handling', () => {
    it('should generate current date when no date provided', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockSuccessResponse);

      await convertMarkdownToPdf(mockMarkdown, {
        onPaymentRequest: mockPaymentHandler
      });

      expect(Date.prototype.toLocaleDateString).toHaveBeenCalledWith('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    });
  });
});
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';
import { handlePayment } from '../helpers.js';
import { OfferDetails } from '../types.js';
import { M2PDF_TIMEOUTS, M2PDF_POLL_INTERVAL } from '../constants.js';

// Mock dependencies
jest.mock('axios');
jest.mock('../utils.js', () => ({
  withTimeout: jest.fn(),
  sleep: jest.fn(),
}));

const mockedAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;
const mockedWithTimeout = require('../utils.js').withTimeout as jest.MockedFunction<any>;
const mockedSleep = require('../utils.js').sleep as jest.MockedFunction<any>;

describe('handlePayment', () => {
  const mockOffer: OfferDetails = {
    offer_id: 'test-offer-123',
    amount: 1000,
    currency: 'USD',
    description: 'Test PDF conversion',
    payment_context_token: 'test-token-456',
    payment_request_url: 'https://api.example.com/payment',
  };

  const mockInvoiceResponse = {
    status: 200,
    data: {
      payment_request: {
        payment_request: 'lnbc1000n1p0test123...'
      }
    }
  } as AxiosResponse;

  // Use any to avoid TypeScript mock typing issues
  const mockPaymentHandler = jest.fn() as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedWithTimeout.mockImplementation((promise: Promise<any>) => promise);
    mockedSleep.mockResolvedValue(undefined);
    mockPaymentHandler.mockResolvedValue(undefined);
  });

  describe('successful payment flow', () => {
    it('should complete payment flow successfully', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);
      
      await handlePayment(mockOffer, mockPaymentHandler);

      // Verify invoice request
      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.REQUEST
      );
      expect(mockedAxiosPost).toHaveBeenCalledWith(mockOffer.payment_request_url, {
        offer_id: mockOffer.offer_id,
        payment_context_token: mockOffer.payment_context_token,
        payment_method: "lightning"
      });

      // Verify payment request was set
      expect(mockOffer.payment_request).toBe('lnbc1000n1p0test123...');

      // Verify payment handler was called
      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.PAYMENT
      );
      expect(mockPaymentHandler).toHaveBeenCalledWith(mockOffer);

      // Verify sleep was called
      expect(mockedSleep).toHaveBeenCalledWith(M2PDF_POLL_INTERVAL);
    });
  });

  describe('invoice request errors', () => {
    it('should throw Markdown2PdfError on non-200 status', async () => {
      const errorResponse = { ...mockInvoiceResponse, status: 400 };
      mockedAxiosPost.mockResolvedValueOnce(errorResponse);

      await expect(handlePayment(mockOffer, mockPaymentHandler))
        .rejects.toThrow('Failed to fetch invoice: 400');
    });

    it('should throw Markdown2PdfError on network error', async () => {
      const networkError = new Error('Network error');
      mockedAxiosPost.mockRejectedValueOnce(networkError);

      await expect(handlePayment(mockOffer, mockPaymentHandler))
        .rejects.toThrow(networkError);
    });

    it('should throw Markdown2PdfError on timeout during invoice request', async () => {
      const timeoutError = new Error('Request timeout');
      mockedWithTimeout.mockRejectedValueOnce(timeoutError);

      await expect(handlePayment(mockOffer, mockPaymentHandler))
        .rejects.toThrow(timeoutError);
    });
  });

  describe('payment handler errors', () => {
    it('should throw Markdown2PdfError when onPaymentRequest is not provided', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);

      await expect(handlePayment(mockOffer, null as any))
        .rejects.toThrow('Payment required but no handler provided.');
    });

    it('should throw Markdown2PdfError when onPaymentRequest is undefined', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);

      await expect(handlePayment(mockOffer, undefined as any))
        .rejects.toThrow('Payment required but no handler provided.');
    });

    it('should propagate error when payment handler throws', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);
      const paymentError = new Error('Payment failed');
      const failingPaymentHandler = jest.fn() as any;
      failingPaymentHandler.mockRejectedValue(paymentError);

      await expect(handlePayment(mockOffer, failingPaymentHandler))
        .rejects.toThrow(paymentError);
    });

    it('should throw error on timeout during payment handling', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);
      const timeoutError = new Error('Payment timeout');
      
      // First call succeeds (invoice request), second call fails (payment)
      mockedWithTimeout
        .mockResolvedValueOnce(mockInvoiceResponse)
        .mockRejectedValueOnce(timeoutError);

      await expect(handlePayment(mockOffer, mockPaymentHandler))
        .rejects.toThrow(timeoutError);
    });
  });

  describe('offer mutation', () => {
    it('should set payment_request on the offer object', async () => {
      const offerCopy = { ...mockOffer };
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);

      await handlePayment(offerCopy, mockPaymentHandler);

      expect(offerCopy.payment_request).toBe('lnbc1000n1p0test123...');
    });

    it('should preserve existing offer properties', async () => {
      const offerCopy = { ...mockOffer };
      const originalOfferId = offerCopy.offer_id;
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);

      await handlePayment(offerCopy, mockPaymentHandler);

      expect(offerCopy.offer_id).toBe(originalOfferId);
      expect(offerCopy.amount).toBe(mockOffer.amount);
      expect(offerCopy.currency).toBe(mockOffer.currency);
    });
  });

  describe('timeout and sleep behavior', () => {
    it('should use correct timeout values', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);

      await handlePayment(mockOffer, mockPaymentHandler);

      // Check that withTimeout was called with correct timeout values
      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.REQUEST
      );
      expect(mockedWithTimeout).toHaveBeenCalledWith(
        expect.any(Promise),
        M2PDF_TIMEOUTS.PAYMENT
      );
    });

    it('should sleep with correct interval after payment', async () => {
      mockedAxiosPost.mockResolvedValueOnce(mockInvoiceResponse);

      await handlePayment(mockOffer, mockPaymentHandler);

      expect(mockedSleep).toHaveBeenCalledWith(M2PDF_POLL_INTERVAL);
      expect(mockedSleep).toHaveBeenCalledTimes(1);
    });
  });
});
import axios from 'axios';
import { promises as fs } from 'fs';
import { URL } from 'url';
import { Markdown2PdfError } from './errors.js';
import { ConvertToPdfParams, OfferDetails } from './types.js';
import { M2PDF_API_URL, M2PDF_POLL_INTERVAL, M2PDF_TIMEOUTS } from './constants.js';

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const buildUrl = (path: string, baseUrl: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, baseUrl).toString();
};

const timeoutPromise = (ms: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Markdown2PdfError(`Operation timed out after ${ms}ms`)), ms);
  });
};

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([promise, timeoutPromise(ms)]);
};

export async function convertMarkdownToPdf(
  markdown: string,
  options: ConvertToPdfParams = {}
): Promise<string | Buffer> {
  const {
    onPaymentRequest,
    date,
    title = "Markdown2PDF.ai converted document",
    downloadPath,
    returnBytes = false
  } = options;

  // Set default date if not provided
  const currentDate = date || new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const payload = {
    data: {
      text_body: markdown,
      meta: {
        title,
        date: currentDate,
      }
    },
    options: {
      document_name: "converted.pdf"
    }
  };

  // Initial conversion request
  let path: string;
  const startTime = Date.now();
  while (true) {
    try {
      // Check if we've exceeded the total polling timeout
      if (Date.now() - startTime > M2PDF_TIMEOUTS.POLLING) {
        throw new Markdown2PdfError(`Conversion timed out after ${M2PDF_TIMEOUTS.POLLING}ms`);
      }

      const response = await withTimeout(
        axios.post(`${M2PDF_API_URL}/v1/markdown`, payload),
        M2PDF_TIMEOUTS.REQUEST
      );

      if (response.status === 402) {
        const l402Offer = response.data;
        const offerData = l402Offer.offers[0];
        const offer: OfferDetails = {
          offer_id: offerData.id,
          amount: offerData.amount,
          currency: offerData.currency,
          description: offerData.description || "",
          payment_context_token: l402Offer.payment_context_token,
          payment_request_url: l402Offer.payment_request_url
        };

        // Get invoice with timeout
        const invoiceResp = await withTimeout(
          axios.post(offer.payment_request_url, {
            offer_id: offer.offer_id,
            payment_context_token: offer.payment_context_token,
            payment_method: "lightning"
          }),
          M2PDF_TIMEOUTS.REQUEST
        );

        if (invoiceResp.status !== 200) {
          throw new Markdown2PdfError(`Failed to fetch invoice: ${invoiceResp.status}`);
        }

        offer.payment_request = invoiceResp.data.payment_request.payment_request;

        if (!onPaymentRequest) {
          throw new Markdown2PdfError("Payment required but no handler provided.");
        }

        // Handle payment with timeout
        await withTimeout(
          onPaymentRequest(offer),
          M2PDF_TIMEOUTS.PAYMENT
        );

        await sleep(M2PDF_POLL_INTERVAL);
        continue;
      }

      if (response.status !== 200) {
        throw new Markdown2PdfError(`Initial request failed: ${response.status}`);
      }

      path = response.data.path;
      break;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 402) {
          const l402Offer = error.response.data;
          const offerData = l402Offer.offers[0];
          const offer: OfferDetails = {
            offer_id: offerData.id,
            amount: offerData.amount,
            currency: offerData.currency,
            description: offerData.description || "",
            payment_context_token: l402Offer.payment_context_token,
            payment_request_url: l402Offer.payment_request_url
          };

          // Get invoice with timeout
          const invoiceResp = await withTimeout(
            axios.post(offer.payment_request_url, {
              offer_id: offer.offer_id,
              payment_context_token: offer.payment_context_token,
              payment_method: "lightning"
            }),
            M2PDF_TIMEOUTS.REQUEST
          );

          if (invoiceResp.status !== 200) {
            throw new Markdown2PdfError(`Failed to fetch invoice: ${invoiceResp.status}`);
          }

          offer.payment_request = invoiceResp.data.payment_request.payment_request;

          if (!onPaymentRequest) {
            throw new Markdown2PdfError("Payment required but no handler provided.");
          }

          // Handle payment with timeout
          await withTimeout(
            onPaymentRequest(offer),
            M2PDF_TIMEOUTS.PAYMENT
          );

          await sleep(M2PDF_POLL_INTERVAL);
          continue;
        }
        throw new Markdown2PdfError(`Request failed: ${error.message}`);
      }
      throw error;
    }
  }

  // Poll for conversion status
  const statusUrl = buildUrl(path, M2PDF_API_URL);
  let finalDownloadUrl: string;
  const pollStartTime = Date.now();

  while (true) {
    try {
      // Check if we've exceeded the polling timeout
      if (Date.now() - pollStartTime > M2PDF_TIMEOUTS.POLLING) {
        throw new Markdown2PdfError(`Status polling timed out after ${M2PDF_TIMEOUTS.POLLING}ms`);
      }

      const pollResp = await withTimeout(
        axios.get(statusUrl),
        M2PDF_TIMEOUTS.REQUEST
      );

      if (pollResp.status !== 200) {
        throw new Markdown2PdfError("Polling error");
      }

      const pollData = pollResp.data;
      if (pollData.status !== "Done") {
        await sleep(M2PDF_POLL_INTERVAL);
        continue;
      }

      if (!pollData.path) {
        throw new Markdown2PdfError("Missing 'path' field pointing to final metadata.");
      }

      // Get metadata with timeout
      const metadataResp = await withTimeout(
        axios.get(pollData.path),
        M2PDF_TIMEOUTS.METADATA
      );

      if (metadataResp.status !== 200) {
        throw new Markdown2PdfError("Failed to retrieve metadata.");
      }

      if (!metadataResp.data.url) {
        throw new Markdown2PdfError("Missing final download URL in metadata response.");
      }

      finalDownloadUrl = metadataResp.data.url;
      break;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Markdown2PdfError(`Polling failed: ${error.message}`);
      }
      throw error;
    }
  }

  // Download the final PDF
  try {
    const pdfResp = await withTimeout(
      axios.get(finalDownloadUrl, {
        responseType: returnBytes ? 'arraybuffer' : 'stream'
      }),
      M2PDF_TIMEOUTS.DOWNLOAD
    );

    if (pdfResp.status !== 200) {
      throw new Markdown2PdfError("Failed to download final PDF.");
    }

    if (returnBytes) {
      return Buffer.from(pdfResp.data);
    }

    if (downloadPath) {
      await fs.writeFile(downloadPath, pdfResp.data);
      return downloadPath;
    }

    return finalDownloadUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Markdown2PdfError(`Download failed: ${error.message}`);
    }
    throw error;
  }
}
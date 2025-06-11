import axios from 'axios';
import { promises as fs } from 'fs';
import { URL } from 'url';
import { Markdown2PdfError } from './errors.js';
import { ConvertToPdfParams, OfferDetails } from './types.js';
import { M2PDF_API_URL, M2PDF_POLL_INTERVAL } from './constants.js';

const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const buildUrl = (path: string, baseUrl: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, baseUrl).toString();
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
  while (true) {
    try {
      const response = await axios.post(`${M2PDF_API_URL}/v1/markdown`, payload);

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

        // Get invoice
        const invoiceResp = await axios.post(offer.payment_request_url, {
          offer_id: offer.offer_id,
          payment_context_token: offer.payment_context_token,
          payment_method: "lightning"
        });

        if (invoiceResp.status !== 200) {
          throw new Markdown2PdfError(`Failed to fetch invoice: ${invoiceResp.status}`);
        }

        offer.payment_request = invoiceResp.data.payment_request.payment_request;

        if (!onPaymentRequest) {
          throw new Markdown2PdfError("Payment required but no handler provided.");
        }

        await onPaymentRequest(offer);
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

          // Get invoice
          const invoiceResp = await axios.post(offer.payment_request_url, {
            offer_id: offer.offer_id,
            payment_context_token: offer.payment_context_token,
            payment_method: "lightning"
          });

          if (invoiceResp.status !== 200) {
            throw new Markdown2PdfError(`Failed to fetch invoice: ${invoiceResp.status}`);
          }

          offer.payment_request = invoiceResp.data.payment_request.payment_request;

          if (!onPaymentRequest) {
            throw new Markdown2PdfError("Payment required but no handler provided.");
          }

          await onPaymentRequest(offer);
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

  while (true) {
    try {
      const pollResp = await axios.get(statusUrl);
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

      const metadataResp = await axios.get(pollData.path);
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
    const pdfResp = await axios.get(finalDownloadUrl, {
      responseType: returnBytes ? 'arraybuffer' : 'stream'
    });

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
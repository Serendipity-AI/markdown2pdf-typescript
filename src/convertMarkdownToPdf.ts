import axios from 'axios';
import { z } from 'zod';
import { M2PDF_TIMEOUTS, M2PDF_API_URL } from './constants';
import { Markdown2PdfError } from './errors';
import { handlePayment, pollConversionStatus, downloadPdf } from './helpers';
import { ConvertToPdfParams, OfferDetails } from './types';
import { createConversionPayload, withTimeout } from './utils';

export async function convertMarkdownToPdf(
  markdown: string,
  options: ConvertToPdfParams = {}
): Promise<string | Buffer> {
  const { success, data: parsedMarkdown } = z.string().min(1).safeParse(markdown);
  if (!success) throw new Markdown2PdfError('Invalid markdown input: must be a non-empty string');
  
  
  const {
    onPaymentRequest,
    date,
    title = "Markdown2PDF.ai converted document",
    downloadPath,
    returnBytes = false
  } = options;

  if (!onPaymentRequest) throw new Markdown2PdfError("Payment required but no handler provided.");

  const currentDate = date || new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const payload = createConversionPayload(parsedMarkdown, title, currentDate);
  const startTime = Date.now();
  let path: string;

  while (true) {
    try {
      if (Date.now() - startTime > M2PDF_TIMEOUTS.POLLING) throw new Markdown2PdfError(`Conversion timed out after ${M2PDF_TIMEOUTS.POLLING}ms`);

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

        await handlePayment(offer, onPaymentRequest);
        continue;
      }

      if (response.status !== 200) throw new Markdown2PdfError(`Initial request failed: ${response.status}`);

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

          if (!onPaymentRequest) {
            throw new Markdown2PdfError("Payment required but no handler provided.");
          }

          await handlePayment(offer, onPaymentRequest);
          continue;
        }
        throw new Markdown2PdfError(`Request failed: ${error.message}`);
      }
      throw error;
    }
  }

  // Poll for conversion status and get final URL
  const finalDownloadUrl = await pollConversionStatus(path);

  // Download and return the PDF
  return downloadPdf(finalDownloadUrl, { downloadPath, returnBytes });
}
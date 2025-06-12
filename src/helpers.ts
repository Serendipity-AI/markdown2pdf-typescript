import axios from "axios";
import fs from "fs-extra";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Markdown2PdfError } from "./errors.js";
import { OfferDetails } from "./types.js";
import { M2PDF_POLL_INTERVAL, M2PDF_TIMEOUTS } from "./constants.js";
import { sleep, buildUrl, withTimeout } from "./utils.js";

export const handlePayment = async (
  offer: OfferDetails,
  onPaymentRequest: (offer: OfferDetails) => Promise<void>,
): Promise<void> => {
  // Get invoice with timeout
  const invoiceResp = await withTimeout(
    axios.post(offer.payment_request_url, {
      offer_id: offer.offer_id,
      payment_context_token: offer.payment_context_token,
      payment_method: "lightning",
    }),
    M2PDF_TIMEOUTS.REQUEST,
  );

  if (invoiceResp.status !== 200) {
    throw new Markdown2PdfError(`Failed to fetch invoice: ${invoiceResp.status}`);
  }

  offer.payment_request = invoiceResp.data.payment_request.payment_request;

  if (!onPaymentRequest) {
    throw new Markdown2PdfError("Payment required but no handler provided.");
  }

  // Handle payment with timeout
  await withTimeout(onPaymentRequest(offer), M2PDF_TIMEOUTS.PAYMENT);

  await sleep(M2PDF_POLL_INTERVAL);
};

export const pollConversionStatus = async (path: string, apiUrl: string): Promise<string> => {
  const statusUrl = buildUrl(path, apiUrl);
  const pollStartTime = Date.now();

  while (true) {
    try {
      if (Date.now() - pollStartTime > M2PDF_TIMEOUTS.POLLING) {
        throw new Markdown2PdfError(`Status polling timed out after ${M2PDF_TIMEOUTS.POLLING}ms`);
      }

      const pollResp = await withTimeout(axios.get(statusUrl), M2PDF_TIMEOUTS.REQUEST);

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
      const metadataResp = await withTimeout(axios.get(pollData.path), M2PDF_TIMEOUTS.METADATA);

      if (metadataResp.status !== 200) {
        throw new Markdown2PdfError("Failed to retrieve metadata.");
      }

      if (!metadataResp.data.url) {
        throw new Markdown2PdfError("Missing final download URL in metadata response.");
      }

      return metadataResp.data.url;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Markdown2PdfError(`Polling failed: ${error.message}`);
      }
      throw error;
    }
  }
};

export const downloadPdf = async (
  url: string,
  options: { downloadPath?: string; returnBytes?: boolean } = {},
): Promise<string | Buffer> => {
  const { downloadPath, returnBytes } = options;

  try {
    // Determine response type based on options
    let responseType: "stream" | "arraybuffer" = "stream";
    if (returnBytes) {
      responseType = "arraybuffer";
    }

    // Make HTTP request
    const response = await axios.get(url, {
      responseType,
      // Ensure we get the raw response for streaming
      ...(responseType === "stream" ? { responseEncoding: "binary" } : {}),
    });

    // Check HTTP status
    if (response.status !== 200) {
      throw new Markdown2PdfError(`HTTP error: ${response.status}`);
    }

    // Handle returnBytes option
    if (returnBytes) {
      return Buffer.from(response.data);
    }

    // Handle downloadPath option
    if (downloadPath) {
      try {
        if (responseType === "stream") {
          const writer = createWriteStream(downloadPath);
          await pipeline(response.data, writer);
          return downloadPath;
        } else {
          await fs.outputFile(downloadPath, response.data);
          return downloadPath;
        }
      } catch (fileError) {
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        throw new Markdown2PdfError(`Failed to save PDF to ${downloadPath}: ${errorMessage}`);
      }
    }

    // Default behavior: return URL if no specific options
    return url;
  } catch (error: any) {
    // Handle axios errors
    if (error.isAxiosError || error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      throw new Markdown2PdfError(`Network error downloading PDF from ${url}: ${error.message}`);
    }

    // Re-throw Markdown2PdfError instances
    if (error instanceof Markdown2PdfError) {
      throw error;
    }

    // Handle unexpected errors
    throw new Markdown2PdfError(`Unexpected error downloading PDF: ${error.message}`);
  }
};

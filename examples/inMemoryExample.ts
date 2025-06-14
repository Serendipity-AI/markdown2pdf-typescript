import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import type { OfferDetails } from '@serendipityai/markdown2pdf-typescript';

async function pay(offer: OfferDetails) {
  console.log("Pay invoice and press Enter:");
  console.log(offer.payment_request);
  await new Promise(resolve => { process.stdin.once("data", () => resolve(undefined)); });
}

async function main() {
 const pdfBytes = await convertMarkdownToPdf("# Memory use case", { returnBytes: true, onPaymentRequest: pay });
 console.log(`PDF size in memory: ${(pdfBytes as Buffer).length} bytes`);
}

main().catch(console.error); 
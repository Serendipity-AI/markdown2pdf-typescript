import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import type { OfferDetails } from '@serendipityai/markdown2pdf-typescript';

async function pay(offer: OfferDetails) {
  console.log("Paying manually:");
  console.log(offer.payment_request);
  await new Promise(resolve => { process.stdin.once("data", () => resolve(undefined)); });
}

async function main() {
 const path = await convertMarkdownToPdf("# Save this one", { downloadPath: "output.pdf", onPaymentRequest: pay });
 console.log("Saved PDF to:", path);
}

main().catch(console.error); 
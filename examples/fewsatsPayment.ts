import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import type { OfferDetails } from '@serendipityai/markdown2pdf-typescript';
import { Fewsats } from 'fewsats';
// Configure the SDK
const client = new Fewsats({ apiKey: process.env.FEWSATS_API_KEY });

async function pay(offer: OfferDetails) {
  console.log("Paying using Fewsats:");
  console.log(offer);
  
  try {
    // Use the SDK to pay the offer
    const response = await client.payLightning(offer.payment_request, offer.amount, offer.currency, offer.description);

    if (response.success) {
      console.log('Payment successful:', response);
    } else {
      console.log('Payment failed:', response.error);
    }
  } catch (error) {
    console.error('Payment failed:', error.message);
  }

  await new Promise(resolve => { process.stdin.once("data", () => resolve(undefined)); });
}

async function main() {
  const path = await convertMarkdownToPdf("# Save this one using Fewsats", { 
    downloadPath: "output.pdf", 
    onPaymentRequest: pay 
  });
  console.log("Saved PDF to:", path);
}

main().catch(console.error); 
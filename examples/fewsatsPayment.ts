import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import { Fewsats } from 'fewsats';
// Configure the SDK
const client = new Fewsats({ apiKey: process.env.FEWSATS_API_KEY });

async function pay(offer: any) {
  console.log("Paying using Fewsats:");
  
  try {
    // Use the SDK to pay the offer
    const response = await client.payOffer(offer.offer_id, {
      payment_context_token: offer.payment_context_token,
      payment_method: "lightning"
    });

    if (response.status === 'needs_review')
      console.log('Payment needs review:', response);
    else if (response.status === 'success')
      console.log('Payment successful:', response);
    else
      console.log('Payment status:', response.status);
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
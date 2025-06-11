import { convertMarkdownToPdf } from "markdown2pdf-typescript";
import axios from 'axios';

// Configure Alby client
const ALBY_API_URL = 'https://api.getalby.com';
const client = axios.create({
  baseURL: ALBY_API_URL,
  headers: {
    'Authorization': `Bearer ${process.env.ALBY_ACCESS_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

async function pay(offer: any) {
  console.log("Paying using Alby:");
  try {
    // Pay the invoice using Alby's API
    const response = await client.post('/payments/bolt11', {
      payment_request: offer.payment_request
    });

    if (response.status === 200)
      console.log('Payment successful:', response.data);
    else
      console.log('Payment status:', response.status);
  } catch (error) {
    if (axios.isAxiosError(error))
      console.error('Payment failed:', error.response?.data || error.message);
    else
      console.error('Payment failed:', error);
  }
  await new Promise(resolve => { process.stdin.once("data", () => resolve(undefined)); });
}

async function main() {
  const path = await convertMarkdownToPdf("# Save this one using Alby", { 
    downloadPath: "output.pdf", 
    onPaymentRequest: pay 
  });
  console.log("Saved PDF to:", path);
}

main().catch(console.error); 
import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import axios from "axios";

// Constants
const LN_BITS_URL = "https://demo.lnbits.com/api/v1/payments";
const ADMIN_KEY = process.env.LNBITS_ADMIN_KEY as string; // Set in your env

async function pay(offer: any) {
  console.log("Paying using lnbits:");

  try {
    const response = await axios.post(
      LN_BITS_URL,
      {
        out: true,
        bolt11: offer.payment_request
      },
      {
        headers: {
          "X-Api-Key": ADMIN_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Payment successful:", response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Payment failed:", error.response?.data || error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

async function main() {
  const path = await convertMarkdownToPdf("# Save this one using LNbits", {
    downloadPath: "output.pdf",
    onPaymentRequest: pay
  });
  console.log("Saved PDF to:", path);
}

main().catch(console.error);
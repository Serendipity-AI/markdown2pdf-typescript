import { convertMarkdownToPdf } from "markdown2pdf-typescript";

async function pay(offer: any) {
  console.log("⚡ Lightning payment required");
  console.log(`Amount: ${offer.amount} ${offer.currency}`);
  console.log(`Description: ${offer.description}`);
  console.log(`Invoice: ${offer.payment_request}`);
  await new Promise(resolve => { process.stdin.once("data", () => resolve(undefined)); });
}

async function main() {
 const url = await convertMarkdownToPdf("# Hello markdown2pdf", { title: "My document title", date: "5th June 2025", onPaymentRequest: pay });
 console.log("PDF URL:", url);
}

main().catch(console.error); 
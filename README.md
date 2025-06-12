# markdown2pdf-typescript

⚡ Markdown to PDF conversion, for agents. ⚡

**Agents speak Markdown. Humans prefer PDF.
Bridge the gap for the final stage of your agentic workflow.
No sign-ups, no credit cards, just sats for bytes.**

Read the full documentation at [markdown2pdf.ai](https://markdown2pdf.ai)

Here's the output of a markdown file converted to PDF format, showing cover page, table of contents and table support. Our engine is powered by LaTeX rather than HTML to PDF conversion as many other libraries and services use, which results in a much higher quality, print–ready output.

<img src="https://raw.githubusercontent.com/Serendipity-AI/markdown2pdf-python/refs/heads/master/images/examples.png" />

This package provides a TypeScript (Node) client for the markdown2pdf.ai service. You can read full instructions in [our documentation](https://markdown2pdf.ai).

## Installation

Install the package using npm:

```bash
npm install @serendipityai/markdown2pdf-typescript
```

## Usage

### Using the TypeScript (Node) Client

```typescript
import { convertMarkdownToPdf } from "@serendipityai/markdown2pdf-typescript";
import type { OfferDetails } from "@serendipityai/markdown2pdf-typescript";

async function pay(offer: OfferDetails) {
  console.log("⚡ Lightning payment required");
  console.log(`Amount: ${offer.amount} ${offer.currency}`);
  console.log(`Description: ${offer.description}`);
  console.log(`Invoice: ${offer.payment_request}`);
  console.log(`Press ENTER after paying to continue...`);
  await new Promise<void>(resolve => { process.stdin.once("data", () => { resolve(); }); });
}

async function main() {
  const result = await convertMarkdownToPdf("# Hello from Typescript", {
    title: "My document title",
    downloadPath: "output.pdf",
    onPaymentRequest: pay
  });
  console.log("Saved PDF to:", result);
}

main().catch(console.error); 
```

### Using the CLI

You can also use the CLI (provided by the `md2pdf` binary) to convert a markdown file into a PDF. For example, run:

```bash
md2pdf --input test.md --output test_output.pdf --title "My Document Title"
```

This command will prompt you (if a Lightning payment is required) and then save the generated PDF at the specified output path.

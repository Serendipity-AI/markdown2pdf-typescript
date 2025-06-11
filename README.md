# markdown2pdf-typescript

⚡ Markdown to PDF conversion, for agents. ⚡

**Agents speak Markdown. Humans prefer PDF.
Bridge the gap for the final stage of your agentic workflow.
No sign-ups, no credit cards, just sats for bytes.**

Read the full documentation at [markdown2pdf.ai](https://markdown2pdf.ai)

This package provides a TypeScript client for the markdown2pdf.ai service. You can read full instructions in [our documentation](https://markdown2pdf.ai).

## Installation

```bash
npm install markdown2pdf-typescript
```

## Usage

### As a Library

```typescript
import { MarkdownPDF } from 'markdown2pdf-typescript';

async function convertMarkdown() {
  const handlePayment = (offer) => {
    console.log("⚡ Lightning payment required");
    console.log(`Amount: ${offer.amount} ${offer.currency}`);
    console.log(`Description: ${offer.description}`);
    console.log(`Invoice: ${offer.payment_request}`);
    // Handle payment here...
  };

  const client = new MarkdownPDF(undefined, handlePayment);
  const path = await client.convert("# Save this one", {
    title: "My document title",
    downloadPath: "output.pdf"
  });
  console.log("Saved PDF to:", path);
}
```

### As a CLI Tool

```bash
# Convert a markdown file
md2pdf input.md -o output.pdf -t "My Document Title"

# Convert markdown string directly
md2pdf "# Hello World" -o output.pdf

# Use custom date
md2pdf input.md -d "1 January 2024"
```

## Features

- ⚡ Lightning Network payments
- 🎨 High-quality PDF output
- 📝 Support for markdown files and strings
- 🔧 Customizable document title and date
- 📦 Available as both CLI tool and library
- 🔍 TypeScript support

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## License

MIT
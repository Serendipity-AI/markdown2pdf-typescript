export class Markdown2PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Markdown2PdfError";
  }
}

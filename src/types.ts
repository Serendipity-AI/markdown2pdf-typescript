export type OfferDetails = {
  offer_id: string;
  amount: number;
  currency: string;
  description: string;
  payment_context_token: string;
  payment_request_url: string;
  payment_request?: string;
}

export type ConvertToPdfParams = {
  onPaymentRequest?: (offer: OfferDetails) => Promise<void>;
  date?: string;
  title?: string;
  downloadPath?: string;
  returnBytes?: boolean;
};

export class Markdown2PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Markdown2PDFException';
  }
}

export class PaymentRequiredError extends Markdown2PdfError {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRequiredException';
  }
}
export const M2PDF_API_URL = "https://api.markdown2pdf.ai";
export const M2PDF_POLL_INTERVAL = 3000;
export const M2PDF_TIMEOUTS = {
  REQUEST: 10000,
  PAYMENT: 300000,
  POLLING: 300000,
  DOWNLOAD: 60000,
  METADATA: 10000,
} as const;

import { Markdown2PdfError } from './errors.js';
import { URL } from 'url';

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const buildUrl = (path: string, baseUrl: string): string => {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return new URL(path, baseUrl).toString();
};

export const timeoutPromise = (ms: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Markdown2PdfError(`Operation timed out after ${ms}ms`)), ms);
  });
};

export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([promise, timeoutPromise(ms)]);
}; 

type ConversionPayload = {
  data: {
    text_body: string;
    meta: {
      title: string;
      date: string;
    };
  };
  options: {
    document_name: string;
  };
}

export function createConversionPayload(markdown: string, title: string, date: string): ConversionPayload {
  return {
    data: {
      text_body: markdown,
      meta: {
        title,
        date,
      }
    },
    options: {
      document_name: "converted.pdf"
    }
  };
}
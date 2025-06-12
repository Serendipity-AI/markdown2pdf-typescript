import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosResponse } from 'axios';
import { Readable } from 'stream';
import { downloadPdf } from '../helpers.js';
import { Markdown2PdfError } from '../errors.js';

// Mock axios
jest.mock('axios');

// Mock fs-extra and native fs
jest.mock('fs-extra', () => ({
  outputFile: jest.fn()
}));

jest.mock('fs', () => ({
  createWriteStream: jest.fn(() => ({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
    once: jest.fn()
  }))
}));

// Mock stream/promises
jest.mock('stream/promises', () => ({
  pipeline: jest.fn().mockImplementation((source, destination) => Promise.resolve())
}));

const mockedAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

describe('downloadPdf', () => {
  const mockUrl = 'https://example.com/test.pdf';
  const mockDownloadPath = 'test.pdf';
  const mockPdfBuffer = Buffer.from('mock pdf content');
  const mockStream = new Readable({
    read() {
      this.push(mockPdfBuffer);
      this.push(null);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves PDF to file and returns the path', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ 
      status: 200, 
      data: mockStream 
    } as AxiosResponse);

    const result = await downloadPdf(mockUrl, { downloadPath: mockDownloadPath });
    
    expect(mockedAxiosGet).toHaveBeenCalledWith(mockUrl, { 
      responseType: 'stream',
      responseEncoding: 'binary'
    });
    expect(result).toBe(mockDownloadPath);
  });

  it('returns PDF as Buffer', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ 
      status: 200, 
      data: mockPdfBuffer 
    } as AxiosResponse);

    const result = await downloadPdf(mockUrl, { returnBytes: true });
    
    expect(mockedAxiosGet).toHaveBeenCalledWith(mockUrl, { 
      responseType: 'arraybuffer'
    });
    expect(result).toEqual(mockPdfBuffer);
  });

  it('returns URL if no options provided', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ 
      status: 200, 
      data: mockStream 
    } as AxiosResponse);

    const result = await downloadPdf(mockUrl, {});
    
    expect(mockedAxiosGet).toHaveBeenCalledWith(mockUrl, { 
      responseType: 'stream',
      responseEncoding: 'binary'
    });
    expect(result).toBe(mockUrl);
  });

  it('throws Markdown2PdfError on HTTP error', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ 
      status: 404, 
      data: {} 
    } as AxiosResponse);

    await expect(downloadPdf(mockUrl, { downloadPath: mockDownloadPath }))
      .rejects.toThrow(Markdown2PdfError);
  });

  it('throws Markdown2PdfError on network error', async () => {
    const networkError = new Error('Network error');
    (networkError as any).isAxiosError = true;
    mockedAxiosGet.mockRejectedValueOnce(networkError);

    await expect(downloadPdf(mockUrl, { downloadPath: mockDownloadPath }))
      .rejects.toThrow(Markdown2PdfError);
  });

  it('throws Markdown2PdfError on file write error', async () => {
    mockedAxiosGet.mockResolvedValueOnce({ 
      status: 200, 
      data: mockStream 
    } as AxiosResponse);

    const { pipeline } = require('stream/promises');
    pipeline.mockRejectedValueOnce(new Error('File write error'));

    await expect(downloadPdf(mockUrl, { downloadPath: mockDownloadPath }))
      .rejects.toThrow(Markdown2PdfError);
  });
});
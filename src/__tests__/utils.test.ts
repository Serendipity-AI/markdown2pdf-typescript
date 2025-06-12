import { describe, it, expect } from '@jest/globals';
import { withTimeout, timeoutPromise, buildUrl } from '../utils.js';
import { Markdown2PdfError } from '../errors.js';

describe('withTimeout', () => {
  it('resolves if promise resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve('ok'), 100);
    expect(result).toBe('ok');
  });

  it('rejects if promise rejects before timeout', async () => {
    await expect(withTimeout(Promise.reject(new Error('fail')), 100)).rejects.toThrow('fail');
  });

  it('rejects with Markdown2PdfError if timeout is reached', async () => {
    const slowPromise = new Promise(resolve => setTimeout(resolve, 200));
    await expect(withTimeout(slowPromise, 50)).rejects.toThrow(Markdown2PdfError);
  });
});

describe('timeoutPromise', () => {
  it('rejects with Markdown2PdfError after timeout', async () => {
    await expect(timeoutPromise(10)).rejects.toThrow(Markdown2PdfError);
  });
});

describe('buildUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(buildUrl('https://foo.com/bar', 'https://api.example.com')).toBe('https://foo.com/bar');
  });
  it('combines relative path with base URL', () => {
    expect(buildUrl('/v1/test', 'https://api.example.com')).toBe('https://api.example.com/v1/test');
  });
  it('handles paths without leading slash', () => {
    expect(buildUrl('v1/test', 'https://api.example.com')).toBe('https://api.example.com/v1/test');
  });
}); 
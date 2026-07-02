import { describe, expect, it } from 'vitest';
import { applyStaticResponseHeaders } from './staticResponseHeaders.js';

describe('applyStaticResponseHeaders', () => {
  it('forces HTML responses to be revalidated from the Compute worker', () => {
    const headers = applyStaticResponseHeaders(new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }), { isHtml: true });

    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('Surrogate-Control')).toBe('no-store');
    expect(headers.get('Vary')).toContain('X-Original-Host');
  });

  it('preserves cache headers for hashed static assets', () => {
    const headers = applyStaticResponseHeaders(new Headers({
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }), { isHtml: false });

    expect(headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(headers.get('Surrogate-Control')).toBeNull();
    expect(headers.get('Vary')).toContain('X-Original-Host');
  });

  it('strips compression-coupled headers when the body was decoded for rewriting', () => {
    // Regression for #435: feed injection reads the body back as a plain string, so the
    // returned bytes are identity-encoded and must not advertise the original br/gzip.
    const headers = applyStaticResponseHeaders(new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Encoding': 'br',
      'Content-Length': '18641',
      'ETag': '"abc123"',
    }), { isHtml: true, decoded: true });

    expect(headers.get('Content-Encoding')).toBeNull();
    expect(headers.get('Content-Length')).toBeNull();
    expect(headers.get('ETag')).toBeNull();
    expect(headers.get('Cache-Control')).toBe('no-store');
  });

  it('keeps Content-Encoding intact when the body is passed through untouched', () => {
    const headers = applyStaticResponseHeaders(new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Encoding': 'br',
    }), { isHtml: true });

    expect(headers.get('Content-Encoding')).toBe('br');
  });
});

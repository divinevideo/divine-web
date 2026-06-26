import { describe, expect, it } from 'vitest';
import { applyStaticResponseHeaders } from './staticResponseHeaders.js';

describe('applyStaticResponseHeaders', () => {
  it('forces HTML responses to be revalidated from the Compute worker', () => {
    const headers = applyStaticResponseHeaders(new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    }), { isHtml: true });

    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('Vary')).toContain('X-Original-Host');
  });

  it('preserves cache headers for hashed static assets', () => {
    const headers = applyStaticResponseHeaders(new Headers({
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }), { isHtml: false });

    expect(headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(headers.get('Vary')).toContain('X-Original-Host');
  });
});

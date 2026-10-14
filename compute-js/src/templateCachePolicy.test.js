import { describe, expect, it } from 'vitest';

import {
  createEdgeTemplateHeaders,
  HOST_DEPENDENT_CRAWLER_VARY,
} from './templateCachePolicy.js';

describe('edge template cache policy', () => {
  it('separates crawler responses from browser responses by default', () => {
    const headers = createEdgeTemplateHeaders({ cacheControl: 'public, max-age=60' });

    expect(headers.get('Vary')).toBe('X-Original-Host, User-Agent');
    expect(headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(headers.get('X-Divine-Edge')).toBe('template');
  });

  it('does not vary bare vanity profiles by user agent', () => {
    const headers = createEdgeTemplateHeaders({
      cacheControl: 'public, max-age=60',
      subdomain: 'creator',
      varyByUserAgent: false,
    });

    expect(headers.get('Vary')).toBe('X-Original-Host');
    expect(headers.get('X-Divine-Subdomain')).toBe('creator');
  });

  it('varies host-dependent crawler responses by host and user agent', () => {
    expect(HOST_DEPENDENT_CRAWLER_VARY).toBe('X-Original-Host, User-Agent');
  });
});

import { describe, expect, it } from 'vitest';
import { buildWwwRedirectResponse } from './hostRedirect.js';

describe('buildWwwRedirectResponse', () => {
  it('redirects a real www request to the apex host without caching the redirect', () => {
    const response = buildWwwRedirectResponse(new URL('https://www.divine.video/kids?x=1'), 'www.divine.video');

    expect(response?.status).toBe(301);
    expect(response?.headers.get('Location')).toBe('https://divine.video/kids?x=1');
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(response?.headers.get('Vary')).toContain('X-Original-Host');
    expect(response?.headers.get('Vary')).toContain('X-Forwarded-Host');
  });

  it('does not emit a self-redirect when forwarded host metadata already resolves to the current URL', () => {
    const response = buildWwwRedirectResponse(new URL('https://divine.video/'), 'www.divine.video');

    expect(response).toBeNull();
  });

  it('does not redirect non-www hosts', () => {
    const response = buildWwwRedirectResponse(new URL('https://divine.video/'), 'divine.video');

    expect(response).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { buildAccountPortabilityRedirectResponse, buildWwwRedirectResponse } from './hostRedirect.js';

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

describe('buildAccountPortabilityRedirectResponse', () => {
  it('redirects to /exit on the forwarded host and keeps the query string', () => {
    const response = buildAccountPortabilityRedirectResponse(
      new URL('https://origin.example/account-portability?ref=email'),
      'divine.video',
    );

    expect(response?.status).toBe(301);
    expect(response?.headers.get('Location')).toBe('https://divine.video/exit?ref=email');
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(response?.headers.get('Vary')).toContain('X-Original-Host');
    expect(response?.headers.get('Vary')).toContain('X-Forwarded-Host');
  });

  it('redirects the trailing-slash form', () => {
    const response = buildAccountPortabilityRedirectResponse(
      new URL('https://dvine.video/account-portability/'),
      'dvine.video',
    );

    expect(response?.status).toBe(301);
    expect(response?.headers.get('Location')).toBe('https://dvine.video/exit');
  });

  it('does not redirect other paths', () => {
    for (const path of ['/exit', '/account-portability/extra', '/account-portabilityx']) {
      expect(buildAccountPortabilityRedirectResponse(new URL(`https://divine.video${path}`), 'divine.video')).toBeNull();
    }
  });

  it('takes a www request to the apex in one hop, then to /exit in one more', () => {
    const www = buildWwwRedirectResponse(new URL('https://www.divine.video/account-portability?x=1'), 'www.divine.video');
    expect(www?.headers.get('Location')).toBe('https://divine.video/account-portability?x=1');
    const next = buildAccountPortabilityRedirectResponse(new URL(www.headers.get('Location')), 'divine.video');
    expect(next?.headers.get('Location')).toBe('https://divine.video/exit?x=1');
  });
});

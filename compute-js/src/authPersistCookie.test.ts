import { describe, expect, it } from 'vitest';

import { cookieDomainFor, handleAuthPersistCookie } from './authPersistCookie.js';

function jsonRequest(method: string, body: unknown): Request {
  return new Request('https://divine.video/api/auth/persist-cookie', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('cookieDomainFor', () => {
  it('returns .divine.video for apex and subdomains', () => {
    expect(cookieDomainFor('divine.video')).toBe('.divine.video');
    expect(cookieDomainFor('alice.divine.video')).toBe('.divine.video');
    expect(cookieDomainFor('Alice.Divine.Video')).toBe('.divine.video');
    expect(cookieDomainFor('divine.video:443')).toBe('.divine.video');
  });

  it('returns .dvines.org for staging', () => {
    expect(cookieDomainFor('dvines.org')).toBe('.dvines.org');
    expect(cookieDomainFor('staging.dvines.org')).toBe('.dvines.org');
  });

  it('returns null for unknown hosts', () => {
    expect(cookieDomainFor('localhost')).toBeNull();
    expect(cookieDomainFor('example.com')).toBeNull();
    expect(cookieDomainFor('')).toBeNull();
  });
});

describe('handleAuthPersistCookie', () => {
  it('sets divine_jwt cookie with Domain=.divine.video', async () => {
    const value = btoa(JSON.stringify({ token: 'eyJ.x' }));
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'divine_jwt', value, maxAge: 86400 }),
      'alice.divine.video',
    );
    expect(res.status).toBe(204);
    const setCookie = res.headers.get('Set-Cookie')!;
    expect(setCookie).toContain(`divine_jwt=${value}`);
    expect(setCookie).toContain('Domain=.divine.video');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=86400');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Secure');
  });

  it('sets nostr_login cookie with .dvines.org for staging', async () => {
    const value = btoa('xx');
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'nostr_login', value, maxAge: 60 * 60 * 24 * 365 }),
      'staging.dvines.org',
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('Set-Cookie')).toContain('Domain=.dvines.org');
  });

  it('emits a Max-Age=0 cookie on DELETE', async () => {
    const res = await handleAuthPersistCookie(
      jsonRequest('DELETE', { name: 'divine_jwt' }),
      'divine.video',
    );
    expect(res.status).toBe(204);
    const setCookie = res.headers.get('Set-Cookie')!;
    expect(setCookie).toMatch(/^divine_jwt=; /);
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('Domain=.divine.video');
  });

  it('rejects unknown cookie names', async () => {
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'admin_token', value: btoa('x'), maxAge: 60 }),
      'divine.video',
    );
    expect(res.status).toBe(403);
  });

  it('rejects non-base64 values', async () => {
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'divine_jwt', value: 'not;base64!', maxAge: 60 }),
      'divine.video',
    );
    expect(res.status).toBe(400);
  });

  it('rejects values that exceed the size cap', async () => {
    const value = 'A'.repeat(4000);
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'divine_jwt', value, maxAge: 60 }),
      'divine.video',
    );
    expect(res.status).toBe(400);
  });

  it('rejects unsupported methods', async () => {
    const res = await handleAuthPersistCookie(
      new Request('https://divine.video/api/auth/persist-cookie', { method: 'GET' }),
      'divine.video',
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST, DELETE');
  });

  it('rejects requests on hosts without a known cross-subdomain domain', async () => {
    const value = btoa('x');
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'divine_jwt', value, maxAge: 60 }),
      'localhost',
    );
    expect(res.status).toBe(400);
  });

  it('rejects malformed JSON', async () => {
    const res = await handleAuthPersistCookie(
      jsonRequest('POST', '{not json'),
      'divine.video',
    );
    expect(res.status).toBe(400);
  });

  it('caps maxAge at 1 year and falls back to a default when missing', async () => {
    const value = btoa('y');

    const tooBig = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'divine_jwt', value, maxAge: 60 * 60 * 24 * 365 * 2 }),
      'divine.video',
    );
    expect(tooBig.status).toBe(204);
    expect(tooBig.headers.get('Set-Cookie')).toContain(`Max-Age=${60 * 60 * 24 * 7}`);

    const missing = await handleAuthPersistCookie(
      jsonRequest('POST', { name: 'nostr_login', value }),
      'divine.video',
    );
    expect(missing.status).toBe(204);
    expect(missing.headers.get('Set-Cookie')).toContain(`Max-Age=${60 * 60 * 24 * 365}`);
  });

  it('sets Cache-Control: no-store on responses', async () => {
    const res = await handleAuthPersistCookie(
      jsonRequest('DELETE', { name: 'nostr_login' }),
      'divine.video',
    );
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

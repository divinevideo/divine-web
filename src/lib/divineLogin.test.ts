import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import {
  buildSecureAccountRedirect,
  buildSignupRedirect,
  exchangeDivineLoginCallback,
  parseDivineLoginCallback,
} from './divineLogin';

const fetchMock = vi.fn<typeof fetch>();
const originalLocation = window.location;

function createNsec() {
  return nip19.nsecEncode(generateSecretKey());
}

function setLocation(url: string) {
  Object.defineProperty(window, 'location', {
    value: new URL(url),
    writable: true,
    configurable: true,
  });
}

describe('divineLogin', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    setLocation('https://divine.video/home');
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('builds a signup redirect URL for login.divine.video', () => {
    const redirect = buildSignupRedirect({ returnPath: '/messages' });

    expect(redirect.url).toContain('https://login.divine.video/oauth/start');
    expect(redirect.url).toContain('mode=signup');
    expect(redirect.url).toContain(encodeURIComponent('https://divine.video/auth/callback'));
    expect(redirect.state).toBeTruthy();
  });

  it('builds a secure-account redirect without placing the nsec in the URL', () => {
    const nsec = createNsec();
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Expected a valid nsec');
    }

    const redirect = buildSecureAccountRedirect(nsec, { returnPath: '/settings/linked-accounts' });

    expect(redirect.url).toContain('https://login.divine.video/oauth/start');
    expect(redirect.url).toContain(`byok_pubkey=${getPublicKey(decoded.data)}`);
    expect(redirect.url).not.toContain(nsec);
    expect(sessionStorage.getItem(`divine:secure-account:${redirect.state}`)).toContain(nsec);
  });

  it('parses callback query parameters from the login redirect', () => {
    expect(parseDivineLoginCallback(
      'https://divine.video/auth/callback?code=test-code&state=test-state&return_path=%2Fmessages',
    )).toMatchObject({
      code: 'test-code',
      state: 'test-state',
      returnPath: '/messages',
    });
  });

  it('exchanges callback codes for a bunker login payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        token: 'jwt-token',
        email: 'person@example.com',
        pubkey: 'pubkey-123',
        bunker_uri: 'bunker://pubkey?relay=wss://relay.example.com&secret=test',
        return_path: '/home',
      }),
    } as Response);

    await expect(exchangeDivineLoginCallback({
      code: 'test-code',
      state: 'test-state',
    }, fetchMock)).resolves.toEqual({
      token: 'jwt-token',
      email: 'person@example.com',
      pubkey: 'pubkey-123',
      bunkerUri: 'bunker://pubkey?relay=wss://relay.example.com&secret=test',
      returnPath: '/home',
    });
  });
});

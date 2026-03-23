import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

import {
  buildLoginRedirect,
  buildSecureAccountRedirect,
  buildSignupRedirect,
  exchangeDivineLoginCallback,
  parseDivineLoginCallback,
} from './divineLogin';

const fetchMock = vi.fn<typeof fetch>();
const originalLocation = window.location;
const RETURN_PATH_PREFIX = 'divine:return-path:';

/** jsdom may not implement localStorage; provide a minimal in-memory fallback. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.get(key) ?? null; },
    key(index: number) { return [...store.keys()][index] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, value); },
  };
}

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
    // jsdom may not provide a working localStorage; stub with in-memory storage.
    if (typeof localStorage?.clear !== 'function') {
      vi.stubGlobal('localStorage', createMemoryStorage());
    } else {
      localStorage.clear();
    }
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

  it('builds a signup redirect URL for the published divine login oauth flow', async () => {
    const redirect = await buildSignupRedirect({ returnPath: '/messages' });
    const url = new URL(redirect.url);

    expect(`${url.origin}${url.pathname}`).toBe('https://login.divine.video/api/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('divine-web');
    expect(url.searchParams.get('redirect_uri')).toBe('https://divine.video/auth/callback');
    expect(url.searchParams.get('default_register')).toBe('true');
    expect(url.searchParams.get('state')).toBe(redirect.state);
    expect(localStorage.getItem(`${RETURN_PATH_PREFIX}${redirect.state}`)).toBe('/messages');
  });

  it('builds an existing-account login redirect without forcing register mode', async () => {
    const redirect = await buildLoginRedirect({ returnPath: '/messages' });
    const url = new URL(redirect.url);

    expect(`${url.origin}${url.pathname}`).toBe('https://login.divine.video/api/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('divine-web');
    expect(url.searchParams.get('redirect_uri')).toBe('https://divine.video/auth/callback');
    expect(url.searchParams.get('default_register')).toBeNull();
    expect(url.searchParams.get('state')).toBe(redirect.state);
    expect(localStorage.getItem(`${RETURN_PATH_PREFIX}${redirect.state}`)).toBe('/messages');
  });

  it('builds a secure-account redirect without placing the nsec in the URL', async () => {
    const nsec = createNsec();
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Expected a valid nsec');
    }

    const redirect = await buildSecureAccountRedirect(nsec, { returnPath: '/settings/linked-accounts' });
    const url = new URL(redirect.url);

    expect(`${url.origin}${url.pathname}`).toBe('https://login.divine.video/api/oauth/authorize');
    expect(url.searchParams.get('byok_pubkey')).toBe(getPublicKey(decoded.data));
    expect(url.searchParams.get('default_register')).toBe('true');
    expect(redirect.url).not.toContain(nsec);
    expect(localStorage.getItem(`${RETURN_PATH_PREFIX}${redirect.state}`)).toBe('/settings/linked-accounts');
    expect(localStorage.getItem(`divine:secure-account:${redirect.state}`)).toBeNull();
  });

  it('parses callback query parameters from the login redirect', () => {
    localStorage.setItem(`${RETURN_PATH_PREFIX}test-state`, '/messages');

    expect(parseDivineLoginCallback(
      'https://divine.video/auth/callback?code=test-code&state=test-state&return_path=%2Fmessages',
    )).toMatchObject({
      code: 'test-code',
      state: 'test-state',
      returnPath: '/messages',
    });
  });

  it('exchanges callback codes through the published divine login client contract', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bunker_url: 'bunker://pubkey?relay=wss://relay.example.com&secret=test',
        access_token: 'jwt-token',
        authorization_handle: 'auth-handle',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    } as Response);
    const redirect = await buildSignupRedirect({ returnPath: '/home' });

    await expect(exchangeDivineLoginCallback({
      code: 'test-code',
      state: redirect.state,
    }, fetchMock)).resolves.toEqual({
      token: 'jwt-token',
      bunkerUri: 'bunker://pubkey?relay=wss://relay.example.com&secret=test',
      returnPath: '/home',
      authorizationHandle: 'auth-handle',
      expiresIn: 3600,
      refreshToken: 'refresh-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://login.divine.video/api/oauth/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const [, options] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(options?.body))).toMatchObject({
      grant_type: 'authorization_code',
      code: 'test-code',
      client_id: 'divine-web',
      redirect_uri: 'https://divine.video/auth/callback',
    });
  });
});

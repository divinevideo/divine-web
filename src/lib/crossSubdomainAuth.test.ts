import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCookieDomain, getLoginCookie, setLoginCookie, clearLoginCookie, hydrateLoginFromCookie, setJwtCookie, getJwtCookie, clearJwtCookie } from './crossSubdomainAuth';

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

const originalLocation = window.location;
let cookieJar = '';
const originalCookieDescriptor = Object.getOwnPropertyDescriptor(document, 'cookie') ??
  Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!;

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, hostname },
    writable: true,
    configurable: true,
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieJar = '';
  Object.defineProperty(document, 'cookie', {
    get: () => cookieJar,
    set: (v: string) => {
      if (v.includes('max-age=0')) {
        // Remove the cookie by name
        const name = v.split('=')[0];
        const existing = cookieJar.split('; ').filter(c => !c.startsWith(name + '='));
        cookieJar = existing.filter(Boolean).join('; ');
      } else {
        const name = v.split('=')[0];
        const existing = cookieJar.split('; ').filter(c => !c.startsWith(name + '='));
        const newValue = v.split(';')[0]; // just name=value part
        existing.push(newValue);
        cookieJar = existing.filter(Boolean).join('; ');
      }
    },
    configurable: true,
  });

  localStorageMock.clear();
  setHostname('divine.video');

  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true, configurable: true });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document, 'cookie', originalCookieDescriptor);
});

describe('getCookieDomain', () => {
  it('returns .divine.video for divine.video', () => {
    setHostname('divine.video');
    expect(getCookieDomain()).toBe('.divine.video');
  });

  it('returns .divine.video for sub.divine.video', () => {
    setHostname('alice.divine.video');
    expect(getCookieDomain()).toBe('.divine.video');
  });

  it('returns .dvines.org for dvines.org', () => {
    setHostname('dvines.org');
    expect(getCookieDomain()).toBe('.dvines.org');
  });

  it('returns .dvines.org for sub.dvines.org', () => {
    setHostname('relay.staging.dvines.org');
    expect(getCookieDomain()).toBe('.dvines.org');
  });

  it('returns null for localhost', () => {
    setHostname('localhost');
    expect(getCookieDomain()).toBeNull();
  });
});

describe('getLoginCookie', () => {
  it('returns null when no cookie exists', () => {
    expect(getLoginCookie()).toBeNull();
  });

  it('parses a valid cookie', () => {
    const data = { type: 'extension' as const, pubkey: 'abc123' };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;
    expect(getLoginCookie()).toEqual(data);
  });

  it('returns null for invalid/corrupted cookie data', () => {
    cookieJar = 'nostr_login=not-valid-base64!!!';
    expect(getLoginCookie()).toBeNull();
  });
});

describe('setLoginCookie', () => {
  it('sets a cookie on divine.video', () => {
    setHostname('divine.video');
    setLoginCookie({ type: 'extension', pubkey: 'abc123' });
    expect(cookieJar).toContain('nostr_login=');
  });

  it('does not set a cookie on localhost', () => {
    setHostname('localhost');
    setLoginCookie({ type: 'extension', pubkey: 'abc123' });
    expect(cookieJar).toBe('');
  });

  it('sets a cookie on dvines.org', () => {
    setHostname('staging.dvines.org');
    setLoginCookie({ type: 'extension', pubkey: 'abc123' });
    expect(cookieJar).toContain('nostr_login=');
  });
});

describe('clearLoginCookie', () => {
  it('clears an existing cookie', () => {
    setHostname('divine.video');
    setLoginCookie({ type: 'extension', pubkey: 'abc123' });
    expect(cookieJar).toContain('nostr_login=');
    clearLoginCookie();
    expect(cookieJar).not.toContain('nostr_login=');
  });
});

describe('server-side persist fallback', () => {
  it('setLoginCookie also POSTs to /api/auth/persist-cookie', () => {
    setHostname('divine.video');
    setLoginCookie({ type: 'extension', pubkey: 'abc123' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/persist-cookie',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.name).toBe('nostr_login');
    expect(typeof body.value).toBe('string');
    expect(body.value.length).toBeGreaterThan(0);
    expect(body.maxAge).toBe(60 * 60 * 24 * 365);
  });

  it('setJwtCookie also POSTs to /api/auth/persist-cookie with JWT max-age', () => {
    setHostname('alice.divine.video');
    setJwtCookie({
      token: 'eyJ.test',
      expiration: Date.now() + 86400000,
      sessionStart: Date.now(),
      rememberMe: false,
    });

    const persistCall = fetchMock.mock.calls.find((c) => c[0] === '/api/auth/persist-cookie');
    expect(persistCall).toBeDefined();
    const body = JSON.parse(persistCall![1].body);
    expect(body.name).toBe('divine_jwt');
    expect(body.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it('clearLoginCookie also DELETEs server-side', () => {
    setHostname('divine.video');
    clearLoginCookie();

    const deleteCall = fetchMock.mock.calls.find((c) => c[1]?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(deleteCall![0]).toBe('/api/auth/persist-cookie');
    expect(JSON.parse(deleteCall![1].body)).toEqual({ name: 'nostr_login' });
  });

  it('clearJwtCookie also DELETEs server-side', () => {
    setHostname('divine.video');
    clearJwtCookie();

    const deleteCall = fetchMock.mock.calls.find((c) => c[1]?.method === 'DELETE');
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(deleteCall![1].body)).toEqual({ name: 'divine_jwt' });
  });

  it('does not POST on localhost (no cookie domain)', () => {
    setHostname('localhost');
    setLoginCookie({ type: 'extension', pubkey: 'abc123' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a fetch rejection does not break setLoginCookie', () => {
    setHostname('divine.video');
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(() => setLoginCookie({ type: 'extension', pubkey: 'abc123' })).not.toThrow();
    expect(cookieJar).toContain('nostr_login=');
  });
});

describe('hydrateLoginFromCookie', () => {
  const STORAGE_KEY = 'nostr:login';
  const mockUUID = '00000000-0000-0000-0000-000000000000';

  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID as `${string}-${string}-${string}-${string}-${string}`);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('when localStorage has login, syncs TO cookie', () => {
    const loginState = [{ id: '1', type: 'extension', pubkey: 'pub123' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));

    hydrateLoginFromCookie();

    // Cookie should be set
    const cookie = getLoginCookie();
    expect(cookie).toEqual({ type: 'extension', pubkey: 'pub123' });
    // localStorage should be unchanged
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(loginState);
  });

  it('when localStorage is empty and cookie has extension login, hydrates localStorage', () => {
    const data = { type: 'extension' as const, pubkey: 'pub456' };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{
      id: mockUUID,
      type: 'extension',
      pubkey: 'pub456',
    }]);
  });

  it('when localStorage is empty and cookie has bunker login with URI, hydrates localStorage', () => {
    const data = { type: 'bunker' as const, pubkey: 'pub789', bunkerUri: 'bunker://xyz' };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{
      id: mockUUID,
      type: 'bunker',
      pubkey: 'pub789',
      data: 'bunker://xyz',
    }]);
  });

  it('when localStorage is empty and cookie has nsec login, does NOT hydrate', () => {
    const data = { type: 'nsec' as const, pubkey: 'pubabc' };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('when both localStorage and cookie are empty, does nothing', () => {
    hydrateLoginFromCookie();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(cookieJar).toBe('');
  });

  // --- JWT cross-subdomain hydration ---

  it('when localStorage has JWT, syncs TO jwt cookie', () => {
    const token = 'eyJ0eXAiOiJKV1QifQ.test-token';
    const expiration = Date.now() + 86400000;
    localStorage.setItem('keycast_jwt_token', JSON.stringify(token));
    localStorage.setItem('keycast_jwt_expiration', JSON.stringify(expiration));
    localStorage.setItem('keycast_session_start', JSON.stringify(Date.now()));
    localStorage.setItem('keycast_remember_me', JSON.stringify(false));

    hydrateLoginFromCookie();

    const jwtCookie = getJwtCookie();
    expect(jwtCookie).not.toBeNull();
    expect(jwtCookie!.token).toBe(token);
    expect(jwtCookie!.expiration).toBe(expiration);
  });

  it('when localStorage has no JWT but jwt cookie exists, hydrates localStorage', () => {
    const expiration = Date.now() + 86400000;
    const sessionStart = Date.now();
    const jwtData = {
      token: 'eyJ0eXAiOiJKV1QifQ.hydrate-test',
      expiration,
      sessionStart,
      rememberMe: true,
      email: 'test@divine.video',
    };
    cookieJar = `divine_jwt=${btoa(JSON.stringify(jwtData))}`;

    hydrateLoginFromCookie();

    expect(JSON.parse(localStorage.getItem('keycast_jwt_token')!)).toBe(jwtData.token);
    expect(JSON.parse(localStorage.getItem('keycast_jwt_expiration')!)).toBe(expiration);
    expect(JSON.parse(localStorage.getItem('keycast_session_start')!)).toBe(sessionStart);
    expect(JSON.parse(localStorage.getItem('keycast_remember_me')!)).toBe(true);
    expect(JSON.parse(localStorage.getItem('keycast_email')!)).toBe('test@divine.video');
  });

  it('does NOT hydrate JWT from cookie if token is expired', () => {
    const jwtData = {
      token: 'eyJ0eXAiOiJKV1QifQ.expired',
      expiration: Date.now() - 1000, // expired
      sessionStart: Date.now() - 86400000,
      rememberMe: false,
    };
    cookieJar = `divine_jwt=${btoa(JSON.stringify(jwtData))}`;

    hydrateLoginFromCookie();

    expect(localStorage.getItem('keycast_jwt_token')).toBeNull();
  });
});

describe('JWT cookie functions', () => {
  it('setJwtCookie sets and getJwtCookie reads', () => {
    const data = {
      token: 'test-jwt-token',
      expiration: Date.now() + 86400000,
      sessionStart: Date.now(),
      rememberMe: false,
    };
    setJwtCookie(data);
    const result = getJwtCookie();
    expect(result).toEqual(data);
  });

  it('clearJwtCookie removes the cookie', () => {
    setJwtCookie({
      token: 'test',
      expiration: Date.now() + 86400000,
      sessionStart: Date.now(),
      rememberMe: false,
    });
    expect(getJwtCookie()).not.toBeNull();
    clearJwtCookie();
    expect(getJwtCookie()).toBeNull();
  });

  it('does not set cookie on localhost', () => {
    setHostname('localhost');
    setJwtCookie({
      token: 'test',
      expiration: Date.now() + 86400000,
      sessionStart: Date.now(),
      rememberMe: false,
    });
    expect(cookieJar).toBe('');
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCookieDomain, getLoginCookie, setLoginCookie, clearLoginCookie, hydrateLoginFromCookie, setJwtCookie, getJwtCookie, clearJwtCookie, isValidBunkerData } from './crossSubdomainAuth';

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
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(document, 'cookie', originalCookieDescriptor);
});

describe('isValidBunkerData', () => {
  it('accepts a well-formed bunker data object', () => {
    expect(isValidBunkerData({
      bunkerPubkey: 'abc',
      clientNsec: 'nsec1examplekey',
      relays: ['wss://relay.example'],
    })).toBe(true);
  });

  it('rejects a raw bunker:// URI string', () => {
    expect(isValidBunkerData('bunker://pub?relay=wss://r&secret=s')).toBe(false);
  });

  it('rejects an object missing clientNsec', () => {
    expect(isValidBunkerData({ bunkerPubkey: 'abc', relays: ['wss://r'] })).toBe(false);
  });

  it('rejects an object with empty relays', () => {
    expect(isValidBunkerData({ bunkerPubkey: 'abc', clientNsec: 'nsec1x', relays: [] })).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isValidBunkerData(null)).toBe(false);
    expect(isValidBunkerData(undefined)).toBe(false);
  });
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

  it('when localStorage is empty and cookie has valid bunkerData, hydrates localStorage with the object', () => {
    const bunkerData = {
      bunkerPubkey: 'bunkerpub',
      clientNsec: 'nsec1clientkey',
      relays: ['wss://relay.example'],
    };
    const data = { type: 'bunker' as const, pubkey: 'pub789', bunkerData };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{
      id: mockUUID,
      type: 'bunker',
      pubkey: 'pub789',
      data: bunkerData,
    }]);
  });

  it('when cookie has a legacy bunkerUri string (no bunkerData), does NOT hydrate', () => {
    const data = { type: 'bunker' as const, pubkey: 'pub789', bunkerUri: 'bunker://xyz' };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
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

  it('when localStorage has a valid bunker login, syncs bunkerData object TO cookie', () => {
    const bunkerData = {
      bunkerPubkey: 'bunkerpub',
      clientNsec: 'nsec1clientkey',
      relays: ['wss://relay.example'],
    };
    const loginState = [{ id: '1', type: 'bunker', pubkey: 'pubB', data: bunkerData }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));

    hydrateLoginFromCookie();

    expect(getLoginCookie()).toEqual({ type: 'bunker', pubkey: 'pubB', bunkerData });
    // localStorage unchanged
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(loginState);
  });

  it('self-heals: drops a poisoned bunker login (string data) and does not poison the cookie', () => {
    const loginState = [{ id: '1', type: 'bunker', pubkey: 'pubB', data: 'bunker://poisoned' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));

    hydrateLoginFromCookie();

    // poisoned entry removed; cookie not written with a string payload
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getLoginCookie()).toBeNull();
  });

  it('self-recovers: poisoned local entry dropped, healthy cookie re-hydrates the session', () => {
    const bunkerData = {
      bunkerPubkey: 'bp',
      clientNsec: 'nsec1goodkey',
      relays: ['wss://relay.example'],
    };
    // poisoned localStorage on this origin
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: '1', type: 'bunker', pubkey: 'pubB', data: 'bunker://poisoned' },
    ]));
    // but a healthy shared cookie exists (written by another origin)
    cookieJar = `nostr_login=${btoa(JSON.stringify({ type: 'bunker', pubkey: 'pubB', bunkerData }))}`;

    hydrateLoginFromCookie();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{
      id: mockUUID,
      type: 'bunker',
      pubkey: 'pubB',
      data: bunkerData,
    }]);
    // the healthy shared cookie must be left intact (not cleared/overwritten),
    // so other origins still recover from it
    expect(getLoginCookie()).toEqual({ type: 'bunker', pubkey: 'pubB', bunkerData });
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

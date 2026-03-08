import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCookieDomain, getLoginCookie, setLoginCookie, clearLoginCookie, hydrateLoginFromCookie } from './crossSubdomainAuth';

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
});

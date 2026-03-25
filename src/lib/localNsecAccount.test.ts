import { beforeEach, describe, expect, it } from 'vitest';
import { NLogin, type NLoginType } from '@nostrify/react/login';
import { generateSecretKey, nip19 } from 'nostr-tools';

import {
  buildNsecDownload,
  getActiveLocalNsecLogin,
  getStoredLocalNsecLogin,
} from './localNsecAccount';

function createNsec() {
  return nip19.nsecEncode(generateSecretKey());
}

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    clear() {
      store = {};
    },
    getItem(key: string) {
      return store[key] || null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
})();

describe('localNsecAccount', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    localStorageMock.clear();
  });

  it('returns the active nsec login from the current login list', () => {
    const nsec = createNsec();
    const logins: NLoginType[] = [
      { id: 'extension:abc', type: 'extension', pubkey: 'abc', createdAt: new Date().toISOString(), data: null },
      NLogin.fromNsec(nsec),
    ];

    expect(getActiveLocalNsecLogin(logins)?.data.nsec).toBe(nsec);
  });

  it('reads the stored nsec login from localStorage', () => {
    const nsec = createNsec();
    localStorage.setItem('nostr:login', JSON.stringify([
      NLogin.fromNsec(nsec),
    ]));

    expect(getStoredLocalNsecLogin()?.data.nsec).toBe(nsec);
  });

  it('builds downloadable backup content for local nsec accounts', () => {
    const backup = buildNsecDownload('nsec1example');

    expect(backup).toContain('nsec1example');
    expect(backup).toContain('Divine');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearFunnelcakeApiModeOverride,
  getFunnelcakeApiModeOverride,
  resolveFunnelcakeBaseUrl,
  setFunnelcakeApiModeOverride,
} from './api';

function installLocalStorageMock() {
  const store = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}

describe('resolveFunnelcakeBaseUrl', () => {
  it('uses the staging API in auto mode on staging.divine.video', () => {
    expect(resolveFunnelcakeBaseUrl({
      hostname: 'staging.divine.video',
      mode: 'auto',
    })).toBe('https://api.staging.divine.video');
  });

  it('uses the production API in auto mode on divine.video', () => {
    expect(resolveFunnelcakeBaseUrl({
      hostname: 'divine.video',
      mode: 'auto',
    })).toBe('https://api.divine.video');
  });

  it('uses the environment fallback for unknown hosts in auto mode', () => {
    expect(resolveFunnelcakeBaseUrl({
      hostname: 'localhost',
      mode: 'auto',
      envBaseUrl: 'https://api.preview.divine.video',
    })).toBe('https://api.preview.divine.video');
  });

  it('forces the production API when production mode is selected', () => {
    expect(resolveFunnelcakeBaseUrl({
      hostname: 'staging.divine.video',
      mode: 'production',
    })).toBe('https://api.divine.video');
  });

  it('forces the staging API when staging mode is selected', () => {
    expect(resolveFunnelcakeBaseUrl({
      hostname: 'divine.video',
      mode: 'staging',
    })).toBe('https://api.staging.divine.video');
  });
});

describe('Funnelcake API mode override storage', () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to auto when no override is stored', () => {
    expect(getFunnelcakeApiModeOverride()).toBe('auto');
  });

  it('persists the selected override mode', () => {
    setFunnelcakeApiModeOverride('staging');

    expect(getFunnelcakeApiModeOverride()).toBe('staging');
  });

  it('clears the override back to auto', () => {
    setFunnelcakeApiModeOverride('production');

    clearFunnelcakeApiModeOverride();

    expect(getFunnelcakeApiModeOverride()).toBe('auto');
  });
});

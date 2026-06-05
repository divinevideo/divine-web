import { describe, it, expect, beforeEach } from 'vitest';
import { resolveRelayUrl, resolveRelayUrls } from './simRelay';

// jsdom in this repo doesn't ship a working localStorage by default;
// install a small in-memory shim per test.
function installLocalStorageShim(): void {
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length(): number {
        return store.size;
      },
    },
  });
}

describe('resolveRelayUrl', () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it('returns default when override is unset', () => {
    expect(resolveRelayUrl('wss://relay.divine.video')).toBe(
      'wss://relay.divine.video',
    );
  });

  it('returns override when it is a valid wss URL', () => {
    window.localStorage.setItem(
      'DIVINE_RELAY_OVERRIDE',
      'wss://relay.staging.divine.video',
    );
    expect(resolveRelayUrl('wss://relay.divine.video')).toBe(
      'wss://relay.staging.divine.video',
    );
  });

  it('ignores non-wss override values (defensive)', () => {
    window.localStorage.setItem('DIVINE_RELAY_OVERRIDE', 'https://attacker.example');
    expect(resolveRelayUrl('wss://relay.divine.video')).toBe(
      'wss://relay.divine.video',
    );
  });

  it('ignores empty override', () => {
    window.localStorage.setItem('DIVINE_RELAY_OVERRIDE', '');
    expect(resolveRelayUrl('wss://relay.divine.video')).toBe(
      'wss://relay.divine.video',
    );
  });
});

describe('resolveRelayUrls', () => {
  beforeEach(() => {
    installLocalStorageShim();
  });

  it('returns defaults unchanged when override unset', () => {
    expect(resolveRelayUrls(['wss://relay.divine.video', 'wss://other.example'])).toEqual([
      'wss://relay.divine.video',
      'wss://other.example',
    ]);
  });

  it('replaces only relay.divine.video entries when override set', () => {
    window.localStorage.setItem(
      'DIVINE_RELAY_OVERRIDE',
      'wss://relay.staging.divine.video',
    );
    expect(
      resolveRelayUrls(['wss://relay.divine.video', 'wss://search.example']),
    ).toEqual(['wss://relay.staging.divine.video', 'wss://search.example']);
  });

  it('does NOT replace already-staging URLs', () => {
    window.localStorage.setItem(
      'DIVINE_RELAY_OVERRIDE',
      'wss://relay.staging.divine.video',
    );
    expect(resolveRelayUrls(['wss://relay.staging.divine.video'])).toEqual([
      'wss://relay.staging.divine.video',
    ]);
  });
});

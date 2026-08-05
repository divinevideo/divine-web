// ABOUTME: Tests that bunker logins share one signer and release it on logout
// ABOUTME: divine-web#531 — a signer per consumer opened a socket set per mounted component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nip19, generateSecretKey } from 'nostr-tools';
import type { BunkerLoginData } from '@/lib/bunkerSigner';

const close = vi.fn(async () => {});
const bunkerSignerFromLogin = vi.fn(() => ({
  connect: vi.fn(async () => {}),
  close,
  getPublicKey: vi.fn(async () => 'd'.repeat(64)),
  signEvent: vi.fn(async () => ({})),
  nip04: { encrypt: vi.fn(async () => ''), decrypt: vi.fn(async () => '') },
  nip44: { encrypt: vi.fn(async () => ''), decrypt: vi.fn(async () => '') },
}));

vi.mock('@/lib/bunkerSigner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bunkerSigner')>()),
  bunkerSignerFromLogin: (...args: unknown[]) => bunkerSignerFromLogin(...(args as [])),
}));

const RELAY = 'wss://relay.example';
const LOGIN_ID = 'bunker:abc';

function loginData(overrides: Partial<BunkerLoginData> = {}): BunkerLoginData {
  return {
    bunkerPubkey: 'b'.repeat(64),
    clientNsec: nip19.nsecEncode(generateSecretKey()),
    relays: [RELAY],
    ...overrides,
  };
}

async function registry() {
  const mod = await import('./bunkerSignerRegistry');
  mod.resetBunkerSignerRegistry();
  return mod;
}

describe('getBunkerSigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The defect: `createUserFromLogin` runs in a `useMemo` in `useCurrentUser`,
  // so ten mounted components meant ten signers and ten sets of sockets.
  it('hands every consumer of one login the same signer', async () => {
    const { getBunkerSigner } = await registry();
    const data = loginData();

    const signers = Array.from({ length: 10 }, () => getBunkerSigner(LOGIN_ID, data));

    expect(new Set(signers).size).toBe(1);
  });

  // Callers treat a throw as "skip this login". Deferring the connection must
  // not defer this check with it.
  it('rejects unusable login data up front, before anything is deferred', async () => {
    const { getBunkerSigner } = await registry();
    const npub = nip19.npubEncode('b'.repeat(64)) as `nsec1${string}`;

    expect(() => getBunkerSigner(LOGIN_ID, loginData({ clientNsec: npub }))).toThrow(
      'Invalid client key for bunker login'
    );
    expect(bunkerSignerFromLogin).not.toHaveBeenCalled();
  });

  it('keeps separate logins on separate signers', async () => {
    const { getBunkerSigner } = await registry();

    const first = getBunkerSigner('bunker:one', loginData());
    const second = getBunkerSigner('bunker:two', loginData());

    expect(first).not.toBe(second);
  });

  // Idle logins cost nothing under NConnectSigner, which opened a REQ per
  // request. `BunkerSigner.fromBunker` subscribes eagerly, so the connection
  // has to wait for a request that actually needs it.
  it('opens no connection until a request needs one', async () => {
    const { getBunkerSigner } = await registry();

    getBunkerSigner(LOGIN_ID, loginData());

    expect(bunkerSignerFromLogin).not.toHaveBeenCalled();
  });

  it('opens exactly one connection once requests start, however many callers', async () => {
    const { getBunkerSigner } = await registry();
    const data = loginData();

    await getBunkerSigner(LOGIN_ID, data).getPublicKey();
    await getBunkerSigner(LOGIN_ID, data).getPublicKey();
    await getBunkerSigner(LOGIN_ID, data).signEvent({ kind: 1, content: '', created_at: 1, tags: [] });

    expect(bunkerSignerFromLogin).toHaveBeenCalledTimes(1);
  });

  // A login id is derived from the user pubkey, so the same id can come back
  // pointing at a different bunker or carrying a re-issued client key.
  it('rebuilds when the connection details change under the same id', async () => {
    const { getBunkerSigner } = await registry();

    await getBunkerSigner(LOGIN_ID, loginData()).getPublicKey();
    await getBunkerSigner(LOGIN_ID, loginData({ relays: ['wss://elsewhere.example'] })).getPublicKey();

    expect(bunkerSignerFromLogin).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reuses the signer when only relay ordering differs', async () => {
    const { getBunkerSigner } = await registry();
    const nsec = nip19.nsecEncode(generateSecretKey());
    const relays = ['wss://a.example', 'wss://b.example'];

    const first = getBunkerSigner(LOGIN_ID, loginData({ clientNsec: nsec, relays }));
    const second = getBunkerSigner(LOGIN_ID, loginData({ clientNsec: nsec, relays: [...relays].reverse() }));

    expect(second).toBe(first);
  });
});

describe('releasing signers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('closes the connection a released login had opened', async () => {
    const { getBunkerSigner, releaseBunkerSigner } = await registry();

    await getBunkerSigner(LOGIN_ID, loginData()).getPublicKey();
    releaseBunkerSigner(LOGIN_ID);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('has nothing to close for a login that never issued a request', async () => {
    const { getBunkerSigner, releaseBunkerSigner } = await registry();

    getBunkerSigner(LOGIN_ID, loginData());
    releaseBunkerSigner(LOGIN_ID);

    expect(close).not.toHaveBeenCalled();
  });

  it('builds a fresh signer after release rather than reusing the closed one', async () => {
    const { getBunkerSigner, releaseBunkerSigner } = await registry();
    const data = loginData();

    await getBunkerSigner(LOGIN_ID, data).getPublicKey();
    releaseBunkerSigner(LOGIN_ID);
    await getBunkerSigner(LOGIN_ID, data).getPublicKey();

    expect(bunkerSignerFromLogin).toHaveBeenCalledTimes(2);
  });

  // Logout, account switching and dropping an invalid login all go through
  // different call sites; reconciling covers them without touching each one.
  it('releases only the logins that are gone', async () => {
    const { getBunkerSigner, releaseBunkerSignersExcept } = await registry();
    const kept = loginData();

    await getBunkerSigner('bunker:kept', kept).getPublicKey();
    await getBunkerSigner('bunker:gone', loginData()).getPublicKey();
    expect(bunkerSignerFromLogin).toHaveBeenCalledTimes(2);

    releaseBunkerSignersExcept(['bunker:kept']);

    expect(close).toHaveBeenCalledTimes(1);
    // The surviving login keeps the signer it already had.
    await getBunkerSigner('bunker:kept', kept).getPublicKey();
    expect(bunkerSignerFromLogin).toHaveBeenCalledTimes(2);
  });

  it('releases everything when the last login goes', async () => {
    const { getBunkerSigner, releaseBunkerSignersExcept } = await registry();

    await getBunkerSigner('bunker:one', loginData()).getPublicKey();
    await getBunkerSigner('bunker:two', loginData()).getPublicKey();

    releaseBunkerSignersExcept([]);

    expect(close).toHaveBeenCalledTimes(2);
  });
});

describe('isUsableBunkerLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts stored data whose client key is an nsec', async () => {
    const { isUsableBunkerLogin } = await registry();
    expect(isUsableBunkerLogin(loginData())).toBe(true);
  });

  it('rejects stored data whose client key is not an nsec', async () => {
    const { isUsableBunkerLogin } = await registry();
    const npub = nip19.npubEncode('b'.repeat(64)) as `nsec1${string}`;

    expect(isUsableBunkerLogin(loginData({ clientNsec: npub }))).toBe(false);
  });

  // The whole point of the probe: answering must not open anything.
  it('answers without building a signer', async () => {
    const { isUsableBunkerLogin } = await registry();

    isUsableBunkerLogin(loginData());

    expect(bunkerSignerFromLogin).not.toHaveBeenCalled();
  });
});

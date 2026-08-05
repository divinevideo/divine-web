// ABOUTME: Tests that login -> user conversion shares bunker signers and probes without building them
// ABOUTME: divine-web#531 — this runs in a useMemo in useCurrentUser, so a signer per call leaked sockets

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nip19, generateSecretKey } from 'nostr-tools';
import type { NLoginType } from '@nostrify/react/login';

const bunkerSignerFromLogin = vi.fn(() => ({
  connect: vi.fn(async () => {}),
  close: vi.fn(async () => {}),
  getPublicKey: vi.fn(async () => 'd'.repeat(64)),
  signEvent: vi.fn(async () => ({})),
  nip04: { encrypt: vi.fn(async () => ''), decrypt: vi.fn(async () => '') },
  nip44: { encrypt: vi.fn(async () => ''), decrypt: vi.fn(async () => '') },
}));

vi.mock('@/lib/bunkerSigner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/bunkerSigner')>()),
  bunkerSignerFromLogin: (...args: unknown[]) => bunkerSignerFromLogin(...(args as [])),
}));

const USER_PUBKEY = 'a'.repeat(64);

function bunkerLogin(id = 'bunker:one'): NLoginType {
  return {
    id,
    type: 'bunker',
    pubkey: USER_PUBKEY,
    createdAt: new Date(0).toISOString(),
    data: {
      bunkerPubkey: 'b'.repeat(64),
      clientNsec: nip19.nsecEncode(generateSecretKey()),
      relays: ['wss://relay.example'],
    },
  };
}

async function loadModules() {
  const registry = await import('./bunkerSignerRegistry');
  registry.resetBunkerSignerRegistry();
  return { ...(await import('./nostrLogin')), registry };
}

describe('createUserFromLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // useCurrentUser is mounted all over the app and rebuilds users in a memo, so
  // a fresh signer per call meant a socket set per mounted component.
  it('gives repeated calls for one bunker login the same signer', async () => {
    const { createUserFromLogin } = await loadModules();
    const login = bunkerLogin();

    const first = createUserFromLogin(login);
    const second = createUserFromLogin(login);

    expect(second.signer).toBe(first.signer);
  });

  it('does not connect merely by building the user', async () => {
    const { createUserFromLogin } = await loadModules();

    createUserFromLogin(bunkerLogin());

    expect(bunkerSignerFromLogin).not.toHaveBeenCalled();
  });

  it('connects once when the user actually signs', async () => {
    const { createUserFromLogin } = await loadModules();
    const login = bunkerLogin();

    await createUserFromLogin(login).signer.getPublicKey();
    await createUserFromLogin(login).signer.getPublicKey();

    expect(bunkerSignerFromLogin).toHaveBeenCalledTimes(1);
  });

  // useCurrentUser skips logins whose conversion throws. Deferring the
  // connection must not defer this check with it, or an unusable login reads
  // as valid and fails every later request instead of being dropped.
  it('still throws for a bunker login whose client key is not an nsec', async () => {
    const { createUserFromLogin } = await loadModules();
    const login = bunkerLogin();
    login.data = {
      ...(login.data as Record<string, unknown>),
      clientNsec: nip19.npubEncode('b'.repeat(64)),
    } as never;

    expect(() => createUserFromLogin(login)).toThrow('Invalid client key for bunker login');
  });
});

describe('canCreateUserFromLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // useLoggedInAccounts only ever used this as a validity probe and threw the
  // user away, so it must not register a signer for a login that may never
  // sign anything — nor, obviously, open a connection.
  it('validates a bunker login without registering a signer for it', async () => {
    const { canCreateUserFromLogin, registry } = await loadModules();

    expect(canCreateUserFromLogin(bunkerLogin())).toBe(true);
    expect(registry.registeredBunkerSignerCount()).toBe(0);
    expect(bunkerSignerFromLogin).not.toHaveBeenCalled();
  });

  it('rejects a bunker login whose client key is not an nsec', async () => {
    const { canCreateUserFromLogin } = await loadModules();
    const login = bunkerLogin();
    login.data = {
      ...(login.data as Record<string, unknown>),
      clientNsec: nip19.npubEncode('b'.repeat(64)),
    } as never;

    expect(canCreateUserFromLogin(login)).toBe(false);
  });

  it('accepts an nsec login', async () => {
    const { canCreateUserFromLogin } = await loadModules();

    expect(
      canCreateUserFromLogin({
        id: 'nsec:one',
        type: 'nsec',
        pubkey: USER_PUBKEY,
        createdAt: new Date(0).toISOString(),
        data: { nsec: nip19.nsecEncode(generateSecretKey()) },
      })
    ).toBe(true);
  });

  it('rejects an unsupported login type', async () => {
    const { canCreateUserFromLogin } = await loadModules();

    expect(
      canCreateUserFromLogin({
        id: 'x-other:one',
        type: 'x-other',
        pubkey: USER_PUBKEY,
        createdAt: new Date(0).toISOString(),
        data: {},
      })
    ).toBe(false);
  });
});

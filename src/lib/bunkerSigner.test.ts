// ABOUTME: Tests the NIP-46 bunker signer built on nostr-tools BunkerSigner
// ABOUTME: divine-web#485 — auth challenges must be surfaced, not fatal

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';

const REMOTE_PUBKEY = 'b'.repeat(64);
const USER_PUBKEY = 'c'.repeat(64);
const RELAY = 'wss://relay.example';

const bunkerInstance = {
  connect: vi.fn(async () => {}),
  getPublicKey: vi.fn(async () => USER_PUBKEY),
  signEvent: vi.fn(async (t: Record<string, unknown>) => ({ ...t, id: 'signed', pubkey: USER_PUBKEY, sig: 'sig' })),
  nip04Encrypt: vi.fn(async () => 'nip04-ct'),
  nip04Decrypt: vi.fn(async () => 'nip04-pt'),
  nip44Encrypt: vi.fn(async () => 'nip44-ct'),
  nip44Decrypt: vi.fn(async () => 'nip44-pt'),
  close: vi.fn(async () => {}),
};

interface BunkerPointerArg {
  pubkey: string;
  relays: string[];
  secret: string | null;
}
interface BunkerParamsArg {
  onauth?: (url: string) => void;
}

const fromBunker = vi.fn(
  (_sk: Uint8Array, _bp: BunkerPointerArg, _params: BunkerParamsArg) => bunkerInstance
);

vi.mock('nostr-tools/nip46', () => ({
  BunkerSigner: { fromBunker },
}));

const presentAuthChallenge = vi.fn(() => ({ url: 'https://signer.example/auth', opened: true }));
vi.mock('./bunkerAuthChallenge', () => ({
  presentAuthChallenge: (...args: unknown[]) => presentAuthChallenge(...(args as [])),
}));

describe('createBunkerSigner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    presentAuthChallenge.mockReturnValue({ url: 'https://signer.example/auth', opened: true });
  });

  it('exposes a signer that satisfies the app signer interface', async () => {
    const { createBunkerSigner } = await import('./bunkerSigner');
    const signer = createBunkerSigner({
      clientSecretKey: generateSecretKey(),
      bunkerPubkey: REMOTE_PUBKEY,
      relays: [RELAY],
    });

    await expect(signer.getPublicKey()).resolves.toBe(USER_PUBKEY);
    await expect(signer.signEvent({ kind: 1, content: 'hi', created_at: 1, tags: [] })).resolves.toMatchObject({ sig: 'sig' });
    await expect(signer.nip44!.encrypt('p', 'text')).resolves.toBe('nip44-ct');
    await expect(signer.nip44!.decrypt('p', 'ct')).resolves.toBe('nip44-pt');
    await expect(signer.nip04!.encrypt('p', 'text')).resolves.toBe('nip04-ct');
    await expect(signer.nip04!.decrypt('p', 'ct')).resolves.toBe('nip04-pt');
  });

  it('passes the bunker pointer through untouched', async () => {
    const { createBunkerSigner } = await import('./bunkerSigner');
    const clientSecretKey = generateSecretKey();

    createBunkerSigner({
      clientSecretKey,
      bunkerPubkey: REMOTE_PUBKEY,
      relays: [RELAY],
      secret: 'connect-token',
    });

    expect(fromBunker).toHaveBeenCalledTimes(1);
    const [sk, bp] = fromBunker.mock.calls[0];
    expect(sk).toBe(clientSecretKey);
    expect(bp).toEqual({ pubkey: REMOTE_PUBKEY, relays: [RELAY], secret: 'connect-token' });
  });

  // The whole point of divine-web#485: an auth challenge is a prompt, not a
  // failure. nostr-tools keeps waiting on the same request id after calling
  // `onauth`, so we must hand it a handler rather than let the error surface.
  it('routes auth challenges to the presenter instead of failing', async () => {
    const { createBunkerSigner } = await import('./bunkerSigner');
    const onAuthChallenge = vi.fn();

    createBunkerSigner({
      clientSecretKey: generateSecretKey(),
      bunkerPubkey: REMOTE_PUBKEY,
      relays: [RELAY],
      onAuthChallenge,
    });

    const params = fromBunker.mock.calls[0][2];
    expect(typeof params.onauth).toBe('function');

    params.onauth!('https://signer.example/auth');

    expect(presentAuthChallenge).toHaveBeenCalledWith('https://signer.example/auth');
    expect(onAuthChallenge).toHaveBeenCalledWith({ url: 'https://signer.example/auth', opened: true });
  });

  it('still notifies the caller when the popup was blocked, so a link can be shown', async () => {
    presentAuthChallenge.mockReturnValue({ url: 'https://signer.example/auth', opened: false });
    const { createBunkerSigner } = await import('./bunkerSigner');
    const onAuthChallenge = vi.fn();

    createBunkerSigner({
      clientSecretKey: generateSecretKey(),
      bunkerPubkey: REMOTE_PUBKEY,
      relays: [RELAY],
      onAuthChallenge,
    });

    const params = fromBunker.mock.calls[0][2];
    params.onauth!('https://signer.example/auth');

    expect(onAuthChallenge).toHaveBeenCalledWith({ url: 'https://signer.example/auth', opened: false });
  });
});

describe('loginWithBunker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects, resolves the user pubkey, and returns reusable login data', async () => {
    const { loginWithBunker } = await import('./bunkerSigner');

    const login = await loginWithBunker(
      `bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}&secret=tok`
    );

    expect(bunkerInstance.connect).toHaveBeenCalled();
    expect(login.type).toBe('bunker');
    expect(login.pubkey).toBe(USER_PUBKEY);
    expect(login.data.bunkerPubkey).toBe(REMOTE_PUBKEY);
    expect(login.data.relays).toEqual([RELAY]);
    // The client key must be persisted, or the next session looks like a new
    // client to the bunker and needs re-approval.
    expect(login.data.clientNsec).toMatch(/^nsec1/);
    expect(() => nip19.decode(login.data.clientNsec)).not.toThrow();
  });

  it('rejects a URI with no relay', async () => {
    const { loginWithBunker } = await import('./bunkerSigner');
    await expect(loginWithBunker(`bunker://${REMOTE_PUBKEY}?secret=tok`)).rejects.toThrow();
  });

  // The handshake signer opens sockets when it is constructed and the session
  // builds its own signer from the persisted data, so this one must not be left
  // running, on the failure path either.
  it('closes the handshake signer once the login data is captured', async () => {
    const { loginWithBunker } = await import('./bunkerSigner');

    await loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`);

    expect(bunkerInstance.close).toHaveBeenCalledTimes(1);
  });

  it('closes the handshake signer when the handshake fails', async () => {
    bunkerInstance.connect.mockRejectedValueOnce(new Error('signer unreachable'));
    const { loginWithBunker } = await import('./bunkerSigner');

    await expect(
      loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`)
    ).rejects.toThrow('signer unreachable');
    expect(bunkerInstance.close).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the same client identity from stored login data', async () => {
    const { bunkerSignerFromLogin } = await import('./bunkerSigner');
    const sk = generateSecretKey();
    const clientNsec = nip19.nsecEncode(sk);

    bunkerSignerFromLogin({
      bunkerPubkey: REMOTE_PUBKEY,
      clientNsec,
      relays: [RELAY],
    });

    const [passedSk] = fromBunker.mock.calls[0];
    expect(getPublicKey(passedSk)).toBe(getPublicKey(sk));
  });

});

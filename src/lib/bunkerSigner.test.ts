// ABOUTME: Tests the NIP-46 bunker signer built on nostr-tools BunkerSigner
// ABOUTME: divine-web#485 — auth challenges must be surfaced, not fatal

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';

/** Just the surface the deadline cases exercise. */
interface BunkerNostrSignerLike {
  connect(): Promise<void>;
  getPublicKey(): Promise<string>;
  signEvent(event: { kind: number; content: string; created_at: number; tags: string[][] }): Promise<NostrEvent>;
}

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
  pool?: unknown;
}

const fromBunker = vi.fn(
  (_sk: Uint8Array, _bp: BunkerPointerArg, _params: BunkerParamsArg) => bunkerInstance
);

vi.mock('nostr-tools/nip46', () => ({
  BunkerSigner: { fromBunker },
}));

// `close()` drops the subscription but leaves the pool's sockets connected, so
// releasing them is a separate call. Mock the pool to make that observable.
const poolInstance = { destroy: vi.fn(), close: vi.fn() };
const SimplePoolMock = vi.fn(() => poolInstance);
vi.mock('nostr-tools/pool', () => ({
  SimplePool: SimplePoolMock,
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

  // `BunkerSigner.sendRequest` settles only when a matching response arrives.
  // A signer that is unreachable behind a relay that still accepts the publish
  // therefore hangs forever, which is what left the dialog on "Connecting…".
  describe('request deadline', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Stall only the method under test: an unconsumed `mockImplementationOnce`
    // survives `clearAllMocks` and would strand a later test instead.
    async function neverAnswers(method: 'connect' | 'getPublicKey' | 'signEvent') {
      const { createBunkerSigner, BUNKER_REQUEST_TIMEOUT_MS } = await import('./bunkerSigner');
      bunkerInstance[method].mockImplementationOnce((() => new Promise(() => {})) as never);

      return {
        timeout: BUNKER_REQUEST_TIMEOUT_MS,
        signer: createBunkerSigner({
          clientSecretKey: generateSecretKey(),
          bunkerPubkey: REMOTE_PUBKEY,
          relays: [RELAY],
        }),
      };
    }

    it('rejects a request the signer never answers', async () => {
      const { signer, timeout } = await neverAnswers('connect');
      const pending = expect(signer.connect()).rejects.toThrow('Bunker request timed out: connect');

      await vi.advanceTimersByTimeAsync(timeout);
      await pending;
    });

    it.each([
      ['getPublicKey', (s: BunkerNostrSignerLike) => s.getPublicKey()],
      ['signEvent', (s: BunkerNostrSignerLike) => s.signEvent({ kind: 1, content: '', created_at: 1, tags: [] })],
    ] as const)('bounds %s too, so a mid-session request cannot hang', async (label, call) => {
      const { signer, timeout } = await neverAnswers(label);
      const pending = expect(call(signer)).rejects.toThrow('Bunker request timed out');

      await vi.advanceTimersByTimeAsync(timeout);
      await pending;
    });

    it('does not reject a request that answers in time', async () => {
      const { createBunkerSigner, BUNKER_REQUEST_TIMEOUT_MS } = await import('./bunkerSigner');
      const signer = createBunkerSigner({
        clientSecretKey: generateSecretKey(),
        bunkerPubkey: REMOTE_PUBKEY,
        relays: [RELAY],
      });

      await expect(signer.getPublicKey()).resolves.toBe(USER_PUBKEY);
      // The deadline must not fire after the request already settled.
      await vi.advanceTimersByTimeAsync(BUNKER_REQUEST_TIMEOUT_MS * 2);
    });

    // Approval happens on a human's schedule. An `auth_url` proves the signer
    // is alive, so it restarts the clock rather than expiring while the
    // approval tab is still open.
    it('restarts the clock when the signer asks for approval', async () => {
      const { createBunkerSigner, BUNKER_REQUEST_TIMEOUT_MS } = await import('./bunkerSigner');
      let approve: (pubkey: string) => void = () => {};
      bunkerInstance.getPublicKey.mockImplementationOnce(
        () => new Promise<string>((resolve) => { approve = resolve; })
      );

      const signer = createBunkerSigner({
        clientSecretKey: generateSecretKey(),
        bunkerPubkey: REMOTE_PUBKEY,
        relays: [RELAY],
      });
      const pending = signer.getPublicKey();
      const onauth = fromBunker.mock.calls[0][2].onauth!;

      // Challenge lands just before the original deadline would have fired.
      await vi.advanceTimersByTimeAsync(BUNKER_REQUEST_TIMEOUT_MS - 1_000);
      onauth('https://signer.example/auth');

      // Past the original deadline, still waiting on the user.
      await vi.advanceTimersByTimeAsync(BUNKER_REQUEST_TIMEOUT_MS - 1_000);
      approve(USER_PUBKEY);
      await expect(pending).resolves.toBe(USER_PUBKEY);
    });

    // Without this the restarted clock would never fire, trading a hang on a
    // dead signer for a hang on an abandoned approval.
    it('still expires once the restarted clock runs out', async () => {
      const { createBunkerSigner, BUNKER_REQUEST_TIMEOUT_MS } = await import('./bunkerSigner');
      bunkerInstance.getPublicKey.mockImplementationOnce(() => new Promise<string>(() => {}));

      const signer = createBunkerSigner({
        clientSecretKey: generateSecretKey(),
        bunkerPubkey: REMOTE_PUBKEY,
        relays: [RELAY],
      });
      const pending = expect(signer.getPublicKey()).rejects.toThrow('Bunker request timed out');

      fromBunker.mock.calls[0][2].onauth!('https://signer.example/auth');
      await vi.advanceTimersByTimeAsync(BUNKER_REQUEST_TIMEOUT_MS);
      await pending;
    });

    it('waits indefinitely when the deadline is disabled', async () => {
      const { createBunkerSigner, BUNKER_REQUEST_TIMEOUT_MS } = await import('./bunkerSigner');
      bunkerInstance.getPublicKey.mockImplementationOnce(
        () => new Promise<string>((resolve) => setTimeout(() => resolve(USER_PUBKEY), BUNKER_REQUEST_TIMEOUT_MS * 3))
      );

      const signer = createBunkerSigner({
        clientSecretKey: generateSecretKey(),
        bunkerPubkey: REMOTE_PUBKEY,
        relays: [RELAY],
        requestTimeoutMs: 0,
      });
      const pending = signer.getPublicKey();

      await vi.advanceTimersByTimeAsync(BUNKER_REQUEST_TIMEOUT_MS * 3);
      await expect(pending).resolves.toBe(USER_PUBKEY);
    });
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

  // The URI is pasted by the user and the pubkey it carries decides who every
  // later request is encrypted to, so both halves are validated. Neither guard
  // had a test holding it.
  it('rejects a URI that is not a bunker: URI', async () => {
    const { loginWithBunker } = await import('./bunkerSigner');
    await expect(
      loginWithBunker(`https://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`)
    ).rejects.toThrow('Invalid bunker URI');
  });

  it.each([
    ['too short', 'abc'],
    ['non-hex characters', 'z'.repeat(64)],
    ['too long', 'b'.repeat(65)],
  ])('rejects a remote-signer pubkey that is %s', async (_label, pubkey) => {
    const { loginWithBunker } = await import('./bunkerSigner');
    await expect(
      loginWithBunker(`bunker://${pubkey}?relay=${encodeURIComponent(RELAY)}`)
    ).rejects.toThrow('Invalid bunker URI');
  });

  // The handshake signer opens sockets when it is constructed and the session
  // builds its own signer from the persisted data, so this one must not be left
  // running, on the failure path either.
  it('closes the handshake signer once the login data is captured', async () => {
    const { loginWithBunker } = await import('./bunkerSigner');

    await loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`);

    expect(bunkerInstance.close).toHaveBeenCalledTimes(1);
  });

  // Closing the signer is not enough on its own: the sockets belong to the
  // pool, so the leak this commit exists to prevent only closes if the pool is
  // destroyed too, on both paths.
  it('destroys the pool it owns once the handshake completes', async () => {
    const { loginWithBunker } = await import('./bunkerSigner');

    await loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`);

    expect(fromBunker.mock.calls[0][2].pool).toBe(poolInstance);
    expect(poolInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the pool it owns when the handshake fails', async () => {
    bunkerInstance.connect.mockRejectedValueOnce(new Error('signer unreachable'));
    const { loginWithBunker } = await import('./bunkerSigner');

    await expect(
      loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`)
    ).rejects.toThrow('signer unreachable');
    expect(poolInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('closes the handshake signer when the handshake fails', async () => {
    bunkerInstance.connect.mockRejectedValueOnce(new Error('signer unreachable'));
    const { loginWithBunker } = await import('./bunkerSigner');

    await expect(
      loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`)
    ).rejects.toThrow('signer unreachable');
    expect(bunkerInstance.close).toHaveBeenCalledTimes(1);
  });

  // The dialog's `finally` only runs when this settles. Left pending, the
  // relay having accepted the publish is enough to strand it on "Connecting…"
  // with `isLoginLoading` stuck true and no error ever rendered.
  it('fails the login rather than hanging when the signer never answers', async () => {
    vi.useFakeTimers();

    try {
      const { loginWithBunker, BUNKER_REQUEST_TIMEOUT_MS } = await import('./bunkerSigner');
      bunkerInstance.connect.mockImplementationOnce(() => new Promise<void>(() => {}));

      const pending = expect(
        loginWithBunker(`bunker://${REMOTE_PUBKEY}?relay=${encodeURIComponent(RELAY)}`)
      ).rejects.toThrow('Bunker request timed out');

      await vi.advanceTimersByTimeAsync(BUNKER_REQUEST_TIMEOUT_MS);
      await pending;
      // The handshake pool still has to come down on this path.
      expect(bunkerInstance.close).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  // `BunkerSigner` keeps its pool private and `close()` only drops the
  // subscription, so a pool it creates internally can never be released. A
  // session signer closed on logout would otherwise leave a socket per bunker
  // relay connected for the life of the tab.
  it('destroys the pool it created when the signer is closed', async () => {
    const { bunkerSignerFromLogin } = await import('./bunkerSigner');
    const signer = bunkerSignerFromLogin({
      bunkerPubkey: REMOTE_PUBKEY,
      clientNsec: nip19.nsecEncode(generateSecretKey()),
      relays: [RELAY],
    });

    expect(fromBunker.mock.calls[0][2].pool).toBe(poolInstance);

    await signer.close();

    expect(bunkerInstance.close).toHaveBeenCalledTimes(1);
    expect(poolInstance.destroy).toHaveBeenCalledTimes(1);
  });

  it('leaves a pool the caller supplied alone, since the caller still owns it', async () => {
    const { createBunkerSigner } = await import('./bunkerSigner');
    const callerPool = { destroy: vi.fn(), close: vi.fn() };

    const signer = createBunkerSigner({
      clientSecretKey: generateSecretKey(),
      bunkerPubkey: REMOTE_PUBKEY,
      relays: [RELAY],
      pool: callerPool as unknown as Parameters<typeof createBunkerSigner>[0]['pool'],
    });

    await signer.close();

    expect(callerPool.destroy).not.toHaveBeenCalled();
    expect(poolInstance.destroy).not.toHaveBeenCalled();
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

  // Stored login data is attacker-reachable if anything ever writes to
  // localStorage; a non-nsec bech32 would otherwise reach generateSecretKey's
  // consumer as a hex string instead of key bytes.
  it('refuses stored login data whose client key is not an nsec', async () => {
    const { bunkerSignerFromLogin } = await import('./bunkerSigner');
    const npub = nip19.npubEncode(REMOTE_PUBKEY);

    expect(() =>
      bunkerSignerFromLogin({
        bunkerPubkey: REMOTE_PUBKEY,
        clientNsec: npub as `nsec1${string}`,
        relays: [RELAY],
      })
    ).toThrow('Invalid client key for bunker login');
  });
});

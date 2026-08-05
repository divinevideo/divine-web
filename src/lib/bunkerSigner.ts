// ABOUTME: NIP-46 remote signer built on nostr-tools BunkerSigner
// ABOUTME: Treats auth_url challenges as prompts to surface, not terminal errors

import { BunkerSigner } from 'nostr-tools/nip46';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { SimplePool, type AbstractSimplePool } from 'nostr-tools/pool';
import type { NostrEvent, NostrSigner } from '@nostrify/nostrify';
import { presentAuthChallenge, type AuthChallengePresentation } from '@/lib/bunkerAuthChallenge';

/** Login payload shape shared with `@nostrify/react` bunker logins. */
export interface BunkerLoginData {
  bunkerPubkey: string;
  clientNsec: `nsec1${string}`;
  relays: string[];
}

export interface BunkerLogin {
  id: string;
  type: 'bunker';
  pubkey: string;
  createdAt: string;
  data: BunkerLoginData;
}

/**
 * How long a single NIP-46 request may wait for its response.
 *
 * `BunkerSigner.sendRequest` registers a listener and settles only when a
 * matching response arrives, so without a bound a signer that is unreachable —
 * but whose relay still accepts the publish — leaves the promise pending
 * forever. `loginWithBunker` never returns, `LoginDialog`'s `finally` never
 * runs, and the dialog sits on "Connecting…" with no error. The signer this
 * replaced (`NConnectSigner`, via `NLogin.fromBunker`) bounded every request at
 * the same 60s.
 */
export const BUNKER_REQUEST_TIMEOUT_MS = 60_000;

export interface CreateBunkerSignerOptions {
  /** Our half of the NIP-46 conversation. Stable across sessions. */
  clientSecretKey: Uint8Array;
  bunkerPubkey: string;
  relays: string[];
  /** Connection token from the bunker URI, when the signer issued one. */
  secret?: string | null;
  /** Called when the signer asks the user to approve out of band. */
  onAuthChallenge?: (challenge: AuthChallengePresentation) => void;
  /**
   * Relay pool to run this signer on. `BunkerSigner` opens sockets during
   * construction, so a caller that only needs a signer briefly should pass a
   * pool it owns and destroy it afterwards. `close()` drops the subscription
   * but leaves the pool's connections up.
   */
  pool?: AbstractSimplePool;
  /**
   * How long one request may wait for its response, in ms. Pass `0` to wait
   * indefinitely. Defaults to {@link BUNKER_REQUEST_TIMEOUT_MS}.
   */
  requestTimeoutMs?: number;
}

export interface BunkerNostrSigner extends NostrSigner {
  connect(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Build a signer for a NIP-46 remote signer ("bunker").
 *
 * NIP-46 lets a signer answer a request with `{result: "auth_url", error: <url>}`,
 * meaning "the user has to approve this out of band; keep listening on the same
 * request id". `nostr-tools` models that with an `onauth` hook and continues
 * waiting for the real response, which is why this is built on it: an
 * implementation that treats every non-empty `error` field as terminal both
 * fails the call and drops the subscription that the answer arrives on.
 */
export function createBunkerSigner(options: CreateBunkerSignerOptions): BunkerNostrSigner {
  const {
    clientSecretKey,
    bunkerPubkey,
    relays,
    secret = null,
    onAuthChallenge,
    pool,
    requestTimeoutMs = BUNKER_REQUEST_TIMEOUT_MS,
  } = options;

  // Every in-flight request parks a way to restart its own clock here, so an
  // auth challenge can extend them all at once.
  const restartDeadlines = new Set<() => void>();

  // Own the pool whenever the caller did not supply one. `BunkerSigner` keeps
  // its pool private and `close()` only drops the subscription, so a pool we
  // let it create internally could never be released and its sockets would
  // outlive the signer. Creating it here keeps a handle to destroy.
  const ownedPool = pool ?? new SimplePool();

  const bunker = BunkerSigner.fromBunker(
    clientSecretKey,
    { pubkey: bunkerPubkey, relays, secret },
    {
      pool: ownedPool,
      onauth: (url: string) => {
        // The signer answered, so it is reachable and the rest of the wait is
        // on a human approving out of band. Restart the clocks instead of
        // timing out with the approval tab still open.
        for (const restart of [...restartDeadlines]) {
          restart();
        }

        onAuthChallenge?.(presentAuthChallenge(url));
      },
    }
  );

  function withDeadline<T>(method: string, run: () => Promise<T>): Promise<T> {
    if (!(requestTimeoutMs > 0)) {
      return run();
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;

      function restart() {
        if (settled) return;
        clearTimeout(timer);
        timer = setTimeout(expire, requestTimeoutMs);
      }

      function release() {
        settled = true;
        clearTimeout(timer);
        restartDeadlines.delete(restart);
      }

      function expire() {
        if (settled) return;
        release();
        reject(new Error(`Bunker request timed out: ${method}`));
      }

      restartDeadlines.add(restart);
      timer = setTimeout(expire, requestTimeoutMs);

      run().then(
        (value) => {
          if (settled) return;
          release();
          resolve(value);
        },
        (error: unknown) => {
          if (settled) return;
          release();
          reject(error);
        }
      );
    });
  }

  return {
    connect: () => withDeadline('connect', () => bunker.connect()),
    close: async () => {
      await bunker.close();

      // Only what we created. A caller that passed its own pool is responsible
      // for that one, and may still be using it.
      if (!pool) {
        ownedPool.destroy();
      }
    },
    getPublicKey: () => withDeadline('get_public_key', () => bunker.getPublicKey()),
    signEvent: (event) => withDeadline('sign_event', () => bunker.signEvent(event) as Promise<NostrEvent>),
    nip04: {
      encrypt: (pubkey, plaintext) =>
        withDeadline('nip04_encrypt', () => bunker.nip04Encrypt(pubkey, plaintext)),
      decrypt: (pubkey, ciphertext) =>
        withDeadline('nip04_decrypt', () => bunker.nip04Decrypt(pubkey, ciphertext)),
    },
    nip44: {
      encrypt: (pubkey, plaintext) =>
        withDeadline('nip44_encrypt', () => bunker.nip44Encrypt(pubkey, plaintext)),
      decrypt: (pubkey, ciphertext) =>
        withDeadline('nip44_decrypt', () => bunker.nip44Decrypt(pubkey, ciphertext)),
    },
  };
}

interface ParsedBunkerUri {
  bunkerPubkey: string;
  relays: string[];
  secret: string | null;
}

/** Parse a `bunker://` URI into its pubkey, relays, and optional secret. */
export function parseBunkerUri(uri: string): ParsedBunkerUri {
  let parsed: URL;

  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('Invalid bunker URI');
  }

  if (parsed.protocol !== 'bunker:') {
    throw new Error('Invalid bunker URI');
  }

  // `bunker://<pubkey>?...` puts the pubkey in the host slot, but URL
  // lowercases the host and some signers emit it as the pathname instead.
  const bunkerPubkey = (parsed.hostname || parsed.pathname.replace(/^\/+/, '')).toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(bunkerPubkey)) {
    throw new Error('Invalid bunker URI');
  }

  const relays = parsed.searchParams.getAll('relay').filter(Boolean);

  if (!relays.length) {
    throw new Error('No relay provided');
  }

  return { bunkerPubkey, relays, secret: parsed.searchParams.get('secret') };
}

/**
 * Complete a bunker handshake and return persistable login data.
 *
 * The generated client key is returned so it can be stored: reusing it keeps
 * the same NIP-46 identity, and a fresh key on every session would read as a
 * new client to the bunker and demand approval each time.
 */
export async function loginWithBunker(
  uri: string,
  onAuthChallenge?: (challenge: AuthChallengePresentation) => void
): Promise<BunkerLogin> {
  const { bunkerPubkey, relays, secret } = parseBunkerUri(uri);

  const clientSecretKey = generateSecretKey();
  // This signer exists only to complete the handshake; the session builds its
  // own from the persisted data. Give it a pool we own so the sockets it opens
  // during construction can be released, whether or not the handshake succeeds.
  const pool = new SimplePool();
  const signer = createBunkerSigner({
    clientSecretKey,
    bunkerPubkey,
    relays,
    secret,
    onAuthChallenge,
    pool,
  });

  let pubkey: string;

  try {
    await signer.connect();
    pubkey = await signer.getPublicKey();
  } finally {
    await signer.close().catch(() => {});
    pool.destroy();
  }

  return {
    id: `bunker:${pubkey}`,
    type: 'bunker',
    pubkey,
    createdAt: new Date().toISOString(),
    data: {
      bunkerPubkey,
      clientNsec: nip19.nsecEncode(clientSecretKey),
      relays,
    },
  };
}

/**
 * Decode the client key out of stored login data.
 *
 * Separate from {@link bunkerSignerFromLogin} so a caller that only needs to
 * know whether a stored login is usable can check it without building a
 * signer — constructing one opens a socket to every relay in the login.
 */
export function clientSecretKeyFromLogin(data: BunkerLoginData): Uint8Array {
  const decoded = nip19.decode(data.clientNsec);

  if (decoded.type !== 'nsec') {
    throw new Error('Invalid client key for bunker login');
  }

  return decoded.data;
}

/** Rebuild a signer for an already-established bunker login. */
export function bunkerSignerFromLogin(
  data: BunkerLoginData,
  onAuthChallenge?: (challenge: AuthChallengePresentation) => void
): BunkerNostrSigner {
  return createBunkerSigner({
    clientSecretKey: clientSecretKeyFromLogin(data),
    bunkerPubkey: data.bunkerPubkey,
    relays: data.relays,
    onAuthChallenge,
  });
}

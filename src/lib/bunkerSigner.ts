// ABOUTME: NIP-46 remote signer built on nostr-tools BunkerSigner
// ABOUTME: Treats auth_url challenges as prompts to surface, not terminal errors

import { BunkerSigner } from 'nostr-tools/nip46';
import { generateSecretKey, nip19 } from 'nostr-tools';
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

export interface CreateBunkerSignerOptions {
  /** Our half of the NIP-46 conversation. Stable across sessions. */
  clientSecretKey: Uint8Array;
  bunkerPubkey: string;
  relays: string[];
  /** Connection token from the bunker URI, when the signer issued one. */
  secret?: string | null;
  /** Called when the signer asks the user to approve out of band. */
  onAuthChallenge?: (challenge: AuthChallengePresentation) => void;
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
  const { clientSecretKey, bunkerPubkey, relays, secret = null, onAuthChallenge } = options;

  const bunker = BunkerSigner.fromBunker(
    clientSecretKey,
    { pubkey: bunkerPubkey, relays, secret },
    {
      onauth: (url: string) => {
        onAuthChallenge?.(presentAuthChallenge(url));
      },
    }
  );

  return {
    connect: () => bunker.connect(),
    close: () => bunker.close(),
    getPublicKey: () => bunker.getPublicKey(),
    signEvent: (event) => bunker.signEvent(event) as Promise<NostrEvent>,
    nip04: {
      encrypt: (pubkey, plaintext) => bunker.nip04Encrypt(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => bunker.nip04Decrypt(pubkey, ciphertext),
    },
    nip44: {
      encrypt: (pubkey, plaintext) => bunker.nip44Encrypt(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => bunker.nip44Decrypt(pubkey, ciphertext),
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
  const signer = createBunkerSigner({
    clientSecretKey,
    bunkerPubkey,
    relays,
    secret,
    onAuthChallenge,
  });

  await signer.connect();
  const pubkey = await signer.getPublicKey();

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

/** Rebuild a signer for an already-established bunker login. */
export function bunkerSignerFromLogin(
  data: BunkerLoginData,
  onAuthChallenge?: (challenge: AuthChallengePresentation) => void
): BunkerNostrSigner {
  const decoded = nip19.decode(data.clientNsec);

  if (decoded.type !== 'nsec') {
    throw new Error('Invalid client key for bunker login');
  }

  return createBunkerSigner({
    clientSecretKey: decoded.data,
    bunkerPubkey: data.bunkerPubkey,
    relays: data.relays,
    onAuthChallenge,
  });
}

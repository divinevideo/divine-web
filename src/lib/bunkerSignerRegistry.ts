// ABOUTME: One bunker signer per login, shared by every consumer and built on first use
// ABOUTME: divine-web#531 — constructing a BunkerSigner opens sockets, so consumers must not each build their own

import {
  bunkerSignerFromLogin,
  clientSecretKeyFromLogin,
  type BunkerLoginData,
  type BunkerNostrSigner,
} from '@/lib/bunkerSigner';

interface RegisteredSigner {
  /** Connection details this signer was built for; a change invalidates it. */
  fingerprint: string;
  signer: BunkerNostrSigner;
  /** Undefined until the first request actually needs the connection. */
  connected?: BunkerNostrSigner;
}

const registry = new Map<string, RegisteredSigner>();

function fingerprintOf(data: BunkerLoginData): string {
  return JSON.stringify([data.bunkerPubkey, data.clientNsec, [...data.relays].sort()]);
}

/**
 * Wrap a login so its sockets open on the first request rather than at
 * construction.
 *
 * `createUserFromLogin` runs for every login in `useCurrentUser`, which is
 * mounted all over the app, but most of those users are never asked to sign
 * anything. `BunkerSigner.fromBunker` calls `setupSubscription` eagerly, so
 * without this an idle login costs a socket per relay for the life of the tab.
 * The signer this replaced (`NConnectSigner`) opened a REQ per request and tore
 * it down afterwards, so idle logins cost nothing there either.
 */
function lazySigner(entry: RegisteredSigner, data: BunkerLoginData): BunkerNostrSigner {
  const connect = () => (entry.connected ??= bunkerSignerFromLogin(data));

  return {
    connect: () => connect().connect(),
    getPublicKey: () => connect().getPublicKey(),
    signEvent: (event) => connect().signEvent(event),
    // Nothing to close if no request ever came through.
    close: async () => {
      await entry.connected?.close();
    },
    nip04: {
      encrypt: (pubkey, plaintext) => connect().nip04!.encrypt(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => connect().nip04!.decrypt(pubkey, ciphertext),
    },
    nip44: {
      encrypt: (pubkey, plaintext) => connect().nip44!.encrypt(pubkey, plaintext),
      decrypt: (pubkey, ciphertext) => connect().nip44!.decrypt(pubkey, ciphertext),
    },
  };
}

/**
 * The signer for a bunker login, built once and reused.
 *
 * Keyed by login id so every consumer of the same login shares one signer.
 * Building one per caller opened a socket per relay per mounted component, and
 * nothing ever closed them.
 */
export function getBunkerSigner(loginId: string, data: BunkerLoginData): BunkerNostrSigner {
  // Validate here rather than leaving it to the deferred connection: callers
  // treat a throw as "skip this login", and decoding the key opens nothing.
  // Without this an unusable login would read as valid and fail every later
  // request instead.
  clientSecretKeyFromLogin(data);

  const fingerprint = fingerprintOf(data);
  const existing = registry.get(loginId);

  if (existing) {
    if (existing.fingerprint === fingerprint) {
      return existing.signer;
    }

    // Same login id pointing at a different bunker or client key. The old
    // signer's sockets are now unreachable, so release them here.
    releaseBunkerSigner(loginId);
  }

  const entry: RegisteredSigner = { fingerprint } as RegisteredSigner;
  entry.signer = lazySigner(entry, data);
  registry.set(loginId, entry);

  return entry.signer;
}

/** Drop a login's signer and close whatever connection it had opened. */
export function releaseBunkerSigner(loginId: string): void {
  const entry = registry.get(loginId);

  if (!entry) {
    return;
  }

  registry.delete(loginId);
  // Nothing awaits a logout, and a failure to close is not actionable.
  void entry.connected?.close().catch(() => {});
}

/**
 * Release every signer whose login is no longer present.
 *
 * Reconciling against the surviving logins covers every removal path, rather
 * than depending on each logout call site to remember to release.
 */
export function releaseBunkerSignersExcept(loginIds: Iterable<string>): void {
  const keep = new Set(loginIds);

  for (const loginId of [...registry.keys()]) {
    if (!keep.has(loginId)) {
      releaseBunkerSigner(loginId);
    }
  }
}

/** Whether stored login data can produce a signer, without building one. */
export function isUsableBunkerLogin(data: BunkerLoginData): boolean {
  try {
    clientSecretKeyFromLogin(data);
    return true;
  } catch {
    return false;
  }
}

/** Test seam: forget every signer without closing anything. */
export function resetBunkerSignerRegistry(): void {
  registry.clear();
}

/** Test seam: how many logins currently hold a signer. */
export function registeredBunkerSignerCount(): number {
  return registry.size;
}

// ABOUTME: Converts bunker URL to window.nostr compatible signer
// ABOUTME: Parses bunker:// URIs and creates NIP-46 remote signing interface

import { NConnectSigner, NSecSigner, NRelay1 as NRelay, type NostrSigner } from '@nostrify/nostrify';
import { hexToBytes } from '@noble/hashes/utils';

export interface BunkerUrlParts {
  remotePubkey: string;
  relayUrl: string;
  secret: string;
}

/**
 * Parse a bunker:// URL into its components
 * @param bunkerUrl - NIP-46 bunker URL like "bunker://pubkey?relay=wss://...&secret=xyz"
 * @returns Parsed components or null if invalid
 */
export function parseBunkerUrl(bunkerUrl: string): BunkerUrlParts | null {
  try {
    // Format: bunker://pubkey?relay=wss://relay.url&secret=xyz
    const match = bunkerUrl.match(
      /^bunker:\/\/([0-9a-f]{64})\?relay=(.+?)&secret=(.+)$/
    );

    if (!match) {
      console.error('[parseBunkerUrl] Invalid bunker URL format:', bunkerUrl);
      return null;
    }

    const [, remotePubkey, relayUrl, secret] = match;

    return {
      remotePubkey,
      relayUrl: decodeURIComponent(relayUrl),
      secret,
    };
  } catch (error) {
    console.error('[parseBunkerUrl] Error parsing bunker URL:', error);
    return null;
  }
}

/**
 * Create a window.nostr compatible signer from a bunker URL
 * @param bunkerUrl - NIP-46 bunker URL
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns NostrSigner instance for remote signing
 */
export async function createWindowNostrFromBunker(
  bunkerUrl: string,
  timeout: number = 30000
): Promise<NostrSigner> {
  const parts = parseBunkerUrl(bunkerUrl);

  if (!parts) {
    throw new Error('Invalid bunker URL format');
  }

  const { remotePubkey, relayUrl, secret } = parts;

  console.log('[createWindowNostrFromBunker] Connecting to bunker:', {
    remotePubkey,
    relayUrl,
  });

  // Create relay connection
  const relay = new NRelay(relayUrl);

  // Create local signer from the connection secret
  // The secret acts as our local nsec for signing requests
  const secretBytes = hexToBytes(secret);
  const localSigner = new NSecSigner(secretBytes);

  // Create NIP-46 remote signer
  const connectSigner = new NConnectSigner({
    relay,
    pubkey: remotePubkey,
    signer: localSigner,
    timeout,
    encryption: 'nip44',
  });

  // Connect to the bunker
  try {
    await connectSigner.connect(secret);
    console.log('[createWindowNostrFromBunker] ✅ Connected to bunker!');
  } catch (error) {
    console.warn('[createWindowNostrFromBunker] Connect command failed (may be optional):', error);
    // Some bunkers don't require explicit connect, continue anyway
  }

  // Verify the connection works
  try {
    const pubkey = await connectSigner.getPublicKey();
    console.log('[createWindowNostrFromBunker] ✅ Verified bunker pubkey:', pubkey);

    if (pubkey !== remotePubkey) {
      throw new Error(
        `Bunker pubkey mismatch: expected ${remotePubkey}, got ${pubkey}`
      );
    }
  } catch (error) {
    console.error('[createWindowNostrFromBunker] Failed to verify bunker connection:', error);
    throw error;
  }

  return connectSigner;
}

// The signer this module put on window.nostr, so an extension check can tell
// the app's own signer apart from a browser extension.
let injectedSigner: NostrSigner | undefined;

/** True when window.nostr is the app's own injected signer, not an extension. */
export function isAppInjectedWindowNostr(): boolean {
  return injectedSigner !== undefined && window.nostr === injectedSigner;
}

/**
 * Inject a NostrSigner as window.nostr, unless a browser extension is there
 * @param signer - NostrSigner instance to inject
 * @returns whether the signer was injected
 */
export function injectWindowNostr(signer: NostrSigner): boolean {
  // Type window.nostr
  interface WindowWithNostr extends Window {
    nostr?: NostrSigner;
  }

  const globalWindow = window as WindowWithNostr;

  // Extension logins sign through the extension's window.nostr, so replacing
  // it would make them sign with this signer instead.
  if (globalWindow.nostr && !isAppInjectedWindowNostr()) {
    console.info('[injectWindowNostr] Left the browser extension on window.nostr');
    return false;
  }

  // Inject the signer
  globalWindow.nostr = signer;
  injectedSigner = signer;

  console.log('[injectWindowNostr] ✅ Injected window.nostr signer');

  // Dispatch event so libraries can detect window.nostr became available
  window.dispatchEvent(new Event('nostr:ready'));
  return true;
}

/**
 * Remove the signer this module injected as window.nostr
 */
export function removeWindowNostr(): void {
  interface WindowWithNostr extends Window {
    nostr?: NostrSigner;
  }

  const globalWindow = window as WindowWithNostr;

  // A browser extension that loaded after the injection has replaced it since;
  // leave that in place.
  if (isAppInjectedWindowNostr()) {
    delete globalWindow.nostr;
    console.log('[removeWindowNostr] ✅ Removed window.nostr');
  }
  injectedSigner = undefined;
}

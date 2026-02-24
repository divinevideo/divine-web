// ABOUTME: Shared NIP-98 HTTP authentication utility
// ABOUTME: Creates signed authorization headers for authenticated API calls

import { NIP98 } from '@nostrify/nostrify';
import type { NostrSigner } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

/**
 * Create a NIP-98 authorization header for an authenticated HTTP request.
 *
 * Signs a kind 27235 event with the target URL and method, then base64-encodes
 * it for use as `Authorization: Nostr <base64>`.
 *
 * @param signer - Nostr signer capable of signing events
 * @param url - The full URL being requested
 * @param method - HTTP method (GET, POST, etc.)
 * @returns The full Authorization header value, or null on failure
 */
export async function createNip98AuthHeader(
  signer: NostrSigner,
  url: string,
  method: string = 'GET',
): Promise<string | null> {
  try {
    const request = new Request(url, { method });
    const template = await NIP98.template(request);
    const signedEvent = await signer.signEvent(template);
    const encoded = btoa(JSON.stringify(signedEvent));

    debugLog(`[nip98Auth] Created auth header for ${method} ${url}`);
    return `Nostr ${encoded}`;
  } catch (error) {
    debugError('[nip98Auth] Failed to generate auth header:', error);
    return null;
  }
}

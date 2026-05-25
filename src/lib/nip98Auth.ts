// ABOUTME: Shared NIP-98 HTTP authentication utility
// ABOUTME: Creates signed authorization headers for authenticated API calls

import type { NostrSigner } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

const METHODS_WITH_PAYLOAD = new Set(['POST', 'PUT', 'PATCH']);

function normalizeUrl(url: string): string {
  const fragmentIndex = url.indexOf('#');
  return fragmentIndex === -1 ? url : url.slice(0, fragmentIndex);
}

async function sha256Hex(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create a NIP-98 authorization header for an authenticated HTTP request.
 *
 * Signs a kind 27235 event with the target URL, method, and optional payload
 * hash, then base64-encodes it for use as `Authorization: Nostr <base64>`.
 *
 * @param signer - Nostr signer capable of signing events
 * @param url - The full URL being requested
 * @param method - HTTP method (GET, POST, etc.)
 * @param body - Exact serialized request body, when present
 * @returns The full Authorization header value, or null on failure
 */
export async function createNip98AuthHeader(
  signer: NostrSigner,
  url: string,
  method: string = 'GET',
  body?: string,
): Promise<string | null> {
  try {
    const normalizedMethod = method.toUpperCase();
    const normalizedUrl = normalizeUrl(url);
    const tags: string[][] = [
      ['u', normalizedUrl],
      ['method', normalizedMethod],
    ];

    if (body !== undefined && METHODS_WITH_PAYLOAD.has(normalizedMethod)) {
      tags.push(['payload', await sha256Hex(body)]);
    }

    const template = {
      kind: 27235,
      content: '',
      tags,
      created_at: Math.floor(Date.now() / 1000),
    };
    const signedEvent = await signer.signEvent(template);
    const encoded = btoa(JSON.stringify(signedEvent));

    debugLog(`[nip98Auth] Created auth header for ${normalizedMethod} ${normalizedUrl}`);
    return `Nostr ${encoded}`;
  } catch (error) {
    debugError('[nip98Auth] Failed to generate auth header:', error);
    return null;
  }
}

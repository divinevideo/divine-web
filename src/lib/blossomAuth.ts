// ABOUTME: Shared Blossom/BUD-01 kind 24242 GET auth helper
// ABOUTME: Signs a content-addressed GET authorization event for age-gated blob fetches

import type { NostrSigner } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

const BLOSSOM_GET_KIND = 24242;
const DEFAULT_EXPIRATION_SECONDS = 60;

export async function createBlossomGetAuthHeader(
  signer: NostrSigner,
  sha256: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS,
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const template = {
      kind: BLOSSOM_GET_KIND,
      content: 'Get blob',
      tags: [
        ['t', 'get'],
        ['x', sha256],
        ['expiration', String(now + expirationSeconds)],
      ],
      created_at: now,
    };
    const signedEvent = await signer.signEvent(template);
    const encoded = btoa(JSON.stringify(signedEvent));

    debugLog(`[blossomAuth] Created GET auth header for sha256 ${sha256.slice(0, 8)}…`);
    return `Nostr ${encoded}`;
  } catch (error) {
    debugError('[blossomAuth] Failed to generate GET auth header:', error);
    return null;
  }
}

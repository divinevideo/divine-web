// ABOUTME: Single entry point for picking viewer auth on media GETs
// ABOUTME: Uses Blossom BUD-01 when the blob SHA-256 is known; falls back to NIP-98 HTTP auth

import type { NostrSigner } from '@nostrify/nostrify';
import { createBlossomGetAuthHeader } from './blossomAuth';
import { createNip98AuthHeader } from './nip98Auth';

export interface MediaViewerAuthInput {
  signer: NostrSigner | null | undefined;
  url: string;
  sha256?: string;
  method?: string;
}

const SHA256_RE = /^[0-9a-f]{64}$/i;

export async function createMediaViewerAuthHeader(
  input: MediaViewerAuthInput,
): Promise<string | null> {
  const { signer, url, sha256, method = 'GET' } = input;
  if (!signer) return null;

  if (sha256 && SHA256_RE.test(sha256)) {
    return createBlossomGetAuthHeader(signer, sha256);
  }
  return createNip98AuthHeader(signer, url, method);
}

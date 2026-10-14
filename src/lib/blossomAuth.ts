// ABOUTME: Shared Blossom/BUD-01 kind 24242 GET auth helper
// ABOUTME: Signs a content-addressed GET authorization event for age-gated blob fetches

import type { NostrSigner } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

const BLOSSOM_AUTH_KIND = 24242;
const DEFAULT_EXPIRATION_SECONDS = 60;

type BlossomAuthAction = 'get' | 'upload';

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function encodeBase64Url(value: string): string {
  return encodeBase64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createBlossomAuthHeader(
  signer: NostrSigner,
  action: BlossomAuthAction,
  sha256: string | undefined,
  expirationSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const template = {
    kind: BLOSSOM_AUTH_KIND,
    content: action === 'get' ? 'Get blob' : 'Upload blob',
    tags: [
      ['t', action],
      ...(sha256 ? [['x', sha256]] : []),
      ['expiration', String(now + expirationSeconds)],
    ],
    created_at: now,
  };
  const signedEvent = await signer.signEvent(template);
  const serializedEvent = JSON.stringify(signedEvent);
  const encodedEvent = action === 'upload'
    ? encodeBase64Url(serializedEvent)
    : encodeBase64(serializedEvent);
  return `Nostr ${encodedEvent}`;
}

export async function createBlossomGetAuthHeader(
  signer: NostrSigner,
  sha256: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS,
): Promise<string | null> {
  try {
    const header = await createBlossomAuthHeader(signer, 'get', sha256, expirationSeconds);
    debugLog('[blossomAuth] Created GET auth header for requested blob');
    return header;
  } catch (error) {
    debugError('[blossomAuth] Failed to generate GET auth header:', error);
    return null;
  }
}

export async function createBlossomUploadAuthHeader(
  signer: NostrSigner,
  sha256: string,
  expirationSeconds: number = DEFAULT_EXPIRATION_SECONDS,
): Promise<string> {
  const header = await createBlossomAuthHeader(signer, 'upload', sha256, expirationSeconds);
  debugLog('[blossomAuth] Created upload auth header for requested blob');
  return header;
}

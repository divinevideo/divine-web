// ABOUTME: Client for the identity verifier's revoke endpoint, which clears the
// ABOUTME: sign-in record for an account the user has just removed from Linked Accounts.

import type { NostrEvent } from '@nostrify/nostrify';
import { API_CONFIG } from '@/config/api';

export type SignInPlatform = 'twitter' | 'bluesky' | 'youtube' | 'tiktok';

export interface SignInRevokeRequest {
  platform: SignInPlatform;
  identity: string;
  pubkey: string;
  /** The signed kind 10011 list that was just published without the removed row. */
  list: NostrEvent;
}

export type SignInRevokeResult =
  | { revoked: true }
  | { revoked: false; code?: string; error?: string };

/**
 * Maps a claim's platform to the name the verifier accepts, or null when the
 * verifier keeps no sign-in record for it. The verifier refuses `x`.
 */
export function signInPlatform(platform: string): SignInPlatform | null {
  const name = platform.trim().toLowerCase();
  if (name === 'x') return 'twitter';
  if (name === 'twitter' || name === 'bluesky' || name === 'youtube' || name === 'tiktok') return name;
  return null;
}

/**
 * Asks the verifier to clear the sign-in record for a removed account.
 * Never rejects: the new list is already published, so a failed revoke must
 * not read as a failed removal. Callers decide how to warn on `revoked: false`.
 */
export async function revokeSignInLink(request: SignInRevokeRequest): Promise<SignInRevokeResult> {
  const { baseUrl, timeout, endpoints } = API_CONFIG.verificationService;
  if (!baseUrl) return { revoked: false };

  const failure: { code?: string; error?: string } = {};
  try {
    const response = await fetch(`${baseUrl}${endpoints.revoke}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: request.platform,
        identity: request.identity,
        pubkey: request.pubkey,
        list: request.list,
      }),
      signal: AbortSignal.timeout(timeout),
    });
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      const { revoked, code, error } = body as {
        revoked?: unknown;
        code?: unknown;
        error?: unknown;
      };
      if (response.ok && revoked === true) return { revoked: true };
      if (typeof code === 'string') failure.code = code;
      if (typeof error === 'string') failure.error = error;
    }
  } catch {
    // Network failure, timeout or a body that is not JSON: not cleared.
  }
  return { revoked: false, ...failure };
}

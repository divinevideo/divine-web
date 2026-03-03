// ABOUTME: Hook to fetch and parse NIP-39 external identity claims (kind 10011)
// ABOUTME: Returns linked accounts with platform, identity, and proof info for a given pubkey

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { getCachedVerification, setCachedVerification } from '@/lib/verificationCache';
import { API_CONFIG, getFeatureFlag } from '@/config/api';

export interface ExternalIdentity {
  platform: string;
  identity: string;
  proof: string;
  profileUrl: string;
  proofUrl: string;
}

export interface PlatformConfig {
  label: string;
  profileUrl: (identity: string) => string;
  proofUrl: (identity: string, proof: string) => string;
  verificationText: (npub: string) => string[];
  /** URL to help user create the proof post */
  createProofUrl?: (identity: string, npub: string) => string;
  /** Whether verification can be done via browser fetch (CORS-friendly) */
  canVerifyInBrowser: boolean;
}

/** Well-known platforms with their profile URL patterns per NIP-39 */
const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  github: {
    label: 'GitHub',
    profileUrl: (id) => `https://github.com/${id}`,
    proofUrl: (id, proof) => `https://gist.github.com/${id}/${proof}`,
    verificationText: (npub) => [
      `Verifying that I control the following Nostr public key: ${npub}`,
    ],
    createProofUrl: () => 'https://gist.github.com/',
    canVerifyInBrowser: true,
  },
  twitter: {
    label: 'Twitter / X',
    profileUrl: (id) => `https://twitter.com/${id}`,
    proofUrl: (id, proof) => `https://twitter.com/${id}/status/${proof}`,
    verificationText: (npub) => [
      `Verifying my account on nostr My Public Key: "${npub}"`,
      `Verifying that I control the following Nostr public key: "${npub}"`,
    ],
    createProofUrl: (_id, npub) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Verifying my account on nostr My Public Key: "${npub}"`)}`,
    canVerifyInBrowser: false,
  },
  mastodon: {
    label: 'Mastodon',
    // NIP-39 identity format: "instance/@username" e.g. "bitcoinhackers.org/@semisol"
    profileUrl: (id) => {
      // id = "instance/@username"
      return `https://${id}`;
    },
    proofUrl: (id, proof) => {
      // id = "instance/@username", proof = post ID
      // URL: https://instance/@username/postId
      return `https://${id}/${proof}`;
    },
    verificationText: (npub) => [
      `Verifying that I control the following Nostr public key: "${npub}"`,
    ],
    canVerifyInBrowser: false,
  },
  telegram: {
    label: 'Telegram',
    // NIP-39 identity: Telegram user ID (numeric)
    profileUrl: (id) => `https://t.me/${id}`,
    // NIP-39 proof format: "ref/id" e.g. "channel/123"
    proofUrl: (_id, proof) => `https://t.me/${proof}`,
    verificationText: (npub) => [
      `Verifying that I control the following Nostr public key: ${npub}`,
    ],
    canVerifyInBrowser: false,
  },
  bluesky: {
    label: 'Bluesky',
    profileUrl: (id) => `https://bsky.app/profile/${id}`,
    proofUrl: (id, proof) => `https://bsky.app/profile/${id}/post/${proof}`,
    verificationText: (npub) => [
      `Verifying that I control the following Nostr public key: "${npub}"`,
    ],
    canVerifyInBrowser: false,
  },
};

export const SUPPORTED_PLATFORMS = PLATFORM_CONFIG;

export function parseIdentityTag(tag: string[]): ExternalIdentity | null {
  if (tag[0] !== 'i' || !tag[1]) return null;

  const colonIndex = tag[1].indexOf(':');
  if (colonIndex === -1) return null;

  const platform = tag[1].slice(0, colonIndex).toLowerCase();
  const identity = tag[1].slice(colonIndex + 1);
  const proof = tag[2] || '';

  const config = PLATFORM_CONFIG[platform];

  return {
    platform,
    identity,
    proof,
    profileUrl: config ? config.profileUrl(identity) : '',
    proofUrl: config && proof ? config.proofUrl(identity, proof) : '',
  };
}

export function useExternalIdentities(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['external-identities', pubkey],
    queryFn: async ({ signal }) => {
      if (!pubkey || !nostr) return [];

      const events = await nostr.query(
        [{ kinds: [10011], authors: [pubkey], limit: 1 }],
        { signal },
      );

      if (events.length === 0) return [];

      // Replaceable event — take the most recent
      const event = events.sort((a, b) => b.created_at - a.created_at)[0];

      const identities: ExternalIdentity[] = [];
      for (const tag of event.tags) {
        const parsed = parseIdentityTag(tag);
        if (parsed) identities.push(parsed);
      }

      return identities;
    },
    enabled: !!pubkey && !!nostr,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Verify an external identity claim by fetching the proof URL and checking for npub.
 * Checks localStorage cache first, then tries external verification service,
 * then falls back to browser-based verification (GitHub only).
 * For other platforms without service, returns 'manual'.
 */
export async function verifyIdentityClaim(
  identity: ExternalIdentity,
  pubkey: string,
): Promise<{ verified: boolean; error?: string }> {
  if (!identity.proofUrl) {
    return { verified: false, error: 'No proof URL' };
  }

  const config = PLATFORM_CONFIG[identity.platform];
  if (!config) {
    return { verified: false, error: 'Unknown platform' };
  }

  // Check localStorage cache first
  const cached = getCachedVerification(identity.platform, identity.identity, identity.proof);
  if (cached) return cached;

  // Try verification service if available
  const serviceResult = await verifyViaService(identity, pubkey);
  if (serviceResult) {
    setCachedVerification(identity.platform, identity.identity, identity.proof, serviceResult);
    return serviceResult;
  }

  // Only attempt browser-based verification for CORS-friendly platforms
  if (!config.canVerifyInBrowser) {
    return { verified: false, error: 'manual' };
  }

  const npub = nip19.npubEncode(pubkey);

  try {
    // GitHub gists: use the API which is CORS-friendly
    const url = identity.platform === 'github'
      ? `https://api.github.com/gists/${identity.proof}`
      : identity.proofUrl;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const result = { verified: false, error: `HTTP ${response.status}` };
      setCachedVerification(identity.platform, identity.identity, identity.proof, result);
      return result;
    }

    const text = await response.text();
    const expectedTexts = config.verificationText(npub);

    const found = expectedTexts.some((expected) => text.includes(expected));
    const result = { verified: found, error: found ? undefined : 'npub not found in proof' };
    setCachedVerification(identity.platform, identity.identity, identity.proof, result);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    return { verified: false, error: message };
  }
}

/**
 * Try to verify via external verification service.
 * Returns null if service is unavailable or feature flag is off.
 */
async function verifyViaService(
  identity: ExternalIdentity,
  pubkey: string,
): Promise<{ verified: boolean; error?: string } | null> {
  const baseUrl = API_CONFIG.verificationService.baseUrl;
  if (!baseUrl || !getFeatureFlag('useVerificationService')) return null;

  try {
    const response = await fetch(`${baseUrl}${API_CONFIG.verificationService.endpoints.verify}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: identity.platform,
        identity: identity.identity,
        proof: identity.proof,
        pubkey,
      }),
      signal: AbortSignal.timeout(API_CONFIG.verificationService.timeout),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return { verified: !!data.verified, error: data.error };
  } catch {
    return null; // Service unavailable, fall through to browser verification
  }
}

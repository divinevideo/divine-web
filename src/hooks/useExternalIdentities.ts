// ABOUTME: Hook to fetch and parse NIP-39 external identity claims (kind 10011)
// ABOUTME: Returns linked accounts with platform, identity, and proof info for a given pubkey

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';

export interface ExternalIdentity {
  platform: string;
  identity: string;
  proof: string;
  profileUrl: string;
  proofUrl: string;
}

/** Well-known platforms with their profile URL patterns */
const PLATFORM_CONFIG: Record<string, {
  label: string;
  profileUrl: (identity: string) => string;
  proofUrl: (identity: string, proof: string) => string;
  verificationText: (npub: string) => string[];
}> = {
  github: {
    label: 'GitHub',
    profileUrl: (id) => `https://github.com/${id}`,
    proofUrl: (id, proof) => `https://gist.github.com/${id}/${proof}`,
    verificationText: (npub) => [
      `Verifying that I control the following Nostr public key: ${npub}`,
    ],
  },
  twitter: {
    label: 'Twitter',
    profileUrl: (id) => `https://twitter.com/${id}`,
    proofUrl: (id, proof) => `https://twitter.com/${id}/status/${proof}`,
    verificationText: (npub) => [
      `Verifying my account on nostr My Public Key: "${npub}"`,
      `Verifying that I control the following Nostr public key: "${npub}"`,
    ],
  },
  mastodon: {
    label: 'Mastodon',
    profileUrl: (id) => `https://${id}`,
    proofUrl: (id, proof) => `https://${id}/${proof}`,
    verificationText: (npub) => [
      `Verifying that I control the following Nostr public key: "${npub}"`,
    ],
  },
  telegram: {
    label: 'Telegram',
    profileUrl: (id) => `https://t.me/${id}`,
    proofUrl: (_id, proof) => `https://t.me/${proof}`,
    verificationText: (npub) => [npub],
  },
};

export const SUPPORTED_PLATFORMS = PLATFORM_CONFIG;

function parseIdentityTag(tag: string[]): ExternalIdentity | null {
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
 * Returns true if verified, false otherwise.
 * This is called on-demand (lazy verification) to avoid rate-limiting.
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

  const npub = nip19.npubEncode(pubkey);

  try {
    // For GitHub gists, use the API which is CORS-friendly
    let url = identity.proofUrl;
    if (identity.platform === 'github') {
      url = `https://api.github.com/gists/${identity.proof}`;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { verified: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    const expectedTexts = config.verificationText(npub);

    const found = expectedTexts.some((expected) => text.includes(expected));
    return { verified: found, error: found ? undefined : 'npub not found in proof' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fetch failed';
    return { verified: false, error: message };
  }
}

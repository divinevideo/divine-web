// ABOUTME: Hook to resolve user profile URLs
// ABOUTME: Returns subdomain URL when user has verified divine.video NIP-05, otherwise /profile/{npub}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { getDivineNip05Info } from '@/lib/nip05Utils';

export interface ProfileUrlResult {
  url: string;
  isSubdomain: boolean;
  isLoading: boolean;
}

function useDivineNip05Validation(nip05: string, pubkey: string) {
  return useQuery({
    queryKey: ['nip05-validation', nip05, pubkey],
    queryFn: async ({ signal }) => {
      const atIndex = nip05.lastIndexOf('@');
      if (atIndex === -1) return false;

      const name = nip05.slice(0, atIndex) || '_';
      const domain = nip05.slice(atIndex + 1);

      if (!domain) return false;

      const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
      const response = await fetch(url, {
        signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return false;

      const data = await response.json();
      const verifiedPubkey = data?.names?.[name];
      return verifiedPubkey === pubkey;
    },
    enabled: !!nip05 && !!pubkey,
    staleTime: 300000,
    gcTime: 900000,
    retry: false,
  });
}

/**
 * Resolve a user's pubkey and optional NIP-05 to a profile URL.
 *
 * When the user has a verified divine.video NIP-05, returns the subdomain URL
 * (e.g., https://alice.divine.video) which SmartLink will convert appropriately.
 * Otherwise returns /profile/{npub}.
 *
 * @param pubkey - Hex pubkey of the user
 * @param nip05 - Optional NIP-05 from user metadata (faster resolution if provided)
 */
export function useProfileUrl(
  pubkey: string,
  nip05?: string | null
): ProfileUrlResult {
  const npub = useMemo(() => nip19.npubEncode(pubkey), [pubkey]);
  const defaultUrl = `/profile/${npub}`;

  // Only call validation hook when nip05 is available
  const validationEnabled = !!nip05;
  const validation = useDivineNip05Validation(nip05 || '', pubkey);

  const result = useMemo(() => {
    // No NIP-05 provided - use default immediately
    if (!nip05) {
      return { url: defaultUrl, isSubdomain: false, isLoading: false };
    }

    // Query not enabled or still loading - use default
    if (!validationEnabled || validation.isLoading) {
      return { url: defaultUrl, isSubdomain: false, isLoading: true };
    }

    // Validation failed (fetched but pubkey didn't match) - use default
    if (validation.isFetched && validation.data === false) {
      return { url: defaultUrl, isSubdomain: false, isLoading: false };
    }

    // Valid NIP-05 - check if it's a divine NIP-05
    const divineInfo = getDivineNip05Info(nip05);
    if (divineInfo) {
      return { url: defaultUrl, isSubdomain: true, isLoading: false };
    }

    // Valid NIP-05 but not divine.video - use default
    return { url: defaultUrl, isSubdomain: false, isLoading: false };
  }, [nip05, validationEnabled, validation.isLoading, validation.isFetched, validation.data, defaultUrl]);

  return result;
}
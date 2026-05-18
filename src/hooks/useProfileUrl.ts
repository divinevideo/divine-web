// ABOUTME: Hook to resolve user profile URLs
// ABOUTME: Returns subdomain URL when user has verified divine.video NIP-05, otherwise /profile/{npub}

import { useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { getDivineNip05Info } from '@/lib/nip05Utils';
import { useNip05Validation } from '@/hooks/useNip05Validation';

export interface ProfileUrlResult {
  url: string;
  isSubdomain: boolean;
  isLoading: boolean;
}

export function useProfileUrl(
  pubkey: string,
  nip05?: string | null
): ProfileUrlResult {
  const npub = useMemo(() => nip19.npubEncode(pubkey), [pubkey]);
  const defaultUrl = `/profile/${npub}`;
  const validation = useNip05Validation(nip05 ?? undefined, pubkey);

  return useMemo(() => {
    if (!nip05 || !validation.isValid) {
      return { url: defaultUrl, isSubdomain: false, isLoading: validation.isLoading };
    }

    const divineInfo = getDivineNip05Info(nip05);
    if (divineInfo) {
      return { url: divineInfo.href, isSubdomain: true, isLoading: false };
    }

    return { url: defaultUrl, isSubdomain: false, isLoading: false };
  }, [nip05, validation.isValid, validation.isLoading, defaultUrl]);
}
// ABOUTME: Hook to resolve user profile URLs
// ABOUTME: Returns subdomain URL when user has verified divine.video NIP-05, otherwise /profile/{npub}

import { useState, useEffect, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { getDivineNip05Info } from '@/lib/nip05Utils';

export interface ProfileUrlResult {
  url: string;
  isSubdomain: boolean;
  isLoading: boolean;
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

  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsValid(null);

    if (!nip05) {
      return;
    }

    const atIndex = nip05.lastIndexOf('@');
    if (atIndex === -1) {
      return;
    }

    const name = nip05.slice(0, atIndex) || '_';
    const domain = nip05.slice(atIndex + 1);

    if (!domain) {
      return;
    }

    setIsLoading(true);

    const controller = new AbortController();
    const signal = controller.signal;

    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;

    fetch(url, { signal, headers: { 'Accept': 'application/json' } })
      .then(response => {
        if (!response.ok) throw new Error('Not ok');
        return response.json();
      })
      .then(data => {
        const verifiedPubkey = data?.names?.[name];
        setIsValid(verifiedPubkey === pubkey);
        setIsLoading(false);
      })
      .catch(err => {
        if (err.name === 'AbortError') return;
        setIsValid(false);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [nip05, pubkey]);

  const result = useMemo(() => {
    if (!nip05) {
      return { url: defaultUrl, isSubdomain: false, isLoading: false };
    }

    if (isLoading) {
      return { url: defaultUrl, isSubdomain: false, isLoading: true };
    }

    if (isValid === false) {
      return { url: defaultUrl, isSubdomain: false, isLoading: false };
    }

    const divineInfo = getDivineNip05Info(nip05);
    if (divineInfo) {
      return { url: defaultUrl, isSubdomain: true, isLoading: false };
    }

    return { url: defaultUrl, isSubdomain: false, isLoading: false };
  }, [nip05, isValid, isLoading, defaultUrl]);

  return result;
}
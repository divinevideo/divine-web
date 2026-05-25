// ABOUTME: Hook to validate NIP-05 identifiers
// ABOUTME: Only shows NIP-05 badge after verification succeeds

import { useQuery } from '@tanstack/react-query';
import { debugLog } from '@/lib/debug';

type ValidationState = 'loading' | 'valid' | 'invalid' | 'idle';

interface Nip05ValidationResult {
  isValid: boolean;
  isLoading: boolean;
  isInvalid: boolean;
  state: ValidationState;
  nip05: string | undefined;
}

/**
 * Validate a NIP-05 identifier by checking the .well-known/nostr.json endpoint
 *
 * NIP-05 format: name@domain or _@domain
 * Verification: GET https://domain/.well-known/nostr.json?name=name
 * Response should contain: { "names": { "name": "pubkey" } }
 */
export function useNip05Validation(
  nip05: string | undefined,
  pubkey: string
): Nip05ValidationResult {
  const query = useQuery({
    queryKey: ['nip05-validation', nip05, pubkey],
    queryFn: async ({ signal }) => {
      if (!nip05 || !pubkey) return false;

      // Parse NIP-05: name@domain
      const atIndex = nip05.lastIndexOf('@');
      if (atIndex === -1) {
        debugLog(`[useNip05Validation] Invalid NIP-05 format: ${nip05}`);
        return false;
      }

      const name = nip05.slice(0, atIndex) || '_';
      const domain = nip05.slice(atIndex + 1);

      if (!domain) {
        debugLog(`[useNip05Validation] Missing domain in NIP-05: ${nip05}`);
        return false;
      }

      try {
        const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
        debugLog(`[useNip05Validation] Fetching: ${url}`);

        const response = await fetch(url, {
          signal,
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          debugLog(`[useNip05Validation] HTTP error: ${response.status}`);
          return false;
        }

        const data = await response.json();
        const verifiedPubkey = data?.names?.[name];

        if (verifiedPubkey === pubkey) {
          debugLog(`[useNip05Validation] Valid NIP-05: ${nip05}`);
          return true;
        }

        debugLog(`[useNip05Validation] Pubkey mismatch for ${nip05}: expected ${pubkey}, got ${verifiedPubkey}`);
        return false;
      } catch (err) {
        debugLog(`[useNip05Validation] Error validating ${nip05}:`, err);
        return false;
      }
    },
    enabled: !!nip05 && !!pubkey,
    staleTime: 300000, // 5 minutes - NIP-05 doesn't change often
    gcTime: 900000,    // 15 minutes
    retry: false,      // Don't retry - if it fails, don't show it
  });

  // Determine validation state
  const isValid = query.data === true;
  const isInvalid = query.isFetched && query.data === false;
  const isLoading = query.isLoading;

  let state: ValidationState = 'idle';
  if (!nip05) {
    state = 'idle';
  } else if (isLoading) {
    state = 'loading';
  } else if (isValid) {
    state = 'valid';
  } else if (isInvalid) {
    state = 'invalid';
  }

  return {
    isValid,
    isLoading,
    isInvalid,
    state,
    nip05,
  };
}

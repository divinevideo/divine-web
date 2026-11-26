// ABOUTME: Hook to validate NIP-05 identifiers
// ABOUTME: Only shows NIP-05 badge after verification succeeds

import { useQuery } from '@tanstack/react-query';
import { nip05QueryOptions } from '@/lib/nip05Query';

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
    ...nip05QueryOptions(nip05),
    enabled: !!nip05 && !!pubkey,
  });

  // Determine validation state
  const hasFreshResult = !!nip05 && !!pubkey && query.isSuccess && !query.isStale;
  const isValid = hasFreshResult && query.data === pubkey.toLowerCase();
  const isInvalid = hasFreshResult && !isValid;
  const isLoading = query.isLoading || (query.isFetching && !hasFreshResult);

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

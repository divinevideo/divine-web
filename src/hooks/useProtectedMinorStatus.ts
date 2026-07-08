// ABOUTME: React Query hook exposing the non-blocking protected-minor (13-15)
// ABOUTME: state from keycast's verified_minor flag, for #175/#176 web parity.

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDivineSession } from '@/hooks/useDivineSession';
import { decodeJWT } from '@/lib/jwtDecode';
import {
  fetchProtectedMinorStatus,
  NOT_PROTECTED,
  type ProtectedMinorStatus,
  UNKNOWN_PROTECTED_MINOR_STATUS,
} from '@/lib/protectedMinor';
import {
  readLastKnownProtected,
  writeLastKnownProtected,
} from '@/lib/protectedMinorStickyStore';

// Fail-safe fallback returned when the live check is `unknown` but this account
// was last seen `protected` (#180). verifiedMinorAt is not persisted; safety
// gates only read `isProtectedMinor`/`state`.
const PROTECTED_STICKY: ProtectedMinorStatus = Object.freeze({
  state: 'protected',
  isProtectedMinor: true,
  isKnown: true,
  verifiedMinorAt: null,
});

/** Stable per-account id (JWT `sub`) for keying the sticky store; null when the
 *  token isn't a decodable JWT. */
function accountIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    return decodeJWT(token).sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Non-blocking protected-minor state for the current session.
 *
 * Signed-out sessions resolve to {@link NOT_PROTECTED}; authenticated sessions
 * with loading or failed checks resolve to {@link UNKNOWN_PROTECTED_MINOR_STATUS}
 * so protections in #175/#176 can fail closed while this detection-only PR stays
 * non-blocking. Keyed on the session token, so it refetches when the account
 * changes; invalidate `['protected-minor']` if fresh state is needed mid-session.
 */
export function useProtectedMinorStatus(): ProtectedMinorStatus {
  const { session } = useDivineSession();
  const token = session?.token ?? null;
  const accountId = accountIdFromToken(token);

  // queryFn never throws, so a transient failure resolves to an explicit unknown
  // state. staleTime 0 + refetch-on-focus keep the LIVE value fresh; the sticky
  // store below (not React Query) provides the fail-safe persistence.
  const { data } = useQuery({
    queryKey: ['protected-minor', token],
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) =>
      fetchProtectedMinorStatus(token ?? '', fetch, signal),
  });

  const live: ProtectedMinorStatus = !token
    ? NOT_PROTECTED
    : (data ?? UNKNOWN_PROTECTED_MINOR_STATUS);

  // #180: persist a definitive verdict so a later `unknown` can fall back to it
  // instead of failing open. A focus-refetch that resolves to `unknown` is
  // written over the prior `protected` by React Query (queryFn never throws);
  // without this, protection lifts on every failed refocus. `unknown` never
  // writes, so a stored `protected` is never overwritten.
  useEffect(() => {
    if (!accountId) return;
    if (live.state === 'protected') {
      writeLastKnownProtected(accountId, 'protected');
    } else if (live.state === 'not_protected') {
      writeLastKnownProtected(accountId, 'not_protected');
    }
  }, [accountId, live.state]);

  if (!token) return NOT_PROTECTED;
  if (live.state !== 'unknown') return live;

  // Unknown: fall back to the last-known verdict; fail CLOSED (stay unknown)
  // when this account was never positively seen.
  if (accountId) {
    const lastKnown = readLastKnownProtected(accountId);
    if (lastKnown === 'protected') return PROTECTED_STICKY;
    if (lastKnown === 'not_protected') return NOT_PROTECTED;
  }
  return UNKNOWN_PROTECTED_MINOR_STATUS;
}

/** Convenience boolean for display-only callers; safety gates should inspect state. */
export function useIsProtectedMinor(): boolean {
  return useProtectedMinorStatus().isProtectedMinor;
}

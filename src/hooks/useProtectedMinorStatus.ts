// ABOUTME: React Query hook exposing the non-blocking protected-minor (13-15)
// ABOUTME: state from keycast's verified_minor flag, for #175/#176 web parity.

import { useQuery } from '@tanstack/react-query';
import { useDivineSession } from '@/hooks/useDivineSession';
import {
  fetchProtectedMinorStatus,
  NOT_PROTECTED,
  type ProtectedMinorStatus,
  UNKNOWN_PROTECTED_MINOR_STATUS,
} from '@/lib/protectedMinor';

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

  // queryFn never throws, so a transient failure resolves to an explicit unknown
  // state. Keep that self-healing rather than sticky: set staleTime 0 +
  // refetch-on-focus explicitly here, overriding the app-global defaults
  // (staleTime 60s, refetchOnWindowFocus false) which would otherwise pin a
  // failed check for the mounted lifetime.
  const { data } = useQuery({
    queryKey: ['protected-minor', token],
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) =>
      fetchProtectedMinorStatus(token ?? '', fetch, signal),
  });

  if (!token) return NOT_PROTECTED;
  return data ?? UNKNOWN_PROTECTED_MINOR_STATUS;
}

/** Convenience boolean for display-only callers; safety gates should inspect state. */
export function useIsProtectedMinor(): boolean {
  return useProtectedMinorStatus().isProtectedMinor;
}

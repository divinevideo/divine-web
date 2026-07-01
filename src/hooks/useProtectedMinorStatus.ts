// ABOUTME: React Query hook exposing the non-blocking protected-minor (13-15)
// ABOUTME: state from keycast's verified_minor flag, for #175/#176 web parity.

import { useQuery } from '@tanstack/react-query';
import { useDivineSession } from '@/hooks/useDivineSession';
import {
  fetchProtectedMinorStatus,
  NOT_PROTECTED,
  type ProtectedMinorStatus,
} from '@/lib/protectedMinor';

/**
 * Non-blocking protected-minor state for the current session.
 *
 * Signed-out sessions and any fetch failure resolve to {@link NOT_PROTECTED}
 * (#452 is detection-only; web protections in #175/#176 set their own fail-safe
 * posture). Keyed on the session token, so it refetches when the account
 * changes; invalidate `['protected-minor']` if fresh state is needed mid-session
 * (e.g. right after an approval).
 */
export function useProtectedMinorStatus(): ProtectedMinorStatus {
  const { session } = useDivineSession();
  const token = session?.token ?? null;

  // queryFn never throws, so a transient failure resolves to NOT_PROTECTED. Keep
  // that self-healing rather than sticky: set staleTime 0 + refetch-on-focus
  // explicitly here, overriding the app-global defaults (staleTime 60s,
  // refetchOnWindowFocus false) which would otherwise pin a false-negative for
  // the mounted lifetime. Protections (#175/#176) lean on this seam, so a stale
  // "not protected" must recover on the next mount or focus.
  const { data } = useQuery({
    queryKey: ['protected-minor', token],
    enabled: !!token,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) =>
      fetchProtectedMinorStatus(token as string, fetch, signal),
  });

  return data ?? NOT_PROTECTED;
}

/** Convenience boolean seam for the web protections (#175/#176). */
export function useIsProtectedMinor(): boolean {
  return useProtectedMinorStatus().isProtectedMinor;
}

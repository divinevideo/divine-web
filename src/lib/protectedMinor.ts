// ABOUTME: Reads the keycast verified_minor flag (GET /user/account) and maps it
// ABOUTME: to a non-blocking protected-minor (13-15) state for web (#452 / #174).

import { DIVINE_LOGIN_ORIGIN } from './divineLoginOrigin';

export interface ProtectedMinorStatus {
  isProtectedMinor: boolean;
  verifiedMinorAt: Date | null;
}

// Frozen so this shared sentinel can't be mutated by a consumer and poisoned
// for every other caller (it's returned by reference from the lib and hook).
export const NOT_PROTECTED: ProtectedMinorStatus = Object.freeze({
  isProtectedMinor: false,
  verifiedMinorAt: null,
});

function parseVerifiedMinorAt(raw: unknown): Date | null {
  if (typeof raw !== 'string') return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fetches the protected-minor state from keycast for the given session token.
 *
 * Reads `verified_minor` from `GET /user/account` (keycast#263). Any failure —
 * non-ok response, network error, or an empty (signed-out) token — resolves to
 * {@link NOT_PROTECTED}: #452 is detection-only, so it fails to not-protected.
 */
export async function fetchProtectedMinorStatus(
  token: string,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProtectedMinorStatus> {
  if (!token) return NOT_PROTECTED;
  try {
    const response = await fetchImpl(`${DIVINE_LOGIN_ORIGIN}/api/user/account`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
    if (!response.ok) return NOT_PROTECTED;

    const body = (await response.json()) as {
      verified_minor?: unknown;
      verified_minor_at?: unknown;
    };
    if (body.verified_minor !== true) return NOT_PROTECTED;

    return {
      isProtectedMinor: true,
      verifiedMinorAt: parseVerifiedMinorAt(body.verified_minor_at),
    };
  } catch {
    return NOT_PROTECTED;
  }
}

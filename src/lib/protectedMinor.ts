// ABOUTME: Reads the keycast verified_minor flag (GET /api/user/account) and maps
// ABOUTME: it to a non-blocking protected-minor (13-15) state for web (#452 / #174).

import { DIVINE_LOGIN_ORIGIN } from './divineLoginOrigin';

export interface ProtectedMinorStatus {
  state: 'protected' | 'not_protected' | 'unknown';
  isKnown: boolean;
  verifiedMinorAt: Date | null;
}

export type ProtectedMinorState = ProtectedMinorStatus['state'];

/**
 * DM-restriction verdict for the safety gates (#176). Fails CLOSED: only a
 * positive `not_protected` verdict lifts the restriction, so `unknown`
 * (cold start, keycast failure) restricts exactly like `protected`. Signed-out
 * sessions resolve to {@link NOT_PROTECTED} upstream and are never restricted.
 */
export function isMinorDmRestricted(state: ProtectedMinorState): boolean {
  return state !== 'not_protected';
}

/**
 * Key-handover verdict for #182: whether the current account may be offered
 * raw-key affordances (nsec backup/copy/download, key-import sign-in methods).
 * Same fail-closed posture as {@link isMinorDmRestricted} — only a positive
 * `not_protected` verdict lifts it — but a separate predicate so the key and
 * DM policies can diverge without silently coupling.
 */
export function isMinorKeyHandoverRestricted(state: ProtectedMinorState): boolean {
  return state !== 'not_protected';
}

// Frozen so this shared sentinel can't be mutated by a consumer and poisoned
// for every other caller (it's returned by reference from the lib and hook).
export const NOT_PROTECTED: ProtectedMinorStatus = Object.freeze({
  state: 'not_protected',
  isKnown: true,
  verifiedMinorAt: null,
});

export const UNKNOWN_PROTECTED_MINOR_STATUS: ProtectedMinorStatus = Object.freeze({
  state: 'unknown',
  isKnown: false,
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
 * Reads `verified_minor` from `GET /api/user/account` (keycast#263). Empty
 * tokens are confirmed signed-out/not-protected; network/API failures resolve
 * to {@link UNKNOWN_PROTECTED_MINOR_STATUS} so safety gates can choose their own
 * fail-safe posture.
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
    if (!response.ok) return UNKNOWN_PROTECTED_MINOR_STATUS;

    const body = (await response.json()) as unknown;
    // A malformed 200 (non-object body — an error page, truncated response, or
    // a bare primitive) carries no trustworthy signal. Only a well-formed object
    // with an explicit verified_minor is authoritative; otherwise stay unknown
    // so the sticky store's last-known `protected` is never overwritten by junk.
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return UNKNOWN_PROTECTED_MINOR_STATUS;
    }
    const account = body as {
      verified_minor?: unknown;
      verified_minor_at?: unknown;
    };
    if (account.verified_minor === true) {
      return {
        state: 'protected',
        isKnown: true,
        verifiedMinorAt: parseVerifiedMinorAt(account.verified_minor_at),
      };
    }
    // Fail closed on schema drift: a truthy non-boolean verified_minor (e.g.
    // the string "true") is not a trustworthy negative, so it must not lift
    // protection. Absent or false stays a positive not_protected — keycast
    // omits the flag for ordinary accounts, so treating absence as unknown
    // would restrict every adult.
    return account.verified_minor
      ? UNKNOWN_PROTECTED_MINOR_STATUS
      : NOT_PROTECTED;
  } catch {
    return UNKNOWN_PROTECTED_MINOR_STATUS;
  }
}

// ABOUTME: Persistent last-known protected-minor status (#176/#180 web). Fail-safe
// ABOUTME: backing for useProtectedMinorStatus: remembers a definitive verdict per
// ABOUTME: account so an `unknown` (refetch failure) never lifts a prior `protected`.

/** Only definitive verdicts are stored; `unknown` never writes. */
export type LastKnownProtected = 'protected' | 'not_protected';

const KEY_PREFIX = 'protected_minor_sticky_';

function defaultStorage(): Storage | undefined {
  return typeof localStorage !== 'undefined' ? localStorage : undefined;
}

/**
 * Last-known definitive verdict for [accountId] (the JWT `sub`, stable across
 * token refresh), or `null` when never seen. Keyed per account so a stale
 * verdict from a previous account is never consulted.
 */
export function readLastKnownProtected(
  accountId: string,
  storage: Storage | undefined = defaultStorage(),
): LastKnownProtected | null {
  const raw = storage?.getItem(KEY_PREFIX + accountId);
  return raw === 'protected' || raw === 'not_protected' ? raw : null;
}

/**
 * Persist a definitive verdict. Callers must NOT pass `unknown` — the whole
 * point is that an unknown never overwrites a stored `protected`.
 */
export function writeLastKnownProtected(
  accountId: string,
  state: LastKnownProtected,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(KEY_PREFIX + accountId, state);
  } catch {
    // Storage full/unavailable: skip persistence. Safety is unaffected — the
    // hook falls back to the fail-closed `unknown` default.
  }
}

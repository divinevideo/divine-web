// ABOUTME: Pure precedence rules for resolving the active user(s) across a hosted
// JWT session and manual (extension/bunker/nsec) logins. Extracted from
// useCurrentUser so the three JWT states are exhaustively testable.

/**
 * Decide which logins are "current", given the hosted-JWT session state and the
 * available manual logins.
 *
 * - No hosted token: manual logins are authoritative.
 * - JWT resolved (`jwtUser` set): it takes precedence over manual logins.
 * - JWT failed (`jwtError`): fall back to manual logins so a valid bunker/
 *   extension login keeps working instead of appearing logged out.
 * - JWT still resolving: return none yet. Callers use `isJwtResolving` to avoid
 *   treating this transient state as "logged out". We deliberately do NOT fall
 *   back to manual here, to avoid flashing a different identity mid-resolve.
 */
export function selectCurrentUsers<U>(opts: {
  hasToken: boolean;
  jwtUser: U | undefined;
  jwtError: boolean;
  manualUsers: U[];
}): U[] {
  const { hasToken, jwtUser, jwtError, manualUsers } = opts;
  if (!hasToken) return manualUsers;
  if (jwtUser) return [jwtUser];
  if (jwtError) return manualUsers;
  return [];
}

/**
 * True while a hosted-JWT signer exists but its pubkey has not yet resolved and
 * has not errored — i.e. the session is still initializing. UI gates should
 * treat this as "still determining auth", not "logged out".
 */
export function isJwtResolving(opts: {
  hasSigner: boolean;
  jwtPubkey: string | undefined;
  jwtError: boolean;
}): boolean {
  return opts.hasSigner && !opts.jwtPubkey && !opts.jwtError;
}

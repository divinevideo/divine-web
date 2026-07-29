# Lock adult-content settings for protected minors on web (divine-web#453)

**Status:** Implemented on this branch.
**Part of:** support-trust-safety#175 / epic support-trust-safety#173. Web parity
with the merged mobile lock (divine-mobile#5744). Builds on the merged
protected-minor state (#452 / PR #456).

## Problem

A protected minor (13-15, `verified_minor` in keycast) can still pass the web
adult-content gate: `useAdultVerification` is a 30-day localStorage
self-attestation + signer check, with no awareness of protected-minor state.

## Design — gate at the single seam

All adult-gating consumers (`VideoCard`, `VideoGrid`, `ThumbnailPlayer`,
`AgeVerificationOverlay`) read `useAdultVerification`. Lock inside that hook so
every consumer inherits the lock with no per-component changes:

1. Consume `useProtectedMinorStatus()` (#456)
   inside `useAdultVerification`.
2. When protected: `isVerified` is forced `false` (regardless of localStorage
   or signer), `confirmAdult()` is a no-op, and `getAuthHeader` therefore keeps
   returning `null` (existing `!isVerified` guard).
3. **Self-healing:** when protected-minor state resolves true and a stored
   verification exists (confirmed before protection landed, or a shared
   browser), clear it (`revokeVerification` path) so the stale attestation
   doesn't survive age-up/revocation boundaries incorrectly.
4. Fail-safe: unknown/loading protected-minor state **fails closed for
   granting**: `isVerified` is forced false, `confirmAdult` no-ops, and the
   stored attestation is NOT purged (purge only on known-true). The hook also
   exposes unknown through `isLoading` for consumers that can surface it, but
   the current adult-content consumers key their gate decisions off
   `isVerified`, `confirmAdult`, and `getAuthHeader`, so confirmed adults may
   see a brief locked state while the protected-minor check resolves. Smoothing
   that adult experience stays in the follow-up support-trust-safety#180. This
   matches the #452/#456 foundation's stated intent that #175 gates fail closed
   on unknown, corrected from this spec's earlier fail-open draft.

## Out of scope

- DM restriction (#454 — parked on the identity-pinning decision).
- Mobile (already merged, #5744).

## Tests

- protected minor: `isVerified===false` despite valid localStorage + signer;
  `confirmAdult()` does not set storage; stored verification is cleared.
- non-minor: behavior unchanged (30-day attestation honored).
- state transition: protection resolving true after mount locks and clears.
- follow existing hook/component test harnesses (`AgeVerificationOverlay.test.tsx` etc.).

## Acceptance (from #453 / #175)

A protected minor on web cannot enable or retain adult-content access; the
setting is locked, not merely defaulted.

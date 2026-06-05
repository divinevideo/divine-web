# Intermittent logout for bunker / Keycast-team users — design

**Date:** 2026-06-03
**Status:** Approved (design); implementation pending
**Credit:** Aleysha articulated and demonstrated this symptom thoroughly on 2026-06-02. This design follows from that report and the code investigation it prompted.

## Symptom

End users whose account signs through a Keycast-hosted NIP-46 bunker (because the account is part of a Keycast team) intermittently appear logged out. Logout is repeated / non-deterministic from the user's perspective: no logout action is taken, yet the UI flips to a signed-out state.

## Investigation summary

Two independent root causes were found, both in `divine-web`. Keycast is not at fault: team-authorization secrets do not expire, pod restarts reload handlers from the DB on demand, and reconnection from the same client pubkey is accepted (the connect secret is single-use per NIP-46 but reusable by the original client). See `~/code/nips/46.md:48`.

A third path that looked suspicious — `src/lib/bunkerToWindowNostr.ts` / `useWindowNostr` (30s timeout, single attempt, swallowed errors) — is **not wired into the live login flow** and is a red herring for this symptom. The live bunker login path is `LoginDialog → useLoginActions.bunker → NLogin.fromBunker`.

### Root cause A — bunker `login.data` type-confusion in the cross-subdomain cookie

`NUser.fromBunkerLogin` (in `@nostrify/react/login`) requires `login.data` to be the object `{ bunkerPubkey, clientNsec, relays }`. It is synchronous and never touches the relay, so it only throws when `data` is structurally invalid — a transient signer/relay outage does **not** cause it to throw.

The cross-subdomain cookie (`nostr_login`, domain `.divine.video` / `.dvines.org`) stores the bunker payload under a single field, `bunkerUri`, in **two incompatible shapes**:

- `src/hooks/useLoginActions.ts:26` (fresh login) writes `bunkerUri: uri` — the raw `bunker://…` **string**.
- `src/lib/crossSubdomainAuth.ts:180` (sync from localStorage) writes `bunkerUri: first.data` — the **object** `{ bunkerPubkey, clientNsec, relays }`.

Rehydration on an origin with no localStorage assigns that field straight into `data`:

```ts
// src/lib/crossSubdomainAuth.ts:205-213
if (cookie.type === 'bunker' && cookie.bunkerUri) {
  const loginState = [{ id: crypto.randomUUID(), type: 'bunker',
    pubkey: cookie.pubkey, data: cookie.bunkerUri }];   // string OR object
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));
}
```

When `data` ends up the **string**, `NUser.fromBunkerLogin` does `nip19.decode(login.data.clientNsec)` where `login.data.clientNsec` is `undefined` → throws. The throw is swallowed by the filters in `src/hooks/useCurrentUser.ts:62-67` and `src/hooks/useLoggedInAccounts.ts:24-30` (`catch { return false }`), so `users[0]` becomes `undefined` and `isLoggedIn = Boolean(user)` (`src/AppRouter.tsx:69`) goes false. No logout event fires.

**Why it is intermittent and self-perpetuating:**
- Same-origin reload is fine: `crossSubdomainAuth.ts:170-182` sees existing localStorage and returns early without overwriting it.
- Cross-origin hydration (e.g. `divine.video` ↔ `<username>.divine.video`) depends on which writer last touched the cookie — string (broken) vs object (works).
- Once a broken string-shaped login is written into an origin's localStorage (`:212`), that origin's next reload writes `bunkerUri: first.data` (the string) back into the shared cookie (`:180`), re-poisoning it for other origins.

Only bunker logins are affected: nsec is intentionally not restored from the cookie; extension needs no `data`.

### Root cause B — hosted-JWT session lifecycle

The hosted Divine login (`DivineJWTSigner`, backed by `login.divine.video` / Keycast via `@divinevideo/login`) is the primary intended auth path. It has two defects:

**B-a — session hard-expires with no refresh.** `src/pages/AuthCallbackPage.tsx:33` calls `saveSession(result.token, null, /*rememberMe*/ false)` and **discards `result.refreshToken`**. With `rememberMe=false`, the moment `now > expiration`, `getValidToken()` calls `clearSession()` and returns null (`src/hooks/useDivineSession.ts:229-236`). Access-token lifetime is the JWT `exp` claim or a 24h fallback (`:112-117`). The entire refresh / re-auth apparatus (`refreshSession`, `needsReauth`, `isExpiringSoon`, `isExpired`) has **zero consumers** — it is dead code. The library already supports silent renewal (`getSessionWithRefresh()`, `refreshSession(refreshToken)`, near-expiry check), and `divineLogin.ts:30` already surfaces `refreshToken`, but divine-web throws it away. Result: hosted sessions die on a clock (≤24h) for everyone.

**B-b — JWT presence suppresses the bunker fallback, transiently.** `src/hooks/useCurrentUser.ts:84-86`:

```ts
const users = token ? (jwtUser ? [jwtUser] : []) : manualUsers;
```

`jwtUser` requires `jwtPubkey`, set by an async network call `jwtSigner.getPublicKey()` (POST to the hosted RPC, 10s timeout — `src/hooks/useCurrentUser.ts:30-56`, `src/lib/DivineJWTSigner.ts:72-110`). While that resolves, or if it fails/times out (`:46-51` sets `jwtPubkey=undefined`), `users = []` (logged out) even when a valid bunker login sits unused in `manualUsers`. A present-but-unresolved or stale JWT cookie blanks out an otherwise-working login.

B bites the reported bunker users when a `divine_jwt` cookie is also in play (the hosted flow issues both a JWT and a `bunkerUrl`). Whether that was true in the original repro is unconfirmed; both A and B are real regardless and are tracked separately.

## Plan: 2 issues, 3 PRs (all independent, all target `main`)

- **Issue A** → **PR 1**: structured bunker data in the cross-subdomain cookie.
- **Issue B** → **PR 2** (B-b precedence) + **PR 3** (B-a refresh-token wiring).

PRs do not stack; each is independently reviewable and revertable.

## PR 1 — Issue A: structured bunker data in the cookie

**Files:** `src/lib/crossSubdomainAuth.ts`, `src/hooks/useLoginActions.ts`

- `LoginCookieData`: replace `bunkerUri?: string` with `bunkerData?: { bunkerPubkey: string; clientNsec: string; relays: string[] }` — the exact shape `NUser.fromBunkerLogin` consumes.
- `useLoginActions.bunker`: write `bunkerData: login.data` (the object from `NLogin.fromBunker`), not the raw `uri`.
- Sync-from-localStorage path (`crossSubdomainAuth.ts:177-181`): write `bunkerData: first.data`.
- Rehydration (`:205-213`): add `isValidBunkerData(d)` — object with an nsec-decodable `clientNsec` and a non-empty `relays` array. Only write `data: cookie.bunkerData` when valid; otherwise skip.
- **Self-heal:** in the localStorage branch, if an existing `nostr:login` bunker entry has a non-object `data` (legacy poison), drop it rather than re-syncing it into the cookie — breaks the flap / re-poison loop.
- **Back-compat:** a cookie carrying the old `bunkerUri` string fails `isValidBunkerData` → ignored, not persisted. Affected users land in a clean logged-out state and re-login.

**Why round-trip the object instead of re-deriving from the URI:** the connect `secret` is single-use per NIP-46 (`~/code/nips/46.md:48`) and the `clientNsec` is the ephemeral key Keycast bound the connection to. Re-running `NLogin.fromBunker(uri)` mints a new client key and reuses a spent secret — Keycast ignores it. The original `clientNsec` must be preserved.

**Already-affected users:** a currently-poisoned origin has lost its `clientNsec` (the cookie string only held the spent connect secret). Those users must re-login, and because the old secret is spent they may need a freshly-issued bunker URL from the Keycast team admin. The fix prevents recurrence; it cannot retroactively restore a spent connection. Call this out in the issue.

**Tests:** object round-trips localStorage→cookie→localStorage; string-shaped `data` is rejected; a poisoned localStorage entry is dropped on hydrate.

## PR 2 — Issue B-b: JWT no longer blanks out a valid login

**File:** `src/hooks/useCurrentUser.ts`

Replace the bare-`token`-truthiness switch with three explicit JWT states:

- **resolving** (`token && !jwtPubkey && !jwtError`): do not render logged-out; expose a loading state so the UI does not flash signed-out while `getPublicKey()` is in flight. `AppRouter`'s `isLoggedIn` must not treat "resolving" as "logged out."
- **resolved**: `jwtUser` is current (first slot).
- **failed** (`jwtError`): fall back to `manualUsers` (a valid bunker login keeps working), else logged-out.

This fixes both the logged-out flash on every JWT load and the stuck logout when the signer RPC fails, without flipping to the wrong identity mid-resolve. Requires the hook to track/expose a JWT error state (currently the catch only sets `jwtPubkey=undefined`, indistinguishable from "resolving").

**Tests:** JWT resolving → not logged out; JWT failed + bunker present → bunker serves; JWT resolved → JWT serves; no JWT → manual logins serve (unchanged).

## PR 3 — Issue B: refresh-token wiring (outline; detailed design when picked up)

**Files:** `src/pages/AuthCallbackPage.tsx`, `src/hooks/useDivineSession.ts`, `src/lib/crossSubdomainAuth.ts`, the JWT token-resolution layer.

- Capture `result.refreshToken` in `AuthCallbackPage`; persist it alongside the access token (new `keycast_refresh_token` key + JWT cookie field, same storage class as the access token already uses).
- On expiry / near-expiry, call `refreshSession(refreshToken)` / `getSessionWithRefresh()` to mint a fresh access token instead of `clearSession()`. Hard logout only when refresh genuinely fails.
- **Deferred decision (this PR's own plan):** adopt the library `SessionManager` (`getSessionWithRefresh`) as source of truth vs. keep `useDivineSession` storage and call `refreshSession()` manually.
- This is the security-sensitive PR (a longer-lived bearer credential in browser storage) and gets a focused security review when started.

## Out of scope

- Any Keycast change (no server defect found).
- The unused `bunkerToWindowNostr.ts` / `useWindowNostr` utility (not in the live login path).
- Unrelated auth refactors.

# JWT-First Divine Signer Web Auth Design

**Date:** 2026-03-24  
**Status:** Approved for planning  
**Scope:** Replace bunker-first web auth hydration with JWT-first `divine-signer` auth for standard `login.divine.video` users while preserving advanced manual signer login paths

## Goal

Make the main `login.divine.video` web auth flow authenticate users through a saved JWT session and direct REST signing, rather than requiring a bunker connection to establish logged-in state.

## Problem

The current web auth callback still treats `bunker_url` as the primary credential for ordinary web users. After OAuth completes, the app waits for `NLogin.fromBunker()` to connect before the callback page can finish. In practice, that bunker handshake can stall, leaving users stuck on `/auth/callback` even though the OAuth exchange already succeeded and a valid JWT has been returned.

This is also the wrong architecture for the intended product. Standard web users should sign via `divine-signer` over authenticated REST requests, not through a bunker relay handshake. Bunker should remain an advanced manual signer option, not the default web auth transport.

## Product Decisions Captured

- `login.divine.video` JWT auth becomes the primary web auth model.
- The normal OAuth callback becomes token hydration only.
- Standard web auth uses the existing `KeycastJWTSigner` REST path for signing.
- The app derives current logged-in user state from the JWT-backed signer before falling back to manual `@nostrify/react/login` accounts.
- `window.nostr` compatibility remains available through the JWT signer, but it is no longer the source of truth for login state.
- Manual advanced logins (`nsec`, extension, manual bunker) remain available.
- While a JWT session exists, the app behaves as single-account mode until logout.
- Full mixed account switching between JWT auth and manual accounts is out of scope for this pass.

## Primary User Flows

### 1. Existing or invited user completes `login.divine.video` auth

1. User starts sign-in or sign-up from the invite-first auth dialog.
2. User completes OAuth at `login.divine.video`.
3. Web returns to `/auth/callback` with an auth code.
4. Web exchanges the code for a JWT-backed session.
5. Web saves the JWT session locally.
6. Web clears invite handoff state.
7. Web navigates immediately back into the app.
8. App initializes the REST signer from the saved JWT in the background and exposes the user as logged in.

### 2. Logged-in web user publishes content

1. App resolves the current user from the saved JWT session.
2. Publishing hooks ask `useCurrentUser()` for `user` and `signer`.
3. The returned signer is the JWT-backed REST signer.
4. Event signing happens through authenticated HTTP requests to the signer service.
5. Event relay publishing continues through the existing Nostr client.

### 3. User refreshes the page after web login

1. App loads with a valid saved JWT session.
2. JWT-backed current-user resolution restores the authenticated user without any bunker handshake.
3. JWT signer compatibility code optionally injects `window.nostr` for libraries that expect it.
4. Protected routes remain available because logged-in state is derived from the JWT session.

### 4. User logs out

1. User opens the account menu while a JWT session is active.
2. User selects logout.
3. App clears the JWT session and any related web-auth state.
4. JWT-derived current-user state disappears immediately.
5. App returns to logged-out behavior until the user signs in again.

## System Responsibilities

### `divine-web`

- Exchange OAuth callbacks into JWT session state.
- Treat the JWT-backed signer path as authoritative for normal web auth.
- Resolve current-user state from JWT first, then from manual nostr-login accounts as fallback.
- Mount JWT signer compatibility for code that still expects `window.nostr`.
- Keep advanced signer login methods available without making them the normal web auth transport.
- Provide real logout semantics for JWT-backed sessions.

### `login.divine.video` / signer API

- Continue exchanging OAuth callback codes into JWT-based session credentials.
- Continue exposing authenticated signer endpoints used by `KeycastJWTSigner`.
- No bunker relay handshake is required for the standard web-auth success path.

## Architecture

### Auth sources

The app currently has two auth systems:

- `@nostrify/react/login` logins for manual `nsec`, extension, and bunker accounts
- `useKeycastSession()` plus `KeycastJWTSigner` for JWT-backed REST signing

This design makes JWT-backed auth the first-class source for normal web login, while leaving manual signer logins intact as fallback and advanced options.

### Current-user boundary

`useCurrentUser()` becomes the main integration seam:

- If a valid JWT session exists, `useCurrentUser()` returns the JWT-backed user and signer.
- If no valid JWT session exists, it falls back to the existing nostr-login account list.
- The hook contract remains stable for the rest of the app: `user`, `users`, `signer`, and author metadata continue to be exposed in the same shape consumers already expect.

### Compatibility layer

`KeycastJWTWindowNostr` is mounted at the app root so token-backed auth can still satisfy legacy code paths or libraries that rely on `window.nostr`. That compatibility layer is secondary. It should never block route access or define whether the user is logged in.

### Account surface

When a JWT session exists, the account UI runs in single-account mode:

- show the current JWT-backed user
- support profile/settings navigation
- support logout

Manual account switching remains available only when the app is operating on manual nostr-login accounts. Mixing JWT and manual accounts in one switcher is not part of this migration.

## Callback Contract

### New callback behavior

`AuthCallbackPage` should:

- parse the OAuth callback
- exchange it through `@divinevideo/login`
- save the JWT session
- clear invite handoff
- navigate to the stored return path or `/home`

It should not:

- call `loginActions.bunker(...)`
- wait on relay connection or bunker handshakes
- store or reconnect `bunker_url` for the standard web-auth path

### Returned data usage

- `access_token` remains required and is the main credential used by the app.
- `bunker_url` is no longer required for standard callback success.
- Manual bunker login remains available through the advanced login tab and continues to use the existing nostr-login path.

## App Surface Changes

### Root app setup

- Mount `KeycastJWTWindowNostr` in `App.tsx`.
- Keep `NostrLoginProvider` for advanced manual login methods.
- Do not rely on hydrated nostr-login localStorage as the normal web-auth persistence mechanism.

### Login area and account switcher

- If a JWT session exists, `LoginArea` should behave as logged in even when nostr-login has no active manual account.
- The account menu should present the JWT-backed current user.
- JWT logout must clear the token-backed session rather than just removing a nostr-login entry.

## Error Handling

- OAuth exchange failure: show the existing callback error UI and allow retry from sign-in.
- JWT signer initialization failure after successful callback:
  - user should still leave `/auth/callback`
  - failure should surface through the signer initialization path rather than trapping the callback page
- Expired or invalid JWT session on app load:
  - clear the session
  - fall back to logged-out behavior or manual accounts if present
- Manual advanced bunker login failure:
  - remains unchanged and scoped to the advanced login UI

## Testing Strategy

- `src/pages/AuthCallbackPage.test.tsx`
  - callback saves the JWT session and redirects without calling bunker login
  - callback failure still surfaces a recoverable error
- `src/hooks/useCurrentUser.test.ts`
  - valid JWT session produces current user and signer without manual logins
  - manual logins still work when no JWT session exists
  - JWT session takes precedence over manual logins
- `src/components/auth/LoginArea.test.tsx` and/or account-menu tests
  - JWT session is treated as logged in
  - logout clears JWT-backed session state
- `src/App.tsx` or `src/components/KeycastJWTWindowNostr.test.tsx`
  - JWT compatibility component is mounted from the app root
- publish-path coverage such as `src/hooks/useNostrPublish.ts`
  - JWT-backed signer can satisfy normal publish behavior

## Non-Goals

- Do not redesign the invite-first login dialog again.
- Do not remove advanced manual signer login options.
- Do not implement mixed account switching between JWT auth and manual accounts.
- Do not redesign cross-subdomain auth for manual logins in this pass.
- Do not rewrite the entire auth stack around a new provider abstraction unless the targeted migration reveals that it is necessary.

## Outcome

Standard `login.divine.video` web auth should feel like a normal sign-in flow:

- OAuth completes
- callback finishes immediately
- the user is recognized as logged in from the saved JWT session
- signing uses direct authenticated REST requests via `divine-signer`

without depending on bunker connection success to enter the app.

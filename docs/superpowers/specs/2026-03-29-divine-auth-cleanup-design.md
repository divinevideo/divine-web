# Divine Auth Cleanup Design

**Date:** 2026-03-29  
**Status:** Approved for implementation  
**Scope:** Remove dead `oauth.divine.video` browser auth code and rename the live JWT-backed signer/session layer away from `Keycast*` names

## Goal

Make the active web auth path legible: hosted auth lives at `login.divine.video`, while the in-app JWT signer/session bridge uses `Divine*` names instead of stale `Keycast*` branding.

## Problem

The repo still contains two different auth stories:

- Dead browser auth helpers and unused UI that point at `https://oauth.divine.video`
- Live JWT-backed auth/session code that still uses `Keycast*` names even though the product contract is `login.divine.video`

That mix made it too easy to reuse the wrong code path during the auth modal work.

## Design Decisions

- Delete the unused browser auth client and the unused Keycast-specific auth components outright.
- Rename the live JWT-backed session and signer surface to `Divine*` names.
- Keep the current session storage keys unchanged for now so existing signed-in users do not get logged out by this cleanup.
- Point the live JWT signer at `login.divine.video` and the official `/api/nostr` RPC contract exposed by `@divinevideo/login`.
- Update active tests and current design notes so they describe the real boundary.

## Scope

### Remove dead auth surface

- Delete `src/lib/keycast.ts`
- Delete `src/components/auth/KeycastLoginForm.tsx`
- Delete `src/components/auth/KeycastSignupDialog.tsx`
- Delete `src/components/KeycastAutoConnect.tsx`

These files are unused by the current app and are the only in-repo code that still hardcodes `oauth.divine.video`.

### Rename the live runtime surface

- `KeycastJWTSigner` becomes `DivineJWTSigner`
- `useKeycastSession()` becomes `useDivineSession()`
- `KeycastJWTWindowNostr` becomes `DivineJWTWindowNostr`

The implementation behavior stays the same from the app’s perspective:

- callback flow still saves the same token into the same localStorage keys
- `window.nostr` still gets injected from the JWT-backed signer when a valid token exists
- logged-in account detection still prefers the JWT-backed web session before manual Nostr logins

### Update signer boundary

The signer should stop pretending there is a standalone `oauth.divine.video` REST API. The supported contract is:

- auth redirect and token exchange through `login.divine.video`
- token-backed Nostr RPC calls through `login.divine.video/api/nostr`

The cleanup should adapt the in-app signer to that contract rather than keeping fake endpoint paths in comments or tests.

## Non-Goals

- Do not migrate legacy localStorage keys in this pass.
- Do not change the callback token payload shape.
- Do not redesign advanced Nostr login.
- Do not rewrite historical dated docs that describe older planning context unless they are part of the active branch workflow.

## Testing Strategy

- Add failing tests that expect the renamed live modules and the `login.divine.video/api/nostr` default signer endpoint.
- Update app/component tests to import the renamed modules.
- Run focused auth/signer tests first, then full `npm run test`.

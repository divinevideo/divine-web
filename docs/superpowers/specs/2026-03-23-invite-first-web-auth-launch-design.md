# Invite-First Web Auth Launch Design

**Date:** 2026-03-23  
**Status:** Draft approved for planning  
**Scope:** `divine-web` launch funnel, `invite.divine.video` invite gate usage, `login.divine.video` account creation/sign-in handoff, and local-`nsec` upgrade/back-up UX on web

## Goal

Launch the web app with a mainstream, invite-first account funnel that points ordinary users at `login.divine.video`, while still preserving advanced Nostr login methods for technical users and giving existing browser-local `nsec` users a visible path to back up or secure their identity.

## Product Decisions Captured

- `divine-web` owns the invite gate.
- `invite.divine.video` replaces HubSpot for waitlist, invite validation, and invite configuration.
- `login.divine.video` is the primary place where mainstream users create or sign into accounts.
- New users should not be encouraged to create browser-only/localStorage `nsec` identities on web.
- Advanced alternative login methods remain available:
  - browser extension
  - bunker
  - existing `nsec` import/login
- If a local `nsec` identity is detected, the main web funnel stays account-first, but a visible inline banner must offer:
  - secure this identity with `login.divine.video`
  - back up the `nsec`
- Existing local-`nsec` users may secure/upload that identity to `login.divine.video` without an invite.
- Invite validation happens before redirecting into the login flow, but invite consumption must happen only after account creation succeeds.

## Non-Goals

- Do not design a brand-new browser-only anonymous account flow for web.
- Do not replace advanced Nostr login with a hard lockout.
- Do not re-platform all auth state management in one launch.
- Do not rebuild the invite service or Keycast server in this repo.

## Primary User Flows

### 1. New user with a valid invite

1. User clicks the main login/signup CTA in `divine-web`.
2. Web app loads client config from `invite.divine.video`.
3. User enters an invite code.
4. Web app validates the code with `invite.divine.video`.
5. On success, web app hands the session off to `login.divine.video`.
6. User creates an account or signs in on `login.divine.video`.
7. Invite is consumed only after account creation succeeds.
8. User returns to `divine-web` signed in.

### 2. New user without an invite

1. User opens the invite-first auth flow.
2. User does not have a valid invite code.
3. Web app offers the `invite.divine.video` waitlist flow directly.
4. HubSpot is no longer part of this funnel.

### 3. Existing browser-local `nsec` user

1. Web detects that the active or persisted login is a local `nsec` identity.
2. The app shows a visible inline banner rather than a full takeover.
3. User can:
   - back up the `nsec` locally for a password manager
   - secure that identity with `login.divine.video`
4. Secure-account flow does not require an invite.
5. Existing local login remains untouched until the secure-account flow succeeds.

### 4. Advanced Nostr user

1. User bypasses the mainstream account funnel.
2. User opens advanced login methods.
3. User logs in with extension, bunker, or an existing `nsec`.
4. These methods remain supported but are not the primary presentation.

## System Responsibilities

### `divine-web`

- Render the invite-first login surface.
- Call `invite.divine.video` for:
  - `GET /v1/client-config`
  - `POST /v1/validate`
  - `POST /v1/waitlist`
- Detect when the current or persisted login is a local `nsec`.
- Offer local backup/export affordances for `nsec`.
- Start the secure-account/BYOK handoff when a local `nsec` user chooses to secure the account.
- Keep advanced Nostr login methods available behind a secondary surface.
- Hydrate login state after the user returns from `login.divine.video`.

### `invite.divine.video`

- Return onboarding mode and client-visible invite settings.
- Validate invite codes before redirect.
- Handle waitlist joins.
- Consume invite codes only after successful account creation/sign-up.

### `login.divine.video`

- Own the mainstream account creation and account sign-in UI.
- Support a secure-account / BYOK flow for existing local `nsec` users.
- Read the short-lived invite handoff state created by `divine-web`.
- Consume the invite after successful account creation.
- Redirect back to `divine-web` with enough state for web to hydrate the resulting login.

## Handoff and State Contract

## Invite handoff

- `divine-web` validates the invite before redirect.
- After validation, web stores a short-lived cross-subdomain handoff value scoped to `.divine.video`.
- Recommendation: use a short-lived cookie rather than a long-lived query parameter so invite codes do not linger in copied URLs or browser history.
- Suggested fields:
  - normalized invite code
  - handoff mode (`signup`)
  - created-at timestamp
  - optional return path
- TTL should be short (for example 10 minutes).

## Secure-account / BYOK handoff

- Raw `nsec` must never be placed in:
  - query parameters
  - cookies
  - server logs
- The BYOK flow should be initiated from web code that already has access to the local `nsec`.
- Recommendation: use the `keycast-login` OAuth helper (or an equivalent thin wrapper) so the `nsec` stays local to the browser while `login.divine.video` owns the credential UI.

## Return path

- After successful auth, `login.divine.video` redirects back to a dedicated web callback route.
- Web completes login hydration and restores the normal app route.
- Existing cross-subdomain login persistence should remain the final source for sharing login state across apex/subdomains.

## Web Surface Changes

### Auth entry

- Replace the current waitlist-first `SignupDialog` funnel with an invite-first auth surface.
- Primary CTA should speak to account creation/sign-in on `login.divine.video`.
- Invite code entry and waitlist join both happen from web.
- Advanced Nostr login methods move into a secondary panel or sheet.

### Local-`nsec` banner

- The chosen hierarchy is “main account funnel first, visible inline local-key banner second.”
- The banner should appear in the surface the user actually reaches:
  - login dialog if the app can detect a local `nsec` while not fully hydrated
  - signed-in/account-switcher surface when the current account is a local `nsec`
- Banner CTAs:
  - `Secure with divine.video login`
  - `Back up nsec`

### Waitlist

- Waitlist submission must use `invite.divine.video`.
- HubSpot copy and CTA wiring should be removed from public auth flows.

## Error Handling

- Invalid invite: stay in the invite dialog and show field-level feedback.
- Invite service unavailable: show a recoverable banner and keep advanced login methods accessible.
- Invite becomes used/revoked between validate and consume: send the user back to the web invite gate with a clear recovery message.
- BYOK/secure-account failure: preserve the existing local `nsec` login and show a retry-safe error.
- Callback exchange failure: keep the user logged out, preserve any non-consumed invite handoff if possible, and present a retry path.

## Testing Strategy

- Unit tests for:
  - invite client parsing and error mapping
  - short-lived handoff cookie helpers
  - local-`nsec` detection/export helpers
  - login redirect URL construction / callback parsing
- Component tests for:
  - invite-first dialog states
  - waitlist fallback
  - advanced login disclosure
  - local-`nsec` banner rendering and actions
- Route tests for:
  - callback success
  - callback failure
  - invite validation -> redirect start
- Full project verification remains `npm run test`.

## External Contract Dependencies

- `invite.divine.video` already exposes the client-config, validate, and waitlist routes needed by web.
- `login.divine.video` needs a documented contract for:
  - invite handoff cookie reading
  - secure-account/BYOK flow entry
  - callback redirect target(s)
  - invite consumption timing
- If those routes or contracts are not ready, web should implement against a thin compatibility wrapper rather than hard-coding unstable paths in multiple UI files.

## Launch Outcome

At launch, the web app should feel like:

- ordinary users create/sign in with `login.divine.video`
- invite and waitlist logic happen on `divine-web` using `invite.divine.video`
- technical Nostr users still have alternative login methods
- existing local-`nsec` users are prompted to back up or secure their identity instead of being stranded on browser-local storage forever

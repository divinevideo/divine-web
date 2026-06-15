# Existing User Login Entry Design

**Date:** 2026-03-23  
**Status:** Approved for planning  
**Scope:** Refinement of the invite-first `divine-web` auth dialog so existing account holders have an explicit sign-in path distinct from invite-gated registration

## Goal

Make the public web auth surface clearly support both account creation and account sign-in, without weakening the invite gate for new-user registration.

## Problem

The current invite-first dialog reads like a registration funnel. New users can enter an invite code and proceed, but existing users who already have a `login.divine.video` account do not get a clear, first-class way to sign in. Advanced Nostr methods exist, but they are not the same thing as standard account sign-in and should not be presented as the primary recovery path for ordinary users.

## Product Decisions Captured

- The auth dialog stays on one card.
- New-user registration remains invite-gated.
- Existing-account sign-in becomes a first-class action on the default auth surface.
- Existing-account sign-in goes directly to `login.divine.video` and does not require invite validation.
- Invite waitlist stays attached only to the new-user path.
- Advanced Nostr methods remain under secondary disclosure and are not relabeled as the standard existing-user path.
- Existing-account sign-in must remain usable even if invite service config or validation is unavailable.

## Primary User Flows

### 1. Existing user with an account

1. User opens the public auth dialog.
2. User sees a clear `I already have an account` action without expanding advanced login methods.
3. User selects that action.
4. Web redirects straight to `login.divine.video` in sign-in mode.
5. User completes auth and returns through the existing callback flow.

### 2. Existing user while invite service is unavailable

1. User opens the public auth dialog.
2. `invite.divine.video` config request fails.
3. Web shows degraded signup messaging for the invite path.
4. The `I already have an account` action still renders and still redirects to `login.divine.video`.

### 3. New user with an invite

1. User opens the public auth dialog.
2. User enters an invite code.
3. Web validates the invite with `invite.divine.video`.
4. Web stores invite handoff state and redirects to `login.divine.video` in register mode.
5. User completes account creation/sign-in and returns through the callback flow.

## System Responsibilities

### `divine-web`

- Render both first-class auth entry points on the default dialog surface.
- Keep invite validation and waitlist on the signup side only.
- Keep existing-account sign-in independent from invite service availability.
- Continue using the existing callback hydration path after return from `login.divine.video`.

### `login.divine.video`

- Accept a standard sign-in redirect from web without requiring invite metadata.
- Continue accepting register-mode redirects for invite-gated signup.

## Redirect Contract

- `buildSignupRedirect()` remains the invite-gated new-user helper and requests register mode.
- `buildLoginRedirect()` is added as a separate helper for existing-account sign-in.
- Both redirect helpers:
  - preserve the current return path
  - generate state/PKCE through `@divinevideo/login`
  - store the return path under the same state key used today
- Only the signup flow writes invite handoff state.
- Existing-account sign-in does not create invite state and does not depend on invite config.

## Web Surface Changes

### Default auth card

- Keep the invite code field and `Continue with invite code` button.
- Add a distinct `I already have an account` button on the same default surface.
- Keep the waitlist CTA visually associated with the invite path rather than the existing-user path.
- Keep the local-`nsec` banner above these actions when relevant.

### Advanced login disclosure

- Leave advanced Nostr login behavior unchanged.
- Do not treat advanced Nostr methods as the mainstream existing-user sign-in affordance.

## Error Handling

- Invite validation failure: stay on the invite path and show field-level feedback.
- Invite service unavailable: show degraded signup messaging, but keep the existing-account sign-in button available and working.
- Existing-account redirect failure: surface a recoverable dialog error and keep the user on the dialog.

## Testing Strategy

- Unit tests for `src/lib/divineLogin.ts`:
  - existing-account login redirect does not request register mode
  - return-path storage works for both login and signup helpers
- Component tests for `src/components/auth/LoginDialog.tsx`:
  - existing-account action is visible on the default surface
  - existing-account action redirects immediately without invite validation
  - signup path still validates invites before redirect
  - degraded invite-service state still allows existing-account redirect

## Non-Goals

- Do not redesign the entire auth dialog information architecture.
- Do not change advanced Nostr login semantics.
- Do not change callback hydration or secure-account/BYOK behavior in this refinement.

## Outcome

The public auth dialog should read clearly as both:

- a place for invited new users to start account creation, and
- a place for existing users to sign in immediately

without forcing existing users through invite-oriented UI or implying that advanced signer login is the normal account sign-in flow.

# Tabbed Auth Modal Design

**Date:** 2026-03-29  
**Status:** Approved for implementation  
**Scope:** Refine the invite-first auth dialog in `divine-web` so registration and sign-in read as two explicit modes, while preserving the current invite-gated signup contract

## Goal

Make the auth modal feel like a normal product login surface instead of a stack of competing actions.

## Problem

The current dialog tries to explain invite-gated registration, existing-account login, waitlist fallback, and advanced Nostr signers all at once. The result is too many equal-weight buttons and no clear first step.

## Product Decisions Captured

- The auth modal stays on one card.
- The first decision is `Register` or `Sign in`.
- `Register` remains invite-gated.
- `Sign in` becomes its own explicit tab with a single primary handoff to hosted `login.divine.video`.
- `Use Nostr instead` remains available only from the sign-in path and should read like a minor fallback, not a parallel primary flow.
- Waitlist remains attached only to registration.
- Stored local-`nsec` recovery messaging stays above the main auth surface when relevant.

## Phase 1 Implementation Scope

### Register tab

- Render a segmented control with `Register` selected by default.
- Show one short helper line: `Use an invite to create your account.`
- Keep the invite code field as the first required action.
- Rename the primary button to `Continue`.
- Replace the large waitlist button with a text-link-style action: `No invite? Join the waitlist`.
- Keep the dedicated waitlist form as a secondary register-state view within the same tab.
- After invite validation succeeds, continue using the existing `login.divine.video` register redirect and invite handoff cookie.

### Sign in tab

- Show a single primary button: `Continue`.
- Existing-account sign-in continues through the hosted `login.divine.video` OAuth flow.
- Render `Use Nostr instead` as a text-link-style disclosure beneath the primary CTA.
- Clicking that link reveals the existing advanced Nostr methods inside the sign-in tab.

### Degraded register state

- If invite config fails, keep the register tab available but replace the invite form with degraded messaging.
- The sign-in tab must remain fully usable even when invite config is unavailable.

## Dependency Boundary

Inline invite-backed account creation and inline credential sign-in are not implemented in this phase.

The current web contract only supports invite validation in `divine-web` followed by hosted account creation/sign-in at `login.divine.video`. Older in-repo browser-auth helpers referenced `oauth.divine.video`, but that is not a supported browser contract for this flow. Because of that, phase 1 keeps both mainstream signup and mainstream sign-in hosted after the user picks a tab in the web modal.

## Primary User Flows

### 1. Existing user signs in

1. User opens the auth modal.
2. User selects `Sign in`.
3. User clicks `Continue to sign in`.
4. Web redirects to `login.divine.video` in sign-in mode.
5. User completes auth and returns through the existing callback flow.

### 2. User prefers Nostr sign-in

1. User opens the auth modal.
2. User selects `Sign in`.
3. User clicks `Use Nostr instead`.
4. Advanced Nostr methods expand within the same tab.

### 3. New user with an invite

1. User opens the auth modal.
2. User leaves the default `Register` tab selected.
3. User enters an invite code and clicks `Continue`.
4. Web validates the invite and stores invite handoff state.
5. Web redirects to `login.divine.video` in register mode.

### 4. New user without an invite

1. User opens the auth modal.
2. User remains on the `Register` tab.
3. User clicks `No invite? Join the waitlist`.
4. Web swaps to the waitlist form within the same tab.

## Non-Goals

- Do not redesign the callback hydration flow.
- Do not replace the hosted `login.divine.video` signup experience in this phase.
- Do not change advanced Nostr login semantics.
- Do not remove the local-`nsec` recovery banner.

## Testing Strategy

- Update `LoginDialog` component tests to assert:
  - register and sign-in tabs are present
  - sign-in renders a hosted-auth redirect CTA rather than inline fields
  - Nostr options stay hidden until the sign-in disclosure is clicked
  - register still validates invites before redirect
  - invite-config failure still leaves sign-in usable

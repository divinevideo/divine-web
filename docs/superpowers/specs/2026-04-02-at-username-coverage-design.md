# AtUsernamePage Coverage Design

**Date:** 2026-04-02
**Status:** Approved

## Goal

Bring the shipped `AtUsernamePage` behavior on `main` under direct test coverage and close the remaining mixed-case lookup gap without changing the broader `@username` architecture that landed in PR #219.

## Scope

This follow-up stays intentionally narrow:

1. Add page-level tests for the current `AtUsernamePage` flow.
2. Normalize usernames to lowercase before the client-side NIP-05 lookup.
3. Add coverage for the edge-injected `getSubdomainUser()` fast path so the page can safely skip fetches when the worker has already resolved the user.

## Current Design Constraints

- `AtUsernamePage` already shipped with a specific architecture:
  - it accepts the route param via `useParams`
  - it checks `getSubdomainUser()` first
  - it falls back to a client-side fetch against `https://divine.video/.well-known/nostr.json`
  - it navigates to `/profile/:npub` rather than forcing a full-page subdomain redirect
- The worker already handles `divine.video/@username` at the edge. This change does not replace or re-argue that design.

## Chosen Approach

Keep the implementation in place and add missing regression coverage around it.

The one behavior change is username normalization before fetch. Today the page queries with the raw route value and only lowercases when reading `data.names?.[username.toLowerCase()]`. That means a mixed-case route like `/@KingBach` can still ask the server for `name=KingBach`, which is less robust than querying lowercase directly.

## Test Coverage To Add

- Navigates to `/profile/:npub` after a successful lookup.
- Lowercases the username before the fetch request.
- Renders the not-found state when the lookup fails.
- Renders the not-found state when the resolved pubkey is invalid.
- Renders the loading state while the lookup is pending.
- Skips the fetch and renders the profile path when `getSubdomainUser()` returns injected data.

## Non-Goals

- Reverting to the earlier client-side full-page redirect design from PR #218.
- Reworking the edge worker route behavior.
- Broad refactors of `AtUsernamePage`, `ProfilePage`, or router structure.

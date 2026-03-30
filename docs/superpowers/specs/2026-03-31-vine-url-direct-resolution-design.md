# Vine URL Direct Resolution Design

**Date:** 2026-03-31

## Goal

Allow pasted Vine clip URLs, Vine user URLs, bare Vine clip IDs, and bare Vine user IDs to resolve directly from the search box without falling back to generic search results.

## Context

PR `#207` is a good safety fix because it stops URL-like queries from triggering Funnelcake 500s in the generic search hooks. This follow-up feature should not extend those hooks further. The existing direct-input path in `SearchPage` and `directSearch` is already the right place for structured identifiers, and this feature should extend that path.

## User-Facing Behavior

The search box should recognize all of these inputs and route immediately:

- `https://vine.co/v/<clipId>` -> `/video/<clipId>`
- `https://vine.co/u/<numericUserId>` -> `/u/<numericUserId>`
- `https://vine.co/<username>` -> `/u/<username>`
- bare clip IDs such as `hBFP5LFKUOU` -> `/video/<clipId>`
- bare numeric Vine user IDs such as `1080167736266633216` -> `/u/<numericUserId>`

Once routed:

- clip identifiers are resolved by the existing `/video/:id` path
- user identifiers are resolved by the existing `/u/:userId` path
- legacy username-style Vine URLs should be resolved best-effort to a user profile
- if no user can be resolved, the app should show the explicit "not found" state instead of dropping into generic search

## Non-Goals

- changing the generic search hooks beyond the `#207` safety fix
- adding backend endpoints
- supporting arbitrary web URLs beyond Vine-specific inputs
- fuzzy matching based on display names

## Architecture

### Direct Input Parsing

Extend `src/lib/directSearch.ts` so `getDirectSearchTarget()` can recognize Vine-specific inputs in addition to the existing Nostr identifiers.

The direct-search layer should remain the single entrypoint for immediate routing decisions from the search box.

### Search Page Integration

`src/pages/SearchPage.tsx` already routes immediately for direct targets and already has dedicated paths for pasted opaque video IDs and hex event IDs. That logic should remain in place. The only change needed is to make the direct-target parser smarter so Vine URLs become first-class direct targets.

### User Resolution

`src/pages/UniversalUserPage.tsx` already handles numeric Vine user IDs and OpenVine-style NIP-05 fallback. It should be extended for non-numeric legacy Vine usernames.

For non-numeric identifiers, resolution order should be:

1. exact match on `metadata.vine_metadata?.username`
2. exact username extracted from a stored Vine profile URL in `metadata.website`
3. existing fallback to `username@openvine.co`
4. explicit not-found UI

The resolver should avoid loose matching against `metadata.name` or `display_name` to prevent false positives.

## Failure Behavior

- If the input is recognized as a Vine clip URL or ID, route to `/video/:id` immediately and let the existing video page show its normal error state if the video cannot be resolved.
- If the input is recognized as a Vine user URL or ID, route to `/u/:userId` immediately and let `UniversalUserPage` show its explicit not-found state if resolution fails.
- Recognized Vine URLs should not silently fall back into generic search results.

## Testing Strategy

### Unit Tests

Extend `src/lib/directSearch.test.ts` with cases for:

- `vine.co/v/<clipId>`
- `vine.co/u/<numericUserId>`
- `vine.co/<username>`
- protocol, query-string, and hash variants
- bare clip IDs and numeric user IDs continuing to resolve correctly

### Search Page Tests

Extend `src/pages/SearchPage.test.tsx` with cases showing that pasted Vine URLs navigate immediately and do not require generic search hooks to return results first.

### Universal User Tests

Add `src/pages/UniversalUserPage.test.tsx` for:

- numeric Vine user ID success
- legacy username success via `vine_metadata.username`
- legacy username success via Vine profile URL stored in `website`
- fallback to `username@openvine.co`
- explicit not-found state when none of the above match

## Rationale

This keeps the feature aligned with the current architecture:

- structured identifiers are handled by direct routing
- generic text queries are handled by search hooks
- legacy user resolution stays in the user-resolution page instead of being duplicated in `SearchPage`

That split keeps `#207` small and safe while still allowing a follow-up feature with useful Vine-specific behavior.

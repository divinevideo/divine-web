# Follow List Dialog Rendering Design

## Summary

The followers/following dialog on profile pages can open as a mostly empty dark panel, leaving the user without visible rows, avatars, or names. The dialog should remain usable as soon as the pubkey list is available, even if profile metadata arrives later or never arrives.

## Problem

- `UserListDialog` virtualizes the row list inside a flex dialog body.
- The scroll container does not have a stable viewport height, so the virtualizer can initialize with no visible rows.
- The row content depends on hydrated profile metadata for enhancement, but the base row should not wait for that metadata to become useful.

## Goals

- Show visible follower/following rows immediately when pubkeys are available.
- Render a usable fallback avatar and generated display name before author metadata resolves.
- Preserve infinite loading for followers and metadata hydration for visible rows.
- Keep the fix localized to the dialog component and its tests.

## Non-Goals

- Changing the follower/following API shape.
- Reworking profile header stats or follow counts.
- Replacing virtualization with a completely different list architecture.

## Decision

Keep virtualization, but make the dialog viewport explicit and guarantee that initial rows render from pubkeys alone. The dialog body will get a stable height with `min-h-0`, and the virtualized scroll container will avoid layout rules that can collapse measurement. Row rendering will continue to upgrade in place as `useBatchedAuthors` returns richer metadata.

## Expected Behavior

1. Opening the dialog with a non-empty pubkey list shows visible rows immediately.
2. Each row shows a fallback avatar and generated display name even when `authorsData` is empty.
3. When metadata arrives, the avatar and name update in place without changing navigation behavior.
4. Loading skeletons appear only for additional rows being fetched, not instead of already-known users.

## Test Strategy

- Add a focused component test for `UserListDialog` that opens the dialog with pubkeys and no hydrated authors, then asserts that generated names and avatar fallbacks are visible.
- Add a second assertion path that confirms hydrated metadata can still replace the fallback content.
- Run the focused component test first, then the full `npm run test` suite after the fix.

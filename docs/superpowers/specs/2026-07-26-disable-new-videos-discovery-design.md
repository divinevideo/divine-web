# Disable New Videos Discovery

## Goal

Prevent viewers from browsing an unmoderated chronological feed of newly
published videos.

## Behavior

- Discovery no longer offers a **New** tab.
- Discovery no longer mounts a `recent` video feed.
- Requests for `/discovery/new` redirect to `/discovery/hot` and replace the
  stale URL in browser history.
- Other Discovery tabs and their existing behavior remain unchanged.

## Implementation

Remove `new` from the Discovery tab type and allowed-tab collections, remove
its tab trigger and content, and remove imports that become unused. Register
an explicit `/discovery/new` redirect in `AppRouter` before the parameterized
Discovery route so old links and bookmarks resolve to the Hot feed.

No feature flag or dormant recent-feed branch will remain in the Discovery
page.

## Verification

Component tests will prove that Discovery renders no **New** tab and does not
mount a recent video feed. Router coverage will prove that
`/discovery/new` resolves to `/discovery/hot`. The focused tests will be run
first, followed by the repository's full test command.

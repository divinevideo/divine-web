# Compilation Playback Design

## Summary

Add a reusable compilation playback mode for any ordered video list in Divine Web. Users should be able to start a continuous player from search results, feed-backed lists, profile videos, hashtag pages, classics, categories, and personalized feeds. Playback should move smoothly from one video to the next, preload upcoming clips to minimize gaps, update the visible metadata as clips change, and preserve enough URL context to support refresh, share, and predictable back navigation.

## Goals

- Allow users to start compilation playback from any page that owns an ordered video list source.
- Keep playback flowing from one clip to the next with minimal or no dead air.
- Preload the next one or two videos while the current video is playing.
- Carry explicit source and return context in the URL so the player knows what compilation is being watched and where to go back to.
- Continue fetching additional pages from the underlying source until the source is exhausted.

## Non-Goals

- Replacing the existing single-video `/video/:id` route.
- Turning every thumbnail grid into a smart compilation launcher.
- Building a modal-only or history-dependent solution.
- Changing feed ordering rules beyond honoring the source descriptor already chosen by the browsing page.

## User Experience

### Entry Points

Pages that already own pagination and ordering for a list source should render a `Play all as compilation` affordance when they have video results:

- Search results, placed near the result count.
- Feed-backed views using `VideoFeed`, such as trending, for-you, classics, hashtags, profiles, categories, home, and discovery where appropriate.

The trigger should not live inside `VideoGrid`. The page or feed component that knows the source and current query params should construct the compilation URL.

### Player Experience

Compilation playback should use a focused route-level player with minimal chrome, not a modal overlay. The route exists primarily to make the session stable and shareable; visually it should feel like a lean uninterrupted viewer.

The player should keep one active video mounted in a dedicated playback surface. When the current video ends, the next source should start immediately while the visible title, author, and about text update alongside the video transition. The flow should feel like a compilation, not like stepping through individual detail pages.

### Back Behavior

The player should always have a deterministic way back to the originating browse surface:

- Prefer a `returnTo` query param that points at the exact originating route and search params.
- If `returnTo` is absent or invalid, derive a fallback route from the source descriptor.

### Exhaustion Behavior

Compilation should continue loading additional pages from the same source while playback approaches the end of the loaded list. When the source reports there are no more results, playback should stop at the final item instead of looping.

## Route Model

Use a dedicated route-level player, for example:

`/watch?play=compilation&source=search&q=twerking&filter=videos&sort=relevance&start=0&returnTo=%2Fsearch%3Fq%3Dtwerking%26filter%3Dvideos`

The route should support a normalized source descriptor:

- `play=compilation`
- `source=search|discovery|home|trending|hashtag|profile|recent|classics|foryou|category`
- Source-specific params:
  - `q`, `filter`, `sort` for search
  - `tag` for hashtags
  - `pubkey` for profile-backed sources
  - `category` for category feeds
- Positioning params:
  - `start=<index>` for initial entry
  - `video=<event id>` for the current item during playback
- Navigation param:
  - `returnTo=<encoded path>`

`video` is the resilient playback anchor. `start` is only for initial entry.

## Data Model

Define a reusable compilation source descriptor shared between URL parsing and trigger construction. The descriptor should contain:

- Source type
- Source-specific parameters
- Sort or filter state where applicable
- Initial index
- Current video id if present
- Return target

Two source families need to be resolved:

1. Search-backed lists using `useInfiniteSearchVideos`
2. Feed-backed lists using `useVideoProvider`

This keeps compilation source-agnostic while reusing the existing pagination hooks already trusted by the app.

## Playback Contract

The route-level player owns:

- The resolved ordered video list
- The current playback index
- URL synchronization for the current video
- Preload state for upcoming videos
- Tail pagination

Behavior:

- On load, resolve the initial index from `video` or `start`.
- Begin playback in a dedicated video surface.
- Preload the next one or two videos while the current clip is playing.
- On `ended`, move to the next loaded video immediately.
- Update URL state to the next `video=<id>` without losing the source descriptor or `returnTo`.
- When the current index nears the end of the loaded list, call `fetchNextPage`.
- Stop requesting more once `hasNextPage` is false.

The player may use a hidden or offscreen preload strategy so the next clip is warm before it becomes active, but the user-facing surface should remain a single flowing player.

## Component Boundaries

### New Responsibilities

- Compilation URL helpers: build, parse, normalize, and derive fallback back targets.
- Compilation player page: resolve source, drive playback state, sync URL, request more pages, and render minimal player chrome plus metadata.
- Reusable compilation trigger: a small button component or helper used by `SearchPage` and `VideoFeed`.

### Existing Components

- `SearchPage` should render the button near the results count and construct a search-backed source descriptor.
- `VideoFeed` should expose compilation mode for feed-backed sources it owns.
- `VideoGrid` should stay presentation-focused and should not own compilation state.
- Existing fullscreen modal/feed components should remain separate unless a small shared primitive is useful.

## Testing Strategy

Add tests for:

- Compilation URL build/parse behavior, including `returnTo` and fallback route derivation.
- Initial source resolution for search-backed and feed-backed descriptors.
- Auto-advance behavior updating the current `video` in the URL.
- Tail pagination firing when playback nears the end of loaded results.
- End-of-source behavior when no more pages are available.
- Trigger rendering on search results and eligible feed-backed lists.

## Risks

- Search and feed hooks do not share identical pagination semantics, so the compilation page needs a thin normalization layer.
- Preloading too aggressively could waste bandwidth, especially on mobile.
- History handling can become confusing if URL updates push new entries instead of replacing appropriately during auto-advance.

## Recommendation

Use a dedicated route-level compilation player backed by a normalized source descriptor and explicit `returnTo` semantics. This gives stable context, deterministic navigation, and enough control to deliver the seamless preloaded playback experience without overloading existing grid or detail-page components.

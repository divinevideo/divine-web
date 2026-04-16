# Search Video Feed Design

## Problem

Search results currently open videos as isolated detail pages. Users can watch the selected clip, but they cannot continue scrolling through the rest of the current search result set as a feed.

## Goal

When a user clicks a video from search results, the detail route should preserve the search context and behave like a bounded feed. Scrolling or keyboard navigation should move to the next or previous video from that same search query, filter, and sort order.

## Non-Goals

- Redesign the search page layout.
- Replace the `/video/:id` route with a fullscreen modal flow.
- Encode full search result payloads into the URL.

## Approved Behavior

### Entry

- Clicking a search result video navigates to `/video/:id`.
- The route includes a navigation context with:
  - `source=search`
  - `q=<current query>`
  - `sort=<current sort>`
  - `index=<clicked result index>`

### Feed Scope

- The bounded feed is limited to the active search result set.
- The result set is defined by the current query text, the `videos` filter, and the active sort mode.
- Navigating between videos must not fall through into discovery, trending, or other broader feeds.

### Detail Page

- `VideoPage` treats search as a first-class navigation source.
- When `source=search` is present, it loads adjacent search results and renders the existing sequential detail/feed experience.
- Arrow key navigation and scroll-based progression stay within the search result set.

### Fallbacks

- Direct visits to `/video/:id` without search context keep the existing single-video behavior.
- If the search context is malformed, empty, or cannot load surrounding results, the page still shows the selected video without bounded-feed navigation.

## Architecture

### Search Page

- Search results use a search-aware navigation URL instead of a bare `/video/:id` link.
- The URL generation stays close to the search result rendering path so query, sort, and clicked index are captured from current state.

### Navigation Context

- Extend `VideoNavigationContext` to support a `search` source and search-specific parameters.
- Keep the shape narrow: only include data needed to reconstruct the result set on `VideoPage`.

### Video Page

- Parse search navigation parameters alongside existing hashtag/profile/discovery-style sources.
- Use the search data to load the current result window and compute previous/next navigation targets.
- Reuse existing route-based detail navigation instead of introducing a new overlay system.

## Testing Strategy

- Add a search page test that proves clicking a video navigates with `source=search`, `q`, `sort`, and `index`.
- Add video page coverage for search navigation behavior, confirming the page can sequence through search results instead of behaving as a one-off detail view.
- Run focused tests during the red/green cycle, then run the full project verification command before completion.

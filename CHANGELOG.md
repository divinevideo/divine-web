# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- **UI**: Rename "Verified" badge to "Human Made" with checkmark icon for ProofMode verified content
  - Updated ProofModeBadge to use custom no-AI/human-made icon
  - Updated VerifiedOnlyToggle label from "Verified" to "Human Made"
- **UI**: Move VineBadge ("V Archived") to upper right corner of video cards, consistent with ProofModeBadge positioning
- **BUGFIX**: Fix Classic Vines tab showing random new videos instead of archived Vines
  - Root cause: Relay doesn't support combining `#platform` tag filter with NIP-50 `search` parameter
  - Removed NIP-50 search from Classic/top queries; Vines now fetched by platform tag and sorted client-side by loop count
- **UI**: VideoCard layout improvements
  - Added `layout` prop for horizontal (Vine-style) vs vertical layouts
  - Video page now uses vertical layout with narrower click zones for better button accessibility
  - Reduced font sizes for better information density
- **BUGFIX**: Fix hashtag pages not loading content (e.g., `/hashtag/lol`)
  - Root cause: Relay doesn't support combining `#t` tag filter with NIP-50 `search` parameter
  - Removed NIP-50 search from hashtag queries; sorting now applied client-side for hashtag feeds
  - Added client-side sorting for hashtag feeds (top/hot/rising modes)
- **BUGFIX**: Fix multiple videos playing simultaneously
  - Fixed stale closure bug in `VideoPlaybackContext` visibility selection callback
  - Fixed pause logic in `VideoPlayer` to always pause inactive videos regardless of loading state
- **IMPROVEMENT**: Normalize hashtag tags to lowercase when publishing new videos for consistent querying
- **PERFORMANCE**: Dramatically improve perceived page load speed with deferred social metrics loading
  - Videos now render immediately with placeholders for reactions/comments
  - Social metrics (likes, reposts, comments) load progressively after render
  - First 3 videos load metrics immediately, rest load with staggered delays (progressive enhancement)
  - Reduces initial relay queries from ~100+ to ~20, improving time-to-first-video from 5.7s to <1s
  - New hook: `useDeferredVideoMetrics` for progressive data loading
  - Updated `useVideoSocialMetrics` and `useVideoUserInteractions` to support optional `enabled` flag
- Discovery routing: Add `/discovery/:tab` routes (hot, top, rising, new, hashtags) and default `/discovery` → `/discovery/new`. Sync tab state with URL.
- Performance metrics: Instrument recent feed with query/parse/total timings and first-render metric; expose logs via `window.performanceMonitor`.
- Modal/feed stability: Prevent layout/scroll jumps by reserving scrollbar gutter and disabling overflow anchoring on feed containers.
  - CSS: `html { scrollbar-gutter: stable both-edges; }`.
  - CSS: `.feed-root { overflow-anchor: none; }` and apply to `VideoFeed` wrappers.
- Comments UX: Optimistically increment comment count on post from comments modal.
  - `CommentsSection` → `onCommentPosted` callback.
  - `VideoCommentsModal` forwards callback.
  - `VideoCard` maintains `localCommentCount` and updates immediately.
- Add-to-List dialog: Surface discovery by showing public lists that already include the video (lazy-loaded, up to 6 with links).
- UI bugfix: Convert `Badge` to `forwardRef` to resolve React ref warning with Radix slots.
- Meta/security cleanup: Remove invalid `<meta http-equiv="X-Frame-Options">`; add `mobile-web-app-capable` meta. Server headers should set X-Frame-Options/CSP.
- Docs: Add `AGENTS.md` contributor guide.

## [Previous]
- Initial project setup and ongoing work (see git history).

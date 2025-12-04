# Comments System Fixes - Complete Summary

This document summarizes all fixes applied to the comments system to resolve issues with comment loading and display.

## Issues Fixed

### 1. Comments Showing Incorrectly on Specific Video URLs
**File**: `docs/COMMENTS_FIX.md`  
**Commit**: c5f8fd1

**Problem**: When navigating to specific video URLs and opening the comments modal, all videos showed the same comments regardless of which video was being viewed.

**Root Cause**: The `VideoCommentsModal` component was constructing a new `NostrEvent` object without the `d` tag. Since kind 34236 videos are addressable events, the `d` tag (vineId) is required to create the unique addressable identifier.

**Solution**: Use `video.originalEvent` when available to preserve all tags, including the critical `d` tag. Fallback to constructed event now includes the vineId as a `d` tag.

**Impact**: Each video now queries for its own unique comments using the proper addressable identifier (`34236:pubkey:vineId`).

---

### 2. Comment Count Not Displaying in Video Metrics
**File**: `docs/COMMENT_COUNT_FIX.md`  
**Commit**: 72321cd

**Problem**: Comment counts were always showing 0 in video metrics, even when videos had comments.

**Root Cause**: The `useVideoSocialMetrics` hook was only querying for social interactions using the `#e` tag. Since kind 34236 videos are addressable events, comments use the `#a` tag to reference them, not the `#e` tag.

**Solution**: Split the query into two filters:
1. Standard event references (`#e`) for likes, reposts, and zaps
2. Addressable event references (`#a`) for comments

**Impact**: Comment counts are now properly fetched and displayed for all videos.

---

## Technical Background

### Addressable Events

Rewind Web videos use **kind 34236**, which is an **addressable event** type (NIP-33). Addressable events have unique identifiers composed of three parts:

```
<kind>:<pubkey>:<d-tag-value>
```

For example:
```
34236:npub123...:hBFP5LFKUOU
```

### Tag Reference Mechanisms

Different Nostr event types use different reference mechanisms:

| Event Type | Kind Range | Reference Tag | Query Filter | Example |
|------------|-----------|---------------|--------------|---------|
| Regular | 1-9999 | `e` (lowercase) | `#e` | `{"#e": ["event-id"]}` |
| Replaceable | 10000-19999 | `a` (lowercase) | `#a` | `{"#a": ["10000:pubkey:"]}` |
| Addressable | 30000-39999 | `a` (lowercase) | `#a` | `{"#a": ["34236:pubkey:d-tag"]}` |

**Critical Rule**: When querying for events that reference an addressable event:
1. Use the full addressable identifier (kind:pubkey:d-tag)
2. Query with `#a` (uppercase A), not `#e`
3. Comments on addressable events use lowercase `a` tag in their tags array

### Comment Event Flow

When a user comments on a video:

1. **Comment Creation** (kind 1111):
   ```json
   {
     "kind": 1111,
     "content": "Great video!",
     "tags": [
       ["a", "34236:author-pubkey:vineId"],  // References the video
       ["e", "comment-id", "relay", "root"],  // For threading
     ]
   }
   ```

2. **Query for Comments**:
   ```typescript
   {
     kinds: [1111],
     "#a": ["34236:author-pubkey:vineId"]  // Find all comments for this video
   }
   ```

3. **Filter Top-Level Comments**:
   - Comments with lowercase `a` tag matching the video's addressable ID
   - No parent `e` tag (or parent is the root)

## Files Modified

### Core Fixes
1. `src/components/VideoCommentsModal.tsx` - Preserve `d` tag in video event
2. `src/hooks/useVideoSocialMetrics.ts` - Add `#a` tag query for comments

### Propagated Changes
3. `src/components/VideoFeed.tsx` - Pass vineId to hooks
4. `src/pages/VideoPage.tsx` - Pass vineId to hooks, update invalidations
5. `src/hooks/useOptimisticLike.ts` - Update query key with vineId
6. `src/hooks/useOptimisticRepost.ts` - Update query key with vineId

### Documentation
7. `docs/COMMENTS_FIX.md` - Comment loading bug documentation
8. `docs/COMMENT_COUNT_FIX.md` - Comment count bug documentation
9. `docs/COMMENTS_FIXES_SUMMARY.md` - This summary

## Testing Checklist

To verify all fixes are working:

- [ ] Navigate to a specific video URL
- [ ] Open comments modal
- [ ] Verify comments are specific to that video
- [ ] Navigate to a different video URL
- [ ] Open comments modal
- [ ] Verify different comments are shown
- [ ] Check video metrics show correct comment count
- [ ] Post a new comment
- [ ] Verify comment count increments
- [ ] Verify new comment appears in modal
- [ ] Test on video feeds (Home, Discovery, Trending, Hashtag)
- [ ] Test on profile pages
- [ ] Test with videos that have 0, 1, and many comments

## Prevention Guidelines

To avoid similar issues in the future:

### 1. Always Use Original Events When Available
```typescript
// GOOD
const videoEvent = video.originalEvent || constructFallback();

// BAD
const videoEvent = constructFromParsedData();
```

### 2. Check Event Kind Before Querying References
```typescript
import { NKinds } from '@nostrify/nostrify';

if (NKinds.addressable(event.kind)) {
  // Use #a tag with full addressable ID
  filter['#a'] = [`${event.kind}:${event.pubkey}:${dTag}`];
} else {
  // Use #e tag with event ID
  filter['#e'] = [event.id];
}
```

### 3. Include Required Identifiers in Hook Parameters
```typescript
// GOOD - Provides all needed data
useVideoSocialMetrics(video.id, video.pubkey, video.vineId)

// BAD - Missing vineId for addressable events
useVideoSocialMetrics(video.id, video.pubkey)
```

### 4. Keep Query Keys Consistent
```typescript
// Query key should match exactly what the hook needs
queryKey: ['video-social-metrics', videoId, videoPubkey, vineId]

// Use predicates for invalidation when key structure is complex
queryClient.invalidateQueries({ 
  predicate: (query) => 
    query.queryKey[0] === 'video-social-metrics' && 
    query.queryKey[1] === videoId 
});
```

### 5. Document Tag Requirements
Every component/hook that works with Nostr events should document:
- What event kinds it supports
- What tags it requires
- What tags it queries for
- Example event structures

## Related NIPs

- **NIP-01**: Basic protocol (event structure, tags)
- **NIP-09**: Event deletion
- **NIP-22**: Comment events (kind 1111)
- **NIP-33**: Parameterized Replaceable Events (addressable events)

## Commits

1. **c5f8fd1**: Fix comments showing incorrectly on specific video URLs
2. **de7d036**: Add documentation for comments loading bug fix
3. **72321cd**: Fix comment count display in video metrics
4. **d1f7e37**: Add documentation for comment count display fix

## Branch

All fixes are on the `comments-loading` branch.

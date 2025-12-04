# Comments Loading Bug Fix

## Problem

When navigating to specific video URLs, the comments modal would always show the same comments regardless of which video was being viewed. This issue only affected the VideoPage (individual video URLs), not the video feeds.

**Example URLs affected:**
- `https://divine.video/video/35a6c4986d8c36568dc935a16b085f5bccf158875c9b0765c2a8dd58...`
- `https://divine.video/video/7ff435a47ec55124ff4ee997f83e0a1d334e965ae196d103d3c81bf8...`

## Root Cause

The bug was in `VideoCommentsModal.tsx`. The component was constructing a new `NostrEvent` object for the comments query, but this constructed object was missing critical metadata.

### Technical Details

1. **Kind 34236 is Addressable**: Rewind Web videos use Nostr event kind 34236, which is an addressable event type.

2. **Addressable Events Require 'd' Tag**: Addressable events use a special identifier format:
   ```
   <kind>:<pubkey>:<d-tag-value>
   ```
   For example: `34236:npub123...:hBFP5LFKUOU`

3. **Comment Filtering**: The `useComments` hook (via `@nostrify/react`) queries for comments using different filters based on the event type:
   ```typescript
   if (NKinds.addressable(root.kind)) {
     const d = root.tags.find(([name]) => name === 'd')?.[1] ?? '';
     filter['#A'] = [`${root.kind}:${root.pubkey}:${d}`];
   }
   ```

4. **The Bug**: The `VideoCommentsModal` was creating a new event object without the `d` tag:
   ```typescript
   // OLD (BROKEN) CODE
   const videoEvent: NostrEvent = {
     id: video.id,
     pubkey: video.pubkey,
     created_at: video.createdAt,
     kind: video.kind,
     content: video.content,
     tags: [
       ['url', video.videoUrl],
       ['title', video.title],
       // ... other tags but NO 'd' tag!
     ],
     sig: '',
   };
   ```

5. **Result**: Without the `d` tag, all videos queried for comments using the same filter:
   ```
   #A = 34236:pubkey:
   ```
   This returned ALL comments for ALL videos by that author, not just the specific video.

## Solution

Use the `originalEvent` stored in `ParsedVideoData` whenever available, which preserves all original tags including the critical `d` tag:

```typescript
// NEW (FIXED) CODE
const videoEvent: NostrEvent = video.originalEvent || {
  id: video.id,
  pubkey: video.pubkey,
  created_at: video.createdAt,
  kind: video.kind,
  content: video.content,
  tags: [
    ['url', video.videoUrl],
    ...(video.title ? [['title', video.title]] : []),
    ...video.hashtags.map(tag => ['t', tag]),
    ...(video.thumbnailUrl ? [['thumb', video.thumbnailUrl]] : []),
    ...(video.duration ? [['duration', video.duration.toString()]] : []),
    // CRITICAL: Include vineId as 'd' tag for addressable events
    ...(video.vineId ? [['d', video.vineId]] : []),
  ],
  sig: '',
};
```

Now each video queries for its unique comments using:
```
#A = 34236:pubkey:vineId
```

## Why It Worked in Feeds

The bug only appeared on the VideoPage, not in feeds. This is because:

1. **Different Code Paths**: Video feeds don't use `VideoCommentsModal` - they have their own comment handling
2. **Original Events Preserved**: The feed components likely pass the original event data directly

## Prevention

To prevent similar issues:

1. **Always use `originalEvent`** when available from `ParsedVideoData`
2. **Include all critical tags** when constructing fallback events
3. **Test with addressable events** (kind 30000+) to verify proper filtering
4. **Document tag requirements** for addressable events in comments

## Testing

To verify the fix:
1. Navigate to a specific video URL
2. Open the comments modal
3. Verify comments are specific to that video
4. Navigate to a different video
5. Verify different comments are shown

## References

- **NIP-33**: Parameterized Replaceable Events (addressable events)
- **NIP-22**: Event `a` tag (addressable event references)
- **Code**: `src/components/VideoCommentsModal.tsx`
- **Commit**: c5f8fd1

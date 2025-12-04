# Comment Count Display Bug Fix

## Problem

Comment counts were not being displayed in video metrics (showing 0 comments even when videos had comments). This affected both video feeds and individual video pages.

## Root Cause

The bug was in `useVideoSocialMetrics.ts`. The hook was querying for all social interactions (likes, reposts, comments) using only the `#e` tag:

```typescript
// OLD (BROKEN) CODE
const events = await nostr.query([
  {
    kinds: [1, 6, 7, 1111, 9735], // comments, reposts, reactions, zaps
    '#e': [videoId], // Only querying by event ID
    limit: 500,
  }
], { signal });
```

### Technical Details

1. **Kind 34236 is Addressable**: Rewind Web videos use kind 34236, which is an addressable event type.

2. **Comments Use Different Tags**: When commenting on different event types, NIP-22 (kind 1111) comments use different reference tags:
   - **Regular events**: Use `e` tag (lowercase) → Query with `#e` (uppercase E)
   - **Addressable events**: Use `a` tag (lowercase) → Query with `#a` (uppercase A)

3. **Tag Format for Addressable Events**:
   ```
   Comment event tags:
   ["a", "34236:pubkey:vineId"]  // References the addressable video
   
   Query filter:
   { "#a": ["34236:pubkey:vineId"] }  // Finds comments for that specific video
   ```

4. **The Miss**: Since the query only used `#e`, it never found comments that referenced videos using the `#a` tag, resulting in `commentCount: 0`.

## Solution

Split the query into two filters:

1. **Standard event references** (`#e`): For likes, reposts, and zaps
2. **Addressable event references** (`#a`): For comments on addressable videos

```typescript
// NEW (FIXED) CODE
const filters = [
  {
    kinds: [6, 7, 9735], // reposts, reactions, zap receipts
    '#e': [videoId], // Standard event references
    limit: 500,
  }
];

// Add addressable event filter for comments if we have the required data
if (videoPubkey && vineId) {
  const addressableId = `34236:${videoPubkey}:${vineId}`;
  filters.push({
    kinds: [1111], // NIP-22 comments
    '#a': [addressableId], // Addressable event references
    limit: 500,
  });
}

const events = await nostr.query(filters, { signal });
```

### Function Signature Change

Updated `useVideoSocialMetrics` to require the vineId:

```typescript
// Before
export function useVideoSocialMetrics(videoId: string, videoPubkey?: string)

// After
export function useVideoSocialMetrics(
  videoId: string, 
  videoPubkey?: string, 
  vineId?: string | null
)
```

### Query Key Update

The React Query cache key now includes vineId to prevent cache collisions:

```typescript
// Before
queryKey: ['video-social-metrics', videoId]

// After
queryKey: ['video-social-metrics', videoId, videoPubkey, vineId]
```

## Cascading Changes

Since the query key changed, several files needed updates:

### 1. **Callers Updated**
- `VideoFeed.tsx`: Pass `video.vineId` to `useVideoSocialMetrics`
- `VideoPage.tsx`: Pass `video.vineId` to `useVideoSocialMetrics`

### 2. **Optimistic Update Hooks**
- `useOptimisticLike.ts`: Accept `vineId` parameter, update query key
- `useOptimisticRepost.ts`: Update query key to include vineId

### 3. **Query Invalidations**
`VideoPage.tsx` invalidations now use predicate matching to catch all query key variants:

```typescript
// Before
queryClient.invalidateQueries({ queryKey: ['video-social-metrics', video.id] });

// After
queryClient.invalidateQueries({ 
  predicate: (query) => 
    Array.isArray(query.queryKey) && 
    query.queryKey[0] === 'video-social-metrics' && 
    query.queryKey[1] === video.id 
});
```

## Why This Matters

### Tag Reference Summary

Different Nostr event types use different reference mechanisms:

| Event Type | Kind Range | Reference Tag | Query Filter | Example |
|------------|-----------|---------------|--------------|---------|
| Regular | 1-9999 | `e` (lowercase) | `#e` | `{"#e": ["event-id"]}` |
| Replaceable | 10000-19999 | `a` (lowercase) | `#a` | `{"#a": ["10000:pubkey:"]}` |
| Addressable | 30000-39999 | `a` (lowercase) | `#a` | `{"#a": ["34236:pubkey:d-tag"]}` |

**Key Point**: When querying for events that reference an addressable event, you must:
1. Know it's addressable
2. Have the full addressable identifier (kind:pubkey:d-tag)
3. Query with `#a` (uppercase A), not `#e`

## Testing

To verify the fix:

1. Navigate to any video (feed or individual page)
2. Check that comment count displays correctly in metrics
3. Post a comment
4. Verify count increments
5. Navigate to another video
6. Verify each video shows its own unique comment count

## Prevention

To prevent similar issues:

1. **Always check event kind** before querying for references
2. **Use NKinds.addressable()** utility to determine event type
3. **Include vineId** in any video-related queries/mutations
4. **Test with different event types** (regular, replaceable, addressable)
5. **Document tag requirements** for each event kind

## References

- **NIP-01**: Basic protocol flow (event types and tags)
- **NIP-22**: Comment events (kind 1111)
- **NIP-33**: Parameterized Replaceable Events (addressable events)
- **Code Files**:
  - `src/hooks/useVideoSocialMetrics.ts`
  - `src/components/VideoFeed.tsx`
  - `src/pages/VideoPage.tsx`
  - `src/hooks/useOptimisticLike.ts`
  - `src/hooks/useOptimisticRepost.ts`
- **Commit**: 72321cd

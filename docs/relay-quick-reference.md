# Divine Relay Quick Reference

## Connection Info

- **Primary Relay**: `wss://relay.divine.video`
- **WebSocket Protocol**: Nostr (NIP-01)
- **Supported NIPs**: 01, 09, 50, 71
- **Custom Extensions**: Loop counting, server-side sorting

## NIP-50 Search Queries

### Sort Modes

```typescript
// Hot - Recent with high engagement
filter.search = 'sort:hot';

// Top - Most referenced all-time
filter.search = 'sort:top';

// Rising - New and gaining traction
filter.search = 'sort:rising';

// Controversial - Mixed reactions
filter.search = 'sort:controversial';
```

### Content Search

```typescript
// Simple search
filter.search = 'bitcoin';

// With sorting
filter.search = 'sort:hot bitcoin';

// Multiple terms (AND)
filter.search = 'bitcoin nostr';

// Fuzzy matching (automatic)
filter.search = 'bitcon'; // Matches "bitcoin"
```

## Optimized Filters

### Video Events (NIP-71)

```typescript
// SHORT_VIDEO_KIND and VIDEO_KINDS constants can be found in 'video.ts'.

// All videos
filter.kinds = VIDEO_KINDS;

// User's videos
filter.kinds = VIDEO_KINDS;
filter.authors = [pubkey];

// Hashtag videos
filter.kinds = VIDEO_KINDS;
filter['#t'] = ['bitcoin'];

// Trending videos
filter.kinds = VIDEO_KINDS;
filter.search = 'sort:hot';
filter.limit = 50;
```

### Tag Filters (Fast O(log n) lookups)

```typescript
// Event references
filter['#e'] = [eventId];

// Pubkey mentions
filter['#p'] = [pubkey];

// Address references
filter['#a'] = [`${SHORT_VIDEO_KIND}:pubkey:identifier`];

// Hashtags
filter['#t'] = ['bitcoin', 'nostr'];

// URLs
filter['#r'] = ['https://example.com'];

// Custom tags (any letter)
filter['#x'] = ['value'];
```

## Pagination Patterns

### Cursor-Based (Recommended)

```typescript
// First page
const page1 = await nostr.req([{
  kinds: VIDEO_KINDS,
  limit: 20,
  search: 'sort:hot'
}]);

// Next page
const page2 = await nostr.req([{
  kinds: VIDEO_KINDS,
  limit: 20,
  search: 'sort:hot',
  until: page1[page1.length - 1].created_at - 1
}]);
```

### Time-Based

```typescript
// Last 24 hours
const since = Math.floor(Date.now() / 1000) - 86400;
filter.since = since;

// Between dates
filter.since = startTimestamp;
filter.until = endTimestamp;
```

## Batch Queries

### Multiple Filters in One Request

```typescript
// Fetch profile + videos + stats
const filters = [
  { kinds: [0], authors: [pubkey] },           // Profile
  { kinds: VIDEO_KINDS, authors: [pubkey] },   // Videos
  { kinds: [3], authors: [pubkey] }            // Follow list
];

const events = await nostr.req(filters);
```

### Parallel User Queries

```typescript
// Get videos from multiple users
const filters = pubkeys.map(pk => ({
  kinds: VIDEO_KINDS,
  authors: [pk],
  limit: 10,
  search: 'sort:hot'
}));

const events = await nostr.req(filters);
```

## Performance Tips

### DO ✅

```typescript
// Use NIP-50 for sorting
filter.search = 'sort:hot';

// Use tag filters
filter['#t'] = ['bitcoin'];

// Batch related queries
const filters = [filter1, filter2, filter3];

// Limit result sets
filter.limit = 20;

// Use cursor pagination
filter.until = lastEventTimestamp - 1;
```

### DON'T ❌

```typescript
// Don't use custom sort parameter
filter.sort = { field: 'loop_count' }; // ❌

// Don't fetch all then filter
const all = await nostr.req([{ kinds: VIDEO_KINDS }]);
const filtered = all.filter(...); // ❌

// Don't make many small queries
for (const pk of pubkeys) {
  await nostr.req([{ authors: [pk] }]); // ❌
}

// Don't ignore limits
filter.limit = 10000; // ❌
```

## Common Queries

### Trending Feed

```typescript
const trendingVideos = await nostr.req([{
  kinds: VIDEO_KINDS,
  limit: 50,
  search: 'sort:hot'
}]);
```

### Discovery Feed

```typescript
const discoverVideos = await nostr.req([{
  kinds: VIDEO_KINDS,
  limit: 50,
  search: 'sort:top',
  since: Math.floor(Date.now() / 1000) - 604800 // Last week
}]);
```

### User Profile with Videos

```typescript
const [profile, videos] = await Promise.all([
  nostr.req([{ kinds: [0], authors: [pubkey], limit: 1 }]),
  nostr.req([{ 
    kinds: VIDEO_KINDS, 
    authors: [pubkey], 
    limit: 20,
    search: 'sort:hot'
  }])
]);
```

### Hashtag Feed

```typescript
const hashtagVideos = await nostr.req([{
  kinds: VIDEO_KINDS,
  '#t': [hashtag.toLowerCase()],
  limit: 50,
  search: 'sort:hot'
}]);
```

### Search Videos

```typescript
const searchResults = await nostr.req([{
  kinds: VIDEO_KINDS,
  search: `sort:hot ${searchTerm}`,
  limit: 50
}]);
```

## Error Handling

```typescript
try {
  const events = await nostr.req([filter]);
  return events;
} catch (error) {
  // Fallback to client-side filtering
  console.warn('NIP-50 not supported, using fallback');
  const events = await nostr.req([{ 
    ...filter, 
    search: undefined  // Remove search
  }]);
  return clientSideFilter(events, searchTerm);
}
```

## Monitoring

### Check Relay Health

```bash
curl https://relay.divine.video/health
```

### View Metrics

```bash
curl https://relay.divine.video/metrics
```

### Test WebSocket Connection

```javascript
const ws = new WebSocket('wss://relay.divine.video');
ws.onopen = () => console.log('Connected');
ws.send(JSON.stringify(['REQ', 'test', { kinds: VIDEO_KINDS, limit: 1 }]));
```

## Migration Checklist

- [ ] Remove `nostrifyPatch.ts`
- [ ] Replace `filter.sort` with `filter.search = 'sort:X'`
- [ ] Add pagination with `until` cursor
- [ ] Use tag filters (`#t`, `#p`, etc.)
- [ ] Batch related queries
- [ ] Add proper error handling
- [ ] Test with standard Nostr relays

## TypeScript Types

```typescript
// Add to types/nostr.ts
interface NIP50Filter extends NostrFilter {
  search?: string;
}

type SortMode = 'hot' | 'top' | 'rising' | 'controversial';

interface PaginatedQuery {
  filter: NIP50Filter;
  cursor?: number;
  pageSize: number;
}

interface VideoQuery extends NIP50Filter {
  kinds: typeof VIDEO_KINDS;
}
```

## Example: Complete Video Feed Hook

```typescript
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

export function useVideoFeed(sortMode: SortMode = 'hot') {
  const { nostr } = useNostr();
  
  return useInfiniteQuery({
    queryKey: ['videos', sortMode],
    queryFn: async ({ pageParam }) => {
      const filter: NIP50Filter = {
        kinds: VIDEO_KINDS,
        limit: 20,
        search: `sort:${sortMode}`
      };
      
      if (pageParam) {
        filter.until = pageParam;
      }
      
      const events = await nostr.req([filter]);
      
      return {
        videos: events,
        nextCursor: events.length > 0 
          ? events[events.length - 1].created_at - 1
          : undefined
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!nostr
  });
}
```
# Divine Relay Architecture Documentation

## Overview

The Divine webapp uses a high-performance OpenSearch-backed Nostr relay (relay.divine.video) with custom extensions for video-centric content. This document describes the relay's architecture, capabilities, and optimal usage patterns.

## Relay Architecture

### Core Components

1. **Deno Server** (16 parallel instances)
   - WebSocket handling for real-time communication
   - Fast message queueing without blocking
   - Connection management and rate limiting

2. **Redis Queues**
   - `nostr:relay:queue` - Raw client messages
   - `nostr:events:queue` - Validated events for storage
   - `nostr:responses:{connId}` - Per-connection responses

3. **Relay Workers** (16 parallel by default)
   - Event validation and signature verification
   - Protocol logic handling
   - Parallel processing for high throughput

4. **Storage Workers** (2 parallel by default)
   - Batch insertion (up to 1000 events per batch)
   - OpenSearch bulk API usage
   - Optimized write performance

5. **OpenSearch Database**
   - Full-text search with custom analyzer
   - Comprehensive tag indexing
   - Custom aggregations for trending/popular content

### Performance Characteristics

- **Event Ingestion**: 10,000+ events/second
- **Query Response**: Sub-100ms for most queries
- **Concurrent Connections**: 10,000+ WebSocket connections
- **Bulk Inserts**: 1000 events per batch
- **Index Refresh**: 5-second interval

## Custom Extensions

### 1. Sort Parameter (Non-Standard)

The relay implements a custom `sort` extension NOT part of standard Nostr protocol:

```typescript
{
  kinds: VIDEO_KINDS,
  limit: 50,
  sort: {
    field: 'loop_count',
    dir: 'desc'
  }
}
```

**Important**: This requires special client handling via `nostrifyPatch.ts`.

### 2. NIP-50 Search Extensions

Advanced search modes for content discovery:

- `sort:hot` - Recent events with high engagement
- `sort:top` - Most referenced events
- `sort:controversial` - Mixed positive/negative reactions
- `sort:rising` - Recently created events gaining engagement

Example:
```json
{"kinds": VIDEO_KINDS, "search": "sort:hot", "limit": 50}
```

### 3. Optimized Tag Indexing

All tags are indexed for O(log n) lookups:
- Common tags: `e`, `p`, `a`, `d`, `t`, `r`, `g` (dedicated fields)
- Multi-letter tags: Indexed via nested `tags_flat` structure

## Database Schema

### Document Structure

```typescript
interface NostrEventDocument {
  // Core fields
  id: string;           // Event ID (document ID)
  pubkey: string;       // Author pubkey
  created_at: number;   // Unix timestamp
  kind: number;         // Event kind
  content: string;      // Full-text searchable
  sig: string;          // Event signature
  tags: string[][];     // Original tags
  
  // Optimized tag fields
  tag_e?: string[];     // Event references
  tag_p?: string[];     // Pubkey references
  tag_a?: string[];     // Address references
  tag_d?: string[];     // Identifier tags
  tag_t?: string[];     // Hashtags
  tag_r?: string[];     // URL references
  tag_g?: string[];     // Geohash tags
  
  // Generic tag storage
  tags_flat?: Array<{name: string; value: string}>;
  
  // Metadata
  indexed_at: number;   // Indexing timestamp
}
```

### Custom Fields for Videos

The relay tracks engagement metrics server-side:
- `loop_count` - Number of loops/views (custom field)
- Reference counting via aggregations on `tag_e`

## Event Processing Pipeline

### Write Path
1. Client sends event via WebSocket
2. Server queues to Redis (microseconds)
3. Relay worker validates (parallel)
4. Valid events queued for storage
5. Storage worker batch inserts to OpenSearch

### Read Path
1. Client sends REQ with filters
2. Server constructs OpenSearch query
3. Tag filters use optimized fields
4. Results returned via WebSocket
5. EOSE sent when complete

## NIP Support

### Implemented NIPs
- **NIP-01**: Basic protocol flow
- **NIP-09**: Event deletion (automatic processing)
- **NIP-50**: Full-text search with extensions
- **NIP-71**: Video events (kinds 21, 22, 34236)

### Custom Video Support
- Kind 34236: 6-second looping videos (OpenVine spec)
- Server-side loop counting
- Trending/discovery algorithms

## Current Implementation Issues

### 1. Misaligned Sort Usage

**Problem**: The app uses a non-standard `sort` parameter that requires patching Nostrify.

**Current Implementation**:
```typescript
// useVideoEvents.ts line 356
(baseFilter as NostrFilter & { sort?: { field: string; dir: string } }).sort = { field: 'loop_count', dir: 'desc' };
```

**Issue**: 
- Requires brittle monkeypatch (`nostrifyPatch.ts`)
- Breaks with Nostrify updates
- Not compatible with standard relays

**Solution**: Use NIP-50 search extensions instead:
```typescript
baseFilter.search = 'sort:hot';  // or 'sort:top'
```

### 2. Missing NIP-50 Implementation

**Problem**: App doesn't use NIP-50 full-text search capabilities.

**Current State**: 
- No full-text search in video content
- Manual client-side filtering
- Missing trending algorithms

**Solution**: Implement NIP-50 search:
```typescript
// For trending videos
filter.search = 'sort:hot';

// For content search
filter.search = `bitcoin ${searchTerm}`;

// Combined
filter.search = `sort:top ${searchTerm}`;
```

### 3. Inefficient Tag Queries

**Problem**: Not utilizing optimized tag indexing.

**Current**: Client-side filtering after fetching all events.

**Solution**: Use server-side tag filters:
```typescript
filter['#t'] = ['bitcoin', 'nostr'];  // Hashtags
filter['#p'] = [pubkey];              // Mentions
filter['#e'] = [eventId];             // References
```

### 4. Suboptimal Batch Fetching

**Problem**: Individual queries instead of batched requests.

**Current**: Multiple separate queries for related data.

**Solution**: Combine filters in single REQ:
```typescript
const filters = [
  { kinds: VIDEO_KINDS, authors: [pubkey1] },
  { kinds: VIDEO_KINDS, authors: [pubkey2] },
  { kinds: VIDEO_KINDS, '#t': ['trending'] }
];
// Send as single REQ
```

### 5. Missing Pagination Strategy

**Problem**: Fetching too many events at once.

**Current**: Large limit values without proper pagination.

**Solution**: Implement cursor-based pagination:
```typescript
// First page
filter.limit = 20;

// Next page
filter.until = lastEvent.created_at - 1;
filter.limit = 20;
```

### 6. No Caching of Aggregations

**Problem**: Re-computing engagement metrics client-side.

**Solution**: Trust server-side metrics:
- Use `loop_count` from relay
- Leverage aggregation endpoints
- Cache computed values

## Optimization Plan

### Phase 1: Replace Custom Sort with NIP-50 (Priority: HIGH)

1. **Remove nostrifyPatch.ts**
2. **Update useVideoEvents.ts**:
   ```typescript
   // Replace custom sort
   if (feedType === 'trending') {
     baseFilter.search = 'sort:hot';
   } else if (feedType === 'discovery') {
     baseFilter.search = 'sort:top';
   }
   ```
3. **Benefits**:
   - Standard compliance
   - Works with any NIP-50 relay
   - No patching required

### Phase 2: Implement Full-Text Search (Priority: HIGH)

1. **Add search to video queries**:
   ```typescript
   // useSearchVideos.ts
   filter.search = searchTerm;
   filter.kinds = VIDEO_KINDS;
   ```
2. **Combine with sort modes**:
   ```typescript
   filter.search = `sort:hot ${searchTerm}`;
   ```
3. **Benefits**:
   - Instant search results
   - Server-side relevance scoring
   - Reduced bandwidth

### Phase 3: Optimize Tag Queries (Priority: MEDIUM)

1. **Use indexed tag fields**:
   ```typescript
   // Hashtag feeds
   filter['#t'] = [hashtag.toLowerCase()];
   
   // User mentions
   filter['#p'] = mentionedPubkeys;
   ```
2. **Benefits**:
   - O(log n) lookups
   - Reduced result sets
   - Faster response times

### Phase 4: Implement Proper Pagination (Priority: MEDIUM)

1. **Add cursor-based pagination**:
   ```typescript
   interface PaginationOptions {
     limit: number;
     until?: number;
     since?: number;
   }
   ```
2. **Track pagination state**:
   ```typescript
   const [cursor, setCursor] = useState<number>();
   
   // Next page
   filter.until = cursor;
   filter.limit = 20;
   ```
3. **Benefits**:
   - Reduced memory usage
   - Faster initial load
   - Smooth infinite scroll

### Phase 5: Leverage Server Metrics (Priority: LOW)

1. **Trust server-side loop counts**
2. **Use aggregation data for trending**
3. **Cache engagement metrics**
4. **Benefits**:
   - Reduced computation
   - Consistent metrics
   - Better performance

## Migration Guide

### Step 1: Update Dependencies
```bash
npm update @nostrify/nostrify
```

### Step 2: Remove Patching
1. Delete `src/lib/nostrifyPatch.ts`
2. Remove patch initialization from `main.tsx`

### Step 3: Update Queries
Replace custom sort with NIP-50:
```typescript
// Before
filter.sort = { field: 'loop_count', dir: 'desc' };

// After
filter.search = 'sort:hot';
```

### Step 4: Test Thoroughly
1. Test all feed types
2. Verify search functionality
3. Check pagination
4. Monitor performance

## Performance Monitoring

### Key Metrics to Track

1. **Query Latency**
   - Target: < 100ms
   - Monitor: P50, P95, P99

2. **Event Ingestion Rate**
   - Target: > 1000 events/sec
   - Monitor: Events per second

3. **WebSocket Connections**
   - Target: < 10ms handshake
   - Monitor: Active connections

4. **Search Performance**
   - Target: < 200ms full-text search
   - Monitor: Search query time

### Monitoring Endpoints

- `/health` - System health check
- `/metrics` - Prometheus metrics

## Best Practices

### DO:
- Use NIP-50 search extensions for sorting
- Batch related queries into single REQ
- Implement proper pagination
- Cache results client-side
- Use tag filters for efficient queries

### DON'T:
- Use custom WebSocket extensions
- Fetch all events then filter client-side
- Make multiple queries for related data
- Ignore server-side optimizations
- Override standard protocol behavior

## Conclusion

The relay.divine.video infrastructure is highly optimized for video content with powerful search and aggregation capabilities. By aligning the client implementation with the relay's strengths and removing non-standard customizations, the app can achieve significant performance improvements while maintaining standards compliance.
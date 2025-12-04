# Rewind Web Caching Strategy

## Overview

The Rewind Web application implements a comprehensive multi-layer caching strategy to provide instant loading of the home feed while ensuring data stays fresh and up-to-date. This document explains the architecture, implementation details, and cache invalidation rules.

## Problem Statement

Previously, the home feed would be completely empty on load until:
1. User's Kind 3 contact list fetched from relay (1-5 seconds)
2. Follow list parsed
3. Video feed queried with authors filter

This resulted in a poor user experience with long loading times and an empty screen.

## Solution Architecture

### Multi-Layer Cache Hierarchy

```
┌─────────────────────────────────────────┐
│        React Query Cache (Memory)       │  ← Hot cache, instant access
├─────────────────────────────────────────┤
│      localStorage (Synchronous)         │  ← Fast cache, <100ms access
├─────────────────────────────────────────┤
│    IndexedDB (Persistent Storage)       │  ← Durable cache, survives refresh
├─────────────────────────────────────────┤
│     NCache (In-Memory Event Store)      │  ← Profile/event cache
└─────────────────────────────────────────┘
```

### Cache Types

#### 1. Follow List Cache (`src/lib/followListCache.ts`)

**Purpose:** Store user's Kind 3 contact list for instant home feed rendering

**Storage:**
- Primary: localStorage (synchronous reads)
- Fallback: IndexedDB (async, survives localStorage clearing)

**Structure:**
```typescript
interface CachedFollowList {
  pubkey: string;        // User's pubkey
  follows: string[];     // Array of followed pubkeys
  timestamp: number;     // Cache creation time
  eventId: string;       // Contact list event ID
  createdAt: number;     // Original event timestamp
}
```

**Freshness:** 5 minutes (configurable via `MAX_AGE_MS`)

**Operations:**
- `getCached(pubkey)`: Synchronous read from localStorage
- `setCached(data)`: Sync write to localStorage + async to IndexedDB
- `isFresh(pubkey)`: Check if cache age < MAX_AGE_MS
- `isNewerThan(pubkey, timestamp)`: Compare cache vs relay event
- `invalidate(pubkey)`: Clear cache for specific user
- `clearAll()`: Remove all cached follow lists

#### 2. Event Cache (`src/lib/eventCache.ts`)

**Purpose:** Store Nostr events (profiles, contact lists, posts) for quick access

**Storage:**
- Primary: NCache (in-memory, max 1000 events)
- Secondary: IndexedDB (persistent)

**New Methods:**
- `getCachedProfile(pubkey)`: Synchronous profile lookup from memory
- `getCachedContactList(pubkey)`: Synchronous contact list lookup from memory

**Indexed Fields:**
- `pubkey`: User public key
- `kind`: Event kind
- `created_at`: Event timestamp
- `pubkey_kind`: Compound index for efficient queries

#### 3. Cached Nostr Client (`src/lib/cachedNostr.ts`)

**Purpose:** Wrap Nostr queries with cache-first logic

**Strategy:**
- Check cache first for profiles (Kind 0) and contact lists (Kind 3)
- Return cached data immediately
- Background refresh to update cache
- Cache all query results for future use

**Flow:**
```
Query → Check Cache → Cache Hit? 
                         ├─ Yes → Return cached + Background refresh
                         └─ No  → Query relay + Cache result
```

## Hook Enhancements

### `useFollowList()`

**Before:**
- Always queried relay on mount
- No cached data shown during loading
- 1-minute staleTime, 5-minute gcTime

**After:**
- Uses `initialData` from localStorage cache
- Shows cached data instantly (<100ms)
- Background refresh ensures freshness
- 5-minute staleTime, 30-minute gcTime
- Falls back to IndexedDB if localStorage cleared
- Returns cached data on relay errors

**User Experience:**
```
Mount → Show cached data (instant) → Background fetch → Update if newer
```

### `useAuthor(pubkey)`

**Before:**
- Always queried relay
- 5-minute staleTime, 30-minute gcTime

**After:**
- Uses `initialData` from event cache
- Synchronous cache check for instant rendering
- 30-minute staleTime, 2-hour gcTime
- Caches fetched profiles for future use

### `useFollowRelationship(targetPubkey)`

**Enhanced:**
- Invalidates follow list cache on follow/unfollow
- Ensures instant UI updates after actions

## Cache Invalidation Rules

| Trigger | Action | Reason |
|---------|--------|--------|
| User follows someone | Invalidate follow list cache + refetch | Immediate UI update |
| User unfollows someone | Invalidate follow list cache + refetch | Immediate UI update |
| User logs out | Clear user's follow list cache | Privacy |
| Cache > 5 minutes old | Background refetch on mount | Keep data fresh |
| Manual refresh | Force refetch, update cache | User requested |
| Relay returns newer event | Update cache with new data | Data consistency |
| Account switch | Load new user's cache | Account isolation |

## Performance Optimizations

### 1. Synchronous Cache Reads
- localStorage reads are synchronous (~1-10ms)
- No await needed for initial render
- IndexedDB used as backup (async fallback)

### 2. Stale-While-Revalidate Pattern
```typescript
initialData: () => getCachedData(),  // Show immediately
queryFn: async () => fetchFresh(),   // Fetch in background
```

### 3. Batched Author Fetches
- `useBatchedAuthors()` continues to batch profile queries
- Now benefits from event cache for instant lookups

### 4. Increased Cache Retention
- Follow lists: 5 min stale, 30 min GC (up from 1 min / 5 min)
- Profiles: 30 min stale, 2 hour GC (up from 5 min / 30 min)
- Reduces relay queries significantly

### 5. Smart Background Refresh
- Only refresh if cache is stale
- Silent background updates don't block UI
- Visual feedback (spinner) during refresh

## User Experience Improvements

### Before:
```
[Login] → [Empty screen] → [Loading...] → [Videos appear] (3-5 seconds)
```

### After:
```
[Login] → [Cached videos appear] → [Background refresh] → [Updated videos] (<100ms initial)
```

### Visual Feedback:
- Refresh spinner (🔄) shown during background fetch
- "Updating..." text when cache is stale
- Smooth transitions when fresh data arrives
- No jarring loading states

## Cache Preloading

**EventCachePreloader Component:**
- Automatically loads on login
- Preloads user's Kind 0, Kind 3, and recent Kind 1 events
- Restores follow list from IndexedDB to localStorage if needed
- Silent background operation

## Privacy & Security

### Logout Behavior:
- Clears user-specific follow list cache
- Prevents data leakage between accounts
- Maintains IndexedDB integrity

### Account Switching:
- Each user has isolated cache namespace
- Cache lookup by pubkey ensures separation
- No cross-contamination between accounts

## Testing Checklist

- [x] Fast path: Login → See cached data in <100ms
- [x] Fresh path: Background refresh updates data
- [x] Follow action: Cache invalidated, feed updates immediately
- [x] Unfollow action: Cache invalidated, feed updates immediately
- [x] Stale data: Cache >5 min triggers background refresh
- [x] Logout: Cache cleared for privacy
- [x] Account switch: Correct user's cache loaded
- [x] Offline: App shows cached data when disconnected
- [x] localStorage cleared: Falls back to IndexedDB
- [x] TypeScript: No type errors
- [x] Build: Successful compilation

## Monitoring & Debugging

### Debug Logging:
All cache operations log with `[FollowListCache]` prefix:
- Cache hits/misses
- Age calculations
- Invalidations
- IndexedDB operations

### Console Inspection:
```javascript
// Check localStorage cache
const cache = JSON.parse(localStorage.getItem('follow_list_<pubkey>'))
console.log('Cached follows:', cache.follows.length)
console.log('Cache age:', Date.now() - cache.timestamp, 'ms')

// Check IndexedDB
const db = await indexedDB.databases()
console.log('Databases:', db)
```

### React Query DevTools:
- Shows `initialData` source
- Displays `dataUpdatedAt` timestamp
- Indicates background fetching state
- Cache hit/miss visibility

## Configuration

### Tunable Parameters:

```typescript
// Follow List Cache (src/lib/followListCache.ts)
MAX_AGE_MS = 5 * 60 * 1000  // 5 minutes

// Follow List Query (src/hooks/useFollowList.ts)
staleTime: 5 * 60 * 1000    // 5 minutes
gcTime: 30 * 60 * 1000      // 30 minutes

// Author Query (src/hooks/useAuthor.ts)
staleTime: 30 * 60 * 1000   // 30 minutes
gcTime: 2 * 60 * 60 * 1000  // 2 hours

// Event Cache (src/lib/eventCache.ts)
max: 1000                    // Max in-memory events
```

### Recommendations:
- **MAX_AGE_MS:** 5 minutes balances freshness vs performance
- **staleTime:** Longer = fewer refetches, but older data
- **gcTime:** Longer = better UX on revisits, but more memory
- **max events:** 1000 is good for typical usage patterns

## Future Enhancements

### Potential Improvements:
1. **Service Worker Cache:** Persist video metadata for offline viewing
2. **Predictive Preloading:** Load likely-needed profiles before user navigates
3. **Cache Compression:** Reduce localStorage/IndexedDB size with compression
4. **TTL per Event Kind:** Different freshness rules for different data types
5. **LRU Eviction:** Smart cache eviction based on access patterns
6. **WebSocket Updates:** Invalidate cache on real-time Kind 3 events
7. **Cross-Tab Sync:** Share cache updates between browser tabs
8. **Cache Analytics:** Track hit rates, performance metrics

## Conclusion

This caching strategy provides:
- **⚡ Instant Loading:** < 100ms to show cached content
- **🔄 Fresh Data:** Background refresh ensures up-to-date info
- **📴 Offline Support:** App functional with cached data
- **🔒 Privacy:** Cache cleared on logout
- **🎯 Smart Invalidation:** Updates when it matters
- **💪 Resilience:** Falls back to cache on relay errors

The result is a dramatically improved user experience with fast, responsive home feed loading while maintaining data freshness and privacy.

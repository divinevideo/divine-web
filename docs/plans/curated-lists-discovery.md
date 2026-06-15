# Curated Lists Discovery - Implementation Plan

**Date:** 2026-02-24
**Status:** Draft
**Depends on:** Existing lists CRUD (implemented in 2026-01-04-lists-crud-improvements.md)

---

## 1. Current State of Lists Feature

### What Works
- **CRUD operations**: Create, edit, delete lists via `useCreateVideoList`, `useDeleteVideoList`, `EditListDialog`, `DeleteListDialog`
- **List detail page**: `ListDetailPage.tsx` shows list metadata, author, video grid, edit/delete for owners
- **Video management**: Add/remove videos from lists via `useAddVideoToList`, `useRemoveVideoFromList`
- **Basic discovery**: "Trending" tab in `ListsPage.tsx` shows recent lists sorted by video count + recency. "Discover" tab shows lists from followed users via `useFollowedUsersLists`
- **List badges**: `VideoListBadges.tsx` shows which lists a video appears in
- **Add to list dialog**: `AddToListDialog.tsx` lets users add videos to existing or new lists
- **Nostr protocol**: Lists use NIP-51 kind 30005 (addressable events), with `a` tags referencing video coordinates (`34236:pubkey:d-tag`)

### What's Missing
- **No thumbnail previews** - List cards show only text (name, description, author, video count). No visual preview of the videos inside
- **No search/filter** - Cannot search lists by name, tag, or content
- **No featured/staff picks** - No curated "editor's choice" lists section
- **No "Browse All" pagination** - Trending only fetches last week, limited to 50 events
- **No subscribe/follow lists** - Unlike mobile app, no way to subscribe to lists from other users
- **Sparse list cards** - No cover image grid, no thumbnail mosaic from list videos
- **No Funnelcake API support** - All list queries go through WebSocket Nostr relay, no REST optimization
- **No list play button** - Cannot start playing a list as a continuous feed

### Mobile Reference (Key Patterns to Bring to Web)
From `divine-mobile/mobile/lib/screens/discover_lists_screen.dart`:
- **Streaming discovery**: Uses `streamPublicListsFromRelays()` with progressive loading, debounced UI updates
- **Pagination**: Cursor-based with `until` timestamp, auto-paginates if results are sparse
- **Subscribe/unsubscribe**: Toggle button per list, persists to local storage + Nostr
- **List card**: Shows icon, name, description, author name (resolved), video count, tags
- **Sorted by video count**: Lists with more videos appear first

From `divine-mobile/mobile/lib/providers/list_providers.dart`:
- **DiscoveredListsState**: Separate cached state for discovered lists (persists across navigation)
- **publicListsContainingVideo**: Stream provider for finding lists that contain a specific video

---

## 2. Implementation Plan

### Phase 1: Enhanced List Preview Cards

**Goal:** Make list cards visually appealing with thumbnail grids.

#### New Component: `ListPreviewCard`
**File:** `src/components/ListPreviewCard.tsx`

A richer card that shows:
- **Thumbnail grid**: 2x2 mosaic of the first 4 video thumbnails from the list
- **List title** (bold)
- **Creator avatar + name** (resolved via `useAuthor`)
- **Video count** badge
- **Tags** (first 3, as small badges)
- **Created date** (relative via date-fns)

```
+---------------------------+
| [thumb1] [thumb2]         |
| [thumb3] [thumb4]         |
+---------------------------+
| My Awesome List           |
| by @username  ·  12 vids  |
| #comedy #cats #funny      |
+---------------------------+
```

**Data flow:**
- Takes a `VideoList` prop (already parsed)
- Uses `useAuthor(list.pubkey)` for creator info
- Fetches first 4 video thumbnails: new hook `useListThumbnails(videoCoordinates: string[], limit: number)`
- Falls back to list cover image if available, or generic placeholder

#### New Hook: `useListThumbnails`
**File:** `src/hooks/useListThumbnails.ts`

```typescript
function useListThumbnails(videoCoordinates: string[], limit = 4) {
  // Parse first N coordinates, query nostr for those video events,
  // extract thumbnail URLs from imeta tags
  // Returns: { thumbnails: string[], isLoading: boolean }
}
```

Uses the same `fetchListVideos` pattern from `ListDetailPage.tsx` but only fetches the first `limit` videos and extracts just thumbnail URLs.

**Query key:** `['list-thumbnails', ...videoCoordinates.slice(0, limit)]`
**Stale time:** 5 minutes (thumbnails rarely change)

#### Files to Create
| File | Purpose |
|------|---------|
| `src/components/ListPreviewCard.tsx` | Rich list card with thumbnail grid |
| `src/hooks/useListThumbnails.ts` | Fetch thumbnail URLs for first N videos in a list |

#### Files to Modify
| File | Change |
|------|--------|
| `src/pages/ListsPage.tsx` | Replace `ListCard` usage with `ListPreviewCard` |

---

### Phase 2: Browse All Lists with Search

**Goal:** Add a searchable, paginated view of all public lists.

#### Enhanced `useTrendingVideoLists` or New `useBrowseVideoLists`
**File:** Modify `src/hooks/useVideoLists.ts`

Current `useTrendingVideoLists` only fetches last week with limit 50. Replace with a more robust browsing hook:

```typescript
export function useBrowseVideoLists(options?: {
  searchQuery?: string;
  sortBy?: 'recent' | 'popular' | 'video-count';
  limit?: number;
}) {
  // Query kind 30005 events from relay
  // If searchQuery: use NIP-50 search filter
  // Sort options: by created_at, by video count
  // Returns paginated results
}
```

**NIP-50 search support:** The relay supports `search` in filters (documented in CLAUDE.md). Lists can be searched by:
- `{ kinds: [30005], search: "comedy", limit: 50 }` - Full-text search on list content/tags
- `{ kinds: [30005], limit: 100 }` - Browse all, sorted client-side

#### Search UI in ListsPage
Add a search input above the tabs:
```
+-------------------------------------+
| [Search icon] Search lists...       |
+-------------------------------------+
| [My Lists] [Trending] [Discover]    |
```

When search has a value, show search results instead of tabs. When cleared, return to tab view.

#### Files to Modify
| File | Change |
|------|--------|
| `src/hooks/useVideoLists.ts` | Add `useBrowseVideoLists` hook with search + sort |
| `src/pages/ListsPage.tsx` | Add search input, wire to browse hook, add "Browse All" section |

---

### Phase 3: Featured / Staff Picks

**Goal:** Highlight curated "editor's choice" lists.

#### Approach: Use a Known Curator Pubkey
Following the mobile app's pattern with `CurationService` and `editorsPicks`, define a set of known curator pubkeys in config. The Funnelcake relay or a designated account publishes "featured lists" as a kind 30005 event with a well-known d-tag (e.g., `d: "divine-featured-lists"`).

**Option A (Simpler):** Hardcode a list of featured list coordinates in config
```typescript
// src/config/featuredLists.ts
export const FEATURED_LIST_COORDINATES = [
  { pubkey: '...', dTag: 'best-of-vine-comedy' },
  { pubkey: '...', dTag: 'classic-vine-moments' },
  // ... curated by the divine team
];
```

**Option B (More Flexible):** Query a "meta-list" - a kind 30005 event from the divine team account that contains `a` tags pointing to other lists (a list of lists).

Recommendation: Start with **Option A** for speed, migrate to **Option B** when the team wants dynamic curation.

#### New Hook: `useFeaturedLists`
**File:** `src/hooks/useFeaturedLists.ts`

```typescript
export function useFeaturedLists() {
  // Fetch the featured list coordinates from config
  // Query those specific lists from relay
  // Return parsed VideoList[]
}
```

#### UI: Featured Section at Top of ListsPage
Show a horizontal scrollable row of `ListPreviewCard` components above the tabs:

```
+-------------------------------------+
| Featured Lists          [See all >] |
| [Card1] [Card2] [Card3] [Card4] >> |
+-------------------------------------+
| [My Lists] [Trending] [Discover]    |
```

#### Files to Create
| File | Purpose |
|------|---------|
| `src/config/featuredLists.ts` | Hardcoded featured list coordinates |
| `src/hooks/useFeaturedLists.ts` | Fetch featured lists |

#### Files to Modify
| File | Change |
|------|--------|
| `src/pages/ListsPage.tsx` | Add featured section above tabs |

---

### Phase 4: List Subscription (Follow Lists)

**Goal:** Allow users to subscribe to lists from other creators, mirroring the mobile app's subscribe functionality.

#### Data Model
Subscriptions stored as a local React state (localStorage-backed), similar to mobile's `SharedPreferences` approach:

```typescript
interface ListSubscription {
  listId: string;           // d-tag of the list
  pubkey: string;           // list creator's pubkey
  subscribedAt: number;     // timestamp
}
```

#### New Hook: `useListSubscriptions`
**File:** `src/hooks/useListSubscriptions.ts`

```typescript
export function useListSubscriptions() {
  // Read/write subscriptions from localStorage
  // Returns: { subscriptions, subscribe, unsubscribe, isSubscribed }
}

export function useSubscribedLists() {
  // Fetch full list data for all subscribed lists
  // Returns: VideoList[]
}
```

#### UI Changes
- **Subscribe button** on `ListPreviewCard` and `ListDetailPage` (for lists not owned by current user)
- **"Subscribed" tab** in `ListsPage` (between My Lists and Trending)
- Subscribe button toggles between "Subscribe" (green) and "Subscribed" (checkmark, outline)

#### Files to Create
| File | Purpose |
|------|---------|
| `src/hooks/useListSubscriptions.ts` | LocalStorage-backed subscription management |

#### Files to Modify
| File | Change |
|------|--------|
| `src/components/ListPreviewCard.tsx` | Add subscribe button |
| `src/pages/ListDetailPage.tsx` | Add subscribe button for non-owners |
| `src/pages/ListsPage.tsx` | Add "Subscribed" tab |

---

### Phase 5: Funnelcake REST API Integration (Future)

**Goal:** Add REST API endpoints for list discovery, reducing relay load.

This phase depends on Funnelcake backend work and is documented here for planning purposes.

#### Desired Endpoints
```
GET  /api/lists                     - Browse lists (sort: trending|recent|popular)
GET  /api/lists/{pubkey}/{d-tag}    - Single list with stats
GET  /api/lists/featured            - Staff-picked featured lists
GET  /api/lists/search?q=           - Full-text list search
POST /api/lists/bulk                - Bulk list metadata
GET  /api/users/{pubkey}/lists      - User's lists
```

#### Integration Pattern
Follow the existing circuit breaker pattern:
```typescript
// Try REST first, fall back to WebSocket
if (isFunnelcakeAvailable(apiUrl)) {
  const result = await fetchListsFromRest(apiUrl, params, signal);
  if (result) return result;
}
return fetchListsFromWebSocket(nostr, params, signal);
```

---

## 3. File Summary

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `src/components/ListPreviewCard.tsx` | 1 | Rich list card with thumbnail grid |
| `src/hooks/useListThumbnails.ts` | 1 | Fetch thumbnail URLs for list preview |
| `src/config/featuredLists.ts` | 3 | Featured list coordinates |
| `src/hooks/useFeaturedLists.ts` | 3 | Fetch featured lists |
| `src/hooks/useListSubscriptions.ts` | 4 | LocalStorage subscription management |

### Modified Files
| File | Phase | Change |
|------|-------|--------|
| `src/hooks/useVideoLists.ts` | 2 | Add `useBrowseVideoLists` with search + sort |
| `src/pages/ListsPage.tsx` | 1-4 | ListPreviewCard, search, featured section, subscribed tab |
| `src/pages/ListDetailPage.tsx` | 4 | Subscribe button for non-owners |
| `src/AppRouter.tsx` | - | No changes needed (routes already exist) |

---

## 4. Implementation Steps (Ordered)

### Step 1: ListPreviewCard with Thumbnail Grid
1. Create `src/hooks/useListThumbnails.ts` - fetch first 4 video thumbnails from a list's coordinates
2. Create `src/components/ListPreviewCard.tsx` - card with 2x2 thumbnail mosaic, title, author, video count, tags
3. Update `src/pages/ListsPage.tsx` - replace inline `ListCard` with `ListPreviewCard`
4. Test: verify thumbnail loading, fallback to placeholder when videos aren't found

### Step 2: Search and Browse
1. Add `useBrowseVideoLists` hook to `src/hooks/useVideoLists.ts` with NIP-50 search support
2. Add search input to `ListsPage.tsx` above the tabs
3. When search is active, show filtered results; when cleared, show tab view
4. Add sort options (recent, popular, most videos)
5. Test: search for list by name/tag, verify results update

### Step 3: Featured Lists
1. Create `src/config/featuredLists.ts` with initial featured list coordinates
2. Create `src/hooks/useFeaturedLists.ts` to fetch those specific lists
3. Add featured section to top of `ListsPage.tsx` as horizontal scroll row
4. Test: verify featured lists load and link to detail pages

### Step 4: List Subscriptions
1. Create `src/hooks/useListSubscriptions.ts` with localStorage persistence
2. Add subscribe/unsubscribe button to `ListPreviewCard.tsx`
3. Add subscribe button to `ListDetailPage.tsx` for non-owner viewing
4. Add "Subscribed" tab to `ListsPage.tsx`
5. Create `useSubscribedLists` to fetch full data for subscribed lists
6. Test: subscribe, verify persistence across page reload, unsubscribe

### Step 5: Polish and Integration
1. Add loading skeletons for `ListPreviewCard` thumbnail grid
2. Add empty state illustrations for each tab
3. Ensure responsive layout (1 col mobile, 2 col tablet, 3 col desktop)
4. Add error boundaries for failed list loads
5. Performance: ensure thumbnail queries are batched and cached

---

## 5. Design Decisions

### Why Not a Separate DiscoverListsPage?
The mobile app has a separate `DiscoverListsScreen` navigated to from the explore tab. On web, the existing `ListsPage.tsx` already has a tab structure with "My Lists", "Trending", and "Discover". Enhancing this existing page with richer cards, search, and featured sections is simpler than creating a new page and avoids fragmenting the lists experience.

### Why localStorage for Subscriptions (Not Nostr)?
The mobile app stores subscriptions in `SharedPreferences` (local only). A proper Nostr-based approach would publish a kind 30001 (bookmark list) or kind 10003 referencing subscribed lists. However:
- There's no established NIP for "list subscriptions"
- localStorage is simpler and sufficient for MVP
- Can migrate to Nostr-backed subscriptions later

### Why Not Funnelcake First?
The Funnelcake REST API doesn't currently have list-specific endpoints. Building on WebSocket/Nostr relay queries first ensures the feature works without backend changes. REST optimization can be layered in later following the existing circuit breaker pattern.

### Thumbnail Grid vs Cover Image
Lists already support a cover `image` tag. The thumbnail grid (2x2 mosaic of video thumbnails) provides a richer preview when no cover image is set. Priority: cover image > thumbnail grid > generic placeholder.

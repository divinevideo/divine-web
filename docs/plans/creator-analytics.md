# Creator Analytics Dashboard - Implementation Plan

## Overview

A creator-facing analytics dashboard that shows video performance metrics, audience insights, and engagement trends. Auth-gated to the logged-in user's own data. Mirrors the mobile app's `CreatorAnalyticsScreen` feature set, adapted for web with richer visualizations.

## Mobile App Reference

The mobile app (Flutter/Dart) already ships a creator analytics screen at:
- `mobile/lib/screens/creator_analytics_screen.dart` - UI with KPI grid, engagement breakdown, top videos, daily trend chart
- `mobile/lib/features/creator_analytics/creator_analytics_repository.dart` - Data layer with multi-source hydration
- `mobile/lib/providers/creator_analytics_providers.dart` - Riverpod providers
- `mobile/lib/services/analytics_api_service.dart` - Funnelcake REST client

### Metrics shown in mobile
- **KPI cards**: Videos count, Views, Interactions, Engagement Rate, Followers, Avg/Post
- **Engagement breakdown**: Likes/Comments/Reposts with proportional bars
- **Performance highlights**: Most viewed, most discussed, most reposted
- **Top content**: Ranked video list with engagement rate
- **Daily trend**: Bar chart of daily interactions over last 7-14 days
- **Audience snapshot**: Follower/following counts
- **Post analytics drill-down**: Per-video detail screen with metric pills and breakdown

### Time windows in mobile
- 7 Days, 28 Days, 90 Days, All Time

---

## Data Sources

### Already available in web codebase

| Data | Source | Endpoint / Function | Notes |
|------|--------|-------------------|-------|
| User profile + social counts | Funnelcake | `GET /api/users/{pubkey}` / `fetchUserProfile()` | follower_count, following_count, video_count, total_reactions |
| User videos list | Funnelcake | `GET /api/users/{pubkey}/videos` / `fetchUserVideos()` | Per-video reactions, comments, reposts |
| Bulk video stats | Funnelcake | `POST /api/videos/stats/bulk` / `fetchBulkVideoStats()` | reactions, comments, reposts, loops, engagement_score, trending_score |
| Single video stats | Funnelcake | `GET /api/videos/{id}/stats` / `fetchVideoStats()` | Same fields as bulk |
| Leaderboard (loop stats) | Funnelcake | `GET /api/leaderboard/creators` / `fetchUserLoopStats()` | views, unique_viewers, loops, videos_with_views |
| User engagement aggregates | Funnelcake type | `FunnelcakeUserResponse.engagement` | avg_reactions_per_video, avg_comments_per_video, engagement_rate |

### Existing hooks to reuse
- `useProfileStats` (`src/hooks/useProfileStats.ts`) - Already fetches profile + loop stats with REST/WS fallback
- `useBulkVideoStats` (`src/hooks/useBulkVideoStats.ts`) - Bulk stats fetching with cache population

### New endpoints needed (none required for MVP)
The existing Funnelcake API already provides all necessary data. The mobile app's repository fetches author videos, then enriches with bulk stats and individual view counts -- same pattern works for web.

### Potential future Funnelcake endpoints
- `GET /api/users/{pubkey}/analytics` - Dedicated creator analytics aggregate (time-series data)
- `GET /api/videos/{id}/views` - Per-video view counts (mobile already uses this)
- Audience demographics, geo, retention curves (noted as placeholders in mobile)

---

## Page Layout

### Route & Navigation
- **URL**: `/analytics` (auth-gated, only accessible when logged in)
- **Nav entry**: Add "Analytics" link in sidebar (`AppSidebar.tsx`) and bottom nav (`BottomNav.tsx`) for logged-in users, using `BarChart3` icon from lucide-react
- **Mobile nav**: Show in bottom nav only for logged-in users, positioned after Home

### Page Structure

```
CreatorAnalyticsPage
  |
  +-- Time Period Selector (7D | 28D | 90D | All)
  |
  +-- KPI Summary Cards (2x3 grid)
  |     Videos | Views | Interactions | Engagement Rate | Followers | Avg/Post
  |
  +-- Engagement Breakdown Card
  |     Likes / Comments / Reposts proportional bars with percentages
  |
  +-- Performance Highlights Card
  |     Most viewed | Most discussed | Most reposted (clickable -> video)
  |
  +-- Top Content Table (top 10 videos)
  |     Rank | Title | Views | Interactions | Engagement Rate
  |     Sortable columns, click row to navigate to video
  |
  +-- Daily Interactions Chart
  |     Bar chart showing interaction volume by day
  |
  +-- Audience Snapshot Card
  |     Followers | Following | Placeholder for future geo/source data
  |
  +-- Footer
        "Updated {time} ago" + data source info
```

### Responsive Layout
- **Desktop (>= 768px)**: 2-column grid for KPI cards, full-width table and chart
- **Mobile (< 768px)**: Single column, scrollable cards, simplified table

---

## Time Period Filtering

| Label | Key | Duration | Filter logic |
|-------|-----|----------|-------------|
| 7D | `last7d` | 7 days | `video.created_at >= now - 7d` |
| 28D | `last28d` | 28 days | `video.created_at >= now - 28d` |
| 90D | `last90d` | 90 days | `video.created_at >= now - 90d` |
| All | `alltime` | no filter | All videos |

Time filtering is applied **client-side** after fetching all user videos (matching mobile approach). The leaderboard endpoint supports `period` param for loop stats but user videos are fetched once and filtered locally per window.

---

## Chart / Visualization Library

**Recommendation: Recharts**

Reasons:
- Already part of the shadcn/ui ecosystem (shadcn provides a `Chart` component wrapper via `src/components/ui/chart.tsx`)
- React-native, declarative API
- Lightweight (~45KB gzipped)
- Good bar chart and line chart support
- TailwindCSS-friendly theming

The existing `chart.tsx` component in the codebase uses Recharts under the hood, so no new dependency is needed -- just the Recharts package which shadcn charts already require.

**Check**: Verify if `recharts` is already in `package.json`. If not, install it:
```bash
npm install recharts
```

---

## Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `src/pages/CreatorAnalyticsPage.tsx` | Main page component with layout, time filter, sections |
| `src/hooks/useCreatorAnalytics.ts` | Data-fetching hook: fetches user videos + bulk stats + profile, computes summary |
| `src/lib/creatorAnalyticsTransform.ts` | Pure transform functions: compute KPIs, sort videos, build daily data points |
| `src/types/creatorAnalytics.ts` | TypeScript interfaces for analytics data models |

### Modified Files

| File | Change |
|------|--------|
| `src/AppRouter.tsx` | Add `/analytics` route inside the `isLoggedIn` protected block |
| `src/components/AppSidebar.tsx` | Add "Analytics" nav item with `BarChart3` icon for logged-in users |
| `src/components/BottomNav.tsx` | Add analytics link for logged-in users on mobile |

---

## TypeScript Types

```typescript
// src/types/creatorAnalytics.ts

export type AnalyticsWindow = 'last7d' | 'last28d' | 'last90d' | 'alltime';

export interface VideoPerformance {
  eventId: string;
  dTag: string;
  title: string;
  createdAt: number;
  views: number | null;
  likes: number;
  comments: number;
  reposts: number;
  interactions: number;       // likes + comments + reposts
  engagementRate: number | null; // interactions / views (null if no views)
  loops: number | null;
}

export interface CreatorAnalyticsSummary {
  videoCount: number;
  totalViews: number;
  hasViewData: boolean;
  totalLikes: number;
  totalComments: number;
  totalReposts: number;
  totalInteractions: number;
  engagementRate: number | null;
  averageInteractionsPerVideo: number;
  topVideos: VideoPerformance[];      // sorted by interactions desc
  mostViewed: VideoPerformance | null;
  mostDiscussed: VideoPerformance | null;
  mostReposted: VideoPerformance | null;
  dailyInteractions: DailyInteractionPoint[];
}

export interface DailyInteractionPoint {
  date: string;       // YYYY-MM-DD
  dayLabel: string;   // "Mon 2/24"
  interactions: number;
}

export interface CreatorAnalyticsData {
  summary: CreatorAnalyticsSummary;
  followerCount: number;
  followingCount: number;
  fetchedAt: Date;
}
```

---

## Hook Design

### `useCreatorAnalytics(pubkey: string, window: AnalyticsWindow)`

```typescript
// src/hooks/useCreatorAnalytics.ts

export function useCreatorAnalytics(pubkey: string, window: AnalyticsWindow) {
  const apiUrl = API_CONFIG.funnelcake.baseUrl;

  return useQuery({
    queryKey: ['creator-analytics', pubkey, window],
    queryFn: async ({ signal }) => {
      // 1. Fetch user videos (all, paginated) + profile in parallel
      const [videosResponse, profile, loopStats] = await Promise.all([
        fetchAllUserVideos(apiUrl, pubkey, signal),   // paginate to get all
        fetchUserProfile(apiUrl, pubkey, signal),
        fetchUserLoopStats(apiUrl, pubkey, signal),
      ]);

      // 2. Enrich videos with bulk stats
      const videoIds = videosResponse.map(v => v.id || '').filter(Boolean);
      const bulkStats = videoIds.length > 0
        ? await fetchBulkVideoStats(apiUrl, videoIds, signal)
        : { stats: [], missing: [] };

      // 3. Merge stats into videos
      const enrichedVideos = mergeVideoStats(videosResponse, bulkStats);

      // 4. Compute summary with time window filter
      const summary = computeAnalyticsSummary(enrichedVideos, window);

      return {
        summary,
        followerCount: profile?.follower_count ?? 0,
        followingCount: profile?.following_count ?? 0,
        fetchedAt: new Date(),
      };
    },
    enabled: !!pubkey,
    staleTime: 60_000,    // 1 min
    gcTime: 300_000,      // 5 min
  });
}
```

Helper to paginate all user videos:
```typescript
async function fetchAllUserVideos(
  apiUrl: string,
  pubkey: string,
  signal: AbortSignal,
  maxPages = 4,
  pageSize = 100,
): Promise<FunnelcakeVideoRaw[]> {
  const allVideos: FunnelcakeVideoRaw[] = [];
  let offset = 0;

  for (let page = 0; page < maxPages; page++) {
    const response = await fetchUserVideos(apiUrl, pubkey, {
      limit: pageSize,
      offset,
      signal,
    });
    allVideos.push(...response.videos);
    if (!response.has_more) break;
    offset += pageSize;
  }

  // Deduplicate by pubkey:kind:d_tag
  const seen = new Set<string>();
  return allVideos.filter(v => {
    const key = `${v.pubkey}:${v.kind}:${v.d_tag}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

## Transform Functions

```typescript
// src/lib/creatorAnalyticsTransform.ts

export function computeAnalyticsSummary(
  videos: EnrichedVideo[],
  window: AnalyticsWindow,
): CreatorAnalyticsSummary {
  // 1. Filter by time window
  const cutoff = getWindowCutoff(window);
  const filtered = cutoff
    ? videos.filter(v => v.created_at >= cutoff)
    : videos;

  // 2. Map to VideoPerformance
  const performances = filtered.map(toVideoPerformance).sort(byInteractionsDesc);

  // 3. Aggregate KPIs
  // 4. Find highlights (most viewed, discussed, reposted)
  // 5. Build daily interaction points
  // All pure functions, no side effects
}

function getWindowCutoff(window: AnalyticsWindow): number | null {
  const now = Math.floor(Date.now() / 1000);
  switch (window) {
    case 'last7d': return now - 7 * 86400;
    case 'last28d': return now - 28 * 86400;
    case 'last90d': return now - 90 * 86400;
    case 'alltime': return null;
  }
}
```

---

## Component Structure

### `CreatorAnalyticsPage.tsx` (main page)
- Uses `useCurrentUser()` to get logged-in pubkey
- Uses `useCreatorAnalytics(pubkey, window)` for data
- Renders time selector + section cards
- Shows redirect/login prompt if not authenticated

### Sub-components (all inline in page file for MVP)
- `KpiGrid` - 2x3 grid of stat cards using shadcn `Card`
- `EngagementBreakdown` - Progress bars for likes/comments/reposts proportions
- `PerformanceHighlights` - Three highlight rows (most viewed/discussed/reposted)
- `TopContentTable` - Using shadcn `Table` with sortable columns
- `DailyInteractionsChart` - Recharts `BarChart` via shadcn `Chart` wrapper
- `AudienceSnapshot` - Simple follower/following display

---

## Implementation Steps

### Phase 1: Data Layer (1 session)
1. Create `src/types/creatorAnalytics.ts` with all interfaces
2. Create `src/lib/creatorAnalyticsTransform.ts` with pure transform functions
   - `toVideoPerformance()`, `computeAnalyticsSummary()`, `buildDailyInteractions()`
   - Write unit tests for transforms
3. Create `src/hooks/useCreatorAnalytics.ts`
   - Paginated video fetch + bulk stats enrichment
   - Time window filtering

### Phase 2: Page & Routing (1 session)
4. Create `src/pages/CreatorAnalyticsPage.tsx` with full layout
   - Time period selector (chip-style buttons like mobile)
   - KPI summary cards (6 metrics in 2x3 grid)
   - Engagement breakdown with progress bars
   - Performance highlights section
   - Top content table
   - Daily interactions bar chart (Recharts)
   - Audience snapshot
5. Add route in `src/AppRouter.tsx` inside `isLoggedIn` block
6. Add nav entries in `src/components/AppSidebar.tsx` and `src/components/BottomNav.tsx`

### Phase 3: Polish (1 session)
7. Loading skeletons for each section
8. Error state with retry button
9. Empty state for new creators with no videos
10. Verify Recharts is installed (or install it)
11. Responsive layout testing (mobile/tablet/desktop)
12. Link video titles to `/video/{id}` pages

### Phase 4: Testing
13. Unit tests for transform functions
14. Hook tests with mocked Funnelcake responses
15. Basic component render tests

---

## Existing Patterns to Follow

- **Data fetching**: Same REST-first + WS-fallback pattern used in `useProfileStats.ts`
- **Circuit breaker**: Use `isFunnelcakeAvailable()` check before API calls
- **Caching**: TanStack Query with `staleTime: 60000`, `gcTime: 300000` (matching existing hooks)
- **Error handling**: Wrap in try/catch, fall back gracefully, use `debugLog`/`debugError`
- **UI components**: Use shadcn/ui Card, Table, Tabs, Progress, Skeleton
- **Routing**: Protected route inside `isLoggedIn` check in AppRouter
- **Formatting**: Use compact number formatting (1.2K, 3.5M) matching leaderboard page

---

## Open Questions / Future Work

1. **View counts**: The mobile app tries `GET /api/videos/{id}/views` per-video as a fallback. The web bulk stats endpoint may or may not include views. If views are mostly null, show "N/A" (matching mobile behavior).
2. **Retention/watch-time**: Mobile has placeholder sections for retention curves. Skip for web MVP, add when Funnelcake provides the data.
3. **Audience geo/source**: Mobile shows placeholder. Skip for web MVP.
4. **Export**: Could add CSV export of video performance data in a future iteration.
5. **Comparison periods**: "vs last period" delta indicators could be added once we cache historical snapshots.
6. **Real-time updates**: Currently snapshot-based. Could add polling or WebSocket subscriptions for live stat updates.

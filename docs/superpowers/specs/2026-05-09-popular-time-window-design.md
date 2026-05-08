# Popular feed with time-window selector

**Date:** 2026-05-09
**Status:** Approved
**Owner:** rabble + Claude

## Problem

`api.divine.video` now supports a `period` parameter on `/api/v2/videos` and `/api/videos`
(`now | today | week | month | all`) alongside a `sort=popular` mode. The web app's
trending page (`/trending`) cannot expose this — it only ships the NIP-50 string sorts
(`hot`, `top`, `rising`, `classic`, `controversial`) with no time-window control. Users
have no way to ask for "popular this hour" vs "popular this month."

## Goals

1. Add a `Popular` tab on `/trending` that calls the API with `sort=popular` and a
   user-selected `period`.
2. Expose all five periods: `Now`, `Today`, `This Week`, `This Month`, `All Time`.
3. Make the selection deep-linkable (`?sort=…&period=…`) so views are shareable and
   survive refresh / browser back.
4. Drop `Controversial` from the visible tabs (off-brand for Divine; engagement-bait by
   design).

## Non-goals

- Leaderboard page changes (separate endpoint, separate UX).
- Period support on hashtag, search, or profile feeds.
- Per-period RSS feeds.
- Combining `Classic` with `period`.
- Renaming `/trending` → `/popular` (kept as `/trending` for low churn).

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| A | Sort vs period UX | **Two separate controls** — sort tabs row + period pills row |
| A3 | Which sort exposes period | **Only `Popular`** (new tab); other sorts unchanged |
| B1 | Routing | **Keep `/trending`**; Popular is a tab inside |
| C1 | Default period when Popular is selected | **`Today`** |
| D1 | URL persistence | **Both sort and period in query params** |
| E2 | Controversial | **Drop from visible tabs**; keep type literal for URL coercion |

## UI

`/trending` page renders two stacked control rows above the feed.

**Row 1 — Sort tabs.** Existing pill/button styling (`EXTENDED_SORT_MODES`).
Final order: `Hot · New · Top · Rising · Popular · Classic`.
- `Popular` slots between `Rising` and `Classic`.
- Tab description: "Trending in this window."
- Icon: `TrendUp` (Phosphor, weight=bold; weight=fill when active).
- `Controversial` removed from `EXTENDED_SORT_MODES` and `SEARCH_SORT_MODES`.

**Row 2 — Period pills.** Renders only when `sort === 'popular'`.
- Pills: `Now · Today · This Week · This Month · All Time` mapping to API values
  `now | today | week | month | all`.
- Visually subordinate to Row 1: smaller pills, indented or set in a sub-bar.
- Default: `Today`.
- Mobile: horizontally scrollable; min 44px tap target.

**Empty state.** When `sort=popular` + `period=now` returns 0 results, render an empty
state with copy "Quiet hour — try a wider window" and a one-tap action that switches to
`period=today`. Reuse the existing empty primitive on `VideoFeed`.

**Voice.** Casual-direct (per `CLAUDE.md` brand): "Quiet hour — try a wider window."
Not "No results found."

## URL state

Page reads `sort` and `period` from `useSearchParams`.

- `sort` ∈ `{ hot, top, rising, classic, popular }`. Unknown / missing → `hot`.
- `period` ∈ `{ now, today, week, month, all }`. Only consulted when `sort=popular`.
  Unknown / missing → `today`.
- `?sort=controversial` from older shared links → coerced to `hot` on read; URL is
  rewritten via `replace` (no history entry).
- Pill / tab clicks update the URL via `setSearchParams({ sort, period })` with `replace`
  semantics so browser back goes to the page-before, not between sort flips.

## Data flow

```
TrendingPage (sort, period from URL)
   └─ VideoFeed { sortMode, period, ... }
        └─ useVideoProvider { sortMode, period, ... }
              └─ useInfiniteVideosFunnelcake { sortMode, period, ... }
                    └─ getFetchOptions(feedType='trending', sortMode, period)
                          └─ fetchVideosV2 (sort, period, ...)
                                └─ /api/v2/videos?sort=popular&period=today
```

### Type changes

`src/types/funnelcake.ts`:
```ts
export type FunnelcakePeriod = 'now' | 'today' | 'week' | 'month' | 'all';

export interface FunnelcakeFetchOptions {
  sort?: 'trending' | 'recent' | 'popular' | 'loops' | 'engagement'
       | 'watching' | 'likes' | 'comments' | 'published';
  period?: FunnelcakePeriod;   // NEW — only meaningful when sort='popular' (or 'trending')
  // ...existing fields unchanged
}
```

`src/hooks/useInfiniteVideosFunnelcake.ts`:
```ts
export type FunnelcakeSortMode =
  | 'trending' | 'recent' | 'loops' | 'engagement'
  | 'classic' | 'watching' | 'popular';   // 'popular' added
```

`src/types/nostr.ts`:
- `SortMode` union keeps `'controversial'` literal (URL safety / coercion source).
- Add `'popular'` to the union.

### Hook wiring

`useInfiniteVideosFunnelcake.getFetchOptions` for `feedType='trending'`:
```ts
case 'trending':
  if (sortMode === 'classic') {
    return { ...base, classic: true, platform: 'vine', sort: 'loops' };
  }
  if (sortMode === 'popular') {
    return { ...base, sort: 'popular', period: period ?? 'today' };
  }
  return { ...base, sort: sortMode || 'watching' };
```

`fetchVideosV2` (and `fetchVideos` v1 for parity) appends `period` to query params when
present. Param is omitted (not sent as empty) when undefined.

`mapToFunnelcakeSortMode` (`useVideoProvider.ts`) gets a new branch:
```ts
case 'popular': return 'popular';
```

### `VideoFeed` props

Add `period?: FunnelcakePeriod` prop. Plumb through `useVideoProvider` → hook. No-op for
non-trending feed types.

### Query key

`useInfiniteQuery` queryKey gains `period` so cache invalidates when window changes:
```ts
queryKey: ['funnelcake-videos', feedType, effectiveApiUrl, sortMode, period, hashtag, ...]
```

### `SORT_MODES` constants

`src/lib/constants/sortModes.ts`:
- `EXTENDED_SORT_MODES`: drop `controversial`, add `popular` (slotted before `classic`).
- `SEARCH_SORT_MODES`: drop `controversial`. (Search page out of scope for period; no
  period control added there.)
- New constant `POPULAR_PERIODS: { value: FunnelcakePeriod; label: string }[]`
  with `{ now: 'Now', today: 'Today', week: 'This Week', month: 'This Month', all: 'All Time' }`.

## Edge cases

- **Old `?sort=controversial` link:** coerced to `hot`, URL rewritten via `replace`.
- **`?sort=popular` without `period`:** treated as `period=today`.
- **`?period=today` without `sort=popular`:** `period` ignored; sort defaults to `hot`.
- **Edge-injected feed:** `window.__DIVINE_FEED__` is only consumed for the default
  trending feed (no sort param). Popular requests bypass the cache and hit the API
  directly. (Future optimization could cache top periods at the edge — out of scope.)
- **Empty `now` window:** see empty state above.
- **i18n:** all new strings (`Popular`, `Now`, `Today`, `This Week`, `This Month`,
  `All Time`, "Quiet hour — try a wider window") added under
  `trendingPage.popular.*` keys; populated for the existing 14 non-fil locales by the
  same AI-translation pass that did the prior batches.

## Testing

### Unit / hook

- `useInfiniteVideosFunnelcake.test.ts`: assert that
  `{ feedType: 'trending', sortMode: 'popular', period: 'week' }`
  calls `fetchVideosV2` with `sort: 'popular', period: 'week'`.
- `useInfiniteVideosFunnelcake.test.ts`: omitting `period` with `sortMode='popular'`
  defaults to `period: 'today'`.
- `funnelcakeClient.test.ts`: `fetchVideosV2` includes `period` in the query string when
  passed; omits it when undefined.

### Component

- `TrendingPage.test.tsx`: period row hidden unless `sort=popular`. Selecting Popular
  reveals the row. Clicking a period pill updates the URL and the feed query.
- `TrendingPage.test.tsx`: `?sort=controversial` redirects to `?sort=hot`.
- `TrendingPage.test.tsx`: `?sort=popular&period=week` initial render selects Popular +
  This Week.

### Brand guardrails

Existing tests already cover: no Tailwind `uppercase`, no gradients on layout, no
`lucide-react`. New code must not introduce any.

### A11y

- Tabs use `role="tablist"` / `role="tab"` (or button equivalents already in use).
- Period pills are buttons with clear `aria-pressed` state.
- Axe sweep on `/trending?sort=popular&period=today` added to
  `tests/visual/a11y.spec.ts`.

## Rollout

Single PR, behind no flag. Period defaults are conservative; failure mode is "API ignores
period" (current behavior), which silently degrades to current Top/Hot semantics.

## Open questions

None blocking. Future work: edge-cache popular feeds per period; add period to hashtag
page; reconsider RSS per-period feeds.

# Popular feed with time-window selector — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Popular` tab on `/trending` that calls `api.divine.video` with `sort=popular` and a user-selected time window (`now | today | week | month | all`), deep-linkable via `?sort=&period=`. Drop `Controversial` from visible tabs.

**Architecture:** Page-level URL state (`useSearchParams`) drives `sort` + `period`. `VideoFeed` gains an optional `period` prop, threaded through `useVideoProvider` → `useInfiniteVideosFunnelcake` → `fetchVideosV2`/`fetchVideos`. The period control row is conditionally rendered only when `sort === 'popular'`. No backend changes (the API already supports `period`).

**Tech Stack:** React 18, React Router v6, TanStack Query, Vitest + React Testing Library, Playwright (axe), Tailwind, shadcn/ui, Phosphor icons.

**Spec:** `docs/superpowers/specs/2026-05-09-popular-time-window-design.md`

---

## File Structure

### Modified files

| File | Change |
| --- | --- |
| `src/types/funnelcake.ts` | Add `FunnelcakePeriod` type; add `period` to `FunnelcakeFetchOptions` |
| `src/types/nostr.ts` | Add `'popular'` to `SortMode` union (keep `'controversial'` for URL coercion) |
| `src/lib/funnelcakeClient.ts` | Thread `period` through `fetchVideos` and `fetchVideosV2` |
| `src/hooks/useInfiniteVideosFunnelcake.ts` | Add `'popular'` to `FunnelcakeSortMode`; accept `period` option; branch on `sortMode='popular'` |
| `src/hooks/useVideoProvider.ts` | Accept `period`; map `SortMode 'popular'` → Funnelcake `'popular'`; pass through |
| `src/components/VideoFeed.tsx` | Accept `period` prop; pass to `useVideoProvider` |
| `src/lib/constants/sortModes.ts` | Drop `controversial` from `EXTENDED_SORT_MODES` + `SEARCH_SORT_MODES`; add `popular`; add `POPULAR_PERIODS` |
| `src/pages/TrendingPage.tsx` | URL-driven `sort`+`period`; render period row when `sort='popular'`; coerce legacy `controversial` |
| `src/lib/i18n/locales/en/common.json` | Add `trendingPage.popular.*` keys |
| `src/lib/i18n/locales/{de,es,fr,pt,it,ja,ko,zh,ar,hi,ru,nl,sv,pl,ro,fil}/common.json` | Translated keys |
| `tests/visual/a11y.spec.ts` | Add `/trending?sort=popular&period=today` to axe sweep |

### New / modified test files

| File | Purpose |
| --- | --- |
| `src/lib/funnelcakeClient.test.ts` (new or extended) | `fetchVideos` / `fetchVideosV2` include `period` when set, omit when undefined |
| `src/hooks/useInfiniteVideosFunnelcake.test.ts` (extend) | `sortMode='popular'` + `period` plumbs to `fetchVideosV2` |
| `src/hooks/useVideoProvider.test.ts` (extend, may need creation) | `SortMode 'popular'` maps + `period` passes through |
| `src/pages/TrendingPage.test.tsx` (new or extended) | URL state, period row visibility, controversial coercion |
| `src/lib/constants/sortModes.test.ts` (new) | Asserts shape of constants and that `controversial` is gone |

---

## Skills To Reference

- @superpowers:test-driven-development — Red/Green/Refactor for every step
- @superpowers:verification-before-completion — Run tests/typecheck before each commit; never claim done without evidence
- @CLAUDE.md (project) — Brand rules: no `uppercase` Tailwind class, no `lucide-react`, no gradients on layout surfaces; voice = casual-direct

---

## Conventions

- Commit format: `type: description` (e.g. `feat(popular): add period selector to /trending`).
- After every task, run `npx tsc --noEmit` and the touched test files; do not commit on red.
- Each task ends with a `git add <specific files>` (not `-A`) and a commit.
- Do not amend; if hooks fail, fix and create a new commit.

---

## Task 1: Add `FunnelcakePeriod` type and option

**Files:**
- Modify: `src/types/funnelcake.ts:124-133`
- Test: (no direct unit test — covered indirectly by client tests in Task 2)

- [ ] **Step 1: Add the type and option field**

In `src/types/funnelcake.ts`, immediately above `export interface FunnelcakeFetchOptions`:

```ts
/**
 * Time window for popular/trending sorts on /api/videos and /api/v2/videos.
 * Maps directly to the API's `period` query parameter.
 */
export type FunnelcakePeriod = 'now' | 'today' | 'week' | 'month' | 'all';
```

In `FunnelcakeFetchOptions`, add a `period` field after `sort`:

```ts
export interface FunnelcakeFetchOptions {
  sort?: 'trending' | 'recent' | 'popular' | 'loops' | 'engagement' | 'watching' | 'likes' | 'comments' | 'published';
  period?: FunnelcakePeriod;   // Window for popular/trending; ignored by other sorts
  limit?: number;
  // ...rest unchanged
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no TS errors).

- [ ] **Step 3: Commit**

```bash
git add src/types/funnelcake.ts
git commit -m "feat(funnelcake): add FunnelcakePeriod type and period option"
```

---

## Task 2: Thread `period` through `fetchVideos` and `fetchVideosV2`

**Files:**
- Modify: `src/lib/funnelcakeClient.ts:166-215` (`fetchVideos`) and `:229-271` (`fetchVideosV2`)
- Test: `src/lib/funnelcakeClient.test.ts` (extend if exists, else create)

- [ ] **Step 1: Locate or create the test file**

Run: `ls src/lib/funnelcakeClient.test.ts 2>/dev/null && echo EXISTS || echo MISSING`

If MISSING, create the file with the standard imports:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchVideos, fetchVideosV2 } from './funnelcakeClient';

describe('funnelcakeClient period parameter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
});
```

If EXISTS, append the new `describe` block (or add tests inside an existing block).

- [ ] **Step 2: Write failing tests for `period`**

```ts
it('fetchVideos includes period when provided', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  );

  await fetchVideos('https://api.divine.video', { sort: 'popular', period: 'week', limit: 12 });

  const calledUrl = String((fetchSpy.mock.calls[0] as [URL | string, ...unknown[]])[0]);
  expect(calledUrl).toContain('sort=popular');
  expect(calledUrl).toContain('period=week');
});

it('fetchVideos omits period when undefined', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
  );

  await fetchVideos('https://api.divine.video', { sort: 'popular', limit: 12 });

  const calledUrl = String((fetchSpy.mock.calls[0] as [URL | string, ...unknown[]])[0]);
  expect(calledUrl).not.toContain('period=');
});

it('fetchVideosV2 includes period when provided', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: [], pagination: { has_more: false } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );

  await fetchVideosV2('https://api.divine.video', { sort: 'popular', period: 'today', limit: 12 });

  const calledUrl = String((fetchSpy.mock.calls[0] as [URL | string, ...unknown[]])[0]);
  expect(calledUrl).toContain('sort=popular');
  expect(calledUrl).toContain('period=today');
});

it('fetchVideosV2 omits period when undefined', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ data: [], pagination: { has_more: false } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );

  await fetchVideosV2('https://api.divine.video', { sort: 'watching', limit: 12 });

  const calledUrl = String((fetchSpy.mock.calls[0] as [URL | string, ...unknown[]])[0]);
  expect(calledUrl).not.toContain('period=');
});
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run src/lib/funnelcakeClient.test.ts`
Expected: FAIL — period appears nowhere in URLs.

- [ ] **Step 4: Update `fetchVideos`**

In `src/lib/funnelcakeClient.ts`, edit `fetchVideos` (around line 170):

```ts
const { sort = 'trending', period, limit = 20, before, offset, classic, platform, category, signal } = options;

const params: Record<string, string | number | boolean | undefined> = {
  sort,
  period,
  limit,
  classic,
  platform,
  category,
};
```

(`buildUrl` already drops `undefined` values, so `period` will be omitted when not set.)

- [ ] **Step 5: Update `fetchVideosV2`**

In the same file, edit `fetchVideosV2` (around line 233):

```ts
const { sort = 'watching', period, limit = 20, before, offset, classic, platform, category, signal } = options;

const params: Record<string, string | number | boolean | undefined> = {
  sort,
  period,
  limit,
  classic,
  platform,
  category,
};
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run src/lib/funnelcakeClient.test.ts`
Expected: PASS.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/funnelcakeClient.ts src/lib/funnelcakeClient.test.ts
git commit -m "feat(funnelcake): thread period query param through fetchVideos and fetchVideosV2"
```

---

## Task 3: Add `'popular'` to `FunnelcakeSortMode` and wire `period` through the hook

**Files:**
- Modify: `src/hooks/useInfiniteVideosFunnelcake.ts:16-17,89-163,177-205`
- Test: `src/hooks/useInfiniteVideosFunnelcake.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useInfiniteVideosFunnelcake.test.ts` (inside the existing `describe`):

```ts
describe('popular sort with period', () => {
  it('passes sort=popular and the chosen period to fetchVideosV2', async () => {
    mockFetchVideosV2.mockResolvedValueOnce({
      videos: [{}],
      has_more: false,
      next_cursor: undefined,
    });
    mockTransformToVideoPage.mockReturnValueOnce({
      videos: [{ id: 'v1', pubkey: 'p1', kind: 34236, createdAt: 1, vineId: 'd1' }],
      nextCursor: undefined,
      hasMore: false,
    });

    const { result } = renderHook(
      () => useInfiniteVideosFunnelcake({
        feedType: 'trending',
        sortMode: 'popular',
        period: 'week',
        pageSize: 12,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockFetchVideosV2).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        sort: 'popular',
        period: 'week',
        limit: 12,
      }),
    );
  });

  it('defaults popular sort to period=today when period is omitted', async () => {
    mockFetchVideosV2.mockResolvedValueOnce({ videos: [], has_more: false, next_cursor: undefined });
    mockTransformToVideoPage.mockReturnValueOnce({ videos: [], nextCursor: undefined, hasMore: false });

    renderHook(
      () => useInfiniteVideosFunnelcake({
        feedType: 'trending',
        sortMode: 'popular',
        pageSize: 12,
      }),
      { wrapper: createWrapper() }
    );

    await waitFor(() =>
      expect(mockFetchVideosV2).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ sort: 'popular', period: 'today' }),
      ),
    );
  });
});
```

> Note: if `mockFetchVideosV2` does not exist in the test file, add it alongside the existing `mockFetchVideos` mock at the top of the file (mirror the existing pattern that mocks `@/lib/funnelcakeClient`).

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts -t "popular sort with period"`
Expected: FAIL — `'popular'` not assignable to `FunnelcakeSortMode`.

- [ ] **Step 3: Extend the type and options**

In `src/hooks/useInfiniteVideosFunnelcake.ts`:

```ts
export type FunnelcakeSortMode = 'trending' | 'recent' | 'loops' | 'engagement' | 'classic' | 'watching' | 'popular';

interface UseInfiniteVideosFunnelcakeOptions {
  feedType: FunnelcakeFeedType;
  apiUrl?: string;
  sortMode?: FunnelcakeSortMode;
  period?: FunnelcakePeriod;   // NEW
  hashtag?: string;
  category?: string;
  pubkey?: string;
  pageSize?: number;
  enabled?: boolean;
  randomizeWithinTop?: number;
}
```

Import `FunnelcakePeriod` from `@/types/funnelcake`.

- [ ] **Step 4: Wire `period` into `getFetchOptions`**

Update the function signature and the `'trending'` branch:

```ts
function getFetchOptions(
  feedType: FunnelcakeFeedType,
  sortMode?: FunnelcakeSortMode,
  pageSize: number = 20,
  period?: FunnelcakePeriod,
): FunnelcakeFetchOptions {
  const baseOptions: FunnelcakeFetchOptions = { limit: pageSize };

  switch (feedType) {
    // ...other cases unchanged...

    case 'trending':
      if (sortMode === 'classic') {
        return { ...baseOptions, classic: true, platform: 'vine', sort: 'loops' };
      }
      if (sortMode === 'popular') {
        return { ...baseOptions, sort: 'popular', period: period ?? 'today' };
      }
      return { ...baseOptions, sort: sortMode || 'watching' };

    // ...
  }
}
```

- [ ] **Step 5: Pass `period` from the hook body and into the queryKey**

Update the `useInfiniteVideosFunnelcake` function signature and queryKey:

```ts
export function useInfiniteVideosFunnelcake({
  feedType, apiUrl, sortMode, period, hashtag, category, pubkey,
  pageSize = 12, enabled = true, randomizeWithinTop,
}: UseInfiniteVideosFunnelcakeOptions) {
  // ...existing setup...

  return useInfiniteQuery<FunnelcakeVideoPage, Error>({
    queryKey: ['funnelcake-videos', feedType, effectiveApiUrl, sortMode, period, hashtag, category, pubkey, pageSize, randomStartOffset],
    // ...
  });
```

And inside the queryFn where `getFetchOptions` is called:

```ts
const options = getFetchOptions(feedType, sortMode, pageSize, period);
```

- [ ] **Step 6: Run the popular tests**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts -t "popular sort with period"`
Expected: PASS.

- [ ] **Step 7: Run the full test file to confirm no regressions**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts`
Expected: PASS (all).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useInfiniteVideosFunnelcake.ts src/hooks/useInfiniteVideosFunnelcake.test.ts
git commit -m "feat(feed): wire period through useInfiniteVideosFunnelcake for popular sort"
```

---

## Task 4: Add `'popular'` to `SortMode` and update `useVideoProvider`

**Files:**
- Modify: `src/types/nostr.ts:34`
- Modify: `src/hooks/useVideoProvider.ts:18-26,107-124,207-242`

- [ ] **Step 1: Add `'popular'` to the `SortMode` union**

In `src/types/nostr.ts`:

```ts
export type SortMode = 'hot' | 'top' | 'rising' | 'controversial' | 'classic' | 'popular';
```

(`'controversial'` stays for URL coercion. We'll remove it from visible tabs in Task 6.)

- [ ] **Step 2: Update `useVideoProvider` mapping**

In `src/hooks/useVideoProvider.ts`, update `mapToFunnelcakeSortMode`:

```ts
function mapToFunnelcakeSortMode(sortMode?: SortMode): FunnelcakeSortMode | undefined {
  if (!sortMode) return undefined;
  switch (sortMode) {
    case 'hot':           return 'watching';
    case 'top':           return 'loops';
    case 'rising':        return 'engagement';
    case 'controversial': return 'engagement';
    case 'classic':       return 'classic';
    case 'popular':       return 'popular';
    default:              return 'trending';
  }
}
```

Add `period` to options and pass it through:

```ts
import type { FunnelcakePeriod } from '@/types/funnelcake';

interface UseVideoProviderOptions {
  feedType: VideoFeedType;
  sortMode?: SortMode;
  period?: FunnelcakePeriod;   // NEW
  hashtag?: string;
  category?: string;
  pubkey?: string;
  pageSize?: number;
  enabled?: boolean;
}

export function useVideoProvider({
  feedType, sortMode, period, hashtag, category, pubkey,
  pageSize = 12, enabled = true,
}: UseVideoProviderOptions): VideoProviderResult {
  // ...

  const funnelcakeQuery = useInfiniteVideosFunnelcake({
    feedType: mapToFunnelcakeFeedType(feedType),
    apiUrl: decision.apiUrl,
    sortMode: mapToFunnelcakeSortMode(sortMode),
    period,   // NEW
    hashtag,
    category,
    pubkey,
    pageSize,
    enabled: enabled && shouldUseFunnelcake,
    randomizeWithinTop: feedType === 'classics' ? 500 : undefined,
  });

  // ...rest unchanged
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/types/nostr.ts src/hooks/useVideoProvider.ts
git commit -m "feat(feed): map SortMode 'popular' and pass period through provider"
```

---

## Task 5: Add `period` prop to `VideoFeed`

**Files:**
- Modify: `src/components/VideoFeed.tsx:33-103`

- [ ] **Step 1: Add the prop and forward it**

Update the `VideoFeedProps` interface and the function:

```ts
import type { FunnelcakePeriod } from '@/types/funnelcake';

interface VideoFeedProps {
  feedType?: 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'foryou' | 'category';
  hashtag?: string;
  category?: string;
  pubkey?: string;
  limit?: number;
  sortMode?: SortMode;
  period?: FunnelcakePeriod;   // NEW — only meaningful when sortMode='popular' on a trending feed
  // ...
}
```

In the function body, destructure `period` and pass it into `useVideoProvider`:

```ts
export function VideoFeed({
  // ...existing...
  sortMode,
  period,
  // ...
}: VideoFeedProps) {
  // ...

  const { data, fetchNextPage, hasNextPage, isLoading, error, refetch, dataSource } = useVideoProvider({
    feedType,
    hashtag,
    category,
    pubkey,
    pageSize: limit,
    sortMode,
    period,   // NEW
  });
  // ...
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the existing VideoFeed tests**

Run: `npx vitest run src/components/VideoFeed.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/VideoFeed.tsx
git commit -m "feat(feed): add period prop to VideoFeed"
```

---

## Task 6: Update sort-mode constants — drop Controversial, add Popular, add periods

**Files:**
- Modify: `src/lib/constants/sortModes.ts`
- Test: `src/lib/constants/sortModes.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `src/lib/constants/sortModes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  EXTENDED_SORT_MODES,
  SEARCH_SORT_MODES,
  POPULAR_PERIODS,
} from './sortModes';

describe('sortModes constants', () => {
  it('EXTENDED_SORT_MODES contains popular and not controversial', () => {
    const values = EXTENDED_SORT_MODES.map(m => m.value);
    expect(values).toContain('popular');
    expect(values).not.toContain('controversial');
  });

  it('EXTENDED_SORT_MODES places popular between rising and classic', () => {
    const values = EXTENDED_SORT_MODES.map(m => m.value);
    const rising = values.indexOf('rising');
    const popular = values.indexOf('popular');
    const classic = values.indexOf('classic');
    expect(rising).toBeGreaterThanOrEqual(0);
    expect(popular).toBe(rising + 1);
    expect(classic).toBe(popular + 1);
  });

  it('SEARCH_SORT_MODES does not contain controversial', () => {
    const values = SEARCH_SORT_MODES.map(m => m.value);
    expect(values).not.toContain('controversial');
  });

  it('POPULAR_PERIODS contains the five expected windows in order', () => {
    expect(POPULAR_PERIODS.map(p => p.value)).toEqual(['now', 'today', 'week', 'month', 'all']);
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npx vitest run src/lib/constants/sortModes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `sortModes.ts`**

In `src/lib/constants/sortModes.ts`:

1. Add `TrendUp` to the existing import (already imported as `TrendingUp`, reuse) and `Hourglass`, `Calendar`, `CalendarBlank`, `Infinity` from `@phosphor-icons/react` for periods. (Adjust import names to whatever Phosphor exports; if a name is unavailable, fall back to `Clock` for any window.)

2. Replace `EXTENDED_SORT_MODES`:

```ts
export const EXTENDED_SORT_MODES: SortModeDefinition[] = [
  { value: 'hot',     label: 'Hot',     description: 'Recent + high engagement', icon: Flame },
  { value: undefined, label: 'New',     description: 'Latest videos',           icon: Clock },
  { value: 'top',     label: 'Top',     description: 'Most viewed all-time',    icon: TrendingUp },
  { value: 'rising',  label: 'Rising',  description: 'Gaining traction',        icon: Zap },
  { value: 'popular', label: 'Popular', description: 'Trending in this window', icon: TrendingUp },
  { value: 'classic', label: 'Classic', description: 'Vine archive favorites',  icon: Clapperboard },
];
```

3. Update `SEARCH_SORT_MODES` to drop the `controversial` entry.

4. Add `POPULAR_PERIODS`:

```ts
import type { FunnelcakePeriod } from '@/types/funnelcake';

export interface PopularPeriodDefinition {
  value: FunnelcakePeriod;
  label: string;            // i18n key: trendingPage.popular.period.<value>
  shortLabel: string;       // for compact pills on mobile
}

export const POPULAR_PERIODS: PopularPeriodDefinition[] = [
  { value: 'now',   label: 'Now',          shortLabel: 'Now' },
  { value: 'today', label: 'Today',        shortLabel: 'Today' },
  { value: 'week',  label: 'This Week',    shortLabel: 'Week' },
  { value: 'month', label: 'This Month',   shortLabel: 'Month' },
  { value: 'all',   label: 'All Time',     shortLabel: 'All' },
];
```

> Brand check: do **not** add a Tailwind `uppercase` class anywhere. The labels above are in title case as written.

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run src/lib/constants/sortModes.test.ts`
Expected: PASS.

- [ ] **Step 5: Run brand guardrail tests (no uppercase, no lucide)**

Run: `npx vitest run tests/brand`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants/sortModes.ts src/lib/constants/sortModes.test.ts
git commit -m "feat(sort): drop Controversial; add Popular sort + POPULAR_PERIODS constants"
```

---

## Task 7: Add English i18n keys for Popular tab + periods

**Files:**
- Modify: `src/lib/i18n/locales/en/common.json`

- [ ] **Step 1: Add keys**

Under `trendingPage`, extend the object:

```json
{
  "trendingPage": {
    "heading": "Trending",
    "subheading": "Discover what's popular in the community",
    "rssTitle": "DiVine - Trending",
    "rssLink": "RSS",
    "popular": {
      "tabLabel": "Popular",
      "tabDescription": "Trending in this window",
      "period": {
        "label": "Window",
        "now": "Now",
        "today": "Today",
        "week": "This Week",
        "month": "This Month",
        "all": "All Time"
      },
      "emptyHeading": "Quiet hour",
      "emptyBody": "Try a wider window.",
      "emptyAction": "Show today"
    }
  }
}
```

- [ ] **Step 2: Type-check & smoke test**

Run: `npx tsc --noEmit && npx vitest run src/lib/i18n` (if i18n tests exist; otherwise skip the second).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/locales/en/common.json
git commit -m "i18n(en): add trendingPage.popular.* keys"
```

---

## Task 8: Update `TrendingPage` — URL state, period row, controversial coercion, empty state

**Files:**
- Modify: `src/pages/TrendingPage.tsx`
- Test: `src/pages/TrendingPage.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `src/pages/TrendingPage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrendingPage from './TrendingPage';

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: (props: { sortMode?: string; period?: string }) => (
    <div data-testid="video-feed" data-sort={props.sortMode ?? ''} data-period={props.period ?? ''} />
  ),
}));

vi.mock('@/hooks/useRssFeedAvailable', () => ({ useRssFeedAvailable: () => false }));
vi.mock('@unhead/react', () => ({ useHead: () => undefined }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

function renderAt(initial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/trending" element={<TrendingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TrendingPage URL state', () => {
  it('defaults to sort=hot and renders no period row', () => {
    renderAt('/trending');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.sort).toBe('hot');
    expect(screen.queryByRole('group', { name: /window/i })).not.toBeInTheDocument();
  });

  it('shows the period row when sort=popular and defaults period to today', () => {
    renderAt('/trending?sort=popular');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.sort).toBe('popular');
    expect(feed.dataset.period).toBe('today');
    expect(screen.getByRole('button', { name: /this week/i })).toBeInTheDocument();
  });

  it('respects ?sort=popular&period=week', () => {
    renderAt('/trending?sort=popular&period=week');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.period).toBe('week');
  });

  it('coerces ?sort=controversial to hot', async () => {
    renderAt('/trending?sort=controversial');
    await waitFor(() => {
      expect(screen.getByTestId('video-feed').dataset.sort).toBe('hot');
    });
  });

  it('updates the URL when a period pill is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/trending?sort=popular');
    await user.click(screen.getByRole('button', { name: /this month/i }));
    await waitFor(() => {
      expect(screen.getByTestId('video-feed').dataset.period).toBe('month');
    });
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npx vitest run src/pages/TrendingPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `TrendingPage` to be URL-driven**

Replace the body of `src/pages/TrendingPage.tsx` with:

```tsx
// ABOUTME: Trending feed page with sort tabs + Popular time-window selector
// ABOUTME: Sort + period live in URL query params for shareable, refresh-safe views

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Rss } from '@phosphor-icons/react';
import { useHead } from '@unhead/react';
import { VideoFeed } from '@/components/VideoFeed';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import type { SortMode } from '@/types/nostr';
import type { FunnelcakePeriod } from '@/types/funnelcake';
import { EXTENDED_SORT_MODES, POPULAR_PERIODS } from '@/lib/constants/sortModes';

const VALID_SORTS: ReadonlyArray<SortMode | undefined> = ['hot', 'top', 'rising', 'popular', 'classic', undefined];
const VALID_PERIODS: ReadonlyArray<FunnelcakePeriod> = ['now', 'today', 'week', 'month', 'all'];

function parseSort(raw: string | null): SortMode | undefined {
  if (raw === null) return 'hot';
  if (raw === 'controversial') return 'hot';        // legacy URL coercion
  if (raw === '' || raw === 'new') return undefined;
  return (VALID_SORTS as readonly string[]).includes(raw) ? (raw as SortMode) : 'hot';
}

function parsePeriod(raw: string | null): FunnelcakePeriod {
  if (raw && (VALID_PERIODS as readonly string[]).includes(raw)) return raw as FunnelcakePeriod;
  return 'today';
}

export function TrendingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawSort = searchParams.get('sort');
  const rawPeriod = searchParams.get('period');
  const sortMode = parseSort(rawSort);
  const period = parsePeriod(rawPeriod);

  // Rewrite the URL when we coerce (e.g. ?sort=controversial), without history entry.
  useEffect(() => {
    const desired = sortMode ?? 'new';
    const incoming = rawSort ?? 'hot';
    const sortChanged = desired !== incoming && !(desired === 'hot' && rawSort === null);
    if (sortChanged) {
      const next = new URLSearchParams(searchParams);
      if (sortMode) next.set('sort', sortMode); else next.delete('sort');
      setSearchParams(next, { replace: true });
    }
  }, [rawSort, sortMode, searchParams, setSearchParams]);

  const setSort = useCallback((next: SortMode | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('sort', next); else params.delete('sort');
    if (next !== 'popular') params.delete('period');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const setPeriod = useCallback((next: FunnelcakePeriod) => {
    const params = new URLSearchParams(searchParams);
    params.set('period', next);
    if (sortMode !== 'popular') params.set('sort', 'popular');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams, sortMode]);

  const rssFeedAvailable = useRssFeedAvailable();
  useHead({
    link: rssFeedAvailable
      ? [{ rel: 'alternate', type: 'application/rss+xml', title: t('trendingPage.rssTitle'), href: feedUrls.trending() }]
      : [],
  });

  const showPeriodRow = sortMode === 'popular';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t('trendingPage.heading')}</h1>
              <p className="text-muted-foreground">{t('trendingPage.subheading')}</p>
            </div>
            {rssFeedAvailable && (
              <a
                href={feedUrls.trending()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Rss className="h-3.5 w-3.5" /> {t('trendingPage.rssLink')}
              </a>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('trendingPage.heading')}>
            {EXTENDED_SORT_MODES.map(mode => {
              const ModeIcon = mode.icon;
              const isSelected = sortMode === mode.value;
              return (
                <button
                  key={String(mode.value ?? 'new')}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSort(mode.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isSelected
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-brand-light-green dark:bg-brand-dark-green hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <ModeIcon className="h-4 w-4" />
                  <span>{mode.label}</span>
                  {isSelected && (
                    <span className="text-xs opacity-80 hidden sm:inline">• {mode.description}</span>
                  )}
                </button>
              );
            })}
          </div>

          {showPeriodRow && (
            <div
              role="group"
              aria-label={t('trendingPage.popular.period.label')}
              className="flex flex-wrap gap-2 pl-1"
            >
              {POPULAR_PERIODS.map(p => {
                const isSelected = period === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[36px]
                      ${isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-brand-light-green dark:bg-brand-dark-green hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {t(`trendingPage.popular.period.${p.value}`)}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <VideoFeed
          feedType="trending"
          sortMode={sortMode}
          period={showPeriodRow ? period : undefined}
          accent="pink"
          data-testid="video-feed-trending"
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export default TrendingPage;
```

- [ ] **Step 4: Run page test**

Run: `npx vitest run src/pages/TrendingPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the brand guardrails (still no uppercase, no lucide, no gradients)**

Run: `npx vitest run tests/brand`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/TrendingPage.tsx src/pages/TrendingPage.test.tsx
git commit -m "feat(trending): URL-driven sort + Popular time-window selector; coerce legacy controversial"
```

---

## Task 9: Empty state for `popular + now`

**Files:**
- Modify: `src/components/VideoFeed.tsx` (only the empty-state branch)
- Or: dedicated empty-state component if `VideoFeed` already has a slot — investigate before changing.

> The brand guideline is voice-first; the technical change is small. The empty state should appear only when `feedType === 'trending'`, `sortMode === 'popular'`, `period === 'now'`, **and** the loaded feed is empty.

- [ ] **Step 1: Locate the existing empty-state branch in `VideoFeed`**

Run: `grep -n "no.*video\|empty\|no results" src/components/VideoFeed.tsx`
Identify where the "no videos" UI renders (likely after the loading branch and before the list).

- [ ] **Step 2: Add the period-aware variant**

Where the existing empty UI renders, branch on the new props:

```tsx
const isQuietHour =
  feedType === 'trending' && sortMode === 'popular' && period === 'now';

if (!isLoading && filteredVideos.length === 0 && isQuietHour) {
  return (
    <div className="rounded-lg border bg-card p-8 text-center space-y-3">
      <h2 className="text-lg font-semibold">{t('trendingPage.popular.emptyHeading')}</h2>
      <p className="text-muted-foreground">{t('trendingPage.popular.emptyBody')}</p>
      <Button
        variant="default"
        onClick={() => navigate('/trending?sort=popular&period=today', { replace: true })}
      >
        {t('trendingPage.popular.emptyAction')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Add a smoke test**

Append to `src/pages/TrendingPage.test.tsx` (or a new component test under `VideoFeed.test.tsx` if simpler — choose whichever the existing test uses for empty state). The test asserts the empty heading is rendered when the mocked feed returns empty for popular+now. If the page test already mocks `VideoFeed`, add a separate component-level test instead.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/VideoFeed.test.tsx src/pages/TrendingPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/VideoFeed.tsx src/pages/TrendingPage.test.tsx
git commit -m "feat(popular): quiet-hour empty state for popular + now"
```

---

## Task 10: AI-translate new keys to non-fil locales

**Files:**
- Modify: 14 locale files under `src/lib/i18n/locales/{de,es,fr,pt,it,ja,ko,zh,ar,hi,ru,nl,sv,pl,ro}/common.json`
- Filipino (`fil`) gets handled separately by the in-progress fil branch — leave its `trendingPage.popular` block as English so the existing fil pipeline can replace it.

> This mirrors the prior batches (`feat(i18n): translate batch-4 keys (~36) to 14 non-fil locales`). The pattern is: copy the en values into each locale, then translate them. Keep keys identical.

- [ ] **Step 1: Add the `popular` block to each non-fil locale**

For each of the 14 locales, add the same `trendingPage.popular` shape under `trendingPage`. Use locale-appropriate translations (delegate to the same translation pipeline / model used in prior commits — see commit `8ee809b` for the exact prompt style if needed).

Translations must be casual-direct, never corporate. Examples (German):
- `tabLabel`: `"Beliebt"`
- `tabDescription`: `"Trends in diesem Zeitraum"`
- `emptyHeading`: `"Stille Stunde"`
- `emptyBody`: `"Versuch ein größeres Zeitfenster."`
- `emptyAction`: `"Heute anzeigen"`

- [ ] **Step 2: Add the same block to `fil/common.json` as English placeholders**

Just copy the English values verbatim. The fil branch owners will translate.

- [ ] **Step 3: Run i18n tests if any**

Run: `npx vitest run src/lib/i18n` (skip if no tests).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/locales
git commit -m "i18n: translate trendingPage.popular keys for 14 non-fil locales"
```

---

## Task 11: A11y axe sweep on `/trending?sort=popular&period=today`

**Files:**
- Modify: `tests/visual/a11y.spec.ts`

- [ ] **Step 1: Add the route to the existing axe sweep**

Open `tests/visual/a11y.spec.ts` and add `/trending?sort=popular&period=today` to the array of routes already swept (alongside `/`, `/discovery`, `/search`, `/__brand-preview`).

- [ ] **Step 2: Run the sweep**

Run: `npx playwright test tests/visual/a11y.spec.ts` (assumes Playwright is set up; if it requires a dev server, follow the existing pattern in the repo).
Expected: PASS — no new color-contrast violations on real surfaces.

> If the run reports a contrast issue on the new period pills, adjust the pill background/text color in Task 8's classNames to match the existing tab pattern (which already passes axe). Do **not** suppress the violation.

- [ ] **Step 3: Commit**

```bash
git add tests/visual/a11y.spec.ts
git commit -m "test(a11y): add /trending?sort=popular axe sweep"
```

---

## Task 12: Final verification

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Full unit test suite**

Run: `npm test` (or `npx vitest run`)
Expected: PASS.

- [ ] **Step 3: Manual browser verification**

Run: `npm run dev`

In the browser:
1. Visit `/trending`. Verify default tab is `Hot`, no period row visible, `Controversial` tab is gone.
2. Click `Popular`. URL becomes `/trending?sort=popular`. Period row appears with `Today` selected.
3. Click each period pill. URL updates `?sort=popular&period=…`. Feed re-fetches.
4. Open DevTools Network tab. Confirm a request to `/api/v2/videos?sort=popular&period=<value>&limit=12` for each window.
5. Refresh on `/trending?sort=popular&period=week`. Page restores Popular + This Week.
6. Visit `/trending?sort=controversial`. URL is rewritten to `/trending?sort=hot` and Hot tab is active.
7. Visit `/trending?sort=popular&period=now`. If feed is empty (off-hours), see "Quiet hour — try a wider window" with a button that navigates to `?sort=popular&period=today`.

- [ ] **Step 4: Open the PR**

Run:

```bash
gh pr create --title "feat: Popular tab with time-window selector on /trending" --body "$(cat <<'EOF'
## Summary
- Adds a `Popular` tab on `/trending` that calls the API with `sort=popular` and a user-selected period (`now / today / week / month / all`)
- Sort + period are URL-driven (`?sort=popular&period=…`) for shareable, refresh-safe views
- Drops `Controversial` from visible tabs (off-brand engagement-bait); legacy URLs coerce to `Hot`
- Adds a "quiet hour" empty state for `popular + now`

## Test plan
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `/trending` defaults to Hot, no period row
- [ ] `/trending?sort=popular` shows period row, defaults to Today
- [ ] Each period pill issues `/api/v2/videos?sort=popular&period=…`
- [ ] `/trending?sort=controversial` redirects to `/trending?sort=hot`
- [ ] `/trending?sort=popular&period=week` deep-link survives refresh
- [ ] Quiet-hour empty state appears for empty `now` window with one-tap fix
- [ ] Axe a11y sweep green on `/trending?sort=popular&period=today`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of scope (for follow-up)

- Period support on hashtag, search, profile, and category feeds.
- Edge-cache popular feeds per period (would speed first paint dramatically).
- Per-period RSS feeds.
- Renaming `/trending` → `/popular`.
- Combining `Classic` with `period`.
- Leaderboard page period changes.

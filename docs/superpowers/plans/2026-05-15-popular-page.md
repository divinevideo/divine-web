# Popular Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/popular` page that defaults to New + Now and lets people switch source and period using Funnelcake v2 popular feeds.

**Architecture:** Extend the existing `VideoFeed -> useVideoProvider -> useInfiniteVideosFunnelcake -> fetchVideosV2` path with a `popular` feed type and explicit popular options. Add a `PopularPage` that owns URL-backed source and period controls, then add route/sidebar/i18n wiring.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Vitest, Testing Library, Funnelcake REST API, Phosphor Icons, i18next locale JSON.

---

## File Structure

- Modify `src/types/funnelcake.ts`: add v2 `period` and `exclude_platform` fetch options.
- Modify `src/lib/funnelcakeClient.ts`: pass `period` and `exclude_platform` through `fetchVideosV2`.
- Modify `src/hooks/useInfiniteVideosFunnelcake.ts`: add `popular` feed type and `popularSource`/`popularPeriod` options, map them to v2 params, and keep opaque cursor pagination.
- Modify `src/hooks/useVideoProvider.ts`: add `popular` to provider feed types and route it to Funnelcake only.
- Modify `src/components/VideoFeed.tsx`: accept `feedType="popular"` and popular options, pass them to provider.
- Create `src/pages/PopularPage.tsx`: parse URL params, render pill controls, and render `VideoFeed`.
- Create `src/pages/PopularPage.test.tsx`: page state and URL tests.
- Modify `src/hooks/useInfiniteVideosFunnelcake.test.ts`: popular API mapping and cursor tests.
- Modify `src/hooks/useVideoProvider.test.ts`: provider routing test for popular.
- Modify `src/AppRouter.tsx`: add `/popular`.
- Modify `src/components/AppSidebar.tsx`: add Popular nav item near Discover.
- Modify `src/lib/i18n/locales/*/common.json`: add `nav.popular` and `popularPage` keys. Use English fallback copy for non-English locales to preserve key consistency.

## Task 1: Funnelcake Popular Options

**Files:**
- Modify: `src/types/funnelcake.ts`
- Modify: `src/lib/funnelcakeClient.ts`

- [ ] **Step 1: Write failing type/client coverage by adding a test case to `src/hooks/useInfiniteVideosFunnelcake.test.ts`**

Add `mockFetchVideosV2` to the hoisted mocks and the Funnelcake client mock:

```ts
const mockFetchVideosV2 = vi.fn();

vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideos: mockFetchVideos,
  fetchVideosV2: mockFetchVideosV2,
  searchVideos: vi.fn(),
  fetchUserVideos: vi.fn(),
  fetchUserFeed: vi.fn(),
  fetchRecommendations: mockFetchRecommendations,
}));
```

Then add this test inside `describe('useInfiniteVideosFunnelcake', ...)`:

```ts
it('requests native popular videos with period and excludes classic Vines', async () => {
  mockFetchVideosV2.mockResolvedValueOnce({
    videos: [{}],
    has_more: true,
    next_cursor: 'o:12',
  });
  mockTransformToVideoPage.mockReturnValueOnce({
    videos: [{ id: 'video-1', pubkey: 'p1', kind: 34236, createdAt: 101, vineId: 'd-1' }],
    nextCursor: undefined,
    rawCursor: 'o:12',
    hasMore: true,
  });

  const { result } = renderHook(
    () => useInfiniteVideosFunnelcake({
      feedType: 'popular',
      popularSource: 'new',
      popularPeriod: 'now',
      pageSize: 12,
    }),
    { wrapper: createWrapper() }
  );

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
  });

  expect(mockFetchVideosV2).toHaveBeenCalledWith(
    'https://api.divine.video',
    expect.objectContaining({
      sort: 'popular',
      period: 'now',
      exclude_platform: 'vine',
      limit: 12,
      signal: expect.any(AbortSignal),
    })
  );
  expect(result.current.hasNextPage).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts
```

Expected: FAIL because `fetchVideosV2` is not mocked in the hook test and/or `popular` is not assignable to `FunnelcakeFeedType`.

- [ ] **Step 3: Add Funnelcake option types and v2 param pass-through**

In `src/types/funnelcake.ts`, update `FunnelcakeFetchOptions`:

```ts
export type FunnelcakePopularPeriod = 'now' | 'today' | 'week' | 'month' | 'all';

export interface FunnelcakeFetchOptions {
  sort?: 'trending' | 'recent' | 'popular' | 'loops' | 'engagement' | 'watching' | 'likes' | 'comments' | 'published';
  period?: FunnelcakePopularPeriod;
  limit?: number;
  before?: string;
  offset?: number;
  classic?: boolean;
  platform?: string;
  exclude_platform?: string;
  category?: string;
  signal?: AbortSignal;
}
```

In `src/lib/funnelcakeClient.ts`, update the destructuring and params in `fetchVideosV2`:

```ts
const {
  sort = 'watching',
  period,
  limit = 20,
  before,
  offset,
  classic,
  platform,
  exclude_platform,
  category,
  signal,
} = options;

const params: Record<string, string | number | boolean | undefined> = {
  sort,
  period,
  limit,
  classic,
  platform,
  exclude_platform,
  category,
};
```

- [ ] **Step 4: Run test to confirm remaining failure moves to hook support**

Run:

```bash
npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts
```

Expected: still FAIL until Task 2 adds `popular` support.

## Task 2: Hook And Provider Plumbing

**Files:**
- Modify: `src/hooks/useInfiniteVideosFunnelcake.ts`
- Modify: `src/hooks/useVideoProvider.ts`
- Modify: `src/components/VideoFeed.tsx`
- Test: `src/hooks/useInfiniteVideosFunnelcake.test.ts`
- Test: `src/hooks/useVideoProvider.test.ts`

- [ ] **Step 1: Add failing provider routing test**

In `src/hooks/useVideoProvider.test.ts`, add:

```ts
it('routes popular feeds to Funnelcake with popular options and no WebSocket fallback', () => {
  const { result } = renderHook(() =>
    useVideoProvider({
      feedType: 'popular',
      popularSource: 'classic',
      popularPeriod: 'week',
    })
  );

  expect(mockUseInfiniteVideosFunnelcake).toHaveBeenCalledWith(expect.objectContaining({
    feedType: 'popular',
    apiUrl: 'https://api.divine.video',
    popularSource: 'classic',
    popularPeriod: 'week',
    enabled: true,
  }));
  expect(mockUseInfiniteVideos).toHaveBeenCalledWith(expect.objectContaining({
    enabled: false,
  }));
  expect(result.current.dataSource).toBe('funnelcake');
});
```

- [ ] **Step 2: Run provider test to verify it fails**

Run:

```bash
npx vitest run src/hooks/useVideoProvider.test.ts
```

Expected: FAIL because `popular` is not a valid `VideoFeedType` and provider options do not include popular state.

- [ ] **Step 3: Add popular types and mapping to `useInfiniteVideosFunnelcake.ts`**

Add exported types near the existing feed/sort types:

```ts
export type FunnelcakeFeedType = 'trending' | 'recent' | 'classics' | 'hashtag' | 'profile' | 'home' | 'recommendations' | 'category' | 'popular';
export type FunnelcakeSortMode = 'trending' | 'recent' | 'loops' | 'engagement' | 'classic' | 'watching';
export type PopularSource = 'new' | 'classic' | 'all';
export type PopularPeriod = 'now' | 'today' | 'week' | 'month' | 'all';
```

Add options:

```ts
interface UseInfiniteVideosFunnelcakeOptions {
  feedType: FunnelcakeFeedType;
  apiUrl?: string;
  sortMode?: FunnelcakeSortMode;
  popularSource?: PopularSource;
  popularPeriod?: PopularPeriod;
  hashtag?: string;
  category?: string;
  pubkey?: string;
  pageSize?: number;
  enabled?: boolean;
  randomizeWithinTop?: number;
}
```

Update `getFetchOptions` signature and popular case:

```ts
function getFetchOptions(
  feedType: FunnelcakeFeedType,
  sortMode?: FunnelcakeSortMode,
  pageSize: number = 20,
  popularSource?: PopularSource,
  popularPeriod?: PopularPeriod
): FunnelcakeFetchOptions {
  const baseOptions: FunnelcakeFetchOptions = {
    limit: pageSize,
  };

  switch (feedType) {
    case 'popular':
      return {
        ...baseOptions,
        sort: 'popular',
        period: popularPeriod ?? 'now',
        ...(popularSource === 'new' ? { exclude_platform: 'vine' } : {}),
        ...(popularSource === 'classic' ? { platform: 'vine' } : {}),
      };
```

Destructure `popularSource = 'new'` and `popularPeriod = 'now'` in the hook args. Include them in the query key and `getFetchOptions` call:

```ts
queryKey: ['funnelcake-videos', feedType, effectiveApiUrl, sortMode, popularSource, popularPeriod, hashtag, category, pubkey, pageSize, randomStartOffset],
```

```ts
const options = getFetchOptions(feedType, sortMode, pageSize, popularSource, popularPeriod);
```

Route popular through v2:

```ts
case 'popular':
case 'trending':
  response = await fetchVideosV2(effectiveApiUrl, options);
  break;
```

Use v2 cursor pagination for popular:

```ts
let cursorType: 'timestamp' | 'offset' | 'cursor' =
  feedType === 'recommendations' || feedType === 'trending' || feedType === 'popular' ? 'cursor' : 'timestamp';
```

```ts
v2Cursor: feedType === 'trending' || feedType === 'popular' ? page.rawCursor : undefined,
```

```ts
if (feedType === 'trending' || feedType === 'popular') {
  return lastPage.v2Cursor;
}
```

- [ ] **Step 4: Add provider and VideoFeed plumbing**

In `src/hooks/useVideoProvider.ts`, import popular types:

```ts
import { useInfiniteVideosFunnelcake, type FunnelcakeFeedType, type FunnelcakeSortMode, type PopularPeriod, type PopularSource } from '@/hooks/useInfiniteVideosFunnelcake';
```

Update types:

```ts
export type VideoFeedType = 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'foryou' | 'category' | 'popular';

interface UseVideoProviderOptions {
  feedType: VideoFeedType;
  sortMode?: SortMode;
  popularSource?: PopularSource;
  popularPeriod?: PopularPeriod;
  hashtag?: string;
  category?: string;
  pubkey?: string;
  pageSize?: number;
  enabled?: boolean;
}
```

Add `popular` to `canServeFeedViaFunnelcake`, `mapToFunnelcakeFeedType`, and `canServeFeedViaWebsocket`:

```ts
case 'popular':
  return true;
```

```ts
case 'popular':
  return 'popular';
```

```ts
case 'popular':
  return false;
```

Destructure and pass popular options:

```ts
popularSource,
popularPeriod,
```

```ts
popularSource,
popularPeriod,
```

In `src/components/VideoFeed.tsx`, import types and extend props:

```ts
import type { PopularPeriod, PopularSource } from '@/hooks/useInfiniteVideosFunnelcake';
```

```ts
feedType?: 'discovery' | 'home' | 'trending' | 'hashtag' | 'profile' | 'recent' | 'classics' | 'foryou' | 'category' | 'popular';
popularSource?: PopularSource;
popularPeriod?: PopularPeriod;
```

Destructure and pass `popularSource`/`popularPeriod` into `useVideoProvider`.

- [ ] **Step 5: Run hook/provider tests**

Run:

```bash
npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts src/hooks/useVideoProvider.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit hook plumbing**

Run:

```bash
git add src/types/funnelcake.ts src/lib/funnelcakeClient.ts src/hooks/useInfiniteVideosFunnelcake.ts src/hooks/useInfiniteVideosFunnelcake.test.ts src/hooks/useVideoProvider.ts src/hooks/useVideoProvider.test.ts src/components/VideoFeed.tsx
git commit -m "feat(popular): add Funnelcake popular feed plumbing"
```

## Task 3: Popular Page

**Files:**
- Create: `src/pages/PopularPage.tsx`
- Create: `src/pages/PopularPage.test.tsx`

- [ ] **Step 1: Write failing page tests**

Create `src/pages/PopularPage.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { initializeI18n } from '@/lib/i18n';
import PopularPage from './PopularPage';

const mockVideoFeed = vi.fn();

vi.mock('@/components/VideoFeed', () => ({
  VideoFeed: (props: unknown) => {
    mockVideoFeed(props);
    return <div data-testid="popular-feed" />;
  },
}));

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}{location.search}</div>;
}

async function renderPage(initialEntry = '/popular') {
  await initializeI18n({ force: true, languages: ['en-US'] });
  mockVideoFeed.mockClear();
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PopularPage />
      <LocationDisplay />
    </MemoryRouter>
  );
}

describe('PopularPage', () => {
  it('defaults to New and Now with canonical empty query params', async () => {
    await renderPage('/popular');

    expect(screen.getByRole('heading', { name: 'Popular' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Now' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/popular');
    expect(mockVideoFeed).toHaveBeenCalledWith(expect.objectContaining({
      feedType: 'popular',
      popularSource: 'new',
      popularPeriod: 'now',
    }));
  });

  it('updates URL params when selecting Classic and Week', async () => {
    const user = userEvent.setup();
    await renderPage('/popular');

    await user.click(screen.getByRole('button', { name: 'Classic' }));
    await user.click(screen.getByRole('button', { name: 'Week' }));

    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('location-display')).toHaveTextContent('/popular?source=classic&period=week');
    expect(mockVideoFeed).toHaveBeenLastCalledWith(expect.objectContaining({
      feedType: 'popular',
      popularSource: 'classic',
      popularPeriod: 'week',
    }));
  });

  it('normalizes invalid params to defaults', async () => {
    await renderPage('/popular?source=bad&period=ancient');

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/popular');
    });
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Now' })).toHaveAttribute('aria-pressed', 'true');
  });
});
```

- [ ] **Step 2: Run page test to verify it fails**

Run:

```bash
npx vitest run src/pages/PopularPage.test.tsx
```

Expected: FAIL because `src/pages/PopularPage.tsx` does not exist.

- [ ] **Step 3: Implement `PopularPage.tsx`**

Create `src/pages/PopularPage.tsx`:

```tsx
// ABOUTME: Dedicated popular feed page with source and period controls
// ABOUTME: Uses Funnelcake v2 popular period feeds through the shared VideoFeed stack

import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Clock, FilmSlate, Fire, Sparkle, TrendUp } from '@phosphor-icons/react';
import { VideoFeed } from '@/components/VideoFeed';
import { cn } from '@/lib/utils';
import type { PopularPeriod, PopularSource } from '@/hooks/useInfiniteVideosFunnelcake';

const SOURCE_OPTIONS: Array<{ value: PopularSource; labelKey: string; icon: typeof Sparkle }> = [
  { value: 'new', labelKey: 'popularPage.sources.new', icon: Sparkle },
  { value: 'classic', labelKey: 'popularPage.sources.classic', icon: FilmSlate },
  { value: 'all', labelKey: 'popularPage.sources.all', icon: TrendUp },
];

const PERIOD_OPTIONS: Array<{ value: PopularPeriod; labelKey: string; icon: typeof Clock }> = [
  { value: 'now', labelKey: 'popularPage.periods.now', icon: Fire },
  { value: 'today', labelKey: 'popularPage.periods.today', icon: Clock },
  { value: 'week', labelKey: 'popularPage.periods.week', icon: Clock },
  { value: 'month', labelKey: 'popularPage.periods.month', icon: Clock },
  { value: 'all', labelKey: 'popularPage.periods.all', icon: TrendUp },
];

const SOURCE_VALUES = new Set<PopularSource>(SOURCE_OPTIONS.map(option => option.value));
const PERIOD_VALUES = new Set<PopularPeriod>(PERIOD_OPTIONS.map(option => option.value));

function parseSource(value: string | null): PopularSource {
  return value && SOURCE_VALUES.has(value as PopularSource) ? (value as PopularSource) : 'new';
}

function parsePeriod(value: string | null): PopularPeriod {
  return value && PERIOD_VALUES.has(value as PopularPeriod) ? (value as PopularPeriod) : 'now';
}

function buildCanonicalParams(source: PopularSource, period: PopularPeriod): URLSearchParams {
  const params = new URLSearchParams();
  if (source !== 'new') params.set('source', source);
  if (period !== 'now') params.set('period', period);
  return params;
}

export function PopularPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const source = parseSource(searchParams.get('source'));
  const period = parsePeriod(searchParams.get('period'));

  const canonicalParams = useMemo(
    () => buildCanonicalParams(source, period),
    [source, period]
  );
  const canonicalSearch = canonicalParams.toString();

  useEffect(() => {
    const currentSearch = searchParams.toString();
    if (currentSearch !== canonicalSearch) {
      setSearchParams(canonicalParams, { replace: true });
    }
  }, [canonicalParams, canonicalSearch, searchParams, setSearchParams]);

  const updateSource = (nextSource: PopularSource) => {
    setSearchParams(buildCanonicalParams(nextSource, period));
  };

  const updatePeriod = (nextPeriod: PopularPeriod) => {
    setSearchParams(buildCanonicalParams(source, nextPeriod));
  };

  const subheadingKey = `popularPage.subheadings.${source}.${period}`;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{t('popularPage.heading')}</h1>
            <p className="text-muted-foreground">{t(subheadingKey)}</p>
          </div>

          <div className="space-y-3" aria-label={t('popularPage.controlsLabel')}>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('popularPage.sourceLabel')}>
              {SOURCE_OPTIONS.map(option => {
                const Icon = option.icon;
                const selected = source === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updateSource(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-all',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-brand-light-green text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-brand-dark-green'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(option.labelKey)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label={t('popularPage.periodLabel')}>
              {PERIOD_OPTIONS.map(option => {
                const Icon = option.icon;
                const selected = period === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => updatePeriod(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all sm:px-4 sm:py-2',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-background text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t(option.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </header>

        <VideoFeed
          feedType="popular"
          popularSource={source}
          popularPeriod={period}
          accent="pink"
          data-testid="video-feed-popular"
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export default PopularPage;
```

- [ ] **Step 4: Run page test**

Run:

```bash
npx vitest run src/pages/PopularPage.test.tsx
```

Expected: PASS after adding i18n keys in Task 4. If it fails because i18n keys are missing, continue to Task 4 before re-running.

## Task 4: Route, Sidebar, And I18n

**Files:**
- Modify: `src/AppRouter.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/lib/i18n/locales/*/common.json`

- [ ] **Step 1: Add route**

In `src/AppRouter.tsx`, import the page:

```ts
import PopularPage from "./pages/PopularPage";
```

Add the route near other public browsing routes:

```tsx
<Route path="/popular" element={<PopularPage />} />
```

- [ ] **Step 2: Add sidebar nav**

In `src/components/AppSidebar.tsx`, add `TrendUp` to the Phosphor import:

```ts
import { House as Home, Compass, MagnifyingGlass as Search, Bell, User, Sun, Moon, CaretDown as ChevronDown, Headphones, ChartBar as BarChart3, SquaresFour as LayoutGrid, Rss, ChatCircle as MessageCircle, TrendUp } from '@phosphor-icons/react';
```

Add active helper:

```ts
const isPopularActive = () => location.pathname === '/popular';
```

Add nav item after Discover:

```tsx
<NavItem
  icon={<TrendUp className="h-[18px] w-[18px]" weight={isPopularActive() ? 'fill' : 'bold'} />}
  label={t('nav.popular')}
  onClick={() => navigate('/popular')}
  isActive={isPopularActive()}
/>
```

- [ ] **Step 3: Add English i18n keys**

In `src/lib/i18n/locales/en/common.json`, add `"popular": "Popular"` to `nav`, and add this top-level block near `trendingPage`:

```json
"popularPage": {
  "heading": "Popular",
  "controlsLabel": "Popular feed filters",
  "sourceLabel": "Source",
  "periodLabel": "Period",
  "sources": {
    "new": "New",
    "classic": "Classic",
    "all": "All"
  },
  "periods": {
    "now": "Now",
    "today": "Today",
    "week": "Week",
    "month": "Month",
    "all": "All time"
  },
  "subheadings": {
    "new": {
      "now": "Fresh Divine posts getting watched now.",
      "today": "Fresh Divine posts getting watched today.",
      "week": "Fresh Divine posts getting watched this week.",
      "month": "Fresh Divine posts getting watched this month.",
      "all": "Fresh Divine posts people keep coming back to."
    },
    "classic": {
      "now": "Classic Vines getting watched now.",
      "today": "Classic Vines getting watched today.",
      "week": "Classic Vines getting watched this week.",
      "month": "Classic Vines getting watched this month.",
      "all": "Classic Vines people keep watching on Divine."
    },
    "all": {
      "now": "Everything Divine is watching now.",
      "today": "Everything Divine watched today.",
      "week": "Everything Divine watched this week.",
      "month": "Everything Divine watched this month.",
      "all": "Everything people keep watching on Divine."
    }
  }
}
```

- [ ] **Step 4: Add fallback i18n keys to all other locales**

For every `src/lib/i18n/locales/*/common.json` except `en`, add the same `nav.popular` and `popularPage` English strings. Keep JSON formatting valid.

- [ ] **Step 5: Run locale consistency test and page test**

Run:

```bash
npx vitest run src/lib/i18n/locales.test.ts src/pages/PopularPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit page and route**

Run:

```bash
git add src/pages/PopularPage.tsx src/pages/PopularPage.test.tsx src/AppRouter.tsx src/components/AppSidebar.tsx src/lib/i18n/locales
git commit -m "feat(popular): add popular page"
```

## Task 5: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts src/hooks/useVideoProvider.test.ts src/pages/PopularPage.test.tsx src/lib/i18n/locales.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full project test**

Run:

```bash
npm run test
```

Expected: PASS with existing warnings only.

- [ ] **Step 3: Start dev server for browser verification**

Run:

```bash
npm run dev
```

Expected: Vite serves the worktree on `http://localhost:8080` or another available port.

- [ ] **Step 4: Verify `/popular` in browser**

Open the dev URL at `/popular` and verify:

- Page title is `Popular`.
- New and Now pills are selected by default.
- The sidebar includes Popular near Discover.
- Clicking Classic and Week updates URL to `/popular?source=classic&period=week`.
- Clicking New and Now returns URL to `/popular`.
- The feed attempts a Funnelcake v2 request with `sort=popular`.

- [ ] **Step 5: Confirm final git state**

Run:

```bash
git status --short --branch
```

Expected: branch is ahead of `origin/main` with committed popular-page changes and no unstaged or untracked source files. If verification produced source changes, review them with `git diff`, stage only the changed popular-page files, and commit with `git commit -m "fix(popular): polish popular page verification issues"`.

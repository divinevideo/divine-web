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
| `src/lib/funnelcakeClient.test.ts` (extend — file already exists) | `fetchVideos` / `fetchVideosV2` include `period` when set, omit when undefined |
| `src/hooks/useInfiniteVideosFunnelcake.test.ts` (extend) | `sortMode='popular'` + `period` plumbs to `fetchVideosV2` |
| `src/pages/TrendingPage.test.tsx` (new) | URL state, period row visibility, controversial coercion |
| `src/components/VideoFeed.test.tsx` (extend) | Quiet-hour empty state for popular + now (Task 9) |
| `src/lib/constants/sortModes.test.ts` (new) | Asserts shape of constants and that `controversial` is gone |

---

## Skills To Reference

- @superpowers:test-driven-development — Red/Green/Refactor for every step
- @superpowers:verification-before-completion — Run tests/typecheck before each commit; never claim done without evidence
- @CLAUDE.md (project) — Brand rules: no `uppercase` Tailwind class, no `lucide-react`, no gradients on layout surfaces; voice = casual-direct

---

## Conventions

- Commit format: `type: description` (e.g. `feat(popular): add period selector to /trending`).
- **Each commit body MUST end with the project's AI-assist footer** (per `CLAUDE.md`):
  ```
  Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
  ```
  Pass via heredoc — see the project's commit examples. Update the model name only if the project's `CLAUDE.md` has been updated to a newer model.
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
- Test: `src/lib/funnelcakeClient.test.ts` (already exists — extend with a new `describe` block)

> **Existing test pattern (must follow):** This file uses `vi.resetModules()` + `global.fetch = vi.fn()` in `beforeEach`, then dynamically `await import('./funnelcakeClient')` so module-level mocks (`./funnelcakeHealth`, `./debug`, `./nip98Auth`) are applied. Do **not** use `vi.spyOn(globalThis, 'fetch')` — it conflicts with the existing module mocks. Follow the existing shape exactly.

- [ ] **Step 1: Add a new `describe` block at the bottom of the file**

In `src/lib/funnelcakeClient.test.ts`, append a new top-level `describe('fetchVideos / fetchVideosV2 period parameter', …)` that mirrors the existing pattern. Inside the existing top-level `describe('funnelcakeClient', …)`, the `beforeEach` already wires `global.fetch = vi.fn()`, but the `let fetchUserProfile: …` block does not pull in `fetchVideos` / `fetchVideosV2`. Add a fresh top-level describe so we don't have to amend the shared `let` block:

```ts
describe('fetchVideos / fetchVideosV2 period parameter', () => {
  let fetchVideos: typeof import('./funnelcakeClient').fetchVideos;
  let fetchVideosV2: typeof import('./funnelcakeClient').fetchVideosV2;

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = vi.fn();
    const client = await import('./funnelcakeClient');
    fetchVideos = client.fetchVideos;
    fetchVideosV2 = client.fetchVideosV2;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function lastFetchUrl(): string {
    const mockFetch = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const calls = mockFetch.mock.calls;
    return String(calls[calls.length - 1][0]);
  }

  it('fetchVideos includes period when provided', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    await fetchVideos(API_URL, { sort: 'popular', period: 'week', limit: 12 });

    const url = lastFetchUrl();
    expect(url).toContain('sort=popular');
    expect(url).toContain('period=week');
  });

  it('fetchVideos omits period when undefined', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    await fetchVideos(API_URL, { sort: 'popular', limit: 12 });

    expect(lastFetchUrl()).not.toContain('period=');
  });

  it('fetchVideosV2 includes period when provided', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], pagination: { has_more: false } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchVideosV2(API_URL, { sort: 'popular', period: 'today', limit: 12 });

    const url = lastFetchUrl();
    expect(url).toContain('sort=popular');
    expect(url).toContain('period=today');
  });

  it('fetchVideosV2 omits period when undefined', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [], pagination: { has_more: false } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    await fetchVideosV2(API_URL, { sort: 'watching', limit: 12 });

    expect(lastFetchUrl()).not.toContain('period=');
  });
});
```

> `API_URL` is already defined at the top of the file as `'https://api.divine.video'`. Reuse it.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/funnelcakeClient.test.ts -t "period parameter"`
Expected: FAIL — period appears nowhere in URLs.

- [ ] **Step 3: Update `fetchVideos`**

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

- [ ] **Step 4: Update `fetchVideosV2`**

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

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run src/lib/funnelcakeClient.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/funnelcakeClient.ts src/lib/funnelcakeClient.test.ts
git commit -m "feat(funnelcake): thread period query param through fetchVideos and fetchVideosV2"
```

---

## Task 3: Add `'popular'` to `FunnelcakeSortMode` and wire `period` through the hook

**Files:**
- Modify: `src/hooks/useInfiniteVideosFunnelcake.ts:16-17,89-163,177-205`
- Test: `src/hooks/useInfiniteVideosFunnelcake.test.ts` (extend)

- [ ] **Step 1: Add `mockFetchVideosV2` to the existing module mock**

The current test file (`src/hooks/useInfiniteVideosFunnelcake.test.ts:6-22`) does **not** mock `fetchVideosV2`. The trending feed path calls `fetchVideosV2`, so calling `useInfiniteVideosFunnelcake({ feedType: 'trending', ... })` from a test today silently invokes `undefined()`. Fix this first — even before adding period — because all popular tests depend on it.

At the top of the file, alongside `const mockFetchVideos = vi.fn();`, add:

```ts
const mockFetchVideosV2 = vi.fn();
```

In the `vi.mock('@/lib/funnelcakeClient', …)` block, add the new entry:

```ts
vi.mock('@/lib/funnelcakeClient', () => ({
  fetchVideos: mockFetchVideos,
  fetchVideosV2: mockFetchVideosV2,   // NEW
  searchVideos: vi.fn(),
  fetchUserVideos: vi.fn(),
  fetchUserFeed: vi.fn(),
  fetchRecommendations: mockFetchRecommendations,
}));
```

No changes needed in `beforeEach` — the existing `vi.clearAllMocks()` (line 56) clears the new mock automatically.

- [ ] **Step 2: Write the failing test**

Append to `src/hooks/useInfiniteVideosFunnelcake.test.ts` (as a new top-level `describe`):

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

- [ ] **Step 3: Run tests, verify they fail**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts -t "popular sort with period"`
Expected: FAIL — `'popular'` not assignable to `FunnelcakeSortMode`.

- [ ] **Step 4: Extend the type and options**

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

- [ ] **Step 5: Wire `period` into `getFetchOptions`**

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

- [ ] **Step 6: Pass `period` from the hook body and into the queryKey**

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

- [ ] **Step 7: Guard edge-feed consumption against Popular requests**

> **Real bug to fix here, not just a forward-looking change.** The current hook (`src/hooks/useInfiniteVideosFunnelcake.ts:210-234`) unconditionally consumes `window.__DIVINE_FEED__` on the first page when `feedType === 'trending'`. The Fastly edge worker injects this for the *default* trending feed (sort=watching, no period). When a user deep-links to `/trending?sort=popular&period=today`, page 1 would silently use the wrong sort while page 2+ correctly hits the API. The fix is one line.

Around line 213-214 of `src/hooks/useInfiniteVideosFunnelcake.ts`, change:

```ts
const edgeMatchesFeed = edgeFeedType === feedType || (edgeFeedType === undefined && feedType === 'trending');
if (!pageParam && edgeMatchesFeed && typeof window !== 'undefined' && window.__DIVINE_FEED__) {
```

to:

```ts
// Edge-injected data only represents the default trending feed (sort=watching, no period).
// Skip it whenever the request specifies a period — those mean Popular, which the edge
// hasn't pre-cached.
const edgeMatchesFeed = edgeFeedType === feedType || (edgeFeedType === undefined && feedType === 'trending');
const edgeUsable = edgeMatchesFeed && !period;
if (!pageParam && edgeUsable && typeof window !== 'undefined' && window.__DIVINE_FEED__) {
```

(Replace just the `edgeMatchesFeed` check in the `if` with `edgeUsable`.)

Add a regression test inside `src/hooks/useInfiniteVideosFunnelcake.test.ts` (in the same `describe('popular sort with period')` block):

```ts
it('does not consume edge-injected feed when period is set', async () => {
  // Simulate the real edge worker: it sets BOTH globals together.
  // See compute-js/src/index.js:207 — `window.__DIVINE_FEED_TYPE__="trending"`.
  // (The hook also has a fallback path for `__DIVINE_FEED_TYPE__ === undefined`
  // but that's not what production looks like.)
  type EdgeWindow = Window & { __DIVINE_FEED__?: unknown; __DIVINE_FEED_TYPE__?: string };
  (window as EdgeWindow).__DIVINE_FEED__ = {
    videos: [{ id: 'edge-video', pubkey: 'edge-p', kind: 34236, createdAt: 1, vineId: 'edge-d' }],
  };
  (window as EdgeWindow).__DIVINE_FEED_TYPE__ = 'trending';

  mockFetchVideosV2.mockResolvedValueOnce({ videos: [{}], has_more: false, next_cursor: undefined });
  mockTransformToVideoPage.mockReturnValueOnce({
    videos: [{ id: 'api-video', pubkey: 'api-p', kind: 34236, createdAt: 2, vineId: 'api-d' }],
    nextCursor: undefined,
    hasMore: false,
  });

  const { result } = renderHook(
    () => useInfiniteVideosFunnelcake({ feedType: 'trending', sortMode: 'popular', period: 'today', pageSize: 12 }),
    { wrapper: createWrapper() }
  );

  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  // Hook hit the API, not the edge cache
  expect(mockFetchVideosV2).toHaveBeenCalled();
  expect(result.current.data?.pages[0]?.videos[0]?.id).toBe('api-video');

  // Edge cache untouched — still available for a future non-period request
  // (e.g., switching back to Hot would let the hook consume it).
  expect((window as EdgeWindow).__DIVINE_FEED__).toBeDefined();
  expect((window as EdgeWindow).__DIVINE_FEED_TYPE__).toBe('trending');

  // Cleanup so test order doesn't leak into other suites
  delete (window as EdgeWindow).__DIVINE_FEED__;
  delete (window as EdgeWindow).__DIVINE_FEED_TYPE__;
});
```

- [ ] **Step 8: Run the popular tests (including the edge-cache regression test)**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts -t "popular sort with period"`
Expected: PASS — both the period-plumbing tests and the edge-cache guard test.

- [ ] **Step 9: Run the full test file to confirm no regressions**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts`
Expected: PASS (all). The existing recommendations tests still work because they don't set `period`.

- [ ] **Step 10: Commit**

```bash
git add src/hooks/useInfiniteVideosFunnelcake.ts src/hooks/useInfiniteVideosFunnelcake.test.ts
git commit -m "feat(feed): wire period through useInfiniteVideosFunnelcake; skip edge cache for Popular"
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

In `src/lib/constants/sortModes.ts` (no new icon imports needed — period pills are text-only; the existing `TrendingUp` is reused for the Popular tab):

1. Replace `EXTENDED_SORT_MODES`:

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

2. Update `SEARCH_SORT_MODES` to drop the `controversial` entry.

3. Add `POPULAR_PERIODS`:

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

Create `src/pages/TrendingPage.test.tsx`. Note the URL encoding: the **New** tab (sortMode `undefined`) is encoded as `?sort=new` — not as a missing param — so the round-trip `URL → state → URL` is stable and clicking New doesn't silently revert to Hot.

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TrendingPage from './TrendingPage';

// Mock VideoFeed to a probe div that exposes the props through dataset.
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

// Watcher exposes the current URL search to the DOM so tests can assert on URL rewrites.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderAt(initial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route
            path="/trending"
            element={<>
              <TrendingPage />
              <LocationProbe />
            </>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TrendingPage URL state', () => {
  it('defaults to sort=hot and renders no period row when no params', () => {
    renderAt('/trending');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.sort).toBe('hot');
    expect(screen.queryByTestId('period-row')).not.toBeInTheDocument();
  });

  it('shows the period row when sort=popular and defaults period to today', () => {
    renderAt('/trending?sort=popular');
    const feed = screen.getByTestId('video-feed');
    expect(feed.dataset.sort).toBe('popular');
    expect(feed.dataset.period).toBe('today');
    expect(screen.getByTestId('period-row')).toBeInTheDocument();
    expect(screen.getByTestId('period-pill-week')).toBeInTheDocument();
  });

  it('respects ?sort=popular&period=week', () => {
    renderAt('/trending?sort=popular&period=week');
    expect(screen.getByTestId('video-feed').dataset.period).toBe('week');
    expect(screen.getByTestId('period-pill-week')).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders ?sort=controversial as the Hot tab (no API call uses controversial) and hides the period row', () => {
    renderAt('/trending?sort=controversial');
    expect(screen.getByTestId('video-feed').dataset.sort).toBe('hot');
    expect(screen.queryByTestId('period-row')).not.toBeInTheDocument();
  });

  it('encodes the New tab as ?sort=new (round-trip stable)', () => {
    renderAt('/trending?sort=new');
    // sortMode is undefined for New — VideoFeed receives no sort
    expect(screen.getByTestId('video-feed').dataset.sort).toBe('');
    // No period row for New
    expect(screen.queryByTestId('period-row')).not.toBeInTheDocument();
  });

  it('updates the URL and feed when a period pill is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/trending?sort=popular');
    await user.click(screen.getByTestId('period-pill-month'));
    await waitFor(() => {
      expect(screen.getByTestId('video-feed').dataset.period).toBe('month');
    });
    expect(screen.getByTestId('location-search').textContent).toContain('period=month');
    expect(screen.getByTestId('location-search').textContent).toContain('sort=popular');
  });

  it('drops period from the URL when switching from Popular to Hot', async () => {
    const user = userEvent.setup();
    renderAt('/trending?sort=popular&period=week');
    // Sort tabs use hardcoded English labels from EXTENDED_SORT_MODES (not via i18n)
    await user.click(screen.getByRole('tab', { name: /^Hot/i }));
    await waitFor(() => {
      expect(screen.getByTestId('video-feed').dataset.sort).toBe('hot');
    });
    expect(screen.getByTestId('location-search').textContent).not.toContain('period=');
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

import { useCallback } from 'react';
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

const VALID_SORTS: ReadonlyArray<string> = ['hot', 'top', 'rising', 'popular', 'classic', 'new'];
const VALID_PERIODS: ReadonlyArray<string> = ['now', 'today', 'week', 'month', 'all'];

// URL encoding rules:
// - Missing sort param → 'hot' (default)
// - 'new' (the New tab; sortMode undefined) → 'new' in URL, undefined in state
// - 'controversial' (legacy) → coerced to 'hot' in state; URL not rewritten (cosmetic only)
// - Unknown values → 'hot'
function parseSort(raw: string | null): SortMode | undefined {
  if (raw === null) return 'hot';
  if (raw === 'new') return undefined;
  if (raw === 'controversial') return 'hot';
  return (VALID_SORTS.includes(raw) ? (raw as SortMode) : 'hot');
}

function parsePeriod(raw: string | null): FunnelcakePeriod {
  if (raw && VALID_PERIODS.includes(raw)) return raw as FunnelcakePeriod;
  return 'today';
}

function sortToUrl(sort: SortMode | undefined): string {
  return sort ?? 'new';
}

export function TrendingPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const sortMode = parseSort(searchParams.get('sort'));
  const period = parsePeriod(searchParams.get('period'));

  const setSort = useCallback((next: SortMode | undefined) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', sortToUrl(next));
    if (next !== 'popular') params.delete('period');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const setPeriod = useCallback((next: FunnelcakePeriod) => {
    const params = new URLSearchParams(searchParams);
    params.set('period', next);
    params.set('sort', 'popular');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

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
              data-testid="period-row"
              className="flex flex-wrap gap-2 pl-1"
            >
              {POPULAR_PERIODS.map(p => {
                const isSelected = period === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={isSelected}
                    data-testid={`period-pill-${p.value}`}
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
- Modify: `src/components/VideoFeed.tsx` (extend the existing empty-state branch — do NOT add a separate early return)
- Test: `src/components/VideoFeed.test.tsx` (extend)

> The empty state at `src/components/VideoFeed.tsx:362-437` is a single early return that swaps copy based on `feedType`. Reuse its wrapper (refs, testids, Card layout). Don't duplicate the wrapper — extend the conditional with a new "quiet hour" branch in the heading/subtitle/action area.

- [ ] **Step 1: Locate the empty-state branch**

Open `src/components/VideoFeed.tsx` around line 361. The structure is:

```tsx
if (!filteredVideos || filteredVideos.length === 0) {
  // ...wrapper Card with conditional copy keyed off feedType...
}
```

- [ ] **Step 2: Compute `isQuietHour` near the top of `VideoFeed`**

Right after `const filteredVideos = useMemo(...)` (around line 128), add:

```ts
const isQuietHour =
  feedType === 'trending' && sortMode === 'popular' && period === 'now';
```

> `period` is the new prop added in Task 5.

- [ ] **Step 3: Branch the empty-state copy**

Inside the empty-state early return, replace the existing else-branch (the one that renders the green circle + Video icon + headings) so the quiet-hour variant takes precedence over the generic "No videos found" copy. Keep the existing reclining-Divine branch for `discovery`/`trending`/`classics` only when `!isQuietHour`:

```tsx
{(feedType === 'discovery' || feedType === 'trending' || feedType === 'classics') && !allFiltered && !isQuietHour ? (
  // ...existing reclining-Divine branch unchanged...
) : isQuietHour ? (
  <>
    <div className="w-16 h-16 rounded-full bg-brand-light-green dark:bg-brand-dark-green flex items-center justify-center mx-auto">
      <Video className="h-8 w-8 text-primary" />
    </div>
    <div className="space-y-2">
      <p className="text-lg font-medium text-foreground">
        {t('trendingPage.popular.emptyHeading')}
      </p>
      <p className="text-sm text-muted-foreground">
        {t('trendingPage.popular.emptyBody')}
      </p>
    </div>
    <Button
      variant="default"
      onClick={() => navigate('/trending?sort=popular&period=today', { replace: true })}
      data-testid="quiet-hour-action"
    >
      {t('trendingPage.popular.emptyAction')}
    </Button>
  </>
) : (
  // ...existing generic empty branch unchanged (the green circle + per-feedType copy)...
)}
```

> The existing `useTranslation` hook (`const { t } = useTranslation();`) is already in scope at the top of the function. The existing `Button` import is already present (used on line 248-258 area). `navigate` is already in scope from `useSubdomainNavigate` — reuse it.

- [ ] **Step 4: Add a component test**

Append to `src/components/VideoFeed.test.tsx` a new `it(...)` inside the existing `describe('VideoFeed', ...)`. The file already initializes real i18n (`await initializeI18n({ force: true, languages: ['en-US'] })`) and mocks `useVideoProvider` via `mockUseVideoProvider`, so we override the data return per-test. The English translation added in Task 7 is "Quiet hour" / "Try a wider window." / "Show today" — match those.

```tsx
it('renders the quiet-hour empty state for popular + now when feed is empty', async () => {
  mockUseVideoProvider.mockReturnValue({
    data: { pages: [{ videos: [] }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    dataSource: 'funnelcake',
  });

  render(
    <MemoryRouter initialEntries={['/trending?sort=popular&period=now']}>
      <VideoFeed
        feedType="trending"
        sortMode="popular"
        period="now"
        viewMode="feed"
        mode="thumbnail"
      />
    </MemoryRouter>
  );

  expect(await screen.findByText(/quiet hour/i)).toBeInTheDocument();
  expect(screen.getByTestId('quiet-hour-action')).toBeInTheDocument();
});

it('does not render the quiet-hour empty state for popular + week', async () => {
  mockUseVideoProvider.mockReturnValue({
    data: { pages: [{ videos: [] }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    dataSource: 'funnelcake',
  });

  render(
    <MemoryRouter initialEntries={['/trending?sort=popular&period=week']}>
      <VideoFeed
        feedType="trending"
        sortMode="popular"
        period="week"
        viewMode="feed"
        mode="thumbnail"
      />
    </MemoryRouter>
  );

  // Renders the existing "Divine reclining" / "Divine needs a rest" branch instead
  expect(screen.queryByTestId('quiet-hour-action')).not.toBeInTheDocument();
});
```

> The new prop `period` must already be on `VideoFeedProps` (Task 5). If TS complains about `sortMode="popular"`, ensure Task 4 has run (`'popular'` added to `SortMode`).

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/VideoFeed.test.tsx`
Expected: PASS (including the new quiet-hour test).

- [ ] **Step 6: Commit**

```bash
git add src/components/VideoFeed.tsx src/components/VideoFeed.test.tsx
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
- `period.label`: `"Zeitraum"`
- `period.now`: `"Jetzt"`
- `period.today`: `"Heute"`
- `period.week`: `"Diese Woche"`
- `period.month`: `"Diesen Monat"`
- `period.all`: `"Alle Zeit"`
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
6. Visit `/trending?sort=controversial`. Hot tab is active and the period row is hidden. (The URL itself stays `?sort=controversial` — coercion is render-only by design.)
7. Visit `/trending?sort=popular&period=now`. If feed is empty (off-hours), see "Quiet hour — try a wider window" with a button that navigates to `?sort=popular&period=today`.
8. **Edge-cache deep-link smoke test (validates the Task 3 Step 7 fix).** The edge worker only injects `__DIVINE_FEED__` on the initial HTML response, not on client-side navigations — so this must be tested by opening a *fresh tab* directly to the deep link, not by clicking around the SPA.
   - Open a brand-new tab. Paste `/trending?sort=popular&period=week` and load it.
   - DevTools → Network: confirm the very first `/api/v2/videos?...` request includes `sort=popular&period=week`. If it instead requests the default trending feed (or no API call fires for page 1), the edge guard is broken.
   - In the Console, run `window.__DIVINE_FEED__` — it should still be defined (the hook left it untouched because period was set). If it's `undefined`, the guard didn't fire and the cache was consumed.

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
- [ ] `/trending?sort=controversial` renders the Hot tab (URL stays as-is — coercion is render-only)
- [ ] `/trending?sort=popular&period=week` deep-link survives refresh
- [ ] Quiet-hour empty state appears for empty `now` window with one-tap fix
- [ ] Axe a11y sweep green on `/trending?sort=popular&period=today`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Risks & gotchas (read before executing)

- **`DiscoveryPage` also passes `feedType="trending"` to `VideoFeed`** (`src/pages/DiscoveryPage.tsx:185,198`). The new `period` prop is optional and defaults to `undefined` for those calls — Discovery keeps its current behavior. No changes required there. Verify the discovery feed still loads in Task 12.
- **The existing `useInfiniteVideosFunnelcake.test.ts` does not mock `fetchVideosV2`.** Today, any test that drives the trending feed silently calls `undefined()`. Task 3 fixes this by adding `mockFetchVideosV2` — ensure existing tests in that file still pass after the mock is added (they may have been incidentally relying on the missing mock returning `undefined`).
- **`funnelcakeClient.test.ts` uses `vi.resetModules()` per test.** Do not introduce `vi.spyOn(globalThis, 'fetch')` — it conflicts with the dynamic-import + `global.fetch = vi.fn()` pattern. Stick to the existing pattern (Task 2).
- **URL encoding for the New tab:** the tab is encoded as `?sort=new`, **not** as a missing param. Missing `?sort` defaults to Hot (matches today's behavior). Clicking New writes `?sort=new`. This is the only way to make the round-trip stable.
- **Controversial coercion is render-only**, no URL rewrite. Visiting `?sort=controversial` renders Hot; the URL stays `?sort=controversial` until the user clicks something. This is intentional — rewriting the URL on mount triggers re-render churn and is not testable from `useSearchParams` without a location probe.
- **The trending feed uses `/api/v2/videos`.** When `sort=popular` is selected, the request becomes `GET /api/v2/videos?sort=popular&period=<value>&limit=12`. Verify in DevTools network tab during Task 12 manual QA.
- **Edge-injected feed cache (`window.__DIVINE_FEED__`)** is consumed unconditionally on the first `trending` page in the *current* code at `useInfiniteVideosFunnelcake.ts:210-234`, regardless of sortMode/period. This silently breaks deep-links to `/trending?sort=popular&period=…` (page 1 would show the edge's default sort/period; pages 2+ would correctly use Popular). **Task 3 Step 7 fixes this** with a one-line guard (`!period`) plus a regression test. Existing Hot/Top/Rising sorts keep their current edge consumption — production today already accepts that mismatch and this plan deliberately does not expand the fix beyond Popular. No edge-worker change required.
- **Brand guardrails** (`tests/brand`) run on the entire src tree. New code must avoid: Tailwind `uppercase` class, `lucide-react` imports, `bg-gradient-*` / `radial-gradient(` / `linear-gradient(` on layout surfaces. The plan's snippets comply, but watch for accidental introductions during Task 8/9.
- **`'controversial'` is intentionally NOT removed from the `SortMode` type.** Several call sites still reference it in switch/case branches and literal arrays — `useInfiniteSearchVideos.ts:51`, `useInfiniteVideos.ts:83` (`['top', 'hot', 'rising', 'controversial'].includes(...)`), `useVideoProvider.ts:117`, `useVideoByIdFunnelcake.ts:46`, `relayCapabilities.ts:26`. Keeping the type literal means none of those need editing; the only behavioral change is that `EXTENDED_SORT_MODES` and `SEARCH_SORT_MODES` no longer surface a tab for it. Old `?sort=controversial` URLs on `/trending` get coerced to `hot` (Task 8); on `/search`, no tab is highlighted but the search itself still functions.

---

## Out of scope (for follow-up)

- Period support on hashtag, search, profile, and category feeds.
- Edge-cache popular feeds per period (would speed first paint dramatically).
- Per-period RSS feeds.
- Renaming `/trending` → `/popular`.
- Combining `Classic` with `period`.
- Leaderboard page period changes.

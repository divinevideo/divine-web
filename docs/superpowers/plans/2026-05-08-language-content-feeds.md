# Language-Filtered Content Feeds Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make content language a first-class URL-prefix filter on every feed-shaped page, plus a `/languages` index page that surfaces every language with content.

**Architecture:** A `<LanguagePrefixGuard />` route sits in front of all feed pages and validates a `:lang` segment against a data-driven allowlist (sourced from a new `/api/languages` endpoint). The guard publishes the active language to a React context that page-level data hooks read. Each affected hook gains a `language` parameter that becomes a `?language=xx` query string on Funnelcake list endpoints. UI affordance is a small `<LanguageBanner />` shown when in prefix mode. The `/languages` index page renders a hybrid showcase + long-tail layout.

**Tech Stack:** React 18, React Router v6, TanStack Query, Vitest + React Testing Library, Playwright, Tailwind, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-05-08-language-content-feeds-design.md`

**Hard dependency on Funnelcake (separate repo, separate plan):** This plan assumes `GET /api/languages` exists and that `/api/videos`, `/api/v2/videos`, `/api/search`, `/api/v2/search`, `/api/leaderboard/videos`, `/api/hashtags`, `/api/hashtags/trending`, `/api/categories` all accept a `language` query parameter. **The Funnelcake plan must merge before any tests in this plan that hit a real API will pass.** Until then, web tests use mocks and integration verification is deferred.

---

## File Structure

### New files

| File | Responsibility |
| --- | --- |
| `src/lib/languageNames.ts` | ISO 639 code → endonym + English name |
| `src/lib/languageNames.test.ts` | Tests for above |
| `src/contexts/LanguageContext.tsx` | React context + provider for active content language |
| `src/hooks/useActiveContentLanguage.ts` | Read active language from context |
| `src/hooks/useLanguagesIndex.ts` | Fetch `/api/languages` |
| `src/hooks/useLanguagesIndex.test.ts` | Tests for above |
| `src/components/language/LanguagePrefixGuard.tsx` | Validates `:lang` segment, sets context, renders Outlet |
| `src/components/language/LanguagePrefixGuard.test.tsx` | Tests for above |
| `src/components/language/LanguageBanner.tsx` | In-context indicator + exit affordance |
| `src/components/language/LanguageBanner.test.tsx` | Tests for above |
| `src/components/language/LanguageShowcaseCard.tsx` | Top-of-index card with thumbnails |
| `src/components/language/LanguageStatCard.tsx` | Long-tail card without thumbnails |
| `src/pages/Languages.tsx` | `/languages` index page |
| `src/pages/Languages.test.tsx` | Tests for above |
| `tests/e2e/language-feeds.spec.ts` | Playwright walk through the grammar |

### Modified files

| File | Change |
| --- | --- |
| `src/AppRouter.tsx` | Add `:lang` parent route; add `/languages` route |
| `src/hooks/useInfiniteVideosFunnelcake.ts` | Accept `language?: string`, thread to URL |
| `src/hooks/useInfiniteSearchVideos.ts` | Accept `language?: string`, thread to URL |
| `src/hooks/useSearchHashtags.ts` | Accept `language?: string`, thread to URL |
| `src/hooks/useCategories.ts` | Accept `language?: string`, thread to URL |
| `src/pages/DiscoveryPage.tsx` | Read context, pass language, mount banner |
| `src/pages/HashtagPage.tsx` | Same |
| `src/pages/CategoryPage.tsx` | Same |
| `src/pages/SearchPage.tsx` | Same |
| `src/pages/TrendingPage.tsx` | Same |
| `src/pages/HashtagDiscoveryPage.tsx` | Same |
| `src/pages/CategoriesIndexPage.tsx` | Same |
| `src/pages/LeaderboardPage.tsx` | Same |
| `src/components/AppSidebar.tsx` | Add "Languages" nav entry |

---

## Skills To Reference

- @superpowers:test-driven-development — every task is RED → GREEN → REFACTOR
- @superpowers:verification-before-completion — run the test, observe the output, before claiming done
- @superpowers:requesting-code-review — at the end of each chunk

---

## Chunk 1: Foundation (utilities + context)

The smallest pieces that everything else depends on. Pure functions and context plumbing — no networking, no routing, no UI.

### Task 1: `languageNames.ts` — ISO code → endonym + English name

**Files:**
- Create: `src/lib/languageNames.ts`
- Test: `src/lib/languageNames.test.ts`

The runtime's `Intl.DisplayNames` API does most of this work. We supply a thin wrapper that returns `{ code, endonym, english }` and falls back to the raw code for unknown languages.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/languageNames.test.ts
import { describe, it, expect } from 'vitest';
import { getLanguageName } from './languageNames';

describe('getLanguageName', () => {
  it('returns endonym + English for common codes', () => {
    expect(getLanguageName('es')).toEqual({ code: 'es', endonym: 'español', english: 'Spanish' });
    expect(getLanguageName('pt')).toEqual({ code: 'pt', endonym: 'português', english: 'Portuguese' });
    expect(getLanguageName('ja')).toEqual({ code: 'ja', endonym: '日本語', english: 'Japanese' });
  });

  it('uppercases the first letter of the English name', () => {
    expect(getLanguageName('fr').english).toBe('French');
  });

  it('falls back to the raw code when unknown', () => {
    expect(getLanguageName('xx')).toEqual({ code: 'xx', endonym: 'xx', english: 'xx' });
  });

  it('lowercases the input code', () => {
    expect(getLanguageName('ES').code).toBe('es');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/languageNames.test.ts`
Expected: FAIL — `getLanguageName` is not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/languageNames.ts
export interface LanguageName {
  code: string;
  endonym: string;
  english: string;
}

function safeDisplayName(locale: string, code: string): string {
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'language', fallback: 'code' });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export function getLanguageName(rawCode: string): LanguageName {
  const code = rawCode.toLowerCase();
  const endonym = safeDisplayName(code, code);
  const english = safeDisplayName('en', code);
  return { code, endonym, english };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/languageNames.test.ts`
Expected: PASS — all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/languageNames.ts src/lib/languageNames.test.ts
git commit -m "feat(i18n): add languageNames helper for endonym + English names"
```

### Task 2: `LanguageContext.tsx` — context + provider

**Files:**
- Create: `src/contexts/LanguageContext.tsx`

This is just a context. No tests needed for the bare context; tests come via the consumer hook in Task 3.

- [ ] **Step 1: Implement context**

```tsx
// src/contexts/LanguageContext.tsx
import { createContext, ReactNode } from 'react';

export interface ContentLanguageContextValue {
  /** Active content-language code, e.g. 'es'. Undefined means "no prefix". */
  language: string | undefined;
}

export const ContentLanguageContext = createContext<ContentLanguageContextValue>({
  language: undefined,
});

export function ContentLanguageProvider({
  language,
  children,
}: {
  language: string | undefined;
  children: ReactNode;
}) {
  return (
    <ContentLanguageContext.Provider value={{ language }}>
      {children}
    </ContentLanguageContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/contexts/LanguageContext.tsx
git commit -m "feat(i18n): add ContentLanguageContext for prefix-driven content language"
```

### Task 3: `useActiveContentLanguage` hook

**Files:**
- Create: `src/hooks/useActiveContentLanguage.ts`
- Test: `src/hooks/useActiveContentLanguage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useActiveContentLanguage.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ContentLanguageProvider } from '@/contexts/LanguageContext';
import { useActiveContentLanguage } from './useActiveContentLanguage';

describe('useActiveContentLanguage', () => {
  it('returns undefined outside a provider', () => {
    const { result } = renderHook(() => useActiveContentLanguage());
    expect(result.current).toBeUndefined();
  });

  it('returns the active language from a provider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ContentLanguageProvider language="es">{children}</ContentLanguageProvider>
    );
    const { result } = renderHook(() => useActiveContentLanguage(), { wrapper });
    expect(result.current).toBe('es');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useActiveContentLanguage.test.tsx`
Expected: FAIL — `useActiveContentLanguage` is not defined.

- [ ] **Step 3: Implement hook**

```ts
// src/hooks/useActiveContentLanguage.ts
import { useContext } from 'react';
import { ContentLanguageContext } from '@/contexts/LanguageContext';

export function useActiveContentLanguage(): string | undefined {
  return useContext(ContentLanguageContext).language;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useActiveContentLanguage.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useActiveContentLanguage.ts src/hooks/useActiveContentLanguage.test.tsx
git commit -m "feat(i18n): add useActiveContentLanguage hook"
```

---

## Chunk 2: Backend integration (index fetch + filter parameter on hooks)

Wire data hooks to consume the new Funnelcake surface. Tests stub fetch; no real network.

### Task 4: `useLanguagesIndex` — fetch `/api/languages`

**Files:**
- Create: `src/hooks/useLanguagesIndex.ts`
- Test: `src/hooks/useLanguagesIndex.test.ts`

The hook returns a sorted list and a memoized `Set<string>` of valid language codes (the live allowlist used by the prefix guard).

- [ ] **Step 1: Write the failing test**

```ts
// src/hooks/useLanguagesIndex.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLanguagesIndex } from './useLanguagesIndex';

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useLanguagesIndex', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        languages: [
          { code: 'en', video_count: 12000, creator_count: 3000, sample_thumbnails: [] },
          { code: 'es', video_count: 47, creator_count: 19, sample_thumbnails: ['a.jpg'] },
        ],
      }),
    })));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('returns sorted languages', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useLanguagesIndex(), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.languages.map(l => l.code)).toEqual(['en', 'es']);
  });

  it('exposes a Set of allowed codes', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useLanguagesIndex(), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.allowedCodes.has('es')).toBe(true);
    expect(result.current.data?.allowedCodes.has('xx')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useLanguagesIndex.test.ts`
Expected: FAIL — `useLanguagesIndex` undefined.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useLanguagesIndex.ts
import { useQuery } from '@tanstack/react-query';
import { getApiUrl } from '@/config/api';

export interface LanguageIndexEntry {
  code: string;
  video_count: number;
  creator_count: number;
  sample_thumbnails: string[];
}

export interface LanguageIndex {
  languages: LanguageIndexEntry[];
  allowedCodes: Set<string>;
}

export function useLanguagesIndex() {
  return useQuery<LanguageIndex>({
    queryKey: ['languages-index'],
    queryFn: async ({ signal }) => {
      const res = await fetch(`${getApiUrl()}/api/languages`, { signal });
      if (!res.ok) throw new Error(`languages: ${res.status}`);
      const json = await res.json() as { languages: LanguageIndexEntry[] };
      const languages = [...json.languages].sort((a, b) => b.video_count - a.video_count);
      return { languages, allowedCodes: new Set(languages.map(l => l.code)) };
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}
```

> Verify `getApiUrl` is the correct export from `src/config/api.ts`. If not, match the existing import style used by `useInfiniteVideosFunnelcake`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useLanguagesIndex.test.ts`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLanguagesIndex.ts src/hooks/useLanguagesIndex.test.ts
git commit -m "feat(i18n): add useLanguagesIndex hook for /api/languages"
```

### Task 5: Add `language` filter to `useInfiniteVideosFunnelcake`

**Files:**
- Modify: `src/hooks/useInfiniteVideosFunnelcake.ts`
- Test: `src/hooks/useInfiniteVideosFunnelcake.test.ts` (existing — extend it)

Look at the existing test file first to learn the established pattern for asserting URL parameters; reuse that pattern rather than inventing one.

- [ ] **Step 1: Write the failing test**

Append to `src/hooks/useInfiniteVideosFunnelcake.test.ts`:

```ts
it('passes language to the videos endpoint when set', async () => {
  // setup mirrors existing tests; assert the fetch URL contains `language=es`
  const fetchSpy = vi.fn(async (url) => ({
    ok: true,
    json: async () => ({ videos: [], next_cursor: null }),
  }));
  vi.stubGlobal('fetch', fetchSpy);

  const { result } = renderHook(
    () => useInfiniteVideosFunnelcake({ feedType: 'trending', sortMode: 'hot', language: 'es' }),
    { wrapper /* existing wrapper */ }
  );
  await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

  const url = String(fetchSpy.mock.calls[0][0]);
  expect(url).toMatch(/[?&]language=es(&|$)/);
});

it('omits language when undefined', async () => {
  // mirror above; assert URL does NOT contain `language=`
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts`
Expected: FAIL — `language` is not a known option; URL won't include it.

- [ ] **Step 3: Add `language` to the hook**

In `src/hooks/useInfiniteVideosFunnelcake.ts`:

1. Add `language?: string;` to the options interface near `hashtag?: string;` (around line 23).
2. Destructure it in the function signature (around line 181).
3. Include `language` in the React Query `queryKey` (line 205).
4. Pass `language` into each branch's request building. The simplest implementation: wherever the URL is built, append `&language=${encodeURIComponent(language)}` when defined. Do this consistently for all `feedType` branches that fetch from list endpoints — at minimum `trending`, `recent`, `classics`, `hashtag`, `category`. `home` and `recommendations` are out of scope for prefix mode and should ignore `language`; document this with an inline TODO comment.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useInfiniteVideosFunnelcake.test.ts`
Expected: PASS — including the two new cases. Pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useInfiniteVideosFunnelcake.ts src/hooks/useInfiniteVideosFunnelcake.test.ts
git commit -m "feat(i18n): thread language filter through useInfiniteVideosFunnelcake"
```

### Task 6: Add `language` filter to `useInfiniteSearchVideos`

**Files:**
- Modify: `src/hooks/useInfiniteSearchVideos.ts`
- Test: `src/hooks/useInfiniteSearchVideos.test.ts`

Same pattern as Task 5: append `language?: string` to the hook's options, propagate to fetch URL, ignore when undefined, include in query key.

- [ ] **Step 1: Add a test asserting the URL contains `language=es` when the option is set**
- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): thread language filter through useInfiniteSearchVideos"
```

### Task 7: Add `language` filter to `useSearchHashtags` and `useCategories`

**Files:**
- Modify: `src/hooks/useSearchHashtags.ts`, `src/hooks/useCategories.ts`
- Test: extend existing test files for each (or create fresh per-file tests if none exist)

Both hooks gain the same `language?: string` option, with the same URL behavior. Two passes of the same five-step TDD ritual; commit each separately.

- [ ] **Step 1: Test for `useSearchHashtags` — URL contains `language=`**
- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): thread language filter through useSearchHashtags"
```

- [ ] **Step 6: Repeat for `useCategories`**
- [ ] **Step 7: Commit**

```bash
git commit -m "feat(i18n): thread language filter through useCategories"
```

---

## Chunk 3: Routing — prefix guard + AppRouter wiring

Now the URL grammar becomes real.

### Task 8: `LanguagePrefixGuard` component

**Files:**
- Create: `src/components/language/LanguagePrefixGuard.tsx`
- Test: `src/components/language/LanguagePrefixGuard.test.tsx`

The guard:

1. Reads `:lang` from the URL.
2. Validates it against the live allowlist (from `useLanguagesIndex`) plus a static bootstrap allowlist for cold load.
3. If valid, wraps `<Outlet />` in `<ContentLanguageProvider language={lang}>`.
4. If invalid, navigates to the same URL with the prefix stripped — which lets the existing `/:nip19` catch-all handle it (preserving today's behavior for `/note1...` style links).

Bootstrap allowlist (matches the i18n config in `src/lib/i18n/locales/`):

```ts
const BOOTSTRAP_LANGUAGES = new Set([
  'ar','de','en','es','fil','fr','id','it','ja','ko','nl','pl','pt','ro','sv','tr',
]);
```

- [ ] **Step 1: Write failing tests**

```tsx
// src/components/language/LanguagePrefixGuard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguagePrefixGuard } from './LanguagePrefixGuard';
import { ContentLanguageContext } from '@/contexts/LanguageContext';
import { useContext } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function Probe() {
  const { language } = useContext(ContentLanguageContext);
  return <div data-testid="lang">{language ?? 'none'}</div>;
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path=":lang" element={<LanguagePrefixGuard />}>
            <Route index element={<Probe />} />
          </Route>
          <Route path="/:nip19" element={<div data-testid="fallthrough">fallthrough</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LanguagePrefixGuard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ languages: [] }) })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('accepts a bootstrap language code', () => {
    renderAt('/es');
    expect(screen.getByTestId('lang').textContent).toBe('es');
  });

  it('falls through when the code is unknown', () => {
    renderAt('/note1xyz');
    expect(screen.getByTestId('fallthrough')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/language/LanguagePrefixGuard.test.tsx`
Expected: FAIL — guard not implemented.

- [ ] **Step 3: Implement the guard**

```tsx
// src/components/language/LanguagePrefixGuard.tsx
import { Navigate, Outlet, useParams, useLocation } from 'react-router-dom';
import { ContentLanguageProvider } from '@/contexts/LanguageContext';
import { useLanguagesIndex } from '@/hooks/useLanguagesIndex';

const BOOTSTRAP_LANGUAGES = new Set([
  'ar','de','en','es','fil','fr','id','it','ja','ko','nl','pl','pt','ro','sv','tr',
]);

export function LanguagePrefixGuard() {
  const { lang } = useParams<{ lang: string }>();
  const { pathname, search } = useLocation();
  const { data } = useLanguagesIndex();

  const code = lang?.toLowerCase() ?? '';
  const allowed = data?.allowedCodes ?? BOOTSTRAP_LANGUAGES;

  if (!code || !allowed.has(code)) {
    // Strip the prefix and let the rest of the route table (including /:nip19) handle it.
    const stripped = pathname.replace(/^\/[^/]+/, '') || '/';
    return <Navigate to={stripped + search} replace />;
  }

  return (
    <ContentLanguageProvider language={code}>
      <Outlet />
    </ContentLanguageProvider>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/language/LanguagePrefixGuard.test.tsx`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```bash
git add src/components/language/LanguagePrefixGuard.tsx src/components/language/LanguagePrefixGuard.test.tsx
git commit -m "feat(i18n): add LanguagePrefixGuard for content-language URL prefix"
```

### Task 9: Wire prefix routes into `AppRouter.tsx`

**Files:**
- Modify: `src/AppRouter.tsx`

- [ ] **Step 1: Add prefix routes BEFORE the `/:nip19` catch-all**

Insert immediately after the `<Route path="/leaderboard" />` entry (around line 129), still inside the `<Route element={<AppLayout />}>` block:

```tsx
{/* Content-language prefix. Must come BEFORE /:nip19 catch-all. */}
<Route path=":lang" element={<LanguagePrefixGuard />}>
  <Route index element={<DiscoveryPage />} />
  <Route path="discovery" element={<DiscoveryPage />} />
  <Route path="discovery/:tab" element={<DiscoveryPage />} />
  <Route path="trending" element={<TrendingPage />} />
  <Route path="hashtags" element={<HashtagDiscoveryPage />} />
  <Route path="hashtag/:tag" element={<HashtagPage />} />
  <Route path="category" element={<CategoriesIndexPage />} />
  <Route path="category/:name" element={<CategoryPage />} />
  <Route path="search" element={<SearchPage />} />
  <Route path="leaderboard" element={<LeaderboardPage />} />
</Route>
```

Add the `LanguagePrefixGuard` import at the top.

- [ ] **Step 2: Add `/languages` route**

Add immediately after `/category/:name` (around line 124):

```tsx
<Route path="/languages" element={<LanguagesPage />} />
```

(`LanguagesPage` doesn't exist yet — that's Task 16. Create a placeholder export now if needed: `export function LanguagesPage() { return <div data-testid="languages-page" />; }` so the route compiles.)

- [ ] **Step 3: Verify build passes**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test -- AppRouter`
Expected: PASS for any existing AppRouter tests.

- [ ] **Step 4: Commit**

```bash
git add src/AppRouter.tsx src/pages/Languages.tsx
git commit -m "feat(i18n): wire content-language prefix routes + /languages into AppRouter"
```

---

## Chunk 4: Pages consume language from context

Each affected page reads the active language and passes it to its data hook(s). The pattern is identical across all pages, so this chunk is one task with a per-page checklist.

### Task 10: Page-level integration

**Files (all to modify):**
- `src/pages/DiscoveryPage.tsx`
- `src/pages/HashtagPage.tsx`
- `src/pages/CategoryPage.tsx`
- `src/pages/SearchPage.tsx`
- `src/pages/TrendingPage.tsx`
- `src/pages/HashtagDiscoveryPage.tsx`
- `src/pages/CategoriesIndexPage.tsx`
- `src/pages/LeaderboardPage.tsx`

For each page:

1. Import `useActiveContentLanguage`.
2. Call it once at the top of the component: `const language = useActiveContentLanguage();`.
3. Find every call to `useInfiniteVideosFunnelcake`, `useInfiniteSearchVideos`, `useSearchHashtags`, `useCategories` (whichever the page uses) and pass `language` through.
4. Page-level test: assert that when mounted under a `ContentLanguageProvider language="es"`, the underlying hook is called with `language: 'es'`. Stub the hook with `vi.mock`.

Ritual per page:

- [ ] **Step 1: Add the per-page test**

```tsx
// example for DiscoveryPage; same shape for others
it('passes active content language to its data hook', () => {
  const spy = vi.fn(() => ({ data: undefined, isLoading: true }));
  vi.mocked(useInfiniteVideosFunnelcake).mockImplementation(spy);

  render(
    <ContentLanguageProvider language="es">
      <MemoryRouter initialEntries={['/discovery/hot']}>
        <DiscoveryPage />
      </MemoryRouter>
    </ContentLanguageProvider>
  );

  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ language: 'es' }));
});
```

- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement (one line: add `language` to the call site)**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit, one commit per page**

Suggested commit messages:
```
feat(i18n): DiscoveryPage respects content-language prefix
feat(i18n): HashtagPage respects content-language prefix
feat(i18n): CategoryPage respects content-language prefix
feat(i18n): SearchPage respects content-language prefix
feat(i18n): TrendingPage respects content-language prefix
feat(i18n): HashtagDiscoveryPage respects content-language prefix
feat(i18n): CategoriesIndexPage respects content-language prefix
feat(i18n): LeaderboardPage respects content-language prefix
```

> **Note on LeaderboardPage:** the spec excludes the creator-leaderboard endpoint from the prefix. If `LeaderboardPage` only renders video leaderboards, pass language through. If it has a creator-leaderboard tab, that tab should ignore the prefix; document this with an inline comment.

---

## Chunk 5: Languages index page + banner + sidebar

Now the user-visible surfaces.

### Task 11: `LanguageShowcaseCard` and `LanguageStatCard`

**Files:**
- Create: `src/components/language/LanguageShowcaseCard.tsx`
- Create: `src/components/language/LanguageStatCard.tsx`
- Test: `src/components/language/LanguageCards.test.tsx`

Both are presentation components: take an `entry: LanguageIndexEntry` and render. Showcase shows up to 3 thumbnails; stat card renders no thumbnail. Both link to `/<code>`.

- [ ] **Step 1: Write tests for both cards** — endonym text, English text, video count text, link href.
- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement (use existing `<Card>` brand variant per CLAUDE.md brand rules; remember: no `lucide-react`, no `bg-gradient-*`, no Tailwind `uppercase`).**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): add LanguageShowcaseCard and LanguageStatCard"
```

### Task 12: `Languages.tsx` index page

**Files:**
- Modify (or replace placeholder from Task 9): `src/pages/Languages.tsx`
- Test: `src/pages/Languages.test.tsx`

Layout:
- Page header (`<SectionHeader as="h1">` from `src/components/brand/`).
- `useLanguagesIndex()` for the data.
- Top 6 languages in a `LanguageShowcaseCard` grid.
- Remainder in a `LanguageStatCard` grid.
- The user's preferred UI locale (read from `i18next` if present in the index) gets a `data-your-language` attribute the cards can style.
- Loading skeleton + empty state ("Once people start publishing in different languages, they'll appear here").

- [ ] **Step 1: Test that the page renders showcase cards for the top 6 and stat cards for the rest, and that the user's UI locale is highlighted.**
- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): add /languages index page with showcase + long-tail layout"
```

### Task 13: `LanguageBanner` component

**Files:**
- Create: `src/components/language/LanguageBanner.tsx`
- Test: `src/components/language/LanguageBanner.test.tsx`

Renders only when `useActiveContentLanguage()` returns a value. Shows endonym + a "See all languages" link that strips the prefix from the current `pathname` + `search`. Small chip on mobile, slim banner on desktop.

- [ ] **Step 1: Write tests**

```tsx
it('renders nothing when no language is active', () => { /* ... */ });
it('renders the endonym when a language is active', () => { /* ... */ });
it('strips the prefix from the current URL on click', () => {
  // navigate to /es/hashtag/funny
  // click "See all languages"
  // assert location is now /hashtag/funny
});
```

- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): add LanguageBanner with prefix-strip exit"
```

### Task 14: Mount `LanguageBanner` on each affected page

For each page touched in Task 10, add `<LanguageBanner />` near the top of the rendered content. Single new line per page.

- [ ] **Step 1: For each page, add a test that asserts `<LanguageBanner />` appears when language context is set**
- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Add the import + JSX**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit per page**

```
feat(i18n): show LanguageBanner on DiscoveryPage in prefix mode
feat(i18n): show LanguageBanner on HashtagPage in prefix mode
... (one per page)
```

### Task 15: Sidebar entry

**Files:**
- Modify: `src/components/AppSidebar.tsx`

Add a "Languages" entry in the existing main navigation block (around line 174 — `{/* Main Navigation */}`). Keep it under the existing pattern; use a Phosphor icon (e.g. `<Globe weight="bold" />`) per CLAUDE.md brand rules.

- [ ] **Step 1: Test that the sidebar contains a "Languages" link to `/languages` when the appropriate i18n key resolves**
- [ ] **Step 2: Run — fail**
- [ ] **Step 3: Implement (and add the i18n string `nav.languages` to `src/lib/i18n/locales/en/common.json` plus the other locale files — match existing nav-key structure)**
- [ ] **Step 4: Run — pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(i18n): add Languages entry to AppSidebar nav"
```

---

## Chunk 6: End-to-end + polish

### Task 16: Playwright walk

**Files:**
- Create: `tests/e2e/language-feeds.spec.ts`

Walk:
1. Navigate to `/`.
2. Click the "Languages" sidebar entry → expect URL `/languages`.
3. Click the showcase card for any non-English language present in the test fixture → expect URL `/<code>`.
4. Verify the `<LanguageBanner />` appears.
5. Navigate to `/<code>/hashtag/<some-tag>` directly → expect feed renders, banner present.
6. Click the "See all languages" link in the banner → expect URL `/hashtag/<some-tag>` (prefix stripped).
7. Navigate to `/zz/discovery/hot` (unknown code) → expect URL to land where `/discovery/hot` would (prefix stripped via guard fallthrough).

- [ ] **Step 1: Write the test**
- [ ] **Step 2: Run against the dev server**

Run: `npx playwright test tests/e2e/language-feeds.spec.ts`
Expected: PASS — assuming the local Funnelcake config is reachable or the test mocks API responses.

- [ ] **Step 3: Commit**

```bash
git commit -m "test(i18n): e2e Playwright walk through content-language URL grammar"
```

### Task 17: Mobile layout pass

- [ ] **Step 1: Open the dev server, browse `/languages` at mobile viewport (<1024px), verify showcase cards stack and long-tail becomes a 2-column grid**
- [ ] **Step 2: Verify `<LanguageBanner />` collapses to a small chip on mobile (per spec)**
- [ ] **Step 3: Adjust styles only as needed; commit**

```bash
git commit -m "style(i18n): mobile layout polish for /languages and LanguageBanner"
```

### Task 18: Verification + code review

- [ ] **Step 1: Full test suite green**

Run: `npm test`
Expected: PASS — no new failures.

- [ ] **Step 2: Type-check clean**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Lint clean**

Run: `npm run lint` (if present)
Expected: PASS.

- [ ] **Step 4: Visual + a11y baseline**

Run: `npx playwright test tests/visual/`
Expected: PASS or new baselines reviewed and committed.

- [ ] **Step 5: Use @superpowers:requesting-code-review on the branch**

---

## Acceptance Criteria

Before merging:

- `/languages` renders the index with at least the showcase row populated for any language with `video_count >= 1`.
- `/<lang>/discovery/hot`, `/<lang>/hashtag/<tag>`, `/<lang>/search?q=...`, `/<lang>/trending`, `/<lang>/leaderboard`, `/<lang>/category/<name>` all render their respective pages with content filtered to `<lang>`.
- The `<LanguageBanner />` shows the endonym and offers a working exit on every prefix-mode page.
- An unknown-code prefix falls through cleanly to the existing route table without a hard error.
- All Funnelcake list endpoints called by affected pages include `language=<code>` in their query string when in prefix mode, and omit it otherwise.
- Sidebar has a working "Languages" entry.
- Test suite is green; no console errors when navigating between prefix and non-prefix variants.

## Out of Scope (do not do these in this PR series)

- Geography (country/region) filtering — separate proposal.
- Per-language UI translation triggered by the prefix — UI locale is independent.
- Language filtering on `/profile/:npub`, `/video/:id`, `/event/:eventId`, `/u/:userId` — these are not feed-shaped.
- Multi-language combined filters (`/es+pt/...`) — single language per prefix.
- Funnelcake backend changes — separate plan in divine-funnelcake repo.

## Branch / Worktree Note

This plan is designed to be executed on a clean branch dedicated to language-content-feeds. The current working tree is on `feat/i18n-filipino` with unrelated translation work in flight; switch branches or create a worktree before executing. See @superpowers:using-git-worktrees.

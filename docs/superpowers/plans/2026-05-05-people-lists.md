# People Lists Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add NIP-51 people-list (follow set, kind 30000) support with full CRUD, unified discovery, public list-detail surfaces, profile/sidebar/search/discovery integration, and saved-list (kind 30003) persistence.

**Architecture:** Mirror the existing kind-30005 video-list infrastructure with a parallel `usePeopleLists` family. Extend two cross-cutting touchpoints (`LIST_KINDS` multi-relay set; `ListDetailPage` kinds query) so the detail route auto-dispatches by kind. Introduce a `Tabs` primitive on `ProfilePage` (none today) and a new Lists section in `AppSidebar` (none today). Cards on discovery surfaces are kind-polymorphic via a small `UnifiedListCard`. Stats aggregate via `POST /api/users/bulk` (≤200 members; show `—` above).

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, TanStack Query 5, `@nostrify/react`, `@phosphor-icons/react`, Tailwind, shadcn/ui.

**TDD step template — apply to every task in this plan, including the condensed ones.** Some later tasks abbreviate as "Test, implement, commit" for brevity. Expand them to this template literally:

1. **Write the failing test.** Concrete `it(…)` block(s) covering the visible behavior.
2. **Run it to verify it fails.** `npx vitest run <test-file-path>`. Expected: FAIL — record the failure message.
3. **Implement the minimum code to make it pass.**
4. **Run it to verify it passes.** Same command. Expected: PASS.
5. **Run any neighboring tests** that could regress (e.g. modifying `ProfilePage` → also run `ProfilePage.test.tsx`).
6. **Commit** with the message shown.

If a task says "Step 1-3: test, implement, commit," it means the above six steps still apply — don't take it literally as 3 steps.

**Required pre-reading:**
- `docs/superpowers/specs/2026-05-05-people-lists-design.md` (this plan implements that spec)
- `CLAUDE.md` (project conventions, Nostr essentials, brand rules)
- `divine-context` skill (cross-repo handbook)
- Existing patterns: `src/hooks/useVideoLists.ts`, `src/components/CreateListDialog.tsx`, `src/components/AddToListDialog.tsx`, `src/pages/ListDetailPage.tsx`, `src/lib/eventRouting.ts`, `src/components/NostrProvider.tsx`

**Brand guardrails to obey** (tested by `tests/brand/*`):
- No `uppercase` Tailwind class — use `<SectionHeader>` for headings
- No `lucide-react` imports — use `@phosphor-icons/react` (`bold` weight default; `fill` for active states)
- No `bg-gradient-*` / `linear-gradient(` / `radial-gradient(` on layout surfaces
- Voice: casual-direct ("Nada. Try something different?" not "No results found")

**Brand primitives to use** (don't roll your own):
- `<Card variant="brand" accent="green|pink|violet|orange|yellow|blue|dark">` for `<PeopleListCard>` — accent rotates per surface (green default, pink trending, violet classics)
- `<SectionHeader as="h1|h2|h3">` for all headings (throws in dev if className contains `uppercase`)
- `<Button variant="sticker">` for hero CTAs (Follow, Save, Create new list)
- Brand utilities: `brand-card`, `brand-sticker`, `brand-offset-shadow-*`, `brand-tilt-neg-3`, `brand-tilt-pos-2`

**Responsive (per CLAUDE.md memory + Mobile Responsive Redesign):**
- `< lg` (1024px) is mobile: dark theme is forced via the `@media (max-width: 1023px)` rule already in `src/styles/`. New surfaces inherit this — don't fight it.
- `≥ lg` shows `AppSidebar`; mobile hides it and shows the bottom nav.
- 2-col card grids on mobile, 4-col on desktop (`grid-cols-2 lg:grid-cols-4`).
- List-detail body constrained to `max-w-3xl` (~720px) on `≥ lg` to leave room for sidebar context.
- A11y: `tests/visual/a11y.spec.ts` runs axe-core on `/`, `/discovery`, `/search`, `/__brand-preview` — extend it (Task 8.4) to also cover the new list-detail routes.

---

## Chunk 1: Foundation — types, helpers, prerequisite refactors

This chunk is pure refactor + new helpers. No user-visible features yet. Each step is committable.

### Task 1.1: Add `PeopleList` type and parser

**Files:**
- Create: `src/types/peopleList.ts`
- Create: `src/types/peopleList.test.ts`

- [ ] **Step 1: Write failing test for `parsePeopleList`**

```ts
// src/types/peopleList.test.ts
import { describe, it, expect } from 'vitest';
import { parsePeopleList } from './peopleList';
import type { NostrEvent } from '@nostrify/nostrify';

const PUBKEY = 'a'.repeat(64);
const MEMBER_A = 'b'.repeat(64);
const MEMBER_B = 'c'.repeat(64);

function makeEvent(tags: string[][], created_at = 1000): NostrEvent {
  return {
    id: 'x'.repeat(64),
    kind: 30000,
    pubkey: PUBKEY,
    created_at,
    tags,
    content: '',
    sig: 'y'.repeat(128),
  };
}

describe('parsePeopleList', () => {
  it('returns null when no d-tag', () => {
    expect(parsePeopleList(makeEvent([['title', 'X']]))).toBeNull();
  });

  it('parses minimal event', () => {
    const list = parsePeopleList(makeEvent([['d', 'close-friends']]));
    expect(list).toEqual({
      id: 'close-friends',
      pubkey: PUBKEY,
      name: 'close-friends', // falls back to d-tag
      description: undefined,
      image: undefined,
      members: [],
      createdAt: 1000,
    });
  });

  it('parses full event with members', () => {
    const list = parsePeopleList(makeEvent([
      ['d', 'team'],
      ['title', 'Divine Team'],
      ['description', 'the crew'],
      ['image', 'https://example/cover.png'],
      ['p', MEMBER_A],
      ['p', MEMBER_B],
      ['p', 'invalid'],          // dropped: not 64 hex
      ['p', MEMBER_A],            // dropped: dedupe
    ]));
    expect(list?.members).toEqual([MEMBER_A, MEMBER_B]);
    expect(list?.name).toBe('Divine Team');
    expect(list?.description).toBe('the crew');
    expect(list?.image).toBe('https://example/cover.png');
  });
});
```

- [ ] **Step 2: Verify it fails**

```
npx vitest run src/types/peopleList.test.ts
```
Expected: FAIL — `parsePeopleList is not a function` (file doesn't exist).

- [ ] **Step 3: Write the type and parser**

```ts
// src/types/peopleList.ts
import type { NostrEvent } from '@nostrify/nostrify';

export const PEOPLE_LIST_KIND = 30000;

export interface PeopleList {
  id: string;            // d-tag
  pubkey: string;        // owner
  name: string;          // title tag, falls back to id
  description?: string;
  image?: string;
  members: string[];     // hex pubkeys, deduped
  createdAt: number;
}

const HEX64 = /^[0-9a-f]{64}$/i;

export function parsePeopleList(event: NostrEvent): PeopleList | null {
  if (event.kind !== PEOPLE_LIST_KIND) return null;
  const dTag = event.tags.find(t => t[0] === 'd')?.[1];
  if (!dTag) return null;

  const seen = new Set<string>();
  const members: string[] = [];
  for (const t of event.tags) {
    if (t[0] !== 'p') continue;
    const pk = t[1];
    if (!pk || !HEX64.test(pk) || seen.has(pk)) continue;
    seen.add(pk);
    members.push(pk);
  }

  return {
    id: dTag,
    pubkey: event.pubkey,
    name: event.tags.find(t => t[0] === 'title')?.[1] || dTag,
    description: event.tags.find(t => t[0] === 'description')?.[1],
    image: event.tags.find(t => t[0] === 'image')?.[1],
    members,
    createdAt: event.created_at,
  };
}

export function peopleListAddressableId(pubkey: string, dTag: string): string {
  return `${PEOPLE_LIST_KIND}:${pubkey}:${dTag}`;
}
```

- [ ] **Step 4: Verify it passes**

```
npx vitest run src/types/peopleList.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/peopleList.ts src/types/peopleList.test.ts
git commit -m "feat(types): add PeopleList type and parser (kind 30000)"
```

### Task 1.2: Extend `eventRouting.ts` with people-list path helpers

**Files:**
- Modify: `src/lib/eventRouting.ts` (currently 74 lines; `buildListPath` at lines 27-29)
- Modify: `src/lib/eventRouting.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/eventRouting.test.ts`:

```ts
import {
  buildListPath,
  buildListMembersPath,
  buildListVideosPath,
  buildListEditPath,
  decodeListIdParam,
} from './eventRouting';

describe('list path helpers', () => {
  const PK = 'a'.repeat(64);

  it('encodes special characters in d-tag', () => {
    expect(buildListPath(PK, 'with/slash')).toBe(`/list/${PK}/with%2Fslash`);
  });

  it('builds members path', () => {
    expect(buildListMembersPath(PK, 'team')).toBe(`/list/${PK}/team/members`);
  });

  it('builds videos path', () => {
    expect(buildListVideosPath(PK, 'team')).toBe(`/list/${PK}/team/videos`);
  });

  it('builds edit path', () => {
    expect(buildListEditPath(PK, 'team')).toBe(`/list/${PK}/team/edit`);
  });

  it('decodeListIdParam round-trips encoded d-tag', () => {
    expect(decodeListIdParam('with%2Fslash')).toBe('with/slash');
  });
});
```

- [ ] **Step 2: Verify it fails**

```
npx vitest run src/lib/eventRouting.test.ts
```
Expected: FAIL — `buildListMembersPath is not a function`.

- [ ] **Step 3: Implement helpers**

In `src/lib/eventRouting.ts`, after the existing `buildListPath`, add:

```ts
export function buildListMembersPath(pubkey: string, dTag: string): string {
  return `${buildListPath(pubkey, dTag)}/members`;
}

export function buildListVideosPath(pubkey: string, dTag: string): string {
  return `${buildListPath(pubkey, dTag)}/videos`;
}

export function buildListEditPath(pubkey: string, dTag: string): string {
  return `${buildListPath(pubkey, dTag)}/edit`;
}

export function decodeListIdParam(raw: string): string {
  try { return decodeURIComponent(raw); } catch { return raw; }
}
```

- [ ] **Step 4: Verify it passes**

```
npx vitest run src/lib/eventRouting.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/eventRouting.ts src/lib/eventRouting.test.ts
git commit -m "feat(routing): add people-list sub-route path helpers"
```

### Task 1.3: Add 30003 to `LIST_KINDS` multi-relay publish set

**Files:**
- Modify: `src/components/NostrProvider.tsx:142`

- [ ] **Step 1: Inspect current value**

```bash
grep -n "LIST_KINDS" src/components/NostrProvider.tsx
```
Expected: line 142 reads `const LIST_KINDS = [30000, 30001, 30005];`

- [ ] **Step 2: Edit**

Change `[30000, 30001, 30005]` → `[30000, 30001, 30003, 30005]`. Update the inline comment to mention 30003 (saved lists / NIP-51 bookmark sets) alongside the existing kinds.

- [ ] **Step 3: Verify type-check**

```
npx tsc --noEmit
```
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/NostrProvider.tsx
git commit -m "fix(nostr): publish kind 30003 to multi-relay LIST_KINDS set"
```

### Task 1.4: Drive-by — fix missing `k` tag in `useDeleteVideoList`

**Files:**
- Modify: `src/hooks/useVideoLists.ts:520-532`
- Modify: `src/hooks/useVideoLists.test.ts` (or add new test file if absent)

- [ ] **Step 1: Add a failing test**

If `src/hooks/useVideoLists.test.ts` doesn't exist, create it. Otherwise append:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteVideoList } from './useVideoLists';

const mockPublish = vi.fn();
vi.mock('./useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: mockPublish }),
}));
vi.mock('./useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'a'.repeat(64) } }),
}));
vi.mock('@nostrify/react', () => ({ useNostr: () => ({ nostr: {} }) }));

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useDeleteVideoList', () => {
  beforeEach(() => mockPublish.mockReset());

  it('publishes kind 5 with both a and k tags', async () => {
    mockPublish.mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteVideoList(), { wrapper: wrap });
    await result.current.mutateAsync({ listId: 'my-list' });
    expect(mockPublish).toHaveBeenCalledTimes(1);
    const evt = mockPublish.mock.calls[0][0];
    expect(evt.kind).toBe(5);
    expect(evt.tags).toContainEqual(['a', `30005:${'a'.repeat(64)}:my-list`]);
    expect(evt.tags).toContainEqual(['k', '30005']);
  });
});
```

- [ ] **Step 2: Verify it fails**

```
npx vitest run src/hooks/useVideoLists.test.ts
```
Expected: FAIL — `k` tag missing.

- [ ] **Step 3: Fix the hook**

In `src/hooks/useVideoLists.ts`, lines 528-532, change:

```ts
tags: [
  ['a', `30005:${user.pubkey}:${listId}`],
]
```

to:

```ts
tags: [
  ['a', `30005:${user.pubkey}:${listId}`],
  ['k', '30005'],
]
```

- [ ] **Step 4: Verify it passes**

```
npx vitest run src/hooks/useVideoLists.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVideoLists.ts src/hooks/useVideoLists.test.ts
git commit -m "fix(lists): include k tag in NIP-09 kind 5 deletion (NIP-09 conformance)"
```

### Task 1.5: Refactor `ListDetailPage` to support kind 30000 + 30005

**Files:**
- Modify: `src/pages/ListDetailPage.tsx:274` (kinds query)
- The route render branch (`<VideoListContent />` vs `<PeopleListDetailContent />`) is added in Chunk 6; for now this task is just the kinds-query widening so existing video-list paths keep working when a kind 30000 event happens to share a d-tag.

- [ ] **Step 1: Inspect**

```bash
grep -n "kinds: \[30005\]" src/pages/ListDetailPage.tsx
```
Expected: line 274 (or thereabouts).

- [ ] **Step 2: Edit**

Change `kinds: [30005]` → `kinds: [30000, 30005]` in the relay query. Add a comment noting kind 30000 detail rendering is wired up in Chunk 6; for this commit, parsing falls back through `parseVideoList` and renders nothing for kind 30000 events (acceptable interim — feature flag effectively off until Chunk 6).

- [ ] **Step 3: Verify existing tests pass**

```
npx vitest run src/pages/ListDetailPage.test.tsx
```
Expected: PASS (no behavior change for kind 30005).

- [ ] **Step 4: Commit**

```bash
git add src/pages/ListDetailPage.tsx
git commit -m "refactor(list-detail): widen relay query to kind 30000+30005"
```

---

## Chunk 2: Read hooks — fetching people lists and aggregates

### Task 2.1: `usePeopleLists(pubkey)` — fetch all kind-30000 events for a user

**Files:**
- Create: `src/hooks/usePeopleLists.ts`
- Create: `src/hooks/usePeopleLists.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// src/hooks/usePeopleLists.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleLists } from './usePeopleLists';

const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { query: mockQuery } }),
}));

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PK = 'a'.repeat(64);
const MEMBER = 'b'.repeat(64);

describe('usePeopleLists', () => {
  beforeEach(() => mockQuery.mockReset());

  it('parses and dedupes by d-tag, keeping latest', async () => {
    mockQuery.mockResolvedValue([
      { id: '1', kind: 30000, pubkey: PK, created_at: 100, sig: '', content: '',
        tags: [['d', 'a'], ['title', 'old']] },
      { id: '2', kind: 30000, pubkey: PK, created_at: 200, sig: '', content: '',
        tags: [['d', 'a'], ['title', 'new'], ['p', MEMBER]] },
      { id: '3', kind: 30000, pubkey: PK, created_at: 150, sig: '', content: '',
        tags: [['d', 'b']] },
    ]);
    const { result } = renderHook(() => usePeopleLists(PK), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    const a = result.current.data!.find(l => l.id === 'a')!;
    expect(a.name).toBe('new');
    expect(a.members).toEqual([MEMBER]);
  });

  it('returns empty array when no events', async () => {
    mockQuery.mockResolvedValue([]);
    const { result } = renderHook(() => usePeopleLists(PK), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('skips when pubkey is empty', () => {
    const { result } = renderHook(() => usePeopleLists(''), { wrapper: wrap });
    expect(result.current.isFetching).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify it fails**

```
npx vitest run src/hooks/usePeopleLists.test.ts
```

- [ ] **Step 3: Implement**

```ts
// src/hooks/usePeopleLists.ts
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';

export function usePeopleLists(pubkey: string | undefined) {
  const { nostr } = useNostr();
  return useQuery<PeopleList[]>({
    queryKey: ['people-lists', pubkey],
    enabled: !!pubkey,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [PEOPLE_LIST_KIND], authors: [pubkey!], limit: 100 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );
      // Dedupe by d-tag, keep latest created_at
      const byD = new Map<string, typeof events[number]>();
      for (const evt of events) {
        const d = evt.tags.find(t => t[0] === 'd')?.[1];
        if (!d) continue;
        const existing = byD.get(d);
        if (!existing || evt.created_at > existing.created_at) byD.set(d, evt);
      }
      return Array.from(byD.values())
        .map(parsePeopleList)
        .filter((l): l is PeopleList => l !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    staleTime: 60_000,
    gcTime: 300_000,
  });
}
```

- [ ] **Step 4: Verify it passes**

```
npx vitest run src/hooks/usePeopleLists.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePeopleLists.ts src/hooks/usePeopleLists.test.ts
git commit -m "feat(hooks): add usePeopleLists for fetching authored people lists"
```

### Task 2.2: `usePeopleList(pubkey, dTag)` — fetch single list

**Files:**
- Create: `src/hooks/usePeopleList.ts`
- Create: `src/hooks/usePeopleList.test.ts`

- [ ] **Step 1: Test (one event matching `pubkey + d`, returns parsed; two events, returns latest; missing returns null)**

Pattern mirrors Task 2.1. Single filter `{ kinds: [30000], authors: [pubkey], '#d': [dTag], limit: 1 }`. Sort by `created_at` desc, return first parsed.

- [ ] **Step 2: Implement** in same shape as 2.1.

- [ ] **Step 3: Run tests, commit**

```bash
git add src/hooks/usePeopleList.ts src/hooks/usePeopleList.test.ts
git commit -m "feat(hooks): add usePeopleList for single-list fetch"
```

### Task 2.3: `usePeopleListMembers` — resolve member pubkeys to profiles

**Files:**
- Create: `src/hooks/usePeopleListMembers.ts`
- Create: `src/hooks/usePeopleListMembers.test.ts`

- [ ] **Step 1: Test it composes `usePeopleList` + `useBatchedAuthors`** (existing hook in `src/hooks/useBatchedAuthors.ts`).

- [ ] **Step 2: Implement** — return `{ members: Array<{ pubkey: string; metadata?: NostrMetadata }>, isLoading, isError }`.

```ts
import { usePeopleList } from './usePeopleList';
import { useBatchedAuthors } from './useBatchedAuthors';

export function usePeopleListMembers(pubkey: string | undefined, dTag: string | undefined) {
  const list = usePeopleList(pubkey, dTag);
  const memberPubkeys = list.data?.members ?? [];
  const authors = useBatchedAuthors(memberPubkeys);
  return {
    members: memberPubkeys.map(pk => ({
      pubkey: pk,
      metadata: authors.data?.[pk],
    })),
    isLoading: list.isLoading || authors.isLoading,
    isError: list.isError || authors.isError,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(hooks): add usePeopleListMembers (list + batched profiles)"
```

### Task 2.4: `usePeopleListStats` — aggregate members + videos

**Files:**
- Create: `src/hooks/usePeopleListStats.ts`
- Create: `src/hooks/usePeopleListStats.test.ts`

**Reality check (per spec review and codebase verification at `src/lib/funnelcakeClient.ts:1014-1036`):** The `POST /api/users/bulk` response only includes `stats.video_count` per user — `total_loops` is **not** in this endpoint's response shape. v1 ships **members + videos only**; the loops aggregate is deferred (would require N per-user requests via `fetchUserLoopStats` at line 871, which we'll consider only if needed). The header renders loops as `—` always for v1; spec line 261 ("> 200 members") cap also stays.

The exact existing helper is `fetchBulkUsers(apiUrl, pubkeys, signal?)` (NOT `fetchUsersBulk`). Existing call site for reference: `src/hooks/useBatchedAuthors.ts:54`.

- [ ] **Step 1: Tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePeopleListStats } from './usePeopleListStats';

vi.mock('./usePeopleList', () => ({
  usePeopleList: vi.fn(),
}));
vi.mock('@/lib/funnelcakeHealth', () => ({
  isFunnelcakeAvailable: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/funnelcakeClient', () => ({
  fetchBulkUsers: vi.fn(),
}));

import { usePeopleList } from './usePeopleList';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { fetchBulkUsers } from '@/lib/funnelcakeClient';

function wrap({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PK = 'a'.repeat(64);
const M = (i: number) => String(i).repeat(64).slice(0, 64);

describe('usePeopleListStats', () => {
  beforeEach(() => {
    vi.mocked(usePeopleList).mockReset();
    vi.mocked(fetchBulkUsers).mockReset();
    vi.mocked(isFunnelcakeAvailable).mockReturnValue(true);
  });

  it('sums video_count for ≤200 members', async () => {
    vi.mocked(usePeopleList).mockReturnValue({
      data: { id: 'x', pubkey: PK, name: 'x', members: [M(1), M(2)], createdAt: 0 },
      isSuccess: true,
    } as any);
    vi.mocked(fetchBulkUsers).mockResolvedValue({
      users: [
        { pubkey: M(1), stats: { video_count: 10 } },
        { pubkey: M(2), stats: { video_count: 5 } },
      ],
      missing: [],
    } as any);
    const { result } = renderHook(() => usePeopleListStats(PK, 'x'), { wrapper: wrap });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ members: 2, videos: 15, loops: null });
  });

  it('returns null videos when >200 members (no fetch)', async () => {
    const big = Array.from({ length: 201 }, (_, i) => M(i + 1));
    vi.mocked(usePeopleList).mockReturnValue({
      data: { id: 'x', pubkey: PK, name: 'x', members: big, createdAt: 0 },
      isSuccess: true,
    } as any);
    const { result } = renderHook(() => usePeopleListStats(PK, 'x'), { wrapper: wrap });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ members: 201, videos: null, loops: null });
    expect(fetchBulkUsers).not.toHaveBeenCalled();
  });

  it('returns null videos when REST is unhealthy', async () => {
    vi.mocked(isFunnelcakeAvailable).mockReturnValue(false);
    vi.mocked(usePeopleList).mockReturnValue({
      data: { id: 'x', pubkey: PK, name: 'x', members: [M(1)], createdAt: 0 },
      isSuccess: true,
    } as any);
    const { result } = renderHook(() => usePeopleListStats(PK, 'x'), { wrapper: wrap });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ members: 1, videos: null, loops: null });
    expect(fetchBulkUsers).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify it fails**

```
npx vitest run src/hooks/usePeopleListStats.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/hooks/usePeopleListStats.ts
import { useQuery } from '@tanstack/react-query';
import { usePeopleList } from './usePeopleList';
import { isFunnelcakeAvailable } from '@/lib/funnelcakeHealth';
import { fetchBulkUsers } from '@/lib/funnelcakeClient';
import { API_CONFIG } from '@/config/api';

const MAX_AGGREGATE_MEMBERS = 200;

export interface PeopleListStats {
  members: number;
  videos: number | null;  // null = unknown (too many members or REST unhealthy)
  loops: number | null;   // always null in v1; aggregation deferred
}

export function usePeopleListStats(pubkey: string | undefined, dTag: string | undefined) {
  const list = usePeopleList(pubkey, dTag);
  const memberPubkeys = list.data?.members ?? [];
  const apiUrl = API_CONFIG.funnelcake.baseUrl;
  const restOk = isFunnelcakeAvailable(apiUrl);
  const tooMany = memberPubkeys.length > MAX_AGGREGATE_MEMBERS;
  const useFetch = list.isSuccess && memberPubkeys.length > 0 && !tooMany && restOk;

  return useQuery<PeopleListStats>({
    queryKey: ['people-list-stats', pubkey, dTag, memberPubkeys.length, restOk],
    enabled: list.isSuccess,
    queryFn: async ({ signal }) => {
      if (!useFetch) {
        return { members: memberPubkeys.length, videos: null, loops: null };
      }
      const response = await fetchBulkUsers(apiUrl, memberPubkeys, signal);
      let videos = 0;
      for (const u of response.users) videos += u.stats?.video_count ?? 0;
      return { members: memberPubkeys.length, videos, loops: null };
    },
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 4: Verify it passes**

```
npx vitest run src/hooks/usePeopleListStats.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePeopleListStats.ts src/hooks/usePeopleListStats.test.ts
git commit -m "feat(hooks): add usePeopleListStats (members + videos; loops deferred)"
```

### Task 2.5: `usePeopleListMemberVideos` — aggregated video feed

**Files:**
- Create: `src/hooks/usePeopleListMemberVideos.ts`
- Create: `src/hooks/usePeopleListMemberVideos.test.ts`

Preferred path: `POST /api/videos/bulk` with `from_event: { kind: 30000, pubkey, d_tag }` (per CLAUDE.md REST §). If that endpoint doesn't recognize kind 30000 or REST is unhealthy, fall back to a relay query: `{ kinds: [34236], authors: list.members, limit: 50 }` paginated by `until` cursor.

- [ ] **Step 1: Tests** — REST path success, REST 404 → relay fallback, empty member list returns empty.

- [ ] **Step 2: Implement** as `useInfiniteQuery` mirroring `useInfiniteVideosFunnelcake`. Cap first page at 500 results.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(hooks): add usePeopleListMemberVideos (REST → relay fallback)"
```

---

## Chunk 3: Mutations — create / edit / add / remove / delete

### Task 3.1: `useCreatePeopleList`

**Files:**
- Create: `src/hooks/useCreatePeopleList.ts`
- Create: `src/hooks/useCreatePeopleList.test.ts`

Mirror `useCreateVideoList` shape. `mutationFn` accepts `{ name, description?, image?, members?: string[] }`, generates a `d` tag using `crypto.randomUUID()`, publishes kind 30000 with `tags: [['d', id], ['title', name], ...optional, ...members.map(p => ['p', p])]`, content `''`. `onSuccess` optimistically prepends to `['people-lists', user.pubkey]` and invalidates.

- [ ] **Step 1: Tests** — happy path; "Must be logged in" error when no user.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(hooks): add useCreatePeopleList (kind 30000 publish)"
```

### Task 3.2: `useUpdatePeopleList` — edit metadata only

**Files:**
- Create: `src/hooks/useUpdatePeopleList.ts`
- Create: `src/hooks/useUpdatePeopleList.test.ts`

`mutationFn({ listId, name?, description?, image? })`: fetch current event, rebuild tags preserving all `p` tags, swap title/description/image, republish.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(hooks): add useUpdatePeopleList (metadata edit)"
```

### Task 3.3: `useAddToPeopleList` + `useRemoveFromPeopleList` (optimistic)

**Files:**
- Create: `src/hooks/usePeopleListMutations.ts` (both hooks share helpers)
- Create: `src/hooks/usePeopleListMutations.test.ts`

`useAddToPeopleList({ listId, memberPubkey })`:
1. Read current cache `['people-list', user.pubkey, listId]`.
2. If member already present, no-op.
3. Optimistically `setQueryData` with `members: [...members, memberPubkey]`.
4. Republish full event with appended `['p', memberPubkey]`.
5. On error: rollback cached value to pre-mutation snapshot.
6. On success: invalidate `['people-lists', user.pubkey]` and `['people-list', user.pubkey, listId]`.

`useRemoveFromPeopleList` is symmetric: filter out, republish.

- [ ] **Step 1: Tests** — add to fresh list publishes with all `p` tags + new one; remove drops it; rollback on publish failure restores cache; double-add is idempotent (no second publish).

- [ ] **Step 2: Implement**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(hooks): add useAddToPeopleList / useRemoveFromPeopleList with optimistic updates"
```

### Task 3.4: `useDeletePeopleList`

**Files:**
- Create: `src/hooks/useDeletePeopleList.ts`
- Create: `src/hooks/useDeletePeopleList.test.ts`

NIP-09 kind 5 publish with **both** `['a', '30000:pubkey:listId']` AND `['k', '30000']` (per spec, conformance fix). `onSuccess` invalidates BOTH:
- `['people-lists', user.pubkey]` (collection cache from Task 2.1)
- `['people-list', user.pubkey, listId]` (single-list cache from Task 2.2)

…and optimistically drops the list from the collection cache.

- [ ] **Step 1: Failing test** asserts both `a` and `k` tags are present in the published event, mirroring Task 1.4 exactly.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useDeletePeopleList.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(hooks): add useDeletePeopleList (NIP-09 with k tag)"
```

---

## Chunk 4: Saved-lists (kind 30003)

### Task 4.1: `useSavedLists` — read raw addressable IDs

**Files:**
- Create: `src/hooks/useSavedLists.ts`
- Create: `src/hooks/useSavedLists.test.ts`

Query `{ kinds: [30003], authors: [user.pubkey], '#d': ['saved-lists'], limit: 1 }`. Parse `a` tags, return `Array<{ kind: 30000 | 30005; pubkey: string; dTag: string }>`. Skips malformed `a` values; ignores `a` tags whose kind is not 30000 or 30005.

This hook returns *raw IDs only*. Resolving the IDs to actual list events happens in `useResolvedSavedLists` (Task 4.1.5) — that's where stale-reference filtering occurs.

- [ ] **Step 1: Failing test** — empty event returns `[]`; valid event returns parsed; non-list kinds dropped; malformed `a` values dropped.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useSavedLists.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(hooks): add useSavedLists (raw kind 30003 read)"
```

### Task 4.1.5: `useResolvedSavedLists` — resolve IDs to live list events

**Files:**
- Create: `src/hooks/useResolvedSavedLists.ts`
- Create: `src/hooks/useResolvedSavedLists.test.ts`

Composes `useSavedLists()` and dispatches per-ID relay queries (`{ kinds: [k], authors: [pubkey], '#d': [dTag], limit: 1 }`) for each saved reference. Drops references that resolve to nothing OR whose latest event is a kind 5 deletion. Returns `{ video: VideoList[]; people: PeopleList[]; isLoading; isError }`.

This is the resolver the spec line 216 ("attempt to resolve each saved `a` tag … filtered out") promises. The sidebar Saved subgroup and the `/lists` Saved tab both consume this hook.

```ts
// Sketch:
import { useQueries } from '@tanstack/react-query';
import { useSavedLists } from './useSavedLists';
import { useNostr } from '@nostrify/react';
import { parsePeopleList, PEOPLE_LIST_KIND } from '@/types/peopleList';
import { parseVideoList } from './useVideoLists'; // export this if not already

const VIDEO_LIST_KIND = 30005;

export function useResolvedSavedLists() {
  const { nostr } = useNostr();
  const saved = useSavedLists();
  const refs = saved.data ?? [];

  const queries = useQueries({
    queries: refs.map((r) => ({
      queryKey: ['saved-list-resolved', r.kind, r.pubkey, r.dTag],
      enabled: !!nostr,
      staleTime: 60_000,
      queryFn: async ({ signal }) => {
        const events = await nostr.query(
          [{ kinds: [r.kind], authors: [r.pubkey], '#d': [r.dTag], limit: 1 }],
          { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
        );
        if (events.length === 0) return null;
        const evt = events[0];
        if (evt.kind === PEOPLE_LIST_KIND) return { kind: 30000 as const, list: parsePeopleList(evt) };
        if (evt.kind === VIDEO_LIST_KIND) return { kind: 30005 as const, list: parseVideoList(evt) };
        return null;
      },
    })),
  });

  const people = queries
    .map(q => q.data)
    .filter((d): d is { kind: 30000; list: ReturnType<typeof parsePeopleList> } => d?.kind === 30000 && d.list !== null)
    .map(d => d.list!);
  const video = queries
    .map(q => q.data)
    .filter((d): d is { kind: 30005; list: ReturnType<typeof parseVideoList> } => d?.kind === 30005 && d.list !== null)
    .map(d => d.list!);

  return {
    people,
    video,
    isLoading: saved.isLoading || queries.some(q => q.isLoading),
    isError: saved.isError || queries.some(q => q.isError),
  };
}
```

NOTE: `parseVideoList` is currently a private (non-exported) helper in `src/hooks/useVideoLists.ts`. As part of this task, **export it** so this resolver can call it. (Two-line change to `useVideoLists.ts`.)

- [ ] **Step 1: Failing test** — given mocked `useSavedLists` with 2 refs (one resolves, one returns empty events), `useResolvedSavedLists` returns only the one that resolved.
- [ ] **Step 2: Run** `npx vitest run src/hooks/useResolvedSavedLists.test.ts`. Expected: FAIL.
- [ ] **Step 3: Export `parseVideoList`** from `src/hooks/useVideoLists.ts` (`function` → `export function`).
- [ ] **Step 4: Implement** `useResolvedSavedLists`.
- [ ] **Step 5: Run** same command. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(hooks): add useResolvedSavedLists with stale-reference filtering"
```

### Task 4.2: `useSaveList` / `useUnsaveList` — mutate

**Files:**
- Create: `src/hooks/useSavedListsMutations.ts`
- Create: `src/hooks/useSavedListsMutations.test.ts`

Each mutation reads the current 30003 event (via `nostr.query`), modifies the `a` tag set, republishes the single event with `d=saved-lists`. Optimistic cache update on `['saved-lists', user.pubkey]`.

- [ ] **Step 1: Tests** — save when no prior event creates a fresh one; save deduplicates; unsave removes; rollback on publish failure.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(hooks): add useSaveList / useUnsaveList (kind 30003)"
```

### Task 4.3: `useUnifiedLists(pubkey)` — combined view

**Files:**
- Create: `src/hooks/useUnifiedLists.ts`
- Create: `src/hooks/useUnifiedLists.test.ts`

Composes `usePeopleLists(pubkey)` + `useVideoLists(pubkey)` (existing). Returns `{ video: VideoList[]; people: PeopleList[]; isLoading; isError }`. Use this on Profile Lists tab and Sidebar.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(hooks): add useUnifiedLists (combined video + people)"
```

---

## Chunk 5: Dialogs — Create / Edit / Delete / AddTo

### Task 5.1: `CreatePeopleListDialog`

**Files:**
- Create: `src/components/CreatePeopleListDialog.tsx`
- Create: `src/components/CreatePeopleListDialog.test.tsx`

Mirror `CreateListDialog.tsx` structure: shadcn `<Dialog>`, form fields `name` (required), `description` (textarea, optional), `image` (URL or upload-button stub for v1 — match existing video-list dialog's image handling). On submit, call `useCreatePeopleList`. Success → close + toast.

Voice for empty/error states: "Name is required." (factual). Success toast: "List created. Now add some loopers."

- [ ] **Step 1: Tests** — required field validation; submit calls hook with right shape; close on success.
- [ ] **Step 2: Implement** following `CreateListDialog.tsx` patterns. NO `lucide-react`. NO `uppercase` class. Heading via `<SectionHeader>`.
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(components): add CreatePeopleListDialog"
```

### Task 5.2: `EditPeopleListDialog`

**Files:**
- Create: `src/components/EditPeopleListDialog.tsx`
- Create: `src/components/EditPeopleListDialog.test.tsx`

Same shape as Create, but pre-populates from a passed-in `list: PeopleList`. Calls `useUpdatePeopleList`.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add EditPeopleListDialog"
```

### Task 5.3: `DeletePeopleListDialog`

**Files:**
- Create: `src/components/DeletePeopleListDialog.tsx`
- Create: `src/components/DeletePeopleListDialog.test.tsx`

Confirmation dialog with destructive CTA. Calls `useDeletePeopleList`. Mirror `DeleteListDialog.tsx`.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add DeletePeopleListDialog"
```

### Task 5.4: `AddToPeopleListDialog`

**Files:**
- Create: `src/components/AddToPeopleListDialog.tsx`
- Create: `src/components/AddToPeopleListDialog.test.tsx`

Props: `{ open, onOpenChange, memberPubkey: string }`. Body:

1. Header: "Add @{memberName} to a list"
2. Loads `usePeopleLists(currentUser.pubkey)`. Renders each list as a checkbox row (avatar grid preview thumbnail + title + member count). Pre-checks any list that already contains `memberPubkey`.
3. On row toggle, calls `useAddToPeopleList` or `useRemoveFromPeopleList` immediately (optimistic — dialog stays open until user closes).
4. Footer: "+ Create new list" button → opens `CreatePeopleListDialog` with `members: [memberPubkey]` prefilled.

Empty state (user has no lists): only the footer button is shown, headline "You don't have any lists yet."

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add AddToPeopleListDialog with quick-toggle rows"
```

---

## Chunk 6: List detail surfaces

### Task 6.1: `PeopleListDetailHeader`

**Files:**
- Create: `src/components/PeopleListDetailHeader.tsx`
- Create: `src/components/PeopleListDetailHeader.test.tsx`

Renders (mobile-faithful per Figma #4/#7):
- Back arrow (`<ArrowLeft />` from phosphor) + Follow/Following sticker button (right). Owner sees "Edit list" button instead.
- `{listName}` heading via `<SectionHeader as="h1">` (Bricolage Extra Bold).
- Stats row: "33 members · 88 videos · 89.4b loops". Loops/videos render as `—` if `usePeopleListStats` returned `null`.
- Description (truncated to ~3 lines with "…").
- Avatar strip: first 5 member avatars overlapping by 10px; tap → `/list/:pubkey/:listId/members`.

Owner detection: pass `isOwner: boolean` prop derived in the parent.

- [ ] **Step 1-3: Test, implement, commit**

Tests: "shows Follow when not owner & not saved", "shows Following when saved", "shows Edit when isOwner", "stats render `—` when null", "tapping avatar strip navigates".

```bash
git commit -m "feat(components): add PeopleListDetailHeader"
```

### Task 6.2: `PeopleListMembersGrid`

**Files:**
- Create: `src/components/PeopleListMembersGrid.tsx`
- Create: `src/components/PeopleListMembersGrid.test.tsx`

Vertical list of member rows (Figma #6). Each row = `Avatar` + `display_name` (Bricolage ExtraBold 14px) + sub-line `unique_id: npub || NIP-05` (Inter Regular 12px @ 75% opacity). Per-row overflow `…` button opens `AddToPeopleListDialog` for that pubkey.

If `isOwner` and the consumer passes `editMode={true}`, replace overflow with a small `MinusCircle` button → `useRemoveFromPeopleList`.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add PeopleListMembersGrid"
```

### Task 6.3: `PeopleListVideosGrid`

**Files:**
- Create: `src/components/PeopleListVideosGrid.tsx`
- Create: `src/components/PeopleListVideosGrid.test.tsx`

Wraps `usePeopleListMemberVideos` and renders the existing `<VideoGrid>` component (`src/components/VideoGrid.tsx`). Two-column on mobile, four-column on desktop (matches Figma #5). Empty state: "No loops yet from these creators."

Apply viewer's mute list (`useModeration`) to filter videos by author. Spec ref: empty/error/edge states section.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add PeopleListVideosGrid (VideoGrid + member-feed)"
```

### Task 6.4: `PeopleListEditMode` — owner curate

**Files:**
- Create: `src/components/PeopleListEditMode.tsx`
- Create: `src/components/PeopleListEditMode.test.tsx`

Owner-only screen (Figma #8). Top bar: back arrow + `{listName}` + ✓ confirm. Body has two sections:
1. Search input + results: type to search users (use existing search-by-name infra; `src/pages/SearchPage.tsx` patterns). Each result row has a `+`/`✓` toggle.
2. Current members list (re-uses `PeopleListMembersGrid` with `editMode={true}`).

The ✓ button just navigates back — all changes are persisted optimistically as the user toggles. (Save-on-confirm would require a transaction model the spec deferred.)

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add PeopleListEditMode (owner curate)"
```

### Task 6.5a: Extract existing `<VideoListContent>` from `ListDetailPage`

**Files:**
- Modify: `src/pages/ListDetailPage.tsx` (currently 595 lines)
- Create: `src/components/VideoListContent.tsx`

Move the current page body (the kind-30005 rendering logic) into a new `<VideoListContent listEvent={…} />` component. `ListDetailPage` should now be thin: parse params, run the `kinds: [30000, 30005]` query (already widened in Task 1.5), pass the resolved event to `<VideoListContent>`. Behavior unchanged for kind 30005.

- [ ] **Step 1: Verify existing tests still pass** before the refactor.
- [ ] **Step 2: Extract.**
- [ ] **Step 3: Run** `npx vitest run src/pages/ListDetailPage.test.tsx`. Expected: PASS unchanged.
- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(list-detail): extract VideoListContent component"
```

### Task 6.5b: Add kind-30000 dispatch in `ListDetailPage`

**Files:**
- Modify: `src/pages/ListDetailPage.tsx`
- Create: `src/components/PeopleListContent.tsx`
- Modify: `src/pages/ListDetailPage.test.tsx`

`ListDetailPage` now branches on resolved event kind:
- `event.kind === 30005` → `<VideoListContent>` (existing)
- `event.kind === 30000` → `<PeopleListContent>` (new): renders `<PeopleListDetailHeader>` (Task 6.1) + `<PeopleListVideosGrid>` (Task 6.3) below the avatar strip, in the default landing view per Figma #4.

- [ ] **Step 1: Failing test** — given a kind-30000 event, the page renders Header + VideosGrid (and not VideoListContent).
- [ ] **Step 2: Run** test, verify FAIL.
- [ ] **Step 3: Implement** `<PeopleListContent>` and the dispatch.
- [ ] **Step 4: Run** test, verify PASS.
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(list-detail): dispatch to PeopleListContent for kind 30000"
```

### Task 6.5c: Add `/list/:pubkey/:listId/members` route

**Files:**
- Modify: `src/AppRouter.tsx` (add route under public group, near line 130)
- Create: `src/pages/ListMembersPage.tsx`
- Create: `src/pages/ListMembersPage.test.tsx`

Thin page: header (back arrow + `{listName}` + member count) + `<PeopleListMembersGrid>` (Task 6.2). Use `useParams<{ pubkey: string; listId: string }>` and `decodeListIdParam` from Task 1.2.

- [ ] **Step 1: Failing test** — route renders members grid given mocked list.
- [ ] **Step 2-5:** test fail → implement → test pass → commit.

```bash
git commit -m "feat(routes): add /list/.../members sub-route"
```

### Task 6.5d: Add `/list/:pubkey/:listId/videos` route

**Files:**
- Modify: `src/AppRouter.tsx`
- Create: `src/pages/ListVideosPage.tsx`
- Create: `src/pages/ListVideosPage.test.tsx`

Thin page: header + `<PeopleListVideosGrid>` (Task 6.3) only.

- [ ] **Step 1-5:** test fail → implement → test pass → commit.

```bash
git commit -m "feat(routes): add /list/.../videos sub-route"
```

### Task 6.5e: Add `/list/:pubkey/:listId/edit` route (owner-guarded)

**Files:**
- Modify: `src/AppRouter.tsx`
- Create: `src/pages/ListEditPage.tsx`
- Create: `src/pages/ListEditPage.test.tsx`

```tsx
// src/pages/ListEditPage.tsx
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { decodeListIdParam, buildListPath } from '@/lib/eventRouting';
import { PeopleListEditMode } from '@/components/PeopleListEditMode';

export default function ListEditPage() {
  const { pubkey = '', listId = '' } = useParams();
  const dTag = decodeListIdParam(listId);
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.pubkey !== pubkey) {
      navigate(buildListPath(pubkey, dTag), { replace: true });
    }
  }, [user, pubkey, dTag, navigate]);

  if (!user || user.pubkey !== pubkey) return null;
  return <PeopleListEditMode pubkey={pubkey} dTag={dTag} />;
}
```

- [ ] **Step 1: Failing test** asserts non-owner is redirected to detail; owner sees edit mode.
- [ ] **Step 2-5:** test fail → implement → test pass → commit.

```bash
git commit -m "feat(routes): add owner-guarded /list/.../edit sub-route"
```

---

## Chunk 7: Discovery surfaces — cards, profile tab, discovery, search, sidebar

### Task 7.1: `PeopleListCard`

**Files:**
- Create: `src/components/PeopleListCard.tsx`
- Create: `src/components/PeopleListCard.test.tsx`

Two-column-friendly card matching Figma:
- Media area: 1 large square avatar (left, ~66% width) + 2 small square avatars stacked (right). Falls back to placeholder swatches when fewer than 3 members.
- Black 65% scrim badge bottom-left: `<UsersThree />` from phosphor + member count.
- Title (`<SectionHeader as="h3">`).
- Description (Inter Regular 12px @ 75% opacity).

Click → `buildListPath(pubkey, list.id)`.

- [ ] **Step 1-3: Test (renders title/desc/count, navigates), implement, commit**

```bash
git commit -m "feat(components): add PeopleListCard discovery card"
```

### Task 7.2: `UnifiedListCard`

**Files:**
- Create: `src/components/UnifiedListCard.tsx`
- Create: `src/components/UnifiedListCard.test.tsx`

Polymorphic dispatch:

```ts
type UnifiedListInput =
  | { kind: 30000; list: PeopleList }
  | { kind: 30005; list: VideoList };

export function UnifiedListCard(input: UnifiedListInput) {
  return input.kind === 30000
    ? <PeopleListCard list={input.list} />
    : <VideoListCard list={input.list} />;
}
```

If `<VideoListCard />` does not yet exist (current code uses inline JSX in pages), extract from existing video-list rendering call sites. Keep the extraction tight — same markup, just a component wrapper.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(components): add UnifiedListCard polymorphic over kind 30000/30005"
```

### Task 7.3: Add `Tabs` primitive on `ProfilePage` + Lists tab

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/components/ProfileHeader.tsx` (or wherever the title section ends)
- Create: `src/components/ProfileListsTab.tsx`
- Modify: `src/pages/ProfilePage.test.tsx`

ProfilePage currently has no tabs. v1 ships exactly two tabs: `Videos | Lists` using shadcn `<Tabs>`. Default tab is `Videos`. URL hash `#lists` selects Lists.

`ProfileListsTab` body: calls `useUnifiedLists(profilePubkey)`, renders 2-col grid (mobile) / 4-col (desktop) of `<UnifiedListCard>`. Above the grid: if viewing OWN profile, render `+ Create new list` sticker button (Figma #1) — opens `CreatePeopleListDialog`.

- [ ] **Step 1: Test** — Lists tab renders cards from both kinds; "Create new list" only shown when `currentUser.pubkey === profilePubkey`.
- [ ] **Step 2: Implement.** Use `<Tabs>` from `src/components/ui/tabs.tsx` (verify it exists; create thin wrapper if absent).
- [ ] **Step 3: Verify other ProfilePage tests still pass.**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(profile): add Lists tab to ProfilePage"
```

### Task 7.4: Add Lists tab to `DiscoveryPage`

**Files:**
- Modify: `src/pages/DiscoveryPage.tsx`
- Modify: `src/pages/DiscoveryPage.test.tsx`
- Create: `src/hooks/useDiscoveryLists.ts` + test

`useDiscoveryLists` queries the relay for `{ kinds: [30000, 30005], since: lastWeek, limit: 50 }`, parses both kinds via the appropriate parser, ranks by `members.length`/`videoCoordinates.length` × 10 + recency (mirror `useTrendingVideoLists` formula at `useVideoLists.ts:497`), returns top 20.

Add a Lists tab to whatever tab system DiscoveryPage uses. Render a 2-col / 4-col grid of `<UnifiedListCard>`.

- [ ] **Step 1-4: Test, implement, verify, commit**

```bash
git commit -m "feat(discovery): add Lists tab to DiscoveryPage"
```

### Task 7.5: Add Lists tab to `SearchPage`

**Files:**
- Modify: `src/pages/SearchPage.tsx` (849 lines)
- Modify: `src/pages/SearchPage.test.tsx`

**Reality check (verified at `src/pages/SearchPage.tsx:461-479`):** existing tabs are `all | videos | users | hashtags`, NOT "Classics / Popular / Categories" (which were on the discovery surface, not search). Plan: add `lists` as a **5th** tab.

Concrete edits:
1. At `SearchPage.tsx:461`, change `<TabsList ...grid-cols-4 mb-6>` → `grid-cols-5`.
2. After the `<TabsTrigger value="hashtags">` block (around line 478), insert:

```tsx
<TabsTrigger value="lists" className="gap-2">
  <SquaresFour className="h-4 w-4 flex-shrink-0" weight="bold" />
  <span className="hidden sm:inline">Lists</span>
</TabsTrigger>
```

(Import `SquaresFour` from `@phosphor-icons/react` — replaces the `Search`/`Video`/`Users`/`Hash` `lucide` imports already in this file? Verify: this file currently uses `Search`, `Video`, `Users`, `Hash` — confirm those are phosphor names. If they're lucide, this is also a brand-guardrail bug to flag separately, but **do not fix in this PR** — out of scope.)

3. Add a new `<TabsContent value="lists">` block after the existing ones. Body queries `{ kinds: [30000, 30005], limit: 50 }` filtered by `name`/`description` substring against `searchQuery`. Renders `<UnifiedListCard>` per result.

NIP-50 path: try `{ kinds: [30000, 30005], search: searchQuery, limit: 50 }` first; if relay returns nothing, fall back to fetch + local filter.

- [ ] **Step 1: Add a failing test** asserting that with `?type=lists` and 1 mocked kind-30000 + 1 mocked kind-30005 event matching the query, both cards render.
- [ ] **Step 2: Verify it fails** — `npx vitest run src/pages/SearchPage.test.tsx`. Expected: FAIL — `lists` tab not found.
- [ ] **Step 3: Implement** the tab + content as above.
- [ ] **Step 4: Verify it passes** — same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/pages/SearchPage.tsx src/pages/SearchPage.test.tsx
git commit -m "feat(search): add Lists tab to SearchPage"
```

### Task 7.6: Add Lists section to `AppSidebar`

**Files:**
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/AppSidebar.test.tsx`

New collapsible section labeled "Lists" (only renders when logged in). Two subgroups:
1. "Authored" — `useUnifiedLists(currentUser.pubkey)` → list of links with type icon (▶ for kind 30005, 👥 for kind 30000) + name. Caps at 8; "View all" link → `/lists`.
2. "Saved" — `useSavedLists()` → for each, render link. Hidden when 0.

Footer: "+ Create new list" → opens `CreatePeopleListDialog` (only shows when section is open).

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(sidebar): add Lists section (authored + saved)"
```

### Task 7.7: Update `/lists` page to show both kinds

**Files:**
- Modify: `src/pages/ListsPage.tsx` (302 lines)
- Modify: `src/pages/ListsPage.test.tsx`

Currently video-only. Restructure as two sub-tabs: `Authored | Saved`. Both use `<UnifiedListCard>`. Authored = `useUnifiedLists(user.pubkey)`, Saved = `useSavedLists()` resolved through individual list queries. Header CTA: "+ Create new list".

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(lists-page): show authored + saved across both kinds"
```

### Task 7.8: Save / Unsave button on list detail

**Files:**
- Modify: `src/components/PeopleListDetailHeader.tsx` (Task 6.1 already gave it the prop; wire here)
- (Video-list detail also gets the same button — symmetric)
- Modify: relevant tests

Wire the Follow / Following CTA in the people-list header to `useSaveList` / `useUnsaveList`. Owner sees Edit instead of Save (rule from spec).

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(detail): wire Save / Unsave on people-list header"
```

---

## Chunk 8: Quick-add entry points + final verification

### Task 8.1: "Add to list…" on `ProfileHeader` overflow

**Files:**
- Modify: `src/components/ProfileHeader.tsx`
- Modify: `src/components/ProfileHeader.test.tsx`

Find the existing overflow `…` menu (or add one if absent). Add menu item "Add to list…" that opens `<AddToPeopleListDialog memberPubkey={profilePubkey} />`. Hidden when viewing own profile.

- [ ] **Step 1-3: Test (item visible only on others' profiles, opens dialog), implement, commit**

```bash
git commit -m "feat(profile): add 'Add to list' overflow item"
```

### Task 8.2: "Add creator to list…" on `VideoCard` overflow

**Files:**
- Modify: `src/components/VideoCard.tsx` (44.1K — surgical edit only)
- Modify: `src/components/VideoCard.test.tsx`

**Find the right menu first.** `VideoCard.tsx` has multiple potential menus (video-actions vs creator-row). Step 1 of this task is verification:

```bash
grep -n "DropdownMenu\|MoreHorizontal\|MoreVertical\|DotsThree" src/components/VideoCard.tsx
```

We want the menu that already lists user-context items like "View profile" / "Mute author" / etc. — that's the creator-row menu. If both exist, prefer it. If only a video-actions menu exists, do NOT shoehorn "Add creator to list" there — instead, add a small avatar-overflow `<DotsThree weight="bold" />` button next to the creator name. Snippet:

```tsx
<DropdownMenuItem onSelect={() => setAddToListOpen(true)}>
  <UsersThree className="mr-2 h-4 w-4" weight="bold" />
  Add creator to list…
</DropdownMenuItem>
{/* Then at the end of the component: */}
{addToListOpen && (
  <AddToPeopleListDialog
    open={addToListOpen}
    onOpenChange={setAddToListOpen}
    memberPubkey={video.pubkey}
  />
)}
```

Hide the menu item if `currentUser?.pubkey === video.pubkey` (don't add yourself).

- [ ] **Step 1: Confirm menu location** with the grep above; record the line range you intend to touch.
- [ ] **Step 2: Failing test** — render `<VideoCard>` with a video by another author, click the overflow, expect "Add creator to list…" in the dropdown.
- [ ] **Step 3: Run** `npx vitest run src/components/VideoCard.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** same command. Expected: PASS.
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(video-card): add 'Add creator to list' overflow item"
```

### Task 8.3: "Add to list…" on `UserListDialog` rows

**Files:**
- Modify: `src/components/UserListDialog.tsx`
- Modify: `src/components/UserListDialog.test.tsx`

Per-row overflow (followers / following list rows) gets "Add to list…" item. Hidden when current user's pubkey matches the row.

- [ ] **Step 1-3: Test, implement, commit**

```bash
git commit -m "feat(user-list): add 'Add to list' per-row overflow"
```

### Task 8.4: A11y / visual / brand sweep

**Files:**
- Modify: `tests/visual/a11y.spec.ts` (extend route list to include `/list/:pubkey/:listId` representative URL)
- Create: `tests/visual/people-lists.spec.ts` (snapshot the 4 main surfaces at mobile + desktop widths)

Take a Playwright visual baseline of:
- `/lists` (logged-in)
- `/list/<pubkey>/<list>` (people list, default view)
- `/list/<pubkey>/<list>/members`
- `/discovery` Lists tab

Both at `375x812` (mobile) and `1280x800` (desktop). Run axe-core; ensure zero violations on real-content surfaces.

- [ ] **Step 1: Add visual test file**
- [ ] **Step 2: Run** `npm run test:visual` (or whatever script exists; check `package.json`)
- [ ] **Step 3: Inspect baselines, commit them**

```bash
git commit -m "test(visual): people-lists surfaces baseline + a11y"
```

### Task 8.5: Brand guardrail confirmation

- [ ] Run `npx vitest run tests/brand/` — must pass.
- [ ] Search the diff for `lucide-react`, `uppercase` className, `bg-gradient-`, `linear-gradient(`, `radial-gradient(` — must have zero new occurrences.

```bash
git diff origin/main -- src/ | grep -E "lucide-react|uppercase|bg-gradient-|linear-gradient\(|radial-gradient\("
```
Expected: empty.

### Task 8.6: Full-suite green baseline

- [ ] Run `npm test` — full vitest suite passes.
- [ ] Run `npx tsc --noEmit` — zero type errors.
- [ ] Run `npm run build` — production build succeeds.

### Task 8.7: PR

- [ ] Push branch `feat/people-lists` to `origin`.
- [ ] Open PR vs `main` titled "feat: NIP-51 people lists (kind 30000)".
- [ ] PR body summarizes the spec sections, links the design doc, and explicitly calls out the prerequisite refactors (LIST_KINDS extension, ListDetailPage kinds widening, ProfilePage Tabs introduction, AppSidebar Lists section addition) so reviewers know which diffs are scope expansions vs new feature code.

---

## Out-of-scope reminders

These are explicitly NOT in this plan (per spec):
- Private/encrypted list members
- Collaborative people lists
- Notifications when added to a list
- Filter For-You feed by list
- Bulk-import kind:3 contacts into a list
- Kind 10000 mute lists, kind 10001 pinned notes

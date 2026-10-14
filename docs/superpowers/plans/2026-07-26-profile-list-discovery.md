# Profile List Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone discover a profile's public people and video lists, open either list type, and browse people-list videos as the primary content.

**Architecture:** Preserve NIP-51's separate addressable event kinds—kind `30000` follow sets and kind `30005` video sets—then merge them through a small discriminated presentation model. Public React Query hooks own relay access, pure parsers own event validation and addressable-event deduplication, and pages/components consume those hooks without requiring login.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Nostrify, Vitest, React Testing Library, TailwindCSS, Phosphor Icons

---

### Task 1: Parse and query public people lists

**Files:**
- Create: `src/lib/parsePeopleListFromEvent.ts`
- Create: `src/lib/parsePeopleListFromEvent.test.ts`
- Create: `src/hooks/usePeopleLists.ts`
- Create: `src/hooks/usePeopleLists.test.ts`

- [ ] **Step 1: Write failing parser tests**

Cover a valid kind `30000` event, title fallback to `d`, ordered/deduplicated full `p` tags, rejection of the reserved `d=block` set, rejection of the wrong kind, and newest-event-wins deduplication by the full `${pubkey}:30000:${d}` address.

```ts
expect(parsePeopleListFromEvent(event)).toMatchObject({
  id: 'friends',
  name: 'Friends',
  pubkey: OWNER,
  memberPubkeys: [ALICE, BOB],
})
expect(parsePeopleListFromEvent({ ...event, tags: [['d', 'block']] })).toBeNull()
expect(deduplicatePeopleLists([older, newer])).toEqual([parsePeopleListFromEvent(newer)])
```

- [ ] **Step 2: Run the parser tests and verify RED**

Run: `npx vitest run src/lib/parsePeopleListFromEvent.test.ts`

Expected: FAIL because `parsePeopleListFromEvent.ts` does not exist.

- [ ] **Step 3: Implement the pure parser and addressable dedupe**

```ts
export interface PeopleList {
  id: string
  name: string
  description?: string
  image?: string
  pubkey: string
  createdAt: number
  memberPubkeys: string[]
}

export function peopleListAddress(list: PeopleList): string {
  return `${list.pubkey}:30000:${list.id}`
}

export function parsePeopleListFromEvent(event: NostrEvent): PeopleList | null {
  if (event.kind !== 30000) return null
  const id = event.tags.find((tag) => tag[0] === 'd')?.[1]
  if (!id || id === 'block') return null
  const memberPubkeys = [...new Set(
    event.tags.filter((tag) => tag[0] === 'p' && tag[1]).map((tag) => tag[1]),
  )]
  return {
    id,
    name: event.tags.find((tag) => tag[0] === 'title')?.[1] || id,
    description: event.tags.find((tag) => tag[0] === 'description')?.[1],
    image: event.tags.find((tag) => tag[0] === 'image')?.[1],
    pubkey: event.pubkey,
    createdAt: event.created_at,
    memberPubkeys,
  }
}
```

Implement `deduplicatePeopleLists(events)` by parsing, sorting newest-first, and keeping the first full address. Never shorten a pubkey in storage or key construction.

- [ ] **Step 4: Run the parser tests and verify GREEN**

Run: `npx vitest run src/lib/parsePeopleListFromEvent.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing hook tests**

Mock `useNostr()` and assert `usePeopleLists(OWNER)` queries `{ kinds: [30000], authors: [OWNER], limit: 100 }`, removes `block`, and collapses relay duplicates. Assert `usePeopleList(OWNER, 'friends')` adds `'#d': ['friends']` and returns the newest exact event.

- [ ] **Step 6: Run the hook tests and verify RED**

Run: `npx vitest run src/hooks/usePeopleLists.test.ts`

Expected: FAIL because the hooks do not exist.

- [ ] **Step 7: Implement the public React Query hooks**

```ts
export function usePeopleLists(pubkey: string | undefined) {
  const { nostr } = useNostr()
  return useQuery({
    queryKey: ['people-lists', pubkey],
    queryFn: async ({ signal }) => deduplicatePeopleLists(await nostr.query([{
      kinds: [30000],
      authors: [pubkey!],
      limit: 100,
    }], { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) })),
    enabled: Boolean(pubkey),
    staleTime: 60_000,
    gcTime: 300_000,
  })
}
```

Add `usePeopleList(pubkey, listId)` with the same timeout, exact `#d` query, a limit of `10` so duplicate relay versions can be resolved, and newest-valid selection.

- [ ] **Step 8: Run both focused test files and commit**

Run: `npx vitest run src/lib/parsePeopleListFromEvent.test.ts src/hooks/usePeopleLists.test.ts`

Expected: PASS.

```bash
git add src/lib/parsePeopleListFromEvent.ts src/lib/parsePeopleListFromEvent.test.ts src/hooks/usePeopleLists.ts src/hooks/usePeopleLists.test.ts
git commit -m "feat: read public people lists"
```

### Task 2: Build the mixed list presentation model and cards

**Files:**
- Create: `src/lib/profileLists.ts`
- Create: `src/lib/profileLists.test.ts`
- Create: `src/components/ProfileListCard.tsx`
- Create: `src/components/ProfileListCard.test.tsx`

- [ ] **Step 1: Write failing adapter tests**

Assert video lists map to `type: 'videos'`, people lists map to `type: 'people'`, the mixed result sorts newest-first, the stable key contains kind + complete owner pubkey + d-tag, and routes are owner-aware.

```ts
expect(toDiscoverablePeopleList(peopleList)).toMatchObject({
  type: 'people',
  itemCount: 2,
  href: `/people-lists/${OWNER}/friends`,
})
expect(toDiscoverableVideoList(videoList).href).toBe(`/list/${OWNER}/favorites`)
```

- [ ] **Step 2: Run adapter tests and verify RED**

Run: `npx vitest run src/lib/profileLists.test.ts`

Expected: FAIL because `profileLists.ts` does not exist.

- [ ] **Step 3: Implement a discriminated presentation model**

```ts
export interface DiscoverableList {
  key: string
  type: 'people' | 'videos'
  id: string
  name: string
  description?: string
  image?: string
  ownerPubkey: string
  createdAt: number
  itemCount: number
  href: string
}

export function mergeProfileLists(
  peopleLists: PeopleList[],
  videoLists: VideoList[],
): DiscoverableList[] {
  return [
    ...peopleLists.map(toDiscoverablePeopleList),
    ...videoLists.map(toDiscoverableVideoList),
  ].sort((a, b) => b.createdAt - a.createdAt)
}
```

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run: `npx vitest run src/lib/profileLists.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing accessible card tests**

Render one card of each type in `MemoryRouter`. Assert the whole card is a link, visible labels say `People list` or `Video list`, counts say `2 people` or `3 videos`, an absent image uses the type icon, and the href is the adapter's public route.

- [ ] **Step 6: Implement the card**

Use `Card variant="brand"` with Phosphor `UsersThree` and `VideoCamera`, visible type text, a square image/fallback, title, optional two-line description, and item count. Use no gradients, no all-caps class, and no truncated identifier.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run src/lib/profileLists.test.ts src/components/ProfileListCard.test.tsx`

Expected: PASS.

```bash
git add src/lib/profileLists.ts src/lib/profileLists.test.ts src/components/ProfileListCard.tsx src/components/ProfileListCard.test.tsx
git commit -m "feat: present mixed profile lists"
```

### Task 3: Add the profile shelf and public all-lists gallery

**Files:**
- Create: `src/components/ProfileListsSection.tsx`
- Create: `src/components/ProfileListsSection.test.tsx`
- Create: `src/pages/ProfileListsPage.tsx`
- Create: `src/pages/ProfileListsPage.test.tsx`
- Modify: `src/pages/ProfilePage.tsx`

- [ ] **Step 1: Write failing shelf tests**

Mock both list hooks. Assert the shelf renders a skeleton during initial load, hides only after both sources finish empty, preserves one successful source when the other errors, shows the three newest mixed cards, and links `See all` to `/profile/${npub}/lists`.

- [ ] **Step 2: Run the shelf tests and verify RED**

Run: `npx vitest run src/components/ProfileListsSection.test.tsx`

Expected: FAIL because the section does not exist.

- [ ] **Step 3: Implement and place the shelf**

```tsx
const lists = mergeProfileLists(peopleLists ?? [], videoLists ?? [])
if (!isLoading && lists.length === 0) return null
return (
  <section aria-labelledby="profile-lists-heading" className="space-y-4">
    <div className="flex items-center justify-between">
      <SectionHeader id="profile-lists-heading">Lists</SectionHeader>
      <Link to={`/profile/${nip19.npubEncode(pubkey)}/lists`}>See all</Link>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.slice(0, 3).map((list) => <ProfileListCard key={list.key} list={list} />)}
    </div>
  </section>
)
```

Insert `<ProfileListsSection pubkey={pubkey} />` after `PinnedVideosSection` and before the videos heading so videos remain the main profile body below the compact shelf.

- [ ] **Step 4: Run the shelf tests and verify GREEN**

Run: `npx vitest run src/components/ProfileListsSection.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write failing public gallery tests**

Mock the two hooks and render `/profile/:npub/lists`. Assert `All` is selected by default, `People` and `Videos` filters change the visible cards, loading and empty states are readable, and no auth state is required.

- [ ] **Step 6: Implement the gallery page**

Decode `npub` or accept a 64-character hex key, call both hooks, render the owner heading and mixed grid, and use `Tabs` with `All`, `People`, and `Videos`. Invalid identifiers show a factual not-found state without querying.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run src/components/ProfileListsSection.test.tsx src/pages/ProfileListsPage.test.tsx`

Expected: PASS.

```bash
git add src/components/ProfileListsSection.tsx src/components/ProfileListsSection.test.tsx src/pages/ProfileListsPage.tsx src/pages/ProfileListsPage.test.tsx src/pages/ProfilePage.tsx
git commit -m "feat: surface lists on public profiles"
```

### Task 4: Query videos for people-list members

**Files:**
- Create: `src/lib/peopleListVideos.ts`
- Create: `src/lib/peopleListVideos.test.ts`
- Create: `src/hooks/usePeopleListVideos.ts`
- Create: `src/hooks/usePeopleListVideos.test.ts`

- [ ] **Step 1: Write failing query-helper tests**

Assert `buildPeopleListVideoFilters` deduplicates member pubkeys, chunks authors into groups of at most `100`, uses `VIDEO_KINDS`, applies `limit: 60` and optional `until`, and returns no filters for an empty member list. Assert `mergePeopleListVideoEvents` deduplicates addressable videos by `${pubkey}:${kind}:${d}`, keeps the newest version, sorts newest-first, and caps at `60`.

- [ ] **Step 2: Run helper tests and verify RED**

Run: `npx vitest run src/lib/peopleListVideos.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement bounded filter construction and event merging**

```ts
export function buildPeopleListVideoFilters(pubkeys: string[], until?: number): NostrFilter[] {
  return chunk([...new Set(pubkeys)], 100).map((authors) => ({
    kinds: VIDEO_KINDS,
    authors,
    limit: 60,
    ...(until ? { until } : {}),
  }))
}
```

Merge raw events before calling the existing pure `parseVideoEvents()` from `src/lib/videoParser.ts`; use the complete addressable coordinate and never an event-id prefix.

- [ ] **Step 4: Run helper tests and verify GREEN**

Run: `npx vitest run src/lib/peopleListVideos.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing hook tests**

Assert the hook sends the bounded filters, returns parsed recent videos, disables for an empty list, and exposes a next page whose `until` is one second older than the oldest raw event.

- [ ] **Step 6: Implement the infinite hook**

Use `useInfiniteQuery` keyed by the full sorted member set. Query all batch filters together with a ten-second combined abort signal, merge/dedupe/cap events, parse with `parseVideoEvents`, and return `{ videos, nextUntil }`. Set `getNextPageParam` to `nextUntil` only when the page has 60 raw merged events.

- [ ] **Step 7: Run focused tests and commit**

Run: `npx vitest run src/lib/peopleListVideos.test.ts src/hooks/usePeopleListVideos.test.ts`

Expected: PASS.

```bash
git add src/lib/peopleListVideos.ts src/lib/peopleListVideos.test.ts src/hooks/usePeopleListVideos.ts src/hooks/usePeopleListVideos.test.ts
git commit -m "feat: load people list videos"
```

### Task 5: Add the people-list detail page and public routes

**Files:**
- Create: `src/components/PeopleListMember.tsx`
- Create: `src/components/PeopleListMembers.tsx`
- Create: `src/pages/PeopleListDetailPage.tsx`
- Create: `src/pages/PeopleListDetailPage.test.tsx`
- Modify: `src/AppRouter.tsx`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Write failing detail-page tests**

Mock `usePeopleList`, `usePeopleListVideos`, and author lookups. Assert the page renders the list title and description, a horizontal `People` region before the `Videos` heading, full profile links for members, a primary `VideoGrid`, a load-more action when another page exists, public loading/empty/not-found states, and no subscribe control.

- [ ] **Step 2: Run the page tests and verify RED**

Run: `npx vitest run src/pages/PeopleListDetailPage.test.tsx`

Expected: FAIL because the detail page does not exist.

- [ ] **Step 3: Implement member cells and carousel**

Each `PeopleListMember` calls `useAuthor(pubkey)` and links to `/profile/${nip19.npubEncode(pubkey)}` with an avatar and display name. `PeopleListMembers` renders a labeled horizontal `overflow-x-auto` row and keeps source order.

- [ ] **Step 4: Implement the video-primary detail page**

Read owner and d-tag from `/people-lists/:pubkey/:listId`, fetch the exact kind `30000` list, render its owner/list metadata, then the people carousel, then a larger Videos section using flattened pages in `VideoGrid`. Empty member lists and member lists with no videos get distinct casual-direct copy.

- [ ] **Step 5: Register both public discovery routes and document them**

```tsx
<Route path="/profile/:npub/lists" element={<ProfileListsPage />} />
<Route path="/people-lists/:pubkey/:listId" element={<PeopleListDetailPage />} />
```

Keep both routes outside the `isLoggedIn` block. Update `ARCHITECTURE.md` to list the mixed profile shelf/gallery and the owner-aware people-list route beside existing list pages.

- [ ] **Step 6: Run focused tests and commit**

Run: `npx vitest run src/pages/PeopleListDetailPage.test.tsx src/pages/ProfileListsPage.test.tsx src/components/ProfileListsSection.test.tsx`

Expected: PASS.

```bash
git add src/components/PeopleListMember.tsx src/components/PeopleListMembers.tsx src/pages/PeopleListDetailPage.tsx src/pages/PeopleListDetailPage.test.tsx src/AppRouter.tsx ARCHITECTURE.md
git commit -m "feat: browse people lists and their videos"
```

### Task 6: Verify the discovery slice

**Files:**
- Modify only if verification exposes a feature regression.

- [ ] **Step 1: Run all feature tests**

Run:

```bash
npx vitest run \
  src/lib/parsePeopleListFromEvent.test.ts \
  src/hooks/usePeopleLists.test.ts \
  src/lib/profileLists.test.ts \
  src/components/ProfileListCard.test.tsx \
  src/components/ProfileListsSection.test.tsx \
  src/pages/ProfileListsPage.test.tsx \
  src/lib/peopleListVideos.test.ts \
  src/hooks/usePeopleListVideos.test.ts \
  src/pages/PeopleListDetailPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run brand guardrails**

Run:

```bash
npx vitest run \
  tests/brand/no-uppercase-class.test.ts \
  tests/brand/no-gradients.test.ts \
  tests/brand/no-lucide-react.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full project verification**

Run: `npm run test`

Expected: type-check, ESLint, all Vitest tests, and production build pass. If an unrelated baseline timeout recurs, rerun its file alone and record both results rather than hiding the failure.

- [ ] **Step 4: Review identifiers, scope, and worktree**

Run:

```bash
rg -n "slice\\(|substring\\(" src/lib/parsePeopleListFromEvent.ts src/lib/profileLists.ts src/lib/peopleListVideos.ts src/components/ProfileListCard.tsx src/components/PeopleListMember.tsx
rg -n "Subscribe|subscribe|localStorage|SharedPreferences" src/components/ProfileListsSection.tsx src/pages/ProfileListsPage.tsx src/pages/PeopleListDetailPage.tsx
git status --short
git diff --check
```

Expected: no identifier truncation in storage/routes, no subscription persistence in this discovery-only slice, only intended files changed, and no whitespace errors.

- [ ] **Step 5: Commit verification fixes, if any**

```bash
git add <only-the-files-corrected-during-verification>
git commit -m "fix: polish profile list discovery"
```

Skip this commit when verification required no fixes.

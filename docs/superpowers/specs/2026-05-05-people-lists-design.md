# People Lists — Design Spec

**Date:** 2026-05-05
**Author:** rabble (with Claude)
**Status:** Approved (brainstorm complete, pre-implementation)

## Summary

Add support for **NIP-51 follow sets (kind 30000)** as a parallel list type alongside the existing video lists (kind 30005). Users can create, edit, delete public people lists; add/remove people from any surface where users appear; subscribe to other people's lists via NIP-51 bookmark sets (kind 30003). The Lists experience is unified across both kinds — discovery cards distinguish video lists vs people lists by icon and metadata, but they coexist in the same surfaces.

Mobile designs come from Figma (`UI-Design`, file `rp1DsDEUuCaicW0lk6I2aZ`); the web build adapts them via the project's existing `< lg` mobile / `≥ lg` desktop responsive split.

## Goals

- People can curate and publish public people lists ("Best Classic Viners", "Sunshine Council", etc.)
- Lists feel like custom channels: tapping into one shows recent videos from members, not a static roster
- Discovery is a first-class surface (Lists tab on Search/Discover and on every Profile)
- Adding people is one tap from any surface where you see a user (profile, video card, search results, members roster)
- The new infrastructure mirrors existing video-list infrastructure so future merges (e.g. unified list type) are easy

## Non-goals (deferred)

- Private/encrypted list members (NIP-04 encrypted `content`)
- Collaborative people lists (other pubkeys allowed to mutate)
- Other NIP-51 list kinds (mute lists kind 10000, pinned-notes 10001, etc.)
- Bulk import "split my kind:3 follows into lists"
- Recommendations / "lists you might like"
- Notifications when you're added to someone's list

## Data model

### NIP-51 follow set (kind 30000)

```ts
interface PeopleList {
  id: string;              // d-tag (immutable identifier)
  pubkey: string;          // owner
  name: string;            // title tag
  description?: string;
  image?: string;          // optional cover image
  members: string[];       // p-tag values (hex pubkeys)
  createdAt: number;
}
```

Event shape:

```json
{
  "kind": 30000,
  "tags": [
    ["d", "close-friends"],
    ["title", "Close Friends"],
    ["description", "people whose loops I never want to miss"],
    ["image", "https://..."],
    ["p", "<hex-pubkey-1>"],
    ["p", "<hex-pubkey-2>"]
  ],
  "content": ""
}
```

Addressable identifier is `30000:<pubkey>:<d-tag>`. Republishing replaces.

### Subscribed-to lists (kind 30003 bookmark set)

A user "saves" any list (video or people) by adding/replacing a single kind 30003 event with `d=saved-lists`:

```json
{
  "kind": 30003,
  "tags": [
    ["d", "saved-lists"],
    ["a", "30000:<owner-pubkey>:<list-d-tag>"],
    ["a", "30005:<owner-pubkey>:<video-list-d-tag>"]
  ]
}
```

Saving cross-syncs across clients and works for both kinds via a single hook.

## Surfaces and routes

| Route | Auth | Purpose | Status |
|---|---|---|---|
| `/lists` | login-required (preserved) | Logged-in user's lists ("Authored" + "Saved" subtabs, kind-mixed) | extend (currently video-only) |
| `/list/:pubkey/:listId` | public | List detail; auto-routes to people-list vs video-list view based on resolved event kind | extend (see "ListDetailPage refactor" below) |
| `/list/:pubkey/:listId/members` | public | Members-only sub-view | new |
| `/list/:pubkey/:listId/videos` | public | Videos-only sub-view | new |
| `/list/:pubkey/:listId/edit` | login-required AND `currentUser.pubkey === pubkey` (route guard, redirect to detail otherwise) | Owner curate mode | new |
| `/profile/:npub` (Lists tab) | public | Authored lists, mixed kinds | adds Tabs to a currently-untabbed page (see "ProfilePage tabs" below) |
| `/search?q=...&type=lists` | public | Lists-scoped search results | extend `SearchPage` |
| `/discovery` (Lists tab) | public | Lists tab on discovery, mixed kinds, ranked by member count + recency | new tab |

### `:listId` URL encoding

`d-tags` can contain `/`, `:`, spaces, unicode. `src/lib/eventRouting.ts:27-29` already exports `buildListPath(pubkey, dTag)` with `encodeURIComponent`. Reuse it; add sibling helpers in the same file: `buildListMembersPath`, `buildListVideosPath`, `buildListEditPath`. Audit `useParams` consumers to `decodeURIComponent` on read. Do not create a parallel `listUrls.ts` module.

### Prerequisite refactors (called out by spec review)

- **`ListDetailPage` is currently hardcoded to `kinds: [30005]`** (`src/pages/ListDetailPage.tsx:274`). Refactor: change query to `kinds: [30000, 30005]` and dispatch render to `<PeopleListDetail />` or existing video-list detail based on resolved event kind. This is a real refactor, not a passive extension.
- **`AppSidebar.tsx` has no Lists section today.** Adding it is a NEW nav section, not an extension. Place it under existing entries; show authored + saved lists with a 👥 / ▶ type icon.
- **`ProfilePage.tsx` has no tabs today.** Adding Lists requires introducing a `Tabs` primitive on the profile. v1 ships `Videos | Lists` only. (Likes / Reposts are future work and explicitly NOT added by this feature.)
- **`LIST_KINDS` in `NostrProvider.tsx:142`** must be extended from `[30000, 30001, 30005]` to `[30000, 30001, 30003, 30005]` so saved-lists (kind 30003) also publishes to the multi-relay set.

### Responsive treatment

| Breakpoint | Treatment |
|---|---|
| `< lg` (mobile) | Faithful to Figma: 2-col grid, dark surface, bottom nav, full-bleed list detail |
| `≥ lg` (desktop) | Sidebar present, 4-col discovery grid, list detail constrained to ~720px max-width column, no bottom nav |

## Aggregated list stats

Mobile list-detail header shows "33 members · 88 videos · 89.4b loops" (Figma). **v1 ships members + videos; loops renders as `—` always.**

Sources:
- `members.length` — free, from event tags
- `videos` — sum of `stats.video_count` from `POST /api/users/bulk` (existing `fetchBulkUsers(apiUrl, pubkeys, signal)` at `src/lib/funnelcakeClient.ts:1064`)
- `loops` — **deferred for v1.** The bulk users response shape (`FunnelcakeBulkUsersResponse.users[].stats?: { video_count }` at lines 1014-1036) does NOT include `total_loops`. A per-user `fetchUserLoopStats` exists (line 871) but would be N requests per render. Acceptable v1 trade-off: render `—`. The right fix later is a server-side aggregate endpoint on Funnelcake.

Implemented as `usePeopleListStats(pubkey, dTag)`. Cached for 5 minutes. **Caveat:** for lists > 200 members, videos also renders as `—` (see "Stats aggregation cost cap" in Open questions); only `members` is shown.

## Components

### New people-list-specific

| File | Purpose | Mirrors |
|---|---|---|
| `src/components/PeopleListCard.tsx` | Discovery card: 1 large + 2 small avatar tiles, 👥 count badge | new |
| `src/components/CreatePeopleListDialog.tsx` | Create form (title, description, image upload) | `CreateListDialog` |
| `src/components/EditPeopleListDialog.tsx` | Edit metadata only | `EditListDialog` |
| `src/components/DeletePeopleListDialog.tsx` | Confirm + kind 5 deletion request | `DeleteListDialog` |
| `src/components/AddToPeopleListDialog.tsx` | Checkbox list of my lists + "Create new list" footer | `AddToListDialog` |
| `src/components/PeopleListDetailHeader.tsx` | Title + stats + description + avatar strip + Follow/Following CTA | new |
| `src/components/PeopleListMembersGrid.tsx` | Vertical roster (avatar + name + npub/NIP-05) | partial reuse of `UserListDialog` row |
| `src/components/PeopleListVideosGrid.tsx` | Aggregated video grid sourced from member pubkeys | reuses `VideoGrid` |
| `src/components/PeopleListEditMode.tsx` | Owner curate mode (Figma #8): swap members, reorder, save | new |

### Shared / extracted

| File | Purpose |
|---|---|
| `src/components/UnifiedListCard.tsx` | Renders `PeopleListCard` or existing video-list card based on event kind |
| `src/components/ListsTabs.tsx` | Tab primitive shared by Discovery / Profile / Search lists views |

## Hooks

| Hook | Purpose |
|---|---|
| `usePeopleLists(pubkey)` | All kind 30000 events for a user |
| `usePeopleList(pubkey, dTag)` | Single people list |
| `usePeopleListStats(pubkey, dTag)` | Members/videos/loops aggregate |
| `usePeopleListMembers(pubkey, dTag)` | Resolved profiles (uses `useBatchedAuthors`) |
| `usePeopleListMemberVideos(pubkey, dTag)` | Aggregated video feed; preferred path is `POST /api/videos/bulk` with `from_event` |
| `useCreatePeopleList`, `useUpdatePeopleList`, `useAddToPeopleList`, `useRemoveFromPeopleList`, `useDeletePeopleList` | Mutations (publish kind 30000 or kind 5) |
| `useSavedLists`, `useSaveList`, `useUnsaveList` | Kind 30003 bookmark set; works across both list kinds |
| `useUnifiedLists(pubkey)` | Combined `{ video: VideoList[], people: PeopleList[] }` for profile + discovery |

## Funnelcake REST integration

REST preferred, WebSocket fallback (existing circuit-breaker pattern).

| Endpoint | Status | Used for |
|---|---|---|
| `POST /api/users/bulk` | exists | Stats aggregation, member profiles |
| `POST /api/videos/bulk` with `from_event: { kind: 30000, ... }` | **needs Funnelcake support — confirm before relying on** | Aggregated videos |
| `GET /api/users/{pubkey}/lists?kind=30000` | new (optional) | Profile Lists tab |
| `GET /api/lists/popular?kind=30000,30005` | new (optional) | Discovery ranking |

If new endpoints aren't available, fall back to relay queries.

## Reuse from existing infra

- `src/hooks/useVideoLists.ts` — kept as-is. People-list hooks are parallel, not merged. Future unification can come later.
- `src/components/AppSidebar.tsx` — **add** a new Lists nav section (none exists today). Authored + saved lists across both kinds, with type icon (▶ vs 👥).
- `src/pages/ProfilePage.tsx` / `src/components/ProfileHeader.tsx` — **introduce** `Tabs` primitive (none today). v1 ships `Videos | Lists`.
- `src/pages/SearchPage.tsx` — existing tabs are Classics / Popular / Categories. Add `Lists` to the set; filter relay query by kind 30000 + 30005.
- `src/pages/DiscoveryPage.tsx` — add Lists tab, mixed kinds, ranked by member count + recency.
- `src/components/NostrProvider.tsx` — extend `LIST_KINDS` from `[30000, 30001, 30005]` to `[30000, 30001, 30003, 30005]` (kind 30003 = saved lists).

## Adding people from anywhere

Quick-add entry points (open `AddToPeopleListDialog`):

- `ProfileHeader` — overflow menu item: "Add to list…"
- `VideoCard` creator avatar — overflow menu item (`…` button) on both mobile and desktop. No long-press; long-press is unreliable cross-device and discoverability is poor.
- Search results (people scope) — per-row overflow
- `UserListDialog` rows (followers / following) — per-row overflow

Bulk-add entry point (inside `PeopleListEditMode` route):

- Owner-only edit screen at `/list/:pubkey/:listId/edit` with search + multi-select to add many at once

## Owner vs visitor controls

Single rule for all list-detail surfaces: **`isOwner = currentUser.pubkey === list.pubkey`**.

| Control | Owner | Visitor |
|---|---|---|
| Follow / Following CTA | hidden | shown (kind 30003 save) |
| "Edit list" button | shown → `/list/:pubkey/:listId/edit` | hidden |
| Delete list (overflow menu) | shown → `DeletePeopleListDialog` | hidden |
| "Add to list" button on member rows | shown (jump to edit mode) | hidden |
| Per-member "Remove" (in edit mode) | shown | n/a |
| Per-member "Add to MY list" overflow | shown | shown |
| Stats header | shown identically | shown identically |

`/edit` route is owner-only via guard; non-owners are redirected to the detail page.

## Subscribe / save flow

Save button on any list-detail page (other people's lists). Calls `useSaveList(addressableId)` which mutates a single kind 30003 event with `d=saved-lists`. Sidebar's "Saved lists" section reads from `useSavedLists()`. Unsubscribing removes the `a` tag.

### Stale-reference handling

When an owner deletes a list, every saver's kind 30003 still has the now-dead `a` tag. Rule: **on read**, attempt to resolve each saved `a` tag against the relay; tags that resolve to nothing (or to a kind 5 deletion) are filtered out of the rendered "Saved lists" view but are NOT auto-republished. The user's saved-list set self-heals on next mutation. This avoids surprise mass-rewrites of the user's bookmark event.

## Mutations and optimistic updates

All mutations use TanStack Query's optimistic-update pattern with rollback on failure. Specifically:

- `useAddToPeopleList(pubkey, dTag, newMemberPubkey)` optimistically appends a `p` tag to the cached `usePeopleList` event, publishes the new kind 30000 event, then refetches. On publish failure (relay race / signing failure), rolls back the cache.
- `useRemoveFromPeopleList` mirrors that pattern.
- `useSaveList` / `useUnsaveList` optimistically toggle the `a` tag in cached `useSavedLists`.
- `useCreatePeopleList` invalidates `usePeopleLists(pubkey)` on success.
- `useDeletePeopleList` publishes a NIP-09 kind 5 with **both** `['a', '30000:pubkey:dTag']` AND `['k', '30000']` tags. Relays that filter deletes by kind require `k`.

### Drive-by fix: `useDeleteVideoList` missing `k` tag

`src/hooks/useVideoLists.ts:520-532` currently emits a kind 5 with only `['a', '30005:...']`. This is a NIP-09 conformance bug that pre-dates this spec. Fix it in the same change: add `['k', '30005']`. Treat as an explicit task line in the implementation plan, not a parenthetical — easy to lose during execution.

## Empty / error / edge states

| Surface | Empty | Error | Other edge |
|---|---|---|---|
| `/lists` (logged-in) | "No lists yet. Create your first." with CTA | Toast + retry; show stale cache | n/a |
| Profile Lists tab (someone else) | "No public lists." (subdued) | Inline "Couldn't load lists. Try again." | n/a |
| Discovery Lists tab | "Nothing here yet. Make a list." | Inline retry | n/a |
| List detail | List with 0 members → header "0 members" + "Add members" CTA (owner) or "This list is empty." (visitor); list with 0 videos → header still shows but Videos sub-view says "No loops yet from these creators." | Toast on relay timeout, retain partial data | Videos surface uses the **viewer's** existing kind 10000 mute list (via `src/hooks/useModeration.ts`) to filter — author-side filtering is not a feature here. The member roster still shows muted authors so the owner can curate. |
| Saved lists in sidebar | "No saved lists." subdued | hide section if hook errors | Unresolvable saved `a` tags are hidden (see Stale-reference handling) |
| Edit mode (owner) | List with 0 members → big empty-state with search bar focused | Save fails → keep edits in form, surface error toast | n/a |
| `AddToPeopleListDialog` | User has 0 lists → only "Create new list" footer is shown | Toast on save failure, keep dialog open | n/a |

## Tests (TDD)

- Unit: `parsePeopleList`, transform helpers, addressable ID handling
- Hooks: `usePeopleLists`, `useAddToPeopleList`, `useSavedLists` (mocked NDK + REST)
- Components: `PeopleListCard`, `AddToPeopleListDialog`, `PeopleListDetailHeader`, `UnifiedListCard` (RTL)
- Brand guardrails: existing tests apply automatically (no `uppercase` class, no `lucide-react`, no gradients)
- Visual snapshots: `/lists`, `/list/:pubkey/:listId`, `/list/:pubkey/:listId/members` at mobile + desktop widths
- A11y: extend axe-core test to cover new routes

## Migration / compat notes

- Existing video lists (kind 30005) continue to work unchanged
- The shared `/list/:pubkey/:listId` route auto-routes to the right detail component based on the resolved event's kind
- `AppSidebar` "Lists" section grows but doesn't break existing layout

## Open questions / risks

- **Funnelcake support for `from_event` with kind 30000**: needs confirmation. If absent in v1, ship with relay-fallback only (slower for large lists; accept this).
- **Funnelcake popular-lists endpoint**: also unconfirmed. Discovery v1 can fall back to a recency-ordered relay query.
- **Aggregated video feed paging**: a list of 200 members can produce thousands of videos. Use cursor-based pagination on `POST /api/videos/bulk`, with a hard 500-result cap on the first page.
- **Saved-list lookup at scale**: kind 30003 single-event-per-user pattern is fine for hundreds of saves; not designed for tens of thousands. Acceptable for v1.
- **Stats aggregation cost cap**: the spec promises "33 members · 88 videos · 89.4b loops" via client-side `POST /api/users/bulk` summation. For lists ≤ 200 members we sum directly. For lists > 200 members we display the member count exactly but show videos/loops as "—" with a tooltip "Stats unavailable for large lists." (Funnelcake can add a server-side aggregate endpoint later.)
- **No notification when added to a list (v1)**: addees get zero signal. This is an explicit deferral. If discoverable abuse becomes a concern (e.g. spammy lists adding random users), revisit.
- **Very many lists per user**: a single user with thousands of authored lists will exhaust the relay query for `usePeopleLists(pubkey)`. v1 paginates relay queries to 100 most recent and shows a "View all" affordance only if more exist — but a user-supplied filter/search is deferred.

## i18n posture

Existing list dialogs (`CreateListDialog.tsx`, `EditListDialog.tsx`, `AddToListDialog.tsx`) do not use `useTranslation`. v1 of people lists matches that posture — strings are inline English. When the project adopts i18n broadly, list strings come along then.

## Out-of-scope examples (so we don't drift)

- "Filter my For You feed by people list" — interesting future work, not v1
- "List of lists" (curated meta-lists) — out
- "Private people lists" — phase 2 explicitly
- Migrating existing kind:3 contact list into a default people list — out


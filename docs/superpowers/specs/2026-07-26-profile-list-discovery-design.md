# Profile List Discovery

**Date:** 2026-07-26
**Status:** Design approved; pending written-spec review
**Initial client:** Divine Web
**Scope:** Public discovery and navigation for a profile's NIP-51 people and
video lists

## Summary

Profiles will show a compact, mixed shelf of their public lists immediately
above the Videos section. Each card will state whether it is a People list or
a Video list and show the corresponding member or video count. The shelf will
show the three most recently updated lists and link to a public mixed gallery
containing all lists for that profile.

Video lists continue to use the existing kind `30005` implementation and
canonical `/list/:pubkey/:listId` URLs. People lists use NIP-51 kind `30000`,
with a separate parser and query layer matching Divine Mobile's existing
domain boundary. A public people-list detail page will show member profiles in
a horizontal carousel above a primary grid of recent videos from those
members.

Subscription and Home-feed integration are follow-up work. This slice does not
show an inert Subscribe control or introduce temporary persistence.

## Goals

- Make a user's public curation visible from their profile.
- Make list type obvious before navigation using text, not only color or icon.
- Let anyone, including logged-out visitors, browse the profile's lists.
- Preserve existing video-list links and behavior.
- Match the proven Divine Mobile people-list experience: member videos are
  primary, with the people themselves visible above them.
- Establish discovery boundaries that can support live subscriptions later
  without coupling this slice to unfinished persistence semantics.

## Existing Behavior

### Divine Web

- `useVideoLists` queries kind `30005` video lists.
- `/list/:pubkey/:listId` is the public video-list detail route.
- `/lists` shows the signed-in user's lists, recent public video lists, and
  video lists from followed users, but the route itself requires login.
- Profile pages do not query or display lists.
- Kind `30000` is currently used only for block-list filtering; there is no
  general people-list parser or public people-list page.

### Divine Mobile

- Kind `30000` people lists and kind `30005` video lists have separate
  repositories and models.
- A combined provider composes both types only for presentation.
- The people-list detail screen renders a member carousel over a primary video
  grid.
- Mobile recognizes Web's `/list/:pubkey/:listId` URL as the canonical public
  video-list deep link.
- Mobile excludes the reserved kind-`30000` `d=block` event from user-facing
  people lists.

The Web implementation will follow those established boundaries rather than
replace both list domains with one persistence model.

## Product Behavior

### Profile shelf

Profiles with at least one public list show a `Lists` section above `Videos`.
The section contains:

- the heading `Lists`;
- a `See all N` link;
- up to three list cards, ordered by newest list event first.

The shelf mixes both list types. Every card includes:

- list title;
- the visible label `People` or `Videos`;
- `N people` or `N videos`;
- optional list artwork when present;
- a type-appropriate Phosphor icon as a secondary cue.

The shelf does not appear when both successful queries return no lists. While
the queries are unresolved, the section uses a compact skeleton that reserves
only the shelf's eventual height. It must not delay the profile header, pinned
videos, or profile video feed.

If only one list query succeeds, its results render normally. Failure of one
list type does not hide or invalidate the other.

### All-lists gallery

`See all N` opens a public route scoped to the profile owner. The page:

- keeps people and video lists in one collection;
- labels every card by type;
- defaults to newest first;
- offers `All`, `People`, and `Videos` filters;
- uses the same card vocabulary as the profile shelf;
- supports loading, empty, partial-error, and retry states without requiring
  login.

The page shows the profile owner and provides a clear route back to the
profile. Creating or editing lists remains outside this public gallery.

### Video-list detail

Video list cards continue to open the existing
`/list/:pubkey/:listId` route and `ListDetailPage`. Existing public links,
sharing behavior, ownership controls, collaboration controls, and video
ordering remain unchanged.

### People-list detail

People list cards open a new public, owner-aware route:

```text
/people-lists/:pubkey/:listId
```

The page resolves the exact kind-`30000` address using the owner pubkey and
`d` tag. Its primary content is a newest-first grid of recent videos authored
by current list members. A horizontal member carousel sits above the video
grid and shows avatars and names. Selecting a member opens that profile.

The member carousel remains visible while browsing the grid and may collapse
or scroll away using the same responsive principle as Divine Mobile. It is not
a second tab that hides the videos. On narrow screens it scrolls horizontally;
on desktop it fits as many members as space allows.

List owners may receive editing controls in later work. Public discovery in
this slice is read-only.

## Protocol and Data Model

### People lists

Public people lists are NIP-51 kind `30000` addressable events:

```json
{
  "kind": 30000,
  "tags": [
    ["d", "nostr-builders"],
    ["title", "Nostr builders"],
    ["description", "People making strange useful things"],
    ["image", "https://example.com/list.webp"],
    ["p", "<full-64-character-pubkey>"]
  ],
  "content": ""
}
```

The parser requires a non-empty `d` tag. It:

- prefers `title` and falls back to the `d` value;
- reads optional `description` and `image`;
- preserves the ordered, full-length values of valid public `p` tags;
- ignores private encrypted content in this discovery slice;
- rejects `d=block`;
- rejects events of any other kind.

### Video lists

Existing kind-`30005` parsing remains the source of truth for video lists.
Divine's existing addressable NIP-71 `a` tags continue to work. This feature
must not rewrite list events or narrow existing support.

### Address identity and deduplication

Neither a `d` tag nor an event ID is sufficient list identity. The stable
address is:

```text
kind:owner-pubkey:d-tag
```

Each query deduplicates relay results by that full address and keeps the event
with the greatest `created_at`. The presentation adapter uses the same address
as the React key and link identity. A person may therefore use the same `d`
value for one people list and one video list without collision.

## Client Architecture

The implementation keeps protocol ownership separate:

```text
kind 30000 events -> parsePeopleListFromEvent -> usePeopleLists
kind 30005 events -> parseVideoListFromEvent  -> useVideoLists
                                      \        /
                                       profile list presentation
```

The presentation layer maps both models into a small discriminated view model
containing:

- `type: 'people' | 'videos'`;
- full address identity;
- owner pubkey and `d` tag;
- title, description, image, update timestamp, and item count;
- type-specific destination.

This view model is for rendering and navigation only. It does not become a new
write model or replace either protocol parser.

### Query flow

On a profile:

1. Resolve the profile pubkey using the existing route, NIP-05, override, or
   subdomain path.
2. Start kind-`30000` and kind-`30005` author queries in parallel.
3. Parse and deduplicate each result independently.
4. Merge the presentation records and sort by update time.
5. Render the first three on the profile and make the full set available to
   the all-lists gallery through React Query caches.

On people-list detail:

1. Query kind `30000` by owner and `#d`.
2. Parse the newest valid event.
3. Resolve member profiles in batches through existing profile-loading
   infrastructure.
4. Query recent supported video kinds in filters containing at most 100 member
   pubkeys, with a maximum of 60 events returned per filter.
5. Deduplicate addressable videos by `pubkey:kind:d-tag`, apply existing
   block/moderation filtering, merge the batches, sort newest first, and retain
   the newest 60 videos for the initial page.

Pagination uses the oldest retained `created_at` as the next `until` boundary
and repeats the same bounded batch process. It stops when every member batch
returns fewer than 60 usable events.

## Loading, Empty, and Error States

- No public lists: omit the profile shelf.
- One list type fails: show the successful type and a small retry affordance
  only on the all-lists page.
- Both list queries fail: omit an error card from the profile and show a
  retryable factual error on the all-lists page.
- Malformed or reserved events: exclude them without breaking sibling lists.
- Empty people list: show its metadata and `Nobody here yet.`
- People list with no available videos: show its member carousel and
  `Nothing looping from this crew yet.`
- Missing member metadata: use existing generated-name and avatar fallbacks.
- Deleted, blocked, or unavailable videos: exclude them from the grid.
- Logged-out viewer: all discovery and detail views remain readable; actions
  that require login are not part of this slice.

## Accessibility, Brand, and Responsive Behavior

- Type is always written as `People` or `Videos`; icons and accent colors are
  supplemental.
- Cards are semantic links with descriptive accessible names.
- Loading uses `aria-busy` and non-jarring skeletons.
- Retry controls are keyboard reachable and announce the affected list type.
- Member carousel controls support keyboard navigation and visible focus.
- Cards and carousel entries preserve full Nostr identifiers internally and
  use normal UI overflow handling rather than truncating source data.
- User-facing copy follows Divine's casual-direct voice.
- Icons come from `@phosphor-icons/react`.
- The feature introduces no gradients, all-caps Tailwind classes, or
  non-brand fonts.
- The desktop shelf shows three cards. Narrow screens use a horizontally
  scrollable shelf without shrinking tap targets below accessible sizes.

## Testing

### Pure parser and mapping tests

- Decode valid kind-`30000` metadata and ordered full pubkeys.
- Fall back from missing title to `d`.
- Reject wrong kinds, missing `d`, and `d=block`.
- Deduplicate by full address and retain the newest event.
- Keep identical `d` values distinct across list kinds.
- Merge and order presentation records correctly.

### Hook tests

- Query kind `30000` with the profile author.
- Query kind `30005` through the existing hook without changing its filter.
- Preserve successful results when the sibling query fails.
- Resolve people-list detail by owner plus `d`.
- Batch member-video queries and deduplicate addressable videos.
- Apply existing blocked-content filtering.

### Component and route tests

- Render no shelf for a profile with no lists.
- Render a mixed, visibly labeled shelf above Videos.
- Limit the profile shelf to three cards and show the correct total.
- Navigate Video cards through the unchanged video-list route.
- Navigate People cards through the owner-aware people-list route.
- Render the all-lists gallery and its type filters.
- Render member carousel plus primary video grid on people-list detail.
- Keep public browsing available when logged out.
- Preserve the existing video-list deep-link regression coverage.
- Exercise keyboard, accessible-name, loading, empty, partial-error, and retry
  behavior.

### Visual verification

Playwright coverage will verify the profile shelf at desktop and mobile
breakpoints and check that the new surfaces introduce no axe WCAG 2 A/AA
violations.

## Out of Scope

- Creating, editing, or deleting people lists on Web.
- Private NIP-44 list decryption.
- Subscribing or unsubscribing.
- Persisting subscribed list addresses.
- Merging subscribed list content into Home.
- Ranking public lists globally.
- Changing Divine Mobile.
- Replacing or migrating existing kind-`30005` events.

## Subscription Follow-Up

The intended later behavior is live subscription:

- a subscribed people list supplies videos from its current members;
- a subscribed video list supplies videos currently referenced by that list;
- curator updates automatically affect the subscriber's available feed
  sources.

That work requires a separate design for portable persistence, full-address
identity, refresh semantics, attribution, and Home-feed composition. Mobile's
current local list-ID subscription cache demonstrates the product behavior but
is not a cross-device protocol contract to copy unchanged.

## Acceptance Criteria

The discovery slice is complete when:

1. A public profile with lists shows a mixed, clearly labeled shelf above
   Videos.
2. `See all` shows every successfully loaded public people and video list for
   that profile.
3. Existing video-list links behave exactly as before.
4. A public people-list link resolves by full owner address and displays
   member videos as primary content with the people carousel above.
5. Partial failures do not break the profile or hide the successful list type.
6. Logged-out visitors can browse every new discovery surface.
7. Focused unit, component, route, visual, and accessibility checks pass.

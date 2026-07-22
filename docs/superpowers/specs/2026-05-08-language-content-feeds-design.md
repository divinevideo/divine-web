# Language-Filtered Content Feeds

**Date:** 2026-05-08

## Goal

Make content language a first-class, cross-cutting filter expressed in the URL. Add a `/languages` index page showing every language we have content in, and accept a `/<lang>` URL prefix on every feed-shaped page so any feed can be viewed in any language.

The animating idea is creator recruitment: when non-English speakers see that diVine has a Spanish or Portuguese or Filipino feed — even if it's small today — they get a destination that says "we want you here, in your language." Visibility encourages publishing.

## Hypothesis This Tests

Today the corpus is roughly 78% English, 18% untagged, ~4% everything else (sample of 200 recent + trending videos). If we surface non-English pools as visible destinations, more non-English content will be published. We will know the hypothesis is bearing out if the share of non-English videos meaningfully grows over the weeks following ship. If it doesn't, the prefix grammar is still useful infrastructure — but the index page would be the thing to revisit.

## Distinction From UI Locale

This is **not** UI translation. UI locale lives in local storage and is set via the existing language switcher (see `2026-04-09-i18n-l10n-kickoff-design.md`, which deliberately keeps UI locale out of URLs). This spec is about **content** language: which videos appear in the feed, expressed in the URL because feeds are shareable destinations.

The two systems are independent. A user can have UI locale `en` while browsing `/es/discovery/hot`, and that's correct — the chrome is in English, the videos are in Spanish.

## URL Grammar

A new optional prefix segment, before any feed-shaped route:

| Without prefix | With prefix |
| --- | --- |
| `/discovery/hot` | `/es/discovery/hot` |
| `/trending` | `/pt/trending` |
| `/hashtag/skate` | `/es/hashtag/skate` |
| `/hashtags` | `/es/hashtags` |
| `/category/sports` | `/pt/category/sports` |
| `/category` | `/es/category` |
| `/search?q=futebol` | `/pt/search?q=futebol` |
| `/leaderboard` | `/es/leaderboard` |
| `/` | `/es` |

Prefix segment is a 2- or 3-character ISO 639 code, lowercased. Validation is data-driven from `/api/languages` (see Backend), not from the UI locale list — the prefix accepts any language code Funnelcake reports content in, including ones the UI hasn't been translated to.

`/languages` is the index page and is **not** itself prefixable: `/es/languages` 404s. Prefixing the index would be incoherent.

### Routes that do NOT accept the prefix

Profile pages, single-video pages, single-event pages, message pages, settings, upload, NIP-19 catch-all, and all auth/legal pages. Single videos have one language by definition; profiles are about a person, not a corpus; settings and auth aren't content. Adding the prefix to these would be noise.

### Bare `/<lang>`

`/es` (no further path) routes to the same view as `/es/discovery` — the user's discovery feed, language-filtered. This makes language a sensible "home" once chosen.

## Routing Strategy

The existing route table ends with a catch-all `<Route path="/:nip19" element={<NIP19Page />} />`, which today would intercept `/es` and pass `es` to `getDirectSearchTarget`. We must place the language-prefixed routes **before** the catch-all, and we must validate the prefix is a known language code rather than treating any 2-char string as a language.

The validation comes from a small in-memory set populated by the languages index query (`useLanguagesIndex`). On first paint, before the index has loaded, we use a conservative bootstrap allowlist of the 16 languages already in the i18n config (these are guaranteed to exist as UI translations and are very likely to have content) so the route doesn't briefly 404 on cold load. After the index loads, the allowlist becomes the union of bootstrap + API-reported codes.

Implementation shape:

```tsx
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

`LanguagePrefixGuard` checks the `:lang` segment against the live allowlist. Unknown codes fall through to the existing `<NIP19Page />` catch-all (preserving current behavior — e.g. someone shares an old `/note1...` link). Crucially, this means the guard must `<Navigate>` to a path the catch-all will see, not render NotFound directly.

The guard also exposes the active language to descendants via a `LanguageContext` so each page's data hooks can read it without re-parsing the URL.

## Backend Dependency

This is a divine-funnelcake repo change. **Today, no list endpoint accepts a `language` parameter.** Verified via OpenAPI spec.

### Endpoints that need a `language` query parameter added

- `GET /api/videos` and `GET /api/v2/videos` — discovery, trending, recent
- `GET /api/search` and `GET /api/v2/search` — full-text and tag search
- `GET /api/leaderboard/videos` and `GET /api/leaderboard/creators` — leaderboards
- `GET /api/hashtags` and `GET /api/hashtags/trending` — for the hashtag index in the prefix variant
- `GET /api/categories` — for the category index in the prefix variant

When `language` is unset, behavior is unchanged. When set, results are filtered to videos whose `language` field equals the supplied code. Untagged videos (no `language` field) never match.

`GET /api/users/{pubkey}/videos` and the leaderboard creator endpoint are explicitly out of scope for the prefix because profile and creator-leaderboard surfaces aren't language-prefixed in this design.

### New endpoint

`GET /api/languages` — returns the catalog for the index page.

```json
{
  "languages": [
    {
      "code": "en",
      "video_count": 12480,
      "creator_count": 3214,
      "sample_thumbnails": ["https://media.divine.video/...", "..."]
    },
    {
      "code": "es",
      "video_count": 47,
      "creator_count": 19,
      "sample_thumbnails": ["...", "..."]
    }
  ]
}
```

Sorted by `video_count` descending. Threshold for inclusion: `video_count >= 1`. Sample thumbnails are 0–3 most-recent or top-trending video thumbnails in that language; missing or empty arrays are valid for sparse pools. The endpoint can be cached on a few-minute interval — it does not need to be live.

Funnelcake should also include the language list in any internal counts/stats it already publishes, so the corpus shift hypothesis can be tracked over time.

## Frontend Architecture

### New files

- `src/pages/Languages.tsx` — index page (`/languages`)
- `src/components/language/LanguageBanner.tsx` — the in-context indicator that shows the active language with an exit affordance
- `src/components/language/LanguageShowcaseCard.tsx` — top-of-index card with thumbnails
- `src/components/language/LanguageStatCard.tsx` — long-tail card without thumbnails
- `src/contexts/LanguageContext.tsx` — propagates active language to data hooks
- `src/AppRouter/LanguagePrefixGuard.tsx` — validates the `:lang` segment, sets context, renders `<Outlet />`
- `src/hooks/useLanguagesIndex.ts` — fetches `/api/languages`, exposes the live allowlist
- `src/hooks/useActiveContentLanguage.ts` — convenience hook for reading the context
- `src/lib/languageNames.ts` — ISO 639 code → endonym + English name; uses `Intl.DisplayNames` where possible, with a small override map for codes the runtime doesn't cover

### Modified files

- `src/AppRouter.tsx` — add the `:lang` parent route before the catch-all; add `/languages` route
- `src/hooks/useInfiniteVideosFunnelcake.ts` — accept a `language` filter, pass to API
- `src/hooks/useInfiniteSearchVideos.ts` — accept a `language` filter
- `src/hooks/useSearchHashtags.ts` — accept a `language` filter (for the hashtag index in prefix mode)
- `src/hooks/useCategories.ts` — accept a `language` filter (for the category index in prefix mode)
- Each affected page (`DiscoveryPage`, `HashtagPage`, `CategoryPage`, `SearchPage`, `TrendingPage`, `HashtagDiscoveryPage`, `CategoriesIndexPage`, `LeaderboardPage`) — read active language from context, pass to its hook(s), include `<LanguageBanner />` near the top when active
- Sidebar component — add a "Languages" entry linking to `/languages`

### Hook integration shape

```ts
const language = useActiveContentLanguage(); // 'es' | undefined
const videos = useInfiniteVideosFunnelcake({
  feedType: 'trending',
  sortMode: 'hot',
  language, // new field, undefined when not in a prefix
});
```

Pages don't need to know about prefix routing; they just consume the context.

## `/languages` Index Page

Single-page, no pagination. Hybrid layout to handle the long tail honestly:

- **Showcase** — top 6 languages by `video_count` render as `<LanguageShowcaseCard>`. Each card shows endonym (large, e.g. `Português`), English name (small, e.g. `Portuguese`), video count, creator count, and 1–3 thumbnails arranged horizontally. Click anywhere → `/<code>`.
- **Long tail** — remaining languages render as `<LanguageStatCard>` in a denser grid: endonym + English name + video count, no thumbnail. Same click target.
- The user's preferred UI locale, if it has any content, gets a subtle visual highlight (border accent or "your language" tag) regardless of where it falls in the count ranking — so a Filipino speaker recognizes their home immediately even if Filipino is in the long tail.
- Empty pools (`video_count < 1`) do not appear. Pools with `video_count >= 1` always appear, including languages with `creator_count === 1`. The "be the first" energy is the point.

## In-Context UI Affordance

`<LanguageBanner />` renders near the top of every page when an active language is present. It says, in the language's endonym: "Showing Spanish · See all languages." The "See all languages" link clears the prefix from the current path (e.g. `/es/hashtag/skate` → `/hashtag/skate`). This is the user's exit; without it, prefix mode is a trap.

The banner should be small and quiet — not a full-width hero. Its job is to remove ambiguity, not to dominate the page.

## Untagged Content

The 16–18% of videos with no `language` field never appear on any prefixed feed. They continue to appear on the unprefixed (default) feeds. This is correct: the absence of a language tag is itself information, and we shouldn't lie about it by bucketing untagged videos under English.

There is no "Unspecified" or "Other" tile on the languages index. That's a non-destination by design.

## Sharing Semantics

When a user shares a prefixed URL (e.g. `/pt/hashtag/futebol`), the recipient lands in the same language-filtered context regardless of their own UI locale or browser language. This is desirable — the share is the context. The recipient can clear the prefix via the `<LanguageBanner />` exit.

The default share behavior (using the `useShare` hook) does **not** automatically inject the active language prefix. If a user is at `/es/hashtag/skate` and hits Share, they share `/es/hashtag/skate`. If they're at `/hashtag/skate`, they share `/hashtag/skate`. The URL bar is the source of truth.

## Mobile Considerations

The existing mobile redesign uses an immersive feed model. Prefixed feeds inherit that model — `/es/discovery/hot` on mobile is the immersive feed, just filtered. The `<LanguageBanner />` slides into the existing top-bar real estate as a small chip rather than a banner.

The `/languages` index is a "browse" surface and uses a conventional scrollable list on mobile, not the immersive model. Showcase cards stack vertically; long-tail cards become a 2-column grid.

## Testing

### Backend (in funnelcake repo, separate spec)

Out of scope for this document.

### Frontend unit / hook tests

- `useLanguagesIndex` returns sorted languages, surfaces the live allowlist, handles empty / single-language responses
- `useInfiniteVideosFunnelcake` passes `language` through to the request URL when set, omits it when unset
- `LanguagePrefixGuard` accepts known codes, falls through to NIP-19 for unknown codes, falls through during cold-load using the bootstrap allowlist
- `languageNames.ts` returns endonyms for common codes and falls back gracefully for unknown ones

### Page-level integration tests

For each affected page, add a test that mounts the page under a prefixed route and asserts the data hook received the language filter. We don't need full feed-render tests for every prefix variant — the page is the same, only the data filter changed. One canonical test per page is enough.

### End-to-end

Add a Playwright test that navigates `/` → `/languages` → click `Español` showcase card → land at `/es` → click the banner's "See all languages" link → return to `/`. This covers the entire grammar in one walk.

## Phasing

"Do it all now" still ships in a sane order:

1. **Funnelcake**: add `language` param to the listed endpoints; ship `/api/languages`. No web changes yet.
2. **Web — plumbing**: add `LanguageContext`, `useActiveContentLanguage`, `useLanguagesIndex`, `LanguagePrefixGuard`, route table changes. No UI changes visible yet (no banner, no index page) — but `/es/discovery/hot` works.
3. **Web — index page**: build `/languages`, the showcase + long-tail UI, and the sidebar entry.
4. **Web — banner**: add `<LanguageBanner />` to every affected page, finalize endonym/English-name handling.
5. **Telemetry**: log corpus language distribution snapshots (server-side) so we can see whether the recruitment hypothesis bears out.

Each step is independently shippable. Step 1 must precede 2; 2 must precede 3 and 4; 3 and 4 can interleave; 5 is independent and should ship at or before step 1.

## Non-Goals

- **Geography**. Country / region filtering is explicitly deferred. We do not have the data, inferring it from language is dishonest, and the recruitment goal is well served by language alone. A separate proposal can take this up if the language work succeeds.
- **UI translation as a side effect of the prefix.** `/ja/discovery/hot` does not switch the UI to Japanese. UI locale stays where it is.
- **Per-creator language preferences.** Creators don't pick a language; the language is per-video and is set at publish time (today by client-side detection upstream of this work).
- **Multi-language filters.** No `/es+pt/...`. One language per prefix. If a user wants both, that's a feature for later — for now they navigate between the two destinations.
- **Backend changes to relays / Nostr event schemas.** Language filtering happens entirely at the Funnelcake layer using its existing `language` field. No new Nostr tags introduced.

## Open Questions

- **Bootstrap allowlist behavior on first cold load** — using the i18n locale list (16 entries) is a conservative bootstrap. If a creator publishes in, say, Welsh and a user shares a `/cy/...` URL before the index has loaded, the guard rejects it on the first paint and the URL falls through to NIP-19 → NotFound. The next visit (after the index has loaded once) works. Is this acceptable, or do we want to block initial render on the index query? Probably acceptable; the case is rare and the second click works.
- **Sidebar surfacing weight** — should the "Languages" entry sit prominently in the sidebar, or under an overflow / "Discover" sub-section? Recruitment goal pulls toward prominent; UX restraint pulls toward overflow. Defer to the implementer.
- **Showcase row size** — fixed at 6 in this spec. Could be 4 on mobile. Worth eyeballing once the cards render.
- **What does the bare `/<lang>` route render long-term?** Right now the spec maps it to discovery. If `/<lang>` later becomes a richer "language home" page (showcase of trending creators, hashtags, etc., all in that language), the route table is already set up for it.

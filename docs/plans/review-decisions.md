# Feature Plan Review Decisions

Date: 2026-02-24

## Owner Decisions

1. **Bottom nav 5 items**: Fine to add notifications as 5th item
2. **Notification bell placement**: No preference — implementer's choice
3. **Mark-as-read**: On page open (not explicit click)
4. **Share title/text**: Keep URL-only sharing (match mobile behavior)
5. **Profile share OG tags**: Need edge worker/compute fix for profile OG meta tags before profile sharing is useful
6. **Analytics views**: Funnelcake DOES have per-video views via BOTH `/api/leaderboard/videos` AND `/api/videos/stats/bulk` — reviewer missed both. Backend confirms `COALESCE(vcl.total_views, 0) AS views` in bulk stats query, `VideoStatsOnly` struct has `views: Option<u64>`
7. **List subscriptions**: Must be Nostr-backed from the start (no localStorage dead end)
8. **List search**: Use Funnelcake REST API (note: no REST list endpoint exists yet — needs backend work or NIP-50 validation)

## Verified API Status

| Endpoint | Status | Evidence |
|----------|--------|----------|
| `GET /api/users/{pubkey}/notifications` | EXISTS (needs NIP-98 auth) | Returns 401 (not 404) |
| Per-video views | EXISTS | Both `/api/leaderboard/videos` AND `/api/videos/stats/bulk` return `views`. Backend: `VideoStatsOnly.views: Option<u64>` |
| List/curation REST API | DOES NOT EXIST | All list queries go through WebSocket kind 30005 |
| Funnelcake OpenAPI docs | NOT AVAILABLE | `/api/docs` returns 404 |

## Blockers to Resolve Before Implementation

### Notifications
- Extract existing NIP-98 auth from `useAdultVerification.ts` into shared `src/lib/nip98Auth.ts` (don't rewrite)
- Build notification client on existing `funnelcakeRequest` (don't create parallel infrastructure)
- Auth failures must NOT trip the general circuit breaker
- Verify response schema by making an authenticated curl request

### Analytics
- Reconcile duplicate `FunnelcakeUserResponse` types (src/types/funnelcake.ts vs inline in funnelcakeClient.ts)
- Per-video views are available from BOTH leaderboard AND bulk stats endpoints (web client types may not include the `views` field yet — update `FunnelcakeBulkStatsResponse` to include it)
- Daily interactions chart is misleading (only has `created_at`, not per-day engagement) — defer until backend has time-series data

### Share
- Fix confirmed bugs first: FullscreenFeed.tsx:97 and VideoCard.tsx:306 subdomain/event-ID issues
- Fix `getNostrVideoLink` fallback — generates invalid `nostr:note1<hex>`, should use `nip19.noteEncode()` or `naddr`
- Edge worker OG tags for profiles should be a separate plan

### Lists
- Validate NIP-50 search on kind 30005 with the relay
- Extract duplicated `parseVideoList` to shared `src/lib/listParser.ts`
- Batch thumbnail fetching (don't do 80 individual relay queries)
- Skip hardcoded featured picks (Phase 3) — tech debt with no migration path
- List subscriptions must be Nostr-backed (kind 10003 or custom kind), not localStorage

## Recommended MVP Scope per Feature

### Notifications MVP
- NIP-98 auth extraction + notification client
- Basic notification list (no filter tabs, no thumbnails, no date headers)
- Page + route
- Bell badge with unread count

### Share MVP
- Phases 1+2 only: extract shareUtils.ts, fix the 2 bugs, update all callsites
- Defer profile share, Nostr links, edge worker OG tags

### Analytics MVP
- KPI summary cards (videos, views, reactions, followers — known-good data)
- Top content table (top 10 by reactions, with views from leaderboard)
- Route + nav entry
- Defer: daily chart, time period selector, engagement breakdown

### Lists Discovery MVP
- Phase 1: ListPreviewCard with thumbnail mosaic (batched fetching)
- Client-side search filter on already-fetched lists
- Defer: featured picks, subscriptions, full NIP-50 search

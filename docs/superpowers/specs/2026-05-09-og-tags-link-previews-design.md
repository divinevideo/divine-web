# Design: Rich Link Previews via Open Graph + Twitter Cards

**Date:** 2026-05-09
**Owner:** Divine web platform
**Status:** Approved for implementation
**Surface:** `compute-js/` (Fastly Compute@Edge worker)

## Problem

URLs to `divine.video` (videos, profiles, hashtags, search, landing) render as bare blue text in Slack and other social platforms instead of rich preview cards with thumbnails, titles, and inline video playback.

The edge worker already serves crawler-only OG/Twitter HTML for `/video/:id`, `/profile/:npub`, and `/category[/:name]`. Verified via `curl -A "Slackbot..."` against production: tags ARE present, image is reachable, MIME types correct. So the existing infrastructure works mechanically but is incomplete and contains a bug that breaks unfurls.

## Root causes

1. **`<meta http-equiv="refresh" content="0;url=...">` inside `buildCrawlerHtml()`** (`compute-js/src/index.js:1115`). Slack's unfurler treats meta-refresh as "the canonical content lives elsewhere" and frequently bails. This is the most likely reason the user sees bare links in Slack today.
2. **`twitter:card="summary_large_image"`** for video pages. Should be `"player"` so Slack/Twitter render an inline player.
3. **No `og:video:*` tags.** Required for inline video playback in Slack.
4. **No `/embed/:id` route** to back `twitter:player`.
5. **No `og:image:width` / `og:image:height`.** Some unfurlers downgrade to small card without these.
6. **`fetchVideoMetadata()` discards video URL and dimensions.** It parses the NIP-71 `imeta` tag but only keeps `image` (thumbnail). Need `url` (mp4), `m` (mime), `dim` (`720x1280`).
7. **Coverage gaps.** `/@username` apex route, `/t/:hashtag`, `/search`, `/discovery[/:type]`, and apex `/` get only the static SPA shell's baseline OG.

## Goals

- Slack, Twitter/X, iMessage, Bluesky, Mastodon, Discord, Threads, Facebook, LinkedIn render rich preview cards for every shareable Divine URL.
- Inline video playback works in Slack and Twitter for `/video/:id`.
- Per-user, per-hashtag, per-search-query metadata where data exists.
- Zero impact on the SPA experience for human visitors (crawler-only path, unchanged).

## Non-goals

- Server-side rendering for human visitors (out of scope, current SPA architecture is correct).
- oEmbed work (existing endpoint stays as-is for WordPress/Discourse/Notion).
- Static OG injection into the SPA `index.html` shell (defense-in-depth, not needed if crawler detection is reliable).

## Architecture

```
Slackbot/Twitterbot request
        │
        ▼
  divine-router (Fastly, upstream)  ── sets X-Original-Host
        │
        ▼
  divine-web compute-js worker
        │
        ├── isSocialMediaCrawler(request)?  no  → SPA fallback (unchanged)
        │
        └── yes
              ├── /video/:id          → handleVideoOgTags     (extended)
              ├── /profile/:npub      → handleProfileOgTags   (extended)
              ├── /@username (apex)   → handleAtUsernameOg    (NEW)
              ├── /t/:tag             → handleHashtagOgTags   (NEW)
              ├── /search?q=          → handleSearchOgTags    (NEW)
              ├── /discovery[/:type]  → handleDiscoveryOgTags (NEW)
              ├── /category[/:name]   → handleCategoryOgTags  (existing, polish only)
              └── /                   → handleApexOgTags      (NEW; uses top trending video)

  /embed/:id  →  served to ALL clients (crawler + iframe), minimal autoplay loop
```

## Component changes

### 1. `buildCrawlerHtml()` (existing, modify)

- **Remove** the `<meta http-equiv="refresh">` line entirely.
- **Add** `og:image:width`, `og:image:height` (defaults 1200×630, overridable).
- **Add optional video block** when `video` argument is provided:
  - `og:video`, `og:video:secure_url`, `og:video:type`, `og:video:width`, `og:video:height`
  - `twitter:card="player"` (overrides default), `twitter:player`, `twitter:player:width`, `twitter:player:height`, `twitter:player:stream`, `twitter:player:stream:content_type`
- Keep `<link rel="canonical">` and the human-readable `<a>` body (for the rare case where a real browser hits the crawler-cached HTML).

### 2. `fetchVideoMetadata()` (existing, modify)

Parse additional `imeta` keys:

- `url` → `videoUrl`
- `m` → `videoMime` (`video/mp4`, `application/x-mpegURL`, etc.)
- `dim` → `videoWidth`, `videoHeight` (`"720x1280"` → `[720, 1280]`)
- `image-dim` → `imageWidth`, `imageHeight` (fallback to dim if not present)

NIP-71 `imeta` examples in our corpus use space-delimited key/value pairs. Reuse the existing parser, just stop discarding fields.

### 3. `handleVideoOgTags()` (existing, modify)

Pass new fields into `buildCrawlerHtml()`:

```js
buildCrawlerHtml({
  title, description, image: thumbnail, url: videoUrl,
  ogType: 'video.other',
  twitterCard: 'player',
  twitterCreator,
  imageWidth, imageHeight,
  video: videoUrl ? {
    url: videoMeta.videoUrl,
    type: videoMeta.videoMime || 'video/mp4',
    width: videoMeta.videoWidth || 720,
    height: videoMeta.videoHeight || 1280,
    embedUrl: `https://divine.video/embed/${videoId}`,
  } : null,
});
```

If we have `videoUrl` we set `twitterCard='player'`; if not, we fall back to `summary_large_image`.

### 4. `/embed/:id` route (NEW)

Served to **all** clients (not crawler-gated). Minimal HTML, ~2KB:

- `<video src="..." muted loop autoplay playsinline>` styled `100vw × 100vh`, black background.
- No JS bundles, no React, no analytics — just the video element.
- Headers:
  - `Content-Security-Policy: frame-ancestors *` (allows iframe in Slack/Twitter)
  - `X-Frame-Options` removed (do not set; Twitter's player iframe requires this)
  - `Cache-Control: public, max-age=300`
- Falls back to a generic poster image if video URL not resolvable.

Implementation in same `index.js` worker. Route check goes BEFORE crawler check so it's served to humans too (e.g., a user pasting an `/embed/` URL into a browser sees the looping video).

### 5. New crawler handlers

All follow the same pattern: detect crawler, call funnelcake, build crawler HTML, return.

#### `handleAtUsernameOg(username, url, funnelcakeTarget)`

Apex `/@username` path. Look up pubkey by NIP-05 (`{username}@{apex}`) via funnelcake or KV `divine-names`, then reuse `handleProfileOgTags` logic with the resolved npub.

#### `handleHashtagOgTags(tag, funnelcakeTarget)`

`/t/:tag`. Hits `GET /api/hashtags/{tag}` (or `/api/videos?t=tag&limit=1`). Title: `"#{tag} videos on Divine"`. Image: top video's thumbnail or `og.png` fallback. Description: video count if available.

#### `handleSearchOgTags(query, funnelcakeTarget)`

`/search?q=...`. Title: `"\"{query}\" on Divine"`. No funnelcake call — too volatile to cache. Generic image. Description includes the query.

#### `handleDiscoveryOgTags(type, funnelcakeTarget)`

`/discovery`, `/discovery/recent`, `/discovery/popular`, etc. Title varies by type. Image: top trending video's thumbnail (we already fetch this for the homepage feed injection at line 205, reuse `fetchFeedData`).

#### `handleApexOgTags(funnelcakeTarget)`

Apex `/`. Same as discovery but with the homepage hero copy. Top trending video as `og:image`.

### 6. Cache strategy

All crawler responses keep `Vary: User-Agent` + 5-minute `max-age=300`. The `Vary: User-Agent` is critical — without it Fastly serves the crawler HTML to humans. Verify by `curl` with and without UA after deploy.

### 7. Crawler list (existing, unchanged)

Already covers Slack, Twitter, FB, LinkedIn, Discord, Telegram, WhatsApp, etc. No additions needed.

## Phasing

Six phases, planned to land as **two PRs**:

**PR 1 — Phase 1 (urgent fix)**

- Phase 1: Remove meta-refresh, add `og:image:width/height`, switch video page to `twitter:card=player`, add `og:video:*` and `twitter:player:*`. Embed URL points to `/embed/:id` even before that route exists — Slack will fall back to the thumbnail until Phase 3 ships.

This phase alone should fix the immediate Slack bare-URL bug.

**PR 2 — Phases 2–6**

- Phase 2: Extract video URL + dimensions from `imeta` in `fetchVideoMetadata()`.
- Phase 3: `/embed/:id` route.
- Phase 4: New crawler handlers — `/@username`, `/t/:tag`, `/search`, `/discovery[/:type]`, apex `/`.
- Phase 5: Tests for all of the above.
- Phase 6: Production validation (curl + FB Sharing Debugger + fresh Slack URL).

## Testing

- **Unit:** `buildCrawlerHtml` outputs (asserts NO meta-refresh, asserts new tags present, asserts video block omitted when no video given).
- **Unit:** `fetchVideoMetadata` `imeta` parser handles `url`, `m`, `dim`, `image-dim` correctly.
- **Unit:** `handleAtUsernameOg`, `handleHashtagOgTags`, `handleSearchOgTags`, `handleDiscoveryOgTags`, `handleApexOgTags` happy-path + funnelcake-failure path.
- **Integration (Vitest):** spin up the compute-js handler in-process, feed it Slackbot UA requests, assert response HTML matches snapshot for each route.
- **Manual prod validation:** `curl -A` for each route, paste fresh URLs into Slack/Twitter to confirm rich previews.

## Risks

- **Slack unfurl cache.** Existing URLs may be cached as bare links per workspace; need fresh URLs (`?v=2`) to verify post-deploy.
- **Twitter `player` card whitelist.** Historically Twitter required apps to register their player domain. Verify `divine.video` is recognized; if not, may need to apply via Twitter dev portal. Fallback is `summary_large_image`.
- **`Vary: User-Agent` cache explosion.** Fastly may cache hundreds of UA variants. Already mitigated since we only set it on crawler-handled paths and `max-age=300` is short.
- **Cloudflare/upstream WAF blocking Slackbot.** Already verified curl-as-Slackbot reaches our origin in prod. Continue monitoring.

## Files touched

- `compute-js/src/index.js` — handlers, `buildCrawlerHtml`, `fetchVideoMetadata`, route table additions.
- `compute-js/src/embedPage.js` (NEW) — `/embed/:id` HTML template.
- `compute-js/src/embedPage.test.ts` (NEW)
- `compute-js/src/ogTags.test.ts` (NEW) — unit tests for `buildCrawlerHtml`.
- `compute-js/src/fetchVideoMetadata.test.ts` (NEW) — unit tests for imeta parsing.

## Out of scope

- Static OG injection into SPA shell.
- Per-locale OG tags (en-only for now; could be follow-up).
- Video transcoding for player compatibility (we already serve H.264 mp4).
- Updating the oEmbed endpoint shape.

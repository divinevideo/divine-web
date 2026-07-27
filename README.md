# Divine Web

Divine is 6-second, human-made video on Nostr — no AI slop. This repo is the web client that powers [divine.video](https://divine.video): a React 18 + TypeScript single-page app, built with Vite, that reads and writes short-form looping videos as Nostr events and renders them in feeds, profiles, and embeds. It ships as a static bundle served from a Fastly Compute edge worker, with a Cloudflare Pages backup.

## Features

- **6-second looping videos** as Nostr kind `34236` (NIP-71 addressable short video), with MP4 and HLS playback and Blurhash placeholders for progressive loading.
- **Feeds**: Home (following), Discovery, Trending/Popular, Hashtag, Categories, and per-user Profile feeds.
- **Search** using [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) full-text search against `relay.divine.video`, including relay-side sort modes (`sort:hot`, `sort:top`, `sort:rising`, `sort:controversial`). Non-NIP-50 relays fall back to chronological results.
- **Social**: likes, reposts, follows, comments/conversations, notifications, direct messages, lists, and leaderboards.
- **Subdomain profiles**: `alice.divine.video` resolves a user's Nostr profile via NIP-05 and renders their feed.
- **Legacy Vine archive** pages for preserving and browsing classic Vine content.
- **Trust & safety**: content moderation settings, age review, and protected-minor safeguards (locked adult-content settings, restricted DMs).
- **Video upload** to Blossom media servers with a metadata form.
- **Internationalization** across 16 locales (`ar de en es fil fr id it ja ko nl pl pt ro sv tr`).
- **Installable PWA** with an offline service worker (apex domain only).
- **Server-rendered embeds and social previews**: the edge worker injects Open Graph tags and serves embed pages so shared links unfurl correctly for crawlers.

## Architecture

The app is a client-side SPA. The entry flow is `index.html → src/main.tsx → src/App.tsx → src/AppRouter.tsx`; routing uses `react-router-dom` v6. Server state comes from `@tanstack/react-query` via `@nostrify/react`, which handles Nostr queries, mutations, and subscriptions. Cross-component state flows through React contexts. Styling is TailwindCSS with Radix UI primitives wrapped in `src/components/ui/` (shadcn/ui conventions).

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full module layout, state model, and relay-routing details.

How it fits the Divine platform:

- **Nostr** is the data layer. The primary relay is `wss://relay.divine.video`; relay routing (`src/lib/relayRouting.ts`) splits reads and writes across profile, badge, and general relay sets. Relay configuration lives in [`src/config/relays.ts`](src/config/relays.ts).
- **Auth** uses [`@divinevideo/login`](https://github.com/divinevideo/login) with a Keycast remote signer, hydrated from cross-subdomain cookies so a session is shared across `*.divine.video`.
- **Blossom** media servers store and serve uploaded video and images; playback also pulls from `cdn.divine.video`.
- **Funnelcake** is the Divine REST API (`api.divine.video`, staging at `api.staging.divine.video`), used alongside the relay for feeds and video metadata. Configured in [`src/config/api.ts`](src/config/api.ts).
- **Moderation** is backed by `moderation-api.divine.video`.
- **Edge worker** (`compute-js/`) is a Fastly Compute JavaScript app that handles crawler requests, Open Graph tags, embed pages, `.well-known` app-link files, and host redirects, proxying to the funnelcake backend for video metadata.

## Getting started

Requires Node.js 20 (see `.node-version`) and npm.

```bash
npm run dev      # start the Vite dev server on http://localhost:8080
npm run build    # production build to dist/ (+ 404.html, .well-known, prerendered legal pages)
npm run preview  # preview the production build
npm test         # type-check, lint, unit tests (Vitest), then build — the CI gate
```

Visual regression tests run under Playwright:

```bash
npm run test:visual          # run snapshot tests
npm run test:visual:update   # update snapshots
```

## Configuration

Copy `.env.example` to `.env`. Environment variables (all optional):

- `VITE_SENTRY_DSN` — Sentry DSN for error tracking.
- `VITE_SENTRY_DEV_ENABLED` — set to `true` to enable Sentry in development (disabled by default).

Relay endpoints are defined in [`src/config/relays.ts`](src/config/relays.ts) and API base URLs in [`src/config/api.ts`](src/config/api.ts).

## Deployment

Pushing to `main` triggers the `Deploy to Production` GitHub Actions workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), which builds the bundle once and then deploys it to two targets:

1. **Fastly Compute (primary)** — publishes the edge worker from `compute-js/`, uploads the static bundle to the Fastly KV store, purges the cache, and verifies that the live `.well-known` endpoints and frontend bundle match the build before finishing.
2. **Cloudflare Pages (backup)** — deploys `dist/` to the `divine-web-direct-deploy` project via Wrangler.

A failed deploy probes the live apex and alerts `#divine-alerts`. To run the Fastly worker locally:

```bash
npm run fastly:local   # build, then start the local Fastly Compute server
```

`DEPLOYMENT.md` documents the Cloudflare Pages backup path in more detail.

---

Part of [Divine](https://divine.video) — your playground for human creativity · [Brand guidelines](https://github.com/divinevideo/brand-guidelines)

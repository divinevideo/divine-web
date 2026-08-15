# Architecture

> Short-form video platform built as a TypeScript/React SPA on the Nostr
> protocol. Accurate as of the last commit to this file. When changing files
> referenced here, update this document in the same commit.

## Stack

[TypeScript 5.5](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html), [React 18](https://18.react.dev), [Vite 6](https://github.com/vitejs/vite/blob/main/packages/vite/CHANGELOG.md#500-2024-11-26), TailwindCSS 3. npm for package management.
Output to `dist/`.

## Entry Point Flow

```
index.html → src/main.tsx → src/App.tsx → src/AppRouter.tsx
```

[`src/main.tsx`](./src/main.tsx) sets up root services (Sentry, i18n, etc),
hydrates login from cross-subdomain cookies, registers the PWA service worker
(apex domain only), then mounts the React tree inside an `ErrorBoundary`.
[`src/App.tsx`](./src/App.tsx) assembles multiple provider layers and UI
primitives (toast, tooltip). Add new providers there. [`src/AppRouter.tsx`](./src/AppRouter.tsx) defines all routes using
react-router-dom `BrowserRouter`. Pages import directly or via `lazy()`. Add
new routes there.

## Source Layout

```
src/
  components/    reusable UI (Radix-based design system in components/ui/)
  pages/         route-level components, named *Page.tsx
  hooks/         custom React hooks, named useX.ts
  lib/           utilities, helpers, external integrations
  contexts/      React context providers
  types/         shared TypeScript definitions
  config/        relay lists and app configuration
  data/          static data files
  styles/        global stylesheets
  test/          test setup (setup.ts) and utilities
```

Import alias: `@/` maps to `src/` ([`tsconfig.json`](./tsconfig.json) +
[`vite.config.ts`](./vite.config.ts) resolve.alias).

## State Management

Component-local state uses `useState` and `useReducer` through custom hooks in
[`src/hooks/`](./src/hooks/). Cross-component state flows through React
contexts (`AppContext`, `VideoPlaybackContext`, `FullscreenFeedContext`,
`NWCContext`, `LoginDialogContext`). Server state comes from
`@tanstack/react-query` via `@nostrify/react`, which handles queries, mutations,
and subscriptions against Nostr relays. Auth uses `@divinevideo/login` with
`NostrLoginProvider`, hydrated from cross-subdomain cookies.

### Notification Read Marker

Web and mobile both write the same Funnelcake per-pubkey notification read
marker through `POST /api/users/{pubkey}/notifications/read` with an empty body.
On web, [`src/pages/NotificationsPage.tsx`](./src/pages/NotificationsPage.tsx)
marks the All tab read once per page mount after the notifications query
successfully loads, even when the fetched list is empty or already read. Filtered
tabs do not mark read.

Web deliberately does not mark read on `refetchOnWindowFocus`. Mobile marks
after an explicit unfiltered pull-to-refresh, but excludes app resume; the web
window-focus refetch maps to app resume, not to that deliberate refresh gesture.

Until Funnelcake supports bounded read-marker writes (divine-funnelcake #938),
the empty-body request advances the marker to server time. That can cover
notifications whose source events existed before the request but whose inbox
rows had not materialized yet. Web accepts that tradeoff only for the
once-per-mount All-tab write.

## Routing

Client-side SPA routing via react-router-dom v6.
[`src/AppRouter.tsx`](./src/AppRouter.tsx) handles all routes. Subdomain-based
routing resolves user profiles (e.g., `alice.divine.video/`) by reading the
subdomain and loading the corresponding Nostr profile. Static hosts use
`404.html` (copied from [`index.html`](./index.html) during build) as a
catch-all fallback.
The retired `/discovery/new` chronological feed redirects to
`/discovery/hot`; Discovery does not expose or mount an all-new-video feed.
`/discovery/:tab` accepts the built-in Discovery tabs plus the currently
eligible server-configured featured tab slug, when Funnelcake serves one.
Public profiles expose a compact mixed NIP-51 list shelf and a filterable
`/profile/:npub/lists` gallery. Kind `30005` video sets and kind `30000`
people sets use separate owner-aware detail routes: `/list/:pubkey/:listId`
for video lists and `/people-lists/:pubkey/:listId` for people lists. Keeping
people lists outside `/list/*` preserves compatibility with installed mobile
apps, which claim `/list/*` for video-list deep links. Kind `30000` is not
uniformly a people set: reserved system lists such as mute, block, DM-contact,
hidden, and deny lists also use kind `30000` events. Their normalized d-tags
are rejected by
[`parsePeopleListFromEvent`](./src/lib/parsePeopleListFromEvent.ts), so the
route builders in [`src/lib/eventRouting.ts`](./src/lib/eventRouting.ts) leave
them on the generic event route rather than sending them to a detail page that
cannot render them. Divine clients no longer author `d=block` kind `30000`
lists; web reads that list only for legacy compatibility with pre-retirement
accounts and older or non-Divine clients.
People-list detail routes preserve `?relays=` hints from NIP-19 addresses and
generic event redirects so lists published only to non-default relays can still
be resolved.

## Styling

TailwindCSS utility classes throughout. `tailwind-merge` resolves class
conflicts. Radix UI primitives wrapped in
[`src/components/ui/`](./src/components/ui/) with `class-variance-authority`
for variant management. No CSS modules or styled-components.

## Build Pipeline

```
vite build
cp dist/index.html dist/404.html
node scripts/copy-well-known.mjs
node scripts/prerender-legal.mjs
node scripts/verify-well-known.mjs
```

Dev server runs on port 8080 with CORS proxies for `/cdn-proxy`
(cdn.divine.video) and `/api/moderation` (moderation-api.divine.video).
Configuration lives in [`vite.config.ts`](./vite.config.ts). Deploy targets are
`nostr-deploy-cli` or Cloudflare Pages (`wrangler pages deploy`).

## Edge Shell And The Content-Security-Policy

On Fastly, some routes are not served from
[`index.html`](./index.html) at all. The Compute worker in
[`compute-js/`](./compute-js) renders its own HTML document from
[`compute-js/src/templates/shell.js`](./compute-js/src/templates/shell.js) —
identifiable by the `x-divine-edge: template` response header — and that shell
boots the same SPA bundle. `/` and `/discovery/hot` go through it today;
[`compute-js/src/index.js`](./compute-js/src/index.js) can route more.

The CSP therefore exists as **two copies**: the meta tag in `index.html` and
`SHELL_CSP` in `shell.js`. They must stay byte-identical. A directive present
in one and not the other makes a feature work on some routes and fail silently
on others, with no server-side error — the failure surfaces only as a blocked
request in the visitor's console.

- `index.html` is the source of truth. Edit it, then copy the same string into
  `SHELL_CSP`.
- [`tests/csp-single-source.test.ts`](./tests/csp-single-source.test.ts) fails
  the build if they diverge.
- [`scripts/verify-live-bundle.mjs`](./scripts/verify-live-bundle.mjs) checks
  the policy the edge actually serves after deploy, because the two halves ship
  separately: `fastly:deploy` publishes the Wasm worker carrying `SHELL_CSP`,
  `fastly:publish` pushes `index.html` to the KV store. Run **both**.

Note the CSP is meta-only — there is no CSP response header, so `report-uri`
and `report-to` are ignored and violations are never reported back.

## Key Dependencies

`@nostrify/nostrify` and `@nostrify/react` provide the Nostr protocol client
and React bindings. `@divinevideo/login` handles authentication.
`@tanstack/react-query` manages server state. `react-router-dom` handles
client-side routing. `@radix-ui/*` provides headless UI primitives.
`react-hook-form`, `@hookform/resolvers`, and `zod` handle forms and
validation. `i18next` and `react-i18next` power internationalization across 20
locales. `@fontsource-variable/inter` supplies typography.
`@phosphor-icons/react` is the icon library (migrated from lucide-react).
`hls.js` handles HLS video playback. `@sentry/react` tracks errors.
`@unhead/react` manages the document head. `sonner` and `vaul` provide toast
and drawer UI. `vite-plugin-pwa` generates the PWA service worker.

## Linting

ESLint 9 with TypeScript, React Hooks, HTML, and three custom rules in
[`eslint-rules/`](./eslint-rules/):

- [`no-inline-script`](./eslint-rules/no-inline-script.js): prevents inline
  `<script>` tags in HTML
- [`no-placeholder-comments`](./eslint-rules/no-placeholder-comments.js):
  catches TODO/FIXME without issue tracking
- [`require-webmanifest`](./eslint-rules/require-webmanifest.js): enforces web
  manifest presence

## Testing

Unit tests use Vitest with `@testing-library/react` on jsdom. Setup lives in
[`src/test/setup.ts`](./src/test/setup.ts). Tests colocate with source as
`*.test.ts` or `*.test.tsx`. Visual regression uses Playwright with snapshot
assertions via `npm run test:visual`. The CI gate runs `npm run test`, which
executes type-check, lint, unit tests, then build.

## Naming Conventions

Components use `PascalCase.tsx`. Hooks use `useX.ts`. Pages use `*Page.tsx`.
Tests use `*.test.ts(x)` next to the file under test. Utilities use
`camelCase.ts`.

## External Integrations

Nostr relays are configured in [`src/config/relays.ts`](./src/config/relays.ts).
Firebase Analytics runs behind GDPR cookie consent. Sentry handles error
tracking. Media assets come from cdn.divine.video. Content moderation uses
moderation-api.divine.video. HubSpot provides the cookie consent banner.

### Relay Routing

[`src/lib/relayRouting.ts`](./src/lib/relayRouting.ts) defines the
`reqRouter` and `eventRouter` factories used by
[`src/components/NostrProvider.tsx`](./src/components/NostrProvider.tsx).
Reads split filters into profile (kinds 0/3/10011), badge
(8/30008/30009), and other groups; each group is fanned out to its
relay set. Writes fan out to the primary relay plus `PROFILE_RELAYS`
for kind 0/3/10011, list kinds 30000/30001/30005, and NIP-09 deletion
requests whose `k` tag targets one of those list kinds. Other writes use
`PRESET_RELAYS` (capped at 5). **Mute lists (kind 10000) are write-restricted to
`{primary} ∪ PROFILE_RELAYS`** so the write set is aligned with the
read set and a user's populated list on a public relay is not
clobbered by a web-side write that the web read path would never see.

## Moderation Provenance

The kind 10000 mute list is a flat set of p-tags, so web cannot tell an
ordinary mute from a Block the Divine app set. Two local stores in
[`src/lib/moderationProvenance.ts`](./src/lib/moderationProvenance.ts) fill that
gap, both keyed by the signed-in viewer and read only for that viewer's own
list:

- **Block and web-mute provenance** — which p-tags web itself added, and which
  of those were Blocks. `useMuteList` labels each user entry `web` or `unknown`;
  [`src/pages/ModerationSettingsPage.tsx`](./src/pages/ModerationSettingsPage.tsx)
  groups them accordingly and confirms every unmute, because an `unknown` entry
  may be state another client still depends on. Provenance is a UI signal, not
  an authorization boundary — the relay list stays authoritative.
- **Remembered own list snapshot** — the newest kind 10000 web has seen or
  published. A relay that misses the list or answers with an older copy would
  otherwise make the next publish drop entries the user still has muted, so the
  snapshot wins whenever its `created_at` is newer. The newest copy always
  wins, so another client's legitimate removal is never resurrected.

Mutations additionally refuse to publish unless the relay read reached EOSE
(`MuteListUnavailableError`), so an unestablished read is never mistaken for an
empty list.

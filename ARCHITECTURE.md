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

## Routing

Client-side SPA routing via react-router-dom v6.
[`src/AppRouter.tsx`](./src/AppRouter.tsx) handles all routes. Subdomain-based
routing resolves user profiles (e.g., `alice.divine.video/`) by reading the
subdomain and loading the corresponding Nostr profile. Static hosts use
`404.html` (copied from [`index.html`](./index.html) during build) as a
catch-all fallback.

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

## Key Dependencies

`@nostrify/nostrify` and `@nostrify/react` provide the Nostr protocol client
and React bindings. `@divinevideo/login` handles authentication.
`@tanstack/react-query` manages server state. `react-router-dom` handles
client-side routing. `@radix-ui/*` provides headless UI primitives.
`react-hook-form`, `@hookform/resolvers`, and `zod` handle forms and
validation. `i18next` and `react-i18next` power internationalization across 16
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
for kind 0/3/10011 and to `PRESET_RELAYS` (capped at 5) for everything
else. **Mute lists (kind 10000) are write-restricted to
`{primary} ∪ PROFILE_RELAYS`** so the write set is aligned with the
read set and a user's populated list on a public relay is not
clobbered by a web-side write that the web read path would never see.

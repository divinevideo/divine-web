# Page Link Previews: One Source For Fixed Pages

Issue: #726

## Problem

Shared links to many fixed divine.video pages preview as the homepage, and some
preview correctly only in apps on the edge's crawler allowlist. Page metadata
is hand-maintained in six places, each covering a different set of pages:

| Where | Consumer | Covers |
| --- | --- | --- |
| `src/seo/marketingSeo.ts` | React head + family prerender | `/family/*` |
| `scripts/prerender-legal.mjs` (`PAGES`) | build-time static HTML | legal pages, `/faq`, `/services` |
| `compute-js/src/index.js` + `crawlerHandlers.js` | Fastly edge, allowlisted crawlers only | `/kids`, `/age-review`, `/download`, `/family` |
| `src/lib/serverSocialMeta.ts` | Cloudflare Pages function | same four, plus data-driven routes |
| per-page `useHead` / `useSeoMeta` | browser tab | 6 pages |
| `public/sitemap.xml` | search engines | 15 URLs; 14 of the 28 fixed pages missing |

Measured against production on 2026-09-24: 14 fixed pages plus
`/account-portability` send the homepage preview to every app; `/kids`,
`/age-review`, `/download`, and `/discovery` are correct only for allowlisted
crawlers; build-time prerendered pages are correct for every app.

## Goals

- Every fixed public page on the apex host (`divine.video`) previews as itself
  in any app.
- One table is the only place a fixed page's title, description, and image are
  written. Link previews, browser tab titles, and the sitemap all read from it.
- Adding a public route without deciding its preview fails a test.

## Non-goals

- Data-driven routes keep their existing handlers: `/`, `/discovery`,
  `/category`, `/search`, videos, profiles, hashtags, `/@username`.
- Vanity subdomains (`<name>.divine.video`), which serve a profile for every
  path.
- Localized previews or descriptions. Crawlers send no language.
- Rendering page bodies at build time for pages that don't already get it.
- `/faq` host split: Cloudflare redirects `/faq` to `about.divine.video/faqs/`
  (`public/_redirects`) while Fastly serves the prerendered page. Deferred to a
  separate change; this work preserves both behaviors.
- `divine-supporters` (divine-supporters#21).

## Decisions

| Decision | Choice |
| --- | --- |
| Delivery | Build-time head injection: one static file per fixed page. No per-request rewriting, no user-agent checks. |
| Tab titles | Driven by the same table, applied once at the router level. |
| Title format | New tab titles are `"<Page> - Divine"`. A title that already names Divine or already carries a suffix is used as written. Existing translated titles are reused unchanged, never replaced. "Divine Web" is dropped. Existing em-dash titles stay pending Marketing/Comms. |
| Title source | Translated pages reference their existing translation keys. English-only pages hold plain English. |
| Descriptions | Plain English in the table, not translated. Drafted from page content; Marketing/Comms approves before merge. |
| New translation keys | None expected. If one is unavoidable, it follows the #716 English-placeholder precedent and avoids the word "loop" (the loop glossary test rejects it in ms, ur, vi, zh). |
| `/account-portability` | Server-side 301 to `/exit` on Fastly and Cloudflare (it has forwarded to `/exit` in the client since #591); the client redirect stays as a fallback. No table row. |
| Sitemap | Generated from the table at build time; `public/sitemap.xml` is deleted. |
| PR shape | One PR against `main`, commits split by concern. |
| Deploy safety | Verified before merge on local Fastly and a Cloudflare preview deploy. The few-minute window between the Wasm deploy and the KV publish, where the four removed handlers' pages preview as the homepage, is accepted. |

## Pages

**In the table (28):** `/authenticity`, `/privacy`, `/terms`, `/open-source`,
`/proofmode`, `/human-created`, `/dmca`, `/safety`, `/family`,
`/family/talking-to-your-teen`, `/family/media-plan`,
`/family/when-something-goes-wrong`, `/family/safety-tools`, `/age-review`,
`/kids`, `/download`, `/exit`, `/exit/start`, `/delete-account`, `/support`,
`/faq`, `/get-embed`, `/services`, `/merch`, `/leaderboard`, `/trending`,
`/popular`, `/hashtags`.

**Excluded, with reason recorded in code:**

- Logged-in only: `/home`, `/notifications`, `/messages`, `/analytics`,
  `/lists`, `/collabs`, `/settings/moderation`, `/settings/linked-accounts`,
  `/settings/relays`, `/debug-video`.
- Auth callbacks: `/app/callback`, `/auth/callback`.
- Redirects: `/account-portability`, `/discovery/new`.
- Dev only: `/__brand-preview`.
- Data-driven, handled elsewhere: `/`, `/discovery`, `/category`, `/search`.
- Parameterized routes (`/:nip19`, `/video/:id`, `/invite/:code`, and so on).

(`/upload` appears only inside a JSX comment in `AppRouter.tsx` and is not a
live route.)

## Design

### 1. The table (`src/seo/pageSeo.ts`)

One row per fixed page:

- `path` (required)
- `title` (required): plain English string or a translation key reference
  (`{ key, ns? }`)
- `description` (required): plain English
- `previewTitle`, `previewDescription` (optional): used for `og:*` and
  `twitter:*` when the preview should differ from the tab title and meta
  description (family routes, `/merch`, `/leaderboard` today)
- `image` (optional, defaults to `/og.png`, 1200x630), `imageAlt` (optional,
  defaults to the preview title)
- `type` (optional, `website` default; family guides stay `article`)
- `lastModified` (optional, for the sitemap; family rows carry `MARKETING_PUBLICATION_DATE`, 2026-07-22)
- `prerenderedBy` (optional, `legal` | `marketing`): marks rows whose page body is rendered by an existing prerender script, so the new step skips them

Derived, never written per row: canonical URL (`https://divine.video` + path),
`og:site_name` "Divine", image dimensions and type.

`marketingSeo.ts` keeps family-only fields (breadcrumb, campaign, publication
date) and reads title, description, preview fields, and image from the table.
`src/components/family/JsonLd.tsx` reads through the same resolver.

A resolver turns a row into English strings for build use, and into the active
language's strings for client use via i18next.

### 2. Shared head renderer and build step

One head renderer (plain JS, importable by build scripts) produces the full
tag set from a resolved row: `<title>`, `description`, `canonical`, `og:type`,
`og:url`, `og:title`, `og:description`, `og:image`, `og:image:width`,
`og:image:height`, `og:image:type`, `og:image:alt`, `og:site_name`,
`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`. It
removes any of these tags from the source HTML before inserting its own, so
nothing from the homepage shell survives.

Build scripts load the TypeScript table through Vite's `ssrLoadModule`, as
`prerender-marketing.mjs` already does (CI and deploy run Node 20, which cannot
import `.ts` directly).

A new step runs after `vite build`. For each row without `prerenderedBy`, it
copies `dist/index.html`, applies the head renderer, and writes
`dist/<path>/index.html`. Ownership lives on the row, not in the prerender
scripts: both scripts run their work on import (`main()` at module end), so
they cannot be imported for a path list. `prerender-legal.mjs` and
`prerender-marketing.mjs` render exactly the rows marked with their name, and
switch to the shared head renderer and the table for their tags. A test asserts
the marketing rows match `MARKETING_SSG_ROUTES` in
`src/prerender/render-marketing.tsx`, and another that the legal rows match
the paths in `prerender-legal.mjs`'s `PAGES` (content sources stay there;
titles and descriptions move to the table).

Loading the table through `ssrLoadModule` makes `prerender-legal.mjs` depend on
the repo (Vite root, `src/`, the `@` alias), so it can no longer be copied alone
into a temp folder. The script gains an output-folder override (argument or
env var) and keeps the repo as its root; `tests/divine-services-directory.test.ts`
runs the real script in place against a temp `dist/` instead of a copied
script.

The same step writes `dist/sitemap.xml` from `/` plus every table row, with
`<loc>` and, where set, `<lastmod>`. `changefreq` and `priority` are dropped
(search engines ignore them). `robots.txt` already points at `/sitemap.xml`;
`_routes.json` keeps `*.xml` out of the Cloudflare function, and Fastly's KV
inclusion rules keep `.xml`.

The build ends with a self-check over `dist/`: every row has a file, and each
file has exactly one of each tag in the full set, with values matching the
resolved row (compared after HTML decoding). Any mismatch fails the build. The
same generator and check also run in vitest against a fixture `dist/`, because
`npm test` runs `vite build` alone and never the prerender chain. The vitest
fixture covers rows without `prerenderedBy`; the two ownership tests above
cover the rest in `npm test`, and the full-build self-check covers every row
before any deploy.

Serving: Fastly's static publisher serves `dist/<path>/index.html` for
`/<path>` and `/<path>/` (`autoIndex`). Cloudflare Pages answers `/<path>` with
a 308 to `/<path>/` and serves the file there; crawlers follow it.

### 3. Tab titles at the router level

One component, `<PageSeoForRoute />`, sits inside `BrowserRouter`, reads
`useLocation()`, looks up the row, resolves it in the active language, and sets
`<title>`, description, client-side OG tags (`useSeoMeta`), and the canonical
link (`useHead`, since `useSeoMeta` cannot emit it). Rows are matched by exact
path after stripping one trailing slash (Cloudflare serves table pages at
`/<path>/`; React Router already renders the right page there, and the
canonical comes from the row path, so it has no slash).

Routes without a row get the brand default title and description (and nothing
else) at `tagPriority: 'low'`. It must not set `og:*` or `twitter:*`:
`InferSeoMetaPlugin` (`App.tsx`) derives those from the winning title and
description at the same low priority, and a later low-priority `og:title`
would tie and win, replacing a page's inferred preview title with the brand
default. Unhead restores the first-load document title when a
title entry goes away, so without this default, landing on `/kids` and then
navigating to a page that sets no title (for example `/discovery`) would keep
the kids title in the tab and in `AnalyticsPageTracker`. Pages that set their
own title with `useSeoMeta` (profiles, videos, hashtags) still win because of
the low priority.

Pages that change:

- The six pages that set their own title drop that code and their copy moves
  into the table: `/leaderboard` (`useSeoMeta`), `/merch`, `/delete-account`,
  `/exit`, `/exit/start`, `/download` (`useHead`). They set only title,
  description, canonical, and `og:*`/`twitter:*` tags, all covered by the
  table.
- `FamilySeoHead` is deleted and removed from the five family pages, so family
  routes have one client head source. `JsonLd` stays and reads through the
  resolver.
- `/trending`'s `useHead` only adds an RSS link and stays.

No other page component changes, so their tests need no `UnheadProvider`.

Unhead adopts head elements already in the prebuilt HTML (same dedupe keys for
`canonical`, `og:*`, `twitter:*`), so first load produces no duplicate tags;
the existing prerendered family pages already rely on this.

`AnalyticsPageTracker` reports `document.title`, so page-view titles change for
the pages that gain a real title.

### 4. Removing duplicates and redirects

- Fastly: remove crawler handlers for `/kids`, `/age-review`, `/download`,
  `/family[/*]`, and the mirrored family table in `compute-js/src/index.js`.
- Cloudflare: remove the same routes from `src/lib/serverSocialMeta.ts`.
- `prerender-legal.mjs`: its `PAGES` titles and descriptions come from the
  table.
- `/account-portability` → `/exit` (301):
  - Fastly: a same-host redirect placed immediately after the
    `EXTERNAL_REDIRECTS` check in `handleRequest` (so after the www redirect
    and the vanity-subdomain block: www gets one hop to the apex, then
    `/exit`). It matches both `/account-portability` and
    `/account-portability/` and preserves the query string. `Location` is an
    absolute URL built from `hostnameToUse` (as `buildWwwRedirectResponse` in
    `hostRedirect.js` does), in a hand-built `Response` with the same
    `Vary: X-Original-Host, X-Forwarded-Host` as `redirectNoStore`; never a
    relative URL passed to `Response.redirect`. `EXTERNAL_REDIRECTS` is not used: it maps exact paths to
    absolute cross-host URLs and drops the query. Covered by its own unit test.
  - Cloudflare: `/account-portability /exit 301` and
    `/account-portability/ /exit 301` in `public/_redirects` (the function
    passes asset-layer redirects through, as `/faq` shows).
  - The client `<Navigate>` stays as a fallback for any host the edge redirect
    misses.
- Delete `public/sitemap.xml`; migrate `src/lib/seoFiles.test.ts` (which reads
  it) to assert on the generated sitemap.
- Keep every data-driven handler.
- Update or remove tests for deleted code.
- Update the Build Pipeline section of `ARCHITECTURE.md` (it already omits
  `prerender-marketing`).

Canonical note: the removed handlers emitted the request host, so
`dvine.video/kids` previewed with `https://dvine.video/kids`. Static files
always name `https://divine.video<path>`. This is intended.

## Testing

- **Coverage:** routes are read from `src/AppRouter.tsx` with comments stripped
  and multi-line `<Route>` elements handled. Every static public route is in
  the table or the exclusion list, and every table or exclusion entry is a
  real route.
- **Table integrity:** required fields present, unique paths, image files exist
  in `public/` and pass the KV inclusion test in `publish-content.config.js`,
  descriptions at most 200 characters, referenced translation keys exist in
  English.
- **Locales:** existing `locales.test.ts` (key parity and loop glossary).
- **Router component:** sets `"<Page> - Divine"` for new titles, keeps existing
  suffixed titles as written, follows the active language, emits the
  canonical link, matches `/<path>/` the same as `/<path>`, and after
  navigating from a row route to a no-row route shows the brand default title,
  not the previous page's.
- **Redirect:** Fastly `/account-portability[/]` returns 301 to `/exit` on the
  request host with the query string preserved.
- **Prerender ownership:** rows marked `marketing` equal
  `MARKETING_SSG_ROUTES`; rows marked `legal` equal the paths in
  `prerender-legal.mjs`'s `PAGES`.
- **Brand default:** the no-row default sets only title and description, and a
  page-level title (via `useSeoMeta` or `useHead`) wins over it.
- **Build self-check:** as in section 2, in both the build and vitest.
- **Sitemap:** generated file lists `/` and every table row, and nothing else,
  with family `lastmod` 2026-07-22 (replaces the `public/sitemap.xml`
  assertions in `src/lib/seoFiles.test.ts`).
- **Live audit (`scripts/verify-og-tags.sh`):** add every table page; accept
  `https://divine.video<path>` as `og:url` for table pages on the Cloudflare
  target; run a non-allowlisted user agent against table pages only; skip
  `/faq` on the Cloudflare target with a comment pointing to the deferred
  host split.
- **Mutation check:** for the coverage test, the build self-check, and the
  router component, break the guarded condition and confirm the test fails
  before trusting it.
- **Pre-merge:** `npm run build`, then `npm run fastly:local` and a Cloudflare
  preview deploy; request every table page with an allowlisted and a
  non-allowlisted user agent and confirm tags and canonical.
- **Post-deploy:** the CI deploy on merge publishes both halves and purges. If
  deploying by hand, run `npm run fastly:deploy && npm run fastly:publish` and
  purge the cache. Re-run the live audit against production and re-scrape
  `/kids` in Facebook's Sharing Debugger.

## Open Items

- Marketing/Comms approves drafted descriptions and title wording before merge.
- Whether existing em-dash titles (`Merch — Divine`, `Account review — Divine`,
  family) move to `" - Divine"`: Marketing/Comms.
- #726 lists `/collabs` as affected; it is logged-in only and is excluded here.
- `/faq` host split: separate change.
- Known, not fixed here: on Cloudflare Pages (used mainly for preview deploys),
  table pages load at `/<path>/`, so exact pathname checks in
  `AnalyticsPageTracker.tsx` (surface classification) and `AppSidebar.tsx`
  (active state for `/popular/`) misfire. This already happens for today's
  prerendered pages there and does not affect divine.video.
# Divine services directory — design

**Status:** Draft, awaiting review. 2026-07-27.

## Product intent

Divine is more than the video app. Companion services (profile pages, sound
library, creator awards, crossposting, provenance verification, status) help
users take full advantage of Divine, but nothing in the app links to them or
explains they exist. Add a "Divine services" directory page inside divine-web
and link it from the sidebar.

These are **services**, not apps: copy frames them as companion services that
extend what you can do with Divine.

## Included services (verified live 2026-07-27, all return 200)

| Service | URL | What it does |
| --- | --- | --- |
| Divine Space | `https://divine.space` | Customizable profile home: themes, Top 8, profile music |
| Sounds | `https://sounds.divine.video` | Trending sounds + Creative Commons audio library for loops |
| Badges | `https://badges.divine.video` | Creator awards and recognition |
| Crossposter | `https://crossposter.divine.video` | Opt-in crossposting of Divine videos to external short-form platforms |
| Verifier | `https://inquisitor.divine.video` | Check a video's provenance: C2PA content credentials, live verification lab |
| Status | `https://status.divine.video` | Live Divine service health |

Explicitly excluded (confirmed with product):

- **Clips** (`clips.divine.video`) and **Invite** (`invite.divine.video`) —
  not ready.
- **Supporters** (`supporters.divine.video`) — excluded by product.
- **Connect** (`connect.divine.video`) — invite-only partner facade.
- **Compiler** (`compiler.divine.video`) — internal editor.

The config list is the single place future services get added (crossposter
and verifier were the first proof that this list will grow).

## User experience

- Route `/services` renders a branded directory page:
  - `SectionHeader` title ("Divine services") and a short candid intro
    explaining Divine is more than the video app — these companion services
    help you make the most of it.
  - A responsive grid of `Card variant="brand"` cards with the existing
    per-card accent rotation, one per service: Phosphor icon, service name,
    one-line description, external-link affordance.
  - Cards link out with `target="_blank" rel="noopener noreferrer"`.
- Sidebar gets two entry points:
  - A top-level nav item "Services" (Phosphor `SquaresFour` icon) in the main
    nav cluster.
  - A "Services" link in the footer Divine-links expandable section next to
    the about.divine.video links.
- The page is prerendered at build time for SEO, following the existing
  `scripts/prerender-legal.mjs` pattern used by `/faq`, `/terms`, etc.
- Mobile and desktop layouts both work; the grid collapses to one column on
  small screens.

## Architecture

- **Config module** `src/config/divineServices.ts`: typed
  `DivineService { id, name, url, descriptionKey, icon }` and a
  `DIVINE_SERVICES` ordered array. Single source for the page and any future
  consumers. Adding a service later = one array entry + one locale string.
- **Page** `src/pages/ServicesPage.tsx`: pure presentational render of the
  config via brand primitives. Registered as a route in `src/App.tsx`.
- **Sidebar** `src/components/AppSidebar.tsx`: one `NavItem` plus one footer
  link, both navigating to `/services` (internal route, not external).
- **i18n**: new `servicesPage.*` keys (title, intro, one description per
  service, nav label `nav.services`). English first; the other 15 locales get
  the English strings as placeholders so translators can catch up (same
  pattern as previous key additions). Locale key parity tests must pass.
- **Prerender**: add `/services` to the marketing prerender list with a
  static content partial under `scripts/prerender-content/`, matching the
  existing FAQ/terms mechanism.

## Copy (English, brand voice — candid, never corporate)

- Title: "Divine services"
- Intro: "Divine is more than loops. These services help you make the most
  of it."
- Divine Space: "Your profile, your rules. Themes, Top 8, profile music."
- Sounds: "Trending sounds and a Creative Commons library for your loops."
- Badges: "Awards for creators who show up."
- Crossposter: "Post your loops to the other platforms — only when you opt
  in."
- Verifier: "Check where a video really came from."
- Status: "Is it us or is it you? Check here."

## Testing

- `ServicesPage.test.tsx`: renders all six service cards, each linking to the
  correct URL with `rel="noopener noreferrer"`; intro copy present.
- `AppSidebar.test.tsx`: top-level Services item and footer Services link
  both navigate to `/services`.
- Config shape test: every entry has id, name, https URL, descriptionKey,
  icon; ids unique.
- Prerendered content partial covered by the same static accuracy pattern as
  the FAQ partial (guard test asserting key copy is present).
- Brand guardrail tests (no `uppercase`, no gradients, no lucide) run over
  new code automatically.
- Full gate: `npm run test` (tsc, eslint, vitest, build with prerender).

## Out of scope

- Listing clips, invite, supporters, connect, or compiler.
- Live health data on the cards (Status link is enough).
- Any backend or API work.
- Translations beyond English placeholder strings.

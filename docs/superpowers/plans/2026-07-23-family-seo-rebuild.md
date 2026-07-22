# /family SEO Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make /family and four new child routes server-rendered, indexable, self-canonical, structured-data-rich, and conversion-capable (store badges), without touching app surfaces.

**Architecture:** Build-time SSG for marketing routes only: a new `scripts/prerender-marketing.mjs` uses Vite `ssrLoadModule` + `ReactDOMServer.renderToString` to render the real React pages (with `StaticRouter`) into `dist/<route>/index.html`, with per-route head tags baked from a shared `src/seo/marketingSeo.ts` data module. Fastly KV + compute-js-static-publish already serve `dist/<route>/index.html` before SPA fallback (proven by /terms). Copy moves verbatim from `FamilyPage.tsx` into section components shared by hub + child pages. Edge worker crawler handlers extended for child routes.

**Tech Stack:** React 18 + Vite 6 + react-router-dom 6 (StaticRouter), @unhead/react (client), Fastly compute-js, Vitest.

**Constraints (from spec, hard):**
1. Safety copy verbatim — every "can't promise" statement preserved; CSAM escalation wording untouched.
2. No changes to authenticated routes/feed/camera/editor.
3. Voice: plain, direct, second person, no exclamation marks.
4. Copy may be reorganised across pages, not reworded without flagging.

---

## Route → content mapping (copy moves verbatim from src/pages/FamilyPage.tsx)

| Route | Sections (FamilyPage.tsx source) | utm_campaign |
|---|---|---|
| /family (hub) | hero (l.156-207), framing band (l.210-243), "What Divine can and can't do" (l.320-413), STIR/experts (l.662-762), full outside resources (l.765-803), kids cross-link (l.807-834), closing note (l.837-852), + NEW summary/link cards for 4 child pages | family |
| /family/talking-to-your-teen | "Talking with your teen" cards + conversation starters (l.247-317) | talking-to-your-teen |
| /family/media-plan | family media plan (l.515-572) + feed habits (l.456-512) | media-plan |
| /family/when-something-goes-wrong | upset section incl. 4 steps + CSAM escalation (l.575-659) | when-something-goes-wrong |
| /family/safety-tools | content settings (l.416-453) + "What Divine can and can't do" (l.320-413, shared component) | safety-tools |

Old anchor ids (#talking #limits #settings #habits #plan #upset #stir #resources #framing) stay on hub (summary blocks reuse ids) so old fragment links still land.

## Per-route meta (source of truth: src/seo/marketingSeo.ts)

- /family: title `For Families on Divine — Talking With Teens About Social Media`; desc `An honest guide for parents and teens: what Divine's safety tools do, what no app can promise, and how to build a family media plan that actually holds.`; og:title `For Families on Divine`; og:desc `Conversation over surveillance. What our safety tools do, what they can't, and how to talk with your teen about it.`; og image `/og-family.png`
- /family/talking-to-your-teen: title `How to Talk With Your Teen About Social Media — Divine for Families`; desc `Conversation starters and research-backed guidance for talking with your teen about social media — without surveillance, and without the blow-up.`; image `/og-family-talking.png`
- /family/media-plan: title `Creating a Family Media Plan — Divine for Families`; desc `How to build a family media plan together: where and when screens make sense, healthier feed habits, and regular check-ins that actually hold.`; image `/og-family-media-plan.png`
- /family/when-something-goes-wrong: title `What to Do if Your Child Saw Something Upsetting Online — Divine for Families`; desc `Four steps for when your child sees something upsetting online: pause, talk before punishing, use the in-app tools, and know when to escalate.`; image `/og-family-when-something-goes-wrong.png`
- /family/safety-tools: title `Divine's Safety Tools and Content Settings — What They Can and Can't Do`; desc `How content settings work on Divine: adult content gating, moderation lists, blocking, muting, and reporting — and what no app can promise.`; image `/og-family-safety-tools.png`

All: self-canonical `https://divine.video<path>`, og:type article (hub: website), og:image:width 1200 / height 630, twitter summary_large_image.

## File map

Create:
- `src/seo/marketingSeo.ts` + `src/seo/marketingSeo.test.ts` — FAMILY_SEO route table (path, title, description, ogTitle, ogDescription, ogImage, ogType, breadcrumb name, campaign slug).
- `src/components/family/familyResources.ts` — RESOURCE_GROUPS moved verbatim; per-group keys so child pages take subsets.
- `src/components/family/FamilyResources.tsx` — renders groups (filterable).
- `src/components/family/FamilySectionNav.tsx` — persistent nav linking all 5 routes (+ /kids), current-page aware.
- `src/components/family/StoreBadgesCta.tsx` — App Store / Google Play badges (assets in public/store-badges/), UTM builder (utm_source=divine_site, utm_medium=family_page, utm_campaign=<slug>), click events via existing analytics helper; optional `withSignup` renders HubSpotSignup BELOW badges.
- `src/components/family/JsonLd.tsx` — ArticleJsonLd, FAQPageJsonLd, BreadcrumbListJsonLd (script type=application/ld+json).
- `src/components/family/sections/*.tsx` — verbatim copy sections: FamilyHero, FramingBand, TalkingSection, DivineRoleSection (can/can't), ContentSettingsSection, FeedHabitsSection, MediaPlanSection, WhenSomethingGoesWrongSection, ExpertsSection, KidsCrossLink, ClosingNote. Shared helpers FrameStep/SettingsRow/PlanColumn move here.
- `src/pages/family/FamilyHubPage.tsx` (+ 4 child pages: `TalkingToYourTeenPage.tsx`, `MediaPlanPage.tsx`, `WhenSomethingGoesWrongPage.tsx`, `SafetyToolsPage.tsx`) + tests.
- `src/prerender/render-marketing.tsx` — exports `MARKETING_SSG_ROUTES` + `renderMarketingRoute(path)` returning `{ appHtml, seo }`; wraps page in StaticRouter + IconContext bold + i18n import.
- `scripts/prerender-marketing.mjs` — vite ssrLoadModule, compose full HTML (assets extracted from dist/index.html like prerender-legal), write dist/<route>/index.html.
- `public/robots.txt`, `public/sitemap.xml` (+ tests following llmsTxt.test.ts pattern).
- `public/og-family*.png` — placeholders (copies of og.png; real designs outstanding).

Modify:
- `src/pages/FamilyPage.tsx` → replaced by re-export of hub (keep route import stable) or delete + update AppRouter import.
- `src/AppRouter.tsx` — add 4 child routes next to /family.
- `index.html` — REMOVE hardcoded `<link rel="canonical" href="https://divine.video/">` (the bug: every SPA route claims homepage). Homepage self-canonical moves to Index.tsx via useHead.
- `src/pages/Index.tsx` — add canonical https://divine.video/.
- Family pages set client-side head via useSeoMeta/useHead from marketingSeo (SPA-nav parity; Googlebot rendered-DOM safety net).
- `compute-js/src/index.js` — family crawler handler covers /family/* child paths with per-route title/desc/image table.
- `package.json` — build script: append `node scripts/prerender-marketing.mjs`.
- `src/pages/KidsPolicyPage.tsx` — add links block to all five family pages (vice-versa link requirement).
- `ARCHITECTURE.md` if it references changed files.

## Tasks

### Task 1: SEO data module (TDD)
- [x] Test: unique titles/descriptions across 5 routes, canonical == `https://divine.video` + path, no `!` in copy, og image per route distinct, campaign slugs match route slugs.
- [x] Implement `src/seo/marketingSeo.ts`. Commit.

### Task 2: Extract section components verbatim
- [x] Move RESOURCE_GROUPS + sections out of FamilyPage.tsx into `src/components/family/**` with zero copy edits. Hub renders from new components; snapshot-guard tests assert key verbatim strings (CSAM passage, "What Divine can't promise" bullets, "no app can replace conversation"). Commit.

### Task 3: Child pages + hub + routes + nav
- [x] Build 4 child pages + rebuilt hub (summaries + links), FamilySectionNav on all 5, resource subsets on children (talking/upset → "Reporting harms" + "Family guidance"; media-plan → "Plans you can fill out together" + "Family guidance"; safety-tools → "Reporting harms"), cross-links both directions, /kids linked everywhere; AppRouter routes. Tests per page. Commit.

### Task 4: Client-side head + JSON-LD
- [x] useSeoMeta/useHead per page from marketingSeo (title, desc, canonical, og, twitter). JsonLd components: Article (all 5, author Divine, citation Dr. Pamela Wisniewski / STIR Lab where referenced), FAQPage (talking: conversation starters; when-something-goes-wrong: the 4 steps — answers verbatim from page copy), BreadcrumbList (4 children). Tests parse the script tags. Commit.

### Task 5: Store badges + CTA (TDD)
- [x] StoreBadgesCta with UTM params + analytics click events; placed after DivineRoleSection (hub + safety-tools) and as footer CTA block w/ HubSpotSignup below badges on all 5. Tests assert hrefs contain utm_campaign per route. Commit.

### Task 6: Prerender SSG pipeline
- [x] `src/prerender/render-marketing.tsx` + `scripts/prerender-marketing.mjs`; wire into `build` script after prerender-legal. Verify: `npm run build` then grep dist/family*/index.html for titles/canonicals/body copy. Commit.

### Task 7: Canonical audit fix
- [x] Remove canonical (and stale og:url) from index.html; Index.tsx self-canonical; confirm prerender-legal + edge crawler canonicals already self-referencing (they are). Commit.

### Task 8: Edge worker child-route crawler meta
- [x] Extend family handler with route table for the 4 child paths (title/desc/og image mirrors marketingSeo). Commit.

### Task 9: robots.txt + sitemap.xml (TDD)
- [x] Static files in public/ + tests (5 family routes present, lastmod 2026-07-23, robots allows all + Sitemap line). Commit.

### Task 10: OG image placeholders
- [x] Copy og.png to the 5 og-family*.png paths. List real designs as outstanding. Commit.

### Task 11: Verification
- [x] `npm test` full suite; `npm run build`; grep acceptance criteria on dist output; manual notes for Rich Results Test + Lighthouse (post-deploy). Update ARCHITECTURE.md if needed. Final report.

## Verification commands (local acceptance)

```bash
npm run build
for r in family family/talking-to-your-teen family/media-plan family/when-something-goes-wrong family/safety-tools; do
  grep -o "<title>[^<]*</title>" "dist/$r/index.html"
  grep -o '<link rel="canonical"[^>]*>' "dist/$r/index.html"
done
grep -c "utm_campaign" dist/family/index.html
npx vitest run src/seo src/pages/family src/components/family
```

Post-deploy: `curl -s https://divine.video/family | grep -i "<title>"`; Rich Results Test on 5 URLs; Lighthouse SEO ≥95.

## Outstanding after this plan
- Real OG image designs (placeholders = copies of og.png, correct 1200x630).
- Rich Results Test + Lighthouse runs require deploy.
- Slack/iMessage/Discord unfurl checks post-deploy.

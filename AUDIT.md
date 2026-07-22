# divine-web Refactoring Audit

Date: 2026-06-12 · Scope: full repo (src/ ~92k LOC, compute-js edge worker, functions/, build/CI) · Read-only analysis; no code changed.
Method: parallel sub-audits (map, correctness, security, dead code, architecture, performance, dependencies), with every critical/high claim re-verified against the actual source. Three sub-audit findings were rejected as false positives during verification (noted at the end).

## Executive summary

The architecture is fundamentally healthy: clean Components → Hooks → Client → Transform layering, no circular dependencies, sane state management, and a real (if uneven) test suite. The single most urgent issue is an XSS vector in the Fastly edge worker: unescaped `JSON.stringify` of Nostr-sourced content injected into HTML served to every visitor. Second: `npm audit` shows 15 production-tree vulnerabilities (incl. a react-router XSS) all fixable with semver-compatible bumps. Third: the feed hot path makes ~2 requests per rendered video card instead of using the existing batch infrastructure, and the main feed is not virtualized despite `@tanstack/react-virtual` being installed. The test suite is a moderate safety net (strong on `funnelcakeClient`/`videoParser`, absent on the circuit breaker and `NostrProvider`, heavy mocking elsewhere), so the refactor sequence below front-loads security patches and test hardening before structural work. Three god files (`VideoPlayer.tsx`, `VideoCard.tsx`, `funnelcakeClient.ts`) and six layer violations are the main structural debt; everything else is hygiene.

## Findings table

Severity = production blast radius. Effort: S (<½ day), M (½–3 days), L (>3 days).

| ID | Category | Sev | Location | Description | Effort |
|----|----------|-----|----------|-------------|--------|
| SEC-1 | Security | **Critical** | `compute-js/src/index.js:325`, `:905` | Unescaped `JSON.stringify` of Nostr-sourced feed/profile data injected into `<script>` in HTML served to all visitors → stored XSS via `</script>` breakout | S |
| SEC-2 | Security | **High** | `package-lock.json` (react-router-dom ≤6.30.2) | Known XSS/open-redirect vuln in shipped router; fixed in 6.30.4 (semver-compatible) | S |
| SEC-3 | Security | High | `package-lock.json` | 30 audit vulns total (2 critical: vitest <3.2.6 dev-only, protobufjs via firebase; moderate: unhead `useHeadSafe` XSS). All fixable via compatible bumps | S |
| SEC-4 | Security | Low | `compute-js/src/authPersistCookie.js:48,59`, `src/lib/crossSubdomainAuth.ts:110-119` | Auth cookies (`divine_jwt`, `nostr_login`) not HttpOnly — required by cross-subdomain design, but enlarges XSS blast radius (compounds SEC-1) | L |
| COR-1 | Correctness | High | `src/components/VideoPlayer.tsx:774-777` | `checkAuth().then(loadVideoSource)` has no `abortController.signal.aborted` guard; stale async resolution after effect re-run creates an HLS instance that clobbers `hlsRef`, leaking the newer instance and loading a stale source | S |
| COR-5 | Correctness | **High** | `src/lib/funnelcakeHealth.ts:36-51` | Circuit breaker never recovers: the half-open branch logs "allowing retry" but returns the stale `available=false` flag; since every REST call is gated on `isFunnelcakeAvailable` and `checkFunnelcakeHealth`/`resetFunnelcakeCircuit` have zero callers, an opened circuit disables REST until page reload. *(Found post-audit while writing the TEST-1 tests.)* | S |
| COR-2 | Correctness | Medium | `src/hooks/useModeration.ts:344, 365` | `JSON.parse` of localStorage `content_reports` without try/catch — corrupted value throws, breaking report submission flow and report-history query permanently | S |
| COR-3 | Correctness | Medium | `src/components/LinkedAccounts.tsx:93`, `src/hooks/useResolveSubdomainPubkey.ts:113` | queryFns ignore React Query's `signal`; in-flight identity verification / relay searches continue after unmount and can write stale results | S |
| COR-4 | Correctness | Low | `src/hooks/useRssFeedAvailable.ts:17-19`, `src/hooks/useResolveSubdomainPubkey.ts:48-66` | Silent catch blocks: transient endpoint failures cached as "unavailable"; malformed relay metadata skipped with zero logging (blinds operators to relay poisoning) | S |
| PERF-1 | Performance | **High** | `src/components/VideoCardWithMetrics.tsx:57-65`, `src/hooks/useDeferredVideoMetrics.ts` | N+1: each card fires its own social-metrics + user-interactions queries (~24 requests per 12-video page). `useBatchedVideoInteractions` (`src/hooks/useBatchedVideoInteractions.ts:21-162`) already exists but isn't wired in at feed level | M |
| PERF-2 | Performance | Medium | `src/components/VideoFeed.tsx:533-550` | Main feed renders all loaded videos unvirtualized (`InfiniteScroll` + `.map`); 300+ videos ≈ 5k live DOM nodes. `@tanstack/react-virtual` installed, used only in `UserListDialog.tsx:6` | M |
| PERF-3 | Performance | Medium | `src/components/VideoCard.tsx:570-572`, `src/components/VideoGrid.tsx:117-126` | Avatars / grid thumbnails missing `width`/`height` (and some `loading="lazy"`) → CLS on feed load | S |
| PERF-4 | Performance | Low | `src/components/VideoCard.tsx:147` | `useVideosInLists` fires one query per rendered card; should batch at feed level | M |
| PERF-5 | Performance | Low | `src/lib/generatedNameDictionaries.ts` (1564 lines) | ~12 KB gz of name dictionaries in main bundle; only needed for fallback display names — dynamic-import candidate | S |
| PERF-6 | Performance | Low | `src/components/VideoCard.tsx:143-145` | HLS fallback condition lacks `!isClassicVine`, contradicting the skip-HLS-for-shorts rule at `:135-138` (rare aspect-ratio distortion when classic Vine MP4 404s) | S |
| ARCH-1 | Architecture | Medium | `VideoCard.tsx:502`, `VideoPlayer.tsx:884`, `LeaderboardPage.tsx:170-196`, `PinnedVideosSection.tsx:66`, `ViewSourceDialog.tsx:87`, `AtUsernamePage.tsx:28` | Six layer violations: raw `fetch()` / `nostr.query()` in components/pages, bypassing funnelcakeClient, circuit breaker, and auth-header conventions | M |
| ARCH-2 | Architecture | Medium | `src/components/VideoPlayer.tsx` (1161 LOC), `src/components/VideoCard.tsx` (1115 LOC) | God components: 12–18 distinct responsibilities each (playback, auth, gestures, metrics, 6 dialogs…). Natural seams exist (gestures, auth loading, metadata, interactions); importer count is low (3–4) so splits are tractable | L |
| ARCH-3 | Architecture | Medium | `src/lib/funnelcakeClient.ts` (1360 LOC) | 20+ endpoint functions across 5 domains in one file; split by domain behind a barrel re-export is zero-risk (24 importers unaffected) | M |
| ARCH-4 | Maintainability | Medium | `tsconfig.app.json` | `"strict": false`, `"noImplicitAny": false` — new code accrues type debt silently. Existing unsafe casts are few (23 total, mostly tests) so a ratchet is feasible | M |
| ARCH-5 | Maintainability | Low | `src/lib/funnelcakeClient.ts:836-842` | `as unknown as number[]` byte-array casts; should be a `string \| number[]` union on `FunnelcakeVideoRaw` | S |
| TEST-1 | Test gap | **High** | `src/lib/funnelcakeHealth.ts` (no test file) | Circuit breaker — the gate in front of every REST call — has zero tests; same for `NostrProvider.tsx` relay routing. Refactoring near these is unguarded | M |
| TEST-2 | Test gap | Medium | `.github/workflows/ci.yml` | Playwright (visual + axe a11y) exists but is not run in CI; merges gate only on tsc + eslint + vitest + build | S |
| TEST-3 | Test gap | Medium | `src/components/VideoPlayer.test.tsx`, `src/hooks/useInfiniteVideosFunnelcake.test.ts` | Mock-heavy tests verify call wiring, not behavior — would pass through refactors that break playback/fallback in prod | L |
| DEAD-1 | Dead code | Low | `src/components/ZapButton.tsx`, `OriginalContentBadge.tsx`, `PopularHashtagsCard.tsx`, `VideoListBadges.tsx`, `src/hooks/useAnonymousReport.ts` | Zero importers (verified by grep across src/ and tests/; ZapButton appears only in a comment in `useZaps.ts:27`) | S |
| DEAD-2 | Dead code | Low | `src/components/ui/chart.tsx`, `ui/command.tsx`, `ui/input-otp.tsx`, `ui/calendar.tsx`, `ui/resizable.tsx` | Unconsumed shadcn wrappers keeping 5 deps alive: recharts, cmdk, input-otp, react-day-picker, react-resizable-panels. Also `next-themes` used only by `ui/sonner.tsx` while the app has its own `useTheme` | S |
| DEAD-3 | Dead code | Low | repo root | Stray artifacts: `merch-contrast-fixed.png` (418 KB), `popular-mobile.png`, `test-playwright.js`, `firebase-debug.log` (untracked but present) | S |
| DUP-1 | Duplication | Medium | `src/components/CreateListDialog.tsx:30-283` vs `EditListDialog.tsx:29-283` | ~280 lines structurally identical (state, tag handlers, form UI); only the mutation differs. Divergence risk on every form change | M |
| DUP-2 | Duplication | Low | `VideoCard.tsx`, `FullscreenVideoItem.tsx`, `ThumbnailPlayer.tsx`, `VideoPlayer.tsx` | HLS/quality-selection + auth-media logic repeated across 3–4 components (not yet diverged) — extract alongside ARCH-2, not before | M |
| DEP-1 | Dependencies | Medium | `package.json:7-11` | `dev`/`test`/`build` scripts run `npm i` implicitly — nondeterministic installs, lockfile churn, recurring supply-chain exposure on every run | S |
| DEP-2 | Dependencies | Low | `package.json:97-99` | `overrides` pins `@jsr/nostrify__nostrify` to exact 0.46.4 while the dep declares `^0.46.4` — patches silently never land; a future bump will conflict confusingly | S |
| DEP-3 | Dependencies | Low | `package.json` | No `engines` field / `.nvmrc` (CI pins Node 20; local dev unpinned) | S |
| DEP-4 | Dependencies | Low | `package.json` | Planned majors queued behind vuln fixes: react-router 7, react 19, vite 7/8 + vitest 4, zod 4, tailwind 4 (defer — brand guardrail tests + CSS-config rewrite) | L |

## Critical / high findings in detail

**SEC-1 — Edge-worker XSS (critical, S).** `compute-js/src/index.js:325` builds `<script>window.__DIVINE_FEED__=${JSON.stringify(feedData)}…</script>` and splices it into the HTML `<head>` for apex/discovery pages; `:905` does the same with `window.__DIVINE_USER__` (subdomain owner's profile) for profile pages. `JSON.stringify` does not escape `<`, so any video title/description/display-name containing `</script><img onerror=…>` — all freely publishable Nostr content — executes in every visitor's browser, on first-party origin, where the non-HttpOnly `divine_jwt` cookie is readable (SEC-4). The adjacent OG-tag code already uses `escapeHtml` correctly; only the JSON blocks are exposed. Fix: escape `<`, `>`, `&` to `<`-style sequences in the stringified JSON at both sites, plus the `feedType` string interpolation on the same line. Requires deploying the edge worker (`fastly:deploy` + `fastly:publish`).

**SEC-2/SEC-3 — Dependency vulns (high, S).** 15 production-tree vulns, all with semver-compatible fixes: react-router-dom → 6.30.4 (XSS via open redirect, shipped in the SPA bundle), @unhead/react → 2.1.15 (XSS bypass), firebase bump (clears critical protobufjs chain), vitest → 3.2.6 (critical, dev-server only), vite → 6.4.3, workbox-build → 7.4.1, wrangler → 4.100. One targeted `npm audit fix` PR clears the board without major-version risk.

**COR-1 — VideoPlayer stale-auth race (high, S).** In the source-setup effect (`VideoPlayer.tsx:730-777`), `checkAuth()` awaits a network preflight, then `.then()` calls `loadVideoSource()`. The cleanup aborts the controller and destroys `hlsRef`, but the `.then` never checks `signal.aborted` — so when deps change mid-preflight (URL fallback, auth state), the stale run still executes `loadVideoSource()`, synchronously constructing an HLS instance from old closure values and overwriting `hlsRef.current`. The newer run's HLS instance is orphaned (never destroyed) and the element can end up on a stale source. Fix: `if (abortController.signal.aborted) return;` at the top of the `.then` callback (and inside `loadVideoSource`'s synchronous HLS path).

**PERF-1 — Per-card metrics N+1 (high, M).** `VideoCardWithMetrics.tsx:57-65` defers then fires `useVideoSocialMetrics` + `useVideoUserInteractions` per card — ~24 requests for a 12-video page where 2 bulk calls would do (the API has `POST /api/videos/stats/bulk`, and `useBatchedVideoInteractions.ts` already implements batching but isn't used by the feed). The stagger (`index * 50ms`) hides this from first paint but not from the network. Fix: lift batched queries to `VideoFeed`, pass results down as props; the deferral logic can stay for offscreen cards. Same pattern applies to `useVideosInLists` (PERF-4).

**TEST-1 — Unguarded critical modules (high, M).** `funnelcakeHealth.ts` decides whether every REST call happens at all (threshold 3, 30s reset, half-open retry) and has no tests; `NostrProvider.tsx` relay routing is only ever exercised through mocks. Since the refactor plan touches the client layer (ARCH-1/ARCH-3), write state-machine tests for the circuit breaker (closed → open → half-open → closed/reopen, `shouldFallbackToWebSocket` matrix) and at least a contract test for NostrProvider routing **before** structural work. Also wire the existing Playwright smoke/a11y suite into CI (TEST-2).

## Proposed refactor sequence

Each batch is independently shippable; `npm test` (tsc + eslint + vitest + build) must pass after each. Earlier batches deliberately de-risk later ones.

**Batch 0 — Security patches (no refactoring; ship immediately).**
SEC-1 (escape JSON in edge worker — needs Fastly deploy of both services if router untouched, web at minimum), SEC-2/3 (targeted compatible dep bumps). Zero structural risk; removes the only critical-severity items.

**Batch 1 — Safety net.**
TEST-1 circuit-breaker tests; TEST-2 add Playwright job to ci.yml; a thin integration test over `funnelcakeClient → transform → VideoFeed` happy path. Nothing in prod changes; every later batch becomes safer.

**Batch 2 — Hygiene (mechanical, low-risk).**
DEAD-1/2/3 deletions (after resolving the "unsure" items below), DEP-1 (drop `npm i` from scripts; CI already does `npm ci`), DEP-2 (remove or exact-pin nostrify override), DEP-3 (engines + .nvmrc), ARCH-5 (byte-array union type), PERF-3 (img dimensions), PERF-6 (one-line classic-Vine guard).

**Batch 3 — Correctness fixes.**
COR-1 (abort guard in VideoPlayer — covered by Batch 1 tests), COR-2 (try/catch the two JSON.parse sites), COR-3 (thread `signal` through the two queryFns), COR-4 (log instead of swallow). All small diffs, individually revertable.

**Batch 4 — Hot-path performance.**
PERF-1 (lift metrics batching to feed level — the largest user-visible win), then PERF-2 (virtualize VideoFeed using the UserListDialog pattern), PERF-4/PERF-5 as follow-ups. Do PERF-1 before PERF-2 so virtualization doesn't change query timing mid-flight.

**Batch 5 — Restore layering.**
ARCH-1: move the six raw fetch/query sites into hooks + funnelcakeClient functions (each violation is its own small PR). This must precede the client split so new functions land in the right place once.

**Batch 6 — Structural splits.**
ARCH-3 (domain-split funnelcakeClient behind a barrel export — zero importer churn), DUP-1 (extract shared list-form component/hook), then ARCH-2 (staged extraction from VideoCard: metadata → interactions → player; then VideoPlayer: gestures → auth loader → HLS setup). DUP-2 falls out of the VideoPlayer split naturally.

**Batch 7 — Ratchets and planned majors.**
ARCH-4 (enable `strict` incrementally — per-directory or via separate tsconfig for new code), then DEP-4 majors in order: react-router 6→7 (enable future flags first) → react 19 → vite/vitest majors → zod 4. Defer tailwind 4.

## Explicitly unsure — need human input before touching

1. **`UploadPage.tsx` + `CameraRecorder.tsx`** — route is commented out with `// DISABLED` (`AppRouter.tsx:62`). Abandoned, or waiting on mobile-app parity? Deleting ~13 KB of camera code is wrong if upload is coming back.
2. **Dead-looking components** (`OriginalContentBadge`, `VideoListBadges`, `PopularHashtagsCard`, `useAnonymousReport`) — zero importers, but they look like staged features rather than leftovers. Delete or keep?
3. **The nostrify exact-pin override** (`package.json:97-99`) — deliberate freeze (relay-compat or transitive-lockstep reasons) or leftover? Changes the fix direction.
4. **Mobile redesign interaction** — project memory says a mobile redesign (branch `phase1-mobile-responsive-redesign`) introduces `MobileFeedView`/`MobileVideoItem`; none of those components exist on this branch. The ARCH-2 VideoCard/VideoPlayer splits should probably be sequenced against that branch to avoid a brutal merge — which lands first?
5. **Feature-flag scaffolding** in `src/config/api.ts:18-23` (`divine_feature_*` localStorage reads, zero flags defined) — infrastructure to keep, or remove?
6. **Edge-worker feed injection for all visitors** (`compute-js/src/index.js:305-335`) — injecting full feed JSON into HTML for every request (not just crawlers) is presumably an intentional LCP optimization; confirming intent matters before anyone "simplifies" it, and it determines how aggressively SEC-1's payload size should be capped.
7. **`AboutPage.tsx`** — unrouted, kept only for a 301 redirect note and tests; safe to delete only if the `_redirects`/router handling is confirmed authoritative.

## Sub-audit claims rejected during verification (for the record)

- "Circuit breaker race condition / needs CAS" in `funnelcakeHealth.ts:76-87` — false: the read-increment-write is fully synchronous; no await between read and write, so single-threaded JS cannot interleave it. The real issue there is TEST-1 (no tests), not a race.
- "Blurhash decoded every render" in `BlurhashImage.tsx` — false: `decode()` runs inside a `useEffect` (`:34-40`), not in render.
- "HLS instances never destroyed" in `VideoPlayer.tsx` — overstated: the effect cleanup destroys `hlsRef` on re-run/unmount (`~:948`). The genuine residual issues are COR-1 (stale run clobbering the ref) and PERF-2 (offscreen players staying mounted without virtualization).
- "setTimeout mutates ref after unmount" (`VideoPlayer.tsx:323`) — harmless: mutating a ref object after unmount is a no-op; not worth a finding.

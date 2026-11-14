# Web page performance

Use real visitor measurements to rank problems and the public-site audit to reproduce them. Crashlytics covers the Android/iOS apps; web errors and browser timing go to Sentry.

## Real visitors: Sentry

The production and PR-preview build workflows read the existing project's public client DSN from the repository variable `VITE_SENTRY_DSN`. This is an ingestion address, not an API auth token. No private Sentry token is included in browser builds. Set `VITE_SENTRY_ENVIRONMENT` to `production` or `preview` to keep their measurements separate. Other build surfaces must supply the same environment variables. Development remains disabled unless `VITE_SENTRY_DEV_ENABLED` is enabled.

The [Web page performance dashboard](https://divinevideo.sentry.io/dashboard/10782265/) has route tables for Web Vitals, content readiness and player startup, filtered to production and the last seven days. The built-in Web Vitals dashboard ranks initial page loads by p75 LCP, INP and CLS. Split mobile and desktop, inspect sample counts, and prioritize slow routes with substantial traffic. Good field targets at p75 are LCP ≤2,500 ms, INP ≤200 ms and CLS ≤0.1. Browser support and sampling mean some measurements can be absent. An empty dashboard is a telemetry gap to investigate, not evidence that pages are fast.

React Router instrumentation groups dynamic paths into route templates. New performance span names omit account identifiers, search strings and fragments. Sign-in URL redaction remains active. The trace sample rate remains 30% in production builds.

Two custom operations complement initial-load Web Vitals:

- `ui.content_ready`: primary feed/search/profile/video data committed and followed by two animation frames. The first route starts at document time origin; subsequent routes start at the route commit. This is content readiness, not image decode, LCP, or total click-to-paint time. Optional profile background reads do not block readiness once REST metadata is available. The `content.outcome` attribute distinguishes ready, empty, error, timeout and cancelled. Errors and empty pages never become successful populated-content audit results. A stalled route times out after 30 seconds; leaving the route or backgrounding the tab cancels it.
- `ui.video.start`: first visible video's play event until its first presented video frame (or the `playing` event on browsers without frame callbacks). This isolates startup after play intent; the audit separately measures navigation-to-advancing-video time. Errors, timeout and route abandonment have separate outcomes. It does not time a profile's thumbnail grid as if it were a player.

The application exposes `html[data-performance-ready="true"]` and `data-performance-outcome` for the audit. Readiness starts as `false` and resets on navigation. Informational pages still receive normal Sentry tracing; custom content readiness currently covers the main browsing routes.

## Browser audit

Run `npm run performance:audit -- --help` for options. The runner discovers one public video and profile from actual discovery links, with no committed creator identifiers. It produces anonymous JSON and Markdown in the ignored `performance-results/` directory. Reports include sample coverage, missing metrics and failures; no screenshots, traces, response bodies or raw dynamic URLs are stored.

A local example:

```sh
npm run performance:audit -- --origin https://divine.video --samples 3
```

The `Public site performance` workflow audits a local production bundle for each PR, and the public production site nightly or on manual dispatch. It samples six entry routes on desktop and mobile, plus one discovery-to-video link journey per device. CI uses one sample per route/device; manual runs default to three. Mobile CI measurements apply 150 ms network latency, 1.6 Mbps download, 750 kbps upload and 4× CPU slowdown through Chromium emulation. Use `--throttle` for the same preset locally. Soft-navigation content/playback timings start at the click; initial-page LCP/CLS/TTFB are marked not applicable for that journey. It uses a read-only token and does not run PR code in a privileged `workflow_run` job. Reports are attached to the run and its summary. Scheduled jobs begin after the workflow reaches the default branch.

LCP/CLS are bounded observations, not full-session field metrics; small lab samples are not a population p75. Initial performance budgets are advisory so existing slow production routes can be baselined. Missing populated primary content, error/empty pages, discovery failures and setup failures are explicit failures. Manual strict mode additionally fails when measured LCP/CLS/TTFB exceed the configured budgets. A missing metric never becomes zero. Timeouts can also reflect API/media outages; inspect failure status alongside timing before attributing a regression to frontend code.

## Investigation

1. Identify the slow route/device combination and its sample count.
2. Compare initial LCP with content readiness and video startup. A fast shell can hide a slow feed.
3. Inspect its trace for document TTFB, identity/API queuing, media loading and long tasks.
4. Reproduce with the browser audit, including cold contexts and in-app navigation.
5. Compare equivalent builds under the same conditions. Keep production data and preview results separate.

References: [Sentry Web Vitals](https://docs.sentry.io/product/dashboards/sentry-dashboards/frontend/web-vitals/), [React Router tracing](https://docs.sentry.io/platforms/javascript/guides/react/features/react-router/v6/), [Core Web Vitals targets](https://web.dev/articles/vitals).

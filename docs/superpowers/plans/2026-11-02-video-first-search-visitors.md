# Video First Search Visitors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anonymous visitors watch without cookie prompts, then offer a small app link after playback.

**Architecture:** Remove tracking bootstrap from SPA and Fastly shells. Reuse playback callbacks to reveal an inline store link. Align homepage metadata in React and Fastly.

**Tech Stack:** React, TypeScript, Vitest, Fastly JavaScript templates.

**Spec:** `docs/superpowers/specs/2026-11-02-video-first-search-visitors-design.md`

## Global Constraints

- Anonymous browsing sets no cookies through our startup code; auth cookies remain after intentional sign-in.
- No modal, timer, or persistence key for the app link.
- Keep analytics disabled without consent.
- Preserve first video as the primary content.

## Review Focus

- Fastly HTML and SPA fallback both omit the tracking bootstrap.
- Marketing email forms load only on intent.
- Direct video links and discovery feeds both reveal the app link after playback.
- Android and iOS point to their respective stores; installed or desktop clients do not get the inline link.
- Auth cookie tests still pass.

---

### Task 1: Anonymous startup

**Files:** `index.html`, `compute-js/src/templates/shell.js`, `src/main.tsx`, `src/components/HubSpotSignup.tsx`, relevant tests, `ARCHITECTURE.md`.

**Interfaces:** No new shared interface.

- [ ] Write tests that reject HubSpot startup scripts in both shells and require intent before loading the email form.
- [ ] Run focused tests and observe failure.
- [ ] Remove startup injections and Firebase initialization; delay the form script until intent.
- [ ] Run focused tests, auth cookie tests, type-check, and edge tests; commit.

### Task 2: Inline app link

**Files:** `src/components/AppLayout.tsx`, `src/components/PWAInstallPrompt.tsx`, `src/components/VideoFeed.tsx`, `src/pages/VideoPage.tsx`, new small component if useful, relevant tests.

**Interfaces:** A reusable link component accepts playback state implicitly through conditional mounting; no cookie or storage interface.

- [ ] Write tests proving no timed overlay and post-playback link on feed and direct video routes.
- [ ] Run focused tests and observe failure.
- [ ] Implement link using existing playback callbacks and store URL helpers.
- [ ] Run focused tests, type-check, and visual browser check; commit.

### Task 3: Search copy and delivery

**Files:** `compute-js/src/templates/pages.js`, `compute-js/src/templates/shell.js`, `src/lib/i18n/locales/en/common.json`, relevant tests, `ARCHITECTURE.md`.

**Interfaces:** Homepage edge and React metadata carry the same English message.

- [ ] Write a test for homepage title and description in edge HTML and React metadata.
- [ ] Run focused tests and observe failure.
- [ ] Update copy, test, and commit.
- [ ] Run all relevant checks, inspect diff, push, open a PR, and inspect CI and review routing.

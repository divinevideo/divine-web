# Funnelcake Developer Selector Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small in-app debug control that lets developers switch Funnelcake REST reads between Auto, Production, and Staging.

**Architecture:** Centralize Funnelcake base URL resolution in API config and surface a small selector in the existing moderation debug panel. Persist the mode in `localStorage` and invalidate REST-backed queries when it changes.

**Tech Stack:** TypeScript, React, React Query, Vitest, Testing Library

---

## Chunk 1: Lock Resolver Behavior With Tests

### Task 1: Add API resolver tests

**Files:**
- Create: `src/config/api.test.ts`
- Modify: `src/config/api.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('uses the staging API in auto mode on staging.divine.video', () => {
  expect(resolveFunnelcakeBaseUrl({ hostname: 'staging.divine.video', mode: 'auto' })).toBe('https://api.staging.divine.video');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/api.test.ts`
Expected: FAIL because the resolver does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a small mode enum, `localStorage` helpers, and a resolver for the effective base URL.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/api.test.ts`
Expected: PASS

## Chunk 2: Add The Debug Selector

### Task 2: Add moderation debug control tests

**Files:**
- Create: `src/pages/ModerationSettingsPage.test.tsx`
- Modify: `src/pages/ModerationSettingsPage.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('lets the developer switch Funnelcake API mode to staging from the debug panel', async () => {
  // render page, open debug panel, change selector, assert localStorage and visible effective URL
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/ModerationSettingsPage.test.tsx`
Expected: FAIL because the selector is not rendered yet.

- [ ] **Step 3: Write minimal implementation**

Add the selector to the existing debug panel and invalidate React Query caches after mode changes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/ModerationSettingsPage.test.tsx`
Expected: PASS

## Chunk 3: Wire The App To The Resolver

### Task 3: Replace direct base URL reads

**Files:**
- Modify: `src/config/api.ts`
- Modify: Funnelcake consumer files that currently read `API_CONFIG.funnelcake.baseUrl`

- [ ] **Step 1: Replace direct base URL reads with the resolver-backed value**
- [ ] **Step 2: Keep non-Funnelcake API config unchanged**
- [ ] **Step 3: Run `npx vitest run src/config/api.test.ts src/pages/ModerationSettingsPage.test.tsx src/config/relays.test.ts`**

## Chunk 4: Final Verification

### Task 4: Verify and finalize

**Files:**
- Modify: `docs/superpowers/specs/2026-04-16-funnelcake-dev-selector-design.md`
- Modify: `docs/superpowers/plans/2026-04-16-funnelcake-dev-selector.md`

- [ ] **Step 1: Review docs for accuracy after implementation**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Review `git status --short` and update the existing PR branch**

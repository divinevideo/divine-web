# Search Video Feed Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve search context when opening a video so `/video/:id` behaves like a feed bounded to the active search result set.

**Architecture:** Extend the existing route-based navigation context rather than introducing a new modal flow. Search results will generate search-aware detail URLs, and `VideoPage` will reconstruct adjacent videos from the same query and sort using the existing search data layer.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Vitest, Testing Library, Vite

---

## File Map

- Modify: `src/pages/SearchPage.tsx`
- Modify: `src/pages/SearchPage.test.tsx`
- Modify: `src/hooks/useVideoNavigation.ts`
- Modify: `src/pages/VideoPage.tsx`
- Add or modify test coverage near `src/pages/VideoPage.tsx`

## Chunk 1: Search Entry Context

### Task 1: Add failing coverage for search-result navigation URLs

**Files:**
- Modify: `src/pages/SearchPage.test.tsx`
- Modify: `src/pages/SearchPage.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that renders search video results, clicks a result, and expects navigation to `/video/<id>?source=search&q=<query>&sort=<sort>&index=<n>`.

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/pages/SearchPage.test.tsx`
Expected: FAIL because search results still navigate to a bare video route.

- [ ] **Step 3: Write minimal implementation**

Update search result rendering to pass a search navigation context into the video detail route.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/pages/SearchPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/SearchPage.tsx src/pages/SearchPage.test.tsx
git commit -m "feat: preserve search context when opening videos"
```

## Chunk 2: Search-Aware Detail Navigation

### Task 2: Add failing coverage for bounded search navigation on `VideoPage`

**Files:**
- Modify: `src/hooks/useVideoNavigation.ts`
- Modify: `src/pages/VideoPage.tsx`
- Add or modify: `src/pages/VideoPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that renders `VideoPage` with `source=search`, a query, a sort mode, and an index, then verifies adjacent search results are used for next/previous navigation.

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/pages/VideoPage.test.tsx`
Expected: FAIL because `search` is not yet a supported navigation source.

- [ ] **Step 3: Write minimal implementation**

Extend the navigation context and `VideoPage` to fetch and use search results when `source=search` is present.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/pages/VideoPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVideoNavigation.ts src/pages/VideoPage.tsx src/pages/VideoPage.test.tsx
git commit -m "feat: support bounded search navigation on video pages"
```

## Chunk 3: Regression Verification

### Task 3: Confirm search flow and fallback behavior

**Files:**
- Verify: `src/pages/SearchPage.tsx`
- Verify: `src/pages/VideoPage.tsx`

- [ ] **Step 1: Run focused regression tests**

Run: `vitest run src/pages/SearchPage.test.tsx src/pages/VideoPage.test.tsx`
Expected: PASS

- [ ] **Step 2: Run full verification**

Run: `npm test`
Expected: PASS with no new failures

- [ ] **Step 3: Commit**

```bash
git add src/pages/SearchPage.tsx src/pages/SearchPage.test.tsx src/hooks/useVideoNavigation.ts src/pages/VideoPage.tsx src/pages/VideoPage.test.tsx
git commit -m "test: verify bounded search video feed flow"
```

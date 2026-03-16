# Classic Vine Loop Normalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize classic Vine loop counts app-wide so classic videos always display the larger archived Vine loop total instead of tiny new diVine loop counters.

**Architecture:** Keep the contract fix in the Funnelcake transform layer, where raw API payloads become `ParsedVideoData`. For classic Vine videos only, compute a canonical loop count from the maximum archived-loop source and preserve that invariant through any helper that merges later stats onto a video object.

**Tech Stack:** TypeScript, React 18, Vitest, Vite, React Query

---

## Chunk 1: Normalize classic loop counts at the transform boundary

### Task 1: Add failing transform tests for classic and non-classic payloads

**Spec reference:** `docs/superpowers/specs/2026-03-16-classic-vine-loop-normalization-design.md`

**Files:**
- Modify: `src/lib/funnelcakeTransform.test.ts`
- Test: `src/lib/funnelcakeTransform.test.ts`

- [ ] **Step 1: Write the failing test for classic user-video payloads that contain large archived counts in text**

Add a test shaped like:

```ts
it('prefers the larger archived loop count for classic videos when raw loops are smaller', () => {
  const video = transformFunnelcakeVideo(makeRawVideo({
    platform: 'vine',
    loops: 1,
    views: 2,
    content: 'Original stats: 14,890,612 loops - 59,540 likes',
  }));

  expect(video.loopCount).toBe(14890612);
  expect(video.divineViewCount).toBe(2);
});
```

- [ ] **Step 2: Write the failing test for classic payloads that already have a large `raw.loops` value**

Add a test shaped like:

```ts
it('keeps the API loop count when it is already the largest classic value', () => {
  const video = transformFunnelcakeVideo(makeRawVideo({
    platform: 'vine',
    loops: 2965624,
    content: 'Original stats: 2,100,000 loops - 500 likes',
  }));

  expect(video.loopCount).toBe(2965624);
});
```

- [ ] **Step 3: Write the safety test for non-classic payloads**

Add a test shaped like:

```ts
it('does not treat free-text loop counts as archived stats for non-classic videos', () => {
  const video = transformFunnelcakeVideo(makeRawVideo({
    platform: 'tiktok',
    loops: 12,
    content: 'Original stats: 999,999 loops',
  }));

  expect(video.isVineMigrated).toBe(false);
  expect(video.loopCount).toBe(12);
});
```

- [ ] **Step 4: Run the targeted tests to verify the new behavior fails first**

Run:

```bash
npx vitest run src/lib/funnelcakeTransform.test.ts
```

Expected: FAIL because classic payloads still trust the smaller `raw.loops` value first.

- [ ] **Step 5: Commit the red test state**

```bash
git add src/lib/funnelcakeTransform.test.ts
git commit -m "test: capture classic Vine loop normalization cases"
```

### Task 2: Implement transform-layer normalization with minimal code

**Files:**
- Modify: `src/lib/funnelcakeTransform.ts`
- Modify: `src/lib/funnelcakeTransform.test.ts`
- Test: `src/lib/funnelcakeTransform.test.ts`

- [ ] **Step 1: Add a focused helper for resolving canonical classic loop counts**

Implement logic in `src/lib/funnelcakeTransform.ts` that:

```ts
function resolveLoopCount(raw: FunnelcakeVideoRaw, isVineMigrated: boolean): number {
  const contentLoops = parseLoopsFromContent(raw.content) ?? 0;
  const titleLoops = parseLoopsFromContent(raw.title) ?? 0;
  const apiLoops = raw.loops ?? 0;

  if (!isVineMigrated) {
    return apiLoops || contentLoops || titleLoops || 0;
  }

  return Math.max(apiLoops, contentLoops, titleLoops, 0);
}
```

Keep the helper compact and reuse the existing parsing function instead of duplicating regex logic.

- [ ] **Step 2: Replace the inline `loopCount` assignment in `transformFunnelcakeVideo`**

Update the transform to use the new resolver while keeping:

```ts
divineViewCount: raw.views ?? 0
```

unchanged.

- [ ] **Step 3: Run the targeted transform tests to verify green**

Run:

```bash
npx vitest run src/lib/funnelcakeTransform.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit the minimal green implementation**

```bash
git add src/lib/funnelcakeTransform.ts src/lib/funnelcakeTransform.test.ts
git commit -m "fix: normalize classic Vine loop counts"
```

## Chunk 2: Preserve normalized classic counts in follow-on merges

### Task 3: Add a failing merge test if later stats can overwrite classic counts

**Files:**
- Modify: `src/lib/funnelcakeTransform.test.ts`
- Modify: `src/lib/funnelcakeTransform.ts`
- Test: `src/lib/funnelcakeTransform.test.ts`

- [ ] **Step 1: Add a failing test for merge behavior on classic videos**

Add a test shaped like:

```ts
it('does not let later stats overwrite a classic archived loop count with a smaller value', () => {
  const classicVideo = transformFunnelcakeVideo(makeRawVideo({
    platform: 'vine',
    loops: 1,
    content: 'Original stats: 791,451 loops - 1,021 likes',
  }));

  const merged = mergeVideoStats(classicVideo, { loops: 2 });

  expect(merged.loopCount).toBe(791451);
});
```

- [ ] **Step 2: Run the targeted tests to verify the merge case fails if the helper regresses**

Run:

```bash
npx vitest run src/lib/funnelcakeTransform.test.ts
```

Expected: FAIL if `mergeVideoStats` still blindly writes the smaller loop count.

- [ ] **Step 3: Update `mergeVideoStats` only if the failing test proves it is needed**

If the test fails, preserve the larger classic count with logic shaped like:

```ts
loopCount: video.isVineMigrated
  ? Math.max(video.loopCount ?? 0, stats.loops ?? 0)
  : (stats.loops ?? video.loopCount),
```

Do not change merge behavior for non-classic videos.

- [ ] **Step 4: Re-run the targeted tests**

Run:

```bash
npx vitest run src/lib/funnelcakeTransform.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit only if a merge fix was required**

```bash
git add src/lib/funnelcakeTransform.ts src/lib/funnelcakeTransform.test.ts
git commit -m "fix: preserve normalized classic loop counts in merges"
```

## Chunk 3: Full verification and handoff

### Task 4: Verify the app-level fix and prepare handoff

**Files:**
- Review: `src/lib/funnelcakeTransform.ts`
- Review: `src/lib/funnelcakeTransform.test.ts`
- Review: `docs/superpowers/specs/2026-03-16-classic-vine-loop-normalization-design.md`

- [ ] **Step 1: Run the focused tests again**

Run:

```bash
npx vitest run src/lib/funnelcakeTransform.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full project verification**

Run:

```bash
npm test
```

Expected: PASS with only the repository’s pre-existing warnings.

- [ ] **Step 3: Inspect the branch state**

Run:

```bash
git status --short
git log --oneline --decorate -n 5
```

Expected: only intended implementation changes remain.

- [ ] **Step 4: Commit the final implementation if verification is green**

```bash
git add src/lib/funnelcakeTransform.ts src/lib/funnelcakeTransform.test.ts
git commit -m "fix: keep classic Vine loop counts canonical"
```

- [ ] **Step 5: Summarize outcomes and residual risk**

Document:

- which transform invariants changed
- whether `mergeVideoStats` needed hardening
- that `npm test` passed in the clean worktree
- any remaining risk that depends on future Funnelcake API contract changes

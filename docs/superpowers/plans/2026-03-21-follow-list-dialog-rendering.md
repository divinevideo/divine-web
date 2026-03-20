# Follow List Dialog Rendering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the profile followers/following dialog show usable rows immediately instead of opening as a blank or unreadable panel.

**Architecture:** Keep the existing `UserListDialog` and virtualization flow, but give the dialog body a measurable viewport and make the row UI independent from author hydration. Pubkeys remain the source of truth for row count and navigation, while `useBatchedAuthors` enriches visible rows after initial render.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, TanStack Virtual, shadcn/Radix dialog primitives

---

## Chunk 1: Regression Coverage

### Task 1: Add a failing dialog regression test

**Files:**
- Create: `src/components/UserListDialog.test.tsx`
- Modify: `src/components/UserListDialog.tsx`
- Test: `src/components/UserListDialog.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders visible fallback rows before author metadata resolves', async () => {
  render(
    <UserListDialog
      open
      onOpenChange={() => {}}
      title="Followers"
      pubkeys={[PUBKEY_A, PUBKEY_B]}
    />
  );

  expect(await screen.findByRole('button', { name: /generated-name-for-a/i })).toBeVisible();
  expect(screen.getByRole('button', { name: /generated-name-for-b/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/components/UserListDialog.test.tsx`
Expected: FAIL because the dialog does not render usable visible rows from pubkeys alone.

## Chunk 2: Dialog Fix

### Task 2: Make the dialog viewport measurable and keep rows usable without metadata

**Files:**
- Modify: `src/components/UserListDialog.tsx`
- Test: `src/components/UserListDialog.test.tsx`

- [ ] **Step 3: Write the minimal implementation**

```tsx
<DialogContent className="max-w-sm h-[min(80vh,36rem)] flex flex-col p-0">
  ...
  <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
    ...
  </div>
</DialogContent>
```

```tsx
const displayName = metadata?.display_name || metadata?.name || genUserName(pubkey);
const visibleIndexes = virtualItems.length > 0 ? virtualItems : fallbackItems;
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npx vitest run src/components/UserListDialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the related profile header test**

Run: `npx vitest run src/components/ProfileHeader.test.tsx src/components/UserListDialog.test.tsx`
Expected: PASS

## Chunk 3: Full Verification

### Task 3: Verify the change against the project baseline

**Files:**
- Modify: `src/components/UserListDialog.tsx`
- Create: `src/components/UserListDialog.test.tsx`

- [ ] **Step 6: Run the full project verification**

Run: `npm run test`
Expected: PASS with the same existing warnings seen in the clean baseline.

- [ ] **Step 7: Review the diff for scope control**

Run: `git diff -- src/components/UserListDialog.tsx src/components/UserListDialog.test.tsx docs/superpowers/specs/2026-03-21-follow-list-dialog-rendering-design.md docs/superpowers/plans/2026-03-21-follow-list-dialog-rendering.md`
Expected: Only the dialog, its test, and the required docs have changed.

- [ ] **Step 8: Commit the docs and fix**

```bash
git add docs/superpowers/specs/2026-03-21-follow-list-dialog-rendering-design.md \
        docs/superpowers/plans/2026-03-21-follow-list-dialog-rendering.md \
        src/components/UserListDialog.tsx \
        src/components/UserListDialog.test.tsx
git commit -m "fix: restore follow list dialog rows"
```

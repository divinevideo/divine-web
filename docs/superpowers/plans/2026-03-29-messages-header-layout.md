# Messages Header Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the direct messages header so search and compose are primary, and move Divine Support out of the header into a normal conversation row.

**Architecture:** Keep the existing `MessagesPage` structure and visual shell, but simplify the top section into a site-native header card and promote support as a standard row in the inbox list. Add a focused page test that proves the header no longer contains support UI and that support is rendered in the list separately.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, Tailwind CSS, React Router, TanStack Query

---

## Chunk 1: Test Coverage

### Task 1: Add a Messages page layout test

**Files:**
- Create: `src/pages/MessagesPage.test.tsx`
- Modify: `src/pages/MessagesPage.tsx`
- Test: `src/pages/MessagesPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('keeps support out of the header card and renders it as a conversation row', async () => {
  render(<MessagesPage />);

  expect(screen.getByRole('heading', { name: /direct messages/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /new message/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /message support/i })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /divine support/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vitest run src/pages/MessagesPage.test.tsx`
Expected: FAIL because the current header still renders support UI inside the top card and the support row is not yet part of the list.

- [ ] **Step 3: Write minimal implementation**

Update `MessagesPage` so the header only contains the page copy, search field, and `New message` CTA. Render a standard support `ConversationRow` above the normal conversation list.

- [ ] **Step 4: Run test to verify it passes**

Run: `vitest run src/pages/MessagesPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pages/MessagesPage.tsx src/pages/MessagesPage.test.tsx
git commit -m "feat: simplify messages header layout"
```

## Chunk 2: Layout Refinement and Verification

### Task 2: Align the header card with existing inbox page patterns

**Files:**
- Modify: `src/pages/MessagesPage.tsx`
- Reference: `src/pages/ConversationPage.tsx`
- Test: `src/pages/MessagesPage.test.tsx`

- [ ] **Step 1: Tighten the header layout**

Apply existing inbox card sizing and spacing patterns:

- keep `rounded-[32px]`, translucent background, and green shadow treatment
- remove the custom desktop support tile column
- make the search row the primary visual action
- let mobile stack without custom asymmetric sizing

- [ ] **Step 2: Verify the targeted test still passes**

Run: `vitest run src/pages/MessagesPage.test.tsx`
Expected: PASS

- [ ] **Step 3: Run full verification**

Run: `npm run test`
Expected: Existing baseline warnings may remain, but the command exits successfully.

- [ ] **Step 4: Commit**

```bash
git add src/pages/MessagesPage.tsx src/pages/MessagesPage.test.tsx
git commit -m "test: cover messages header layout"
```

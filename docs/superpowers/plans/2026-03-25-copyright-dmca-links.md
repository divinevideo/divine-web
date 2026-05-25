# Copyright & DMCA Links Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the missing `Copyright & DMCA` navigation entry in the footer and authenticated legal menus without changing the existing FAQ wording.

**Architecture:** Keep the fix localized to the existing navigation components. Add regression tests first for each affected surface, then insert the minimal `/dmca` link into the footer, desktop sidebar, and mobile header dropdown while leaving the FAQ copy unchanged.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Testing Library, Radix dropdown/collapsible primitives

---

## Chunk 1: Regression Coverage

### Task 1: Add failing coverage for the missing legal link and preserved FAQ copy

**Files:**
- Create: `src/components/AppFooter.test.tsx`
- Create: `src/components/AppSidebar.test.tsx`
- Create: `src/components/AppHeader.test.tsx`
- Create: `src/pages/FAQPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
it('renders a Copyright & DMCA footer link to /dmca', () => {
  render(<AppFooter />);
  expect(screen.getByRole('link', { name: 'Copyright & DMCA' })).toHaveAttribute('href', '/dmca');
});
```

```tsx
it('renders a Copyright & DMCA legal link in the sidebar', async () => {
  render(<AppSidebar />);
  await user.click(screen.getByRole('button', { name: /terms & open source/i }));
  expect(screen.getByRole('button', { name: 'Copyright & DMCA' })).toBeVisible();
});
```

```tsx
it('renders a Copyright & DMCA legal link in the mobile header menu', async () => {
  render(<AppHeader />);
  await user.click(screen.getByRole('button', { name: /open menu/i }));
  expect(screen.getByRole('menuitem', { name: 'Copyright & DMCA' })).toBeVisible();
});
```

```tsx
it('keeps the FAQ DMCA policy link pointing to /dmca', async () => {
  render(<FAQPage />);
  expect(await screen.findByRole('link', { name: 'DMCA policy' })).toHaveAttribute('href', '/dmca');
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npx vitest run src/components/AppFooter.test.tsx src/components/AppSidebar.test.tsx src/components/AppHeader.test.tsx src/pages/FAQPage.test.tsx`
Expected: FAIL because the footer, sidebar, and header do not yet expose the `Copyright & DMCA` entry.

## Chunk 2: Navigation Fix

### Task 2: Add the missing legal links without changing FAQ copy

**Files:**
- Modify: `src/components/AppFooter.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/AppHeader.tsx`
- Test: `src/components/AppFooter.test.tsx`
- Test: `src/components/AppSidebar.test.tsx`
- Test: `src/components/AppHeader.test.tsx`
- Test: `src/pages/FAQPage.test.tsx`

- [ ] **Step 3: Write the minimal implementation**

```tsx
<SmartLink to="/dmca" className="hover:text-brand-off-white transition-colors">
  Copyright & DMCA
</SmartLink>
```

```tsx
<button onClick={() => navigate('/dmca')} className="transition-colors hover:text-primary">
  Copyright & DMCA
</button>
```

```tsx
<DropdownMenuItem onClick={() => navigate('/dmca')} className="cursor-pointer hover:bg-muted focus:bg-muted">
  <FileText className="mr-2 h-4 w-4" />
  <span>Copyright & DMCA</span>
</DropdownMenuItem>
```

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/components/AppFooter.test.tsx src/components/AppSidebar.test.tsx src/components/AppHeader.test.tsx src/pages/FAQPage.test.tsx`
Expected: PASS

## Chunk 3: Full Verification

### Task 3: Verify the scoped change against the baseline

**Files:**
- Modify: `src/components/AppFooter.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/AppHeader.tsx`
- Create: `src/components/AppFooter.test.tsx`
- Create: `src/components/AppSidebar.test.tsx`
- Create: `src/components/AppHeader.test.tsx`
- Create: `src/pages/FAQPage.test.tsx`
- Create: `docs/superpowers/specs/2026-03-25-copyright-dmca-links-design.md`
- Create: `docs/superpowers/plans/2026-03-25-copyright-dmca-links.md`

- [ ] **Step 5: Run the full project verification**

Run: `npm run test`
Expected: PASS with the same pre-existing lint/build warnings seen in the clean baseline.

- [ ] **Step 6: Review the final diff for scope control**

Run: `git diff -- docs/superpowers/specs/2026-03-25-copyright-dmca-links-design.md docs/superpowers/plans/2026-03-25-copyright-dmca-links.md src/components/AppFooter.tsx src/components/AppHeader.tsx src/components/AppSidebar.tsx src/components/AppFooter.test.tsx src/components/AppHeader.test.tsx src/components/AppSidebar.test.tsx src/pages/FAQPage.test.tsx`
Expected: Only the docs, targeted nav components, and focused tests have changed.

- [ ] **Step 7: Commit the scoped restore**

```bash
git add docs/superpowers/specs/2026-03-25-copyright-dmca-links-design.md \
        docs/superpowers/plans/2026-03-25-copyright-dmca-links.md \
        src/components/AppFooter.tsx \
        src/components/AppHeader.tsx \
        src/components/AppSidebar.tsx \
        src/components/AppFooter.test.tsx \
        src/components/AppHeader.test.tsx \
        src/components/AppSidebar.test.tsx \
        src/pages/FAQPage.test.tsx
git commit -m "fix: restore copyright and dmca links"
```

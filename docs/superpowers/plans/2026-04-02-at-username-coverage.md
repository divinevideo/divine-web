# AtUsernamePage Coverage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct regression coverage for the shipped `AtUsernamePage` behavior and fix mixed-case client-side username lookup normalization.

**Architecture:** Keep the existing `AtUsernamePage` and worker flow intact. Add a page test file that mocks the current collaborators (`useParams`, `useNavigate`, `getSubdomainUser`, `ProfilePage`) and make the smallest possible production change so mixed-case usernames are normalized before the NIP-05 fetch.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, TanStack Query, Vite

---

### Task 1: Add the failing page coverage

**Files:**
- Create: `src/pages/AtUsernamePage.test.tsx`
- Modify: `src/pages/AtUsernamePage.tsx`
- Test: `src/pages/AtUsernamePage.test.tsx`

- [ ] **Step 1: Write the failing test file**

Add page-level tests for:
- successful lookup navigates to `/profile/:npub`
- mixed-case usernames are lowercased before fetch
- failed lookup shows the not-found card
- invalid pubkey shows the not-found card
- pending fetch shows the loading copy
- injected subdomain user skips fetch and renders `ProfilePage`

- [ ] **Step 2: Run the targeted test to verify the intended failure**

Run: `npx vitest run src/pages/AtUsernamePage.test.tsx`
Expected: at least the lowercase lookup case fails against current production code.

- [ ] **Step 3: Implement the minimal production fix**

Normalize the username used by the fetch query in `src/pages/AtUsernamePage.tsx` before constructing the request URL and reading the response map.

- [ ] **Step 4: Re-run the targeted test**

Run: `npx vitest run src/pages/AtUsernamePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full verification suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-04-02-at-username-coverage-design.md \
  docs/superpowers/plans/2026-04-02-at-username-coverage.md \
  src/pages/AtUsernamePage.test.tsx \
  src/pages/AtUsernamePage.tsx
git commit -m "Add AtUsernamePage coverage and normalize lookups"
```

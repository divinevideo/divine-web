# Tabbed Auth Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the invite-first auth modal into explicit `Register` and `Sign in` tabs while keeping mainstream auth on the hosted `login.divine.video` flow.

**Architecture:** Keep `LoginDialog` as the auth state coordinator, but split its public surface into two modes. Registration stays invite-first and redirect-based; sign-in becomes its own hosted-auth handoff tab with advanced Nostr methods demoted to a text disclosure inside that tab.

**Tech Stack:** React 18, TypeScript, Radix Tabs/Collapsible, Vitest, Testing Library

---

### Task 1: Lock The UX Contract In Docs

**Files:**
- Create: `docs/superpowers/specs/2026-03-29-tabbed-auth-modal-design.md`
- Create: `docs/superpowers/plans/2026-03-29-tabbed-auth-modal.md`

- [ ] **Step 1: Save the approved design note**

Capture the tabbed auth structure, hosted sign-in decision, and the dependency boundary around `login.divine.video`.

- [ ] **Step 2: Save the implementation plan**

Record the test-first execution path and the specific files that will change.

### Task 2: Write The Failing Modal Tests

**Files:**
- Modify: `src/components/auth/LoginDialog.test.tsx`

- [ ] **Step 1: Add a failing test for the segmented register/sign-in shell**

Assert that the default tab is `Register`, the invite field is visible there, and the old `I already have an account` button is gone.

- [ ] **Step 2: Add a failing test for hosted sign-in inside the new tab**

Assert that switching to `Sign in` shows a primary `Continue to sign in` button and a `Use Nostr instead` link.

- [ ] **Step 3: Add a failing test for hosted sign-in redirect success**

Run: `npx vitest run src/components/auth/LoginDialog.test.tsx`

Expected: FAIL because the dialog still exposes the old standalone existing-account button instead of the new sign-in tab.

- [ ] **Step 4: Add a failing test for invite-service degradation**

Assert that register shows degraded messaging while the sign-in tab still exposes the hosted sign-in CTA.

### Task 3: Implement The Phase 1 Modal Refresh

**Files:**
- Modify: `src/components/auth/LoginDialog.tsx`
- Modify: `src/components/auth/InviteCodeForm.tsx`
- Modify: `src/components/auth/WaitlistForm.tsx`
- Create: `src/components/auth/WebAccountSignInForm.tsx`

- [ ] **Step 1: Add the new sign-in tab component**

Implement the hosted sign-in CTA and quiet Nostr disclosure affordance.

- [ ] **Step 2: Rework `LoginDialog` around explicit tabs**

Keep register invite handling and waitlist state on the register tab, move advanced Nostr options under the sign-in tab, and remove the standalone existing-account button.

- [ ] **Step 3: Restyle register secondary actions**

Make waitlist/back affordances read like text links rather than competing full-width secondary buttons.

- [ ] **Step 4: Run focused auth tests**

Run: `npx vitest run src/components/auth/LoginDialog.test.tsx src/components/auth/LocalNsecBanner.test.tsx src/lib/divineLogin.test.ts src/pages/AuthCallbackPage.test.tsx src/pages/AuthCallbackPage.integration.test.tsx`

Expected: PASS

### Task 4: Verify The Branch And Update The PR

**Files:**
- Modify: `src/components/auth/LoginDialog.tsx`
- Modify: `src/components/auth/InviteCodeForm.tsx`
- Modify: `src/components/auth/WaitlistForm.tsx`
- Create: `src/components/auth/WebAccountSignInForm.tsx`
- Create: `docs/superpowers/specs/2026-03-29-tabbed-auth-modal-design.md`
- Create: `docs/superpowers/plans/2026-03-29-tabbed-auth-modal.md`

- [ ] **Step 1: Run full project verification**

Run: `npm run test`

Expected: PASS

- [ ] **Step 2: Commit the focused branch changes**

```bash
git add docs/superpowers/specs/2026-03-29-tabbed-auth-modal-design.md \
  docs/superpowers/plans/2026-03-29-tabbed-auth-modal.md \
  src/components/auth/LoginDialog.tsx \
  src/components/auth/LoginDialog.test.tsx \
  src/components/auth/InviteCodeForm.tsx \
  src/components/auth/WaitlistForm.tsx \
  src/components/auth/WebAccountSignInForm.tsx
git commit -m "Refine the web auth modal tabs"
```

- [ ] **Step 3: Push the branch back onto PR #204**

Push the verified head to `origin/codex/web-auth-launch-swarm` so the open PR reflects the updated auth UX.

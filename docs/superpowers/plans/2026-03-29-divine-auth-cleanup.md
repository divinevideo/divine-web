# Divine Auth Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead `oauth.divine.video` browser-auth code and rename the live JWT-backed auth bridge to `Divine*` names without changing user sessions.

**Architecture:** Treat this as a cleanup, not a login-flow rewrite. Delete the unused Keycast browser auth slice, rename the live session/signer/component surface to `Divine*`, and repoint the signer to the supported `login.divine.video/api/nostr` RPC contract while preserving existing storage keys for compatibility.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, `@divinevideo/login`

---

### Task 1: Save The Cleanup Docs

**Files:**
- Create: `docs/superpowers/specs/2026-03-29-divine-auth-cleanup-design.md`
- Create: `docs/superpowers/plans/2026-03-29-divine-auth-cleanup.md`

- [ ] **Step 1: Save the approved cleanup design note**

Capture the deletion scope, the `Divine*` rename boundary, the compatibility decision for storage keys, and the `login.divine.video/api/nostr` signer contract.

- [ ] **Step 2: Save the implementation plan**

Record the red-green-refactor execution path for the cleanup.

### Task 2: Write The Failing Renaming Tests

**Files:**
- Modify: `src/lib/DivineJWTSigner.test.ts`
- Modify: `src/components/DivineJWTWindowNostr.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/hooks/useCurrentUser.test.ts`
- Modify: `src/pages/AuthCallbackPage.test.tsx`
- Modify: `src/components/auth/AccountSwitcher.test.tsx`
- Modify: `src/hooks/useLoggedInAccounts.test.ts`
- Modify: `src/hooks/useWindowNostrJWT.test.ts`
- Modify: `src/hooks/useDivineSession.test.tsx`

- [ ] **Step 1: Update the signer tests to the new `DivineJWTSigner` API**

Assert that the default request target is `https://login.divine.video/api/nostr` and that signer methods use RPC method names instead of fake per-endpoint REST URLs.

- [ ] **Step 2: Update component and hook tests to import the renamed `Divine*` modules**

Switch mocks and expectations from `Keycast*` names to `Divine*` names while preserving the same runtime behavior assertions.

- [ ] **Step 3: Run focused tests to verify they fail for the expected reasons**

Run: `npx vitest run src/lib/DivineJWTSigner.test.ts src/components/DivineJWTWindowNostr.test.tsx src/App.test.tsx src/hooks/useCurrentUser.test.ts src/pages/AuthCallbackPage.test.tsx src/components/auth/AccountSwitcher.test.tsx src/hooks/useLoggedInAccounts.test.ts src/hooks/useWindowNostrJWT.test.ts src/hooks/useDivineSession.test.tsx`

Expected: FAIL because the production signer still targets the bogus endpoint shape and the live runtime surface has not been renamed yet.

### Task 3: Implement The Auth Cleanup

**Files:**
- Delete: `src/lib/keycast.ts`
- Delete: `src/components/auth/KeycastLoginForm.tsx`
- Delete: `src/components/auth/KeycastSignupDialog.tsx`
- Delete: `src/components/KeycastAutoConnect.tsx`
- Move/Modify: `src/lib/DivineJWTSigner.ts`
- Move/Modify: `src/lib/DivineJWTSigner.test.ts`
- Move/Modify: `src/hooks/useDivineSession.ts`
- Move/Modify: `src/hooks/useDivineSession.test.tsx`
- Move/Modify: `src/components/DivineJWTWindowNostr.tsx`
- Move/Modify: `src/components/DivineJWTWindowNostr.test.tsx`
- Modify: `src/hooks/useWindowNostrJWT.ts`
- Modify: `src/hooks/useWindowNostrJWT.test.ts`
- Modify: `src/hooks/useCurrentUser.ts`
- Modify: `src/hooks/useCurrentUser.test.ts`
- Modify: `src/hooks/useLoggedInAccounts.ts`
- Modify: `src/hooks/useLoggedInAccounts.test.ts`
- Modify: `src/pages/AuthCallbackPage.tsx`
- Modify: `src/pages/AuthCallbackPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/auth/AccountSwitcher.tsx`
- Modify: `src/components/auth/AccountSwitcher.test.tsx`
- Modify: `docs/superpowers/specs/2026-03-29-tabbed-auth-modal-design.md`

- [ ] **Step 1: Rename the live signer/session/component surface**

Move the files to `Divine*` names, update imports, and keep localStorage key names unchanged inside the renamed session hook.

- [ ] **Step 2: Repoint the signer to the supported RPC contract**

Replace the fake `oauth.divine.video` REST endpoint logic with a `login.divine.video/api/nostr` RPC-backed implementation that still satisfies the app’s `NostrSigner` expectations.

- [ ] **Step 3: Delete the dead browser auth slice**

Remove the unused browser auth client and unused Keycast-only auth components from the tree.

- [ ] **Step 4: Run the focused cleanup tests**

Run: `npx vitest run src/lib/DivineJWTSigner.test.ts src/components/DivineJWTWindowNostr.test.tsx src/App.test.tsx src/hooks/useCurrentUser.test.ts src/pages/AuthCallbackPage.test.tsx src/components/auth/AccountSwitcher.test.tsx src/hooks/useLoggedInAccounts.test.ts src/hooks/useWindowNostrJWT.test.ts src/hooks/useDivineSession.test.tsx`

Expected: PASS

### Task 4: Verify And Update The Branch

**Files:**
- Modify: `docs/superpowers/specs/2026-03-29-divine-auth-cleanup-design.md`
- Modify: `docs/superpowers/plans/2026-03-29-divine-auth-cleanup.md`
- Modify: auth cleanup files from Task 3

- [ ] **Step 1: Run full verification**

Run: `npm run test`

Expected: PASS

- [ ] **Step 2: Commit the cleanup**

```bash
git add docs/superpowers/specs/2026-03-29-divine-auth-cleanup-design.md \
  docs/superpowers/plans/2026-03-29-divine-auth-cleanup.md \
  src/App.tsx \
  src/App.test.tsx \
  src/components/DivineJWTWindowNostr.tsx \
  src/components/DivineJWTWindowNostr.test.tsx \
  src/components/auth/AccountSwitcher.tsx \
  src/components/auth/AccountSwitcher.test.tsx \
  src/hooks/useCurrentUser.ts \
  src/hooks/useCurrentUser.test.ts \
  src/hooks/useDivineSession.ts \
  src/hooks/useDivineSession.test.tsx \
  src/hooks/useLoggedInAccounts.ts \
  src/hooks/useLoggedInAccounts.test.ts \
  src/hooks/useWindowNostrJWT.ts \
  src/hooks/useWindowNostrJWT.test.ts \
  src/lib/DivineJWTSigner.ts \
  src/lib/DivineJWTSigner.test.ts \
  src/pages/AuthCallbackPage.tsx \
  src/pages/AuthCallbackPage.test.tsx
git commit -m "refactor: clean up stale divine auth naming"
```

- [ ] **Step 3: Push the updated PR branch**

Push the verified head to `origin/codex/web-auth-launch-swarm`.

# Invite-First Web Auth Launch Swarm

**Date:** 2026-03-23
**Coordinator branch:** `codex/web-auth-launch-swarm`
**Coordinator worktree:** `/Users/rabble/code/divine/divine-web/.worktrees/web-auth-launch-swarm`
**Coordinator commit:** `8c76480` (`Add invite-first web auth launch spec and plan`)

## Baseline

- `origin/main` baseline verified in the coordinator worktree on 2026-03-23.
- `npm install --no-audit --no-fund` completed successfully.
- `npm run test` passed:
  - 53 test files
  - 411 passing tests
  - 1 skipped test
  - existing ESLint/Vite warnings only

## Why This Swarm Split

The implementation plan is not safely parallel if every task becomes its own agent. The current codebase has a few merge hotspots:

- `src/components/auth/LoginDialog.tsx`
- `src/components/auth/LoginArea.tsx`
- `src/components/auth/AccountSwitcher.tsx`
- `src/lib/divineLogin.ts` once introduced

The swarm below avoids assigning those files to multiple agents in the same wave. Foundations land first, then UI and callback work branch from stable contracts, then local-`nsec` UX layers on top.

## Wave Plan

### Wave 1: Parallel-safe foundations

These two agents can run immediately and independently from `8c76480`.

### Agent 1: Invite/Auth Foundations

**Goal:** establish the external contracts and redirect helpers that every downstream track depends on.

**Own files:**
- `package.json`
- `package-lock.json`
- `src/lib/inviteApi.ts`
- `src/lib/inviteApi.test.ts`
- `src/lib/authHandoff.ts`
- `src/lib/authHandoff.test.ts`
- `src/lib/divineLogin.ts`
- `src/lib/divineLogin.test.ts`

**Do not touch:**
- `src/components/auth/LoginDialog.tsx`
- `src/components/auth/LoginArea.tsx`
- `src/components/auth/AccountSwitcher.tsx`
- `src/pages/AuthCallbackPage.tsx`
- `src/AppRouter.tsx`

**Tests:**
```bash
vitest run \
  src/lib/inviteApi.test.ts \
  src/lib/authHandoff.test.ts \
  src/lib/divineLogin.test.ts
```

**Notes:**
- Centralize all unstable `login.divine.video` route details in `src/lib/divineLogin.ts`.
- Keep invite cookie/handoff state separate from existing long-lived cross-subdomain login persistence.

### Agent 2: Local `nsec` Primitives

**Goal:** detect active/stored local `nsec` logins and expose safe backup/export helpers without changing the auth UI yet.

**Own files:**
- `src/lib/localNsecAccount.ts`
- `src/lib/localNsecAccount.test.ts`
- `src/hooks/useLoginActions.ts`

**Do not touch:**
- `src/components/auth/LoginDialog.tsx`
- `src/components/auth/LoginArea.tsx`
- `src/components/auth/AccountSwitcher.tsx`
- `src/lib/divineLogin.ts`

**Tests:**
```bash
vitest run src/lib/localNsecAccount.test.ts
```

**Notes:**
- Add the smallest safe `exportCurrentNsec()` surface possible.
- Do not wire any banner UI in this wave.

### Wave 2: Contract consumers

These agents start only after Agent 1 lands. They can run in parallel with each other because they own different hotspots.

### Agent 3: Callback and Return Plumbing

**Base:** cherry-pick or merge Agent 1 first.

**Goal:** handle the return from `login.divine.video`, hydrate the resulting login, and clear invite handoff state.

**Own files:**
- `src/pages/AuthCallbackPage.tsx`
- `src/pages/AuthCallbackPage.test.tsx`
- `src/AppRouter.tsx`
- `src/lib/crossSubdomainAuth.ts`
- `src/lib/crossSubdomainAuth.test.ts`

**Do not touch:**
- `src/components/auth/LoginDialog.tsx`
- `src/components/auth/LoginArea.tsx`
- `src/components/auth/AccountSwitcher.tsx`

**Tests:**
```bash
vitest run \
  src/lib/crossSubdomainAuth.test.ts \
  src/pages/AuthCallbackPage.test.tsx
```

**Notes:**
- Consume Agent 1 contracts instead of duplicating callback parsing or redirect logic.
- Extend cross-subdomain auth only when callback hydration needs it.

### Agent 4: Invite-First Public Funnel

**Base:** cherry-pick or merge Agent 1 first.

**Goal:** replace the waitlist-first public auth experience with the invite-first dialog and waitlist fallback, while keeping advanced Nostr methods behind secondary disclosure.

**Own files:**
- `src/components/auth/LoginDialog.tsx`
- `src/components/auth/LoginDialog.test.tsx`
- `src/components/auth/InviteCodeForm.tsx`
- `src/components/auth/WaitlistForm.tsx`
- `src/components/auth/LoginArea.tsx`
- `src/components/auth/LoginArea.test.tsx`
- `src/components/auth/SignupDialog.tsx`
- `src/main.tsx`

**Do not touch:**
- `src/components/auth/AccountSwitcher.tsx`
- `src/components/auth/LocalNsecBanner.tsx`
- `src/lib/localNsecAccount.ts`
- `src/hooks/useLoginActions.ts`
- `src/pages/AuthCallbackPage.tsx`

**Tests:**
```bash
vitest run \
  src/components/auth/LoginDialog.test.tsx \
  src/components/auth/LoginArea.test.tsx
```

**Notes:**
- Agent 4 owns `LoginDialog.tsx` completely in this wave.
- Keep a clearly marked insertion point for the later local-`nsec` banner so Agent 5 does not need to restructure the dialog state machine.
- Replace the `#signup` deep-link behavior with invite-first dialog opening.

### Wave 3: Local `nsec` UX integration

This agent starts after Agent 2 and Agent 4 land.

### Agent 5: Local `nsec` Banner and CTA Wiring

**Base:** merge Agent 2 and Agent 4 first.

**Goal:** show the inline local-`nsec` banner in the real surfaces and wire backup/secure-account actions.

**Own files:**
- `src/components/auth/LocalNsecBanner.tsx`
- `src/components/auth/LocalNsecBanner.test.tsx`
- `src/components/auth/AccountSwitcher.tsx`
- `src/components/auth/LoginDialog.tsx`
- `src/lib/localNsecAccount.ts`
- `src/lib/divineLogin.ts`

**Do not touch:**
- `src/components/auth/LoginArea.tsx`
- `src/pages/AuthCallbackPage.tsx`
- `src/AppRouter.tsx`

**Tests:**
```bash
vitest run \
  src/lib/localNsecAccount.test.ts \
  src/lib/divineLogin.test.ts \
  src/components/auth/LocalNsecBanner.test.tsx \
  src/components/auth/LoginDialog.test.tsx
```

**Notes:**
- Restrict `LoginDialog.tsx` edits to banner insertion and CTA wiring only.
- Do not rework the invite-first state machine in this wave.
- `nsec` must never enter cookies, query parameters, or logs.

### Wave 4: Final integrator

This agent starts after Agents 3 and 5 land.

### Agent 6: Regression, QA, and Merge Hardening

**Base:** merge Agents 3 and 5 first.

**Goal:** resolve remaining integration friction, add regression coverage, and verify launch readiness.

**Own files:**
- any auth files already touched by earlier waves, but only for integration polish
- optional doc update to `docs/superpowers/specs/2026-03-23-invite-first-web-auth-launch-design.md`

**Tests:**
```bash
vitest run \
  src/lib/inviteApi.test.ts \
  src/lib/authHandoff.test.ts \
  src/lib/localNsecAccount.test.ts \
  src/lib/divineLogin.test.ts \
  src/pages/AuthCallbackPage.test.tsx \
  src/components/auth/LoginDialog.test.tsx \
  src/components/auth/LocalNsecBanner.test.tsx \
  src/components/auth/LoginArea.test.tsx

npm run test
```

**Manual QA:**
- valid invite redirects to `login.divine.video`
- invalid invite stays in dialog with inline error
- waitlist submission uses `invite.divine.video`
- advanced login methods remain accessible
- existing local `nsec` shows backup banner
- secure-account redirect starts without exposing `nsec`

## Merge Order

1. Merge Agent 1.
2. Merge Agent 2.
3. Dispatch Agents 3 and 4 in parallel on top of Agent 1.
4. Merge Agent 3.
5. Merge Agent 4.
6. Dispatch Agent 5 on top of merged Agent 2 + Agent 4.
7. Merge Agent 5.
8. Dispatch Agent 6 for final hardening and verification.

## Suggested Branches

Use the coordinator branch as the source for all agent branches.

```bash
git worktree add .worktrees/web-auth-foundations -b agent/web-auth-foundations codex/web-auth-launch-swarm
git worktree add .worktrees/web-auth-local-nsec -b agent/web-auth-local-nsec codex/web-auth-launch-swarm
```

After Agent 1 lands:

```bash
git worktree add .worktrees/web-auth-callback -b agent/web-auth-callback codex/web-auth-launch-swarm
git worktree add .worktrees/web-auth-funnel -b agent/web-auth-funnel codex/web-auth-launch-swarm
```

After Agents 2 and 4 land:

```bash
git worktree add .worktrees/web-auth-local-banner -b agent/web-auth-local-banner codex/web-auth-launch-swarm
```

## Coordinator Guidance

- Treat Agent 1 as the contract gate. Do not let downstream agents invent parallel invite or login helpers.
- Treat `LoginDialog.tsx` as a single-owner file per wave.
- Keep `src/lib/divineLogin.ts` as the only place allowed to know exact `login.divine.video` endpoints.
- Do not merge unfinished agents. Each wave should end with the agent’s targeted tests passing before the next wave starts.
- Run full-project verification only in Wave 4 after all partial branches are integrated.

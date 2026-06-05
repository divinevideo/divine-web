# PR 2 — JWT-over-bunker precedence fix (Issue #391, B-b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a present-but-unresolved or failed hosted-JWT session from blanking out an otherwise-valid login. While the JWT resolves, the UI must not flash "logged out" (and protected routes must not vanish); if the JWT signer fails, a valid bunker/extension login must keep working.

**Architecture:** `useCurrentUser` currently derives `users = token ? (jwtUser ? [jwtUser] : []) : manualUsers`. When a JWT token is present but `jwtUser` hasn't resolved (async `getPublicKey()` RPC, 10s timeout) or has failed, this yields `[]` — apparent logout — even with a valid `manualUsers` entry available. We extract the precedence decision into a pure helper with three explicit JWT states (resolving / resolved / failed), add a `jwtError` state so "failed" is distinguishable from "still resolving", fall back to `manualUsers` only on failure (not during resolve, preserving existing no-identity-flip behavior), and expose `isResolvingJwt` so `AppRouter` keeps protected routes mounted during the resolve window instead of treating it as logged-out.

**Tech Stack:** TypeScript, React, Vitest, @testing-library/react.

**Issue:** Relates to #391 (B-b). Design: `docs/superpowers/specs/2026-06-03-bunker-team-intermittent-logout-design.md`.

**Branch:** `fix/jwt-bunker-precedence` (already created off `main`).

---

## File Structure

- **Create:** `src/lib/selectCurrentUsers.ts` — two pure, dependency-free functions: `selectCurrentUsers` (the precedence decision) and `isJwtResolving`. Extracted so the logic is exhaustively unit-testable without rendering the hook.
- **Create:** `src/lib/selectCurrentUsers.test.ts` — exhaustive table tests.
- **Modify:** `src/hooks/useCurrentUser.ts` — add `jwtError` state; set it in the `getPublicKey()` catch instead of clearing `jwtPubkey`; derive `users` via `selectCurrentUsers`; compute and return `isResolvingJwt`.
- **Modify:** `src/hooks/useCurrentUser.test.ts` — add a failed-fallback test and an `isResolvingJwt` test (existing tests must stay green).
- **Modify:** `src/AppRouter.tsx:66-69` — `isLoggedIn = Boolean(user) || isResolvingJwt` so protected routes survive the JWT resolve window.

---

### Task 1: Pure precedence helper `selectCurrentUsers` + `isJwtResolving`

**Files:**
- Create: `src/lib/selectCurrentUsers.ts`
- Test: `src/lib/selectCurrentUsers.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/selectCurrentUsers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { selectCurrentUsers, isJwtResolving } from './selectCurrentUsers';

describe('selectCurrentUsers', () => {
  const manual = ['m1', 'm2'];

  it('returns manual logins when there is no hosted token', () => {
    expect(selectCurrentUsers({ hasToken: false, jwtUser: undefined, jwtError: false, manualUsers: manual }))
      .toEqual(manual);
  });

  it('returns the resolved JWT user, taking precedence over manual logins', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: 'jwt', jwtError: false, manualUsers: manual }))
      .toEqual(['jwt']);
  });

  it('falls back to manual logins when the JWT session failed', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: undefined, jwtError: true, manualUsers: manual }))
      .toEqual(manual);
  });

  it('returns none while the JWT session is still resolving (no identity flash)', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: undefined, jwtError: false, manualUsers: manual }))
      .toEqual([]);
  });

  it('returns none when the JWT failed and there is no manual login', () => {
    expect(selectCurrentUsers({ hasToken: true, jwtUser: undefined, jwtError: true, manualUsers: [] }))
      .toEqual([]);
  });
});

describe('isJwtResolving', () => {
  it('is false when there is no JWT signer', () => {
    expect(isJwtResolving({ hasSigner: false, jwtPubkey: undefined, jwtError: false })).toBe(false);
  });

  it('is true when a signer exists but pubkey not yet resolved and no error', () => {
    expect(isJwtResolving({ hasSigner: true, jwtPubkey: undefined, jwtError: false })).toBe(true);
  });

  it('is false once the pubkey has resolved', () => {
    expect(isJwtResolving({ hasSigner: true, jwtPubkey: 'abc', jwtError: false })).toBe(false);
  });

  it('is false once the session has errored', () => {
    expect(isJwtResolving({ hasSigner: true, jwtPubkey: undefined, jwtError: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/selectCurrentUsers.test.ts`
Expected: FAIL — module `./selectCurrentUsers` does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/lib/selectCurrentUsers.ts`:

```typescript
// ABOUTME: Pure precedence rules for resolving the active user(s) across a hosted
// JWT session and manual (extension/bunker/nsec) logins. Extracted from
// useCurrentUser so the three JWT states are exhaustively testable.

/**
 * Decide which logins are "current", given the hosted-JWT session state and the
 * available manual logins.
 *
 * - No hosted token: manual logins are authoritative.
 * - JWT resolved (`jwtUser` set): it takes precedence over manual logins.
 * - JWT failed (`jwtError`): fall back to manual logins so a valid bunker/
 *   extension login keeps working instead of appearing logged out.
 * - JWT still resolving: return none yet. Callers use `isJwtResolving` to avoid
 *   treating this transient state as "logged out". We deliberately do NOT fall
 *   back to manual here, to avoid flashing a different identity mid-resolve.
 */
export function selectCurrentUsers<U>(opts: {
  hasToken: boolean;
  jwtUser: U | undefined;
  jwtError: boolean;
  manualUsers: U[];
}): U[] {
  const { hasToken, jwtUser, jwtError, manualUsers } = opts;
  if (!hasToken) return manualUsers;
  if (jwtUser) return [jwtUser];
  if (jwtError) return manualUsers;
  return [];
}

/**
 * True while a hosted-JWT signer exists but its pubkey has not yet resolved and
 * has not errored — i.e. the session is still initializing. UI gates should
 * treat this as "still determining auth", not "logged out".
 */
export function isJwtResolving(opts: {
  hasSigner: boolean;
  jwtPubkey: string | undefined;
  jwtError: boolean;
}): boolean {
  return opts.hasSigner && !opts.jwtPubkey && !opts.jwtError;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/selectCurrentUsers.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/selectCurrentUsers.ts src/lib/selectCurrentUsers.test.ts
git commit -m "feat(auth): add pure selectCurrentUsers/isJwtResolving precedence helpers"
```

---

### Task 2: Wire `useCurrentUser` to the helper + add `jwtError` + expose `isResolvingJwt`

**Files:**
- Modify: `src/hooks/useCurrentUser.ts`
- Test: `src/hooks/useCurrentUser.test.ts`

- [ ] **Step 1: Add the failing hook tests**

In `src/hooks/useCurrentUser.test.ts`, add these tests inside the `describe('useCurrentUser', ...)` block (after the existing `does not fall back ... while initializing` test):

```typescript
  it('falls back to a manual account when the JWT session fails to initialize', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    mockJwtSigner.getPublicKey.mockRejectedValue(new Error('rpc failed'));
    setNostrProvider();

    mockLogins.push({
      id: 'extension:manualpub',
      type: 'extension',
      pubkey: 'manualpub',
      createdAt: '2026-03-10T00:00:00.000Z',
      data: null,
    });

    const { result } = renderHook(() => useCurrentUser());

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('manualpub');
    });
    expect(result.current.users).toHaveLength(1);
    expect(result.current.signer).toBeDefined();
  });

  it('reports isResolvingJwt while the session initializes, then clears it', async () => {
    mockGetValidToken.mockReturnValue('jwt-token');
    let resolvePubkey: (pubkey: string) => void = () => {};
    mockJwtSigner.getPublicKey.mockReturnValue(
      new Promise<string>((resolve) => { resolvePubkey = resolve; }),
    );

    const { result } = renderHook(() => useCurrentUser());

    // initializing
    expect(result.current.isResolvingJwt).toBe(true);
    expect(result.current.user).toBeUndefined();

    resolvePubkey('d'.repeat(64));

    await waitFor(() => {
      expect(result.current.user?.pubkey).toBe('d'.repeat(64));
    });
    expect(result.current.isResolvingJwt).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/useCurrentUser.test.ts -t "falls back to a manual account when the JWT session fails|isResolvingJwt"`
Expected: FAIL — the failed case currently yields `[]` (no fallback); `isResolvingJwt` is undefined on the result.

- [ ] **Step 3: Implement the hook changes**

In `src/hooks/useCurrentUser.ts`:

(a) Add the import near the other `@/lib` imports:

```typescript
import { selectCurrentUsers, isJwtResolving } from '@/lib/selectCurrentUsers';
```

(b) Add the `jwtError` state next to `jwtPubkey` (currently `const [jwtPubkey, setJwtPubkey] = useState<string>();`):

```typescript
  const [jwtPubkey, setJwtPubkey] = useState<string>();
  const [jwtError, setJwtError] = useState(false);
```

(c) In the JWT `useEffect`, reset `jwtError` on (re)start and set it in the catch instead of clearing `jwtPubkey`. Replace the existing effect body so it reads:

```typescript
  useEffect(() => {
    let isCancelled = false;

    if (!jwtSigner) {
      setJwtPubkey(undefined);
      setJwtError(false);
      return;
    }

    setJwtPubkey(undefined);
    setJwtError(false);

    jwtSigner.getPublicKey()
      .then((pubkey) => {
        if (!isCancelled) {
          setJwtPubkey(pubkey);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          console.warn('Skipped invalid JWT session', error);
          setJwtError(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [jwtSigner]);
```

(d) Replace the `users` derivation (currently `const users = useMemo(() => (token ? (jwtUser ? [jwtUser] : []) : manualUsers), [jwtUser, manualUsers, token]);`) with the helper, and compute `isResolvingJwt`:

```typescript
  const users = useMemo(
    () => selectCurrentUsers({ hasToken: !!token, jwtUser, jwtError, manualUsers }),
    [token, jwtUser, jwtError, manualUsers],
  );

  const isResolvingJwt = isJwtResolving({
    hasSigner: !!jwtSigner,
    jwtPubkey,
    jwtError,
  });
```

(e) Add `isResolvingJwt` to the returned object (currently `return { user, users, signer, ...author.data };`):

```typescript
  return { user, users, signer, isResolvingJwt, ...author.data };
```

- [ ] **Step 4: Run the hook tests to verify they pass**

Run: `npx vitest run src/hooks/useCurrentUser.test.ts`
Expected: PASS — all existing tests (incl. `does not fall back ... while initializing`, which still expects `[]` during resolve) plus the two new tests.

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCurrentUser.ts src/hooks/useCurrentUser.test.ts
git commit -m "fix(auth): fall back to manual login on JWT failure, expose isResolvingJwt"
```

---

### Task 3: Keep protected routes mounted during JWT resolve in `AppRouter`

**Files:**
- Modify: `src/AppRouter.tsx:66-69`

- [ ] **Step 1: Apply the change**

In `src/AppRouter.tsx`, update the hook destructure and `isLoggedIn` (currently lines 66-69):

```tsx
  const { user, isResolvingJwt } = useCurrentUser();

  // Treat an in-flight hosted-JWT session as "still determining auth", not
  // "logged out" — otherwise the protected routes below unmount during the
  // getPublicKey() round-trip and a reload bounces the user off the page.
  const isLoggedIn = Boolean(user) || isResolvingJwt;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors (`isResolvingJwt` is part of the `useCurrentUser` return as of Task 2).

- [ ] **Step 3: Commit**

```bash
git add src/AppRouter.tsx
git commit -m "fix(auth): keep protected routes mounted while hosted JWT session resolves"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 2: Lint touched files**

Run: `npx eslint src/lib/selectCurrentUsers.ts src/lib/selectCurrentUsers.test.ts src/hooks/useCurrentUser.ts src/hooks/useCurrentUser.test.ts src/AppRouter.tsx`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: PASS. No regressions vs. `main`.

- [ ] **Step 4: Confirm the branch diff is scoped**

Run: `git diff main --stat`
Expected: only `src/lib/selectCurrentUsers.ts`, `src/lib/selectCurrentUsers.test.ts`, `src/hooks/useCurrentUser.ts`, `src/hooks/useCurrentUser.test.ts`, `src/AppRouter.tsx`, plus this plan doc.

---

## Manual / staging validation (post-merge, document only)

Automated tests cover the precedence logic and the resolve/fail transitions.
After deploy, validate the route-mounting behavior: while signed in via the
hosted flow, hard-reload on a protected page (e.g. `/settings/moderation` or
`/messages`) and confirm the page is not bounced to a public route during the
brief JWT resolve window. Then simulate signer failure (offline the login RPC)
with a bunker login also present and confirm the bunker login still serves
instead of an apparent logout.

## Scope / out of scope

- B-a refresh-token wiring is PR 3 (separate), not here.
- Cosmetic nav flicker (login button vs. avatar) during the sub-second resolve
  window is not addressed; the structural route-mounting bounce is the real
  defect and is the focus of this PR.

## Self-Review

- **Spec coverage (B-b):** three explicit JWT states (Task 1 helper); failed →
  fall back to manual (Task 1/2); resolving → not logged out, no identity flash
  (helper returns `[]`, existing init test preserved); `isResolvingJwt` exposed
  and AppRouter no longer treats resolving as logged out (Task 2/3). Covered.
- **Placeholder scan:** none — all code shown.
- **Type consistency:** `selectCurrentUsers` / `isJwtResolving` signatures match
  their call sites in Task 2; `isResolvingJwt` returned by the hook is consumed
  in AppRouter (Task 3).
- **Back-compat:** the existing `does not fall back ... while initializing` test
  stays green because resolving still yields `[]`.

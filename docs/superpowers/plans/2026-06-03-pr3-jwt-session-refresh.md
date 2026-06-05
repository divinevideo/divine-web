# PR 3 — Hosted-JWT session refresh, Option A (Issue #391, B-a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop hosted Divine sessions from hard-expiring (≤24h) by proactively renewing the access token using the refresh token the `@divinevideo/login` SDK already stores on the login origin. Keeps any hosted session alive while in use, with zero new credential exposure (the refresh token never leaves the origin's SDK storage).

**Architecture:** `divineLogin.ts` already builds the SDK client with `storage: localStorage`, and `exchangeCode()` persists the session (incl. refresh token) on the origin where `/auth/callback` ran. We expose a thin `refreshDivineSession()` that calls the SDK's `getSessionWithRefresh()` (refreshes within 5 min of expiry, rotates + persists internally) and returns the fresh access token or `null`. `useDivineSession` gains a proactive refresh effect (fires ~1 min before expiry, or immediately if already within that window) that applies the renewed token via the existing `refreshSession()` (which also re-mirrors the cross-subdomain cookie). `getValidToken()` stops *destroying* the session on expiry, so a transient lapse can be renewed instead of forcing logout. On origins without a stored refresh token (e.g. subdomains), `getSessionWithRefresh()` returns `null` and the session is left as-is (today's behavior) — the accepted Option A gap that keycast #250 closes properly.

**Tech Stack:** TypeScript, React, Vitest, @testing-library/react, `@divinevideo/login`.

**Issue:** Relates to / closes #391 (B-a). Design: `docs/superpowers/specs/2026-06-03-bunker-team-intermittent-logout-design.md`. Secure cross-subdomain end-state tracked at keycast #250.

**Branch:** `fix/jwt-session-refresh` (already created off `main`).

---

## File Structure

- **Modify:** `src/lib/divineLogin.ts` — add exported `refreshDivineSession()`.
- **Create:** `src/lib/divineLogin.refresh.test.ts` — unit test for the wrapper (mocks `@divinevideo/login` in its own file so it doesn't disturb `divineLogin.test.ts`, which uses the real SDK).
- **Modify:** `src/hooks/useDivineSession.ts` — add the proactive refresh effect; make `getValidToken()` non-destructive on expiry.
- **Modify:** `src/hooks/useDivineSession.test.tsx` — mock `@/lib/divineLogin`; add refresh + non-destructive-expiry tests.

No cookie/storage schema changes, no `AuthCallbackPage` change.

---

### Task 1: `refreshDivineSession()` wrapper

**Files:**
- Modify: `src/lib/divineLogin.ts`
- Create: `src/lib/divineLogin.refresh.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/divineLogin.refresh.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionWithRefresh = vi.fn();

vi.mock('@divinevideo/login', () => ({
  createDivineClient: () => ({
    oauth: { getSessionWithRefresh },
    createRpc: () => null,
  }),
}));

import { refreshDivineSession } from './divineLogin';

describe('refreshDivineSession', () => {
  beforeEach(() => {
    getSessionWithRefresh.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the refreshed access token', async () => {
    getSessionWithRefresh.mockResolvedValue({ bunkerUrl: 'bunker://x', accessToken: 'fresh-token', expiresAt: 123 });
    await expect(refreshDivineSession()).resolves.toBe('fresh-token');
  });

  it('returns null when there is no session / refresh failed', async () => {
    getSessionWithRefresh.mockResolvedValue(null);
    await expect(refreshDivineSession()).resolves.toBeNull();
  });

  it('returns null when the refreshed credentials have no access token', async () => {
    getSessionWithRefresh.mockResolvedValue({ bunkerUrl: 'bunker://x' });
    await expect(refreshDivineSession()).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/divineLogin.refresh.test.ts`
Expected: FAIL — `refreshDivineSession` is not exported.

- [ ] **Step 3: Implement the wrapper**

In `src/lib/divineLogin.ts`, add after the `exchangeDivineLoginCallback` function (end of file):

```typescript
/**
 * Renew the hosted access token using the refresh token the SDK persisted on
 * this origin at login time. Delegates rotation + storage to the SDK
 * (`getSessionWithRefresh` refreshes within ~5 min of expiry). Returns the fresh
 * access token, or null when there is no stored session on this origin (e.g. a
 * subdomain) or the refresh failed.
 */
export async function refreshDivineSession(
  fetchImpl?: typeof fetch,
): Promise<string | null> {
  const client = createClient(fetchImpl);
  const credentials = await client.oauth.getSessionWithRefresh();
  return credentials?.accessToken ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/divineLogin.refresh.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Confirm the existing divineLogin suite is unaffected**

Run: `npx vitest run src/lib/divineLogin.test.ts`
Expected: PASS (its module-level mock is per-file, so the real SDK is still used there).

- [ ] **Step 6: Commit**

```bash
git add src/lib/divineLogin.ts src/lib/divineLogin.refresh.test.ts
git commit -m "feat(auth): add refreshDivineSession() wrapper over SDK getSessionWithRefresh"
```

---

### Task 2: Proactive refresh effect + non-destructive expiry in `useDivineSession`

**Files:**
- Modify: `src/hooks/useDivineSession.ts`
- Test: `src/hooks/useDivineSession.test.tsx`

- [ ] **Step 1: Add the failing tests**

In `src/hooks/useDivineSession.test.tsx`, add a hoisted mock for `@/lib/divineLogin` at the top (after the imports, before `describe`):

```typescript
const { mockRefreshDivineSession } = vi.hoisted(() => ({
  mockRefreshDivineSession: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('@/lib/divineLogin', () => ({
  refreshDivineSession: mockRefreshDivineSession,
}));
```

Reset it in `beforeEach` (inside the existing `beforeEach`, after the `vi.stubGlobal` lines):

```typescript
    mockRefreshDivineSession.mockReset();
    mockRefreshDivineSession.mockResolvedValue(null);
```

Add these tests inside the `describe('useDivineSession', ...)` block:

```typescript
  it('proactively renews the access token before it expires', async () => {
    // expires in 30s — inside the 60s refresh lead, so refresh is attempted on mount
    const token = createToken(Math.floor(Date.now() / 1000) + 30);
    const renewed = createToken(Math.floor(Date.now() / 1000) + 3600);
    mockRefreshDivineSession.mockResolvedValue(renewed);

    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(renewed);
    });
    expect(mockRefreshDivineSession).toHaveBeenCalled();
  });

  it('leaves the session unchanged when refresh is unavailable', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) + 30);
    mockRefreshDivineSession.mockResolvedValue(null);

    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(token);
    });
    // give the refresh microtask a chance to run, then confirm no change
    await act(async () => { await Promise.resolve(); });
    expect(result.current.session?.token).toBe(token);
  });

  it('getValidToken returns null on expiry without destroying the stored session', async () => {
    const token = createToken(Math.floor(Date.now() / 1000) - 10); // already expired
    const { result } = renderHook(() => useDivineSession());

    act(() => {
      result.current.saveSession(token, null, false);
    });

    await waitFor(() => {
      expect(result.current.session?.token).toBe(token);
    });

    expect(result.current.getValidToken()).toBeNull();
    // session is NOT cleared — a later refresh can still renew it
    expect(result.current.session?.token).toBe(token);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/hooks/useDivineSession.test.tsx -t "proactively renews|leaves the session unchanged|without destroying"`
Expected: FAIL — no refresh effect yet; `getValidToken` still calls `clearSession()` on expiry (so the third test's session would be cleared).

- [ ] **Step 3: Implement the changes in `src/hooks/useDivineSession.ts`**

(a) Add the import (next to the other `@/...` imports near the top):

```typescript
import { refreshDivineSession } from '@/lib/divineLogin';
```

(b) Make `getValidToken` non-destructive on expiry. Replace the existing body (currently calls `clearSession()` when `!rememberMe`):

```typescript
  const getValidToken = useCallback((): string | null => {
    if (!token || !expiration) return null;

    const now = Date.now();
    if (now > expiration) {
      // Access token expired. Do NOT destroy the session here — the refresh
      // effect renews it from the login server's refresh token. Return null so
      // callers don't use a stale token until the renewed one lands. (With
      // rememberMe we still hand back the token so the existing UI can prompt.)
      if (!rememberMe) {
        return null;
      }
      return token;
    }

    return token;
  }, [token, expiration, rememberMe]);
```

(c) Add the proactive refresh effect. Place it after the `saveBunkerUrl`/`getSavedBunkerUrl` callbacks and before `clearSession` (anywhere among the hook body effects is fine; put it right after the state-sync `useEffect` that ends near line 98):

```typescript
  // Proactively renew the hosted access token before it expires, using the
  // refresh token the @divinevideo/login SDK stored on the origin where the
  // user logged in. Keeps the session alive instead of hard-expiring. On
  // origins without a stored refresh token (e.g. subdomains) the SDK returns
  // null and we leave the session untouched (today's behavior).
  useEffect(() => {
    if (!token || !expiration) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attemptRefresh = async () => {
      try {
        const newToken = await refreshDivineSession();
        if (!cancelled && newToken && newToken !== token) {
          refreshSession(newToken);
        }
      } catch {
        // Refresh unavailable or failed — leave the existing session untouched.
      }
    };

    const REFRESH_LEAD_MS = 60 * 1000;
    const msUntilRefresh = expiration - Date.now() - REFRESH_LEAD_MS;
    if (msUntilRefresh <= 0) {
      void attemptRefresh();
    } else {
      timer = setTimeout(() => { void attemptRefresh(); }, msUntilRefresh);
    }

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [token, expiration, refreshSession]);
```

Note: `refreshSession` is already declared above this point as a `useCallback`. `useEffect` is already imported.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/hooks/useDivineSession.test.tsx`
Expected: PASS — the 3 new tests plus the 2 existing ones (existing tests use 1h tokens; the refresh timer is scheduled ~59 min out and never fires during the test, and `refreshDivineSession` is mocked to a no-op `null`).

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDivineSession.ts src/hooks/useDivineSession.test.tsx
git commit -m "fix(auth): proactively refresh hosted session, stop destroying it on expiry"
```

---

### Task 3: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 2: Lint touched files**

Run: `npx eslint src/lib/divineLogin.ts src/lib/divineLogin.refresh.test.ts src/hooks/useDivineSession.ts src/hooks/useDivineSession.test.tsx`
Expected: no errors.

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: PASS. No regressions vs. `main`.

- [ ] **Step 4: Confirm the branch diff is scoped**

Run: `git diff main --stat`
Expected: only `src/lib/divineLogin.ts`, `src/lib/divineLogin.refresh.test.ts`, `src/hooks/useDivineSession.ts`, `src/hooks/useDivineSession.test.tsx`, plus this plan doc.

---

## Manual / staging validation (post-merge, document only)

Automated tests cover the wrapper, proactive renewal, the no-op-on-unavailable path, and non-destructive expiry. After deploy, validate on the login origin: sign in via the hosted flow, leave the tab open across the access token's expiry, and confirm the session renews (no logout) — check that the network shows a `grant_type=refresh_token` call near expiry and the user stays logged in. Then confirm a subdomain still works until the mirrored access token expires (the accepted Option A gap; keycast #250 is the secure cross-subdomain follow-up).

## Scope / out of scope

- Cross-subdomain *independent* refresh is **not** in this PR (keycast #250 / Option C).
- No `rememberMe` semantics change; no new storage keys; the refresh token is never written to a cookie.
- A focus/visibilitychange refresh trigger (belt-and-suspenders for heavily-throttled background tabs) is intentionally omitted; the pre-expiry timer + on-mount attempt cover the active-session case. Can be added later if needed.

## Self-Review

- **Spec coverage (B-a):** capture/use refresh token (via SDK's existing storage — Task 1); refresh on/near expiry instead of clearing (Task 2b/2c); hard logout only when refresh genuinely unavailable and token expired (left to natural re-auth, not an aggressive clear). Covered.
- **Placeholder scan:** none — all code shown.
- **Type consistency:** `refreshDivineSession` returns `Promise<string | null>`, consumed in the effect; `refreshSession(newToken: string)` matches.
- **Loop safety:** effect only applies a token when `newToken !== token`; a successful refresh moves `expiration` far out, so the next timer is scheduled near the new expiry (no tight loop).
- **Back-compat:** existing `useDivineSession` tests (1h tokens) unaffected; `divineLogin.test.ts` untouched (per-file mock isolation).

# PR 1 — Bunker cookie data-shape fix (Issue #390) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop moderators/team bunker logins from being silently dropped on cross-subdomain hydration by storing the bunker login `data` object (not the raw `bunker://` URI string) in the cross-subdomain cookie, validating it on rehydration, and self-healing poisoned entries.

**Architecture:** The cross-subdomain cookie (`nostr_login`) currently stores the bunker payload under a single `bunkerUri` field written in two incompatible shapes (a `bunker://` string from fresh login, an object from the localStorage-sync path). Rehydration assigns that field straight into `login.data`, which `NUser.fromBunkerLogin` requires to be `{ bunkerPubkey, clientNsec, relays }` — a string makes it throw and the login is filtered out (apparent logout). The fix makes the cookie carry the structured object consistently, adds an `isValidBunkerData` guard so invalid/legacy payloads are ignored rather than persisted, and drops already-poisoned localStorage entries so the re-poison loop stops.

**Tech Stack:** TypeScript, React, `@nostrify/react/login`, Vitest (jsdom-style mocks already present in the test file).

**Issue:** Closes #390. Design: `docs/superpowers/specs/2026-06-03-bunker-team-intermittent-logout-design.md`.

**Branch:** `fix/bunker-cookie-data-shape` (already created; spec already committed here).

---

## File Structure

- **Modify:** `src/lib/crossSubdomainAuth.ts` — change `LoginCookieData.bunkerUri: string` → `bunkerData?: BunkerLoginData`; add exported type `BunkerLoginData` and guard `isValidBunkerData`; update the localStorage-sync writer and the rehydration reader; self-heal poisoned localStorage entries.
- **Modify:** `src/hooks/useLoginActions.ts:26` — write `bunkerData: login.data` instead of `bunkerUri: uri` (TypeScript forces this once the type changes).
- **Modify/Test:** `src/lib/crossSubdomainAuth.test.ts` — rewrite the existing buggy `bunkerUri` test (lines 182-195) and add round-trip / rejection / self-heal tests.

No other files read `LoginCookieData.bunkerUri` (verified in Task 1, Step 1). The JWT cookie's separate `bunkerUrl` field is untouched.

---

### Task 1: Confirm no other consumers of `bunkerUri`

**Files:** none (read-only verification)

- [ ] **Step 1: Grep for any other reader/writer of the cookie field**

Run:
```bash
cd /Users/mjb/code/divine-web
grep -rn "bunkerUri" src --include="*.ts" --include="*.tsx"
```
Expected: matches ONLY in `src/lib/crossSubdomainAuth.ts` (interface field + read in `hydrateLoginFromCookie`) and `src/hooks/useLoginActions.ts:26`, plus `src/lib/crossSubdomainAuth.test.ts`. If `bunkerUri` appears anywhere else, stop and reconcile before continuing — the plan assumes only these consumers.

Note: `bunkerUrl` (JWT cookie / `useDivineSession`) is a DIFFERENT field — ignore those matches.

---

### Task 2: Add `BunkerLoginData` type and `isValidBunkerData` guard

**Files:**
- Modify: `src/lib/crossSubdomainAuth.ts:13-17` (interface) and add a guard function
- Test: `src/lib/crossSubdomainAuth.test.ts`

- [ ] **Step 1: Write the failing test for the guard**

Add to `src/lib/crossSubdomainAuth.test.ts` (import `isValidBunkerData` in the top import from `./crossSubdomainAuth`):

```typescript
describe('isValidBunkerData', () => {
  it('accepts a well-formed bunker data object', () => {
    expect(isValidBunkerData({
      bunkerPubkey: 'abc',
      clientNsec: 'nsec1examplekey',
      relays: ['wss://relay.example'],
    })).toBe(true);
  });

  it('rejects a raw bunker:// URI string', () => {
    expect(isValidBunkerData('bunker://pub?relay=wss://r&secret=s')).toBe(false);
  });

  it('rejects an object missing clientNsec', () => {
    expect(isValidBunkerData({ bunkerPubkey: 'abc', relays: ['wss://r'] })).toBe(false);
  });

  it('rejects an object with empty relays', () => {
    expect(isValidBunkerData({ bunkerPubkey: 'abc', clientNsec: 'nsec1x', relays: [] })).toBe(false);
  });

  it('rejects null/undefined', () => {
    expect(isValidBunkerData(null)).toBe(false);
    expect(isValidBunkerData(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts -t isValidBunkerData`
Expected: FAIL — `isValidBunkerData` is not exported / not defined.

- [ ] **Step 3: Implement the type and guard**

In `src/lib/crossSubdomainAuth.ts`, replace the `LoginCookieData` interface (lines 13-17):

```typescript
export interface BunkerLoginData {
  bunkerPubkey: string;
  clientNsec: string;
  relays: string[];
}

interface LoginCookieData {
  type: 'extension' | 'bunker' | 'nsec';
  pubkey: string;
  bunkerData?: BunkerLoginData; // only for bunker logins; the exact shape NUser.fromBunkerLogin consumes
}

/**
 * Structural guard for a bunker login `data` payload. A raw `bunker://` URI
 * string (the legacy/poisoned shape) and any partial object fail this, so they
 * are never persisted into localStorage where NUser.fromBunkerLogin would throw.
 */
export function isValidBunkerData(data: unknown): data is BunkerLoginData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.bunkerPubkey === 'string' &&
    typeof d.clientNsec === 'string' &&
    d.clientNsec.startsWith('nsec1') &&
    Array.isArray(d.relays) &&
    d.relays.length > 0
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts -t isValidBunkerData`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crossSubdomainAuth.ts src/lib/crossSubdomainAuth.test.ts
git commit -m "fix(auth): add BunkerLoginData type and isValidBunkerData guard"
```

---

### Task 3: Rehydrate bunker logins from structured `bunkerData` (reject legacy strings)

**Files:**
- Modify: `src/lib/crossSubdomainAuth.ts:204-214` (the bunker rehydration branch)
- Test: `src/lib/crossSubdomainAuth.test.ts:182-195` (rewrite) + new tests

- [ ] **Step 1: Rewrite the existing buggy test and add rejection test**

In `src/lib/crossSubdomainAuth.test.ts`, REPLACE the existing test at lines 182-195 (`when localStorage is empty and cookie has bunker login with URI, hydrates localStorage`) with:

```typescript
  it('when localStorage is empty and cookie has valid bunkerData, hydrates localStorage with the object', () => {
    const bunkerData = {
      bunkerPubkey: 'bunkerpub',
      clientNsec: 'nsec1clientkey',
      relays: ['wss://relay.example'],
    };
    const data = { type: 'bunker' as const, pubkey: 'pub789', bunkerData };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{
      id: mockUUID,
      type: 'bunker',
      pubkey: 'pub789',
      data: bunkerData,
    }]);
  });

  it('when cookie has a legacy bunkerUri string (no bunkerData), does NOT hydrate', () => {
    const data = { type: 'bunker' as const, pubkey: 'pub789', bunkerUri: 'bunker://xyz' };
    cookieJar = `nostr_login=${btoa(JSON.stringify(data))}`;

    hydrateLoginFromCookie();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts -t "bunkerData"`
Expected: the first new test FAILS (current code reads `cookie.bunkerUri`, writes `data: undefined`); the legacy-string test may pass incidentally but will be locked in by the implementation.

- [ ] **Step 3: Implement the rehydration branch**

In `src/lib/crossSubdomainAuth.ts`, REPLACE the bunker rehydration block (currently lines 204-214):

```typescript
  // For bunker logins, restore from the structured data object so the signer
  // can be rebuilt. A legacy/poisoned cookie (raw bunker:// string under the old
  // `bunkerUri` field, or any malformed payload) fails the guard and is ignored
  // rather than persisted — NUser.fromBunkerLogin would throw on a bad shape and
  // the user would appear logged out. They re-login instead.
  if (cookie.type === 'bunker') {
    if (isValidBunkerData(cookie.bunkerData)) {
      const loginState = [{
        id: crypto.randomUUID(),
        type: 'bunker' as const,
        pubkey: cookie.pubkey,
        data: cookie.bunkerData,
      }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));
    }
    return;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts -t "bunkerData"`
Expected: PASS. Also run the existing nsec/extension/empty hydration tests:
Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts -t hydrateLoginFromCookie`
Expected: PASS (extension hydrate, nsec no-hydrate, empty, both new bunker tests, JWT tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crossSubdomainAuth.ts src/lib/crossSubdomainAuth.test.ts
git commit -m "fix(auth): rehydrate bunker login from structured bunkerData, reject legacy string"
```

---

### Task 4: Sync `bunkerData` to the cookie and self-heal poisoned localStorage

**Files:**
- Modify: `src/lib/crossSubdomainAuth.ts:170-187` (the localStorage-sync branch)
- Test: `src/lib/crossSubdomainAuth.test.ts`

- [ ] **Step 1: Write the failing tests**

Add inside the `describe('hydrateLoginFromCookie', ...)` block in `src/lib/crossSubdomainAuth.test.ts`:

```typescript
  it('when localStorage has a valid bunker login, syncs bunkerData object TO cookie', () => {
    const bunkerData = {
      bunkerPubkey: 'bunkerpub',
      clientNsec: 'nsec1clientkey',
      relays: ['wss://relay.example'],
    };
    const loginState = [{ id: '1', type: 'bunker', pubkey: 'pubB', data: bunkerData }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));

    hydrateLoginFromCookie();

    expect(getLoginCookie()).toEqual({ type: 'bunker', pubkey: 'pubB', bunkerData });
    // localStorage unchanged
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(loginState);
  });

  it('self-heals: drops a poisoned bunker login (string data) and does not poison the cookie', () => {
    const loginState = [{ id: '1', type: 'bunker', pubkey: 'pubB', data: 'bunker://poisoned' }];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loginState));

    hydrateLoginFromCookie();

    // poisoned entry removed; cookie not written with a string payload
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getLoginCookie()).toBeNull();
  });

  it('self-recovers: poisoned local entry dropped, healthy cookie re-hydrates the session', () => {
    const bunkerData = {
      bunkerPubkey: 'bp',
      clientNsec: 'nsec1goodkey',
      relays: ['wss://relay.example'],
    };
    // poisoned localStorage on this origin
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: '1', type: 'bunker', pubkey: 'pubB', data: 'bunker://poisoned' },
    ]));
    // but a healthy shared cookie exists (written by another origin)
    cookieJar = `nostr_login=${btoa(JSON.stringify({ type: 'bunker', pubkey: 'pubB', bunkerData }))}`;

    hydrateLoginFromCookie();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored).toEqual([{
      id: mockUUID,
      type: 'bunker',
      pubkey: 'pubB',
      data: bunkerData,
    }]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts -t "syncs bunkerData|self-heals|self-recovers"`
Expected: FAIL — current sync writes `bunkerUri: first.data`, there is no self-heal of poisoned entries, and no fall-through recovery from a healthy cookie.

- [ ] **Step 3: Implement the localStorage-sync branch**

In `src/lib/crossSubdomainAuth.ts`, REPLACE the localStorage-sync block (currently lines 169-187, starting at the `// Already logged in on this origin` comment) with:

```typescript
  // Already logged in on this origin - sync cookie FROM localStorage instead
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const logins = JSON.parse(stored);
      if (Array.isArray(logins) && logins.length > 0) {
        // Self-heal: a bunker login whose `data` is not a valid object is the
        // legacy/poisoned shape. Persisting it would make NUser.fromBunkerLogin
        // throw (apparent logout) and re-syncing it would re-poison the shared
        // cookie. Drop those entries.
        const cleaned = logins.filter(
          (l: { type?: string; data?: unknown }) =>
            l.type !== 'bunker' || isValidBunkerData(l.data),
        );
        if (cleaned.length !== logins.length) {
          if (cleaned.length === 0) {
            // Everything was poisoned. Remove the bad local state but DON'T clear
            // the shared cookie or return — fall through to cookie hydration so a
            // healthy cookie (written by another origin) can recover the session.
            localStorage.removeItem(STORAGE_KEY);
          } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
          }
        }

        if (cleaned.length > 0) {
          const first = cleaned[0];
          // Keep cookie in sync with current login
          setLoginCookie({
            type: first.type,
            pubkey: first.pubkey,
            ...(first.type === 'bunker' && isValidBunkerData(first.data)
              ? { bunkerData: first.data }
              : {}),
          });
          return;
        }
        // cleaned.length === 0: fall through to cookie-based recovery below.
      }
    } catch {
      // corrupted localStorage, continue to cookie check
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/crossSubdomainAuth.test.ts`
Expected: PASS (entire file, including the pre-existing extension-sync test and JWT tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/crossSubdomainAuth.ts src/lib/crossSubdomainAuth.test.ts
git commit -m "fix(auth): sync bunkerData object to cookie and self-heal poisoned logins"
```

---

### Task 5: Make fresh bunker login write `bunkerData` (type-forced)

**Files:**
- Modify: `src/hooks/useLoginActions.ts:26`

- [ ] **Step 1: Verify the type error exists**

Run: `npx tsc --noEmit`
Expected: an error at `src/hooks/useLoginActions.ts:26` — object literal may only specify known properties, `bunkerUri` does not exist in type `LoginCookieData`. (This is the type system forcing the consistency fix.)

- [ ] **Step 2: Update the cookie write**

In `src/hooks/useLoginActions.ts`, change the bunker login (line 24-26) so the cookie carries the structured data object:

```typescript
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
      setLoginCookie({ type: 'bunker', pubkey: login.pubkey, bunkerData: login.data });
    },
```

(`login.data` from `NLogin.fromBunker` is exactly `{ bunkerPubkey, clientNsec, relays }`. The `uri` param is still used by `NLogin.fromBunker`, so no unused variable.)

- [ ] **Step 3: Verify the type error is gone**

Run: `npx tsc --noEmit`
Expected: no errors (clean).

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLoginActions.ts
git commit -m "fix(auth): persist structured bunkerData on fresh bunker login"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: PASS. If any unrelated pre-existing failures appear, confirm they exist on `main` before this branch (run `git stash` is not needed — just compare); do not fix unrelated failures in this PR.

- [ ] **Step 3: Lint (if configured)**

Run: `npm run lint`
Expected: no new lint errors in the touched files. (If `lint` script is absent, skip.)

- [ ] **Step 4: Confirm the branch diff is scoped**

Run: `git diff main --stat`
Expected: only `src/lib/crossSubdomainAuth.ts`, `src/lib/crossSubdomainAuth.test.ts`, `src/hooks/useLoginActions.ts`, and the spec/plan docs.

---

## Manual / staging validation (post-merge, document only)

Automated tests cover the cookie round-trip. The cross-origin behavior is hard to
reproduce in unit tests (per-origin localStorage). After deploy, validate per the
spec's reproduction steps: log in on `divine.video` with a team bunker URL, open a
sibling origin (e.g. a `*.divine.video` subdomain) with no localStorage, and confirm
the session hydrates instead of showing logged-out. Legacy-poisoned users will need
to re-login once (note in the issue).

---

## Self-Review

- **Spec coverage:** Structured `bunkerData` field (Task 2); `useLoginActions` writes the object (Task 5); sync path writes the object (Task 4); rehydration validates and assigns the object (Task 3); `isValidBunkerData` guard (Task 2); self-heal of poisoned localStorage (Task 4); back-compat drop of legacy `bunkerUri` string (Task 3). All spec items for PR 1 mapped.
- **Placeholder scan:** none — every code step shows complete code.
- **Type consistency:** `BunkerLoginData` / `isValidBunkerData` / `bunkerData` used consistently across Tasks 2-5; `login.data` shape matches `BunkerLoginData`.
- **Not in scope (correctly):** `useCurrentUser` precedence (PR 2 / #391), refresh-token wiring (PR 3 / #391), the unused `bunkerToWindowNostr.ts`.

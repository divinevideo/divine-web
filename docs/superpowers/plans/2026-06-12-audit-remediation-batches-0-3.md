# Audit Remediation (Batches 0–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the critical/high findings from AUDIT.md — edge-worker XSS, dependency vulns, missing circuit-breaker tests, hygiene debt, and four correctness bugs — as four independently shippable PRs.

**Architecture:** No structural refactoring in this plan. Each batch is one branch/PR that leaves `npm test` (tsc + eslint + vitest + build) green. Batch 0 ships security patches, Batch 1 builds the test safety net that de-risks everything later, Batch 2 is mechanical hygiene, Batch 3 is small targeted correctness fixes. AUDIT.md Batches 4–7 (perf, layering, god-file splits, major upgrades) get their own plans after this lands and the deferred decisions below are resolved.

**Tech Stack:** React 18 + Vite 6 + TypeScript + Vitest + React Testing Library; Fastly Compute edge worker in `compute-js/` (plain JS, tested by the root vitest run); GitHub Actions CI.

**Workflow rules (from project memory — STRICT):**
- Never push to main. One branch per batch, PR, CI green, then merge. Use a git worktree for isolation (superpowers:using-git-worktrees).
- Branch names: `fix/audit-batch0-security`, `test/audit-batch1-safety-net`, `chore/audit-batch2-hygiene`, `fix/audit-batch3-correctness`.
- Commit format `type: description`, trailer `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` (per project CLAUDE.md).
- Merging to main triggers `deploy.yml` (Fastly deploy + publish) automatically — Batch 0's edge-worker fix needs no manual deploy, but verify post-merge (step in Task 2).

**Deferred — do NOT do in this plan (needs human decisions, see AUDIT.md "Explicitly unsure"):**
- Deleting `UploadPage.tsx`/`CameraRecorder.tsx`, `OriginalContentBadge`, `VideoListBadges`, `PopularHashtagsCard`, `useAnonymousReport` (may be staged features).
- Changing the `@jsr/nostrify__nostrify` override pin (intent unknown).
- `NostrProvider` integration tests (needs design discussion on NPool test harness).
- Feature-flag scaffolding in `src/config/api.ts`.

---

## Batch 0 — Security patches (branch `fix/audit-batch0-security`)

### Task 1: `escapeJsonForScript` helper in the edge worker

The edge worker injects `JSON.stringify(...)` of Nostr-sourced data into `<script>` tags. `JSON.stringify` does not escape `<`, so a video title containing `</script>` breaks out of the script element (stored XSS, AUDIT SEC-1). Build the escaping helper TDD-first. The compute-js tests run under the root vitest (they are not in the vitest `exclude` list).

**Files:**
- Modify: `compute-js/src/ogTags.js` (add export after `escapeHtml`, which ends at line 12)
- Test: `compute-js/src/ogTags.test.ts` (append a new describe block)

- [ ] **Step 1: Write the failing tests**

Open `compute-js/src/ogTags.test.ts`. Add `escapeJsonForScript` to the existing import from `'./ogTags.js'` (or add a new import line if imports are split), then append at the end of the file:

```ts
describe('escapeJsonForScript', () => {
  it('escapes </script> breakout sequences', () => {
    const out = escapeJsonForScript({ title: '</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('escapes ampersands', () => {
    expect(escapeJsonForScript('a&b')).not.toContain('&');
  });

  it('round-trips back to the original value through JSON.parse', () => {
    const value = { title: '</script>', n: 5, nested: { a: '&<>' }, list: ['<', '>'] };
    expect(JSON.parse(escapeJsonForScript(value))).toEqual(value);
  });

  it('handles plain strings (used for feedType)', () => {
    expect(JSON.parse(escapeJsonForScript('trending'))).toBe('trending');
  });

  it('escapes U+2028/U+2029 line separators', () => {
    const out = escapeJsonForScript('a b c');
    expect(out).not.toMatch(/[  ]/);
    expect(JSON.parse(out)).toBe('a b c');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run compute-js/src/ogTags.test.ts`
Expected: FAIL — `escapeJsonForScript is not a function` (or import error).

- [ ] **Step 3: Implement the helper**

In `compute-js/src/ogTags.js`, directly after the `escapeHtml` function (line 12), add:

```js
/**
 * Serialize a value as JSON that is safe to embed inside a <script> element.
 * JSON.stringify alone does not escape < > & — a string containing
 * "</script>" would terminate the script element (XSS). Unicode-escaping
 * keeps the output valid JSON/JS, so JSON.parse round-trips exactly.
 */
export function escapeJsonForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/ /g, '\\u2028')
    .replace(/ /g, '\\u2029');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run compute-js/src/ogTags.test.ts`
Expected: PASS (all existing + 5 new tests).

- [ ] **Step 5: Commit**

```bash
git add compute-js/src/ogTags.js compute-js/src/ogTags.test.ts
git commit -m "feat: add escapeJsonForScript helper for safe script-tag JSON embedding

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 2: Use the helper at both injection sites in `index.js`

**Files:**
- Modify: `compute-js/src/index.js:325` (feed injection), `compute-js/src/index.js:905` (subdomain profile injection), plus the import near the top of the file

- [ ] **Step 1: Extend the import**

Near the top of `compute-js/src/index.js`, find the existing import of `escapeHtml` from `'./ogTags.js'` and add `escapeJsonForScript` to it. Example (adjust to the actual import list — do not drop other named imports):

```js
import { escapeHtml, escapeJsonForScript } from './ogTags.js';
```

- [ ] **Step 2: Fix the feed injection (line 325)**

Replace:

```js
          let injection = `<script>window.__DIVINE_FEED__=${JSON.stringify(feedData)};window.__DIVINE_FEED_TYPE__="${feedType}";</script>`;
```

with:

```js
          let injection = `<script>window.__DIVINE_FEED__=${escapeJsonForScript(feedData)};window.__DIVINE_FEED_TYPE__=${escapeJsonForScript(feedType)};</script>`;
```

Note `feedType` switches from a raw `"${...}"` interpolation to escaped JSON — the SPA reads `window.__DIVINE_FEED_TYPE__` as a string either way.

- [ ] **Step 3: Fix the profile injection (line 905)**

Replace:

```js
  const userScript = `<script>window.__DIVINE_USER__ = ${JSON.stringify(divineUser)};</script>`;
```

with:

```js
  const userScript = `<script>window.__DIVINE_USER__ = ${escapeJsonForScript(divineUser)};</script>`;
```

- [ ] **Step 4: Verify nothing else interpolates unescaped JSON**

Run: `grep -n 'JSON.stringify' compute-js/src/index.js`
Expected: no remaining hit that is interpolated into an HTML template literal (hits used for request bodies/logging are fine). If you find another HTML-bound one, apply the same helper and note it in the commit.

- [ ] **Step 5: Run the full edge-worker test files + build**

Run: `npx vitest run compute-js/src && npm run build`
Expected: all compute-js tests PASS; vite build succeeds (build is unaffected but proves the repo is green).

- [ ] **Step 6: Commit**

```bash
git add compute-js/src/index.js
git commit -m "fix: escape Nostr-sourced JSON injected into script tags (XSS)

Video titles/descriptions and profile fields are publishable by anyone on
Nostr; JSON.stringify does not escape </script>, so a crafted title could
execute script on apex/discovery/profile pages for every visitor.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 3: Security dependency bumps (all semver-compatible)

Clears AUDIT SEC-2/SEC-3: react-router XSS, unhead XSS bypass, vitest critical, vite dev-server, workbox/wrangler/firebase chains. No major versions.

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)

- [ ] **Step 1: Apply targeted bumps**

```bash
npm install react-router-dom@^6.30.4
npm update @unhead/react @unhead/addons firebase
npm install -D vitest@^3.2.6 vite@^6.4.3 workbox-build@^7.4.1 wrangler@^4.100.0
```

- [ ] **Step 2: Sweep the remainder**

```bash
npm audit fix
npm audit --omit=dev
```

Expected: production-tree audit reports 0 vulnerabilities, or only items whose fix would require a major bump (record any leftovers in the PR description; do NOT use `npm audit fix --force`).

- [ ] **Step 3: Verify the lockfile only, then run the full gate**

```bash
git status --short   # expect only package.json + package-lock.json changed
npm test
```

Expected: tsc, eslint, vitest, and vite build all PASS. If react-router 6.30.4 surfaces deprecation warnings, that's fine; failures are not — stop and investigate before committing.

- [ ] **Step 4: Commit and open the PR**

```bash
git add package.json package-lock.json
git commit -m "fix: bump deps to clear npm audit vulns (react-router XSS, unhead, vitest)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push -u origin fix/audit-batch0-security
gh pr create --title "fix: audit batch 0 — edge-worker XSS + dependency vulns" --body "Implements AUDIT.md Batch 0 (SEC-1, SEC-2, SEC-3). See AUDIT.md for failure modes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 5: Post-merge verification (after PR merges)**

`deploy.yml` deploys the edge worker on merge to main. Verify the fix is live:

```bash
curl -s https://divine.video/ | grep -o '__DIVINE_FEED__=.\{0,40\}'
```

Expected: the JSON blob contains `<` escapes wherever titles contain `<` (and never a literal `</script>` inside the blob).

---

## Batch 1 — Test safety net (branch `test/audit-batch1-safety-net`)

### Task 4: Circuit-breaker state-machine tests

`src/lib/funnelcakeHealth.ts` gates every REST call and has zero tests (AUDIT TEST-1). It uses `Date.now()` for the 30s reset window — use vitest fake timers. It imports `./sentry` and `./debug` — mock both so tests don't touch Sentry.

**Files:**
- Create: `src/lib/funnelcakeHealth.test.ts`

- [ ] **Step 1: Write the tests**

Create `src/lib/funnelcakeHealth.test.ts`:

```ts
// ABOUTME: Tests for the Funnelcake circuit breaker state machine
// ABOUTME: Covers closed -> open -> half-open -> closed/reopen transitions

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./sentry', () => ({
  addBreadcrumb: vi.fn(),
  Sentry: { captureMessage: vi.fn() },
}));
vi.mock('./debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

import {
  isFunnelcakeAvailable,
  recordFunnelcakeFailure,
  recordFunnelcakeSuccess,
  getFunnelcakeStatus,
  resetAllFunnelcakeCircuits,
  checkFunnelcakeHealth,
  shouldFallbackToWebSocket,
} from './funnelcakeHealth';

const API = 'https://api.example.test';
const OTHER_API = 'https://other.example.test';

beforeEach(() => {
  resetAllFunnelcakeCircuits();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function failNTimes(n: number, apiUrl = API) {
  for (let i = 0; i < n; i++) recordFunnelcakeFailure(apiUrl, `error ${i + 1}`);
}

describe('circuit state machine', () => {
  it('starts closed (available) with zero errors', () => {
    expect(isFunnelcakeAvailable(API)).toBe(true);
    expect(getFunnelcakeStatus(API).errorCount).toBe(0);
  });

  it('stays closed after 2 failures', () => {
    failNTimes(2);
    expect(isFunnelcakeAvailable(API)).toBe(true);
    expect(getFunnelcakeStatus(API).errorCount).toBe(2);
  });

  it('opens after 3 consecutive failures', () => {
    failNTimes(3);
    expect(isFunnelcakeAvailable(API)).toBe(false);
    expect(getFunnelcakeStatus(API).available).toBe(false);
  });

  it('after the 30s reset window the circuit stays open (KNOWN BUG, fixed in Batch 3 Task 17)', () => {
    failNTimes(3);
    expect(isFunnelcakeAvailable(API)).toBe(false);
    vi.advanceTimersByTime(30_001);
    // BUG (AUDIT COR-5): the half-open branch logs "allowing retry" but then
    // returns status.available, which is still false — and since every REST call
    // is gated on isFunnelcakeAvailable, no request ever runs to record a success.
    // The circuit therefore never recovers within a session. This test documents
    // the current behavior; Batch 3 Task 17 flips this assertion to toBe(true)
    // and fixes the module.
    expect(isFunnelcakeAvailable(API)).toBe(false);
  });

  it('a success fully resets the circuit', () => {
    failNTimes(3);
    recordFunnelcakeSuccess(API);
    expect(isFunnelcakeAvailable(API)).toBe(true);
    expect(getFunnelcakeStatus(API).errorCount).toBe(0);
    expect(getFunnelcakeStatus(API).lastError).toBeUndefined();
  });

  it('a failure during half-open restarts the 30s window', () => {
    failNTimes(3);
    vi.advanceTimersByTime(30_001);
    recordFunnelcakeFailure(API, 'retry failed');
    expect(isFunnelcakeAvailable(API)).toBe(false);
    expect(getFunnelcakeStatus(API).errorCount).toBe(4);
  });

  it('tracks each apiUrl independently', () => {
    failNTimes(3, API);
    expect(isFunnelcakeAvailable(API)).toBe(false);
    expect(isFunnelcakeAvailable(OTHER_API)).toBe(true);
  });
});

describe('shouldFallbackToWebSocket', () => {
  it.each([
    ['timeout message', null, new Error('Request timeout'), true],
    ['network message', null, new Error('network down'), true],
    ['fetch message', null, new TypeError('fetch failed'), true],
    ['abort message', null, new Error('The operation was aborted'), true],
    ['500', 500, null, true],
    ['503', 503, null, true],
    ['404', 404, null, false],
    ['400', 400, null, false],
    ['unknown (no status, no error)', null, null, false],
  ])('%s -> %s', (_label, status, error, expected) => {
    expect(shouldFallbackToWebSocket(status as number | null, error as Error | null)).toBe(expected);
  });
});

describe('checkFunnelcakeHealth', () => {
  it('records success when /api/health returns ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await expect(checkFunnelcakeHealth(API)).resolves.toBe(true);
    expect(getFunnelcakeStatus(API).errorCount).toBe(0);
  });

  it('records failure on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(checkFunnelcakeHealth(API)).resolves.toBe(false);
    expect(getFunnelcakeStatus(API).errorCount).toBe(1);
  });

  it('records failure when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(checkFunnelcakeHealth(API)).resolves.toBe(false);
    expect(getFunnelcakeStatus(API).errorCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run them**

Run: `npx vitest run src/lib/funnelcakeHealth.test.ts`
Expected: PASS. These tests document current behavior — if any assertion fails, **do not change the production module to make it pass**; the implementation is the spec here. Adjust the test to match observed behavior and leave a comment, then flag the discrepancy in the PR description. (Exception: a genuine bug discovered this way goes to Batch 3 as its own task.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/funnelcakeHealth.test.ts
git commit -m "test: cover circuit breaker state machine in funnelcakeHealth

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 5: Client→breaker integration test

Proves `funnelcakeClient` actually feeds the breaker (it calls `recordFunnelcakeSuccess`/`recordFunnelcakeFailure` at `src/lib/funnelcakeClient.ts:87,102`) — a refactor that drops those calls must fail a test.

**Files:**
- Create: `src/lib/funnelcakeCircuit.integration.test.ts`

- [ ] **Step 1: Write the test**

```ts
// ABOUTME: Integration test - funnelcakeClient request failures must trip the circuit breaker

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./sentry', () => ({
  addBreadcrumb: vi.fn(),
  Sentry: { captureMessage: vi.fn() },
}));
vi.mock('./debug', () => ({
  debugLog: vi.fn(),
  debugError: vi.fn(),
}));

import { searchVideos } from './funnelcakeClient';
import { isFunnelcakeAvailable, resetAllFunnelcakeCircuits } from './funnelcakeHealth';

const API = 'https://circuit-integration.example.test';

beforeEach(() => resetAllFunnelcakeCircuits());
afterEach(() => vi.unstubAllGlobals());

describe('funnelcakeClient + circuit breaker', () => {
  it('opens the circuit after 3 failed requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    for (let i = 0; i < 3; i++) {
      await searchVideos(API, { query: 'x' }).catch(() => undefined);
    }
    expect(isFunnelcakeAvailable(API)).toBe(false);
  });

  it('a successful request closes a tripped circuit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    for (let i = 0; i < 3; i++) {
      await searchVideos(API, { query: 'x' }).catch(() => undefined);
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ videos: [], total: 0 }),
    }));
    await searchVideos(API, { query: 'x' }).catch(() => undefined);
    expect(isFunnelcakeAvailable(API)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/lib/funnelcakeCircuit.integration.test.ts`
Expected: PASS. Two likely adjustments if it doesn't: (a) `searchVideos` may short-circuit once the breaker is open — that's fine for test 1 (the breaker is what we assert) but for test 2 the open circuit may block the recovery call; if so, advance past the 30s window with fake timers before the success call (`vi.useFakeTimers()` + `vi.advanceTimersByTime(30_001)`). (b) The success-path JSON shape may not match `searchVideos`' parser — match it to whatever `funnelcakeClient.test.ts` uses for the search endpoint.

- [ ] **Step 3: Commit**

```bash
git add src/lib/funnelcakeCircuit.integration.test.ts
git commit -m "test: verify funnelcakeClient failures trip the circuit breaker

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 6: Run Playwright a11y suite in CI

`tests/visual/` has an axe-core a11y spec and a visual-snapshot spec, but CI never runs them (AUDIT TEST-2). **Run only the a11y spec in CI**: the visual spec's committed baseline is `brand-primitives-chromium-darwin.png` — platform-suffixed, so it would always fail on ubuntu runners. Generating linux baselines is a separate follow-up.

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the job**

Append to `.github/workflows/ci.yml` (same indentation level as the existing `test:` job):

```yaml
  a11y:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run accessibility checks
        run: npx playwright test tests/visual/a11y.spec.ts
```

(The Playwright config's `webServer` starts `vite --port 8088` itself; no separate server step needed. `forbidOnly` and 2 retries are already CI-gated in `playwright.config.ts`.)

- [ ] **Step 2: Verify locally**

Run: `npx playwright test tests/visual/a11y.spec.ts`
Expected: PASS. If a real contrast violation has crept in, fix it or file it — do not exclude the surface (project rule: no shipping color-contrast violations on real content).

- [ ] **Step 3: Commit, push, PR — and confirm the new job runs**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run Playwright a11y suite on every push/PR

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push -u origin test/audit-batch1-safety-net
gh pr create --title "test: audit batch 1 — circuit breaker tests + a11y in CI" --body "Implements AUDIT.md Batch 1 (TEST-1 circuit coverage, TEST-2 Playwright in CI). Visual-snapshot spec stays local-only until linux baselines exist.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```

Expected: both `test` and `a11y` jobs green on the PR.

---

## Batch 2 — Hygiene (branch `chore/audit-batch2-hygiene`)

### Task 7: Remove implicit `npm i` from scripts; pin Node

AUDIT DEP-1/DEP-3. CI already runs `npm ci` explicitly; the in-script `npm i` re-resolves ranges on every dev/test/build run and can rewrite the lockfile.

**Files:**
- Modify: `package.json:8,9,11` (scripts `dev`, `build`, `test`) and add `engines`
- Create: `.nvmrc`

- [ ] **Step 1: Edit the three scripts**

In `package.json`, change:

```json
    "dev": "npm i && vite",
    "build": "npm i && vite build && cp dist/index.html dist/404.html && node scripts/copy-well-known.mjs && node scripts/prerender-legal.mjs && node scripts/verify-well-known.mjs",
    "test": "npm i && tsc -p tsconfig.app.json --noEmit && eslint && vitest run && vite build",
```

to:

```json
    "dev": "vite",
    "build": "vite build && cp dist/index.html dist/404.html && node scripts/copy-well-known.mjs && node scripts/prerender-legal.mjs && node scripts/verify-well-known.mjs",
    "test": "tsc -p tsconfig.app.json --noEmit && eslint && vitest run && vite build",
```

- [ ] **Step 2: Add engines + .nvmrc**

In `package.json`, after the `"license"` line, add:

```json
  "engines": {
    "node": ">=20"
  },
```

Create `.nvmrc` containing exactly:

```
20
```

- [ ] **Step 3: Check nothing else depended on the implicit install**

Run: `grep -rn 'npm run build\|npm run test\|npm run dev' .github/workflows/ scripts/ compute-js/package.json | grep -v node_modules`
Expected: every caller (CI, deploy workflows, `fastly:*` scripts which call `npm run build`) is preceded by an explicit `npm ci`/checkout install. CI's `deploy.yml` and `preview.yml` must run `npm ci` before `npm run build` — if any workflow relied on the implicit install, add an `npm ci` step there in this same commit.

- [ ] **Step 4: Verify and commit**

```bash
npm test
git add package.json .nvmrc
git commit -m "chore: drop implicit npm install from scripts, pin Node 20

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 8: Remove stray artifacts

AUDIT DEAD-3. `test-playwright.js` is git-tracked; the screenshots and debug log are untracked working-tree litter.

**Files:**
- Delete: `test-playwright.js` (tracked), `merch-contrast-fixed.png`, `popular-mobile.png`, `firebase-debug.log` (untracked)

- [ ] **Step 1: Confirm nothing references the script, then delete**

```bash
grep -rn 'test-playwright' package.json .github/ scripts/ || echo CLEAN
git rm test-playwright.js
rm -f merch-contrast-fixed.png popular-mobile.png firebase-debug.log
```

Expected: `CLEAN` from the grep (verified during audit: zero importers).

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove one-off test script and debug artifacts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 9: Type the Funnelcake byte-array wire format (drop `as unknown as`)

AUDIT ARCH-5. `normalizeVideoIds` (`src/lib/funnelcakeClient.ts:836-842`) double-casts because `FunnelcakeVideoRaw.id`/`pubkey` are declared `string` while the API sometimes sends `number[]`. Widen only the function's parameter — callers passing `FunnelcakeVideoRaw` still typecheck (string is assignable to the union).

**Files:**
- Modify: `src/lib/funnelcakeClient.ts:836-842`
- Test: `src/lib/funnelcakeClient.test.ts` (append)

- [ ] **Step 1: Write the test (append to `src/lib/funnelcakeClient.test.ts`)**

First check whether a `normalizeVideoIds` describe block already exists (`grep -n normalizeVideoIds src/lib/funnelcakeClient.test.ts`); if it covers both branches, skip to Step 3. Otherwise append:

```ts
describe('normalizeVideoIds', () => {
  it('converts byte-array id/pubkey to hex strings', () => {
    const raw = {
      id: [0xab, 0xcd],
      pubkey: [0x01, 0xff],
      created_at: 1, kind: 34236, d_tag: 'd',
    } as Parameters<typeof normalizeVideoIds>[0];
    const out = normalizeVideoIds(raw);
    expect(out.id).toBe('abcd');
    expect(out.pubkey).toBe('01ff');
  });

  it('passes string id/pubkey through unchanged', () => {
    const raw = {
      id: 'a'.repeat(64), pubkey: 'b'.repeat(64),
      created_at: 1, kind: 34236, d_tag: 'd',
    } as Parameters<typeof normalizeVideoIds>[0];
    const out = normalizeVideoIds(raw);
    expect(out.id).toBe('a'.repeat(64));
    expect(out.pubkey).toBe('b'.repeat(64));
  });
});
```

(Add `normalizeVideoIds` to the test file's import from `./funnelcakeClient`.)

- [ ] **Step 2: Run — expect PASS (behavior is already correct; this locks it before the type change)**

Run: `npx vitest run src/lib/funnelcakeClient.test.ts`

- [ ] **Step 3: Replace the casts with a typed parameter**

Replace `normalizeVideoIds` (`src/lib/funnelcakeClient.ts:836-842`) with:

```ts
/** Funnelcake sometimes serializes id/pubkey as byte arrays instead of hex strings */
type FunnelcakeWireVideo = Omit<FunnelcakeVideoRaw, 'id' | 'pubkey'> & {
  id: string | number[];
  pubkey: string | number[];
};

export function normalizeVideoIds(video: FunnelcakeWireVideo): FunnelcakeVideoRaw & { id: string; pubkey: string } {
  return {
    ...video,
    id: Array.isArray(video.id) ? parseByteArrayId(video.id) : video.id,
    pubkey: Array.isArray(video.pubkey) ? parseByteArrayId(video.pubkey) : video.pubkey,
  };
}
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run src/lib/funnelcakeClient.test.ts`
Expected: clean typecheck (callers unaffected — `string` narrows into the union), tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/funnelcakeClient.ts src/lib/funnelcakeClient.test.ts
git commit -m "refactor: type Funnelcake byte-array wire format, drop unsafe casts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 10: Classic Vines must never fall back to HLS

AUDIT PERF-6. `VideoCard.tsx` skips HLS for classic Vines (transcoder distorts square aspect) but the MP4-failure fallback path forgets the check.

**Files:**
- Modify: `src/components/VideoCard.tsx:143-145`

- [ ] **Step 1: Apply the one-line guard**

Replace:

```ts
  // When MP4 blob is missing (404), fall back to HLS if available (transcoded copy may exist)
  const hlsFallbackUrl = mp4Failed && video.videoUrl?.includes('media.divine.video')
    ? video.hlsUrl || optimalHlsUrl
    : undefined;
```

with:

```ts
  // When MP4 blob is missing (404), fall back to HLS if available (transcoded copy may exist).
  // Classic Vines never fall back to HLS — the transcoder distorts the square 480x480 aspect ratio.
  const hlsFallbackUrl = mp4Failed && !isClassicVine && video.videoUrl?.includes('media.divine.video')
    ? video.hlsUrl || optimalHlsUrl
    : undefined;
```

- [ ] **Step 2: Run the existing VideoCard tests**

Run: `npx vitest run src/components/VideoCard.test.tsx`
Expected: PASS (the fallback path isn't directly unit-tested; this run guards against accidental breakage of the rest of the card).

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoCard.tsx
git commit -m "fix: never fall back to HLS for classic Vines after MP4 failure

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 11: Lazy-load avatar images

AUDIT PERF-3, scoped down: during plan verification the grid thumbnails and avatars turned out to have size-reserving containers (`sizeClasses` on `Avatar`, sized wrappers in `VideoGrid`), so the CLS claim was overstated. The remaining cheap win is `loading="lazy"` on all avatars, set once in the shared primitive.

**Files:**
- Modify: `src/components/ui/avatar.tsx:184-188` (AvatarImage)

- [ ] **Step 1: Add the default**

Replace:

```tsx
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('h-full w-full rounded-[inherit] object-cover', className)}
    {...props}
  />
```

with:

```tsx
  <AvatarPrimitive.Image
    ref={ref}
    loading="lazy"
    className={cn('h-full w-full rounded-[inherit] object-cover', className)}
    {...props}
  />
```

(`loading` sits before `{...props}` so any caller can still override it.)

- [ ] **Step 2: Verify and commit**

```bash
npx vitest run src/components
git add src/components/ui/avatar.tsx
git commit -m "perf: lazy-load avatar images by default

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 12: Drop unconsumed shadcn wrappers and their dependencies

AUDIT DEAD-2. Five `ui/` wrappers have zero consumers (verified by grep during audit), keeping five deps alive; `next-themes` is used only by `ui/sonner.tsx` even though the app has its own `useTheme`.

**Files:**
- Delete: `src/components/ui/chart.tsx`, `src/components/ui/command.tsx`, `src/components/ui/input-otp.tsx`, `src/components/ui/calendar.tsx`, `src/components/ui/resizable.tsx`
- Modify: `src/components/ui/sonner.tsx`
- Modify: `package.json` (via npm uninstall)

- [ ] **Step 1: Re-verify zero consumers (cheap insurance against drift since the audit)**

```bash
for f in ui/chart ui/command ui/input-otp ui/calendar ui/resizable; do
  echo "-- $f --"; grep -rln "$f" src tests --include='*.ts*' | grep -v "components/$f"; done
```

Expected: no output under any header. If a consumer appeared, drop that file from this task and note it in the PR.

- [ ] **Step 2: Rewire `ui/sonner.tsx` off next-themes**

Replace the top of `src/components/ui/sonner.tsx`:

```tsx
import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
```

with:

```tsx
import { useTheme } from "@/hooks/useTheme"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { displayTheme } = useTheme()

  return (
    <Sonner
      theme={displayTheme}
```

(The rest of the file is unchanged. `displayTheme` is already resolved `'light' | 'dark'` — no `system` passthrough needed. The `Sonner` toaster renders inside `AppProvider` in `App.tsx`, so `useAppContext` is available.)

- [ ] **Step 3: Delete the wrappers and uninstall**

```bash
git rm src/components/ui/chart.tsx src/components/ui/command.tsx src/components/ui/input-otp.tsx src/components/ui/calendar.tsx src/components/ui/resizable.tsx
npm uninstall recharts cmdk input-otp react-day-picker react-resizable-panels next-themes
```

- [ ] **Step 4: Full gate, commit, PR**

```bash
npm test
git add -A
git commit -m "chore: remove unconsumed shadcn wrappers and 6 unused dependencies

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push -u origin chore/audit-batch2-hygiene
gh pr create --title "chore: audit batch 2 — hygiene (scripts, dead deps, type fix)" --body "Implements AUDIT.md Batch 2 (DEP-1, DEP-3, ARCH-5, PERF-3 scoped, PERF-6, DEAD-2, DEAD-3). DEAD-1 component deletions and DEP-2 override deferred pending decisions (AUDIT.md 'Explicitly unsure').

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Batch 3 — Correctness fixes (branch `fix/audit-batch3-correctness`)

### Task 13: Crash-proof the moderation localStorage reads

AUDIT COR-2. Two bare `JSON.parse` calls on `content_reports` (`src/hooks/useModeration.ts:344,365`) crash on corrupted storage. Extract one safe reader, TDD.

**Files:**
- Modify: `src/hooks/useModeration.ts`
- Test: `src/hooks/useModeration.test.ts` (exists — append)

- [ ] **Step 1: Write the failing tests (append to `src/hooks/useModeration.test.ts`)**

```ts
import { readStoredContentReports } from './useModeration';

describe('readStoredContentReports', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when nothing is stored', () => {
    expect(readStoredContentReports()).toEqual([]);
  });

  it('returns the stored array when valid', () => {
    const reports = [{ eventId: 'e', pubkey: 'p', reason: 'spam', details: '', createdAt: 1 }];
    localStorage.setItem('content_reports', JSON.stringify(reports));
    expect(readStoredContentReports()).toEqual(reports);
  });

  it('returns [] instead of throwing on corrupted JSON', () => {
    localStorage.setItem('content_reports', '{not json');
    expect(readStoredContentReports()).toEqual([]);
  });

  it('returns [] when stored value is valid JSON but not an array', () => {
    localStorage.setItem('content_reports', '{"a":1}');
    expect(readStoredContentReports()).toEqual([]);
  });
});
```

(If the existing file's top-level mocks interfere, put this describe in its own new file `src/hooks/readStoredContentReports.test.ts` with the same content plus the vitest imports the project uses.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/hooks/useModeration.test.ts`
Expected: FAIL — `readStoredContentReports` is not exported.

- [ ] **Step 3: Implement the reader and use it at both sites**

In `src/hooks/useModeration.ts`, add near the top (after imports/types):

```ts
/** Read the locally-stored report history; corrupted storage degrades to empty, never throws. */
export function readStoredContentReports(): ContentReport[] {
  const stored = localStorage.getItem('content_reports');
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    console.warn('[useModeration] Corrupt content_reports in localStorage; treating as empty');
    return [];
  }
}
```

At site 1 (inside the `useReportContent` mutationFn, line ~343), replace:

```ts
      const existing = localStorage.getItem('content_reports');
      const reports: ContentReport[] = existing ? JSON.parse(existing) : [];
```

with:

```ts
      const reports: ContentReport[] = readStoredContentReports();
```

At site 2 (`useReportHistory`, line ~363), replace:

```ts
    queryFn: () => {
      const stored = localStorage.getItem('content_reports');
      if (!stored) return [];
      return JSON.parse(stored) as ContentReport[];
    },
```

with:

```ts
    queryFn: () => readStoredContentReports(),
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/hooks/useModeration.test.ts`
Expected: PASS (new + all pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useModeration.ts src/hooks/useModeration.test.ts
git commit -m "fix: tolerate corrupted content_reports localStorage instead of crashing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 14: Guard VideoPlayer against stale auth-preflight resolutions

AUDIT COR-1. In the source-setup effect, `checkAuth()` awaits a network preflight and then calls `loadVideoSource()`; the cleanup aborts the controller and destroys `hlsRef`, but the `.then` never checks `aborted` — a stale resolution re-creates an HLS instance and clobbers the newer one.

**Files:**
- Modify: `src/components/VideoPlayer.tsx:774-779`

- [ ] **Step 1: Apply the guards**

Replace (`src/components/VideoPlayer.tsx:774-778`):

```ts
      // Run preflight check then load video
      checkAuth().then((authorized) => {
        if (!authorized) return;
        loadVideoSource();
      });
```

with:

```ts
      // Run preflight check then load video.
      // Stale-resolution guard: if the effect re-ran (deps changed), the cleanup
      // already aborted this controller and destroyed our HLS instance — this run
      // must not touch the video element or hlsRef.
      checkAuth().then((authorized) => {
        if (abortController.signal.aborted) return;
        if (!authorized) return;
        loadVideoSource();
      });
```

And replace the first line of `loadVideoSource` (line ~780):

```ts
        if (!video) return; // Guard for TypeScript - video was checked before calling
```

with:

```ts
        if (!video || abortController.signal.aborted) return; // Stale run after cleanup must not re-create HLS
```

- [ ] **Step 2: Run the player test suites**

Run: `npx vitest run src/components/VideoPlayer.test.tsx src/components/VideoPlayer.authHeaders.test.tsx`
Expected: PASS. If any test fails, it's likely a test that resolves the auth preflight after unmount and previously relied on the (buggy) load happening — read it carefully before changing anything; the production guard is correct.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoPlayer.tsx
git commit -m "fix: drop stale auth-preflight resolutions in VideoPlayer source setup

Prevents a stale async run from re-creating an HLS instance and clobbering
hlsRef after the effect cleanup already destroyed/replaced it.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 15: Thread React Query abort signals into long-running queryFns

AUDIT COR-3. Two queryFns ignore React Query's `signal`, so identity verification and relay fan-out searches keep running (and caching results) after unmount.

**Files:**
- Modify: `src/components/LinkedAccounts.tsx:93`
- Modify: `src/hooks/useExternalIdentities.ts:239-244` (verifyIdentityClaim), `:311-314` (verifyViaService), and the two internal `fetch` calls
- Modify: `src/hooks/useResolveSubdomainPubkey.ts:75-78` (searchForCorrectPubkey), `:113` (queryFn)

- [ ] **Step 1: `verifyIdentityClaim` accepts and threads a signal**

In `src/hooks/useExternalIdentities.ts`, change the signature (line 239):

```ts
export async function verifyIdentityClaim(
  identity: ExternalIdentity,
  pubkey: string,
): Promise<{ verified: boolean; error?: string }> {
```

to:

```ts
export async function verifyIdentityClaim(
  identity: ExternalIdentity,
  pubkey: string,
  signal?: AbortSignal,
): Promise<{ verified: boolean; error?: string }> {
```

Change the service call (line ~265) from `await verifyViaService(cleanedIdentity, pubkey)` to `await verifyViaService(cleanedIdentity, pubkey, signal)`.

Change the browser-verification fetch (line ~284) from:

```ts
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });
```

to:

```ts
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    });
```

- [ ] **Step 2: `verifyViaService` accepts and threads a signal**

Change the signature (line 311):

```ts
async function verifyViaService(
  identity: ExternalIdentity,
  pubkey: string,
): Promise<{ verified: boolean; error?: string } | null> {
```

to:

```ts
async function verifyViaService(
  identity: ExternalIdentity,
  pubkey: string,
  signal?: AbortSignal,
): Promise<{ verified: boolean; error?: string } | null> {
```

and its fetch option (line ~328) from:

```ts
      signal: AbortSignal.timeout(API_CONFIG.verificationService.timeout),
```

to:

```ts
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(API_CONFIG.verificationService.timeout)])
        : AbortSignal.timeout(API_CONFIG.verificationService.timeout),
```

- [ ] **Step 3: Pass the signal from the LinkedAccounts queryFn**

In `src/components/LinkedAccounts.tsx:93`, change:

```ts
    queryFn: () => verifyIdentityClaim(identity, pubkey),
```

to:

```ts
    queryFn: ({ signal }) => verifyIdentityClaim(identity, pubkey, signal),
```

- [ ] **Step 4: Same pattern in useResolveSubdomainPubkey**

In `src/hooks/useResolveSubdomainPubkey.ts`, change `searchForCorrectPubkey` (lines 75-78) from:

```ts
async function searchForCorrectPubkey(subdomain: string, apexDomain: string): Promise<string | null> {
  const searchTerm = `${subdomain}.${apexDomain}`;
  const signal = AbortSignal.timeout(10000);
```

to:

```ts
async function searchForCorrectPubkey(subdomain: string, apexDomain: string, outerSignal?: AbortSignal): Promise<string | null> {
  const searchTerm = `${subdomain}.${apexDomain}`;
  const timeoutSignal = AbortSignal.timeout(10000);
  const signal = outerSignal ? AbortSignal.any([outerSignal, timeoutSignal]) : timeoutSignal;
```

and the queryFn (line ~113) from:

```ts
    queryFn: () => searchForCorrectPubkey(subdomain, apexDomain),
```

to:

```ts
    queryFn: ({ signal }) => searchForCorrectPubkey(subdomain, apexDomain, signal),
```

- [ ] **Step 5: Run the related suites and typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run src/hooks/useExternalIdentities.test.ts src/components/LinkedAccounts.test.tsx`
Expected: clean typecheck; PASS. (`AbortSignal.any` exists in Node 20+ and all evergreen browsers; jsdom under Node 20 has it.)

- [ ] **Step 6: Commit**

```bash
git add src/components/LinkedAccounts.tsx src/hooks/useExternalIdentities.ts src/hooks/useResolveSubdomainPubkey.ts
git commit -m "fix: thread React Query abort signals into identity and subdomain lookups

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 16: Stop swallowing diagnostic errors silently

AUDIT COR-4. Three silent catches hide operationally useful failures (RSS probe outages cached as "unavailable"; relay metadata poisoning invisible; relay close failures invisible).

**Files:**
- Modify: `src/hooks/useRssFeedAvailable.ts:17-19`
- Modify: `src/hooks/useResolveSubdomainPubkey.ts:48-55,62-66`

- [ ] **Step 1: useRssFeedAvailable — log the probe failure**

Replace:

```ts
  } catch {
    return false;
  }
```

with:

```ts
  } catch (err) {
    console.warn('[useRssFeedAvailable] RSS feed probe failed (treating as unavailable):', err);
    return false;
  }
```

- [ ] **Step 2: useResolveSubdomainPubkey — log skipped events and close failures**

Replace (lines ~48-55):

```ts
      } catch {
        // Skip events with invalid JSON content
      }
```

with:

```ts
      } catch {
        console.warn(`[useResolveSubdomainPubkey] Skipping event with invalid metadata JSON: ${event.id} via ${relayUrl}`);
      }
```

Replace (lines ~62-66):

```ts
    try {
      relay?.close();
    } catch {
      // Ignore close errors
    }
```

with:

```ts
    try {
      relay?.close();
    } catch (err) {
      console.warn(`[useResolveSubdomainPubkey] Failed to close relay ${relayUrl}:`, err);
    }
```

- [ ] **Step 3: Commit**

```bash
npm test
git add src/hooks/useRssFeedAvailable.ts src/hooks/useResolveSubdomainPubkey.ts
git commit -m "fix: log swallowed errors in RSS probe and subdomain relay search

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### Task 17: Fix circuit breaker half-open recovery (COR-5 — found while writing Batch 1 tests)

`isFunnelcakeAvailable` (`src/lib/funnelcakeHealth.ts:36-51`) logs "circuit half-open, allowing retry" after the 30s window but then returns `status.available`, which is still `false` from when the circuit opened. Every REST call is gated on this function and `checkFunnelcakeHealth`/`resetFunnelcakeCircuit` have **zero callers** in src/, so no request ever runs to record a success: once a circuit opens, REST stays disabled until page reload. The fix makes the half-open branch return `true` (allow exactly one retry; a failure re-opens the window because `recordFunnelcakeFailure` updates `lastChecked`).

**Files:**
- Modify: `src/lib/funnelcakeHealth.ts:36-51`
- Test: `src/lib/funnelcakeHealth.test.ts` (flip the bug-documenting test from Batch 1 Task 4)

- [ ] **Step 1: Flip the test to assert correct behavior**

In `src/lib/funnelcakeHealth.test.ts`, replace the bug-documenting test from Task 4 with:

```ts
  it('half-opens (allows one retry) after the 30s reset window', () => {
    failNTimes(3);
    expect(isFunnelcakeAvailable(API)).toBe(false);
    vi.advanceTimersByTime(30_001);
    expect(isFunnelcakeAvailable(API)).toBe(true);
  });

  it('a failure during half-open re-opens the circuit for another 30s', () => {
    failNTimes(3);
    vi.advanceTimersByTime(30_001);
    expect(isFunnelcakeAvailable(API)).toBe(true);
    recordFunnelcakeFailure(API, 'half-open retry failed');
    expect(isFunnelcakeAvailable(API)).toBe(false);
    vi.advanceTimersByTime(30_001);
    expect(isFunnelcakeAvailable(API)).toBe(true);
  });
```

(Also delete the now-duplicated `a failure during half-open restarts the 30s window` test from Task 4 if its assertions conflict — the two tests above supersede it.)

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/lib/funnelcakeHealth.test.ts`
Expected: FAIL — `isFunnelcakeAvailable` returns `false` after the window.

- [ ] **Step 3: Fix the half-open branch**

In `src/lib/funnelcakeHealth.ts`, replace (lines 36-51):

```ts
export function isFunnelcakeAvailable(apiUrl: string): boolean {
  const status = getFunnelcakeStatus(apiUrl);

  // Circuit is open - check if enough time has passed for retry
  if (status.errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
    const timeSinceLastCheck = Date.now() - status.lastChecked;
    if (timeSinceLastCheck < CIRCUIT_BREAKER_RESET_MS) {
      debugLog(`[FunnelcakeHealth] Circuit open for ${apiUrl}, waiting ${Math.round((CIRCUIT_BREAKER_RESET_MS - timeSinceLastCheck) / 1000)}s for retry`);
      return false;
    }
    // Enough time has passed, allow one retry
    debugLog(`[FunnelcakeHealth] Circuit half-open for ${apiUrl}, allowing retry`);
  }

  return status.available;
}
```

with:

```ts
export function isFunnelcakeAvailable(apiUrl: string): boolean {
  const status = getFunnelcakeStatus(apiUrl);

  // Circuit is open - check if enough time has passed for retry
  if (status.errorCount >= CIRCUIT_BREAKER_THRESHOLD) {
    const timeSinceLastCheck = Date.now() - status.lastChecked;
    if (timeSinceLastCheck < CIRCUIT_BREAKER_RESET_MS) {
      debugLog(`[FunnelcakeHealth] Circuit open for ${apiUrl}, waiting ${Math.round((CIRCUIT_BREAKER_RESET_MS - timeSinceLastCheck) / 1000)}s for retry`);
      return false;
    }
    // Half-open: allow one retry. recordFunnelcakeSuccess closes the circuit;
    // recordFunnelcakeFailure updates lastChecked, restarting the 30s window.
    debugLog(`[FunnelcakeHealth] Circuit half-open for ${apiUrl}, allowing retry`);
    return true;
  }

  return status.available;
}
```

- [ ] **Step 4: Run the breaker suites and the full gate**

Run: `npx vitest run src/lib/funnelcakeHealth.test.ts src/lib/funnelcakeCircuit.integration.test.ts && npm test`
Expected: all PASS (the Batch 1 integration test's recovery case may simplify — if it added a fake-timer workaround for the open circuit, the workaround now reflects real half-open behavior and should still pass).

- [ ] **Step 5: Commit, push, PR**

```bash
git add src/lib/funnelcakeHealth.ts src/lib/funnelcakeHealth.test.ts
git commit -m "fix: circuit breaker never recovered after opening (half-open returned false)

isFunnelcakeAvailable gated every REST call but returned the stale
available=false flag after the 30s window, and nothing else ever recorded
a success - an opened circuit disabled REST until page reload.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push -u origin fix/audit-batch3-correctness
gh pr create --title "fix: audit batch 3 — correctness fixes (circuit recovery, stale promise, JSON.parse, signals)" --body "Implements AUDIT.md Batch 3 (COR-1 through COR-5). COR-5 (circuit breaker never half-opens) was discovered while writing the Batch 1 tests. Each fix is a separate commit and individually revertable.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## After this plan

Write separate plans (in dependency order) once the above merges and the deferred decisions are made:

1. **Batch 4 — hot-path performance** (PERF-1 feed-level metrics batching, then PERF-2 feed virtualization; PERF-4/5 follow-ups).
2. **Batch 5 — layering** (ARCH-1: six raw fetch/query sites into hooks + funnelcakeClient).
3. **Batch 6 — structural splits** (ARCH-3 client domain split, DUP-1 list-dialog extraction, ARCH-2 VideoCard/VideoPlayer extraction — sequence against the mobile-redesign branch first).
4. **Batch 7 — strictness ratchet + planned majors** (ARCH-4, DEP-4: react-router 7 → react 19 → vite/vitest majors → zod 4; defer tailwind 4).

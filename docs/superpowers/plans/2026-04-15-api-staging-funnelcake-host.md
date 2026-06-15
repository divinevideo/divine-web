# API Staging Funnelcake Host Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route `api.staging.divine.video` to `relay.staging.divine.video` while keeping `api.divine.video` on `relay.divine.video`.

**Architecture:** Introduce explicit host mapping helpers instead of production-only string literals. Use the compute helper for proxied Funnelcake reads and update the client relay helper so staging relay URLs resolve to the staging API host.

**Tech Stack:** JavaScript, TypeScript, Fastly Compute, Vitest, Vite

---

## Chunk 1: Lock The Mappings With Tests

### Task 1: Add compute host mapping tests

**Files:**
- Create: `compute-js/src/funnelcakeOrigin.test.ts`
- Create: `compute-js/src/funnelcakeOrigin.js`

- [ ] **Step 1: Write the failing test**

```ts
it('maps the staging API host to the staging relay origin', () => {
  expect(getFunnelcakeOriginForApiHost('api.staging.divine.video')).toEqual({
    apiHost: 'api.staging.divine.video',
    origin: 'https://relay.staging.divine.video',
    hostHeader: 'relay.staging.divine.video',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run compute-js/src/funnelcakeOrigin.test.ts`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a small pure helper that maps known API hosts to origin URL and Host header values, defaulting unknown hosts to production.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run compute-js/src/funnelcakeOrigin.test.ts`
Expected: PASS

### Task 2: Add relay helper tests

**Files:**
- Create: `src/config/relays.test.ts`
- Modify: `src/config/relays.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('maps the staging Divine relay to the staging API host', () => {
  expect(getFunnelcakeUrl('wss://relay.staging.divine.video')).toBe('https://api.staging.divine.video');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/relays.test.ts`
Expected: FAIL because staging is not recognized yet.

- [ ] **Step 3: Write minimal implementation**

Extend the Divine Funnelcake host allowlist and rewrite logic for the staging host pair without changing non-Divine behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/relays.test.ts`
Expected: PASS

## Chunk 2: Wire The Compute Service To The Helper

### Task 3: Replace compute hard-coding

**Files:**
- Modify: `compute-js/src/index.js`
- Modify: `compute-js/src/funnelcakeOrigin.js`

- [ ] **Step 1: Import the helper into the compute entrypoint**
- [ ] **Step 2: Use the effective request host to resolve the correct Funnelcake origin**
- [ ] **Step 3: Replace direct `relay.divine.video` fetch URLs and `Host` headers in each REST proxy path**
- [ ] **Step 4: Run `npx vitest run compute-js/src/funnelcakeOrigin.test.ts src/config/relays.test.ts`**

## Chunk 3: Verify End To End

### Task 4: Final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-04-15-api-staging-funnelcake-host-design.md`
- Modify: `docs/superpowers/plans/2026-04-15-api-staging-funnelcake-host.md`

- [ ] **Step 1: Review docs for accuracy after implementation**
- [ ] **Step 2: Run `npm test`**
- [ ] **Step 3: Review `git diff --stat` and `git status --short`**

# i18n/L10n Full Coverage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend PR 229 so every app-owned page and static content surface is translated across all 15 supported locales, while leaving user-generated content unchanged.

**Architecture:** Build on the existing `i18next` foundation in the `feat/i18n-l10n-kickoff` branch. Expand translation catalogs beyond the shell-focused kickoff coverage, move long-form static page content into translation namespaces, replace remaining hard-coded app-owned copy with `t(...)` lookups, and guard the result with locale parity tests plus targeted UI tests.

**Tech Stack:** TypeScript, React 18, React Router, i18next, react-i18next, Vitest, Testing Library

---

## File Map

- Modify: `src/lib/i18n/index.ts`
  - Register any new namespaces needed for large page domains.
- Create or modify: `src/lib/i18n/locales/<locale>/*.json`
  - Add English source keys and matching locale files for full page coverage.
- Create: `src/lib/i18n/locales.test.ts`
  - Verify every locale matches English across every namespace.
- Modify: route pages under `src/pages/`
  - Replace app-owned inline copy with translation keys.
- Modify: shared UI and dialogs under `src/components/`
  - Replace remaining inline app copy, form labels, buttons, helper text, and dialogs.
- Modify: existing or new targeted tests under `src/pages/*.test.tsx` and `src/components/*.test.tsx`
  - Assert translated rendering for representative converted surfaces.

## Chunk 1: Lock Coverage Guards

### Task 1: Make missing locale coverage impossible to hide

**Files:**
- Modify: `src/lib/i18n/locales.test.ts`
- Modify: `src/lib/i18n/index.ts`

- [ ] **Step 1: Expand the locale parity test to cover every namespace**

Make the test iterate through every English namespace and assert that each supported locale has the same flattened key set.

- [ ] **Step 2: Run the parity test and confirm it fails if any namespace is incomplete**

Run: `npx vitest run src/lib/i18n/locales.test.ts`
Expected: FAIL once new English namespaces exist but non-English locale files do not.

- [ ] **Step 3: Implement the namespace-aware parity guard**

Keep the test readable and make failures print the exact locale and missing keys.

- [ ] **Step 4: Re-run the parity test and confirm it passes**

Run: `npx vitest run src/lib/i18n/locales.test.ts`
Expected: PASS

## Chunk 2: Translate Long-Form Static Pages

### Task 2: Move legal, FAQ, support, and marketing copy into catalogs

**Files:**
- Modify: `src/pages/TermsPage.tsx`
- Modify: `src/pages/PrivacyPage.tsx`
- Modify: `src/pages/SafetyPage.tsx`
- Modify: `src/pages/FAQPage.tsx`
- Modify: `src/pages/AboutPage.tsx`
- Modify: `src/pages/OpenSourcePage.tsx`
- Modify: `src/pages/DMCAPage.tsx`
- Modify: `src/pages/Support.tsx`
- Modify: matching locale catalog files under `src/lib/i18n/locales/<locale>/`
- Modify or create: targeted tests for representative static pages

- [ ] **Step 1: Write failing tests for representative static pages**

Add focused tests that render at least one legal page and one marketing or support page in a non-English locale and assert translated app-owned headings and body copy.

- [ ] **Step 2: Run those tests and confirm they fail**

Run: `npx vitest run src/pages/FAQPage.test.tsx src/pages/TermsPage.test.tsx`
Expected: FAIL because the pages still render English inline copy.

- [ ] **Step 3: Move page content into translation catalogs and wire `useTranslation`**

Prefer structured keys over giant raw blobs where possible, but keep the implementation practical.

- [ ] **Step 4: Re-run the static page tests and confirm they pass**

Run: `npx vitest run src/pages/FAQPage.test.tsx src/pages/TermsPage.test.tsx`
Expected: PASS

## Chunk 3: Translate Remaining Product Pages

### Task 3: Convert route pages that still render app-owned English UI

**Files:**
- Modify: remaining untranslated files in `src/pages/`
- Modify: matching locale catalog files
- Modify or create: targeted route tests for high-signal pages

- [ ] **Step 1: Identify remaining route pages with hard-coded app-owned strings**

Use repo search to find pages still rendering inline English labels, headings, helper copy, and empty states.

- [ ] **Step 2: Add failing tests for a representative sample of untranslated route pages**

Cover at least messages-adjacent, profile-adjacent, settings, and utility pages that were not part of the kickoff pass.

- [ ] **Step 3: Replace inline strings with translation keys**

Convert headings, tabs, CTA labels, helper text, empty states, and page-owned descriptions. Do not translate user-generated content.

- [ ] **Step 4: Re-run the targeted route tests and confirm they pass**

Run: `npx vitest run <targeted page tests>`
Expected: PASS

## Chunk 4: Translate Remaining Shared Components and Dialogs

### Task 4: Finish shared UI surfaces that are reused across pages

**Files:**
- Modify: remaining untranslated files in `src/components/`
- Modify: matching locale catalog files
- Modify or create: targeted component tests

- [ ] **Step 1: Add failing tests for representative dialogs and shared components**

Cover dialogs, form labels, button copy, and helper text that still render English.

- [ ] **Step 2: Run the targeted component tests and confirm they fail**

Run: `npx vitest run <targeted component tests>`
Expected: FAIL before conversion.

- [ ] **Step 3: Convert the remaining app-owned component copy**

Use existing translation helpers and keep key names semantic.

- [ ] **Step 4: Re-run the targeted component tests and confirm they pass**

Run: `npx vitest run <targeted component tests>`
Expected: PASS

## Chunk 5: Final Verification and PR Update

### Task 5: Prove the full-coverage pass is stable

**Files:**
- Modify: any remaining files needed to fix verification issues

- [ ] **Step 1: Run targeted i18n verification**

Run: `npx vitest run src/lib/i18n/locales.test.ts <targeted translated page and component tests>`
Expected: PASS

- [ ] **Step 2: Run full repository verification**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit the full-coverage translation pass**

```bash
git add src docs
git commit -m "feat: translate app-owned pages across locales"
```

- [ ] **Step 4: Push the updated PR branch**

```bash
git push origin feat/i18n-l10n-kickoff
```

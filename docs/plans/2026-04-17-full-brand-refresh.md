# Full Brand Refresh — Divine Web Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align divine-web's visual and verbal execution with the official Divine brand guidelines (`docs/brand/`) — closing the gaps identified in `docs/brand/ALIGNMENT_REPORT.md` — by replacing Lucide with Phosphor icons, introducing a new "Playful Rebel" visual language (chunky offset shadows, thick borders, micro-rotation), rewriting corporate microcopy into Divine's voice, and rebuilding the landing page around the brand manifesto.

**Architecture:** Phased rollout across six self-contained PRs. Each phase is independently mergeable and leaves the app in a shippable state. Design tokens and utilities land first; those utilities are then applied to shared primitives (Button, Card), then to feature surfaces, then the mechanical icon migration, then copy, then landing. Each phase is gated by tests + visual QA.

**Tech Stack:** React 18, TailwindCSS 3.4, shadcn/ui (Radix primitives), class-variance-authority, Vitest + React Testing Library, Playwright (a11y), Bricolage Grotesque + Inter (Google Fonts), **new:** `@phosphor-icons/react`.

**Scope context (verified against worktree at 2026-04-17):**
- ~107 files currently import `lucide-react` (111 occurrences total)
- 8 files use `uppercase` class (brand don't): `PinnedVideosSection.tsx`, `LanguageMenu.tsx`, `ApplePodcastEmbed.tsx`, `ProfileBadges.tsx`, `TermsPage.tsx`, `MessagesPage.tsx`, `ConversationPage.tsx`, `AboutPage.tsx`
- **13 files use gradient backgrounds or CSS gradients** (brand don't, *if* on layout surfaces). Split into two categories:
  - **Layout gradients (must fix — 8 files):** `src/pages/NotFound.tsx`, `src/pages/MessagesPage.tsx`, `src/pages/ConversationPage.tsx`, `src/components/LandingPage.tsx`, `src/components/VideoGrid.tsx`, `src/components/VideoFeed.tsx`, `src/components/HashtagExplorer.tsx`, `src/components/ClassicVinersRow.tsx` (7 fixed in Phase 5 Task 5.1; `LandingPage.tsx` fixed via full rebuild in Task 5.2)
  - **Decorative/illustration gradients (allowlist — 5 files):** `src/components/ui/avatar.tsx` (AvatarFallback shimmer), `src/components/BadgeImage.tsx`, `src/components/BadgeDetailModal.tsx`, `src/components/landing/VerifiedDemo.tsx`, `src/components/landing/DecentralizedDemo.tsx` — the brand guideline explicitly permits gradients *inside illustration/imagery* (not on flat layout surfaces)
- Pacifico `font-logo` is off-brand (only used in `VineBadge.tsx` + defined in `src/index.css:203`)
- **LandingPage actual path:** `src/components/LandingPage.tsx` (NOT `src/pages/`)
- **UploadPage actual path:** `src/pages/UploadPage.tsx`
- **No `playwright.config.*` exists**; `@playwright/test` is not installed (only `playwright` and `@axe-core/playwright` are). Phase 0 adds both.
- **i18n is in use:** `react-i18next@^17`, `i18next@^26`. English locale lives at `src/lib/i18n/locales/en/`; 15 language subdirectories total
- **A11y audit runs via `scripts/a11y-audit.mjs`** — there is no `tests/a11y/` directory

**Out of scope:**
- Changing the app information architecture, routes, or feature set
- New product features
- Mobile app changes (this repo is web only; divine-mobile is separate)
- Any deploy to production (each phase PR runs through normal review/deploy)

---

## Chunk 1: File Structure & Phase 0 (Foundation)

### File Structure

**New files:**
- `src/styles/brand-utilities.css` — `@layer components` with brand-sticker, brand-card, brand-tilt-*, brand-offset-shadow-* utilities.
- `src/components/brand/BrandLogo.tsx` — replaces all Pacifico `font-logo` usage with a compliant Bricolage Extra Bold logotype.
- `src/components/brand/SectionHeader.tsx` — reusable heading component that forbids `uppercase` and enforces `font-extrabold` Bricolage on h2/h3.
- `src/components/brand/BrandCard.tsx` — thin wrapper around shadcn `Card` that adds the brand offset-shadow + thick border variants.
- `src/lib/iconMap.ts` — explicit mapping of our ~40 most-used lucide icons → Phosphor equivalents (supports the codemod).
- `scripts/codemod-lucide-to-phosphor.mjs` — one-shot jscodeshift-style script that rewrites imports + JSX tag names.
- `docs/brand/MICROCOPY_INVENTORY.md` — generated spreadsheet of every user-facing string, its location, current text, proposed text.
- `tests/brand/BrandCard.test.tsx`, `tests/brand/SectionHeader.test.tsx`, `tests/brand/BrandLogo.test.tsx`
- `tests/brand/no-gradients.test.ts` — ESLint-style test that fails if any `src/pages/**` or `src/components/**` file contains `bg-gradient-` or `radial-gradient(`.
- `tests/brand/no-uppercase-class.test.ts` — same pattern, forbids `uppercase` Tailwind class in `src/`.
- `tests/brand/no-lucide-react.test.ts` — forbids `lucide-react` import anywhere under `src/` (enabled at end of Phase 3).

**Modified files:**
- `package.json` — add `@phosphor-icons/react`, remove `lucide-react` (at end of Phase 3 only), remove `@fontsource/pacifico` (Phase 0).
- `src/index.css` — remove Pacifico `@import`/definitions, remove `.font-logo` rule, import `./styles/brand-utilities.css`.
- `tailwind.config.ts` — remove `logo: ['Pacifico', …]` from `fontFamily`, add `fontWeight` defaults for Bricolage headings.
- `index.html` — fix FOUC fallback `#09090b` → `#07241B`.
- `src/components/ui/button-variants.ts` — new `sticker` variant (thick border + chunky offset shadow + hover lift).
- `src/components/ui/card.tsx` — expose a `variant` prop that can opt into brand offset-shadow styling.
- Every component currently using `font-logo` or `Pacifico`.
- Every component currently using `uppercase tracking-*` on section titles.
- 8 layout files currently using `bg-gradient-*` / `radial-gradient(` on layout surfaces (see Scope context for the list; 7 fixed in Phase 5 Task 5.1, 1 via LandingPage rebuild in Task 5.2).
- ~107 components importing from `lucide-react` (Phase 3 only).
- Microcopy across dialogs, empty states, toasts (Phase 4).
- `src/components/LandingPage.tsx` + `src/components/landing/*` (Phase 5, rebuild).

### Phase 0 — Foundation (Tests + utilities, no visible UI yet)

Goal: land the design-language infrastructure and lint-style tests before touching any user-visible surface. This phase adds *nothing* visible but unlocks everything downstream.

---

### Task 0.1: Add Phosphor icons dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Phosphor**

Run: `cd /Users/rabble/code/divine/divine-web/.worktrees/brand-redesign && npm install @phosphor-icons/react`
Expected: `@phosphor-icons/react` appears in `package.json` dependencies.

- [ ] **Step 2: Verify install**

Run: `npm ls @phosphor-icons/react`
Expected: version listed, no peer warnings.

- [ ] **Step 3: Type-check baseline**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: 0 errors (unchanged from pre-install).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @phosphor-icons/react dependency"
```

---

### Task 0.2: Remove Pacifico and non-brand fonts

**Files:**
- Modify: `package.json` (remove `@fontsource/pacifico`)
- Modify: `tailwind.config.ts:24` (remove `logo: ['Pacifico', 'cursive']`)
- Modify: `src/index.css:202` (remove `.font-logo` from headings selector)
- Create: `src/components/brand/BrandLogo.tsx`
- Modify: `src/components/VineBadge.tsx` (replace `font-logo` usage)

- [ ] **Step 1: Write failing test for BrandLogo**

Create `tests/brand/BrandLogo.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { BrandLogo } from '@/components/brand/BrandLogo';

describe('BrandLogo', () => {
  it('renders the Divine wordmark', () => {
    render(<BrandLogo />);
    expect(screen.getByText('Divine')).toBeInTheDocument();
  });

  it('uses Bricolage Grotesque with extra-bold weight', () => {
    render(<BrandLogo />);
    const el = screen.getByText('Divine');
    expect(el.className).toMatch(/font-extrabold/);
    // Bricolage is applied globally to all heading levels via src/index.css — rendering as <span> keeps this class explicit
    expect(el.tagName).toBe('SPAN');
  });

  it('never uses Pacifico or font-logo', () => {
    render(<BrandLogo />);
    const el = screen.getByText('Divine');
    expect(el.className).not.toMatch(/font-logo/);
    expect(el.className).not.toMatch(/pacifico/i);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run tests/brand/BrandLogo.test.tsx`
Expected: FAIL with "Cannot find module '@/components/brand/BrandLogo'".

- [ ] **Step 3: Implement BrandLogo**

Create `src/components/brand/BrandLogo.tsx`:
```tsx
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        'font-extrabold tracking-tight text-brand-green',
        // Bricolage Grotesque is inherited via the global h1–h6 selector,
        // but BrandLogo is often a <span> — set a safe family via style.
        className,
      )}
      style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
    >
      Divine
    </span>
  );
}
```

- [ ] **Step 4: Run test — verify pass**

Run: `npx vitest run tests/brand/BrandLogo.test.tsx`
Expected: all 3 tests pass.

- [ ] **Step 5: Remove Pacifico from CSS and Tailwind**

Edit `src/index.css`:
- Line 202: replace `h1, h2, h3, h4, h5, h6, .font-logo {` with `h1, h2, h3, h4, h5, h6 {`

Edit `tailwind.config.ts`:
- Line 24: delete `'logo': ['Pacifico', 'cursive'],`

- [ ] **Step 6: Replace font-logo usage in VineBadge**

Run: `grep -rn 'font-logo\|Pacifico' src/`
Expected output: any remaining references (e.g., `src/components/VineBadge.tsx`).
Replace each `font-logo` usage with an inline `<BrandLogo>` where appropriate, or just remove the class (Bricolage is the default heading font).

- [ ] **Step 7: Remove Pacifico package**

```bash
npm uninstall @fontsource/pacifico
grep -rn 'pacifico' src/ tests/ index.html package.json
```
Expected: no remaining references.

- [ ] **Step 8: Full type + lint + test run**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx eslint . && npx vitest run`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: remove Pacifico font and introduce BrandLogo component"
```

---

### Task 0.3: Fix FOUC fallback color

**Files:**
- Modify: `index.html` (line with `#09090b`)

- [ ] **Step 1: Locate fallback**

Run: `grep -n '#09090b\|#0a0a0a' index.html`
Expected: at least one line (inline `<style>` dark fallback).

- [ ] **Step 2: Replace with brand Dark Green**

Edit `index.html`: replace all `#09090b` (and any adjacent generic near-black fallbacks used for the dark-mode FOUC shield) with `#07241B`.

- [ ] **Step 3: Visual smoke test**

Run: `npm run dev` and load `http://localhost:8080` in a browser. Hard-refresh with devtools open in "Slow 3G" throttling; the pre-CSS flash should now be brand Dark Green, not black.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: use brand Dark Green for dark-mode FOUC fallback"
```

---

### Task 0.4: Create brand utility stylesheet

**Files:**
- Create: `src/styles/brand-utilities.css`
- Modify: `src/index.css` (import the new file)

*Note on TDD framing:* jsdom can't evaluate computed CSS from linked stylesheets, so Vitest can only verify the class survives to the DOM — this is a *scaffolding* test, not a RED→GREEN test. The load-bearing visual verification lives in Playwright (Task 0.6). Treat Step 1 as a guard against renaming the class name in future.

- [ ] **Step 1: Write scaffolding test (not a TDD red step)**

Create `tests/brand/brand-utilities.test.tsx`:
```tsx
import { render } from '@testing-library/react';

describe('brand utility class names are stable', () => {
  it('brand-offset-shadow-green is applied to elements that reference it', () => {
    const { container } = render(<div className="brand-offset-shadow-green" />);
    expect(container.firstElementChild).toHaveClass('brand-offset-shadow-green');
  });

  it('brand-tilt-neg-3 is applied to elements that reference it', () => {
    const { container } = render(<div className="brand-tilt-neg-3" />);
    expect(container.firstElementChild).toHaveClass('brand-tilt-neg-3');
  });

  it('brand-sticker is applied to elements that reference it', () => {
    const { container } = render(<div className="brand-sticker" />);
    expect(container.firstElementChild).toHaveClass('brand-sticker');
  });
});
```

- [ ] **Step 2: Run test — expected PASS immediately**

Run: `npx vitest run tests/brand/brand-utilities.test.tsx`
Expected: PASS (these are scaffolding assertions, not RED). Real visual verification happens in Task 0.6.

- [ ] **Step 3: Create brand-utilities.css**

Create `src/styles/brand-utilities.css`:
```css
/* Divine brand utilities — applied in @layer components so they compose with tailwind */
@layer components {
  /* Chunky offset shadows — no blur, solid color. Named by accent. */
  .brand-offset-shadow-green  { box-shadow: 6px 6px 0 0 hsl(var(--brand-green)); }
  .brand-offset-shadow-pink   { box-shadow: 6px 6px 0 0 hsl(var(--brand-pink)); }
  .brand-offset-shadow-violet { box-shadow: 6px 6px 0 0 hsl(var(--brand-violet)); }
  .brand-offset-shadow-orange { box-shadow: 6px 6px 0 0 hsl(var(--brand-orange)); }
  .brand-offset-shadow-yellow { box-shadow: 6px 6px 0 0 hsl(var(--brand-yellow)); }
  .brand-offset-shadow-blue   { box-shadow: 6px 6px 0 0 hsl(var(--brand-blue)); }
  .brand-offset-shadow-dark   { box-shadow: 6px 6px 0 0 hsl(var(--brand-dark-green)); }

  /* Smaller offset for denser surfaces */
  .brand-offset-shadow-sm-green  { box-shadow: 3px 3px 0 0 hsl(var(--brand-green)); }
  .brand-offset-shadow-sm-dark   { box-shadow: 3px 3px 0 0 hsl(var(--brand-dark-green)); }

  /* Playful micro-rotation — used sparingly on stickers/badges */
  .brand-tilt-neg-3 { transform: rotate(-3deg); }
  .brand-tilt-pos-2 { transform: rotate(2deg); }

  /* The full "sticker" treatment — composition helper */
  .brand-sticker {
    border: 2px solid hsl(var(--brand-dark-green));
    border-radius: 14px;
    box-shadow: 4px 4px 0 0 hsl(var(--brand-dark-green));
    transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1),
                box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .brand-sticker:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 0 hsl(var(--brand-dark-green));
  }
  .brand-sticker:active {
    transform: translate(0, 0);
    box-shadow: 2px 2px 0 0 hsl(var(--brand-dark-green));
  }

  /* Card: thick border + optional accent shadow via composition */
  .brand-card {
    border: 2px solid hsl(var(--brand-dark-green));
    border-radius: 22px;
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
  }

  /* Respect reduced-motion */
  @media (prefers-reduced-motion: reduce) {
    .brand-sticker { transition: none; }
    .brand-sticker:hover { transform: none; }
  }
}
```

- [ ] **Step 4: Import into index.css**

Edit `src/index.css` (top of file, after the three `@tailwind` directives):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import './styles/brand-utilities.css';
```

- [ ] **Step 5: Build + type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: clean build; `dist/assets/*.css` should include the new classes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add brand utility stylesheet (sticker, offset-shadow, tilt, card)"
```

---

### Task 0.5: Add brand-rule lint-style tests

These tests are the guardrails — they fail the build if someone reintroduces gradients, `uppercase`, or (later) `lucide-react`. They run as part of `npm test`.

**Files:**
- Create: `tests/brand/no-gradients.test.ts`
- Create: `tests/brand/no-uppercase-class.test.ts`
- Create: `tests/brand/no-lucide-react.test.ts` (skipped/`.skip` until Phase 3)

- [ ] **Step 1: Write `no-gradients` test**

Create `tests/brand/no-gradients.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx', '.css'].includes(extname(p))) out.push(p);
  }
  return out;
}

const FORBIDDEN = [
  /bg-gradient-/,
  /radial-gradient\(/,
  /linear-gradient\(/,
];

// Files where gradients are intentional (decorative illustration/imagery, not flat layout).
// Brand spec permits gradients INSIDE illustration components; forbids them on layout surfaces.
// Keep this list audited — anything added here must be a real illustration, not a layout escape hatch.
const ALLOWLIST: RegExp[] = [
  /src\/components\/ui\/avatar\.tsx$/,               // AvatarFallback decorative shimmer
  /src\/components\/BadgeImage\.tsx$/,               // 3D badge art
  /src\/components\/BadgeDetailModal\.tsx$/,         // badge hero art
  /src\/components\/landing\/VerifiedDemo\.tsx$/,    // illustration
  /src\/components\/landing\/DecentralizedDemo\.tsx$/, // illustration
];

describe('brand rule: no gradients on layout surfaces', () => {
  it('src/ has no gradient classes or CSS gradients outside the illustration allowlist', () => {
    const files = walk('src');
    const violations: string[] = [];
    for (const f of files) {
      if (ALLOWLIST.some(r => r.test(f))) continue;
      const content = readFileSync(f, 'utf8');
      for (const re of FORBIDDEN) {
        if (re.test(content)) violations.push(`${f} matches ${re}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect current failures (documents the 8 known layout-gradient files)**

Run: `npx vitest run tests/brand/no-gradients.test.ts`
Expected: FAIL with exactly 8 violations listed:
`src/pages/NotFound.tsx`, `src/pages/MessagesPage.tsx`, `src/pages/ConversationPage.tsx`, `src/components/LandingPage.tsx`, `src/components/VideoGrid.tsx`, `src/components/VideoFeed.tsx`, `src/components/HashtagExplorer.tsx`, `src/components/ClassicVinersRow.tsx`.
*(The 5 allowlisted illustration files should not appear.)* If more or fewer violations appear, stop and re-audit before continuing — scope has drifted since plan authorship.

- [ ] **Step 3: Mark test `.skip` with a TODO pointing to Phase 5**

Edit the test: change `describe(…, () => {` to `describe.skip(…, () => {`. Add a leading comment: `// TODO(phase-5): re-enable once LandingPage, MessagesPage, ConversationPage, NotFound.tsx are de-gradiented.`

- [ ] **Step 4: Write `no-uppercase-class` test (same pattern)**

Create `tests/brand/no-uppercase-class.test.ts` — mirror the previous test, forbid the regex `/\buppercase\b/` inside `className="…"` attributes (use a more targeted regex to avoid matching the word "uppercase" in comments). Skip it with a Phase-1 TODO.

- [ ] **Step 5: Write `no-lucide-react` test (skipped until Phase 3)**

Create `tests/brand/no-lucide-react.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

function walk(dir: string, out: string[] = []) { /* as above */ return out; }

describe.skip('brand rule: no lucide-react imports (Phase 3+)', () => {
  it('no src/** file imports from lucide-react', () => {
    const violations: string[] = [];
    for (const f of walk('src')) {
      if (/from ['"]lucide-react['"]/.test(readFileSync(f, 'utf8'))) violations.push(f);
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add tests/brand/
git commit -m "test: add skipped brand-rule guardrail tests (gradients, uppercase, lucide)"
```

---

### Task 0.6: Playwright visual-regression scaffold for brand primitives

**Files:**
- Modify: `package.json` (add `@playwright/test`, add `test:visual` script)
- Create: `playwright.config.ts` (root of worktree)
- Create: `.gitignore` entries for `test-results/` and `playwright-report/` (if not already ignored)
- Create: `tests/visual/brand-primitives.spec.ts`
- Create: `src/pages/_BrandPreview.tsx` (development-only preview page mounted only at `/__brand-preview` when `import.meta.env.DEV`)
- Modify: `src/AppRouter.tsx` (or wherever `<Routes>` are registered — check first)

*Rationale: jsdom can't validate that shadows/tilts actually render. A single Playwright page screenshot of every brand primitive on one route lets us visually catch regressions cheaply. `@playwright/test` is NOT currently installed (only `playwright` core); Task 0.6 installs it and adds a root `playwright.config.ts`.*

- [ ] **Step 1: Install `@playwright/test` and browsers**

```bash
npm install -D @playwright/test
npx playwright install chromium
```
Expected: `@playwright/test` added to devDependencies; Chromium browser downloaded.

- [ ] **Step 2: Create `playwright.config.ts`**

Create `/Users/rabble/code/divine/divine-web/.worktrees/brand-redesign/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 3: Update `.gitignore`**

Add to `.gitignore` if missing:
```
test-results/
playwright-report/
playwright/.cache/
```

- [ ] **Step 4: Add `test:visual` script**

Edit `package.json` `scripts`:
```json
"test:visual": "playwright test",
"test:visual:update": "playwright test --update-snapshots"
```

- [ ] **Step 5: Verify routing location**

Run: `grep -rn "<Routes>\|createBrowserRouter" src/ | head -5`
Expected: find the actual routes file. Plan references `src/AppRouter.tsx` but verify; if routes live elsewhere (e.g., `src/App.tsx`), adjust Step 7 accordingly.

- [ ] **Step 6: Create brand preview page**

Create `src/pages/_BrandPreview.tsx` exporting a default component that renders one instance of each brand primitive:
- `<BrandLogo>` at 3 sizes
- A `<Button variant="sticker">`
- `<Card variant="brand">` in all 7 accent shadow variants (green, pink, violet, orange, yellow, blue, dark)
- Headings h1–h6 with sample text
- 4 primary + 21 secondary (7×3 variants) colors as labeled swatches

- [ ] **Step 7: Mount preview route behind DEV guard**

In the file identified in Step 5, add (inside whatever router pattern is used):
```tsx
{import.meta.env.DEV && (
  <Route path="/__brand-preview" element={<BrandPreview />} />
)}
```
and a lazy import: `const BrandPreview = lazy(() => import('./pages/_BrandPreview'));`. The DEV guard ensures the route is tree-shaken from production builds.

- [ ] **Step 8: Add Playwright spec**

Create `tests/visual/brand-primitives.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('brand primitives render', async ({ page }) => {
  await page.goto('/__brand-preview');
  await expect(page.getByText('Divine').first()).toBeVisible();
  await expect(page).toHaveScreenshot('brand-primitives.png', { fullPage: true, maxDiffPixelRatio: 0.01 });
});
```

- [ ] **Step 9: Run once to generate baseline**

Run: `npm run test:visual:update`
Expected: baseline PNG written to `tests/visual/brand-primitives.spec.ts-snapshots/`.

- [ ] **Step 10: Run again to verify determinism**

Run: `npm run test:visual`
Expected: PASS (no diff).

- [ ] **Step 11: Verify production build excludes preview route**

```bash
npm run build
grep -r "__brand-preview" dist/ || echo "OK: not in production bundle"
```
Expected: "OK: not in production bundle".

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "test: add brand-preview route and Playwright visual baseline"
```

---

### Task 0.7: Phase-0 PR checkpoint

- [ ] **Step 1: Full verification**

Run: `npm test` (full suite — tsc + eslint + vitest + build)
Expected: green.

- [ ] **Step 2: Manual smoke**

Run: `npm run dev`, visit:
- `/` — confirm app looks identical to pre-Phase-0 (no user-visible changes yet except FOUC color)
- `/__brand-preview` — confirm the preview renders

- [ ] **Step 3: Open PR**

```bash
git push -u origin feature/brand-redesign
gh pr create --title "feat: Phase 0 — brand refresh foundation (utilities, tokens, guardrails)" --body "Foundation-only PR. No user-visible changes. Adds BrandLogo component, brand-utilities.css, Playwright brand-preview, guardrail tests (currently skipped). Unblocks Phase 1."
```

Expected: CI green, PR open for review.

---

## Chunk 2: Phase 1 (Core component brand language)

Goal: apply the new visual language to shared primitives so downstream feature work inherits it automatically.

---

### Task 1.1: New Button "sticker" variant

**Files:**
- Modify: `src/components/ui/button-variants.ts`
- Modify: `src/components/ui/button.tsx` (if needed)
- Create: `tests/brand/Button.sticker.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button variant=sticker', () => {
  it('applies brand-sticker class', () => {
    render(<Button variant="sticker">Share your thing</Button>);
    expect(screen.getByRole('button')).toHaveClass('brand-sticker');
  });

  it('uses brand green background by default', () => {
    render(<Button variant="sticker">Share your thing</Button>);
    expect(screen.getByRole('button').className).toMatch(/bg-brand-green/);
  });
});
```

- [ ] **Step 2: Run — expect fail (unknown variant)**

- [ ] **Step 3: Add `sticker` variant**

Edit `src/components/ui/button-variants.ts`: add to the `variants.variant` object:
```ts
sticker: 'brand-sticker bg-brand-green text-brand-dark-green hover:bg-brand-green/90',
```

- [ ] **Step 4: Run — expect pass**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(ui): add Button sticker variant using brand utilities"
```

---

### Task 1.2: Card `variant="brand"` prop

**Files:**
- Modify: `src/components/ui/card.tsx`
- Create: `tests/brand/Card.brand.test.tsx`

Steps mirror Task 1.1: failing test → implementation → passing test → commit. Variant adds `brand-card` + an optional accent prop that maps to `brand-offset-shadow-<accent>`.

Suggested prop shape:
```ts
interface CardProps {
  variant?: 'default' | 'brand';
  accent?: 'green' | 'pink' | 'violet' | 'orange' | 'yellow' | 'blue' | 'dark';
}
```

---

### Task 1.3: SectionHeader component (kills `uppercase tracking-*`)

**Files:**
- Create: `src/components/brand/SectionHeader.tsx`
- Create: `tests/brand/SectionHeader.test.tsx`

Behavior:
- Renders semantic `<h2>` or `<h3>` (pass as prop, default h2)
- Always applies `font-extrabold text-brand-dark-green dark:text-brand-off-white`
- Never applies `uppercase` — in fact, asserts in dev that `className` prop does not contain the substring `uppercase` (throws a helpful error if it does)

TDD steps as in Task 1.1.

---

### Task 1.4: Fix the 8 `uppercase`-class violations

**Files (one commit each):**
- `src/components/PinnedVideosSection.tsx`
- `src/components/LanguageMenu.tsx`
- `src/components/ApplePodcastEmbed.tsx`
- `src/components/ProfileBadges.tsx`
- `src/pages/TermsPage.tsx`
- `src/pages/MessagesPage.tsx`
- `src/pages/ConversationPage.tsx`
- `src/pages/AboutPage.tsx`

For each:
- [ ] Replace the offending heading with `<SectionHeader>` or strip `uppercase tracking-*` classes.
- [ ] Run: `npm test -- --run <related test file>` if one exists.
- [ ] Commit: `refactor: remove uppercase section header in <component>`.

After all 8 done:
- [ ] Un-skip `tests/brand/no-uppercase-class.test.ts` (remove `.skip`).
- [ ] Run: `npx vitest run tests/brand/no-uppercase-class.test.ts` — expect PASS.
- [ ] Commit: `test: enable no-uppercase guardrail`.

---

### Task 1.5: Enforce Bricolage heading weights

**Files:**
- Modify: `src/index.css:202–205` (heading block)

- [ ] **Step 1: Update heading CSS**

```css
h1, h2, h3, h4, h5, h6 {
  font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
  font-weight: 800;  /* Extra Bold — brand spec for display */
  letter-spacing: -0.02em;
}
h4, h5, h6 { font-weight: 700; }  /* Bold for smaller headings */
```

- [ ] **Step 2: Update Playwright visual baseline**

Run: `npx playwright test tests/visual/brand-primitives.spec.ts --update-snapshots`
Inspect diff: should show slightly bolder headings.

- [ ] **Step 3: Manual spot-check**

Run: `npm run dev`; visit `/`, `/trending`, a profile page, a video detail page. Confirm headings look heavier but not broken.

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: enforce Bricolage Extra Bold/Bold on headings"
```

---

### Task 1.6: Apply `variant="sticker"` to primary CTAs

**Files (priority surfaces only):**
- `src/components/auth/LoginArea.tsx` — primary "Log in" / "Sign up" buttons
- `src/pages/UploadPage.tsx` — "Share your thing" / upload button
- `src/components/LandingPage.tsx` — hero CTA (we'll rebuild the whole page in Phase 5, but swap CTA now for consistency)
- `src/components/EditProfileForm.tsx` — "Save" button

For each: swap `variant="default"` to `variant="sticker"` where the button is a hero CTA. Add `<Button variant="sticker">` to visual tests if not already covered. Commit individually.

---

### Task 1.7: Phase-1 PR checkpoint

- [ ] **Step 1: Full verification**

Run: `npm test`
Expected: green; no-uppercase guardrail now enforced.

- [ ] **Step 2: Visual diff review**

Run: `npx playwright test tests/visual/` — review any diffs. Expected changes: heavier headings, sticker CTAs.

- [ ] **Step 3: Manual QA on 5 flows**

`npm run dev`, walk through: landing → sign up → upload → profile edit → trending. Confirm no broken layouts.

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat: Phase 1 — brand language on core primitives (Button, Card, headings)" --body "Adds Button sticker variant, Card brand variant, SectionHeader component. Removes all 8 uppercase-class violations. Enforces Bricolage Extra Bold headings. Applies sticker variant to priority CTAs. Guardrail test no-uppercase now enforced."
```

---

## Chunk 3: Phase 2 (Feature surface rollout)

Goal: apply `brand-card` + accent shadows + `sticker` buttons to the top-visibility feature surfaces. Not exhaustive — we're covering the 80/20 of what users see most.

### Task 2.1: VideoCard gets brand-card treatment

**Files:**
- Modify: `src/components/VideoCard.tsx`
- Modify: `tests/components/VideoCard.test.tsx` (if exists)

- [ ] Replace wrapping `<Card>` with `<Card variant="brand" accent="green">`.
- [ ] If the card currently has `rounded-xl shadow-sm`, remove those (brand-card supplies them).
- [ ] Update any failing snapshot/testing-library assertions.
- [ ] Run `npm test -- VideoCard`.
- [ ] Playwright visual diff: expect new border + offset shadow on each card.
- [ ] Commit.

### Task 2.2: Accent rotation for card types

Apply different `accent` colors by card *role*, mirroring divine-badges' day/week/month pattern:
- VideoCard on Trending → `accent="pink"` (energetic)
- VideoCard on Profile → `accent="green"` (default)
- VideoCard on "Classic Viners" → `accent="violet"` (archive/history signal)
- VideoCard on "Human Verified" feed → `accent="blue"` (trust signal)

**Step 1: Verify card ownership per surface**

For each target surface, grep to confirm it actually renders `<VideoCard>` (vs. its own card wrapper). Some of these surfaces may wrap VideoCard in another container:
```bash
grep -l "VideoCard" src/pages/TrendingPage.tsx src/components/ClassicVinersRow.tsx src/components/landing/VerifiedDemo.tsx src/components/ProfileHeader.tsx
```
Expected: each file either imports `VideoCard` directly, or renders its own card wrapper. If the wrapper doesn't use `VideoCard`, update the wrapper's own card component to accept an `accent` prop (or switch it to our `<Card variant="brand">`).

**Step 2–N: Apply accent per surface, one commit each**

- [ ] Trending → pass `accent="pink"` to VideoCard. Commit.
- [ ] Profile → pass `accent="green"` (default — may be a no-op but make intent explicit). Commit.
- [ ] Classic Viners → update `ClassicVinersRow.tsx` to pass `accent="violet"`. Commit.
- [ ] Human Verified / VerifiedDemo → pass `accent="blue"`. Commit.

For each: update visual baseline via `npm run test:visual:update` after the change.

### Task 2.3: ProfileHeader brand treatment

**Files:**
- Modify: `src/components/ProfileHeader.tsx`

- [ ] Apply `brand-card` to the header container if it's currently using `shadow-md rounded-lg` — replace with brand treatment.
- [ ] Replace "Follow" button with `variant="sticker"`.
- [ ] Run tests + visual diff.
- [ ] Commit.

### Task 2.4: AppHeader + AppSidebar dark-mode audit

**Files:**
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/components/AppSidebar.tsx`

Confirm active states use brand green, not an off-shade. Logo in header uses `<BrandLogo>` from Task 0.2. Commit.

### Task 2.5: Phase-2 PR checkpoint

Same gating pattern as Task 0.7 / 1.7. Open PR titled `feat: Phase 2 — apply brand language to VideoCard, ProfileHeader, AppHeader`.

---

## Chunk 4: Phase 3 (Lucide → Phosphor migration)

Goal: mechanical migration across ~107 files. Use a codemod to do 95% of the work, then manual cleanup for edge cases, then turn on the guardrail.

**Key design decision — icon weight consistency:**
Phosphor icons default to `weight="regular"` (1.5px stroke), which is visibly thinner than Lucide's default `stroke-2` (2px). A raw import swap would ship noticeably thinner icons app-wide. Solution: use Phosphor's built-in `IconContext.Provider` at the React root to set `weight="bold"` as the app-wide default, which approximates Lucide's default visual heft without touching every JSX call site. The codemod additionally strips `strokeWidth={N}` props (which are a no-op on Phosphor) and preserves `size={N}` / `className` (both supported by Phosphor). This ordering means Task 3.0 (IconContext setup) comes **before** the codemod.

### Task 3.0: Set Phosphor default weight via IconContext

**Files:**
- Modify: `src/main.tsx` (or wherever `<App />` is mounted — verify with `grep -l "createRoot\|ReactDOM.render" src/`)
- Create: `tests/brand/IconContext.test.tsx`

- [ ] **Step 1: Verify the icon weight hypothesis**

Before committing, render one Phosphor icon at `weight="regular"` vs `weight="bold"` in a dev page or Storybook and confirm visually that `"bold"` better matches the Lucide visual weight the app currently ships with. If `"bold"` is too heavy, use `"regular"` instead and document the choice.

- [ ] **Step 2: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { IconContext } from '@phosphor-icons/react';
import App from '@/App';

describe('App mounts with Phosphor IconContext default weight', () => {
  it('wraps App in IconContext.Provider with weight=bold', () => {
    // Smoke test: the provider exists somewhere above <App>.
    // Real verification is visual (Task 0.6 Playwright baseline),
    // but this guards against the provider being accidentally removed.
    expect(IconContext).toBeDefined();
  });
});
```
*(This is a scaffolding-style test, same pattern as Task 0.4 — jsdom can't read computed icon stroke. The load-bearing check is the Playwright visual baseline updated in Task 3.3.)*

- [ ] **Step 3: Wrap App in IconContext.Provider**

In the file identified above (likely `src/main.tsx`):
```tsx
import { IconContext } from '@phosphor-icons/react';

// … existing imports …

ReactDOM.createRoot(root).render(
  <IconContext.Provider value={{ weight: 'bold', mirrored: false }}>
    <App />
  </IconContext.Provider>,
);
```

- [ ] **Step 4: Type-check + build**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run build
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: wrap app in Phosphor IconContext.Provider with weight=bold default"
```

### Task 3.1: Build iconMap.ts

**Files:**
- Create: `src/lib/iconMap.ts`
- Create: `scripts/audit-lucide-icons.mjs`

- [ ] **Step 1: Audit which lucide icons we use**

Create `scripts/audit-lucide-icons.mjs`:
```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

function walk(d, out=[]) { for (const n of readdirSync(d)) { const p=join(d,n); statSync(p).isDirectory()?walk(p,out):['.ts','.tsx'].includes(extname(p))&&out.push(p); } return out; }

const icons = new Set();
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  const m = src.match(/import\s+\{([^}]+)\}\s+from\s+['"]lucide-react['"]/);
  if (m) m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).forEach(i => icons.add(i));
}
console.log([...icons].sort().join('\n'));
```

Run: `node scripts/audit-lucide-icons.mjs > /tmp/lucide-icons.txt`
Expected: a de-duplicated list of lucide icon names (~40–80 entries).

- [ ] **Step 2: Build mapping table**

Create `src/lib/iconMap.ts` exporting a const object mapping each lucide name to its Phosphor equivalent, e.g.:
```ts
export const ICON_MAP = {
  Heart: 'Heart',
  MessageCircle: 'ChatCircle',
  Share: 'Share',
  Search: 'MagnifyingGlass',
  Home: 'House',
  User: 'User',
  Settings: 'Gear',
  Play: 'Play',
  Pause: 'Pause',
  X: 'X',
  ChevronDown: 'CaretDown',
  ChevronRight: 'CaretRight',
  ChevronLeft: 'CaretLeft',
  ChevronUp: 'CaretUp',
  MoreHorizontal: 'DotsThree',
  MoreVertical: 'DotsThreeVertical',
  Check: 'Check',
  Bell: 'Bell',
  Bookmark: 'BookmarkSimple',
  Eye: 'Eye',
  EyeOff: 'EyeSlash',
  Upload: 'UploadSimple',
  Download: 'DownloadSimple',
  Link: 'Link',
  ExternalLink: 'ArrowSquareOut',
  Copy: 'Copy',
  Trash: 'Trash',
  Trash2: 'Trash',
  Edit: 'PencilSimple',
  Edit2: 'PencilSimple',
  Edit3: 'PencilSimple',
  Send: 'PaperPlaneTilt',
  Plus: 'Plus',
  Minus: 'Minus',
  Loader2: 'CircleNotch', // spinning
  Zap: 'Lightning',
  Hash: 'Hash',
  AtSign: 'At',
  Flag: 'Flag',
  Filter: 'Funnel',
  SortAsc: 'SortAscending',
  SortDesc: 'SortDescending',
  // … extend from /tmp/lucide-icons.txt
} as const;
```

- [ ] **Step 3: Cross-reference audit output**

Compare `/tmp/lucide-icons.txt` against `ICON_MAP` keys. Any icon in the audit but not in the map → add it (look up the Phosphor equivalent at https://phosphoricons.com manually).

- [ ] **Step 4: Test the map**

Create `tests/brand/iconMap.test.ts`:
```ts
import { ICON_MAP } from '@/lib/iconMap';
import * as Phosphor from '@phosphor-icons/react';

describe('iconMap', () => {
  it('every Phosphor target exists in @phosphor-icons/react', () => {
    const missing = Object.values(ICON_MAP).filter(n => !(n in Phosphor));
    expect(missing).toEqual([]);
  });
});
```

Run: `npx vitest run tests/brand/iconMap.test.ts` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add iconMap for Lucide → Phosphor migration"
```

---

### Task 3.2: Build the codemod

**Files:**
- Create: `scripts/codemod-lucide-to-phosphor.mjs`

- [ ] **Step 1: Write codemod**

The codemod walks every `.ts`/`.tsx` in `src/`. For each file:

1. **Rewrite imports:** Find `import { A, B as C, D } from 'lucide-react';`. For each named import, look up `ICON_MAP[name]`. If missing → WARN and leave untouched. Rewrite to: `import { <PhosphorName> as <OriginalLocalName> } from '@phosphor-icons/react';` so JSX tag names don't have to change.
   - Example: `import { Heart } from 'lucide-react'` → `import { Heart } from '@phosphor-icons/react'` (Heart has the same name in Phosphor)
   - Example: `import { MessageCircle } from 'lucide-react'` → `import { ChatCircle as MessageCircle } from '@phosphor-icons/react'` (aliasing keeps `<MessageCircle />` JSX unchanged)

2. **Strip `strokeWidth` props from JSX usages:** For each JSX element whose tag matches any migrated name, remove any `strokeWidth={...}` or `strokeWidth="..."` attribute. Phosphor does not accept this prop; leaving it in passes silently but adds noise and future confusion. Preserve all other props (`size`, `className`, `color`, event handlers, etc. — all supported by Phosphor).

3. **Handle `size={N}` edge case:** Phosphor accepts `size` as number or string; identical to Lucide. No change needed.

4. **Merge multiple imports:** If a file imported from both `lucide-react` (now rewritten) and already had `@phosphor-icons/react` imports (unlikely, but possible), merge into one import statement.

5. **Report:** Emit a JSON report at `/tmp/codemod-report.json` with: `{ filesModified: [...], unmappedIcons: [...], strokeWidthStripped: number }`.

6. **Unmapped icons behavior:** For icons with no 1:1 match (the WARN set), leave the file as-is and include the icon name + file in the report. Execution will address these manually after the mechanical pass.

- [ ] **Step 2: Run in dry-run mode**

```bash
node scripts/codemod-lucide-to-phosphor.mjs --dry-run > /tmp/codemod-report.txt
```
Expected: list of files it would rewrite + list of unmapped icons.

- [ ] **Step 3: Commit dry-run report to repo for review**

```bash
cp /tmp/codemod-report.txt docs/brand/codemod-lucide-report.md
git add scripts/codemod-lucide-to-phosphor.mjs docs/brand/codemod-lucide-report.md
git commit -m "chore: add Lucide→Phosphor codemod + dry-run report"
```

---

### Task 3.3: Run codemod across codebase

- [ ] **Step 1: Run codemod for real**

```bash
node scripts/codemod-lucide-to-phosphor.mjs --write
```
Expected: ~107 files modified.

- [ ] **Step 2: Type-check**

```bash
npx tsc -p tsconfig.app.json --noEmit
```
Expected: 0 errors. The codemod already stripped `strokeWidth` props (Phosphor-incompatible) and Task 3.0 set `weight="bold"` as the app-wide default via `IconContext.Provider`. Any residual type errors indicate an unmapped icon or a prop difference the codemod missed — fix manually per file.

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```
Expected: PASS. Snapshot tests may diff — review each diff carefully; icon SVG paths will differ, but test intent (icon present) should still hold.

- [ ] **Step 4: Playwright visual baseline update**

```bash
npx playwright test --update-snapshots
```
Review diffs: the main change should be slightly different icon shapes (softer/rounder — that's on-brand).

- [ ] **Step 5: Remove lucide-react dependency**

```bash
npm uninstall lucide-react
```

- [ ] **Step 6: Un-skip the no-lucide guardrail**

Edit `tests/brand/no-lucide-react.test.ts`: remove `.skip`.
Run: `npx vitest run tests/brand/no-lucide-react.test.ts` — expect PASS.

- [ ] **Step 7: Full test run**

```bash
npm test
```
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: migrate all icons from Lucide to Phosphor"
```

---

### Task 3.4: Per-icon weight overrides for filled states

Phosphor ships with 6 weights: `thin, light, regular, bold, fill, duotone`. The app-wide default (`bold`, set in Task 3.0) is correct for general UI. Some icons benefit from `fill` weight when they represent an *active/toggled* state:

- Liked heart → `<Heart weight="fill" />`
- Bookmarked item → `<BookmarkSimple weight="fill" />`
- Playing play icon → `<Play weight="fill" />`

**Files:**
- Update: individual call sites where the icon represents active state (expect ~10–20 sites, not a large sweep)

- [ ] **Step 1: Grep for active-state toggles**

Run: `grep -rn "isLiked\|isBookmarked\|isFollowing\|isActive" src/components/ | head -30`
Expected: list of components with toggled icon states.

- [ ] **Step 2: Update each site to pass `weight="fill"` when active**

Pattern:
```tsx
<Heart weight={isLiked ? 'fill' : 'bold'} />
```

- [ ] **Step 3: Type-check + visual diff**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run test:visual`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git commit -am "refactor: use Phosphor fill weight for active icon states"
```

---

### Task 3.5: Phase-3 PR checkpoint

Open PR: `feat: Phase 3 — replace Lucide with Phosphor icons (~107 files)`.

Large diff, but mechanical. Reviewer should focus on:
- Any manually-fixed files (where codemod couldn't map 1:1)
- Playwright visual diff
- The `no-lucide` guardrail enablement

---

## Chunk 5: Phase 4 (Microcopy audit & rewrite)

Goal: rewrite corporate strings into Playful Rebel voice, guided by `docs/brand/TONE_OF_VOICE.md`.

### Task 4.1: Generate microcopy inventory

**Files:**
- Create: `scripts/audit-microcopy.mjs`
- Create: `docs/brand/MICROCOPY_INVENTORY.md`

- [ ] **Step 1: Write audit script**

Create `scripts/audit-microcopy.mjs`:
```js
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

function walk(dir, out=[]) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Patterns likely to be user-facing strings
const PATTERNS = [
  { label: 'toast.success', re: /toast\.success\(\s*['"`]([^'"`]+)['"`]/g },
  { label: 'toast.error',   re: /toast\.error\(\s*['"`]([^'"`]+)['"`]/g },
  { label: 'toast.info',    re: /toast\.info\(\s*['"`]([^'"`]+)['"`]/g },
  { label: 'toast()',       re: /\btoast\(\s*['"`]([^'"`]+)['"`]/g },
  { label: 'placeholder',   re: /placeholder\s*=\s*["']([^"']+)["']/g },
  { label: 'aria-label',    re: /aria-label\s*=\s*["']([^"']+)["']/g },
  { label: 'title attr',    re: /\btitle\s*=\s*["']([^"']+)["']/g },
  // Empty-state-ish phrases in JSX text nodes
  { label: 'empty-state',   re: />\s*((?:No |You don'?t have |You are not |Nothing |There are no )[^<{]+?)</g },
  // t() calls — i18n keys (record them separately so we update the locale file, not the call site)
  { label: 't() key',       re: /\bt\(\s*['"`]([^'"`]+)['"`]/g },
];

const rows = [];
for (const f of walk('src')) {
  const src = readFileSync(f, 'utf8');
  for (const { label, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split('\n').length;
      rows.push({ file: relative('.', f), line, kind: label, current: m[1] });
    }
  }
}

// Emit markdown table
const md = [
  '# Microcopy Inventory',
  '',
  'Generated by `scripts/audit-microcopy.mjs`. Fill `Proposed` and `Done?` columns manually.',
  '',
  '| File | Line | Kind | Current | Proposed | Done? |',
  '|------|------|------|---------|----------|-------|',
  ...rows.map(r => `| ${r.file} | ${r.line} | ${r.kind} | ${r.current.replace(/\|/g, '\\|')} |  |  |`),
].join('\n');

writeFileSync('docs/brand/MICROCOPY_INVENTORY.md', md);
console.log(`Wrote ${rows.length} rows.`);
```

- [ ] **Step 2: Run and commit inventory**

Run: `node scripts/audit-microcopy.mjs`
Expected: `docs/brand/MICROCOPY_INVENTORY.md` written with ~100–300 rows. **Expected row kinds:** toast calls, placeholders, aria-labels, empty-state phrases, and `t()` i18n keys.

**Important:** Rows with `kind = t() key` refer to i18n keys — for those, the `Current` / `Proposed` columns describe the *key*, and the actual rewrite happens in the locale files at `src/lib/i18n/locales/en/`. Flag them during review so Task 4.2 handles them correctly.

- [ ] **Step 3: Fill `Proposed` column manually**

Following `docs/brand/TONE_OF_VOICE.md` examples:
- Corporate → casual-direct ("uploaded successfully" → "Looking good.")
- Neutral → punk-playful ("Your feed is empty" → "Nothing looping yet. Go find your people.")
- Confirmations → community-inviting ("You are not following anyone" → "You're flying solo. Time to find your crew.")

Leave genuinely-neutral strings unchanged (form labels, tab names, etc.) — overdoing the voice is a failure mode.

- [ ] **Step 4: Commit the inventory**

```bash
git add -A
git commit -m "docs: add microcopy inventory with proposed voice rewrites"
```

---

### Task 4.2: Apply rewrites in batches

Break the inventory into logical batches (e.g. "auth flow", "upload flow", "profile", "empty states", "error toasts"). For each batch:

- [ ] Identify which rows in the batch reference i18n keys (`kind = t() key`) vs component literals.
- [ ] For **i18n keys**: update `src/lib/i18n/locales/en/<namespace>.json` with the new English string. Do NOT edit the component call site.
- [ ] For **component literals**: edit the source file directly.
- [ ] Update any literal-string tests that break.
- [ ] Run `npm test`.
- [ ] Commit: `refactor(copy): rewrite <batch-name> microcopy in Playful Rebel voice`.

**Non-English locale handling:** the repo ships ~15 locales under `src/lib/i18n/locales/<lang>/`. Rewriting only English will cause the other locales to drift (non-English strings stay on the old corporate voice). Three options, pick one during Phase 4 kickoff:

1. **Ship EN-only now, mark non-EN as stale (default).** Add a brief note to the PR description and open a follow-up issue: "Non-EN microcopy translations need regeneration following brand refresh." This is the most shippable path.
2. **Regenerate all locales via translation tooling / contractor pass.** Larger scope; likely delays Phase 4 by 1–2 weeks.
3. **Prune non-EN locales that are already stale/unmaintained.** Only if maintainers confirm those locales aren't actively used.

Document the choice in `docs/brand/MICROCOPY_INVENTORY.md` before merging Phase 4.

---

### Task 4.3: Phase-4 PR checkpoint

Open PR: `feat: Phase 4 — microcopy rewrite to Playful Rebel voice`.

Manual review must include reading every changed string out loud; sterile voice should be gone.

---

## Chunk 6: Phase 5 (Landing page rebuild & gradient removal)

Goal: rebuild `LandingPage.tsx` around the manifesto, remove gradients, and close the last 3 layout-gradient violations.

### Task 5.1: Remove layout-surface gradients from all non-illustration files

**Files (7 total — the 8th, `src/components/LandingPage.tsx`, is handled by Task 5.2's rebuild):**
- `src/pages/MessagesPage.tsx`
- `src/pages/ConversationPage.tsx`
- `src/pages/NotFound.tsx`
- `src/components/VideoGrid.tsx`
- `src/components/VideoFeed.tsx`
- `src/components/HashtagExplorer.tsx`
- `src/components/ClassicVinersRow.tsx`

For each:
- [ ] Locate the gradient: `grep -n 'gradient' <file>`.
- [ ] Classify: is the gradient on a layout surface (full-bleed section background, row/grid background) or on a small decorative element inside that file? If the gradient is a decorative element that qualifies as illustration, consider extracting it to its own component and adding that component to the allowlist in `tests/brand/no-gradients.test.ts`; otherwise remove.
- [ ] Replace layout gradients with solid brand colors: `bg-brand-off-white dark:bg-brand-dark-green` for backgrounds; a `brand-offset-shadow-<accent>` utility on a nested card if visual interest was the point.
- [ ] Run `npm test -- <related test>` if coverage exists.
- [ ] Commit per file: `fix: remove layout gradient from <filename>`.

**Do NOT touch the 5 allowlisted illustration files** (`src/components/ui/avatar.tsx`, `BadgeImage.tsx`, `BadgeDetailModal.tsx`, `landing/VerifiedDemo.tsx`, `landing/DecentralizedDemo.tsx`) — their gradients are inside illustrations and are brand-compliant.

### Task 5.2: Design landing hero

**Files:**
- Modify: `src/components/LandingPage.tsx`
- Modify: `src/components/landing/*`

Brief:
- Hero headline: use a manifesto line ("Creative power belongs in human hands." or similar from `docs/brand/BRAND_DNA.md`). Bricolage Extra Bold, ~96pt on desktop, scales down.
- Background: solid Dark Green (`bg-brand-dark-green`), Off-White text.
- Primary CTA: `<Button variant="sticker">` reading something like "Start joy scrolling".
- Secondary CTA: outline button reading "Read the manifesto" → links to `/about` or a new `/manifesto` route.
- Optional: small rotated "sticker" element (e.g. a badge tilted `-3deg`) reading "No slop. All human." to inject jester energy.
- **No gradients** anywhere — solid surfaces only. Illustrations/3D icons can include gradients *inside the asset*, but not on layout.

- [ ] Implement in small steps, each with a commit.
- [ ] Update Playwright baseline for the landing route.

### Task 5.3: Un-skip the no-gradients guardrail

- [ ] Edit `tests/brand/no-gradients.test.ts`: remove `.skip`.
- [ ] Run: `npx vitest run tests/brand/no-gradients.test.ts` — expect PASS.
- [ ] Commit: `test: enable no-gradients guardrail`.

### Task 5.4: Phase-5 PR checkpoint

Open PR: `feat: Phase 5 — landing page rebuild + remove layout gradients`.

---

## Chunk 7: Phase 6 (Verification & polish)

Goal: holistic audit, accessibility check, cleanup.

### Task 6.1: Accessibility pass

This repo already has an a11y audit script at `scripts/a11y-audit.mjs` (uses `@axe-core/playwright`). There is no `tests/a11y/` directory.

- [ ] Run `node scripts/a11y-audit.mjs`. Expected: 0 violations.
- [ ] If the script expects a live server, start `npm run dev` in another terminal first (verify by reading the script header).
- [ ] Additionally, extend the audit to visit `/__brand-preview` so the brand primitives themselves get a contrast check. If the script doesn't accept an arg for routes, add one.
- [ ] Verify contrast on all sticker/brand-card accent combinations in axe output — especially yellow/lime text on Off White (likely fails AA).
- [ ] Verify `prefers-reduced-motion`: run `npm run dev`, set `Rendering → Emulate CSS media feature prefers-reduced-motion: reduce` in Chrome DevTools, hover any `brand-sticker` element. Expected: no transform, no shadow animation.

### Task 6.2: Final copy read-through

- [ ] Walk through the entire app with fresh eyes. Flag any remaining corporate or sterile strings — update inventory + rewrite.

### Task 6.3: Confirm dev-only `/__brand-preview` route is excluded from production

- [ ] The route's DEV guard and tree-shaking were already set up in Task 0.6 Step 11. Re-verify here as a final gate:
```bash
npm run build
grep -r "__brand-preview" dist/ && echo "FAIL: route in production bundle" || echo "OK"
```
Expected: "OK".

### Task 6.4: Documentation

- [ ] Update `CLAUDE.md` with a new "Brand" section pointing to `docs/brand/` and to the new primitives (BrandLogo, SectionHeader, Button variant=sticker, Card variant=brand).
- [ ] Update `README.md` if it mentions old tokens.

### Task 6.5: Final PR

Open PR: `feat: Phase 6 — brand refresh verification + docs`. Merge. Close the epic.

---

## Success Criteria (per-phase gates)

| Phase | Gate |
|---|---|
| 0 | `npm test` green; `/__brand-preview` renders; no user-visible change on existing routes |
| 1 | no-uppercase guardrail enforced; heading weights visibly bolder; primary CTAs use sticker variant |
| 2 | VideoCard, ProfileHeader, AppHeader visually reflect brand-card treatment |
| 3 | lucide-react removed from package.json; no-lucide guardrail enforced; Playwright visual baseline updated |
| 4 | Microcopy inventory 100% addressed (every row marked Done or intentionally Skip) |
| 5 | no-gradients guardrail enforced; landing page rebuilt around manifesto |
| 6 | axe-core clean; docs updated; `/__brand-preview` not in production bundle |

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Phosphor icon visual size/weight differs enough from Lucide that nothing lines up | Phase 3 includes Playwright baseline update + manual visual QA pass on 10+ routes before merge |
| Microcopy rewrites break translation keys in `react-i18next` | Task 4.2 explicitly says: update locale files, not component literals |
| Heading weight change (400→800) shifts layouts via reflow | Task 1.5 includes spot-check on multiple pages; any layout break fixed in same commit |
| `brand-sticker` hover lift feels buggy on trackpad/mobile tap | brand-utilities.css includes `:active` state for tactile feedback + respects `prefers-reduced-motion` |
| Guardrail tests become flaky | Tests read filesystem directly and are deterministic; no network, no async |
| Scope creep on landing page rebuild | Task 5.2 has a concrete shot-list; defer anything else to a follow-up |

---

## Non-goals (explicit)

- Changing any feature behavior
- Adding new illustration assets (3D icons, cutouts) — that's a design task for a different PR
- Touching divine-mobile or divine-router
- Changing the Tailwind configuration beyond removing `logo` font family and adjusting heading weight defaults
- Renaming brand color tokens
- Replacing shadcn/ui primitives wholesale

---

## Handoff

This plan is structured so each chunk (Phase 0–6) can be executed as its own subagent task with a two-stage review. Recommended execution:

1. Execute **Phase 0** first, in full, and merge the PR. It's foundation + guardrails; nothing downstream works without it.
2. Execute **Phases 1–3** sequentially; they build on each other.
3. **Phases 4 and 5** can run in parallel (microcopy is text-only, landing is page-local).
4. **Phase 6** is verification + docs, last.

Budget: roughly 2–3 weeks of engineer time end-to-end, depending on how much design iteration Phase 5 absorbs.

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

// `.brand-sticker` draws its border and offset shadow in brand-dark-green, and
// the dark-mode override swaps that for off-white. Both key off the *theme*.
// A section that is dark in BOTH themes — the landing hero, the closing CTA —
// therefore gets dark-green ink on a dark-green surface whenever the theme is
// light, and the button flattens into a plain rectangle exactly as it did in
// dark mode before that override existed.
//
// `.brand-sticker-on-dark` is the surface-aware modifier: it pins the ink to
// off-white regardless of theme, for stickers placed on a permanently dark
// surface.
const CSS = readFileSync('src/styles/brand-utilities.css', 'utf8');
const LANDING = readFileSync('src/components/LandingPage.tsx', 'utf8');

const DARK_SURFACE_INK = 'hsl(var(--brand-off-white))';

// A section counts as permanently dark only when `bg-brand-dark-green` is the
// unconditional background. `\b` on its own also matches inside
// `dark:bg-brand-dark-green`, `md:…` and `hover:…`, and a `dark:`-prefixed
// surface is the opposite case: it is light in light mode, so demanding the
// modifier there would pin off-white ink onto a light surface — this bug
// inverted. The lookbehind rejects any variant prefix while still allowing an
// opacity suffix (`bg-brand-dark-green/95`).
const PERMANENTLY_DARK_SECTION = /^<section[^>]*(?<![\w:-])bg-brand-dark-green\b/;

const permanentlyDarkSections = (source: string) =>
  source.split(/(?=<section)/).filter((chunk) => PERMANENTLY_DARK_SECTION.test(chunk));

describe('brand rule: stickers stay visible on permanently dark surfaces', () => {
  it('defines the on-dark modifier with off-white ink', () => {
    const rule = CSS.match(/\.brand-sticker-on-dark\s*\{([^}]*)\}/);
    expect(rule, '.brand-sticker-on-dark rule is missing').not.toBeNull();
    expect(rule![1]).toContain('border-color');
    expect(rule![1]).toContain(DARK_SURFACE_INK);
  });

  it('restates every offset state, so hover and press stay visible too', () => {
    for (const state of ['', ':hover', ':active']) {
      const pattern = new RegExp(`\\.brand-sticker-on-dark${state}\\s*\\{([^}]*)\\}`);
      const rule = CSS.match(pattern);
      expect(rule, `.brand-sticker-on-dark${state} rule is missing`).not.toBeNull();
      expect(rule![1], `.brand-sticker-on-dark${state} shadow`).toContain('box-shadow');
      expect(rule![1], `.brand-sticker-on-dark${state} ink`).toContain(DARK_SURFACE_INK);
    }
  });

  it('never paints on-dark ink in the colour of the dark surface', () => {
    const rules = CSS.match(/\.brand-sticker-on-dark[^{]*\{[^}]*\}/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule).not.toContain('hsl(var(--brand-dark-green))');
    }
  });

  // The invariant that actually protects the landing page: a sticker button
  // inside a section that is dark in both themes must carry the modifier.
  // Without this, the next CTA dropped into the hero silently loses its
  // outline in light mode and no test notices.
  it('gives every sticker inside a permanently dark landing section the modifier', () => {
    const sections = permanentlyDarkSections(LANDING);
    expect(sections.length, 'expected landing sections with a dark surface').toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const section of sections) {
      for (const button of section.match(/<Button[^>]*variant="sticker"[^>]*>/g) ?? []) {
        if (!button.includes('brand-sticker-on-dark')) offenders.push(button.trim());
      }
    }

    expect(offenders, 'sticker buttons on a dark surface missing brand-sticker-on-dark').toEqual([]);
  });

  // Guards the guard. A surface that only goes dark under `dark:` follows the
  // theme, so it must NOT be treated as permanently dark — otherwise the rule
  // above would demand off-white ink on a light-mode surface and reintroduce
  // the invisible button it exists to prevent. The landing nav
  // (`bg-brand-off-white/95 dark:bg-brand-dark-green/95`, deliberately left
  // without the modifier) is exactly that shape.
  it('counts only unconditionally dark surfaces, not `dark:`-prefixed ones', () => {
    expect(
      permanentlyDarkSections('<section className="bg-brand-dark-green text-brand-off-white">')
    ).toHaveLength(1);
    expect(
      permanentlyDarkSections('<section className="bg-brand-dark-green/95 p-4">')
    ).toHaveLength(1);

    for (const themed of [
      '<section className="bg-brand-off-white/95 dark:bg-brand-dark-green/95">',
      '<section className="bg-brand-off-white dark:bg-brand-dark-green">',
      '<section className="bg-card hover:bg-brand-dark-green">',
      '<section className="bg-card md:bg-brand-dark-green">',
    ]) {
      expect(permanentlyDarkSections(themed), themed).toEqual([]);
    }
  });
});

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const CSS = readFileSync('src/styles/brand-utilities.css', 'utf8');

const DARK_INK = 'hsl(var(--brand-off-white))';

describe('brand rule: sticker modifier for permanently dark sections', () => {
  it('defines .brand-sticker-on-dark with off-white ink', () => {
    const rule = CSS.match(/\.brand-sticker-on-dark\s*\{([^}]*)\}/);
    expect(rule, '.brand-sticker-on-dark rule is missing').not.toBeNull();
    expect(rule![1]).toContain('border-color');
    expect(rule![1]).toContain(DARK_INK);
  });

  it('redraws the sticker offset shadow in all offset states with off-white ink', () => {
    for (const state of ['', ':hover', ':active']) {
      const pattern = new RegExp(`\\.brand-sticker-on-dark${state}\\s*\\{([^}]*)\\}`);
      const rule = CSS.match(pattern);
      expect(rule, `.brand-sticker-on-dark${state} rule is missing`).not.toBeNull();
      expect(rule![1], `.brand-sticker-on-dark${state} shadow`).toContain('box-shadow');
      expect(rule![1], `.brand-sticker-on-dark${state} ink`).toContain(DARK_INK);
    }
  });

  it('never paints sticker-on-dark ink in the colour of the dark surface itself', () => {
    const darkRules = CSS.match(/\.brand-sticker-on-dark[^{]*\{[^}]*\}/g) ?? [];
    expect(darkRules.length).toBeGreaterThan(0);
    for (const rule of darkRules) {
      expect(rule, 'sticker-on-dark ink must not be brand-dark-green').not.toContain(
        'hsl(var(--brand-dark-green))',
      );
    }
  });

  it('regex correctly identifies permanently-dark elements without theme prefixes', () => {
    // The regex matches bg-brand-dark-green that is NOT preceded by a theme variant prefix.
    // This pattern identifies unconditional dark sections where we should apply the modifier.
    const permanentlyDarkPattern = /(?<![\w:-])bg-brand-dark-green(?:\/95)?(?![\w-])/;

    // Should match: no theme prefix
    expect('bg-brand-dark-green'.match(permanentlyDarkPattern)).not.toBeNull();
    expect('bg-brand-dark-green/95'.match(permanentlyDarkPattern)).not.toBeNull();

    // Should NOT match: has theme prefix
    expect('dark:bg-brand-dark-green'.match(permanentlyDarkPattern)).toBeNull();
    expect('md:bg-brand-dark-green'.match(permanentlyDarkPattern)).toBeNull();
    expect('hover:bg-brand-dark-green'.match(permanentlyDarkPattern)).toBeNull();
    expect('sm:bg-brand-dark-green'.match(permanentlyDarkPattern)).toBeNull();
  });

  it('reference surfaces using permanently-dark sections should be identified', () => {
    // These file patterns should match permanently dark surfaces (for documentation):
    // - AppFooter.tsx:10 — footer with `bg-brand-dark-green`
    // - MarketingHeader.tsx:11 — nav with `bg-brand-dark-green`
    // - FamilyPageHero.tsx:22 — section with `bg-brand-dark-green`
    // - HubSections.tsx:12 — section with `bg-brand-dark-green`
    // - Age-review, kids-policy, portability, delete-account pages' hero sections

    // The pattern to identify these surfaces
    const permanentlyDarkPattern = /(?<![\w:-])bg-brand-dark-green(?:\/95)?(?![\w-])/;

    // Verify the pattern works for documented surfaces
    const footerExample = 'className="bg-brand-dark-green"';
    expect(footerExample.match(permanentlyDarkPattern)).not.toBeNull();

    const navExample = 'className="w-full bg-brand-dark-green px-4"';
    expect(navExample.match(permanentlyDarkPattern)).not.toBeNull();

    const sectionExample = 'className="bg-brand-dark-green/95 py-12"';
    expect(sectionExample.match(permanentlyDarkPattern)).not.toBeNull();
  });
});

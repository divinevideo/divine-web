import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

// In dark mode `--background`, `--card`, and the landing page's dark sections
// all resolve to the same `158 67% 8%` as `--brand-dark-green`, which is the
// ink `.brand-sticker` draws its border and offset shadow in. Left alone, both
// render dark-green on dark-green and vanish: the sticker flattens into a plain
// coloured rectangle and loses the treatment entirely. The dark-mode override
// has to restate BOTH the border colour and every offset-shadow state, because
// a rule that fixes only the border leaves a shadow nobody can see.
const CSS = readFileSync('src/styles/brand-utilities.css', 'utf8');

const DARK_INK = 'hsl(var(--brand-off-white))';

describe('brand rule: the sticker keeps its shape in dark mode', () => {
  it('redraws the sticker border in dark mode', () => {
    const rule = CSS.match(/\.dark \.brand-sticker\s*\{([^}]*)\}/);
    expect(rule, '.dark .brand-sticker rule is missing').not.toBeNull();
    expect(rule![1]).toContain('border-color');
    expect(rule![1]).toContain(DARK_INK);
  });

  it('redraws the sticker offset shadow in dark mode, including hover and active', () => {
    for (const state of ['', ':hover', ':active']) {
      const pattern = new RegExp(`\\.dark \\.brand-sticker${state}\\s*\\{([^}]*)\\}`);
      const rule = CSS.match(pattern);
      expect(rule, `.dark .brand-sticker${state} rule is missing`).not.toBeNull();
      expect(rule![1], `.dark .brand-sticker${state} shadow`).toContain('box-shadow');
      expect(rule![1], `.dark .brand-sticker${state} ink`).toContain(DARK_INK);
    }
  });

  it('never paints dark-mode sticker ink in the colour of the dark-mode surface', () => {
    const darkRules = CSS.match(/\.dark \.brand-sticker[^{]*\{[^}]*\}/g) ?? [];
    expect(darkRules.length).toBeGreaterThan(0);
    for (const rule of darkRules) {
      expect(rule, 'dark sticker ink must not be brand-dark-green').not.toContain(
        'hsl(var(--brand-dark-green))',
      );
    }
  });
});

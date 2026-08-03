// ABOUTME: Guardrail — notification type chips must clear WCAG 1.4.11 (3:1) in both themes
// ABOUTME: axe-core only measures text contrast, so an icon-on-tint regression would ship silently

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import colors from 'tailwindcss/colors';

const MIN_RATIO = 3; // WCAG 2.2 SC 1.4.11, non-text contrast

const COMPONENT = resolve(__dirname, 'NotificationRows.tsx');
const THEME_CSS = resolve(__dirname, '../../index.css');

type Rgb = [number, number, number];

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function hexToRgb(hex: string): Rgb {
  const v = hex.replace('#', '');
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ];
}

function composite(foreground: Rgb, alpha: number, background: Rgb): Rgb {
  return foreground.map((f, i) => alpha * f + (1 - alpha) * background[i]) as Rgb;
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Reads `--background` / `--muted` out of the `:root` and `.dark` blocks. */
function readThemeSurfaces(): Record<'light' | 'dark', { background: Rgb; muted: Rgb }> {
  const css = readFileSync(THEME_CSS, 'utf-8');
  const darkIndex = css.indexOf('.dark {');
  expect(darkIndex, 'src/index.css must declare a .dark block').toBeGreaterThan(-1);

  const read = (scope: string, name: string): Rgb => {
    const match = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(scope);
    expect(match, `--${name} must be an HSL triple in src/index.css`).not.toBeNull();
    const [, h, s, l] = match!;
    return hslToRgb(Number(h), Number(s), Number(l));
  };

  return {
    light: {
      background: read(css.slice(0, darkIndex), 'background'),
      muted: read(css.slice(0, darkIndex), 'muted'),
    },
    dark: {
      background: read(css.slice(darkIndex), 'background'),
      muted: read(css.slice(darkIndex), 'muted'),
    },
  };
}

interface Chip {
  tint: Rgb;
  tintAlpha: number;
  light: Rgb;
  dark: Rgb;
}

/**
 * Pulls each chip's tint and its light/dark icon shades straight out of the
 * component, so the assertion tracks the real class names rather than a copy.
 */
function readChips(): Map<string, Chip> {
  const source = readFileSync(COMPONENT, 'utf-8');
  const palette = colors as unknown as Record<string, Record<string, string>>;
  const chips = new Map<string, Chip>();

  const pattern =
    /bg-(\w+)-(\d+)\/(\d+)"[\s\S]{0,200}?className="[^"]*?\btext-(\w+)-(\d+) dark:text-(\w+)-(\d+)\b/g;

  for (const m of source.matchAll(pattern)) {
    const [, tintFamily, tintShade, alpha, lightFamily, lightShade, darkFamily, darkShade] = m;
    chips.set(`${tintFamily}-${tintShade}/${alpha}`, {
      tint: hexToRgb(palette[tintFamily][tintShade]),
      tintAlpha: Number(alpha) / 100,
      light: hexToRgb(palette[lightFamily][lightShade]),
      dark: hexToRgb(palette[darkFamily][darkShade]),
    });
  }

  return chips;
}

describe('notification type chip contrast', () => {
  const surfaces = readThemeSurfaces();
  const chips = readChips();

  it('finds every chip declared in NotificationRows', () => {
    // like, repost, comment, follow
    expect(chips.size).toBe(4);
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`clears ${MIN_RATIO}:1 in the ${theme} theme, including over a hovered row`, () => {
      const { background, muted } = surfaces[theme];
      // Rows are transparent at rest, muted/30 when unread and muted/50 on
      // hover; the hovered surface is the worst case for every chip.
      const rowSurfaces = [background, composite(muted, 0.3, background), composite(muted, 0.5, background)];

      const failures: string[] = [];
      for (const [name, chip] of chips) {
        for (const row of rowSurfaces) {
          const chipSurface = composite(chip.tint, chip.tintAlpha, row);
          const ratio = contrastRatio(chip[theme], chipSurface);
          if (ratio < MIN_RATIO) {
            failures.push(`${name} -> ${ratio.toFixed(2)}:1`);
          }
        }
      }

      expect(failures, `below ${MIN_RATIO}:1 in ${theme}:\n${failures.join('\n')}`).toEqual([]);
    });
  }
});

/**
 * Brand Primitives Preview — development-only scratch surface.
 *
 * This page renders a single static instance of every brand primitive so the
 * Playwright visual regression suite can capture a stable baseline screenshot.
 *
 * Route is mounted behind `import.meta.env.DEV` in AppRouter, so it is
 * tree-shaken from production bundles.
 */

import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/button';

type ColorChip = { label: string; varName: string };

const primaryColors: ColorChip[] = [
  { label: 'brand-green', varName: '--brand-green' },
  { label: 'brand-dark-green', varName: '--brand-dark-green' },
  { label: 'brand-light-green', varName: '--brand-light-green' },
  { label: 'brand-off-white', varName: '--brand-off-white' },
];

const secondaryHues = [
  'yellow',
  'lime',
  'pink',
  'orange',
  'violet',
  'purple',
  'blue',
] as const;

const secondaryVariants = ['', '-light', '-dark'] as const;

const secondaryColors: ColorChip[] = secondaryHues.flatMap((hue) =>
  secondaryVariants.map((variant) => ({
    label: `brand-${hue}${variant}`,
    varName: `--brand-${hue}${variant}`,
  })),
);

const shadowAccents = [
  'green',
  'pink',
  'violet',
  'orange',
  'yellow',
  'blue',
  'dark',
] as const;

function ColorChip({ label, varName }: ColorChip) {
  // Per-color text decision driven by measured WCAG AA contrast (axe-core
  // verified in the /__brand-preview a11y test). Dark ink on most chips,
  // white ink on truly dark tokens + purple (which sits just under 4.5:1
  // with dark text).
  const needsWhiteText =
    varName === '--brand-dark-green' ||
    varName.endsWith('-dark') ||
    varName === '--brand-purple';
  const textClass = needsWhiteText ? 'text-white' : 'text-brand-dark-green';
  return (
    <div
      // The visible label is a developer color reference, not content —
      // excluded from axe color-contrast in tests/visual/a11y.spec.ts.
      data-axe-skip="color-contrast"
      className={`w-40 h-20 rounded-md border border-black/10 flex items-end p-2 text-xs font-mono ${textClass}`}
      style={{ background: `hsl(var(${varName}))` }}
    >
      {label}
    </div>
  );
}

export default function BrandPreview() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8 space-y-12">
      <header className="space-y-2">
        <h1
          className="text-5xl font-extrabold tracking-tight"
          style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
        >
          Brand Primitives Preview
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl">
          Static preview page for the Divine brand system. Used by Playwright
          visual regression to lock in a baseline screenshot of every primitive
          (logo, headings, buttons, offset shadows, sticker &amp; card
          treatments, color swatches). Not included in production builds.
        </p>
      </header>

      {/* Brand Logo at three sizes */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">BrandLogo</h2>
        <div className="flex flex-wrap items-end gap-8">
          <BrandLogo />
          <BrandLogo className="text-4xl" />
          <BrandLogo className="text-6xl" />
        </div>
      </section>

      {/* Headings h1-h6 — Bricolage Grotesque should apply */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Headings (h1–h6)</h2>
        <div
          className="space-y-2"
          style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
        >
          <h1 className="text-6xl font-extrabold">h1 — Heading One</h1>
          <h2 className="text-5xl font-extrabold">h2 — Heading Two</h2>
          <h3 className="text-4xl font-bold">h3 — Heading Three</h3>
          <h4 className="text-3xl font-bold">h4 — Heading Four</h4>
          <h5 className="text-2xl font-semibold">h5 — Heading Five</h5>
          <h6 className="text-xl font-semibold">h6 — Heading Six</h6>
        </div>
      </section>

      {/* Button (default variant — sticker variant lands in Phase 1) */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Button (default variant)</h2>
        <Button variant="default">Default Button</Button>
      </section>

      {/* Offset-shadow accents */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Offset Shadows</h2>
        <div className="flex flex-wrap gap-8 pb-4">
          {shadowAccents.map((accent) => (
            <div
              key={accent}
              className={`brand-offset-shadow-${accent} border-2 border-brand-dark-green rounded-md bg-card flex items-center justify-center text-sm font-mono`}
              style={{ width: 120, height: 80 }}
            >
              {accent}
            </div>
          ))}
        </div>
      </section>

      {/* Sticker treatment */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Sticker Treatment</h2>
        <button
          type="button"
          className="brand-sticker bg-brand-green text-brand-dark-green font-bold px-6 py-3"
        >
          Hover me
        </button>
      </section>

      {/* Card treatment */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Card Treatment</h2>
        <div className="brand-card p-6 max-w-md space-y-2">
          <h3 className="text-xl font-bold">Sample Card</h3>
          <p className="text-sm text-muted-foreground">
            The <code>brand-card</code> utility adds a thick dark-green border
            and 22px corner radius. Compose with <code>brand-offset-shadow-*</code>
            for accented surfaces.
          </p>
        </div>
      </section>

      {/* Color swatches — 4 primary + 21 secondary = 25 chips */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Color Swatches (25)</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Primary (4)</h3>
            <div className="flex flex-wrap gap-3">
              {primaryColors.map((c) => (
                <ColorChip key={c.label} {...c} />
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Secondary (7 × 3 = 21)</h3>
            <div className="flex flex-wrap gap-3">
              {secondaryColors.map((c) => (
                <ColorChip key={c.label} {...c} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

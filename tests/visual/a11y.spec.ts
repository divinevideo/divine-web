import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBKEY = 'a'.repeat(64);
const ROUTES = [
  '/',
  '/discovery',
  '/search',
  '/merch',
  '/family',
  '/age-review',
  '/kids',
  `/profile/${PUBKEY}`,
  `/profile/${PUBKEY}/lists`,
  `/people-lists/${PUBKEY}/friends`,
  `/list/${PUBKEY}/favorites`,
  '/__brand-preview',
];

// Both schemes, because a contrast bug can exist in one and not the other.
// The app's default theme is "system", so emulating the media preference is
// what actually drives it — see the guard inside the test.
const COLOR_SCHEMES = ['light', 'dark'] as const;

for (const scheme of COLOR_SCHEMES) {
  for (const route of ROUTES) {
  test(`a11y (${scheme}): ${route} has no WCAG 2.1 A/AA violations`, async ({ page }) => {
    test.setTimeout(60_000); // discovery + search do a fair bit of fetching
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    // Without this the dark run silently degrades into a second light run the
    // moment the default theme stops following the system preference, and the
    // suite would report dark-mode coverage it no longer has.
    await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${scheme}\\b`));
    const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    // Color-swatch chips on the brand-preview page are reference tiles, not
    // content; their visible label is decorative. Axe's color-contrast rule
    // doesn't meaningfully apply — skip it on those elements only.
    if (route === '/__brand-preview') {
      builder.exclude('[data-axe-skip="color-contrast"]');
    }
    const results = await builder.analyze();

    if (results.violations.length > 0) {
      for (const v of results.violations) {
        console.log(`[${v.impact?.toUpperCase() ?? '?'}] ${v.id}: ${v.description}`);
        for (const n of v.nodes.slice(0, 3)) {
          console.log(`   ${n.target.join(' > ')}`);
        }
      }
    }
    expect(results.violations).toEqual([]);
  });
}
}

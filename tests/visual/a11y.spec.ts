import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = ['/', '/discovery', '/search', '/__brand-preview'];

for (const route of ROUTES) {
  test(`a11y: ${route} has no WCAG 2 A/AA violations`, async ({ page }) => {
    test.setTimeout(60_000); // discovery + search do a fair bit of fetching
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
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

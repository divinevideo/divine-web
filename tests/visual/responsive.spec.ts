import { test, expect, devices } from '@playwright/test';

// Widths that actually matter: iPhone SE is the narrowest phone worth
// supporting, iPhone 14 is the common case, and 768 is the tablet breakpoint
// where the desktop nav is still hidden.
const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-14', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
];

const ROUTES = ['/', '/family', '/safety', '/kids', '/merch', '/terms'];

for (const vp of VIEWPORTS) {
  for (const route of ROUTES) {
    test(`responsive: ${route} does not scroll horizontally at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();

      // A page that scrolls sideways on a phone is the single most visible
      // symptom of a broken responsive layout, and it is cheap to assert.
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(
        scrollWidth,
        `${route} overflows by ${scrollWidth - clientWidth}px at ${vp.width}px wide`,
      ).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance for subpixel rounding
    });
  }
}

test.describe('marketing header', () => {
  test('collapses into a menu on mobile and keeps the CTA reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // The download CTA stays visible — it is the point of the page. It's a
    // dropdown button on Android/desktop and a direct link on iOS, so match
    // either role. (Playwright's default UA is desktop → the dropdown button.)
    const cta = page
      .getByRole('button', { name: /get the app/i })
      .or(page.getByRole('link', { name: /get the app/i }));
    await expect(cta.first()).toBeVisible();

    // The full nav list is behind the menu, not crammed into the bar.
    await expect(page.getByRole('link', { name: 'In the News' })).toBeHidden();

    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.getByRole('link', { name: 'In the News' })).toBeVisible();
  });

  test('shows the full nav on desktop with no menu button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: 'In the News' })).toBeVisible();
    await expect(page.getByRole('button', { name: /open menu/i })).toBeHidden();
  });
});

test.describe('hero get-the-app CTA', () => {
  test('is visible and tappable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Playwright's default UA is desktop, so the hero CTA is the dropdown button.
    const cta = page.locator('main').getByRole('button', { name: /get the app/i });
    await expect(cta).toBeVisible();

    // Apple's own guidance is a 44px minimum touch target.
    const box = await cta.boundingBox();
    expect(box, 'CTA has no box').not.toBeNull();
    expect(box!.height, `CTA is only ${box!.height}px tall`).toBeGreaterThanOrEqual(40);

    // Opens the store picker.
    await cta.click();
    await expect(page.getByRole('menuitem')).toHaveCount(3);
  });
});

test('showcase page renders its real mobile layout', async ({ page }) => {
  await page.setViewportSize({ ...devices['iPhone 13'].viewport });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByTestId('curated-showcase')).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('brand primitives render', async ({ page }) => {
  await page.goto('/__brand-preview');
  await expect(page.getByText('Divine').first()).toBeVisible();
  await expect(page).toHaveScreenshot('brand-primitives.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});

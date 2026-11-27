// ABOUTME: Checks native anchors in the real prerendered marketing page with JavaScript disabled.
// ABOUTME: Builds candidate CSS and renders the actual marketing SSG entry before serving it locally.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.use({ javaScriptEnabled: false });

test.beforeAll(() => {
  test.setTimeout(120_000);
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { maxBuffer: 10 * 1024 * 1024 });
  execFileSync(process.execPath, ['scripts/prerender-marketing.mjs'], { maxBuffer: 10 * 1024 * 1024 });
});

for (const width of [320, 360, 390, 768, 1505]) {
  for (const longTranslation of [false, true]) {
    test(`prerendered marketing anchors clear the header without JavaScript at ${width}px with ${longTranslation ? 'long translated' : 'English'} copy`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, right: 44, bottom: 34, left: 44 } });
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'localhost') return route.abort();
        if (url.pathname === '/family/media-plan') {
          const html = readFileSync(resolve('dist/family/media-plan/index.html'), 'utf8');
          return route.fulfill({
            body: longTranslation ? html.replace('>Merch<', '>Articole promoționale<') : html,
            contentType: 'text/html',
          });
        }
        if (url.pathname.startsWith('/assets/')) {
          const asset = resolve(`dist${url.pathname}`);
          if (existsSync(asset)) return route.fulfill({ path: asset });
        }
        return route.continue();
      });
      await page.goto('/family/media-plan');
      await page.evaluate(() => document.fonts.ready);
      const header = page.locator('#root > div > nav').first();
      const section = page.locator('[id="plan"]');
      const heading = section.getByRole('heading').first();
      await expect(header.getByRole('img', { name: 'Divine', exact: true })).toBeVisible();
      if (longTranslation) await expect(header.getByRole('link', { name: 'Articole promoționale', exact: true })).toBeVisible();
      await expect(section).toBeVisible();
      expect(await header.locator('..').evaluate((element) => element.style.getPropertyValue('--marketing-header-height'))).toBe('');
      await section.evaluate((element) => element.scrollIntoView({ behavior: 'instant' }));
      const headerBox = await header.boundingBox();
      const headingBox = await heading.boundingBox();
      expect(headingBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
      expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(844);
      await page.screenshot({ path: testInfo.outputPath('prerender-anchor-no-js.png') });
    });
  }
}

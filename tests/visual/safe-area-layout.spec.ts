// ABOUTME: Checks actual app chrome and fullscreen controls against nonzero safe-area insets.
// ABOUTME: Uses Chromium inset emulation and synthetic media without external requests.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const MEDIA_PATH = fileURLToPath(new URL('./fixtures/loop-with-audio.mp4', import.meta.url));
const VIDEO = {
  id: 'a'.repeat(64),
  pubkey: 'b'.repeat(64),
  created_at: 1_400_000_000,
  kind: 34236,
  d_tag: 'safe-area-fixture',
  title: 'Synthetic safe-area check',
  content: '',
  video_url: 'https://media.divine.video/safe-area-fixture.mp4',
  thumbnail: 'https://media.divine.video/safe-area-fixture.jpg',
  dimensions: '480x480',
  platform: 'vine',
  author_name: 'Synthetic Viner',
  text_track_content: 'WEBVTT\n\n00:00.000 --> 00:06.000\nSynthetic captions\n',
  tags: [['d', 'safe-area-fixture'], ['platform', 'vine']],
};

async function preparePage(page: Page, insets: { top: number; right: number; bottom: number; left: number }) {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setSafeAreaInsetsOverride', { insets });
  await page.routeWebSocket(/^wss:\/\//, (socket) => socket.close());
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'media.divine.video') {
      if (url.pathname.endsWith('.jpg')) {
        return route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="#0b483c"/></svg>',
          headers: { 'access-control-allow-origin': '*' },
        });
      }
      return route.fulfill({ path: MEDIA_PATH, contentType: 'video/mp4', headers: { 'access-control-allow-origin': '*' } });
    }
    if (url.hostname !== 'api.divine.video') return route.abort();
    if (url.pathname === '/api/videos') return route.fulfill({ json: [VIDEO] });
    if (url.pathname === '/api/v2/videos') {
      return route.fulfill({ json: { data: [VIDEO], pagination: { next_cursor: null, has_more: false } } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

for (const top of [0, 47]) {
  test(`mobile app chrome clears ${top}px top and 34px bottom insets`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePage(page, { top, right: 0, bottom: 34, left: 0 });
    await page.goto('/search');
    const header = page.locator('header');
    const navigation = page.locator('nav.fixed.bottom-0');
    await expect(header).toBeVisible();
    await expect(header).toHaveCSS('padding-top', `${top}px`);
    await expect(navigation).toHaveCSS('padding-bottom', '34px');
    await expect(page.locator('main').first()).toHaveCSS('padding-bottom', '98px');
    const buttons = await navigation.locator('button').all();
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(844 - 34);
    }
    const firstControl = await header.locator('button').first().boundingBox();
    expect(firstControl!.y).toBeGreaterThanOrEqual(top);
    await page.screenshot({ path: testInfo.outputPath(`app-chrome-${top}.png`) });
  });
}

test('landscape sidebar clears the side notch and desktop content has no mobile-nav padding', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await preparePage(page, { top: 0, right: 44, bottom: 21, left: 44 });
  await page.goto('/search');
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveCSS('padding-left', '44px');
  await expect(sidebar).toHaveCSS('padding-bottom', '21px');
  await expect(page.locator('main').first()).toHaveCSS('padding-bottom', '0px');
  const firstControl = await sidebar.locator('button').first().boundingBox();
  expect(firstControl!.x).toBeGreaterThanOrEqual(44);
});

test('marketing content clears its inset header and retains the footer offset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, { top: 47, right: 0, bottom: 34, left: 0 });
  await page.goto('/privacy');
  const header = page.locator('nav.fixed.top-0');
  await expect(header).toHaveCSS('padding-top', '47px');
  await expect(header.locator('..').locator(':scope > .flex-1')).toHaveCSS('padding-top', '111px');
  await expect(page.locator('footer')).toHaveCSS('padding-bottom', '122px');
});

test('fullscreen controls clear all four emulated safe-area edges', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, { top: 47, right: 12, bottom: 34, left: 8 });
  await page.goto('/discovery/classics');
  await expect(page.locator('main .brand-card video')).toHaveJSProperty('readyState', 4);
  await page.getByRole('button', { name: 'Enter fullscreen', exact: true }).first().click();
  const back = page.locator('.top-safe-offset-4.left-safe-offset-4');
  const sound = page.locator('.top-safe-offset-4.right-safe-offset-4');
  await expect(back).toBeVisible();
  await expect(back).toHaveCSS('top', '63px');
  await expect(back).toHaveCSS('left', '24px');
  await expect(sound).toHaveCSS('top', '63px');
  await expect(sound).toHaveCSS('right', '28px');
  await expect(page.locator('.pb-safe-offset-8')).toHaveCSS('padding-bottom', '66px');
  await expect(page.locator('.px-safe-offset-4')).toHaveCSS('padding-left', '24px');
  await expect(page.locator('.px-safe-offset-4')).toHaveCSS('padding-right', '28px');
  const overlay = page.locator('body > div.fixed').filter({ has: back });
  await expect(overlay).toHaveCSS('opacity', '1');
  await expect(overlay.locator('video')).toHaveJSProperty('readyState', 4);
  await page.screenshot({ path: testInfo.outputPath('fullscreen-insets.png') });
});

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
  const header = page.locator('nav.sticky.top-0');
  await expect(header).toHaveCSS('padding-top', '47px');
  const content = header.locator('..').locator(':scope > .flex-1');
  const headerBounds = await header.boundingBox();
  const contentBounds = await content.boundingBox();
  expect(contentBounds!.y).toBe(headerBounds!.y + headerBounds!.height);
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

for (const width of [320, 360, 390, 768, 1505]) {
  for (const longTranslation of [false, true]) {
    test(`marketing links and logo fit ${width}px with ${longTranslation ? 'long translated' : 'English'} merch copy`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await preparePage(page, { top: 47, right: 12, bottom: 34, left: 8 });
      await page.goto('/privacy');
      if (longTranslation) {
        await page.evaluate(async () => {
          const modulePath = '/src/lib/i18n/index.ts';
          const { initializeI18n } = await import(modulePath);
          const i18n = await initializeI18n();
          i18n.addResource('ro', 'common', 'menu.merch', 'Articole promoționale');
          await i18n.changeLanguage('ro');
        });
      }
      const header = page.locator('nav').first();
      if (longTranslation) await expect(header.getByRole('link', { name: 'Articole promoționale', exact: true })).toBeVisible();
      const logo = header.getByRole('img', { name: 'Divine', exact: true });
      await expect(logo).toBeVisible();
      await expect.poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await page.evaluate(() => document.fonts.ready);
      expect(await header.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))).toEqual([
        '/', 'https://about.divine.video/', 'https://about.divine.video/blog/',
        'https://about.divine.video/faqs/', 'https://about.divine.video/news/', '/merch', '/discovery',
      ]);
      const geometry = await header.evaluate((element) => {
        const links = [...element.querySelectorAll('a')].map((link) => ({
          label: link.textContent || 'Divine logo', box: link.getBoundingClientRect().toJSON(),
        }));
        return {
          links,
          logo: element.querySelector('img')!.getBoundingClientRect().toJSON(),
          header: element.getBoundingClientRect().toJSON(),
          content: element.parentElement!.children[1].getBoundingClientRect().toJSON(),
        };
      });
      expect(geometry.logo.width).toBeGreaterThan(0);
      for (const [index, link] of geometry.links.entries()) {
        expect(link.box.left, link.label).toBeGreaterThanOrEqual(8);
        expect(link.box.right, link.label).toBeLessThanOrEqual(width - 12);
        expect(link.box.width, link.label).toBeGreaterThan(0);
        expect(link.box.top, link.label).toBeGreaterThanOrEqual(47);
        for (const other of geometry.links.slice(index + 1)) {
          const overlaps = link.box.left < other.box.right && link.box.right > other.box.left
            && link.box.top < other.box.bottom && link.box.bottom > other.box.top;
          expect(overlaps, `${link.label} overlaps ${other.label}`).toBe(false);
        }
      }
      expect(geometry.content.top).toBeGreaterThanOrEqual(geometry.header.bottom);
      expect(geometry.content.top - geometry.header.bottom).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath('marketing-header.png') });
    });
  }
}

for (const direct of [true, false]) {
  test(`wrapped marketing header leaves a ${direct ? 'direct' : 'clicked'} policy anchor readable`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await preparePage(page, { top: 47, right: 12, bottom: 34, left: 8 });
    await page.goto(direct ? '/kids#13-15' : '/kids');
    const section = page.locator('[id="13-15"]');
    const heading = section.getByRole('heading').first();
    await expect(heading).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    if (!direct) await page.getByRole('navigation', { name: 'On this page' }).getByRole('link', { name: 'Divine Greenlight (13-15)', exact: true }).click();
    await expect(heading).toBeInViewport({ ratio: 1 });
    if (!direct) {
      await expect.poll(() => section.evaluate((element) => Math.abs(
        element.getBoundingClientRect().top - Number.parseFloat(getComputedStyle(element).scrollMarginTop)
      ))).toBeLessThanOrEqual(1);
    }
    await page.evaluate(() => new Promise<void>((resolve) => {
      let previous = window.scrollY;
      let settledFrames = 0;
      const check = () => {
        settledFrames = window.scrollY === previous ? settledFrames + 1 : 0;
        previous = window.scrollY;
        if (settledFrames === 3) resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }));
    const headerBounds = await page.locator('nav').first().boundingBox();
    const headingBounds = await heading.boundingBox();
    expect(headingBounds!.y).toBeGreaterThanOrEqual(headerBounds!.y + headerBounds!.height);
    expect(headingBounds!.y + headingBounds!.height).toBeLessThanOrEqual(844);
    if (!direct) {
      await page.setViewportSize({ width: 768, height: 844 });
      await expect.poll(async () => {
        const currentHeader = await page.locator('nav').first().boundingBox();
        const margin = await section.evaluate((element) => Number.parseFloat(getComputedStyle(element).scrollMarginTop));
        return Math.abs(margin - currentHeader!.height - 16);
      }).toBeLessThanOrEqual(1);
      await section.evaluate((element) => element.scrollIntoView({ behavior: 'instant' }));
      const resizedHeader = await page.locator('nav').first().boundingBox();
      const resizedHeading = await heading.boundingBox();
      expect(resizedHeading!.y).toBeGreaterThanOrEqual(resizedHeader!.y + resizedHeader!.height);
    }
  });
}

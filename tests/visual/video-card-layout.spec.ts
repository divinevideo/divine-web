// ABOUTME: Lays out video cards from synthetic Funnelcake data and checks that each card stays inside
// ABOUTME: its column and each card button inside its card, so its right-edge controls stay reachable.
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

// One run of text with no break opportunity, wider than any card. A classic Vine
// caption like this once set the width of every card in the feed.
const UNBROKEN_TITLE = `Sing along ${'unbroken'.repeat(16)}`;

const PUBKEY = 'b'.repeat(64);

function syntheticVideo(index: number, title: string) {
  const id = index.toString(16).padStart(64, 'a');
  const dTag = `synthetic-${index}`;
  const media = `https://media.divine.video/synthetic-${index}`;
  return {
    id,
    pubkey: PUBKEY,
    created_at: 1_400_000_000 + index,
    kind: 34236,
    d_tag: dTag,
    title,
    content: '',
    text_track_content: 'WEBVTT\n\n00:00.000 --> 00:06.000\nSynthetic captions\n',
    thumbnail: `${media}.jpg`,
    video_url: `${media}.mp4`,
    dimensions: '480x480',
    // Six-digit counts give the action row its widest labels.
    loops: 9_876_543,
    embedded_likes: 987_654,
    embedded_comments: 876_543,
    embedded_reposts: 765_432,
    platform: 'vine',
    author_name: 'Synthetic Viner',
    author_avatar: '',
    published_at: 1_400_000_000 + index,
    reactions: 0,
    comments: 0,
    reposts: 0,
    engagement_score: 0,
    views: 1_234,
    content_labels: [],
    moderation_labels: [],
    tags: [
      ['d', dTag],
      ['title', title],
      ['imeta', `url ${media}.mp4`, 'm video/mp4', `image ${media}.jpg`, 'dim 480x480'],
      ['platform', 'vine'],
      ['l', 'vine-archive', 'archive.divine.video'],
    ],
  };
}

const FEED = [
  syntheticVideo(1, 'A short caption'),
  syntheticVideo(2, UNBROKEN_TITLE),
  syntheticVideo(3, 'Another short caption'),
];

const MEDIA_PATH = fileURLToPath(new URL('./fixtures/loop-with-audio.mp4', import.meta.url));
async function serveSyntheticFeed(page: Page) {
  await page.routeWebSocket(/^wss:\/\//, (ws) => ws.close());
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
      return route.fulfill({
        path: MEDIA_PATH,
        contentType: 'video/mp4',
        headers: { 'access-control-allow-origin': '*' },
      });
    }
    if (url.hostname !== 'api.divine.video') return route.abort();
    if (url.pathname === '/api/videos') return route.fulfill({ json: FEED });
    if (url.pathname === '/api/v2/videos') {
      return route.fulfill({ json: { data: FEED, pagination: { next_cursor: null, has_more: false } } });
    }
    const video = FEED.find((v) => url.pathname === `/api/videos/${v.id}`);
    if (video) {
      const { tags, content, id, pubkey, created_at, kind } = video;
      return route.fulfill({
        json: {
          event: { id, pubkey, created_at, kind, tags, content, sig: '0'.repeat(128) },
          stats: { text_track_content: video.text_track_content, author_name: video.author_name, author_avatar: '', reactions: 0, comments: 0, reposts: 0, engagement_score: 0 },
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

async function expectControlsFit(card: Locator) {
  const sound = card.getByRole('button', { name: /^(Unmute|Mute|Activează sunetul)$/ });
  await expect(sound).toBeVisible();
  const problems = await card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const video = element.querySelector('video')!;
    const player = video.parentElement!.parentElement!.getBoundingClientRect();
    const issues: string[] = [];
    for (const button of element.querySelectorAll('button')) {
      const box = button.getBoundingClientRect();
      if (box.width && (box.left < bounds.left - 1 || box.right > bounds.right + 1)) {
        issues.push(`${button.getAttribute('aria-label')} outside card`);
      }
    }
    const controls = [...video.parentElement!.parentElement!.querySelectorAll('button')];
    for (const [index, button] of controls.entries()) {
      const box = button.getBoundingClientRect();
      if (box.width < 44 || box.height < 44) issues.push(`${button.getAttribute('aria-label')} below 44px`);
      if (box.left < player.left || box.right > player.right || box.top < player.top || box.bottom > player.bottom) {
        issues.push(`${button.getAttribute('aria-label')} outside player`);
      }
      for (const other of controls.slice(index + 1)) {
        const next = other.getBoundingClientRect();
        if (box.left < next.right && box.right > next.left && box.top < next.bottom && box.bottom > next.top) {
          issues.push(`${button.getAttribute('aria-label')} overlaps ${other.getAttribute('aria-label')}`);
        }
      }
    }
    return issues;
  });
  expect(problems).toEqual([]);
}

for (const width of [320, 360, 390, 1505]) {
  for (const route of ['/discovery/classics', '/discovery/hot', `/video/${FEED[1].id}`]) {
    test(`cards and playable sound controls fit at ${width}px on ${route}`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      await serveSyntheticFeed(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const cards = page.locator('main .brand-card');
      await expect(cards.first()).toBeVisible({ timeout: 30_000 });
      if (route.startsWith('/discovery/')) await expect(cards).toHaveCount(FEED.length);
      const title = page.locator('main h3').filter({ hasText: 'Sing along' });
      await expect(title).toBeVisible();
      expect(await title.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const overhang = await cards.evaluateAll((elements) => elements.map((card) => {
        const bounds = card.getBoundingClientRect();
        const column = card.closest('.infinite-scroll-component')?.getBoundingClientRect() ?? card.parentElement!.getBoundingClientRect();
        return Math.max(bounds.right - column.right, column.left - bounds.left);
      }));
      expect(overhang.every((pixels) => pixels <= 1)).toBe(true);
      for (const card of await cards.all()) {
        await expect(card.locator('video')).toHaveJSProperty('readyState', 4);
        await expect(card.getByRole('button', { name: 'Unmute', exact: true })).toHaveText('Unmute');
        await expectControlsFit(card);
        await card.getByRole('button', { name: 'More options', exact: true }).click({ trial: true });
      }
      const active = cards.first();
      await active.scrollIntoViewIfNeeded();
      await expect(active.locator('video')).toHaveJSProperty('paused', false);
      if (route.startsWith('/discovery/')) {
        await expect(active.getByRole('button', { name: 'Hide subtitles' })).toBeVisible();
        await expectControlsFit(active);
      }
      await active.getByRole('button', { name: 'Unmute', exact: true }).click({ trial: true });
      await testInfo.attach('card-layout', { body: await active.screenshot(), contentType: 'image/png' });
    });
  }
}

test('unmuting keeps playback running and the next active video inherits sound', async ({ page }) => {
  test.setTimeout(60_000);
  await serveSyntheticFeed(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/discovery/classics');
  const cards = page.locator('main .brand-card');
  await expect(cards).toHaveCount(FEED.length, { timeout: 30_000 });
  const first = cards.first();
  const video = first.locator('video');
  await first.scrollIntoViewIfNeeded();
  await expect(video).toHaveJSProperty('paused', false);
  await expect(video).toHaveJSProperty('muted', true);
  await first.getByRole('button', { name: 'Unmute', exact: true }).click();
  await expect(video).toHaveJSProperty('muted', false);
  await expect(video).toHaveJSProperty('paused', false);
  const mute = first.getByRole('button', { name: 'Mute', exact: true });
  await expect(mute).toHaveText('');
  expect(page.url()).toContain('/discovery/classics');
  await expectControlsFit(first);
  await expect.poll(() => video.evaluate((el) => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(0.25);

  const second = cards.nth(1);
  await second.scrollIntoViewIfNeeded();
  await expect(second.locator('video')).toHaveJSProperty('paused', false);
  await expect(second.locator('video')).toHaveJSProperty('muted', false);
  await expect(video).toHaveJSProperty('paused', true);
  await second.getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(second.locator('video')).toHaveJSProperty('muted', true);
  await expect(second.locator('video')).toHaveJSProperty('paused', false);
  await expect(second.getByRole('button', { name: 'Unmute', exact: true })).toHaveText('Unmute');
});

test('translated Unmute stays clear of captions and fullscreen on a narrow screen', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.setItem('divine:locale', 'ro'));
  await serveSyntheticFeed(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/discovery/classics');
  const card = page.locator('main .brand-card').first();
  await expect(card.getByRole('button', { name: 'Activează sunetul', exact: true })).toHaveText('Activează sunetul', { timeout: 30_000 });
  await expectControlsFit(card);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`Unmute label meets contrast requirements in ${colorScheme} mode`, async ({ page }) => {
    test.setTimeout(60_000);
    await serveSyntheticFeed(page);
    await page.emulateMedia({ colorScheme });
    await page.goto('/discovery/classics');
    const button = page.getByRole('button', { name: 'Unmute', exact: true }).first();
    await expect(button).toBeVisible({ timeout: 30_000 });
    await button.scrollIntoViewIfNeeded();
    const result = await new AxeBuilder({ page })
      .include('button[aria-label="Unmute"]')
      .withRules(['color-contrast'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}

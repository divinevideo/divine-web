// ABOUTME: Lays out video cards from synthetic Funnelcake data and checks that each card stays inside
// ABOUTME: its column, so the controls along its right edge (mute, More options) don't end up out of view.
import { expect, test, type Page } from '@playwright/test';

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

// Serves FEED for every Funnelcake read and keeps every other host and relay out,
// so the layout depends on nothing but this file.
async function serveSyntheticFeed(page: Page) {
  await page.routeWebSocket(/^wss:\/\//, (ws) => ws.close());
  await page.route(/^https?:\/\/(?!localhost[:/])/, (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'api.divine.video') return route.abort();
    if (url.pathname === '/api/v2/videos') {
      return route.fulfill({ json: { data: FEED, pagination: { next_cursor: null, has_more: false } } });
    }
    const video = FEED.find((v) => url.pathname === `/api/videos/${v.id}`);
    if (video) {
      const { tags, content, id, pubkey, created_at, kind } = video;
      return route.fulfill({
        json: {
          event: { id, pubkey, created_at, kind, tags, content, sig: '0'.repeat(128) },
          stats: { author_name: video.author_name, author_avatar: '', reactions: 0, comments: 0, reposts: 0, engagement_score: 0 },
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}

test('a title with no break opportunities wraps inside the video card', async ({ page }) => {
  // A cold dev server compiles the app on first load.
  test.setTimeout(60_000);
  await serveSyntheticFeed(page);
  await page.goto(`/video/${FEED[1].id}`);
  const title = page.locator('main h3').first();
  await expect(title).toContainText('Sing along', { timeout: 30_000 });

  const overflow = await title.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every feed card fits inside the feed column', async ({ page }) => {
  test.setTimeout(60_000);
  await serveSyntheticFeed(page);
  await page.setViewportSize({ width: 1505, height: 900 });
  // Hot's first page is the /api/v2/videos response served above. Classic reads
  // /api/videos at a random offset instead, which this stub does not serve.
  await page.goto('/discovery/hot');
  // A card wider than the feed column pushes its right edge, and the video's mute
  // button with it, out of view behind a sideways scroll.
  const feed = page.locator('.infinite-scroll-component').first();
  await expect(feed.locator('.brand-card')).toHaveCount(FEED.length, { timeout: 30_000 });

  const overhangs = await feed.evaluate((container) => {
    const right = container.getBoundingClientRect().right;
    return [...container.querySelectorAll('.brand-card')].map(
      (card) => Math.round(card.getBoundingClientRect().right - right),
    );
  });
  expect(overhangs.filter((px) => px > 0)).toEqual([]);
});

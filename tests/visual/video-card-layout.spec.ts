// ABOUTME: Checks against live data that video cards stay inside their column, so the
// ABOUTME: controls along each card's right edge (mute, overflow menu) stay reachable.
import { expect, test } from '@playwright/test';

// A Vine archive classic whose title is one long unbroken run:
// "#showoffnostr:npub1…" followed by raw npubs with no spaces between them.
const UNBROKEN_TITLE_VIDEO_ID = '283825553550b2ce0cecdedfe3e5473d7390d4f67e4fa16bb692bcf4fbfc14f5';

test('a title with no break opportunities wraps inside the video card', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`/video/${UNBROKEN_TITLE_VIDEO_ID}`);
  const title = page.locator('main h3').first();
  // Live API data, so allow for a cold relay and dev server.
  await expect(title).toContainText('#showoffnostr', { timeout: 30_000 });

  const overflow = await title.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('every classics feed card fits inside the feed column', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1505, height: 900 });
  await page.goto('/discovery/classics');
  // The feed scroll container clips horizontally, so a card wider than it loses
  // its right edge — including the mute button — with no way to scroll to it.
  const feed = page.locator('.infinite-scroll-component').first();
  await expect(feed.locator('.brand-card').first()).toBeVisible({ timeout: 30_000 });

  const overhangs = await feed.evaluate((container) => {
    const right = container.getBoundingClientRect().right;
    return [...container.querySelectorAll('.brand-card')].map(
      (card) => Math.round(card.getBoundingClientRect().right - right),
    );
  });
  expect(overhangs.filter((px) => px > 0)).toEqual([]);
});

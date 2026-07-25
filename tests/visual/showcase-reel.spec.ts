import { test, expect } from '@playwright/test';

// The reel is populated from a live curated list, so these assertions are
// written against whatever it actually loaded rather than a fixed count, and
// skip themselves if the reel came back empty or with a single clip (nothing
// to wrap between).
async function reelState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const reel = document.querySelector<HTMLElement>(
      '[role="group"][aria-label="Curated video reel"]',
    );
    if (!reel) return null;
    const slideHeight = reel.clientHeight;
    return {
      count: Math.round(reel.scrollHeight / slideHeight),
      index: Math.round(reel.scrollTop / slideHeight),
    };
  });
}

test.describe('showcase reel loops', () => {
  test('wraps in both directions instead of dead-ending', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const reel = page.getByRole('group', { name: 'Curated video reel' });
    await expect(reel).toBeVisible({ timeout: 15_000 });

    const initial = await reelState(page);
    test.skip(!initial || initial.count < 2, 'reel needs at least two clips to wrap');
    const { count } = initial!;

    await reel.focus();
    expect((await reelState(page))!.index).toBe(0);

    // Backwards off the front edge lands on the last clip.
    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await reelState(page))!.index, { timeout: 5000 })
      .toBe(count - 1);

    // Forwards off the back edge comes back around to the first.
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await reelState(page))!.index, { timeout: 5000 })
      .toBe(0);
  });

  test('steps one clip at a time within the list', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const reel = page.getByRole('group', { name: 'Curated video reel' });
    await expect(reel).toBeVisible({ timeout: 15_000 });

    const initial = await reelState(page);
    test.skip(!initial || initial.count < 3, 'reel needs three clips to step twice');

    await reel.focus();
    await page.keyboard.press('ArrowDown');
    await expect
      .poll(async () => (await reelState(page))!.index, { timeout: 5000 })
      .toBe(1);

    await page.keyboard.press('ArrowUp');
    await expect
      .poll(async () => (await reelState(page))!.index, { timeout: 5000 })
      .toBe(0);
  });
});

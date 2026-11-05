import { expect, test } from '@playwright/test';
import { fixture, otherFixture, prepareCommunityFixture } from './community-fixture';

for (const width of [390, 1280]) test(`production community entry loads signed history at ${width}px`, async ({ page, baseURL }) => {
  await prepareCommunityFixture(page, baseURL!);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/supporters');
  if (width < 768) {
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Community chat' }).click();
  } else await page.getByRole('button', { name: 'Community chat' }).click();
  await expect(page).toHaveURL(`/chat/${fixture.expected.communityId}`);
  await expect(page.getByRole('link', { name: 'general', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'general', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: fixture.expected.message.content })).toBeVisible();
  await expect(page.getByText('Divine test community')).toHaveCount(0);
  const composer = page.getByRole('textbox', { name: 'Message' });
  await expect(composer).toBeEnabled();
  await expect(composer).toBeInViewport({ ratio: 1 });
  const icon = await page.getByRole('region', { name: 'Channel timeline' }).getByRole('heading', { level: 2 }).locator('svg').boundingBox();
  expect(icon!.width).toBeLessThanOrEqual(24);
  expect(icon!.height).toBeLessThanOrEqual(24);
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
  await page.screenshot({ path: `test-results/production-chat-${width}.png`, fullPage: true });
});

test('an explicit capability keeps its own community through channel navigation despite a different default', async ({ page, baseURL }) => {
  await prepareCommunityFixture(page, baseURL!);
  const invite = new URL(otherFixture.inviteUrl);
  await page.goto(invite.pathname + invite.hash);
  await expect(page).toHaveURL(`/chat/${otherFixture.expected.communityId}`);
  const channel = otherFixture.expected.channels[0];
  await page.getByRole('link', { name: channel.name, exact: true }).click();
  await expect(page).toHaveURL(`/chat/${otherFixture.expected.communityId}/${channel.id}`);
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeEnabled();
  await expect(page.getByRole('listitem').filter({ hasText: fixture.expected.message.content })).toHaveCount(0);
  await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }, invite.pathname);
  await expect(page.getByRole('alert')).toHaveText('This community invite is invalid or incomplete. Open the complete invite link.');
});

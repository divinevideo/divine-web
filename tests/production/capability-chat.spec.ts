import { expect, test } from '@playwright/test';
import { fixture, prepareCommunityFixture } from './community-fixture';

test('a production capability invite opens signed history without a default community', async ({ page, baseURL }) => {
  await prepareCommunityFixture(page, baseURL!);
  await page.goto('/supporters');
  await expect(page.getByRole('button', { name: 'Community chat' })).toHaveCount(0);
  const invite = new URL(fixture.inviteUrl);
  await page.goto(invite.pathname + invite.hash);
  await expect(page).toHaveURL(`/chat/${fixture.expected.communityId}`);
  await page.getByRole('link', { name: 'general', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: fixture.expected.message.content })).toBeVisible();
  await expect(page.getByText('Divine test community')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/production-capability-chat.png', fullPage: true });
});

test('a capability invite survives a sign-in redirect that returns to the link without its fragment', async ({ page, baseURL }) => {
  const account = await prepareCommunityFixture(page, baseURL!, false, false);
  const invite = new URL(fixture.inviteUrl);
  await page.goto(invite.pathname + invite.hash);
  await expect(page.getByText('Log in to join the conversation. We opened the login for you.')).toBeVisible();
  await page.evaluate(login => localStorage.setItem('nostr:login', JSON.stringify([login])), account);
  await page.goto(invite.pathname);
  await expect(page).toHaveURL(`/chat/${fixture.expected.communityId}`);
  await page.getByRole('link', { name: 'general', exact: true }).click();
  await expect(page.getByRole('listitem').filter({ hasText: fixture.expected.message.content })).toBeVisible();
});

for (const hash of ['', '#bad-fragment', '#community=demo-community&invite=legacy']) test(`an explicit production invite fails closed with fragment ${JSON.stringify(hash)}`, async ({ page, baseURL }) => {
  await prepareCommunityFixture(page, baseURL!);
  await page.goto(new URL(fixture.inviteUrl).pathname + hash);
  await expect(page.getByRole('alert')).toHaveText('This community invite is invalid or incomplete. Open the complete invite link.');
  await expect(page.getByText('Divine test community')).toHaveCount(0);
});

test('a forged bundle never substitutes a POC community', async ({ page, baseURL }) => {
  await prepareCommunityFixture(page, baseURL!, true);
  const invite = new URL(fixture.inviteUrl);
  await page.goto(invite.pathname + invite.hash);
  await expect(page.getByText('Could not verify or load this community. Try again.')).toBeVisible();
  await expect(page.getByText('Divine test community')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeDisabled();
});

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const english = JSON.parse(readFileSync(new URL('../../src/lib/i18n/locales/en/common.json', import.meta.url), 'utf8'));
const french = JSON.parse(readFileSync(new URL('../../src/lib/i18n/locales/fr/common.json', import.meta.url), 'utf8'));
import AxeBuilder from '@axe-core/playwright';

for (const { width, locale, copy } of [{ width: 390, locale: 'en', copy: english }, { width: 1280, locale: 'en', copy: english }, { width: 320, locale: 'fr', copy: french }]) {
  test(`supporters membership page at ${width}px`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem('divine:locale', language), locale);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/supporters');
    await expect(page.getByRole('heading', { name: copy.supporters.title, exact: true })).toBeVisible();
    await expect(page.getByText(copy.supporters.verificationPrerequisite)).toBeVisible();
    await expect(page.getByRole('link', { name: copy.supporters.getApp })).toHaveAttribute('href', '/download');
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
    await page.screenshot({ path: `test-results/supporters-${width}.png`, fullPage: true });
    const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('a supporter sees thanks and can opt into public recognition', async ({ page }) => {
  test.setTimeout(60_000);
  const { generateSecretKey, getPublicKey, nip19 } = await import('nostr-tools');
  const secret = generateSecretKey();
  const pubkey = getPublicKey(secret);
  const login = { id: `nsec:${pubkey}`, type: 'nsec', pubkey, createdAt: new Date().toISOString(), data: { nsec: nip19.nsecEncode(secret) } };
  await page.addInitScript((account) => localStorage.setItem('nostr:login', JSON.stringify([account])), login);
  const recognition = { haloVisible: false, discoveryVisible: true, foundingHistoryVisible: false };
  await page.route('https://supporters.divine.video/v1/**', async (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({ halo_visible: true, discovery_visible: true, founding_history_visible: false });
      recognition.haloVisible = true;
    }
    await route.fulfill({ json: { status: 'active', entitlement: { isActive: true }, recognition } });
  });
  await page.goto('/supporters');
  await expect(page.getByText('Thank you for supporting Divine.')).toBeVisible();
  const toggle = page.getByRole('switch', { name: 'Show my supporter badge on my profile' });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByRole('link', { name: 'Get the app to become a supporter' })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/supporters-active.png', fullPage: true });
});

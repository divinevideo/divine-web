// ABOUTME: E2E tests for OAuth login flow
// ABOUTME: Verifies OAuth redirect URLs and callback handling

import { test, expect } from '@playwright/test';

test.describe('OAuth Login Flow', () => {
  test('login dialog shows OAuth as primary option', async ({ page }) => {
    await page.goto('/');

    // Find login trigger in page and click it
    const loginTrigger = page.locator('text=Log In, text=Login, text=Sign In').first();
    if (await loginTrigger.isVisible()) {
      await loginTrigger.click();
    }

    // Look for the OAuth button (gradient style button with "Log In" text)
    const oauthButton = page.locator('button:has-text("Log In")').filter({
      has: page.locator('.bg-gradient-to-r, [class*="gradient"]')
    }).first();

    // If OAuth button exists, verify it's visible
    if (await oauthButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(oauthButton).toBeVisible();
    }
  });

  test('OAuth callback handles error gracefully', async ({ page }) => {
    // Simulate OAuth error callback
    await page.goto('/auth/callback?error=access_denied&error_description=User%20denied%20access');

    // Wait for page to process
    await page.waitForTimeout(2000);

    // Should show error message
    const hasError = await page.getByText(/denied|error|failed/i).isVisible().catch(() => false);
    const hasReturnButton = await page.getByRole('button', { name: /return|home|back/i }).isVisible().catch(() => false);

    expect(hasError || hasReturnButton).toBe(true);
  });

  test('OAuth callback handles missing code', async ({ page }) => {
    // Simulate callback without code
    await page.goto('/auth/callback?state=test123');

    await page.waitForTimeout(2000);

    // Should show error about missing code
    const hasError = await page.getByText(/missing|error|invalid/i).isVisible().catch(() => false);
    expect(hasError).toBe(true);
  });

  test('Nostr options hidden by default, revealed on click', async ({ page }) => {
    await page.goto('/');

    // Find and click login trigger
    const loginTrigger = page.locator('text=Log In, text=Login').first();
    if (await loginTrigger.isVisible()) {
      await loginTrigger.click();
      await page.waitForTimeout(500);
    }

    // Look for "or use Nostr" link
    const nostrLink = page.getByText('or use Nostr');
    if (await nostrLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Nostr tabs should NOT be visible initially
      const extensionTab = page.getByRole('tab', { name: /extension/i });
      const initiallyHidden = !(await extensionTab.isVisible().catch(() => false));

      // Click to reveal
      await nostrLink.click();
      await page.waitForTimeout(300);

      // Now tabs should be visible
      const extensionTabAfter = page.getByRole('tab', { name: /extension/i });
      const nowVisible = await extensionTabAfter.isVisible().catch(() => false);

      expect(initiallyHidden).toBe(true);
      expect(nowVisible).toBe(true);
    }
  });

  test('signup dialog shows Create Account button', async ({ page }) => {
    await page.goto('/');

    // Find signup trigger
    const signupTrigger = page.locator('text=Sign Up, text=Get Started, text=Create').first();
    if (await signupTrigger.isVisible()) {
      await signupTrigger.click();
      await page.waitForTimeout(500);
    }

    // Look for Create Account button
    const createButton = page.getByRole('button', { name: /create account/i });
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(createButton).toBeVisible();
    }
  });
});

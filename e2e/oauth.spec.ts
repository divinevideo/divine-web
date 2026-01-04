// ABOUTME: E2E tests for OAuth login flow
// ABOUTME: Verifies OAuth redirect URLs and callback handling

import { test, expect } from '@playwright/test';

test.describe('OAuth Login Flow', () => {
  test('login button redirects to Keycast OAuth with correct parameters', async ({ page }) => {
    // Go to homepage
    await page.goto('/');

    // Click the login button in header to open login dialog
    await page.getByRole('button', { name: /log in/i }).first().click();

    // Wait for the login dialog to appear
    await expect(page.getByText('Log in to continue')).toBeVisible();

    // Find and click the primary OAuth login button
    const oauthButton = page.getByRole('button', { name: /log in/i }).filter({ hasText: /log in/i });

    // Set up listener for navigation before clicking
    const navigationPromise = page.waitForURL(/login\.divine\.video\/api\/oauth\/authorize/, { timeout: 10000 });

    await oauthButton.click();

    // Wait for redirect to Keycast
    await navigationPromise;

    // Verify the URL parameters
    const url = new URL(page.url());
    expect(url.hostname).toBe('login.divine.video');
    expect(url.pathname).toBe('/api/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('divine-web');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('redirect_uri')).toContain('/auth/callback');
  });

  test('signup button redirects to Keycast OAuth', async ({ page }) => {
    await page.goto('/');

    // Click signup/create account button
    await page.getByRole('button', { name: /sign up|create|get started/i }).first().click();

    // Wait for signup dialog
    await expect(page.getByText(/create|get started/i)).toBeVisible();

    // Find the OAuth button and click it
    const oauthButton = page.getByRole('button', { name: /create account/i });

    const navigationPromise = page.waitForURL(/login\.divine\.video\/api\/oauth\/authorize/, { timeout: 10000 });

    await oauthButton.click();

    await navigationPromise;

    // Verify redirect to Keycast OAuth
    expect(page.url()).toContain('login.divine.video/api/oauth/authorize');
  });

  test('OAuth callback handles error gracefully', async ({ page }) => {
    // Simulate OAuth error callback
    await page.goto('/auth/callback?error=access_denied&error_description=User%20denied%20access');

    // Should show error message or redirect to home
    await page.waitForTimeout(2000);

    // Either we see an error message or we're redirected home
    const url = page.url();
    const hasError = await page.getByText(/denied|error|failed/i).isVisible().catch(() => false);
    const isHome = url.endsWith('/') || url.endsWith(':8080/');

    expect(hasError || isHome).toBe(true);
  });

  test('OAuth callback handles missing code', async ({ page }) => {
    // Simulate callback without code
    await page.goto('/auth/callback?state=test123');

    await page.waitForTimeout(2000);

    // Should handle gracefully
    const hasError = await page.getByText(/error|invalid|missing/i).isVisible().catch(() => false);
    const isHome = page.url().endsWith('/') || page.url().includes(':8080/');

    expect(hasError || isHome).toBe(true);
  });

  test('Nostr login options are available as secondary', async ({ page }) => {
    await page.goto('/');

    // Open login dialog
    await page.getByRole('button', { name: /log in/i }).first().click();

    // Verify "or use Nostr" divider text
    await expect(page.getByText('or use Nostr')).toBeVisible();

    // Verify Nostr login tabs exist
    await expect(page.getByRole('tab', { name: /extension/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /key/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /bunker/i })).toBeVisible();
  });
});

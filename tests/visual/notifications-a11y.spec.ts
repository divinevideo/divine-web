// ABOUTME: axe coverage for /notifications, which is login-gated and so cannot be reached by the public route sweep
// ABOUTME: Seeds a throwaway nsec login into localStorage and stubs the notifications API so real grouped rows render

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure';
import { nsecEncode } from 'nostr-tools/nip19';

/**
 * A login is a throwaway key generated per run. Signing happens locally, so
 * NIP-98 request auth needs no network and no real account.
 */
function makeLogin() {
  const sk = generateSecretKey();
  const pubkey = getPublicKey(sk);
  return {
    pubkey,
    entry: {
      id: `nsec:${pubkey}`,
      type: 'nsec',
      pubkey,
      createdAt: new Date().toISOString(),
      data: { nsec: nsecEncode(sk) },
    },
  };
}

const ACTOR_A = 'a'.repeat(64);
const ACTOR_B = 'b'.repeat(64);
const VIDEO_EVENT_ID = 'c'.repeat(64);
const D_TAG = 'a-looping-video';

/**
 * Two likes and a repost on one video, plus a follow. The two likes share a
 * `root_addressable_id` so the page renders a grouped row with a stacked actor
 * list — the row shape this coverage exists for.
 */
function makeNotificationsResponse(viewerPubkey: string) {
  const addressable = `34236:${viewerPubkey}:${D_TAG}`;
  const base = {
    source_kind: 7,
    notification_type: 'reaction',
    read: false,
    root_event_id: VIDEO_EVENT_ID,
    root_d_tag: D_TAG,
    root_addressable_id: addressable,
    referenced_event_id: VIDEO_EVENT_ID,
    referenced_event_title: 'A looping video',
    referenced_video: {
      title: 'A looping video',
      thumbnail: 'https://divine.video/og.png',
      d_tag: D_TAG,
    },
  };

  return {
    notifications: [
      {
        ...base,
        source_pubkey: ACTOR_A,
        source_event_id: '1'.repeat(64),
        created_at: 1_760_000_300,
        source_profile: { display_name: 'Ada', picture: null, nip05: null },
      },
      {
        ...base,
        source_pubkey: ACTOR_B,
        source_event_id: '2'.repeat(64),
        created_at: 1_760_000_200,
        source_profile: { display_name: 'Grace', picture: null, nip05: null },
      },
      {
        ...base,
        source_kind: 16,
        notification_type: 'repost',
        source_pubkey: ACTOR_B,
        source_event_id: '3'.repeat(64),
        created_at: 1_760_000_100,
        read: true,
        source_profile: { display_name: 'Grace', picture: null, nip05: null },
      },
      {
        source_pubkey: ACTOR_A,
        source_event_id: '4'.repeat(64),
        source_kind: 3,
        notification_type: 'follow',
        created_at: 1_760_000_000,
        read: true,
        source_profile: { display_name: 'Ada', picture: null, nip05: null },
      },
    ],
    unread_count: 2,
    has_more: false,
  };
}

test('a11y: /notifications has no WCAG 2 A/AA violations', async ({ page }) => {
  test.setTimeout(60_000);

  const { pubkey, entry } = makeLogin();

  await page.addInitScript((login) => {
    localStorage.setItem('nostr:login', JSON.stringify([login]));
  }, entry);

  // The notifications endpoint lives on the relay host, not the funnelcake API
  // host, and the resolved base differs by environment - match on path only.
  await page.route('**/api/users/*/notifications*', async (route) => {
    if (route.request().method() !== 'GET') {
      return route.fulfill({ status: 200, json: { success: true } });
    }
    return route.fulfill({ status: 200, json: makeNotificationsResponse(pubkey) });
  });

  // Rows carry their own title and thumbnail, so hydration should not fire.
  // Stub it anyway so a miss fails the assertion rather than hanging on network.
  await page.route('**/api/videos/**', (route) =>
    route.fulfill({ status: 200, json: { videos: [], missing: [] } }),
  );

  await page.goto('/notifications', { waitUntil: 'domcontentloaded' });

  // Assert the rows actually rendered. Without this the test would pass against
  // a login wall or an empty state and report false coverage.
  await expect(page.getByText('A looping video').first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  if (results.violations.length > 0) {
    for (const v of results.violations) {
      console.log(`[${v.impact?.toUpperCase() ?? '?'}] ${v.id}: ${v.description}`);
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`   ${n.target.join(' > ')}`);
      }
    }
  }
  expect(results.violations).toEqual([]);
});

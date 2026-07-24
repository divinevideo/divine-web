// ABOUTME: Tests the device→store selection behind the "Get the app" CTA
// ABOUTME: iOS = App Store only; Android = Play + Zapstore; desktop = all three

import { describe, it, expect } from 'vitest';
import { storesForPlatform } from '@/lib/appStoreOptions';

describe('storesForPlatform', () => {
  it('offers only the App Store on iOS', () => {
    const stores = storesForPlatform('ios');
    expect(stores.map((s) => s.store)).toEqual(['app_store']);
    expect(stores[0].href).toContain('apps.apple.com');
  });

  it('offers Google Play and Zapstore on Android — never the App Store', () => {
    const stores = storesForPlatform('android');
    expect(stores.map((s) => s.store)).toEqual(['play_store', 'zapstore']);
    expect(stores.map((s) => s.href)).toEqual([
      expect.stringContaining('play.google.com'),
      expect.stringContaining('zapstore.dev'),
    ]);
  });

  it('offers all three on desktop', () => {
    const stores = storesForPlatform('desktop');
    expect(stores.map((s) => s.store)).toEqual(['app_store', 'play_store', 'zapstore']);
  });

  it('tags every store link with the header UTM medium', () => {
    for (const platform of ['ios', 'android', 'desktop'] as const) {
      for (const s of storesForPlatform(platform)) {
        // Zapstore has no UTM (no query builder), the store links do.
        if (s.store !== 'zapstore') {
          expect(s.href, `${platform}/${s.store}`).toContain('utm_medium=marketing_header');
        }
      }
    }
  });
});

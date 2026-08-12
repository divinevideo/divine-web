import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/mobileStoreLinks';

const REPO_ROOT = resolve(__dirname, '..');
const TSX_MOBILE_SURFACES = [
  'src/pages/FAQPage.tsx',
  'src/pages/AboutPage.tsx',
  'src/pages/OpenSourcePage.tsx',
];
const STALE_MOBILE_COPY = [
  'iOS TestFlight is currently full',
  'TestFlight is full',
  'Beta is full',
  'available in beta for both iOS and Android',
  'currently in <strong>beta testing</strong>',
  'Join the Beta',
];

function readSource(path: string) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

describe('mobile app availability copy', () => {
  it.each(TSX_MOBILE_SURFACES)('%s uses canonical store links and avoids stale beta copy', (file) => {
    const source = readSource(file);

    expect(source).toContain('APP_STORE_URL');
    expect(source).toContain('PLAY_STORE_URL');

    for (const staleCopy of STALE_MOBILE_COPY) {
      expect(source).not.toContain(staleCopy);
    }
  });

  it('keeps the prerendered FAQ aligned with the canonical store URLs', () => {
    const source = readSource('scripts/prerender-content/faq-content.html').replaceAll('&amp;', '&');

    expect(source).toContain(APP_STORE_URL);
    expect(source).toContain(PLAY_STORE_URL);

    for (const staleCopy of STALE_MOBILE_COPY) {
      expect(source).not.toContain(staleCopy);
    }
  });
});

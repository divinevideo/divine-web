import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DIVINE_SERVICES } from '../src/config/divineServices';

const REPO_ROOT = resolve(__dirname, '..');

describe('divine services prerender content', () => {
  it('mentions every configured service name and URL', () => {
    const html = readFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-content/services-content.html'),
      'utf8',
    );

    for (const service of DIVINE_SERVICES) {
      expect(html).toContain(service.url);
      expect(html).toContain(service.name);
    }
  });

  it('registers the /services page in the prerender script', () => {
    const script = readFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
      'utf8',
    );

    expect(script).toContain("path: '/services'");
    expect(script).toContain('services-content.html');
  });

  it('closes the injected bundle script tag so the app boots', () => {
    // Regression guard: the script injection once dropped the closing
    // </script>, which left every prerendered page static-only.
    const script = readFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
      'utf8',
    );

    expect(script).toContain("scriptMatch[0] + '</script>'");
  });
});

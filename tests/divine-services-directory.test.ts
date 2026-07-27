import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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
    // </script>, which left every prerendered page static-only. Assert on the
    // generated HTML rather than the script's source text, so the guard
    // survives refactors of the injection expression and still catches an
    // unclosed tag however it is reintroduced.
    const tmp = mkdtempSync(join(tmpdir(), 'prerender-guard-'));

    try {
      mkdirSync(join(tmp, 'scripts', 'prerender-content'), { recursive: true });
      mkdirSync(join(tmp, 'dist'), { recursive: true });

      copyFileSync(
        resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
        join(tmp, 'scripts', 'prerender-legal.mjs'),
      );
      // Pages driven by a contentFile are all this guard needs; the ones read
      // from a .tsx sourceFile are skipped with a warning when absent.
      for (const file of ['services-content.html', 'faq-content.html']) {
        copyFileSync(
          resolve(REPO_ROOT, 'scripts/prerender-content', file),
          join(tmp, 'scripts', 'prerender-content', file),
        );
      }
      writeFileSync(
        join(tmp, 'dist', 'index.html'),
        '<!DOCTYPE html><html><head></head><body><div id="root"></div>' +
          '<script type="module" crossorigin src="/assets/index-TEST.js"></script>' +
          '</body></html>',
      );

      execFileSync(process.execPath, [join(tmp, 'scripts', 'prerender-legal.mjs')], {
        stdio: 'pipe',
      });

      const generated = readFileSync(
        join(tmp, 'dist', 'services', 'index.html'),
        'utf8',
      );

      expect(generated).toContain(
        '<script type="module" crossorigin src="/assets/index-TEST.js"></script>',
      );
      // Nothing may follow the bundle tag unclosed: the document must still
      // parse through to </html>.
      expect(generated.trimEnd().endsWith('</html>')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

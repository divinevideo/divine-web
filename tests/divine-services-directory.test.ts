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

const TEST_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:";

/**
 * Runs the real prerender script against a fixture dist/ in a temp directory
 * and returns the generated page, so guards can assert on output rather than
 * on the script's source text.
 */
function prerenderToTempDir(page: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'prerender-guard-'));

  try {
    mkdirSync(join(tmp, 'scripts', 'prerender-content'), { recursive: true });
    mkdirSync(join(tmp, 'dist'), { recursive: true });

    copyFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
      join(tmp, 'scripts', 'prerender-legal.mjs'),
    );
    // Pages driven by a contentFile are all these guards need; the ones read
    // from a .tsx sourceFile are skipped with a warning when absent.
    for (const file of ['services-content.html', 'faq-content.html']) {
      copyFileSync(
        resolve(REPO_ROOT, 'scripts/prerender-content', file),
        join(tmp, 'scripts', 'prerender-content', file),
      );
    }
    writeFileSync(
      join(tmp, 'dist', 'index.html'),
      '<!DOCTYPE html><html><head>' +
        `<meta http-equiv="Content-Security-Policy" content="${TEST_CSP}">` +
        '</head><body><div id="root"></div>' +
        '<script type="module" crossorigin src="/assets/index-TEST.js"></script>' +
        '</body></html>',
    );

    execFileSync(process.execPath, [join(tmp, 'scripts', 'prerender-legal.mjs')], {
      stdio: 'pipe',
    });

    return readFileSync(join(tmp, 'dist', page, 'index.html'), 'utf8');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

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
    const generated = prerenderToTempDir('services');

    expect(generated).toContain(
      '<script type="module" crossorigin src="/assets/index-TEST.js"></script>',
    );
    // Nothing may follow the bundle tag unclosed: the document must still
    // parse through to </html>.
    expect(generated.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries the same CSP as index.html onto every prerendered page', () => {
    // Prerendered pages boot the full SPA, and the app's only CSP is the meta
    // tag in index.html (_headers sets CSP for /embed alone). Without this,
    // any session entered through /services, /terms, /faq, ... runs the whole
    // app unprotected, because an SPA never reloads the document.
    for (const page of ['services', 'faq']) {
      expect(prerenderToTempDir(page)).toContain(
        `<meta http-equiv="Content-Security-Policy" content="${TEST_CSP}">`,
      );
    }
  });
});

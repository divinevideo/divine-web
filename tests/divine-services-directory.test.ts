import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DIVINE_SERVICES } from '../src/config/divineServices';

const REPO_ROOT = resolve(__dirname, '..');

const TEST_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:";

let outDir: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'prerender-guard-'));
  writeFileSync(
    join(outDir, 'index.html'),
    '<!DOCTYPE html><html><head>' +
      `<meta http-equiv="Content-Security-Policy" content="${TEST_CSP}">` +
      '</head><body><div id="root"></div>' +
      '<script type="module" crossorigin src="/assets/index-TEST.js"></script>' +
      '</body></html>',
  );
  execFileSync(process.execPath, [resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'), '--out-dir', outDir], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    timeout: 60_000,
  });
}, 90_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const generated = (page: string) => readFileSync(join(outDir, page, 'index.html'), 'utf8');

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
    const generatedHtml = generated('services');

    expect(generatedHtml).toContain(
      '<script type="module" crossorigin src="/assets/index-TEST.js"></script>',
    );
    // Nothing may follow the bundle tag unclosed: the document must still
    // parse through to </html>.
    expect(generatedHtml.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries the same CSP as index.html onto every prerendered page', () => {
    // Prerendered pages boot the full SPA, and the app's only CSP is the meta
    // tag in index.html (_headers sets CSP for /embed alone). Without this,
    // any session entered through /services, /terms, /faq, ... runs the whole
    // app unprotected, because an SPA never reloads the document.
    for (const page of ['services', 'faq']) {
      expect(generated(page)).toContain(
        `<meta http-equiv="Content-Security-Policy" content="${TEST_CSP}">`,
      );
    }
  });

  it('writes the table head, escaped, onto a legal page', () => {
    const dmca = generated('dmca');
    expect(dmca).toContain('<title>DMCA &amp; Copyright Policy - Divine</title>');
    expect(dmca).toContain('<meta property="og:url" content="https://divine.video/dmca">');
    expect(dmca).not.toContain('Divine Web</title>');
  });
});

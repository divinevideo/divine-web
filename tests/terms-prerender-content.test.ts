import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..');

/**
 * Runs the real prerender script against a fixture dist/ and source tree in a
 * temp directory and returns the generated /terms page. The script reads the
 * React page and the English locale catalog relative to its own location, so
 * both are copied in to exercise the real resolution path.
 */
function prerenderTerms(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'terms-prerender-'));

  try {
    mkdirSync(join(tmp, 'scripts'), { recursive: true });
    mkdirSync(join(tmp, 'dist'), { recursive: true });
    mkdirSync(join(tmp, 'src', 'pages'), { recursive: true });
    mkdirSync(join(tmp, 'src', 'lib', 'i18n', 'locales', 'en'), { recursive: true });

    copyFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
      join(tmp, 'scripts', 'prerender-legal.mjs'),
    );
    copyFileSync(
      resolve(REPO_ROOT, 'src', 'pages', 'TermsPage.tsx'),
      join(tmp, 'src', 'pages', 'TermsPage.tsx'),
    );
    copyFileSync(
      resolve(REPO_ROOT, 'src', 'lib', 'i18n', 'locales', 'en', 'common.json'),
      join(tmp, 'src', 'lib', 'i18n', 'locales', 'en', 'common.json'),
    );

    writeFileSync(
      join(tmp, 'dist', 'index.html'),
      '<!DOCTYPE html><html><head>' +
        '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'">' +
        '</head><body><div id="root"></div>' +
        '<script type="module" crossorigin src="/assets/index-TEST.js"></script>' +
        '</body></html>',
    );

    execFileSync(process.execPath, [join(tmp, 'scripts', 'prerender-legal.mjs')], {
      stdio: 'pipe',
    });

    return readFileSync(join(tmp, 'dist', 'terms', 'index.html'), 'utf8');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('prerendered terms of service', () => {
  const html = prerenderTerms();

  it('resolves every translated string instead of leaking template placeholders', () => {
    // The page title and update date are t() calls; before the resolver learned
    // to handle the default namespace and interpolation options they shipped as
    // literal "{t('termsPage.title')}" text to crawlers and App Review.
    expect(html).not.toContain("{t('");
    expect(html).toContain('<title>Terms of Service - Divine Web</title>');
    expect(html).toContain('Last Updated: September 25, 2026');
  });

  it('renders both new sections with stable deep-link anchors', () => {
    expect(html).toContain('id="subscriptions"');
    expect(html).toContain('id="apple-app-store"');
    expect(html).toContain('23. Subscriptions and In-App Purchases');
    expect(html).toContain('24. Apple App Store Additional Terms');
  });

  it('includes the subscription disclosure the stores require', () => {
    expect(html).toContain('Divine Supporter Monthly');
    expect(html).toContain('Divine Founding Supporter');
    expect(html).toContain('24 hours before the current period ends');
    expect(html).toContain('reportaproblem.apple.com');
    expect(html).toContain('Supporting unlocks nothing');
  });

  it('includes the Apple minimum EULA terms', () => {
    expect(html).toContain('Verse Communications, Inc.');
    expect(html).toContain('not with Apple');
    expect(html).toContain('third-party beneficiaries');
    expect(html).toContain('9450 SW Gemini Dr PMB 21667\nBeaverton, Oregon 97008-7105 US');
    expect(html).not.toContain('[postal address pending legal review]');
  });

  it('names the same supplied legal entity throughout the rendered terms', () => {
    expect(html).toContain('The Service is provided by Verse Communications, Inc.');
    expect(html).not.toContain('Verse Communications PBC');
    expect(html).not.toContain('dba Divine');
  });

  it('keeps the supplied developer contact identical in every locale catalog', () => {
    const english = JSON.parse(readFileSync(resolve(REPO_ROOT, 'src/lib/i18n/locales/en/common.json'), 'utf8')).termsPage.appleStore.developerContact;
    expect(english).toContain('Verse Communications, Inc.');
    expect(english).toContain('9450 SW Gemini Dr PMB 21667\nBeaverton, Oregon 97008-7105 US');
    for (const locale of readdirSync(resolve(REPO_ROOT, 'src/lib/i18n/locales'))) {
      const catalog = JSON.parse(readFileSync(resolve(REPO_ROOT, 'src/lib/i18n/locales', locale, 'common.json'), 'utf8'));
      expect(catalog.termsPage.appleStore.developerContact, locale).toBe(english);
    }
  });
});

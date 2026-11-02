import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '@/lib/i18n/config';

const REPO_ROOT = resolve(__dirname, '..');

const LEGAL_PAGES = ['TermsPage.tsx', 'PrivacyPage.tsx', 'SafetyPage.tsx', 'DMCAPage.tsx'];

interface PrerenderOptions {
  /** Edits a copied page's source before the script reads it. */
  editPage?: (file: string, source: string) => string;
  /** Edits the copied English common catalog before the script reads it. */
  editCatalog?: (catalog: Record<string, unknown>) => void;
}

/**
 * Runs the real prerender script against a fixture dist/ and source tree in a
 * temp directory and returns a reader for the generated pages. The script reads
 * the React pages and the English locale catalogs relative to its own location,
 * so both are copied in to exercise the real resolution path. A script failure
 * propagates as a thrown error carrying the script's stderr.
 */
function prerenderLegalPages(options: PrerenderOptions = {}): (route: string) => string {
  const tmp = mkdtempSync(join(tmpdir(), 'terms-prerender-'));

  try {
    mkdirSync(join(tmp, 'scripts'), { recursive: true });
    mkdirSync(join(tmp, 'dist'), { recursive: true });
    mkdirSync(join(tmp, 'src', 'pages'), { recursive: true });

    copyFileSync(
      resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'),
      join(tmp, 'scripts', 'prerender-legal.mjs'),
    );
    for (const file of LEGAL_PAGES) {
      const source = readFileSync(resolve(REPO_ROOT, 'src', 'pages', file), 'utf8');
      writeFileSync(
        join(tmp, 'src', 'pages', file),
        options.editPage ? options.editPage(file, source) : source,
      );
    }

    const localesDir = join(tmp, 'src', 'lib', 'i18n', 'locales', 'en');
    cpSync(resolve(REPO_ROOT, 'src', 'lib', 'i18n', 'locales', 'en'), localesDir, { recursive: true });
    if (options.editCatalog) {
      const catalogPath = join(localesDir, 'common.json');
      const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
      options.editCatalog(catalog);
      writeFileSync(catalogPath, JSON.stringify(catalog));
    }

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

    const pages = new Map<string, string>();
    for (const route of ['terms', 'privacy', 'safety', 'dmca']) {
      pages.set(route, readFileSync(join(tmp, 'dist', route, 'index.html'), 'utf8'));
    }
    return (route) => {
      const html = pages.get(route);
      if (html === undefined) throw new Error(`No prerendered page for /${route}`);
      return html;
    };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('prerendered terms of service', () => {
  let html: string;

  beforeAll(() => {
    html = prerenderLegalPages()('terms');
  });

  it('resolves every translated string instead of leaking template placeholders', () => {
    // The page title and update date are t() calls; before the resolver learned
    // to handle the default namespace and interpolation options they shipped as
    // literal "{t('termsPage.title')}" text to crawlers and App Review.
    expect(html).not.toContain("{t('");
    expect(html).toContain('<title>Terms of Service - Divine Web</title>');
    expect(html).toContain('Last Updated: September 25, 2026');
  });

  it('renders inline style props as HTML attributes instead of leaking JSX', () => {
    // Section 19's warranty and liability disclaimers are set in capitals through
    // style={{ textTransform: 'uppercase' }} (a conspicuousness requirement). The
    // prerender used to ship that JSX verbatim, so crawlers and App Review got four
    // paragraphs with junk attributes and no capitals.
    expect(html).not.toMatch(/style=\{/);
    expect(html).toContain('<p class="mb-3" style="text-transform: uppercase">');
  });

  it('renders both new sections with stable deep-link anchors', () => {
    expect(html).toContain('id="subscriptions"');
    expect(html).toContain('id="apple-app-store"');
    expect(html).toContain('23. Subscriptions and In-App Purchases');
    expect(html).toContain('24. Apple App Store Additional Terms');
  });

  it('offsets the deep-link sections below the fixed header', () => {
    // MarketingHeader is fixed, and ScrollToTop calls scrollIntoView({ block: 'start' })
    // for a hash, so without scroll-mt the heading lands underneath the nav. The
    // other static pages use scroll-mt-24 for the same reason (see Anchor).
    expect(html).toMatch(/<section id="subscriptions" class="scroll-mt-24">/);
    expect(html).toMatch(/<section id="apple-app-store" class="scroll-mt-24">/);
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
    expect(html).toContain('other accounts associated with the purchaser through Family Sharing or volume purchasing');
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
    for (const locale of SUPPORTED_LOCALES) {
      const catalog = JSON.parse(readFileSync(resolve(REPO_ROOT, 'src/lib/i18n/locales', locale, 'common.json'), 'utf8'));
      expect(catalog.termsPage.appleStore.developerContact, locale).toBe(english);
    }
  });
});

describe('prerendered legal pages', () => {
  it('resolves the privacy page title and update date instead of leaking placeholders', () => {
    // PrivacyPage calls useTranslation() with no namespace and passes the date as
    // an interpolation option, the same shape that shipped "{t('privacyPage.title')}"
    // to crawlers before the resolver learned the default namespace.
    const html = prerenderLegalPages()('privacy');

    expect(html).not.toMatch(/\{t\(|\{\{/);
    expect(html).toContain('>Privacy Policy</h1>');
    expect(html).toMatch(/Last Updated: [A-Z][a-z]+ \d{1,2}, \d{4}/);
  });

  it('leaves no template placeholders on the safety and DMCA pages', () => {
    const read = prerenderLegalPages();

    for (const route of ['safety', 'dmca']) {
      expect(read(route), route).not.toMatch(/\{t\(|\{\{/);
    }
  });

  // A leak used to be silent: the script left the {t('…')} call in the output,
  // exited 0, and the build shipped it. These pin that it now fails loudly.
  describe('refuses to ship content it cannot resolve', () => {
    it('fails when a translation key is missing from the English catalog', () => {
      expect(() =>
        prerenderLegalPages({
          editCatalog: (catalog) => {
            delete (catalog.termsPage as Record<string, unknown>).title;
          },
        }),
      ).toThrow(/termsPage\.title/);
    });

    it('fails when an interpolation option is not a plain string literal', () => {
      expect(() =>
        prerenderLegalPages({
          editPage: (file, source) =>
            file === 'TermsPage.tsx'
              ? source.replace("{ date: 'September 25, 2026' }", '{ date: LAST_UPDATED }')
              : source,
        }),
      ).toThrow(/termsPage\.lastUpdated/);
    });

    it('fails when a t() call uses a form the resolver does not recognize', () => {
      expect(() =>
        prerenderLegalPages({
          editPage: (file, source) =>
            file === 'TermsPage.tsx'
              ? source.replace("{t('termsPage.title')}", '{t("termsPage.title")}')
              : source,
        }),
      ).toThrow(/unconverted JSX/);
    });
  });
});

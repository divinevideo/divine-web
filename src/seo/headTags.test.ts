// ABOUTME: Tests for the shared link-preview head renderer used by build scripts and tests
// ABOUTME: Covers rendering, stripping the homepage shell's tags, escaping, verification, and sitemap output

import { describe, expect, it } from 'vitest';

import {
  HEAD_TAG_KEYS,
  checkHeadTags,
  decodeHtml,
  escapeHtml,
  readHeadTags,
  renderHeadTags,
  renderSitemap,
  replaceHeadTags,
  type ResolvedPageHead,
} from './headTags';

const HEAD: ResolvedPageHead = {
  path: '/dmca',
  title: 'DMCA & Copyright Policy - Divine',
  description: 'What Divine can and can\'t take down, and how to file a "counter-notice".',
  previewTitle: 'DMCA & Copyright Policy',
  previewDescription: 'What Divine can and can\'t take down, and how to file a "counter-notice".',
  canonical: 'https://divine.video/dmca',
  type: 'website',
  siteName: 'Divine',
  image: { url: 'https://divine.video/og.png', width: 1200, height: 630, type: 'image/png', alt: 'DMCA & Copyright Policy' },
};

// Mirrors the tags index.html carries today, including ones the renderer must replace.
const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
    <!-- No static canonical here -->
    <title>Divine Web - Short-form Looping Videos on Nostr</title>
    <meta name="description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta name="theme-color" content="#27C58B" />
    <meta name="apple-mobile-web-app-title" content="Divine" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://divine.video/" />
    <meta property="og:title" content="Divine Web - Short-form Looping Videos on Nostr" />
    <meta property="og:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta property="og:image" content="https://divine.video/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Divine Web - Short-form looping videos on the Nostr network" />
    <meta property="og:image:type" content="image/png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Divine Web - Short-form Looping Videos on Nostr" />
    <meta name="twitter:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta name="twitter:image" content="https://divine.video/og.png" />
    <link rel="icon" type="image/png" sizes="72x72" href="/favicon.png" />
  </head>
  <body><div id="root"></div></body>
</html>
`;

describe('renderHeadTags', () => {
  it('emits every owned tag exactly once', () => {
    const html = `<html><head>${renderHeadTags(HEAD)}</head></html>`;
    const found = readHeadTags(html);
    for (const key of HEAD_TAG_KEYS) {
      expect(found.get(key), key).toHaveLength(1);
    }
  });

  it('escapes values so special characters survive the round trip', () => {
    const rendered = renderHeadTags(HEAD);
    expect(rendered).toContain('<title>DMCA &amp; Copyright Policy - Divine</title>');
    expect(rendered).toContain('&quot;counter-notice&quot;');
    expect(checkHeadTags(`<html><head>${rendered}</head></html>`, HEAD)).toEqual([]);
  });

  it('refuses to render an empty value', () => {
    expect(() => renderHeadTags({ ...HEAD, description: '' })).toThrow('/dmca: no value for head tag description');
  });
});

describe('replaceHeadTags', () => {
  it('replaces every homepage tag and keeps everything else', () => {
    const out = replaceHeadTags(SHELL, HEAD);
    expect(checkHeadTags(out, HEAD)).toEqual([]);
    expect(out).not.toContain('Divine Web');
    expect(out).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`);
    expect(out).toContain('<meta name="theme-color" content="#27C58B" />');
    expect(out).toContain('<meta name="apple-mobile-web-app-title" content="Divine" />');
    expect(out).toContain('<link rel="icon" type="image/png" sizes="72x72" href="/favicon.png" />');
    expect(out).toContain('<body><div id="root"></div></body>');
  });

  it('is idempotent', () => {
    const once = replaceHeadTags(SHELL, HEAD);
    expect(replaceHeadTags(once, HEAD)).toBe(once);
  });

  it('throws when the source has no head', () => {
    expect(() => replaceHeadTags('<html><body></body></html>', HEAD)).toThrow('No <head>');
  });
});

describe('checkHeadTags', () => {
  it('reports a duplicated tag', () => {
    const out = replaceHeadTags(SHELL, HEAD).replace(
      '</head>',
      '<meta property="og:image:alt" content="extra"></head>',
    );
    expect(checkHeadTags(out, HEAD)).toContain('og:image:alt: expected 1 tag, found 2');
  });

  it('reports a wrong value', () => {
    const out = replaceHeadTags(SHELL, { ...HEAD, canonical: 'https://divine.video/' });
    expect(checkHeadTags(out, HEAD)).toContain(
      'og:url: expected "https://divine.video/dmca", found "https://divine.video/"',
    );
  });
});

describe('escapeHtml / decodeHtml', () => {
  it('round-trips quotes, ampersands, angle brackets and apostrophes', () => {
    const value = `Tom & Jerry's "<b>" — Can't`;
    expect(decodeHtml(escapeHtml(value))).toBe(value);
  });
});

describe('renderSitemap', () => {
  it('lists each entry with an optional lastmod and nothing else', () => {
    const xml = renderSitemap([
      { loc: 'https://divine.video/' },
      { loc: 'https://divine.video/family', lastmod: '2026-07-22' },
    ]);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n    <loc>https://divine.video/</loc>\n  </url>\n' +
        '  <url>\n    <loc>https://divine.video/family</loc>\n    <lastmod>2026-07-22</lastmod>\n  </url>\n' +
        '</urlset>\n',
    );
  });
});

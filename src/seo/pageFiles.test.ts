// ABOUTME: Tests the build step that writes a static head for each fixed page, and the sitemap
// ABOUTME: Runs against the real index.html shell so stripping the homepage tags is proven on real input

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { ResolvedPageHead } from './headTags';
import { buildPageFiles, buildSitemap, checkPageFiles, pageFilePath } from './pageFiles';
import { resolveAllPageSeoForBuild } from './pageSeo';

const shell = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
let heads: ResolvedPageHead[];

beforeAll(async () => {
  heads = await resolveAllPageSeoForBuild();
});

describe('pageFilePath', () => {
  it('maps a path to its index.html', () => {
    expect(pageFilePath('/kids')).toBe('kids/index.html');
    expect(pageFilePath('/exit/start')).toBe('exit/start/index.html');
  });
});

describe('buildPageFiles', () => {
  it('writes one file per row that no other prerender owns', () => {
    const files = buildPageFiles(shell, heads).map((f) => f.file).sort();
    const expected = heads.filter((h) => !h.prerenderedBy).map((h) => pageFilePath(h.path)).sort();
    expect(files).toEqual(expected);
    expect(files).toContain('kids/index.html');
    expect(files).not.toContain('terms/index.html');
  });

  it('produces files that pass the self-check', () => {
    const files = new Map(buildPageFiles(shell, heads).map((f) => [f.file, f.html]));
    const own = heads.filter((h) => !h.prerenderedBy);
    expect(checkPageFiles(own, (file) => files.get(file))).toEqual([]);
  });

  it('keeps the CSP and the app bundle script', () => {
    const [kids] = buildPageFiles(shell, heads).filter((f) => f.file === 'kids/index.html');
    expect(kids.html).toMatch(/<meta http-equiv="Content-Security-Policy"/);
    expect(kids.html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(kids.html).not.toContain('Divine Web');
  });
});

describe('checkPageFiles', () => {
  it('reports a missing file', () => {
    const [kids] = heads.filter((h) => h.path === '/kids');
    expect(checkPageFiles([kids], () => undefined)).toEqual(['/kids: missing kids/index.html']);
  });

  it('reports a homepage og:url', () => {
    const [kids] = heads.filter((h) => h.path === '/kids');
    const html = buildPageFiles(shell, [kids])[0].html.replace(
      '<meta property="og:url" content="https://divine.video/kids">',
      '<meta property="og:url" content="https://divine.video/">',
    );
    expect(checkPageFiles([kids], () => html)).toEqual([
      '/kids: og:url: expected "https://divine.video/kids", found "https://divine.video/"',
    ]);
  });
});

describe('buildSitemap', () => {
  it('lists the home page and every table row, and nothing else', () => {
    const locs = [...buildSitemap(heads).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(['https://divine.video/', ...heads.map((h) => h.canonical)]);
  });

  it('dates the family pages', () => {
    const xml = buildSitemap(heads);
    for (const path of ['/family', '/family/media-plan']) {
      expect(xml).toContain(`<loc>https://divine.video${path}</loc>\n    <lastmod>2026-07-22</lastmod>`);
    }
  });

  it('keeps the dates the hand-kept sitemap had', () => {
    const xml = buildSitemap(heads);
    const expected: Record<string, string> = {
      '/kids': '2026-07-22',
      '/exit': '2026-08-15',
      '/download': '2026-08-21',
      '/delete-account': '2026-08-15',
    };
    for (const [path, lastmod] of Object.entries(expected)) {
      expect(xml).toContain(`<loc>https://divine.video${path}</loc>\n    <lastmod>${lastmod}</lastmod>`);
    }
  });
});

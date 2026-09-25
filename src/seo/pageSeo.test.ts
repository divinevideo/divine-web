// ABOUTME: Tests for the fixed-page link-preview table and its resolver
// ABOUTME: Guards copy limits, translation keys, images, the title suffix rule, and path matching

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Plain JS config in the Fastly package; typed as any (noImplicitAny is off), so no directive is needed.
import publishConfig from '../../compute-js/publish-content.config.js';
import {
  BRAND_DEFAULT_DESCRIPTION,
  BRAND_DEFAULT_TITLE,
  DEFAULT_IMAGE,
  PAGE_SEO,
  findPageSeo,
  normalizePath,
  resolveAllPageSeoForBuild,
  resolvePageSeo,
  withTitleSuffix,
  type Translate,
} from './pageSeo';

const LOCALES_DIR = join(process.cwd(), 'src/lib/i18n/locales/en');

// Read from disk: tsconfig.app.json type-checks src/ tests and has no resolveJsonModule.
function englishValue(key: string, ns = 'common'): unknown {
  const messages: unknown = JSON.parse(readFileSync(join(LOCALES_DIR, `${ns}.json`), 'utf8'));
  return key.split('.').reduce<unknown>(
    (value, segment) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined),
    messages,
  );
}

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('PAGE_SEO', () => {
  it('lists 28 unique paths', () => {
    const paths = PAGE_SEO.map((row) => row.path);
    expect(paths).toHaveLength(28);
    expect(new Set(paths).size).toBe(28);
  });

  it('keeps descriptions between 1 and 200 characters', () => {
    for (const row of PAGE_SEO) {
      for (const text of [row.description, row.previewDescription].filter(Boolean) as string[]) {
        expect(text.length, row.path).toBeGreaterThan(0);
        expect(text.length, row.path).toBeLessThanOrEqual(200);
      }
    }
  });

  it('never says "Divine Web"', () => {
    for (const row of PAGE_SEO) {
      expect(JSON.stringify(row), row.path).not.toContain('Divine Web');
    }
  });

  it('references only translation keys that exist in English', () => {
    for (const row of PAGE_SEO) {
      if (typeof row.title !== 'string') {
        expect(typeof englishValue(row.title.key, row.title.ns), `${row.path} ${row.title.key}`).toBe('string');
      }
    }
  });

  it('uses 1200x630 PNG images that the Fastly publish step includes', () => {
    for (const image of new Set(PAGE_SEO.map((row) => row.image ?? DEFAULT_IMAGE))) {
      expect(image).toMatch(/^\/[\w-]+\.png$/);
      expect(pngSize(join(process.cwd(), 'public', image)), image).toEqual({ width: 1200, height: 630 });
      expect(publishConfig.kvStoreAssetInclusionTest(image), image).toBe(true);
    }
  });

  it('matches the homepage title and description in index.html', () => {
    const indexHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(indexHtml).toContain(`<title>${BRAND_DEFAULT_TITLE}</title>`);
    expect(indexHtml).toContain(`<meta name="description" content="${BRAND_DEFAULT_DESCRIPTION}" />`);
  });
});

describe('withTitleSuffix', () => {
  it('appends " - Divine" when the title does not name Divine', () => {
    expect(withTitleSuffix('Trending')).toBe('Trending - Divine');
  });

  it('leaves titles that already name Divine alone', () => {
    expect(withTitleSuffix('Leaderboard - Divine')).toBe('Leaderboard - Divine');
    expect(withTitleSuffix('Merch — Divine')).toBe('Merch — Divine');
    expect(withTitleSuffix('Download Divine')).toBe('Download Divine');
    expect(withTitleSuffix('Kids on Divine — How accounts work for under-16s')).toBe('Kids on Divine — How accounts work for under-16s');
  });
});

describe('normalizePath / findPageSeo', () => {
  it('treats a trailing slash like the bare path', () => {
    expect(normalizePath('/kids/')).toBe('/kids');
    expect(normalizePath('/')).toBe('/');
    expect(findPageSeo('/kids/')?.path).toBe('/kids');
    expect(findPageSeo('/family/media-plan/')?.path).toBe('/family/media-plan');
  });

  it('returns undefined for pages outside the table', () => {
    expect(findPageSeo('/')).toBeUndefined();
    expect(findPageSeo('/discovery')).toBeUndefined();
    expect(findPageSeo('/kidsx')).toBeUndefined();
  });
});

describe('resolvePageSeo', () => {
  const identity: Translate = (key) => key;

  it('derives canonical, image, type, site name and preview defaults', () => {
    const head = resolvePageSeo(findPageSeo('/download')!, identity);
    expect(head).toMatchObject({
      path: '/download',
      title: 'Download Divine',
      previewTitle: 'Download Divine',
      previewDescription: head.description,
      canonical: 'https://divine.video/download',
      type: 'website',
      siteName: 'Divine',
      image: { url: 'https://divine.video/og.png', width: 1200, height: 630, type: 'image/png', alt: 'Download the Divine mobile app' },
    });
  });

  it('keeps a canonical without a trailing slash', () => {
    expect(resolvePageSeo(findPageSeo('/kids/')!, identity).canonical).toBe('https://divine.video/kids');
  });

  it('suffixes a translated title that does not name Divine', () => {
    const t: Translate = () => 'Tendencias';
    expect(resolvePageSeo(findPageSeo('/trending')!, t).title).toBe('Tendencias - Divine');
    expect(resolvePageSeo(findPageSeo('/trending')!, t).previewTitle).toBe('Tendencias');
  });

  it('does not double-suffix a translated title that already names Divine', async () => {
    const [leaderboard] = (await resolveAllPageSeoForBuild(['de'])).filter((head) => head.path === '/leaderboard');
    expect(leaderboard.title).toBe('Bestenliste - Divine');
  });

  it('resolves every row in English for the build', async () => {
    const heads = await resolveAllPageSeoForBuild();
    expect(heads).toHaveLength(28);
    PAGE_SEO.forEach((row, index) => {
      const head = heads[index];
      if (typeof row.title !== 'string') {
        // i18next returns the key itself when a translation is missing
        expect(head.previewTitle, row.path).not.toBe(row.title.key);
      }
      expect(head.title, row.path).toMatch(/Divine/);
    });
    expect(heads.find((head) => head.path === '/dmca')?.title).toBe('DMCA & Copyright Policy - Divine');
  });
});

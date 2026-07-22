// ABOUTME: Tests for public/robots.txt and public/sitemap.xml
// ABOUTME: Guards that the five family routes stay in the sitemap and robots stays permissive

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('public robots.txt', () => {
  const robots = readFileSync(join(process.cwd(), 'public/robots.txt'), 'utf8');

  it('allows all crawlers', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Allow: \/$/m);
    expect(robots).not.toMatch(/^Disallow: \/family/m);
  });

  it('points at the sitemap', () => {
    expect(robots).toContain('Sitemap: https://divine.video/sitemap.xml');
  });
});

describe('public sitemap.xml', () => {
  const sitemap = readFileSync(join(process.cwd(), 'public/sitemap.xml'), 'utf8');

  it('lists all five family routes', () => {
    for (const path of [
      '/family',
      '/family/talking-to-your-teen',
      '/family/media-plan',
      '/family/when-something-goes-wrong',
      '/family/safety-tools',
    ]) {
      expect(sitemap).toContain(`<loc>https://divine.video${path}</loc>`);
    }
  });

  it('gives family routes a lastmod date', () => {
    const familyEntries = sitemap.split('<url>').filter((e) => e.includes('/family'));
    expect(familyEntries.length).toBeGreaterThanOrEqual(5);
    for (const entry of familyEntries) {
      expect(entry).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    }
  });

  it('links the kids policy page', () => {
    expect(sitemap).toContain('<loc>https://divine.video/kids</loc>');
  });
});

// ABOUTME: Tests for public/robots.txt
// ABOUTME: Guards that robots stays permissive and points at the generated sitemap (see src/seo/pageFiles.test.ts)

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

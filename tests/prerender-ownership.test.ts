// ABOUTME: Guards that PAGE_SEO's prerenderedBy markers match what each prerender script renders
// ABOUTME: A mismatch would leave a page with no file or with two writers

import { describe, expect, it } from 'vitest';

// @ts-expect-error - plain ESM build script, no type declarations
import { PAGES } from '../scripts/prerender-legal.mjs';
import { MARKETING_SSG_ROUTES } from '../src/prerender/render-marketing';
import { PAGE_SEO } from '../src/seo/pageSeo';

const owned = (owner: 'legal' | 'marketing') =>
  PAGE_SEO.filter((row) => row.prerenderedBy === owner).map((row) => row.path).sort();

describe('prerender ownership', () => {
  it('marks exactly the legal script pages as legal', () => {
    expect(owned('legal')).toEqual((PAGES as Array<{ path: string }>).map((page) => page.path).sort());
  });

  it('marks exactly the family SSG routes as marketing', () => {
    expect(owned('marketing')).toEqual([...MARKETING_SSG_ROUTES].sort());
  });
});

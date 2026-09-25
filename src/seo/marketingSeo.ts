// ABOUTME: Family route SEO view over the shared PAGE_SEO table, plus family-only breadcrumb labels
// ABOUTME: Consumed by the family JSON-LD components, the family SSG prerender, and tests

import { MARKETING_PUBLICATION_DATE, PAGE_SEO, SITE_ORIGIN } from './pageSeo';

export { MARKETING_PUBLICATION_DATE, SITE_ORIGIN };

export interface MarketingSeoRoute {
  path: string;
  /** <title> */
  title: string;
  /** <meta name="description"> */
  description: string;
  /** og:title */
  ogTitle: string;
  /** og:description */
  ogDescription: string;
  /** Absolute og:image URL (1200x630) */
  ogImage: string;
  ogType: 'website' | 'article';
  /** Self-referencing canonical URL */
  canonical: string;
  /** Breadcrumb label (empty for the hub) */
  breadcrumb: string;
}

const BREADCRUMBS: Readonly<Record<string, string>> = {
  '/family': '',
  '/family/talking-to-your-teen': 'Talking with your teen',
  '/family/media-plan': 'Family media plan',
  '/family/when-something-goes-wrong': 'When something goes wrong',
  '/family/safety-tools': 'Safety tools',
};

export const FAMILY_SEO: MarketingSeoRoute[] = PAGE_SEO.filter((row) => row.prerenderedBy === 'marketing').map((row) => {
  if (typeof row.title !== 'string') {
    throw new Error(`${row.path}: family titles are plain English`);
  }
  return {
    path: row.path,
    title: row.title,
    description: row.description,
    ogTitle: row.previewTitle ?? row.title,
    ogDescription: row.previewDescription ?? row.description,
    ogImage: `${SITE_ORIGIN}${row.image ?? '/og.png'}`,
    ogType: row.type ?? 'website',
    canonical: `${SITE_ORIGIN}${row.path}`,
    breadcrumb: BREADCRUMBS[row.path] ?? '',
  };
});

export function getFamilySeo(path: string): MarketingSeoRoute | undefined {
  return FAMILY_SEO.find((r) => r.path === path);
}

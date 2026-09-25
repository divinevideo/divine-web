// ABOUTME: Sets the browser tab title and preview tags for fixed pages from PAGE_SEO, once, at the router level
// ABOUTME: Routes with no row get the brand default title and description at low priority, so page-level titles win

import { useHead, useSeoMeta } from '@unhead/react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import type { ResolvedPageHead } from '@/seo/headTags';
import {
  BRAND_DEFAULT_DESCRIPTION,
  BRAND_DEFAULT_TITLE,
  findPageSeo,
  resolvePageSeo,
  type Translate,
} from '@/seo/pageSeo';

function PageHead({ head }: { head: ResolvedPageHead }) {
  useSeoMeta({
    title: head.title,
    description: head.description,
    ogType: head.type,
    ogUrl: head.canonical,
    ogTitle: head.previewTitle,
    ogDescription: head.previewDescription,
    ogImage: head.image.url,
    ogImageWidth: head.image.width,
    ogImageHeight: head.image.height,
    ogImageType: head.image.type as 'image/png',
    ogImageAlt: head.image.alt,
    ogSiteName: head.siteName,
    twitterCard: 'summary_large_image',
    twitterTitle: head.previewTitle,
    twitterDescription: head.previewDescription,
    twitterImage: head.image.url,
  });
  // useSeoMeta cannot emit <link rel="canonical">
  useHead({ link: [{ rel: 'canonical', href: head.canonical }] });
  return null;
}

// Title and description only. Setting og:* here would tie with InferSeoMetaPlugin's
// low-priority tags and, being registered later, replace a page's inferred preview title.
function BrandDefaultHead() {
  useHead(
    { title: BRAND_DEFAULT_TITLE, meta: [{ name: 'description', content: BRAND_DEFAULT_DESCRIPTION }] },
    { tagPriority: 'low' },
  );
  return null;
}

export function PageSeoForRoute() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const row = findPageSeo(pathname);
  if (!row) return <BrandDefaultHead />;
  const translate: Translate = (key, options) => t(key, options);
  return <PageHead head={resolvePageSeo(row, translate)} />;
}

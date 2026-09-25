// ABOUTME: Single source of truth for fixed public pages' titles, descriptions, and preview images
// ABOUTME: Feeds the build-time static page heads, browser tab titles, the sitemap, and route coverage tests

import { createI18nInstance } from '@/lib/i18n';

import type { ResolvedPageHead } from './headTags';

export const SITE_ORIGIN = 'https://divine.video';
export const SITE_NAME = 'Divine';
export const DEFAULT_IMAGE = '/og.png';
export const MARKETING_PUBLICATION_DATE = '2026-07-22';

/** index.html's own title and description; shown for routes with no row */
export const BRAND_DEFAULT_TITLE = 'Divine Web - Short-form Looping Videos on Nostr';
export const BRAND_DEFAULT_DESCRIPTION = 'Watch and share 6-second looping videos on the decentralized Nostr network.';

/** Plain English, or a translation key the page itself already renders */
export type SeoText = string | { key: string; ns?: string };

export interface PageSeoRow {
  path: string;
  title: SeoText;
  /** Plain English, at most 200 characters */
  description: string;
  /** og:title / twitter:title when they should differ from the page title */
  previewTitle?: string;
  previewDescription?: string;
  /** Site-relative 1200x630 PNG; defaults to DEFAULT_IMAGE */
  image?: string;
  /** Defaults to the preview title */
  imageAlt?: string;
  type?: 'website' | 'article';
  /** sitemap <lastmod> */
  lastModified?: string;
  /** The build script that renders this page's body; the generic step skips these rows */
  prerenderedBy?: 'legal' | 'marketing';
}

export const PAGE_SEO: readonly PageSeoRow[] = [
  {
    path: '/authenticity',
    title: { key: 'hero.title', ns: 'authenticity' },
    description: "In a world of AI-generated content, Divine is a home for real human creativity. We brought back the Vine archive, and we're keeping it human.",
  },
  {
    path: '/privacy',
    title: { key: 'privacyPage.title' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Privacy Policy for Divine - How we handle your data on the decentralized Nostr network.',
    prerenderedBy: 'legal',
  },
  {
    path: '/terms',
    title: { key: 'termsPage.title' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Terms of Service for Divine - Short-form looping videos on the Nostr network.',
    prerenderedBy: 'legal',
  },
  {
    path: '/open-source',
    title: { key: 'title', ns: 'openSource' },
    description: 'Divine is open source. Get the apps, dig into the code on GitHub, and help build short-form video that belongs to the people making it.',
  },
  {
    path: '/proofmode',
    title: { key: 'hero.title', ns: 'proofmode' },
    description: "Proofmode adds cryptographic proof to videos so you can tell real camera footage from AI fakes. Here's how it works on Divine.",
  },
  {
    path: '/human-created',
    title: { key: 'title', ns: 'humanCreated' },
    description: 'The Human-Made badge marks videos made by real people, not AI. See when it shows up on Divine and how it works with Proofmode.',
  },
  {
    path: '/dmca',
    title: { key: 'title', ns: 'dmca' },
    // Replaces the old legal-script copy, which described sections the page no longer has
    description: "How to report copyright infringement to Divine, file a counter-notice, and what Divine can and can't take down on an open network.",
    prerenderedBy: 'legal',
  },
  {
    path: '/safety',
    title: { key: 'title', ns: 'safety' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Safety Standards for Divine - Our commitment to protecting users and preventing child exploitation.',
    prerenderedBy: 'legal',
  },
  {
    path: '/family',
    // source: existing (src/seo/marketingSeo.ts, serverSocialMeta image alt)
    title: 'For Families on Divine — Talking With Teens About Social Media',
    description: "An honest guide for parents and teens: what Divine's safety tools do, what no app can promise, and how to build a family media plan that actually holds.",
    previewTitle: 'For Families on Divine',
    previewDescription: "Conversation over surveillance. What our safety tools do, what they can't, and how to talk with your teen about it.",
    image: '/og-family.png',
    imageAlt: 'Divine — family resource hub for parents and teens',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/talking-to-your-teen',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'How to Talk With Your Teen About Social Media — Divine for Families',
    description: 'Conversation starters and research-backed guidance for talking with your teen about social media — without surveillance, and without the blow-up.',
    previewTitle: 'How to Talk With Your Teen About Social Media',
    previewDescription: 'The goal is not to win the conversation. It is to keep having one. Conversation starters and guidance drawn from youth online-safety research.',
    image: '/og-family-talking.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/media-plan',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'Creating a Family Media Plan — Divine for Families',
    description: 'How to build a family media plan together: where and when screens make sense, healthier feed habits, and regular check-ins that actually hold.',
    previewTitle: 'Creating a Family Media Plan',
    previewDescription: 'A plan that everyone helped write is a plan that everyone is more likely to follow. Templates and habits for household screen use.',
    image: '/og-family-media-plan.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/when-something-goes-wrong',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'What to Do if Your Child Saw Something Upsetting Online — Divine',
    description: 'Four steps for when your child sees something upsetting online: pause, talk before punishing, use the in-app tools, and know when to escalate.',
    previewTitle: 'What to Do if Your Child Saw Something Upsetting Online',
    previewDescription: 'What helps most is not a perfect filter. It is a parent who reacts in a way that makes the next conversation possible. Four concrete steps.',
    image: '/og-family-when-something-goes-wrong.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/safety-tools',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'Divine Safety Tools and Content Settings — What They Can and Can’t Do',
    description: 'How content settings work on Divine: adult content gating, moderation lists, blocking, muting, and reporting — and what no app can promise.',
    previewTitle: "Divine's Safety Tools and Content Settings",
    previewDescription: 'Settings are a useful layer. They are not a guarantee. How adult-content gating, filters, blocking, and reporting work on Divine.',
    image: '/og-family-safety-tools.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/age-review',
    // source: existing (compute-js/src/index.js, src/lib/serverSocialMeta.ts)
    title: 'Account review — Divine',
    description: 'If your Divine account was flagged as possibly belonging to someone under 16, this page explains what to do — and the 15-day window for responding.',
    imageAlt: 'Divine — account review information',
  },
  {
    path: '/kids',
    // source: existing (src/lib/serverSocialMeta.ts; the Fastly copy lacked the Greenlight clause the page has)
    title: 'Kids on Divine — How accounts work for under-16s',
    description: 'How Divine handles accounts for people under 16 — the rules, the reasoning, Divine Greenlight for teens 13-15, and what families can do together regardless of age.',
    imageAlt: 'Divine — how accounts work for kids and families',
  },
  {
    path: '/download',
    // source: existing (src/pages/DownloadPage.tsx)
    title: 'Download Divine',
    description: 'Get Divine from the App Store, Google Play, or Zapstore.',
    imageAlt: 'Download the Divine mobile app',
  },
  {
    path: '/exit',
    // source: existing (src/pages/PortabilityPage.tsx)
    title: 'Account Portability on Divine',
    description: 'A plain-language guide to moving your Divine account and content to infrastructure you choose.',
  },
  {
    path: '/exit/start',
    // source: existing (src/pages/ExitStartPage.tsx)
    title: 'Export your Divine account',
    description: 'Download a portable archive of your Divine posts, video records, and media files.',
  },
  {
    path: '/delete-account',
    // source: existing (src/pages/DeleteAccountPage.tsx)
    title: 'Delete Your Divine Account',
    description: 'How to request deletion of your Divine account and what deletion can and cannot remove on an open network.',
  },
  {
    path: '/support',
    title: { key: 'support.title' },
    description: "Need a hand? We've got you. Search the Help Center, message support inside Divine, open a ticket, or report a bug on GitHub.",
  },
  {
    path: '/faq',
    title: { key: 'title', ns: 'faq' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Frequently Asked Questions about Divine - Everything you need to know about the platform.',
    previewTitle: 'Frequently Asked Questions',
    prerenderedBy: 'legal',
  },
  {
    path: '/get-embed',
    title: { key: 'getEmbedPage.title' },
    description: 'Add your latest Divine videos to any website or blog sidebar. Pick a theme, copy the code, done.',
  },
  {
    path: '/services',
    title: { key: 'servicesPage.title' },
    // source: existing (scripts/prerender-legal.mjs)
    description: 'Companion services that help you make the most of Divine: Space, Sounds, Badges, Crossposter, Verifier, and Status.',
    prerenderedBy: 'legal',
  },
  {
    path: '/merch',
    title: { key: 'merchPage.metaTitle' },
    // source: existing (merchPage.metaDescription / merchPage.ogTitle English values)
    description: "Tees, hoodies, hats, and stuff that doesn't take itself too seriously. Designed by Divine, printed and shipped by Bonfire.",
    previewTitle: 'Divine Merch',
  },
  {
    path: '/leaderboard',
    title: { key: 'leaderboardPage.seoTitle' },
    // source: existing (leaderboardPage.seoDescription / seoOgDescription English values)
    description: 'Top videos and creators by loops on Divine',
    previewDescription: 'See the most popular videos and creators',
  },
  {
    path: '/trending',
    title: { key: 'trendingPage.heading' },
    description: "See what's taking off on Divine right now. Sort by hot, new, top, rising, classic Vines, or the ones nobody can agree on.",
  },
  {
    path: '/popular',
    title: { key: 'popularPage.heading' },
    description: 'The most-watched videos on Divine. Pick fresh posts or classic Vines, from right now back to all time.',
  },
  {
    path: '/hashtags',
    title: { key: 'hashtagExplorer.heading' },
    description: 'Find trending hashtags on Divine and explore the communities behind them.',
  },
];

/** Static routes that deliberately have no row, with the reason. */
export const EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  '/': 'data-driven: the edge renders the home preview',
  '/discovery': 'data-driven: the edge renders the discovery preview',
  '/discovery/new': 'redirect to /discovery/hot',
  '/category': 'data-driven: the edge renders the category preview',
  '/search': 'data-driven: the edge renders the search preview',
  '/home': 'logged-in only',
  '/notifications': 'logged-in only',
  '/messages': 'logged-in only',
  '/analytics': 'logged-in only',
  '/lists': 'logged-in only',
  '/collabs': 'logged-in only',
  '/settings/moderation': 'logged-in only',
  '/settings/linked-accounts': 'logged-in only',
  '/settings/relays': 'logged-in only',
  '/debug-video': 'logged-in only',
  '/account-portability': 'redirect to /exit (server 301 on Fastly and Cloudflare)',
  '/app/callback': 'auth callback',
  '/auth/callback': 'auth callback',
  '/__brand-preview': 'dev only',
};

export type Translate = (key: string, options?: { ns?: string }) => string;

/** Strips one trailing slash; Cloudflare Pages serves prebuilt pages at /<path>/. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function findPageSeo(pathname: string): PageSeoRow | undefined {
  const path = normalizePath(pathname);
  return PAGE_SEO.find((row) => row.path === path);
}

export function withTitleSuffix(title: string): string {
  return /\bDivine\b/.test(title) ? title : `${title} - ${SITE_NAME}`;
}

export function resolveText(text: SeoText, t: Translate): string {
  return typeof text === 'string' ? text : t(text.key, text.ns ? { ns: text.ns } : undefined);
}

export function resolvePageSeo(row: PageSeoRow, t: Translate): ResolvedPageHead {
  const pageTitle = resolveText(row.title, t);
  const previewTitle = row.previewTitle ?? pageTitle;
  return {
    path: row.path,
    title: withTitleSuffix(pageTitle),
    description: row.description,
    previewTitle,
    previewDescription: row.previewDescription ?? row.description,
    canonical: `${SITE_ORIGIN}${row.path}`,
    type: row.type ?? 'website',
    siteName: SITE_NAME,
    image: {
      url: `${SITE_ORIGIN}${row.image ?? DEFAULT_IMAGE}`,
      width: 1200,
      height: 630,
      type: 'image/png',
      alt: row.imageAlt ?? previewTitle,
    },
    ...(row.lastModified ? { lastModified: row.lastModified } : {}),
    ...(row.prerenderedBy ? { prerenderedBy: row.prerenderedBy } : {}),
  };
}

/** Every row resolved in one language (English by default), for build scripts. */
export async function resolveAllPageSeoForBuild(languages: readonly string[] = ['en']): Promise<ResolvedPageHead[]> {
  const i18n = await createI18nInstance({ languages });
  const t: Translate = (key, options) => i18n.t(key, options);
  return PAGE_SEO.map((row) => resolvePageSeo(row, t));
}

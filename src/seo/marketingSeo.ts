// ABOUTME: Single source of truth for family/marketing route SEO metadata
// ABOUTME: Consumed by page components (client head tags), the SSG prerender script, and tests

export const SITE_ORIGIN = 'https://divine.video';
export const MARKETING_PUBLICATION_DATE = '2026-07-22';

export interface MarketingSeoRoute {
  path: string;
  /** <title> */
  title: string;
  /** <meta name="description"> */
  description: string;
  /** og:title (defaults differ from <title> only where the spec says so) */
  ogTitle: string;
  /** og:description */
  ogDescription: string;
  /** Absolute og:image URL (1200x630) */
  ogImage: string;
  ogType: 'website' | 'article';
  /** Self-referencing canonical URL */
  canonical: string;
  /** utm_campaign slug for store badge links */
  campaign: string;
  /** Breadcrumb label (empty for the hub) */
  breadcrumb: string;
}

function route(
  path: string,
  data: Omit<MarketingSeoRoute, 'path' | 'canonical' | 'ogImage' | 'campaign'> & {
    ogImage: string;
  }
): MarketingSeoRoute {
  const slug = path === '/family' ? 'family' : path.split('/').pop() ?? 'family';
  return {
    path,
    canonical: `${SITE_ORIGIN}${path}`,
    campaign: slug,
    ...data,
    ogImage: `${SITE_ORIGIN}${data.ogImage}`,
  };
}

export const FAMILY_SEO: MarketingSeoRoute[] = [
  route('/family', {
    title: 'For Families on Divine — Talking With Teens About Social Media',
    description:
      "An honest guide for parents and teens: what Divine's safety tools do, what no app can promise, and how to build a family media plan that actually holds.",
    ogTitle: 'For Families on Divine',
    ogDescription:
      "Conversation over surveillance. What our safety tools do, what they can't, and how to talk with your teen about it.",
    ogImage: '/og-family.png',
    ogType: 'website',
    breadcrumb: '',
  }),
  route('/family/talking-to-your-teen', {
    title: 'How to Talk With Your Teen About Social Media — Divine for Families',
    description:
      'Conversation starters and research-backed guidance for talking with your teen about social media — without surveillance, and without the blow-up.',
    ogTitle: 'How to Talk With Your Teen About Social Media',
    ogDescription:
      'The goal is not to win the conversation. It is to keep having one. Conversation starters and guidance drawn from youth online-safety research.',
    ogImage: '/og-family-talking.png',
    ogType: 'article',
    breadcrumb: 'Talking with your teen',
  }),
  route('/family/media-plan', {
    title: 'Creating a Family Media Plan — Divine for Families',
    description:
      'How to build a family media plan together: where and when screens make sense, healthier feed habits, and regular check-ins that actually hold.',
    ogTitle: 'Creating a Family Media Plan',
    ogDescription:
      'A plan that everyone helped write is a plan that everyone is more likely to follow. Templates and habits for household screen use.',
    ogImage: '/og-family-media-plan.png',
    ogType: 'article',
    breadcrumb: 'Family media plan',
  }),
  route('/family/when-something-goes-wrong', {
    title: 'What to Do if Your Child Saw Something Upsetting Online — Divine',
    description:
      'Four steps for when your child sees something upsetting online: pause, talk before punishing, use the in-app tools, and know when to escalate.',
    ogTitle: 'What to Do if Your Child Saw Something Upsetting Online',
    ogDescription:
      'What helps most is not a perfect filter. It is a parent who reacts in a way that makes the next conversation possible. Four concrete steps.',
    ogImage: '/og-family-when-something-goes-wrong.png',
    ogType: 'article',
    breadcrumb: 'When something goes wrong',
  }),
  route('/family/safety-tools', {
    title: 'Divine Safety Tools and Content Settings — What They Can and Can’t Do',
    description:
      'How content settings work on Divine: adult content gating, moderation lists, blocking, muting, and reporting — and what no app can promise.',
    ogTitle: "Divine's Safety Tools and Content Settings",
    ogDescription:
      'Settings are a useful layer. They are not a guarantee. How adult-content gating, filters, blocking, and reporting work on Divine.',
    ogImage: '/og-family-safety-tools.png',
    ogType: 'article',
    breadcrumb: 'Safety tools',
  }),
];

export function getFamilySeo(path: string): MarketingSeoRoute | undefined {
  return FAMILY_SEO.find((r) => r.path === path);
}

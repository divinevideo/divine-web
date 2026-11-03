// ABOUTME: Discovery page titles and description shared by the SPA and the Cloudflare function
// ABOUTME: Fastly's hot-route copy lives in compute-js/src/siteCopy.js; a test keeps them equal

const DISCOVERY_TITLES: ReadonlyMap<string, string> = new Map([
  ['hot', 'Trending Videos'],
  ['classics', 'Classic Vines'],
  ['hashtags', 'Videos by Hashtag'],
  ['foryou', 'For You Videos'],
  // Retired slugs the app redirects (new to hot, top to classics); crawlers that
  // don't follow the redirect get the title the app ends on.
  ['new', 'Trending Videos'],
  ['top', 'Classic Vines'],
]);

export const DISCOVERY_DESCRIPTION = 'Watch classic Vines and new short videos on Divine.';

export interface DiscoveryMeta {
  title: string;
  description: string;
  /** Lowercased, because the route matches the tab case-insensitively. */
  path: string;
}

export function getDiscoveryMeta(pathname: string): DiscoveryMeta {
  const path = pathname.toLowerCase();
  const tab = path.split('/')[2] ?? '';

  return {
    title: `${DISCOVERY_TITLES.get(tab) ?? 'Discover Videos'} - Divine`,
    description: DISCOVERY_DESCRIPTION,
    path,
  };
}

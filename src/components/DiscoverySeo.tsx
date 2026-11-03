import { useHead, useSeoMeta } from '@unhead/react';

const DISCOVERY_TITLES: ReadonlyMap<string, string> = new Map([
  ['hot', 'Trending Videos'],
  ['classics', 'Classic Vines'],
  ['hashtags', 'Videos by Hashtag'],
  ['foryou', 'For You Videos'],
]);

export function DiscoverySeo({ pathname }: { pathname: string }) {
  // The route matches the tab case-insensitively, so title and canonical follow suit.
  const normalizedPath = pathname.toLowerCase();
  const tab = normalizedPath.split('/')[2] ?? '';
  const title = `${DISCOVERY_TITLES.get(tab) ?? 'Discover Videos'} - Divine`;

  useSeoMeta({
    title,
    description: 'Watch classic Vines and new short videos on Divine.',
  });
  useHead({
    link: [{ rel: 'canonical', href: `https://divine.video${normalizedPath}` }],
  });

  return null;
}

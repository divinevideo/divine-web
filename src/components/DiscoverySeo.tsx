import { useHead, useSeoMeta } from '@unhead/react';

const DISCOVERY_TITLES: Record<string, string> = {
  hot: 'Trending Videos',
  classics: 'Classic Vines',
  hashtags: 'Videos by Hashtag',
  foryou: 'For You Videos',
};

export function DiscoverySeo({ pathname }: { pathname: string }) {
  const tab = pathname.split('/')[2];
  const title = `${DISCOVERY_TITLES[tab] ?? 'Discover Videos'} - Divine`;

  useSeoMeta({
    title,
    description: 'Watch classic Vines and new short videos on Divine.',
  });
  useHead({
    link: [{ rel: 'canonical', href: `https://divine.video${pathname}` }],
  });

  return null;
}

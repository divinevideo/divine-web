import { useHead, useSeoMeta } from '@unhead/react';
import { getDiscoveryMeta } from '@/lib/discoveryMeta';

export function DiscoverySeo({ pathname }: { pathname: string }) {
  const { title, description, path } = getDiscoveryMeta(pathname);

  useSeoMeta({ title, description });
  useHead({
    link: [{ rel: 'canonical', href: `https://divine.video${path}` }],
  });

  return null;
}

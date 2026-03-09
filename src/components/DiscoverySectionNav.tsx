import { Compass, Flame, Hash, LayoutGrid, Trophy } from 'lucide-react';

import { AppSectionNav } from '@/components/AppSectionNav';

type DiscoverySection =
  | 'discover'
  | 'trending'
  | 'hashtags'
  | 'categories'
  | 'leaderboard';

interface DiscoverySectionNavProps {
  active: DiscoverySection;
}

export function DiscoverySectionNav({ active }: DiscoverySectionNavProps) {
  return (
    <AppSectionNav
      items={[
        {
          label: 'Discover',
          to: '/discovery/classics',
          icon: <Compass className="h-4 w-4" />,
          active: active === 'discover',
        },
        {
          label: 'Trending',
          to: '/trending',
          icon: <Flame className="h-4 w-4" />,
          active: active === 'trending',
        },
        {
          label: 'Hashtags',
          to: '/hashtags',
          icon: <Hash className="h-4 w-4" />,
          active: active === 'hashtags',
        },
        {
          label: 'Categories',
          to: '/category',
          icon: <LayoutGrid className="h-4 w-4" />,
          active: active === 'categories',
        },
        {
          label: 'Leaderboard',
          to: '/leaderboard',
          icon: <Trophy className="h-4 w-4" />,
          active: active === 'leaderboard',
        },
      ]}
    />
  );
}

import {
  ChartBar as BarChart3,
  LinkSimple as Link2,
  List,
  Shield,
  UserCircle as UserRound,
} from '@phosphor-icons/react';

import { AppSectionNav } from '@/components/AppSectionNav';

type CreatorSection = 'analytics' | 'lists' | 'moderation' | 'linked-accounts' | 'profile';

interface CreatorSectionNavProps {
  active: CreatorSection;
  profilePath?: string;
}

export function CreatorSectionNav({
  active,
  profilePath,
}: CreatorSectionNavProps) {
  return (
    <AppSectionNav
      items={[
        {
          label: 'Analytics',
          to: '/analytics',
          icon: <BarChart3 className="h-4 w-4" />,
          active: active === 'analytics',
        },
        {
          label: 'Lists',
          to: '/lists',
          icon: <List className="h-4 w-4" />,
          active: active === 'lists',
        },
        {
          label: 'Moderation',
          to: '/settings/moderation',
          icon: <Shield className="h-4 w-4" />,
          active: active === 'moderation',
        },
        {
          label: 'Linked Accounts',
          to: '/settings/linked-accounts',
          icon: <Link2 className="h-4 w-4" />,
          active: active === 'linked-accounts',
        },
        ...(profilePath
          ? [{
              label: 'Profile',
              to: profilePath,
              icon: <UserRound className="h-4 w-4" />,
              active: active === 'profile',
            }]
          : []),
      ]}
    />
  );
}

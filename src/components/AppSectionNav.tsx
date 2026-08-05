import type { ReactNode } from 'react';

import { SmartLink } from '@/components/SmartLink';
import { cn } from '@/lib/utils';

interface AppSectionNavItem {
  label: ReactNode;
  to: string;
  icon?: ReactNode;
  active?: boolean;
  ownerPubkey?: string | null;
}

interface AppSectionNavProps {
  items: AppSectionNavItem[];
  className?: string;
}

export function AppSectionNav({ items, className }: AppSectionNavProps) {
  if (!items.length) {
    return null;
  }

  return (
    <nav className={cn('app-chip-row', className)} aria-label="Section navigation">
      <div className="flex gap-2 pb-2">
        {items.map((item) => (
          <SmartLink
            key={`${item.to}-${typeof item.label === 'string' ? item.label : 'nav-item'}`}
            to={item.to}
            ownerPubkey={item.ownerPubkey}
            className={cn('app-chip min-w-fit', item.active && 'app-chip-active')}
          >
            {item.icon}
            <span>{item.label}</span>
          </SmartLink>
        ))}
      </div>
    </nav>
  );
}

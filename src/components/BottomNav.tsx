import { Bell, Compass, Home, Search, User } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { cn } from '@/lib/utils';

export interface BottomNavProps {
  className?: string;
}

export function BottomNav({ className }: BottomNavProps) {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const { data: unreadCount } = useUnreadNotificationCount();

  const getUserProfilePath = () => {
    if (!user?.pubkey) return '/';
    return `/profile/${nip19.npubEncode(user.pubkey)}`;
  };

  const isHomeActive = location.pathname === '/' || location.pathname === '/home';
  const isDiscoverActive = location.pathname === '/discovery'
    || location.pathname.startsWith('/discovery/');
  const isSearchActive = location.pathname === '/search';
  const isNotificationsActive = location.pathname === '/notifications';
  const isProfileActive = location.pathname === getUserProfilePath();

  const items = [
    {
      key: 'home',
      label: 'Home',
      icon: Home,
      active: isHomeActive,
      onClick: () => navigate('/'),
    },
    {
      key: 'discover',
      label: 'Discover',
      icon: Compass,
      active: isDiscoverActive,
      onClick: () => navigate('/discovery'),
    },
    {
      key: 'search',
      label: 'Search',
      icon: Search,
      active: isSearchActive,
      onClick: () => navigate('/search'),
    },
    ...(user ? [
      {
        key: 'alerts',
        label: 'Alerts',
        icon: Bell,
        active: isNotificationsActive,
        onClick: () => navigate('/notifications'),
        badge: unreadCount ?? 0,
      },
      {
        key: 'profile',
        label: 'Profile',
        icon: User,
        active: isProfileActive,
        onClick: () => navigate(getUserProfilePath(), { ownerPubkey: user.pubkey }),
      },
    ] : []),
  ];

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] pt-4 xl:hidden',
        className
      )}
    >
      <div className="mx-auto max-w-[42rem]">
        <nav
          className="pointer-events-auto rounded-[32px] border border-white/45 bg-[hsl(var(--surface-1)/0.92)] px-2 py-2 shadow-[0_20px_60px_rgba(7,36,27,0.18)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_24px_72px_rgba(0,0,0,0.4)]"
          aria-label="Primary navigation"
        >
          <div
            className={cn(
              'grid gap-1',
              items.length === 5 ? 'grid-cols-5' : 'grid-cols-3'
            )}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const badgeCount = item.badge ?? 0;

              return (
                <Button
                  key={item.key}
                  variant="ghost"
                  size="sm"
                  onClick={item.onClick}
                  className={cn(
                    'relative h-14 min-w-0 flex-col gap-1 rounded-[24px] px-2 text-[0.68rem] font-semibold tracking-[0.01em] transition-all duration-200',
                    item.active
                      ? 'bg-primary text-primary-foreground shadow-[0_12px_32px_rgba(39,197,139,0.24)] hover:bg-primary'
                      : 'text-muted-foreground hover:bg-[hsl(var(--surface-2)/0.92)] hover:text-foreground'
                  )}
                >
                  <span className="relative">
                    <Icon className="h-[1.1rem] w-[1.1rem]" />
                    {badgeCount > 0 ? (
                      <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export default BottomNav;

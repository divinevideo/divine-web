import { House as Home, Compass, MagnifyingGlass as Search, Bell, User } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { cn } from '@/lib/utils';
import { nip19 } from 'nostr-tools';

export function BottomNav() {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { data: unreadCount } = useUnreadNotificationCount();

  const getUserProfilePath = () => {
    if (!user?.pubkey) return '/';
    const npub = nip19.npubEncode(user.pubkey);
    return `/profile/${npub}`;
  };

  const isActive = (path: string) => location.pathname === path;
  const isHomePage = location.pathname === '/';

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-brand-light-green bg-background backdrop-blur-md shadow-lg pb-[env(safe-area-inset-bottom)] dark:border-brand-dark-green">
      <div className="flex items-center justify-around h-16 px-2">
        {/* Home - Shows Home/Explore tabs */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full flex-1 rounded-none hover:bg-transparent",
            isHomePage && "text-primary"
          )}
        >
          <Home className={cn("h-5 w-5", isHomePage && "text-primary")} weight={isHomePage ? 'fill' : 'bold'} />
          <span className={cn("text-xs", isHomePage && "text-primary")}>{t('nav.home')}</span>
        </Button>

        {/* Explore - Redirects to home page with explore tab */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/discovery')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full flex-1 rounded-none hover:bg-transparent",
            isActive('/discovery') && "text-primary"
          )}
        >
          <Compass className={cn("h-5 w-5", isActive('/discovery') && "text-primary")} weight={isActive('/discovery') ? 'fill' : 'bold'} />
          <span className={cn("text-xs", isActive('/discovery') && "text-primary")}>{t('nav.discover')}</span>
        </Button>

        {/* Search */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/search')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 h-full flex-1 rounded-none hover:bg-transparent",
            isActive('/search') && "text-primary"
          )}
        >
          <Search className={cn("h-5 w-5", isActive('/search') && "text-primary")} weight={isActive('/search') ? 'fill' : 'bold'} />
          <span className={cn("text-xs", isActive('/search') && "text-primary")}>{t('nav.search')}</span>
        </Button>

        {/* Notifications */}
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/notifications')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-full flex-1 rounded-none hover:bg-transparent",
              isActive('/notifications') && "text-primary"
            )}
          >
            <div className="relative">
              <Bell className={cn("h-5 w-5", isActive('/notifications') && "text-primary")} weight={isActive('/notifications') ? 'fill' : 'bold'} />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                  {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className={cn("text-xs", isActive('/notifications') && "text-primary")}>{t('nav.notifications')}</span>
          </Button>
        )}

        {/* Profile */}
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(getUserProfilePath(), { ownerPubkey: user.pubkey })}
            className={cn(
              "flex flex-col items-center justify-center gap-1 h-full flex-1 rounded-none hover:bg-transparent",
              isActive(getUserProfilePath()) && "text-primary"
            )}
        >
          <User className={cn("h-5 w-5", isActive(getUserProfilePath()) && "text-primary")} weight={isActive(getUserProfilePath()) ? 'fill' : 'bold'} />
          <span className={cn("text-xs", isActive(getUserProfilePath()) && "text-primary")}>{t('nav.profile')}</span>
        </Button>
      )}
      </div>
    </nav>
  );
}

export default BottomNav;

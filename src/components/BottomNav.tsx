import { Home, Compass, Video, Bell, UserCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { cn } from '@/lib/utils';
import { nip19 } from 'nostr-tools';

export function BottomNav() {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#00150d] pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-center gap-12 h-16 px-2">
        {/* Home */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
            isHomePage ? "text-primary" : "text-white"
          )}
        >
          <Home className="w-8 h-8" />
        </Button>

        {/* Discover */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/discovery')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
            isActive('/discovery') ? "text-primary" : "text-white"
          )}
        >
          <Compass className="w-8 h-8" />
        </Button>

        {/* Camera - green pill */}
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/upload')}
            className="flex items-center justify-center bg-[#27c58b] rounded-[20px] px-5 py-2 hover:bg-[#27c58b]/90 text-white p-0"
          >
            <Video className="w-8 h-8 drop-shadow" />
          </Button>
        )}

        {/* Notifications */}
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/notifications')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
              isActive('/notifications') ? "text-primary" : "text-white"
            )}
          >
            <div className="relative">
              <Bell className="w-8 h-8" />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                  {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </Button>
        )}

        {/* Profile */}
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(getUserProfilePath(), { ownerPubkey: user.pubkey })}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
              isActive(getUserProfilePath()) ? "text-primary" : "text-white"
            )}
          >
            <UserCircle className="w-8 h-8" />
          </Button>
        )}
      </div>

      {/* Home indicator bar */}
      <div className="w-[144px] h-[5px] bg-white rounded-full mx-auto mb-1" />
    </nav>
  );
}

export default BottomNav;

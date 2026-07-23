import { useState } from 'react';
import { House as Home, Compass, VideoCamera as Video, Bell, UserCircle } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLoginDialog } from '@/contexts/LoginDialogContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { buildProfileLinkPath } from '@/lib/profileLinks';
import { cn } from '@/lib/utils';

const uploadExplainer = {
  title: 'Why no upload?',
  body: 'What you see on Divine is human-made: raw and captured in the moment. Unlike platforms that allow highly produced or AI-generated uploads, we prioritize the authenticity of the camera-direct experience.',
  detail: "By keeping creation inside the app, we can better guarantee that content is real and unedited. We aren't opening up external gallery uploads at this time to protect that realness and keep our community free of synthetic content as much as we can.",
};

export function BottomNav() {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { openLoginDialog } = useLoginDialog();
  const [uploadExplainerOpen, setUploadExplainerOpen] = useState(false);

  const getUserProfilePath = () => {
    if (!user?.pubkey) return '/';
    return buildProfileLinkPath({
      pubkey: user.pubkey,
      fallbackRoute: 'profile',
    });
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const isHomePage = location.pathname === '/' || location.pathname === '/home';

  const handleAuthAction = (action: () => void) => {
    if (user) {
      action();
    } else {
      openLoginDialog();
    }
  };

  const handleProfileClick = () => {
    if (!user?.pubkey) {
      openLoginDialog();
      return;
    }

    navigate(getUserProfilePath(), { ownerPubkey: user.pubkey });
  };

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-brand-dark-green pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between h-16 px-8 max-[360px]:px-4">
          {/* Home */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Home"
            onClick={() => navigate('/')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
              isHomePage ? "text-primary" : "text-white"
            )}
          >
            <Home className="w-8 h-8" weight={isHomePage ? 'fill' : 'bold'} />
          </Button>

          {/* Discover */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Discover"
            onClick={() => navigate('/discovery')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
              isActive('/discovery') ? "text-primary" : "text-white"
            )}
          >
            <Compass className="w-8 h-8" weight={isActive('/discovery') ? 'fill' : 'bold'} />
          </Button>

          {/* Camera */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Camera"
            onClick={() => setUploadExplainerOpen(true)}
            className="flex items-center justify-center bg-primary rounded-[20px] px-5 py-2 hover:bg-primary/90 text-white p-0"
          >
            <Video className="w-8 h-8 drop-shadow" weight="fill" />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Notifications"
            onClick={() => handleAuthAction(() => navigate('/notifications'))}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
              isActive('/notifications') ? "text-primary" : "text-white"
            )}
          >
            <div className="relative">
              <Bell className="w-8 h-8" weight={isActive('/notifications') ? 'fill' : 'bold'} />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                  {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
          </Button>

          {/* Profile */}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Profile"
            onClick={handleProfileClick}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-none hover:bg-transparent p-0",
              user && isActive(getUserProfilePath()) ? "text-primary" : "text-white"
            )}
          >
            <UserCircle className="w-8 h-8" weight={user && isActive(getUserProfilePath()) ? 'fill' : 'bold'} />
          </Button>
        </div>

        {/* Home indicator bar */}
        <div className="w-[144px] h-[5px] bg-white rounded-full mx-auto mb-1" />
      </nav>

      <Dialog open={uploadExplainerOpen} onOpenChange={setUploadExplainerOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-[20px] border-brand-dark-green">
          <DialogHeader>
            <DialogTitle className="font-['Bricolage_Grotesque'] text-2xl font-extrabold text-foreground">
              {uploadExplainer.title}
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-left text-sm leading-6 text-muted-foreground">
              <span className="block">{uploadExplainer.body}</span>
              <span className="block">{uploadExplainer.detail}</span>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BottomNav;

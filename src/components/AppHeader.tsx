import {
  Bell,
  Code2,
  Compass,
  FileText,
  Headphones,
  HelpCircle,
  Home,
  Info,
  MessageCircle,
  Moon,
  MoreVertical,
  Search,
  Sun,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDmCapability, useUnreadDmCount } from '@/hooks/useDirectMessages';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';

export interface AppHeaderProps {
  className?: string;
}

function getRouteLabel(pathname: string): string {
  if (pathname === '/' || pathname === '/home') return 'Home';
  if (pathname === '/discovery' || pathname.startsWith('/discovery/')) return 'Discover';
  if (pathname === '/search') return 'Search';
  if (pathname.startsWith('/video/')) return 'Video';
  if (pathname.startsWith('/profile/')) return 'Profile';
  if (pathname === '/notifications') return 'Notifications';
  if (pathname === '/messages' || pathname.startsWith('/messages/')) return 'Messages';
  if (pathname.startsWith('/category/')) return 'Category';
  if (pathname.startsWith('/hashtag/')) return 'Hashtag';
  if (pathname === '/leaderboard') return 'Leaderboard';
  if (pathname === '/lists' || pathname.startsWith('/list/')) return 'Lists';
  return 'diVine';
}

export function AppHeader({ className }: AppHeaderProps) {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { displayTheme, setTheme } = useTheme();
  const { user } = useCurrentUser();
  const { canUseDirectMessages } = useDmCapability();
  const subdomainUser = getSubdomainUser();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: unreadDmCount } = useUnreadDmCount();

  const isActive = (path: string) => location.pathname === path;
  const isDiscoverActive = location.pathname === '/discovery'
    || location.pathname.startsWith('/discovery/');
  const routeLabel = getRouteLabel(location.pathname);

  const toggleTheme = () => {
    setTheme(displayTheme === 'dark' ? 'light' : 'dark');
  };

  const goHome = () => {
    if (subdomainUser) {
      window.location.href = `https://${subdomainUser.apexDomain}/`;
      return;
    }
    navigate('/');
  };

  const topActionButtonClassName = 'hidden h-11 w-11 rounded-full border border-white/35 bg-[hsl(var(--surface-1)/0.85)] shadow-[var(--shadow-sm)] backdrop-blur-lg hover:bg-[hsl(var(--surface-2)/0.96)] sm:inline-flex dark:border-white/10';

  const primaryNav = [
    ...(user ? [{
      label: 'Home',
      icon: Home,
      active: location.pathname === '/' || location.pathname === '/home',
      onClick: () => navigate('/'),
    }] : []),
    {
      label: 'Discover',
      icon: Compass,
      active: isDiscoverActive,
      onClick: () => navigate('/discovery'),
    },
    {
      label: 'Search',
      icon: Search,
      active: isActive('/search'),
      onClick: () => navigate('/search'),
    },
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/70 bg-background/82 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/72',
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mx-auto flex max-w-[96rem] flex-col px-3 sm:px-4 md:px-5 lg:px-6">
        <div className="flex min-h-[calc(var(--app-header-height)+var(--sat))] items-center gap-3 pb-3 pt-[calc(var(--sat)+0.75rem)]">
          <button
            onClick={goHome}
            aria-label="Go to home"
            className="group flex min-w-0 items-center gap-3 rounded-[24px] border border-white/45 bg-[hsl(var(--surface-1)/0.95)] px-3 py-2 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-md)] dark:border-white/10"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,hsl(var(--brand-light-green)),hsl(var(--brand-off-white)))] ring-1 ring-white/50 dark:bg-[linear-gradient(135deg,hsl(var(--surface-2)),hsl(var(--surface-3)))] dark:ring-white/10">
              <img
                src="/divine-logo.svg"
                alt="diVine"
                className="h-5"
              />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                diVine Web
              </span>
              <span className="block truncate text-sm font-semibold text-foreground">
                {routeLabel}
              </span>
            </span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            {user && canUseDirectMessages ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/messages')}
                className={cn(topActionButtonClassName, 'relative')}
                aria-label="Messages"
              >
                <MessageCircle className="h-4 w-4" />
                {(unreadDmCount ?? 0) > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {(unreadDmCount ?? 0) > 99 ? '99+' : unreadDmCount}
                  </span>
                ) : null}
              </Button>
            ) : null}

            {user ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/notifications')}
                className={cn(topActionButtonClassName, 'relative')}
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {(unreadCount ?? 0) > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                    {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Button>
            ) : null}

            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full border border-white/35 bg-[hsl(var(--surface-1)/0.88)] shadow-[var(--shadow-sm)] backdrop-blur-lg hover:bg-[hsl(var(--surface-2)/0.96)] dark:border-white/10"
              aria-label="Toggle theme"
            >
              {displayTheme === 'dark'
                ? <Sun className="h-4 w-4" />
                : <Moon className="h-4 w-4" />
              }
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full border border-white/35 bg-[hsl(var(--surface-1)/0.88)] shadow-[var(--shadow-sm)] backdrop-blur-lg hover:bg-[hsl(var(--surface-2)/0.96)] dark:border-white/10"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-[20px] border-border/80 bg-[hsl(var(--surface-1)/0.98)] backdrop-blur-xl">
                <DropdownMenuItem
                  onClick={() => window.open('https://about.divine.video/', '_blank')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <Info className="mr-2 h-4 w-4" />
                  <span>About</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/authenticity')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Our Mission</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open('https://about.divine.video/news/', '_blank')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>News</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open('https://about.divine.video/blog/', '_blank')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Blog</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open('https://about.divine.video/faqs/', '_blank')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>FAQ</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open('https://about.divine.video/media-resources/', '_blank')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Media Resources</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => navigate('/terms')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Terms</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/privacy')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Privacy</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/safety')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Safety</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate('/open-source')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <Code2 className="mr-2 h-4 w-4" />
                  <span>Open Source</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => window.open('https://opencollective.com/aos-collective/contribute/divine-keepers-95646', '_blank')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Donate</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => navigate('/support')}
                  className="cursor-pointer hover:bg-muted focus:bg-muted"
                >
                  <Headphones className="mr-2 h-4 w-4" />
                  <span>Help</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <LoginArea
              className={cn(
                'max-w-full shrink-0',
                user ? 'hidden sm:inline-flex' : 'inline-flex [&>button]:shadow-none'
              )}
            />
          </div>
        </div>

        <div className="hidden items-center gap-2 pb-3 md:flex xl:hidden">
          {primaryNav.map((item) => {
            const Icon = item.icon;

            return (
              <Button
                key={item.label}
                variant="ghost"
                size="sm"
                onClick={item.onClick}
                className={cn(
                  'h-11 rounded-full px-4 text-sm font-semibold shadow-[var(--shadow-sm)]',
                  item.active
                    ? 'bg-primary text-primary-foreground hover:bg-primary'
                    : 'border border-white/45 bg-[hsl(var(--surface-1)/0.92)] text-foreground hover:bg-[hsl(var(--surface-2)/0.96)] dark:border-white/10'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;

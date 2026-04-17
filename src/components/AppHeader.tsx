import { House as Home, Compass, MagnifyingGlass as Search, Bell, DotsThreeVertical as MoreVertical, Info, Code as Code2, Question as HelpCircle, Headphones, FileText, Sun, Moon, ChatCircle as MessageCircle } from '@phosphor-icons/react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useDmCapability, useUnreadDmCount } from '@/hooks/useDirectMessages';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/hooks/useTheme';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { LanguageMenu } from '@/components/LanguageMenu';

export interface AppHeaderProps {
  className?: string;
}

export function AppHeader({ className }: AppHeaderProps) {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { displayTheme, setTheme } = useTheme();
  const { user } = useCurrentUser();
  const { canUseDirectMessages } = useDmCapability();
  const subdomainUser = getSubdomainUser();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: unreadDmCount } = useUnreadDmCount();

  const isActive = (path: string) => location.pathname === path;

  const toggleTheme = () => {
    setTheme(displayTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className={cn("sticky top-0 z-50 w-full border-b border-border bg-background backdrop-blur-md shadow-sm", className)}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (subdomainUser) {
                window.location.href = `https://${subdomainUser.apexDomain}/`;
              } else {
                navigate('/');
              }
            }}
            aria-label="Go to home"
          >
            <img
              src="/divine-logo.svg"
              alt="Divine"
              className="h-6"
            />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Main navigation - hidden on mobile when BottomNav is visible */}
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className={cn(
                "hidden md:flex items-center gap-2",
                isActive('/') && "bg-primary text-primary-foreground"
              )}
            >
              <Home className="h-4 w-4" weight={isActive('/') ? 'fill' : 'bold'} />
              <span className="hidden lg:inline">{t('nav.home')}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/discovery')}
            className={cn(
              "hidden md:flex items-center gap-2",
              isActive('/discovery') && "bg-primary text-primary-foreground"
            )}
            >
              <Compass className="h-4 w-4" weight={isActive('/discovery') ? 'fill' : 'bold'} />
            <span className="hidden lg:inline">{t('nav.discover')}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/search')}
            className={cn(
              "hidden md:flex items-center gap-2",
              isActive('/search') && "bg-primary text-primary-foreground"
            )}
            >
              <Search className="h-4 w-4" weight={isActive('/search') ? 'fill' : 'bold'} />
            <span className="hidden lg:inline">{t('nav.search')}</span>
          </Button>
          {/* Notification bell - visible when logged in */}
          {user && canUseDirectMessages && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/messages')}
              className="relative"
              aria-label={t('nav.messages')}
            >
              <MessageCircle className="h-4 w-4" />
              {(unreadDmCount ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {(unreadDmCount ?? 0) > 99 ? '99+' : unreadDmCount}
                </span>
              )}
            </Button>
          )}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/notifications')}
              className="relative"
              aria-label={t('nav.notifications')}
            >
              <Bell className="h-4 w-4" />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          )}
          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
          >
            {displayTheme === 'dark'
              ? <Sun className='w-4 h-4' />
              : <Moon className='w-4 h-4' />
            }
          </Button>
          {/* More menu with info links */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.moreOptions')}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">{t('common.moreOptions')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* About Divine section */}
              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Info className="mr-2 h-4 w-4" />
                <span>{t('menu.about')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/authenticity')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.ourMission')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/news/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.news')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/blog/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.blog')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/faqs/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>{t('menu.faq')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://about.divine.video/media-resources/', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.mediaResources')}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Terms and open source section */}
              <DropdownMenuItem
                onClick={() => navigate('/terms')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.terms')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/privacy')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.privacy')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/safety')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.safety')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/dmca')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.dmca')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => navigate('/open-source')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Code2 className="mr-2 h-4 w-4" />
                <span>{t('menu.openSource')}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => window.open('https://opencollective.com/aos-collective/contribute/divine-keepers-95646', '_blank')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <FileText className="mr-2 h-4 w-4" />
                <span>{t('menu.donate')}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <LanguageMenu variant="dropdown" />

              <DropdownMenuSeparator />

              {/* Help - standalone */}
              <DropdownMenuItem
                onClick={() => navigate('/support')}
                className="cursor-pointer hover:bg-muted focus:bg-muted"
              >
                <Headphones className="mr-2 h-4 w-4" />
                <span>{t('menu.help')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <LoginArea className="max-w-60" />
        </div>
      </div>
    </header>
  );
}

export default AppHeader;

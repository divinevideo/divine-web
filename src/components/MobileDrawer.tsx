// ABOUTME: Left-sliding drawer for mobile navigation, mirrors AppSidebar nav items
// ABOUTME: Uses shadcn Sheet component, slides from left, closes on nav item tap

import { useLocation } from 'react-router-dom';
import { Home, Compass, Search, Bell, User, Sun, Moon, MessageCircle, BarChart3, LayoutGrid, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { nip19 } from 'nostr-tools';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useDmCapability, useUnreadDmCount } from '@/hooks/useDirectMessages';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { useTheme } from '@/hooks/useTheme';
import { useCategories } from '@/hooks/useCategories';
import { LoginArea } from '@/components/auth/LoginArea';
import { cn } from '@/lib/utils';

export interface MobileDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DrawerNavItem({
  icon,
  label,
  onClick,
  isActive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground font-normal hover:bg-muted hover:text-foreground hover:font-medium"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function MobileDrawer({ open, onOpenChange }: MobileDrawerProps) {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const { canUseDirectMessages } = useDmCapability();
  const { displayTheme, setTheme } = useTheme();
  const subdomainUser = getSubdomainUser();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: unreadDmCount } = useUnreadDmCount();
  const { data: categories } = useCategories();
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const isActive = (path: string) => location.pathname === path;
  const isDiscoveryActive = () =>
    location.pathname === '/discovery' || location.pathname.startsWith('/discovery/');
  const isMessagesActive = () =>
    location.pathname === '/messages' || location.pathname.startsWith('/messages/');

  const profilePath = user?.pubkey
    ? `/profile/${nip19.npubEncode(user.pubkey)}`
    : null;

  const navigateAndClose = (path: string) => {
    navigate(path);
    onOpenChange(false);
  };

  const toggleTheme = () => {
    setTheme(displayTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[80%] max-w-[320px] p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-2">
          <SheetTitle className="text-left">
            <button
              onClick={() => navigateAndClose('/')}
              aria-label="Go to home"
              className="transition-opacity hover:opacity-80"
            >
              <img
                src="/divine-logo.svg"
                alt="diVine"
                className="h-[22px]"
              />
            </button>
          </SheetTitle>
        </SheetHeader>

        {/* Main Navigation */}
        <nav className="flex flex-col gap-0.5 px-3 pt-2">
          <DrawerNavItem
            icon={<Search className="h-[18px] w-[18px]" />}
            label="Search"
            onClick={() => navigateAndClose('/search')}
            isActive={isActive('/search')}
          />

          {user && (
            <DrawerNavItem
              icon={<Home className="h-[18px] w-[18px]" />}
              label="Home"
              onClick={() => navigateAndClose('/')}
              isActive={isActive('/')}
            />
          )}

          <DrawerNavItem
            icon={<Compass className="h-[18px] w-[18px]" />}
            label="Discover"
            onClick={() => navigateAndClose('/discovery')}
            isActive={isDiscoveryActive()}
          />

          {user && canUseDirectMessages && (
            <DrawerNavItem
              icon={
                <div className="relative">
                  <MessageCircle className="h-[18px] w-[18px]" />
                  {(unreadDmCount ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
                      {(unreadDmCount ?? 0) > 99 ? '99+' : unreadDmCount}
                    </span>
                  )}
                </div>
              }
              label="Messages"
              onClick={() => navigateAndClose('/messages')}
              isActive={isMessagesActive()}
            />
          )}

          {user && (
            <DrawerNavItem
              icon={
                <div className="relative">
                  <Bell className="h-[18px] w-[18px]" />
                  {(unreadCount ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                      {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              }
              label="Notifications"
              onClick={() => navigateAndClose('/notifications')}
              isActive={isActive('/notifications')}
            />
          )}

          {user && profilePath && (
            <DrawerNavItem
              icon={<User className="h-[18px] w-[18px]" />}
              label="Profile"
              onClick={() => navigateAndClose(profilePath)}
              isActive={location.pathname === profilePath}
            />
          )}

          {user && (
            <DrawerNavItem
              icon={<BarChart3 className="h-[18px] w-[18px]" />}
              label="Analytics"
              onClick={() => navigateAndClose('/analytics')}
              isActive={isActive('/analytics')}
            />
          )}
        </nav>

        {/* Categories */}
        {categories && categories.length > 0 && (
          <div className="mt-4 px-3">
            <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>Categories</span>
                  <ChevronDown className={cn(
                    "ml-auto h-3.5 w-3.5 transition-transform duration-200",
                    categoriesOpen && "rotate-180"
                  )} />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="flex flex-col gap-0.5 pt-1">
                  {categories.slice(0, 12).map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => navigateAndClose(`/category/${cat.name}`)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-all duration-150",
                        location.pathname === `/category/${cat.name}`
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="text-base leading-none w-5 text-center">
                        {cat.config?.emoji || ''}
                      </span>
                      <span>{cat.config?.label || cat.name}</span>
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Theme Toggle */}
        <div className="mt-4 px-3">
          <button
            onClick={toggleTheme}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-normal text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:font-medium"
          >
            <span className="transition-transform duration-150 group-hover:scale-105">
              {displayTheme === 'dark' ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </span>
            <span>{displayTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>

        {/* Auth / Login */}
        <div className="mt-6 px-4 pb-6">
          {subdomainUser ? (
            <a
              href={`https://${subdomainUser.apexDomain}/`}
              className="flex w-full items-center justify-center rounded-lg border border-border h-11 text-[15px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Log in on Divine
            </a>
          ) : (
            <LoginArea
              className={cn(
                "flex-col gap-2.5 w-full",
                "[&>button]:w-full [&>button]:justify-center [&>button]:rounded-lg [&>button]:h-11 [&>button]:text-[15px]",
                "[&>button:first-child]:border-border [&>button:first-child]:hover:border-primary",
                "[&_.account-switcher]:w-full"
              )}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileDrawer;

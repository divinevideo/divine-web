// ABOUTME: TikTok-style left sidebar navigation for desktop
// ABOUTME: Shows main nav, login/signup, expandable diVine links section

import { useLocation } from 'react-router-dom';
import { Home, Compass, Search, Bell, User, Sun, Moon, ChevronDown, Headphones, BarChart3, LayoutGrid, Rss, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useCategories } from '@/hooks/useCategories';
import { nip19 } from 'nostr-tools';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useDmCapability, useUnreadDmCount } from '@/hooks/useDirectMessages';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { cn } from '@/lib/utils';
import { feedUrls } from '@/lib/feedUrls';
import { useRssFeedAvailable } from '@/hooks/useRssFeedAvailable';
import { usePlatformStats } from '@/hooks/usePlatformStats';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
}

function NavItem({ icon, label, onClick, isActive }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[22px] px-3.5 py-3 text-[15px] transition-all duration-200",
        isActive
          ? "bg-primary text-primary-foreground font-medium shadow-[0_14px_36px_rgba(39,197,139,0.24)]"
          : "border border-transparent bg-transparent text-muted-foreground font-normal hover:border-white/50 hover:bg-[hsl(var(--surface-2)/0.9)] hover:text-foreground dark:hover:border-white/10"
      )}
    >
      <span className={cn(
        "transition-transform duration-150",
        !isActive && "group-hover:scale-105"
      )}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export function AppSidebar({ className }: { className?: string }) {
  const navigate = useSubdomainNavigate();
  const location = useLocation();
  const subdomainUser = getSubdomainUser();
  const { displayTheme, setTheme } = useTheme();
  const { user } = useCurrentUser();
  const { canUseDirectMessages } = useDmCapability();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: unreadDmCount } = useUnreadDmCount();
  const rssFeedAvailable = useRssFeedAvailable();
  const { data: platformStats } = usePlatformStats();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [rssOpen, setRssOpen] = useState(false);
  const [divineOpen, setDivineOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const { data: categories } = useCategories();
  const classicVinesRecovered = platformStats?.vine_videos?.toLocaleString();

  const isActive = (path: string) => location.pathname === path;
  const isDiscoveryActive = () =>
    location.pathname === '/discovery' || location.pathname.startsWith('/discovery/');
  const isMessagesActive = () =>
    location.pathname === '/messages' || location.pathname.startsWith('/messages/');
  const isHomeActive = () => location.pathname === '/' || location.pathname === '/home';
  const isCategoryActive = (name: string) => location.pathname === `/category/${name}`;

  const toggleTheme = () => {
    setTheme(displayTheme === 'dark' ? 'light' : 'dark');
  };

  const profilePath = user?.pubkey
    ? `/profile/${nip19.npubEncode(user.pubkey)}`
    : null;

  return (
    <aside
      className={cn(
        "fixed left-4 top-4 z-40 flex h-[calc(100svh-2rem)] w-72 flex-col overflow-hidden rounded-[34px] border border-white/45 bg-[hsl(var(--surface-1)/0.94)] shadow-[0_32px_90px_rgba(7,36,27,0.18)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_32px_90px_rgba(0,0,0,0.45)]",
        className
      )}
    >
      {/* Logo - Fixed */}
      <div className="flex h-[4.5rem] shrink-0 items-center px-5">
        <button
          onClick={() => navigate('/')}
          aria-label="Go to home"
          className="flex items-center gap-3 rounded-[22px] border border-white/45 bg-[hsl(var(--surface-1)/0.88)] px-3 py-2 text-left shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-md)] dark:border-white/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,hsl(var(--brand-light-green)),hsl(var(--brand-off-white)))] ring-1 ring-white/50 dark:bg-[linear-gradient(135deg,hsl(var(--surface-2)),hsl(var(--surface-3)))] dark:ring-white/10">
            <img
              src="/divine-logo.svg"
              alt="diVine"
              className="h-[22px]"
            />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              diVine Web
            </span>
            <span className="block truncate text-sm font-semibold text-foreground">
              Control Center
            </span>
          </span>
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 pb-3">
        {/* Main Navigation */}
        <nav className="flex flex-col gap-1 px-3 pt-2">
          <NavItem
            icon={<Search className="h-[18px] w-[18px]" />}
            label="Search"
            onClick={() => navigate('/search')}
            isActive={isActive('/search')}
          />

          {user && (
            <NavItem
              icon={<Home className="h-[18px] w-[18px]" />}
              label="Home"
              onClick={() => navigate('/')}
              isActive={isHomeActive()}
            />
          )}

          <NavItem
            icon={<Compass className="h-[18px] w-[18px]" />}
            label="Discover"
            onClick={() => navigate('/discovery')}
            isActive={isDiscoveryActive()}
          />

          {user && canUseDirectMessages && (
            <NavItem
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
              onClick={() => navigate('/messages')}
              isActive={isMessagesActive()}
            />
          )}

          {user && (
            <NavItem
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
              onClick={() => navigate('/notifications')}
              isActive={isActive('/notifications')}
            />
          )}

          {user && profilePath && (
            <NavItem
              icon={<User className="h-[18px] w-[18px]" />}
              label="Profile"
              onClick={() => navigate(profilePath)}
              isActive={location.pathname === profilePath}
            />
          )}

          {user && (
            <NavItem
              icon={<BarChart3 className="h-[18px] w-[18px]" />}
              label="Analytics"
              onClick={() => navigate('/analytics')}
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
                  className="group flex w-full items-center gap-2 rounded-[18px] px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-2)/0.7)] hover:text-foreground"
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
                      onClick={() => navigate(`/category/${cat.name}`)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-[14px] transition-all duration-150",
                        isCategoryActive(cat.name)
                          ? "bg-primary text-primary-foreground font-medium shadow-[0_12px_30px_rgba(39,197,139,0.22)]"
                          : "text-muted-foreground hover:bg-[hsl(var(--surface-2)/0.8)] hover:text-foreground"
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

        {/* RSS Feeds - only shown when feed endpoints are available */}
        {rssFeedAvailable && <div className="mt-4 px-3">
          <Collapsible open={rssOpen} onOpenChange={setRssOpen}>
            <CollapsibleTrigger asChild>
              <button
                className="group flex w-full items-center gap-2 rounded-[18px] px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-2)/0.7)] hover:text-foreground"
              >
                <Rss className="h-4 w-4 text-orange-500" />
                <span>RSS Feeds</span>
                <ChevronDown className={cn(
                  "ml-auto h-3.5 w-3.5 transition-transform duration-200",
                  rssOpen && "rotate-180"
                )} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
              <div className="flex flex-col gap-0.5 pt-1">
                <a
                  href={feedUrls.latest()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-[14px] text-muted-foreground transition-all duration-150 hover:bg-[hsl(var(--surface-2)/0.8)] hover:text-foreground"
                >
                  <Rss className="h-3.5 w-3.5 text-orange-500" />
                  <span>Latest Videos</span>
                </a>
                <a
                  href={feedUrls.trending()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-[14px] text-muted-foreground transition-all duration-150 hover:bg-[hsl(var(--surface-2)/0.8)] hover:text-foreground"
                >
                  <Rss className="h-3.5 w-3.5 text-orange-500" />
                  <span>Trending</span>
                </a>
                {user && profilePath && (
                  <a
                    href={feedUrls.userFeed(nip19.npubEncode(user.pubkey))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-[14px] text-muted-foreground transition-all duration-150 hover:bg-[hsl(var(--surface-2)/0.8)] hover:text-foreground"
                  >
                    <Rss className="h-3.5 w-3.5 text-orange-500" />
                    <span>Your Feed</span>
                  </a>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>}

        {/* Theme Toggle */}
        <div className="mt-4 px-3">
          <button
            onClick={toggleTheme}
            className="group flex w-full items-center gap-3 rounded-[22px] px-3.5 py-3 text-[15px] font-normal text-muted-foreground transition-all duration-150 hover:bg-[hsl(var(--surface-2)/0.8)] hover:text-foreground hover:font-medium"
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

        {/* Auth Buttons - on subdomains, link to apex domain for login */}
        <div className="mt-6 px-4">
          {subdomainUser ? (
            <a
              href={`https://${subdomainUser.apexDomain}/`}
              className="flex h-12 w-full items-center justify-center rounded-[20px] border border-border text-[15px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              Log in on Divine
            </a>
          ) : (
            <LoginArea
              className={cn(
                "flex-col gap-2.5 w-full",
                "[&>button]:w-full [&>button]:justify-center [&>button]:rounded-[20px] [&>button]:h-12 [&>button]:text-[15px]",
                "[&>button:first-child]:border-border [&>button:first-child]:hover:border-primary",
                "[&_.account-switcher]:w-full"
              )}
            />
          )}
        </div>

        {/* Footer Section - flows naturally, no pinning */}
        <div className="mt-6 px-4">
        {/* Expandable diVine Section */}
        <Collapsible open={divineOpen} onOpenChange={setDivineOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="group flex w-full items-start justify-between gap-2 py-1.5 text-left text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
              style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
            >
              <div className="min-w-0">
                <div>About Divine</div>
                {classicVinesRecovered && (
                  <div className="mt-0.5 text-[11px] font-normal text-muted-foreground group-hover:text-muted-foreground">
                    {classicVinesRecovered} Vines recovered
                  </div>
                )}
              </div>
              <ChevronDown className={cn(
                "mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                divineOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2 text-[12px] font-normal text-foreground">
              <a
                href="https://about.divine.video/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                About
              </a>
              <a
                href="https://about.divine.video/news/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                News
              </a>
              <a
                href="https://about.divine.video/blog/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                Blog
              </a>
              <a
                href="https://about.divine.video/faqs/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                FAQ
              </a>
              <a
                href="https://about.divine.video/media-resources/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                Media
              </a>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Expandable Terms and open source Section */}
        <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="group flex w-full items-center gap-1 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
              style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
            >
              <span>Terms & Open Source</span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                termsOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2 text-[12px] font-normal text-foreground">
              <button
                onClick={() => navigate('/terms')}
                className="transition-colors hover:text-primary"
              >
                Terms
              </button>
              <button
                onClick={() => navigate('/privacy')}
                className="transition-colors hover:text-primary"
              >
                Privacy
              </button>
              <button
                onClick={() => navigate('/safety')}
                className="transition-colors hover:text-primary"
              >
                Safety
              </button>
              <button
                onClick={() => navigate('/open-source')}
                className="transition-colors hover:text-primary"
              >
                Open Source
              </button>
              <a
                href="https://opencollective.com/aos-collective/contribute/divine-keepers-95646"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                Donate
              </a>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Help - standalone link */}
        <button
          onClick={() => navigate('/support')}
          className="flex items-center gap-2 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
          style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
        >
          <Headphones className="h-3.5 w-3.5" />
          <span>Help</span>
        </button>

        {/* Copyright */}
        <div className="mt-3 pb-4 text-[11px] font-normal text-foreground">
          © 2026 Divine
        </div>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;

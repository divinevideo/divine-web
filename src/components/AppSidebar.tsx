// ABOUTME: TikTok-style left sidebar navigation for desktop
// ABOUTME: Shows main nav, login/signup, expandable Divine links section

import { useLocation } from 'react-router-dom';
import { House as Home, Compass, MagnifyingGlass as Search, Bell, User, Sun, Moon, CaretDown as ChevronDown, Headphones, ChartBar as BarChart3, SquaresFour as LayoutGrid, Rss, ChatCircle as MessageCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { LanguageMenu } from '@/components/LanguageMenu';
import { getTranslatedCategoryLabel } from '@/lib/constants/categories';

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
        "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-all duration-150",
        isActive
          ? "bg-primary text-primary-foreground font-medium brand-offset-shadow-sm-dark"
          : "text-muted-foreground font-normal hover:bg-muted hover:text-foreground hover:font-medium"
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
  const { t } = useTranslation();
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
        "fixed left-0 top-0 z-40 flex h-svh w-[240px] flex-col border-r border-border bg-background",
        className
      )}
    >
      {/* Logo - Fixed */}
      <div className="flex h-14 shrink-0 items-center px-5">
        <button
          onClick={() => navigate('/')}
          aria-label="Go to home"
          className="transition-opacity hover:opacity-80"
        >
          <img
            src="/divine-logo.svg"
            alt="Divine"
            className="h-[22px]"
          />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Main Navigation */}
        <nav className="flex flex-col gap-0.5 px-3 pt-2">
          <NavItem
            icon={<Search className="h-[18px] w-[18px]" weight={isActive('/search') ? 'fill' : 'bold'} />}
            label={t('nav.search')}
            onClick={() => navigate('/search')}
            isActive={isActive('/search')}
          />

          {user && (
            <NavItem
              icon={<Home className="h-[18px] w-[18px]" weight={isActive('/') ? 'fill' : 'bold'} />}
              label={t('nav.home')}
              onClick={() => navigate('/')}
              isActive={isActive('/')}
            />
          )}

          <NavItem
            icon={<Compass className="h-[18px] w-[18px]" weight={isDiscoveryActive() ? 'fill' : 'bold'} />}
            label={t('nav.discover')}
            onClick={() => navigate('/discovery')}
            isActive={isDiscoveryActive()}
          />

          {user && canUseDirectMessages && (
            <NavItem
              icon={
                <div className="relative">
                  <MessageCircle className="h-[18px] w-[18px]" weight={isMessagesActive() ? 'fill' : 'bold'} />
                  {(unreadDmCount ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
                      {(unreadDmCount ?? 0) > 99 ? '99+' : unreadDmCount}
                    </span>
                  )}
                </div>
              }
              label={t('nav.messages')}
              onClick={() => navigate('/messages')}
              isActive={isMessagesActive()}
            />
          )}

          {user && (
            <NavItem
              icon={
                <div className="relative">
                  <Bell className="h-[18px] w-[18px]" weight={isActive('/notifications') ? 'fill' : 'bold'} />
                  {(unreadCount ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground">
                      {(unreadCount ?? 0) > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
              }
              label={t('nav.notifications')}
              onClick={() => navigate('/notifications')}
              isActive={isActive('/notifications')}
            />
          )}

          {user && profilePath && (
            <NavItem
              icon={<User className="h-[18px] w-[18px]" weight={location.pathname === profilePath ? 'fill' : 'bold'} />}
              label={t('nav.profile')}
              onClick={() => navigate(profilePath)}
              isActive={location.pathname === profilePath}
            />
          )}

          {user && (
            <NavItem
              icon={<BarChart3 className="h-[18px] w-[18px]" weight={isActive('/analytics') ? 'fill' : 'bold'} />}
              label={t('nav.analytics')}
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
                  className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>{t('discovery.categories')}</span>
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
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-all duration-150",
                        isCategoryActive(cat.name)
                          ? "bg-primary text-primary-foreground font-medium brand-offset-shadow-sm-dark"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="text-base leading-none w-5 text-center">
                        {cat.config?.emoji || ''}
                      </span>
                      <span>{getTranslatedCategoryLabel(cat.name, t)}</span>
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
                className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <Rss className="h-4 w-4 text-orange-500" />
                <span>{t('rss.title')}</span>
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
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
                >
                  <Rss className="h-3.5 w-3.5 text-orange-500" />
                  <span>{t('rss.latestVideos')}</span>
                </a>
                <a
                  href={feedUrls.trending()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
                >
                  <Rss className="h-3.5 w-3.5 text-orange-500" />
                  <span>{t('rss.trending')}</span>
                </a>
                {user && profilePath && (
                  <a
                    href={feedUrls.userFeed(nip19.npubEncode(user.pubkey))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
                  >
                    <Rss className="h-3.5 w-3.5 text-orange-500" />
                    <span>{t('rss.yourFeed')}</span>
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
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-normal text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground hover:font-medium"
          >
            <span className="transition-transform duration-150 group-hover:scale-105">
              {displayTheme === 'dark' ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </span>
            <span>{displayTheme === 'dark' ? t('theme.lightMode') : t('theme.darkMode')}</span>
          </button>
        </div>

        <LanguageMenu variant="sidebar" className="mt-4" />

        {/* Auth Buttons - on subdomains, link to apex domain for login */}
        <div className="mt-6 px-4">
          {subdomainUser ? (
            <a
              href={`https://${subdomainUser.apexDomain}/`}
              className="flex w-full items-center justify-center rounded-lg border border-border h-11 text-[15px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {t('auth.logInOnDivine')}
            </a>
          ) : (
            <LoginArea
              className={cn(
                "flex-col gap-2.5 w-full",
                // Layout only: fill sidebar width, center, tweak height/type.
                // Do NOT override the button's border/radius here — the sticker
                // variant (the Divine brand-compliant hero treatment) provides
                // its own 2px dark-green border, 14px radius, and offset shadow.
                // Forcing a plain rounded-lg or border-border here would clobber
                // the brand look (and did, until 2026-04-17).
                "[&>button]:w-full [&>button]:justify-center [&>button]:h-11 [&>button]:text-[15px]",
                "[&_.account-switcher]:w-full"
              )}
            />
          )}
        </div>

        {/* Footer Section - flows naturally, no pinning */}
        <div className="mt-6 px-4">
        {/* Expandable Divine Section */}
        <Collapsible open={divineOpen} onOpenChange={setDivineOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="group flex w-full items-start justify-between gap-2 py-1.5 text-left text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
              style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
            >
              <div className="min-w-0">
                <div>{t('footer.aboutDivine')}</div>
                {classicVinesRecovered && (
                  <div className="mt-0.5 text-[11px] font-normal text-muted-foreground group-hover:text-muted-foreground">
                    {t('footer.vinesRecovered', { count: classicVinesRecovered })}
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
                {t('menu.about')}
              </a>
              <a
                href="https://about.divine.video/news/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {t('menu.news')}
              </a>
              <a
                href="https://about.divine.video/blog/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {t('menu.blog')}
              </a>
              <a
                href="https://about.divine.video/faqs/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {t('menu.faq')}
              </a>
              <a
                href="https://about.divine.video/media-resources/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {t('menu.mediaResources')}
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
              <span>{t('footer.termsAndOpenSource')}</span>
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
                {t('menu.terms')}
              </button>
              <button
                onClick={() => navigate('/privacy')}
                className="transition-colors hover:text-primary"
              >
                {t('menu.privacy')}
              </button>
              <button
                onClick={() => navigate('/safety')}
                className="transition-colors hover:text-primary"
              >
                {t('menu.safety')}
              </button>
              <button
                onClick={() => navigate('/dmca')}
                className="transition-colors hover:text-primary"
              >
                {t('menu.dmca')}
              </button>
              <button
                onClick={() => navigate('/open-source')}
                className="transition-colors hover:text-primary"
              >
                {t('menu.openSource')}
              </button>
              <a
                href="https://opencollective.com/aos-collective/contribute/divine-keepers-95646"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-primary"
              >
                {t('menu.donate')}
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
          <span>{t('menu.help')}</span>
        </button>

        {/* Copyright */}
        <div className="mt-3 pb-4 text-[11px] font-normal text-foreground">
          {t('footer.copyright')}
        </div>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;

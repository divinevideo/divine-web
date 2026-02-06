// ABOUTME: TikTok-style left sidebar navigation for desktop
// ABOUTME: Shows main nav, login/signup, expandable diVine links section

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, Search, User, Sun, Moon, ChevronDown, Headphones } from 'lucide-react';
import { useState } from 'react';
import { nip19 } from 'nostr-tools';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useTheme } from '@/hooks/useTheme';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { cn } from '@/lib/utils';

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
          ? "bg-primary text-primary-foreground font-medium"
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
  const navigate = useNavigate();
  const location = useLocation();
  const { displayTheme, setTheme } = useTheme();
  const { user } = useCurrentUser();
  const [divineOpen, setDivineOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isDiscoveryActive = () =>
    location.pathname === '/discovery' || location.pathname.startsWith('/discovery/');

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
            alt="diVine"
            className="h-[22px]"
          />
        </button>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Main Navigation */}
        <nav className="flex flex-col gap-0.5 px-3 pt-2">
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
              isActive={isActive('/')}
            />
          )}

          <NavItem
            icon={<Compass className="h-[18px] w-[18px]" />}
            label="Discover"
            onClick={() => navigate('/discovery')}
            isActive={isDiscoveryActive()}
          />

          {user && profilePath && (
            <NavItem
              icon={<User className="h-[18px] w-[18px]" />}
              label="Profile"
              onClick={() => navigate(profilePath)}
              isActive={location.pathname === profilePath}
            />
          )}
        </nav>

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

        {/* Auth Buttons */}
        <div className="mt-6 px-4">
          <LoginArea
            className={cn(
              "flex-col gap-2.5 w-full",
              "[&>button]:w-full [&>button]:justify-center [&>button]:rounded-lg [&>button]:h-11 [&>button]:text-[15px]",
              "[&>button:first-child]:border-border [&>button:first-child]:hover:border-primary",
              "[&_.account-switcher]:w-full"
            )}
          />
        </div>

        {/* Footer Section - flows naturally, no pinning */}
        <div className="mt-6 px-4">
        {/* Expandable diVine Section */}
        <Collapsible open={divineOpen} onOpenChange={setDivineOpen}>
          <CollapsibleTrigger asChild>
            <button
              className="group flex w-full items-center gap-1 py-1.5 text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
              style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
            >
              <span>About diVine</span>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                divineOpen && "rotate-180"
              )} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2 text-[12px] font-normal text-foreground">
              <button
                onClick={() => navigate('/about')}
                className="transition-colors hover:text-primary"
              >
                About
              </button>
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
          © 2026 diVine
        </div>
        </div>
      </div>
    </aside>
  );
}

export default AppSidebar;

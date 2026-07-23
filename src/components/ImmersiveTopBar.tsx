// ABOUTME: Transparent/solid overlay top bar for mobile/tablet screens (< lg)
// ABOUTME: Shows hamburger menu, page title, and search button with scrim pill styling

import { useState } from 'react';
import { List as Menu, MagnifyingGlass as Search } from '@phosphor-icons/react';
import { useSubdomainNavigate } from '@/hooks/useSubdomainNavigate';
import { MobileDrawer } from '@/components/MobileDrawer';

export interface ImmersiveTopBarProps {
  title?: string;
  variant?: 'transparent' | 'solid';
}

export function ImmersiveTopBar({ title = 'Home', variant = 'transparent' }: ImmersiveTopBarProps) {
  const navigate = useSubdomainNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header
        className={`fixed left-0 top-0 z-50 w-screen overflow-hidden pt-[env(safe-area-inset-top)] lg:hidden ${
          variant === 'solid' ? 'bg-background' : 'bg-transparent'
        }`}
      >
        <div className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-4">
          {/* Left: Menu button in scrim pill */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-black/65"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          {/* Center: Page title */}
          <span
            className="min-w-0 justify-self-center truncate px-3 text-xl font-extrabold text-white"
            style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
          >
            {title}
          </span>

          {/* Right: Search button in scrim pill */}
          <button
            onClick={() => navigate('/search')}
            className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-black/65"
            aria-label="Search"
          >
            <Search className="h-6 w-6 text-white" />
          </button>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}

export default ImmersiveTopBar;

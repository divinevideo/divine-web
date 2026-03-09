// ABOUTME: Transparent/solid overlay top bar for mobile/tablet screens (< lg)
// ABOUTME: Shows hamburger menu, page title, and search button with scrim pill styling

import { useState } from 'react';
import { Menu, Search } from 'lucide-react';
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
        className={`fixed top-0 left-0 right-0 z-50 lg:hidden pt-[env(safe-area-inset-top)] ${
          variant === 'solid' ? 'bg-background' : 'bg-transparent'
        }`}
      >
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Menu button in scrim pill */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center justify-center bg-black/65 rounded-[20px] p-3"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6 text-white" />
          </button>

          {/* Center: Page title */}
          <span
            className="font-extrabold text-xl text-white"
            style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
          >
            {title}
          </span>

          {/* Right: Search button in scrim pill */}
          <button
            onClick={() => navigate('/search')}
            className="flex items-center justify-center bg-black/65 rounded-[20px] p-3"
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

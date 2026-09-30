// ABOUTME: Layout wrapper for marketing and informational pages
// ABOUTME: Includes MarketingHeader, AppFooter and provides consistent spacing

import { MarketingHeader } from "./MarketingHeader";
import { AppFooter } from "./AppFooter";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MarketingHeader />
      <div className="flex-1 pt-safe-offset-16">
        {children}
      </div>
      <AppFooter />
    </div>
  );
}

// ABOUTME: Layout wrapper for marketing and informational pages
// ABOUTME: Includes MarketingHeader, AppFooter and provides consistent spacing

import { MarketingHeader } from "./MarketingHeader";
import { AppFooter } from "./AppFooter";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <MarketingHeader />
      <main className="marketing-shell pt-[6.25rem] md:pt-28">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}

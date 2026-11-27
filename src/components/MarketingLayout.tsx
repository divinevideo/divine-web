// ABOUTME: Layout wrapper for marketing and informational pages
// ABOUTME: Includes MarketingHeader, AppFooter and provides consistent spacing

import { useLayoutEffect, useRef } from "react";

import { MarketingHeader } from "./MarketingHeader";
import { AppFooter } from "./AppFooter";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export function MarketingLayout({ children }: MarketingLayoutProps) {
  const layoutRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const layout = layoutRef.current;
    const header = layout?.querySelector(":scope > nav");
    if (!layout || !(header instanceof HTMLElement)) return;

    const measureHeader = () => {
      layout.style.setProperty("--marketing-header-height", `${header.offsetHeight}px`);
    };
    measureHeader();
    const observer = new ResizeObserver(measureHeader);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={layoutRef} className="min-h-screen flex flex-col bg-background [&_.scroll-mt-24]:scroll-mt-[calc(var(--marketing-header-height,5rem)+1rem)]">
      <MarketingHeader />
      <div className="flex-1">
        {children}
      </div>
      <AppFooter />
    </div>
  );
}

// ABOUTME: Floating back-to-top button for long static pages
// ABOUTME: Appears after scrolling and respects reduced-motion preferences

import { useEffect, useState } from "react";
import { ArrowUp } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 h-12 w-12 rounded-full bg-brand-green text-brand-dark-green border-2 border-brand-dark-green brand-offset-shadow-sm-dark flex items-center justify-center transition-all duration-200 hover:-translate-x-[2px] hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark-green focus-visible:ring-offset-2",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-2 pointer-events-none",
      )}
    >
      <ArrowUp weight="bold" className="h-5 w-5" />
    </button>
  );
}

// ABOUTME: Persistent cross-navigation between the five family pages and the kids policy
// ABOUTME: Current page is highlighted; rendered near the top and bottom of every family route

import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

export const FAMILY_NAV_LINKS = [
  { to: "/family", label: "Family hub" },
  { to: "/family/talking-to-your-teen", label: "Talking with your teen" },
  { to: "/family/media-plan", label: "Family media plan" },
  { to: "/family/when-something-goes-wrong", label: "When something goes wrong" },
  { to: "/family/safety-tools", label: "Safety tools" },
  { to: "/kids", label: "Kids policy" },
];

export function FamilySectionNav({ className }: { className?: string }) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Family guide"
      className={cn("flex flex-wrap gap-2 text-sm", className)}
    >
      {FAMILY_NAV_LINKS.map((link) => {
        const current = pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-2 transition-colors",
              current
                ? "border-brand-green bg-brand-green/15 text-brand-dark-green dark:text-brand-green font-semibold"
                : "border-brand-dark-green/25 dark:border-brand-green/30 text-foreground/80 hover:border-brand-green hover:text-brand-dark-green dark:hover:text-brand-green"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

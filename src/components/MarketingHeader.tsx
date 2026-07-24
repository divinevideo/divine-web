// ABOUTME: Shared header component for marketing and informational pages
// ABOUTME: Full nav on desktop; logo + CTA + slide-out menu on mobile

import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { List } from "@phosphor-icons/react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GetAppButton } from "@/components/GetAppButton";

interface NavItem {
  label: string;
  /** External destination, or an internal route via `to` */
  href?: string;
  to?: string;
}

export function MarketingHeader() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { label: "About", href: "https://about.divine.video/" },
    { label: "Blog", href: "https://about.divine.video/blog/" },
    { label: "FAQ", href: "https://about.divine.video/faqs/" },
    { label: "In the News", href: "https://about.divine.video/news/" },
    { label: t("menu.merch"), to: "/merch" },
  ];

  const linkClass =
    "text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors";

  const renderNavLink = (item: NavItem, className: string, onClick?: () => void) =>
    item.to ? (
      <Link key={item.label} to={item.to} className={className} onClick={onClick}>
        {item.label}
      </Link>
    ) : (
      <a key={item.label} href={item.href} className={className} onClick={onClick}>
        {item.label}
      </a>
    );

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-dark-green border-b border-brand-green">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-3 h-16">
          {/* Logo */}
          <Link to="/" className="shrink-0" aria-label="Divine home">
            <img src="/divine-logo.svg" alt="Divine" className="h-5" />
          </Link>

          {/* Desktop nav. Hidden below lg because five links plus a CTA cannot
              fit a phone width without wrapping or overflowing. */}
          <div className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => renderNavLink(item, linkClass))}
            <GetAppButton />
          </div>

          {/* Mobile: keep the CTA visible — it is the point of the page — and
              move everything else behind the menu. */}
          <div className="flex items-center gap-2 lg:hidden">
            <GetAppButton />

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger
                aria-label="Open menu"
                className="p-2 -mr-2 text-brand-off-white hover:text-brand-green transition-colors"
              >
                <List className="h-6 w-6" />
              </SheetTrigger>
              {/* The sheet's built-in close button inherits `currentColor` at
                  70% opacity, which is invisible against dark green — force it
                  light along with the panel text. */}
              <SheetContent
                side="right"
                className="w-[280px] bg-brand-dark-green border-brand-green text-brand-off-white [&>button]:text-brand-off-white [&>button]:opacity-100"
              >
                <SheetTitle className="text-brand-off-white text-left">Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Divine site navigation
                </SheetDescription>
                <div className="mt-8 flex flex-col gap-5">
                  {navItems.map((item) =>
                    renderNavLink(
                      item,
                      "text-base font-medium text-brand-off-white hover:text-brand-green transition-colors",
                      () => setMenuOpen(false),
                    ),
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}

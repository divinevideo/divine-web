// ABOUTME: Shared header component for marketing and informational pages
// ABOUTME: Provides consistent navigation across About, FAQ, Press, Legal pages, etc.

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "@phosphor-icons/react";

export function MarketingHeader() {
  const { t } = useTranslation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-brand-dark-green border-b border-brand-green">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/">
            <img
              src="/divine-logo.svg"
              alt="Divine"
              className="h-5"
            />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-3 md:gap-8">
            <a
              href="https://about.divine.video/"
              className="hidden md:inline text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              About
            </a>
            <a
              href="https://about.divine.video/blog/"
              className="hidden md:inline text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              Blog
            </a>
            <a
              href="https://about.divine.video/faqs/"
              className="hidden md:inline text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              FAQ
            </a>
            <a
              href="https://about.divine.video/news/"
              className="hidden md:inline text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              In the News
            </a>
            <Link
              to="/merch"
              className="hidden md:inline text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              {t('menu.merch')}
            </Link>
            <Link
              to="/discovery"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 sm:px-4 sm:py-2"
            >
              Try it
              <ArrowRight className="hidden h-4 w-4 sm:block" weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

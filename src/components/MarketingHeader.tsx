// ABOUTME: Shared header component for marketing and informational pages
// ABOUTME: Provides consistent navigation across About, FAQ, Press, Legal pages, etc.

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export function MarketingHeader() {
  const { t } = useTranslation();

  return (
    <nav className="sticky top-0 z-50 shrink-0 bg-brand-dark-green border-b border-brand-green pt-safe px-safe">
      <div className="container mx-auto px-4">
        <div className="flex min-h-16 flex-col items-start gap-3 py-3 md:flex-row md:items-center md:justify-between md:gap-6">
          {/* Logo */}
          <Link to="/" className="shrink-0">
            <img
              src="/divine-logo.svg"
              alt="Divine"
              className="h-5"
            />
          </Link>

          {/* Navigation Links */}
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-3 [&>a]:shrink-0 md:w-auto md:justify-end md:gap-x-8">
            <a
              href="https://about.divine.video/"
              className="text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              About
            </a>
            <a
              href="https://about.divine.video/blog/"
              className="text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              Blog
            </a>
            <a
              href="https://about.divine.video/faqs/"
              className="text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              FAQ
            </a>
            <a
              href="https://about.divine.video/news/"
              className="text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              In the News
            </a>
            <Link
              to="/merch"
              className="text-sm font-medium text-brand-off-white hover:text-brand-green transition-colors"
            >
              {t('menu.merch')}
            </Link>
            <Link
              to="/discovery"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-full hover:brightness-110 transition-colors"
            >
              Try it
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

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
        <div className="flex h-16 items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img
              src="/divine-logo.svg"
              alt="Divine"
              className="h-5"
            />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
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
          </div>
          <Link
            to="/discovery"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
          >
            Try it
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

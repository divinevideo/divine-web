// ABOUTME: Shared header component for marketing and informational pages
// ABOUTME: Provides consistent navigation across About, FAQ, Press, Legal pages, etc.

import { Link } from "react-router-dom";

export function MarketingHeader() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/">
            <img
              src="/divine-logo.svg"
              alt="diVine"
              className="h-5"
            />
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-8">
            <Link
              to="/about"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              About
            </Link>
            <a
              href="https://about.divine.video/blog/"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              Blog
            </a>
            <a
              href="https://about.divine.video/faqs/"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              FAQ
            </a>
            <a
              href="https://about.divine.video/news/"
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              In the News
            </a>
            <Link
              to="/discovery"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
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

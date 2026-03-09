// ABOUTME: Shared header component for marketing and informational pages
// ABOUTME: Provides consistent navigation across About, FAQ, Press, Legal pages, etc.

import { Link } from "react-router-dom";

const MARKETING_LINKS = [
  { label: 'About', href: 'https://about.divine.video/' },
  { label: 'Blog', href: 'https://about.divine.video/blog/' },
  { label: 'FAQ', href: 'https://about.divine.video/faqs/' },
  { label: 'News', href: 'https://about.divine.video/news/' },
  { label: 'Support', href: '/support', internal: true },
];

export function MarketingHeader() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div className="mx-auto max-w-6xl app-surface overflow-hidden px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-dark-green shadow-sm">
              <img
                src="/divine-logo.svg"
                alt="diVine"
                className="h-[1.125rem]"
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-[0.12em] text-foreground/70 uppercase">
                diVine
              </div>
              <div className="truncate text-sm text-muted-foreground">
                Human-made video, preserved for the web
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {MARKETING_LINKS.map((item) => item.internal ? (
              <Link key={item.label} to={item.href} className="app-chip">
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className="app-chip">
                {item.label}
              </a>
            ))}
          </div>

          <Link
            to="/discovery/classics"
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform duration-200 hover:-translate-y-0.5"
          >
            Open app
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        <div className="app-chip-row mt-3 md:hidden">
          <div className="flex gap-2 pb-1">
            {MARKETING_LINKS.map((item) => item.internal ? (
              <Link key={item.label} to={item.href} className="app-chip">
                {item.label}
              </Link>
            ) : (
              <a key={item.label} href={item.href} className="app-chip">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

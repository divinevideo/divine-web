// ABOUTME: Device-aware "Get the app" CTA — direct store link or a store dropdown
// ABOUTME: iOS → App Store; Android → Play + Zapstore; desktop → all three; each click tracked

import { Link } from "react-router-dom";
import { CaretDown } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isShowcaseMode } from "@/config/webMode";
import { detectPlatform } from "@/lib/detectPlatform";
import { storesForPlatform, type Store } from "@/lib/appStoreOptions";
import { trackEvent } from "@/lib/analytics";

const DEFAULT_CAMPAIGN = "header";
const DEFAULT_MEDIUM = "marketing_header";

const BASE_CLASS =
  "inline-flex items-center gap-1.5 font-semibold bg-primary text-primary-foreground rounded-full hover:brightness-110 transition-colors whitespace-nowrap";

const SIZE_CLASS = {
  sm: "px-3 sm:px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
} as const;

const ARROW = (
  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

function track(store: Store, campaign: string, medium: string) {
  trackEvent("store_badge_click", {
    store,
    utm_campaign: campaign,
    utm_source: "divine_site",
    utm_medium: medium,
  });
}

interface GetAppButtonProps {
  /** utm_campaign for clicks from this instance. */
  campaign?: string;
  /** utm_medium identifying the surface (header vs homepage hero, …). */
  medium?: string;
  /** Visual size — `sm` for the header, `lg` for a hero call-to-action. */
  size?: keyof typeof SIZE_CLASS;
}

/**
 * The app-download call-to-action.
 *
 * In full mode there is an in-browser feed, so this stays "Try it" → /discovery.
 * In showcase mode it becomes a device-aware app-download control: a single
 * store gets a direct link, multiple stores get a dropdown so the visitor
 * chooses (the Android Play-vs-Zapstore case, and desktop's three).
 */
export function GetAppButton({
  campaign = DEFAULT_CAMPAIGN,
  medium = DEFAULT_MEDIUM,
  size = "sm",
}: GetAppButtonProps = {}) {
  const ctaClass = cn(BASE_CLASS, SIZE_CLASS[size]);

  if (!isShowcaseMode()) {
    return (
      <Link to="/discovery" className={ctaClass}>
        Try it
        {ARROW}
      </Link>
    );
  }

  const stores = storesForPlatform(detectPlatform(), campaign, medium);

  // Single obvious store (iOS): straight link, no menu.
  if (stores.length === 1) {
    const only = stores[0];
    return (
      <a
        href={only.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track(only.store, campaign, medium)}
        className={ctaClass}
      >
        Get the app
        {ARROW}
      </a>
    );
  }

  // Multiple stores: let the visitor choose.
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={ctaClass} aria-label="Get the app">
        Get the app
        <CaretDown className="w-4 h-4 shrink-0" weight="bold" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {stores.map((option) => (
          <DropdownMenuItem key={option.store} asChild>
            <a
              href={option.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(option.store, campaign, medium)}
              className="cursor-pointer"
            >
              {option.label}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

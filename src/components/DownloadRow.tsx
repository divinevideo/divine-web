// ABOUTME: The three ways to get Divine — App Store, Google Play, Zapstore
// ABOUTME: Primary conversion surface for the showcase homepage; all links UTM-tagged

import { trackEvent } from "@/lib/analytics";
import { buildStoreLinks } from "@/lib/mobileStoreLinks";

type Store = "app_store" | "play_store" | "zapstore";

interface DownloadRowProps {
  /** utm_campaign value; use the route slug */
  campaign?: string;
  /** utm_medium value; identifies the surface */
  medium?: string;
  className?: string;
}

export function DownloadRow({
  campaign = "homepage",
  medium = "homepage",
  className,
}: DownloadRowProps) {
  const links = buildStoreLinks(campaign, medium);

  const onClick = (store: Store) => {
    trackEvent("store_badge_click", {
      store,
      utm_campaign: campaign,
      utm_source: "divine_site",
      utm_medium: medium,
    });
  };

  const badges: Array<{
    store: Store;
    href: string;
    label: string;
    src: string;
    alt: string;
    /** Per-asset height so the visible pills match — the Google PNG carries
        transparent padding, so it needs a taller box to render the same size. */
    imgClass: string;
  }> = [
    {
      store: "app_store",
      href: links.appStore,
      label: "Download Divine on the App Store",
      src: "/store-badges/app-store-badge.svg",
      alt: "Download on the App Store",
      imgClass: "h-11 sm:h-12 w-auto",
    },
    {
      store: "play_store",
      href: links.playStore,
      label: "Get Divine on Google Play",
      src: "/store-badges/google-play-badge.png",
      alt: "Get it on Google Play",
      imgClass: "h-[60px] sm:h-[65px] w-auto -ml-[9px] sm:-ml-[10px]",
    },
    {
      store: "zapstore",
      href: links.zapstore,
      label: "Get Divine on Zapstore",
      src: "/store-badges/zapstore-badge.svg",
      alt: "Get it on Zapstore",
      imgClass: "h-11 sm:h-12 w-auto",
    },
  ];

  return (
    <div className={className} data-testid="download-row">
      {/* Left-justified row, all three badges the same visible height. Widths
          differ with the badge art, which is fine — heights match. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {badges.map((badge) => (
          <a
            key={badge.store}
            href={badge.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={badge.label}
            onClick={() => onClick(badge.store)}
            className="block transition-opacity hover:opacity-80"
          >
            <img src={badge.src} alt={badge.alt} className={badge.imgClass} />
          </a>
        ))}
      </div>
    </div>
  );
}

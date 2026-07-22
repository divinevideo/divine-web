// ABOUTME: App Store / Google Play badge block for family pages, with UTM-tagged links
// ABOUTME: Optional signup variant keeps the invite/newsletter form BELOW the badges

import { trackEvent } from "@/lib/analytics";
import { HubSpotSignup } from "@/components/HubSpotSignup";

const APP_STORE_BASE = "https://apps.apple.com/us/app/divine-video/id6747959501";
const PLAY_STORE_BASE = "https://play.google.com/store/apps/details";

export function buildStoreLinks(campaign: string) {
  const utm = new URLSearchParams({
    utm_source: "divine_site",
    utm_medium: "family_page",
    utm_campaign: campaign,
  });
  const play = new URLSearchParams({ id: "co.openvine.app" });
  return {
    appStore: `${APP_STORE_BASE}?${utm.toString()}`,
    playStore: `${PLAY_STORE_BASE}?${play.toString()}&${utm.toString()}`,
  };
}

interface StoreBadgesCtaProps {
  /** utm_campaign value; use the route slug */
  campaign: string;
  /** Short line above the badges; stays factual, no exclamation marks */
  heading?: string;
  /** Render the invite/newsletter signup below the badges */
  withSignup?: boolean;
  className?: string;
}

export function StoreBadgesCta({
  campaign,
  heading = "Divine is in the app stores. If you want to try it alongside your teen, start here.",
  withSignup = false,
  className,
}: StoreBadgesCtaProps) {
  const links = buildStoreLinks(campaign);

  const onBadgeClick = (store: "app_store" | "play_store") => {
    trackEvent("store_badge_click", {
      store,
      utm_campaign: campaign,
      utm_source: "divine_site",
      utm_medium: "family_page",
    });
  };

  return (
    <div className={className} data-testid="store-badges-cta">
      <p className="text-base text-foreground/80 leading-relaxed mb-4">{heading}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={links.appStore}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download Divine on the App Store"
          onClick={() => onBadgeClick("app_store")}
          className="block transition-opacity hover:opacity-80"
        >
          <img
            src="/store-badges/app-store-badge.svg"
            alt="Download on the App Store"
            className="h-12 w-auto"
            loading="lazy"
          />
        </a>
        <a
          href={links.playStore}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get Divine on Google Play"
          onClick={() => onBadgeClick("play_store")}
          className="block transition-opacity hover:opacity-80"
        >
          <img
            src="/store-badges/google-play-badge.png"
            alt="Get it on Google Play"
            className="h-[70px] w-auto -ml-[10px]"
            loading="lazy"
          />
        </a>
      </div>
      {withSignup && (
        <div className="mt-6 max-w-md">
          <p className="text-sm text-muted-foreground mb-2">
            Divine is now live in the app stores with invite codes. If you'd like to receive a code and hear our news, sign up here.
          </p>
          <HubSpotSignup />
        </div>
      )}
    </div>
  );
}

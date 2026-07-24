// ABOUTME: Which app stores to offer for a given platform, with UTM-tagged links
// ABOUTME: Pure logic shared by the GetAppButton CTA; kept out of the component for fast-refresh

import { buildStoreLinks } from "@/lib/mobileStoreLinks";
import type { Platform } from "@/lib/detectPlatform";

export type Store = "app_store" | "play_store" | "zapstore";

export interface StoreOption {
  store: Store;
  label: string;
  href: string;
}

/**
 * The stores to offer, in priority order, for the detected platform:
 * - `ios`: App Store only.
 * - `android`: Google Play then Zapstore (alphabetical).
 * - `desktop`/unknown: all three.
 *
 * `campaign`/`medium` become the UTM tags on each link so clicks can be
 * attributed to the surface (header vs homepage hero, …).
 */
export function storesForPlatform(
  platform: Platform,
  campaign = "header",
  medium = "marketing_header",
): StoreOption[] {
  const links = buildStoreLinks(campaign, medium);
  const appStore: StoreOption = { store: "app_store", label: "App Store", href: links.appStore };
  const playStore: StoreOption = { store: "play_store", label: "Google Play", href: links.playStore };
  const zapstore: StoreOption = { store: "zapstore", label: "Zapstore", href: links.zapstore };

  switch (platform) {
    case "ios":
      return [appStore];
    case "android":
      return [playStore, zapstore];
    default:
      return [appStore, playStore, zapstore];
  }
}

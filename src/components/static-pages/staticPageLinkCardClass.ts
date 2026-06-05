// ABOUTME: Shared class builder for static-page brand link cards
// ABOUTME: Maps brand accents to utility classes with consistent hover behavior

import { cn } from "@/lib/utils";

const LINK_CARD_ACCENT_CLASS = {
  blue: "brand-offset-shadow-blue brand-link-card-blue",
  green: "brand-offset-shadow-green brand-link-card-green",
  orange: "brand-offset-shadow-orange brand-link-card-orange",
  pink: "brand-offset-shadow-pink brand-link-card-pink",
  violet: "brand-offset-shadow-violet brand-link-card-violet",
  yellow: "brand-offset-shadow-yellow brand-link-card-yellow",
} as const;

export type LinkCardAccent = keyof typeof LINK_CARD_ACCENT_CLASS;

export function staticPageLinkCardClass(
  accent: LinkCardAccent = "green",
  className?: string,
) {
  return cn(
    "group block brand-card brand-link-card p-6 transition-all",
    LINK_CARD_ACCENT_CLASS[accent],
    className,
  );
}

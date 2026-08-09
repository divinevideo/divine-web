import {
  parseFeaturedTabDisclosure,
  parseFeaturedTabPosition,
  parseFeaturedTabSlug,
  pickFeaturedTabLabel,
} from '@/lib/featuredTabsTransform';
import { isFeaturedTabMinorRestricted, type ProtectedMinorState } from '@/lib/protectedMinor';
import type { FeaturedTabConfigRaw, ResolvedFeaturedTab } from '@/types/featuredTabs';

function parseTimestamp(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isFeaturedTabEligible(
  config: FeaturedTabConfigRaw,
  now: Date,
  minorState: ProtectedMinorState
): boolean {
  if (!config.enabled || !config.has_content) return false;
  if (!config.visible_to_minors && isFeaturedTabMinorRestricted(minorState)) return false;

  const startsAt = parseTimestamp(config.starts_at);
  const endsAt = parseTimestamp(config.ends_at);
  if (startsAt === null || endsAt === null) return false;

  const currentTime = now.getTime();
  return currentTime >= startsAt && currentTime <= endsAt;
}

export function selectFeaturedTab(
  configs: FeaturedTabConfigRaw[],
  {
    now,
    minorState,
    locale,
  }: {
    now: Date;
    minorState: ProtectedMinorState;
    locale: string | null | undefined;
  }
): ResolvedFeaturedTab | null {
  for (const config of configs) {
    if (!isFeaturedTabEligible(config, now, minorState)) continue;

    const slug = parseFeaturedTabSlug(config.slug);
    if (!slug) continue;

    const label = pickFeaturedTabLabel(config.label, locale);
    if (!label) continue;

    return {
      id: config.id,
      slug,
      label,
      position: parseFeaturedTabPosition(config.position),
      disclosureLabel: parseFeaturedTabDisclosure(config.disclosure_label),
    };
  }

  return null;
}

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
  // Fail closed on schema drift, matching protectedMinor.ts: these three flags
  // are the kill switch and the audience gate, and a truthy non-boolean (the
  // string "false" is truthy) must never be read as permission to render.
  if (config.enabled !== true || config.has_content !== true) return false;
  if (config.visible_to_minors !== true && isFeaturedTabMinorRestricted(minorState)) return false;

  const startsAt = parseTimestamp(config.starts_at);
  const endsAt = parseTimestamp(config.ends_at);
  if (startsAt === null || endsAt === null) return false;

  const currentTime = now.getTime();
  return currentTime >= startsAt && currentTime <= endsAt;
}

function isConfigObject(value: unknown): value is FeaturedTabConfigRaw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The config id is interpolated into the videos URL and reported as the
 * analytics parameter, so an absent or non-string id makes the whole entry
 * unusable rather than merely unlabelled.
 */
function parseConfigId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function selectFeaturedTab(
  // `unknown` on purpose: this is the first code to touch the decoded response
  // body, and an HTTP 200 carrying a missing or non-array `featured_tabs` must
  // resolve to "no featured tab" rather than throw inside a render.
  configs: unknown,
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
  if (!Array.isArray(configs)) return null;

  for (const config of configs) {
    if (!isConfigObject(config)) continue;
    if (!isFeaturedTabEligible(config, now, minorState)) continue;

    const id = parseConfigId(config.id);
    if (!id) continue;

    const slug = parseFeaturedTabSlug(config.slug);
    if (!slug) continue;

    const label = pickFeaturedTabLabel(config.label, locale);
    if (!label) continue;

    return {
      id,
      slug,
      label,
      position: parseFeaturedTabPosition(config.position),
      disclosureLabel: parseFeaturedTabDisclosure(config.disclosure_label),
    };
  }

  return null;
}

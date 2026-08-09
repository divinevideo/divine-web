import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/config';
import type { FunnelcakeResponse, FunnelcakeVideoRaw } from '@/types/funnelcake';
import type {
  DiscoveryTabName,
  FeaturedTabPosition,
  FeaturedTabVideosResponseRaw,
  FeaturedTabVideoRaw,
} from '@/types/featuredTabs';

const MAX_LABEL_LENGTH = 24;
const MAX_DISCLOSURE_LENGTH = 16;
const DISCOVERY_TAB_NAMES = new Set<DiscoveryTabName>(['foryou', 'classics', 'hot', 'hashtags']);

function cleanShortString(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function parseDiscoveryTabName(value: unknown): DiscoveryTabName | null {
  if (typeof value !== 'string') return null;
  return DISCOVERY_TAB_NAMES.has(value as DiscoveryTabName)
    ? (value as DiscoveryTabName)
    : null;
}

export function pickFeaturedTabLabel(
  label: Record<string, string> | null | undefined,
  locale: string | null | undefined
): string | null {
  if (!label || typeof label.default !== 'string') return null;

  const normalizedLocale = normalizeLocale(locale) ?? DEFAULT_LOCALE;
  const localized = typeof label[normalizedLocale] === 'string'
    ? label[normalizedLocale]
    : label.default;
  const cleaned = cleanShortString(localized, MAX_LABEL_LENGTH);

  return cleaned || null;
}

export function parseFeaturedTabPosition(value: unknown): FeaturedTabPosition | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

  const web = (value as { web?: unknown }).web;
  if (typeof web !== 'object' || web === null || Array.isArray(web)) return null;

  const after = parseDiscoveryTabName((web as { after?: unknown }).after);
  const before = parseDiscoveryTabName((web as { before?: unknown }).before);

  // `after` and `before` are mutually exclusive anchors. Keeping both would let
  // a placement contradict itself (anchor from one key, side from the other),
  // so resolve the conflict here rather than in the insertion code.
  if (after) return { after };
  if (before) return { before };

  return null;
}

export function parseFeaturedTabDisclosure(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = cleanShortString(value, MAX_DISCLOSURE_LENGTH);
  return cleaned || null;
}

export function toFunnelcakeVideo(raw: FeaturedTabVideoRaw): FunnelcakeVideoRaw {
  const createdAt = typeof raw.created_at === 'string'
    ? Math.floor(new Date(raw.created_at).getTime() / 1000)
    : raw.created_at;

  return {
    ...raw,
    created_at: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

export function transformFeaturedTabVideosResponse(
  response: FeaturedTabVideosResponseRaw
): FunnelcakeResponse {
  return {
    videos: Array.isArray(response.data)
      ? response.data.map(toFunnelcakeVideo)
      : [],
    next_cursor: response.pagination.next_cursor ?? undefined,
    has_more: response.pagination.has_more,
  };
}

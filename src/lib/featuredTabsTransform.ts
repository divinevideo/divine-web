import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/config';
import type { FunnelcakeResponse, FunnelcakeVideoRaw } from '@/types/funnelcake';
import type {
  DiscoveryTabName,
  FeaturedTabPosition,
  FeaturedTabVideosResponseRaw,
  FeaturedTabVideoRaw,
} from '@/types/featuredTabs';

const MAX_LABEL_LENGTH = 24;
// A disclosure is the one server-supplied string here whose meaning is legal
// rather than decorative — "Sponsored", "Paid partnership". Room for the phrases
// that matter, and the tab renders it in full rather than clipping it again.
const MAX_DISCLOSURE_LENGTH = 24;
const DISCOVERY_TAB_NAMES = new Set<DiscoveryTabName>(['foryou', 'classics', 'hot', 'hashtags']);
// The slug is both the `/discovery/:tab` route segment and the Radix Tabs value.
// The route comparison lowercases `params.tab`, so anything outside this shape
// either breaks the URL or renders a tab that cannot be resolved on reload.
const FEATURED_TAB_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const RESERVED_TAB_SLUGS = new Set<string>([...DISCOVERY_TAB_NAMES, 'top']);

/**
 * Bidi overrides and other invisible formatting characters would let a
 * server-supplied string reorder or hide the text around it in the tab bar, so
 * they are dropped before the string is measured or rendered. Control
 * characters collapse to a space instead of vanishing, so a label carrying a
 * newline stays two words. Written as a codepoint test rather than a character
 * class because the repository sets `noInlineConfig`, which leaves no way to
 * silence `no-control-regex` on the equivalent literal.
 */
function isInvisibleFormatting(code: number): boolean {
  return (code >= 0x200b && code <= 0x200f)   // zero-width and directional marks
    || (code >= 0x202a && code <= 0x202e)     // bidi embedding and override
    || (code >= 0x2066 && code <= 0x2069)     // bidi isolates
    || code === 0xfeff;                       // zero-width no-break space
}

function stripInvisibleFormatting(value: string): string {
  let out = '';

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (isInvisibleFormatting(code)) continue;
    out += code < 0x20 || code === 0x7f ? ' ' : char;
  }

  return out;
}

function cleanShortString(value: string, maxLength: number): string {
  return stripInvisibleFormatting(value)
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function parseDiscoveryTabName(value: unknown): DiscoveryTabName | null {
  if (typeof value !== 'string') return null;
  return DISCOVERY_TAB_NAMES.has(value as DiscoveryTabName)
    ? (value as DiscoveryTabName)
    : null;
}

export function parseFeaturedTabSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const slug = value.trim();
  if (!FEATURED_TAB_SLUG_PATTERN.test(slug)) return null;
  // A slug that shadows a built-in tab would collide on the Tabs value, so the
  // built-in wins the lookup and the featured panel never renders. `top` is the
  // legacy alias Discovery rewrites to `classics`, so it is unroutable too.
  if (RESERVED_TAB_SLUGS.has(slug)) return null;

  return slug;
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
  // `pagination` is guarded like `data`: a payload missing it would otherwise
  // throw outside the client's try/catch, so the circuit breaker never sees it.
  const pagination = response.pagination ?? {};
  const nextCursor = typeof pagination.next_cursor === 'string' && pagination.next_cursor
    ? pagination.next_cursor
    : undefined;

  return {
    videos: Array.isArray(response.data)
      ? response.data.map(toFunnelcakeVideo)
      : [],
    next_cursor: nextCursor,
    has_more: pagination.has_more === true && !!nextCursor,
  };
}

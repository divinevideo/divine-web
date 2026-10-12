import { DEFAULT_LOCALE, normalizeLocale } from '@/lib/i18n/config';
import type { FunnelcakeResponse, FunnelcakeVideoRaw } from '@/types/funnelcake';
import type {
  DiscoveryTabName,
  FeaturedTabVideosResponseRaw,
  FeaturedTabVideoRaw,
} from '@/types/featuredTabs';

const MAX_LABEL_LENGTH = 24;
const MAX_PILL_LABEL_LENGTH = 24;
const MAX_SPONSOR_NAME_LENGTH = 24;
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

export function parseFeaturedTabPillLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = cleanShortString(value, MAX_PILL_LABEL_LENGTH);
  return cleaned || null;
}

export function parseFeaturedTabSponsorName(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const cleaned = cleanShortString(value, MAX_SPONSOR_NAME_LENGTH);
  return cleaned || null;
}

/** The featured tab's glyph when the config supplies no usable emoji. */
export const DEFAULT_FEATURED_TAB_EMOJI = '\u2728';

// One ZWJ family sequence is 7 scalars and a subdivision flag is 7; 16 leaves
// room for every real emoji while bounding what a config can make us render.
const MAX_EMOJI_SCALARS = 16;
const PICTOGRAPH = /^\p{Extended_Pictographic}$/u;
// Extended_Pictographic includes these letter-like symbols (©, ®, ™, ℹ, Ⓜ), but
// they read as text rather than as a tab icon. The Funnelcake validator
// rejects them when an admin saves the emoji, and this check stays in step.
const TEXT_SYMBOLS = new Set(['\u00A9', '\u00AE', '\u2122', '\u2139', '\u24C2']);
const SKIN_TONE = /^\p{Emoji_Modifier}$/u;
const REGIONAL_INDICATOR = /^\p{Regional_Indicator}$/u;
const VS16 = '\uFE0F';
const ZWJ = '\u200D';
const BLACK_FLAG = '\u{1F3F4}';
const CANCEL_TAG = '\u{E007F}';
const TAG_SPEC = /^[\u{E0020}-\u{E007E}]$/u;

function isPictograph(scalar: string | undefined): boolean {
  return scalar !== undefined && !TEXT_SYMBOLS.has(scalar) && PICTOGRAPH.test(scalar);
}

/** A subdivision flag: the black flag, tag specs, then the cancel tag. */
function isTagFlag(scalars: string[]): boolean {
  if (scalars[0] !== BLACK_FLAG || scalars.length < 3) return false;
  if (scalars[scalars.length - 1] !== CANCEL_TAG) return false;
  return scalars.slice(1, -1).every((scalar) => TAG_SPEC.test(scalar));
}

/**
 * A pictograph, each optionally followed by VS16 or a skin-tone modifier, and
 * ZWJ-joined to further pictographs. Every joiner, selector and modifier must
 * sit next to a pictograph, so a value made only of those invisible scalars is
 * rejected instead of rendering an empty tab. Keycaps (digit + U+20E3) are
 * deliberately not allowed: admitting their base characters would let plain
 * digits through.
 */
function isPictographSequence(scalars: string[]): boolean {
  if (!isPictograph(scalars[0])) return false;
  for (let i = 1; i < scalars.length; i += 1) {
    const scalar = scalars[i];
    const previous = scalars[i - 1];
    if (scalar === VS16 || SKIN_TONE.test(scalar)) {
      if (!isPictograph(previous)) return false;
    } else if (scalar === ZWJ) {
      if (!isPictograph(scalars[i + 1])) return false;
    } else if (!isPictograph(scalar) || previous !== ZWJ) {
      return false;
    }
  }
  return true;
}

/** Exactly two regional indicators make a flag; one alone is not an emoji. */
function isRegionalFlag(scalars: string[]): boolean {
  return scalars.length === 2 && scalars.every((scalar) => REGIONAL_INDICATOR.test(scalar));
}

let graphemeSegmenter: Intl.Segmenter | undefined;

/**
 * Returns null where `Intl.Segmenter` is unavailable (older browsers), which
 * fails the emoji check and lands on the default glyph rather than guessing.
 */
function countGraphemes(value: string): number | null {
  if (typeof Intl.Segmenter !== 'function') return null;

  // Built on first use and reused: selection runs on every render of every
  // useFeaturedTab consumer, and constructing a segmenter each time is waste.
  graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  return Array.from(graphemeSegmenter.segment(value)).length;
}

/**
 * The featured tab's emoji is server-supplied and rendered as the whole tab on
 * a phone, so it is validated rather than cleaned: anything that is not exactly
 * one emoji is rejected and the caller falls back to the default. It must not
 * go through stripInvisibleFormatting, which removes the zero-width joiner and
 * would split a ZWJ sequence into several separate pictographs.
 */
export function parseFeaturedTabEmoji(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const emoji = value.trim();
  if (!emoji) return null;

  const scalars = Array.from(emoji);
  if (scalars.length > MAX_EMOJI_SCALARS) return null;
  if (countGraphemes(emoji) !== 1) return null;
  if (!isRegionalFlag(scalars) && !isTagFlag(scalars) && !isPictographSequence(scalars)) {
    return null;
  }

  return emoji;
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
  // throw a TypeError here, turning a merely malformed page into a broken feed.
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

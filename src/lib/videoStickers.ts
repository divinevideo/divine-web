// ABOUTME: Parses the `sticker` tags the Divine app publishes on a video into clickable areas
// ABOUTME: Mirrors divine-mobile's VideoStickerRegion.fromTag, dropping every tag it drops

import type {
  VideoSticker,
  VideoStickerAudience,
  VideoStickerKind,
} from '@/types/video';

/**
 * The spec is the "Divine Sticker Tags" section of divine-mobile's
 * `mobile/docs/NOSTR_VIDEO_EVENTS.md`; the reference reader is
 * `mobile/packages/models/lib/src/video_sticker_region.dart`. A tag looks like
 *
 *   ["sticker", kind, target, "cx cy w h", degrees, startMs, endMs, style, label, audience]
 *
 * and a reader drops the whole tag when any field is malformed, so that a
 * sticker never opens something its creator could not have meant. For a
 * `link` this is a security boundary: only an http(s) address with a host
 * ever comes out, never `javascript:` or any other scheme.
 *
 * Numbers are read the way Dart's `double.tryParse` and `int.tryParse` read
 * them, so a tag the app keeps is kept here and a tag it drops is dropped.
 */

export const VIDEO_STICKER_TAG = 'sticker';

/** The longest label a tag may carry; a longer one is dropped, the button kept. */
export const MAX_STICKER_LABEL_LENGTH = 300;

/** The longest full name of a place a tag may carry. */
export const MAX_STICKER_PLACE_LENGTH = 200;

const MAX_HASHTAG_LENGTH = 100;
const MAX_POLL_OPTIONS = 4;
const MAX_VIDEO_ADDRESS_LENGTH = 300;
/** The start of the year 10000 in Unix seconds. */
const MAX_COUNTDOWN_END = 253402300800n;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;

const STICKER_KINDS: ReadonlySet<string> = new Set<VideoStickerKind>([
  'link',
  'mention',
  'hashtag',
  'sound',
  'place',
  'countdown',
  'reply',
  'poll',
  'quiz',
  'slider',
  'question',
  'prompt',
  'replies',
]);

const AUDIENCES: ReadonlySet<string> = new Set<VideoStickerAudience>([
  'everyone',
  'following',
  'creator',
]);

/** Addressable video kinds an Add yours chain can start with. */
const PROMPT_VIDEO_KINDS: ReadonlySet<string> = new Set(['34235', '34236']);

const HEX64 = /^[0-9a-fA-F]{64}$/;
const BUNDLED_SOUND_ID = /^bundled_[a-z0-9_]+$/;
const HASHTAG_FORBIDDEN = /[\s#/?]/;
const DART_DOUBLE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const DART_INT = /^([+-]?)(?:0[xX]([0-9a-fA-F]+)|(\d+))$/;
// Dart's String.trim also strips U+0085, which JavaScript's does not.
const DART_WHITESPACE_EDGES = /^[\s\u0085]+|[\s\u0085]+$/g;

function dartTrim(value: string): string {
  return value.replace(DART_WHITESPACE_EDGES, '');
}

/** `raw` as a finite number the way Dart's `double.tryParse` reads one, else null. */
function parseFiniteDouble(raw: string): number | null {
  const value = dartTrim(raw);
  if (!DART_DOUBLE.test(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `raw` the way Dart's `int.tryParse` reads it on a 64-bit platform: decimal
 * or `0x` hex with an optional sign, null when it is neither or overflows.
 */
function parseDartInt(raw: string): bigint | null {
  const match = DART_INT.exec(dartTrim(raw));
  if (!match) return null;
  const [, sign, hex, decimal] = match;
  const magnitude = hex !== undefined ? BigInt(`0x${hex}`) : BigInt(decimal);
  const value = sign === '-' ? -magnitude : magnitude;
  return value < INT64_MIN || value > INT64_MAX ? null : value;
}

function isHex64(value: string): boolean {
  return HEX64.test(value);
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit <= 0x1f || unit === 0x7f) return true;
  }
  return false;
}

/** Replaces unpaired UTF-16 surrogates with U+FFFD, keeping valid pairs. */
export function sanitizeUtf16(text: string): string {
  let result = '';
  let changed = false;
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    const isHigh = unit >= 0xd800 && unit <= 0xdbff;
    const isLow = unit >= 0xdc00 && unit <= 0xdfff;
    if (isHigh && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        result += text[i] + text[i + 1];
        i++;
        continue;
      }
    }
    if (isHigh || isLow) {
      result += '�';
      changed = true;
      continue;
    }
    result += text[i];
  }
  return changed ? result : text;
}

/**
 * Whether `value` is the address of a video, `<kind>:<pubkey>:<d>`, the way
 * an Add yours names its chain's first video.
 */
function isVideoAddress(value: string): boolean {
  const parts = value.split(':');
  if (parts.length < 3 || value.length > MAX_VIDEO_ADDRESS_LENGTH) return false;
  const dTag = parts.slice(2).join(':');
  return (
    PROMPT_VIDEO_KINDS.has(parts[0]) &&
    isHex64(parts[1]) &&
    dTag.length > 0 &&
    !hasControlCharacter(dTag)
  );
}

/**
 * An http(s) address with a host, as the WHATWG URL parser normalizes it, or
 * null. The `//` is required, as Dart's `Uri` needs it to find a host, where
 * the WHATWG parser would also take `https:example.com`.
 */
function parseLinkTarget(value: string): string | null {
  if (!/^https?:\/\//i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!url.hostname) return null;
  return url.href;
}

function parseHashtagTarget(value: string): string | null {
  const hashtag = value.startsWith('#') ? value.slice(1) : value;
  if (
    hashtag.length === 0 ||
    hashtag.length > MAX_HASHTAG_LENGTH ||
    HASHTAG_FORBIDDEN.test(hashtag)
  ) {
    return null;
  }
  return sanitizeUtf16(hashtag.toLowerCase());
}

/**
 * `raw` as the target of a `kind` sticker, or null when the whole tag is
 * dropped. An empty string means the sticker points at nothing of its own.
 */
function parseTarget(kind: VideoStickerKind, raw: string): string | null {
  const value = dartTrim(raw);
  switch (kind) {
    case 'link':
      return parseLinkTarget(value);
    case 'mention':
    case 'reply': {
      const hex = value.toLowerCase();
      return isHex64(hex) ? hex : null;
    }
    case 'hashtag':
      return parseHashtagTarget(value);
    case 'sound': {
      // The credited sound's own page, or none for the video's own sound.
      if (BUNDLED_SOUND_ID.test(value)) return value;
      const eventId = value.toLowerCase();
      return isHex64(eventId) ? eventId : '';
    }
    case 'place':
      // Handed to a map search, and drawn nowhere else.
      if (
        value.length === 0 ||
        value.length > MAX_STICKER_PLACE_LENGTH ||
        hasControlCharacter(value)
      ) {
        return null;
      }
      return sanitizeUtf16(value);
    case 'countdown': {
      const seconds = parseDartInt(value);
      if (seconds === null || seconds <= 0n || seconds >= MAX_COUNTDOWN_END) {
        return null;
      }
      return seconds.toString();
    }
    case 'poll':
    case 'quiz':
    case 'slider': {
      const eventId = value.toLowerCase();
      return isHex64(eventId) ? eventId : '';
    }
    case 'prompt':
      if (value.length === 0) return '';
      return isVideoAddress(value) ? value : null;
    case 'question':
    case 'replies':
      return '';
  }
}

/** Absent (`undefined`), a time in ms, or `false` when malformed. */
function parseMilliseconds(raw: string | undefined): number | undefined | false {
  if (raw === undefined) return undefined;
  const value = dartTrim(raw);
  if (value.length === 0) return undefined;
  const milliseconds = parseDartInt(value);
  if (milliseconds === null || milliseconds < 0n) return false;
  return Number(milliseconds);
}

function isOneLine(label: string): boolean {
  return (
    dartTrim(label).length > 0 &&
    !label.includes('\n') &&
    label.length <= MAX_STICKER_LABEL_LENGTH
  );
}

/** A poll's question and two to four answers, or a slider's question and emoji. */
function isPollLabel(kind: VideoStickerKind, label: string): boolean {
  const lines = label.split('\n');
  if (
    label.length > MAX_STICKER_LABEL_LENGTH ||
    lines.some((line) => dartTrim(line).length === 0)
  ) {
    return false;
  }
  return kind === 'slider'
    ? lines.length === 2
    : lines.length >= 3 && lines.length <= MAX_POLL_OPTIONS + 1;
}

/** A question on one line, or a prompt and then the hashtag its answers share. */
function isPromptLabel(kind: VideoStickerKind, label: string): boolean {
  if (kind === 'question') return isOneLine(label);
  const lines = label.split('\n');
  if (lines.length !== 2 || label.length > MAX_STICKER_LABEL_LENGTH) return false;
  const [prompt, hashtag] = lines;
  return dartTrim(prompt).length > 0 && parseHashtagTarget(dartTrim(hashtag)) === hashtag;
}

function isPollKind(kind: VideoStickerKind): boolean {
  return kind === 'poll' || kind === 'quiz' || kind === 'slider';
}

/** Who may answer, `everyone` when absent or empty, null when unknown. */
function parseAudience(raw: string | undefined): VideoStickerAudience | null {
  const value = dartTrim(raw ?? '');
  if (value.length === 0) return 'everyone';
  return AUDIENCES.has(value) ? (value as VideoStickerAudience) : null;
}

/**
 * Whether any of the sticker can lie on the frame, measured generously by the
 * circle around it, however it is turned.
 */
export function isVideoStickerOnFrame(
  sticker: Pick<VideoSticker, 'centerX' | 'centerY' | 'width' | 'height'>,
): boolean {
  const reach = sticker.width + sticker.height;
  return (
    sticker.centerX + reach > 0 &&
    sticker.centerX - reach < 1 &&
    sticker.centerY + reach > 0 &&
    sticker.centerY - reach < 1
  );
}

/**
 * The sticker one `sticker` tag publishes, or null when it is no sticker tag
 * or the app would drop it.
 */
export function parseVideoStickerTag(tag: unknown): VideoSticker | null {
  if (!Array.isArray(tag) || tag.length < 5 || tag[0] !== VIDEO_STICKER_TAG) return null;
  // Only strings can be what the app reads; anything else is a broken tag.
  if (tag.slice(0, 10).some((field) => typeof field !== 'string')) return null;
  const fields = tag as string[];

  if (!STICKER_KINDS.has(fields[1])) return null;
  const kind = fields[1] as VideoStickerKind;
  const target = parseTarget(kind, fields[2]);
  if (target === null) return null;

  const area = dartTrim(fields[3]).split(/\s+/).map(parseFiniteDouble);
  if (area.length !== 4 || area.some((value) => value === null)) return null;
  const [centerX, centerY, width, height] = area as number[];
  if (width <= 0 || height <= 0 || width > 4 || height > 4) return null;

  const degrees = parseFiniteDouble(fields[4]);
  if (degrees === null) return null;

  const startMs = parseMilliseconds(fields[5]);
  const endMs = parseMilliseconds(fields[6]);
  if (startMs === false || endMs === false) return null;
  if (startMs !== undefined && endMs !== undefined && endMs <= startMs) return null;

  const style = dartTrim(fields[7] ?? '');
  const label = sanitizeUtf16(dartTrim(fields[8] ?? ''));
  // A vote needs the question and what there is to pick, and the other
  // stickers taking answers what they ask.
  if (isPollKind(kind) && !isPollLabel(kind, label)) return null;
  if ((kind === 'question' || kind === 'prompt') && !isPromptLabel(kind, label)) {
    return null;
  }
  if (kind === 'replies' && !isOneLine(label)) return null;

  // A sticker restricted in a way this reader does not know must not be
  // offered to everyone.
  const audience =
    kind === 'prompt' || kind === 'replies' ? parseAudience(fields[9]) : 'everyone';
  if (audience === null) return null;

  const sticker: VideoSticker = {
    kind,
    target,
    centerX,
    centerY,
    width,
    height,
    // Whole turns dropped, as the app does: the sign follows the angle's.
    rotationDegrees: (degrees % 360) + 0,
    audience,
  };
  if (startMs !== undefined) sticker.startMs = startMs;
  if (endMs !== undefined) sticker.endMs = endMs;
  if (style.length > 0) sticker.style = style;
  if (label.length > 0 && label.length <= MAX_STICKER_LABEL_LENGTH) sticker.label = label;

  // Off the frame, a huge centre would overflow once laid out.
  return isVideoStickerOnFrame(sticker) ? sticker : null;
}

/** The stickers among an event's tags, in order, skipping every broken one. */
export function parseVideoStickers(tags: readonly unknown[] | undefined): VideoSticker[] {
  if (!Array.isArray(tags)) return [];
  const stickers: VideoSticker[] = [];
  for (const tag of tags) {
    const sticker = parseVideoStickerTag(tag);
    if (sticker) stickers.push(sticker);
  }
  return stickers;
}

/** Whether `sticker` shows at `positionMs` of the video: from its start until just before its end. */
export function isVideoStickerShownAt(
  sticker: Pick<VideoSticker, 'startMs' | 'endMs'>,
  positionMs: number,
): boolean {
  return (
    (sticker.startMs === undefined || positionMs >= sticker.startMs) &&
    (sticker.endMs === undefined || positionMs < sticker.endMs)
  );
}

/** NIP-71 video kinds a NIP-22 root may name, as the app accepts them. */
const REPLY_ROOT_VIDEO_KINDS: ReadonlySet<number> = new Set([21, 22, 34235, 34236]);

function firstTagValue(tags: readonly unknown[], name: string): string | undefined {
  for (const tag of tags) {
    if (!Array.isArray(tag) || tag.length < 2 || tag[0] !== name) continue;
    if (typeof tag[1] !== 'string') continue;
    const value = dartTrim(tag[1]);
    if (value.length > 0) return value;
  }
  return undefined;
}

function parseKind(raw: string): number | null {
  const kind = parseDartInt(raw);
  return kind === null ? null : Number(kind);
}

/**
 * The video a video replies to, from its uppercase NIP-22 root tags: its
 * `A` address when that names a video, else its `E` event id. Undefined when
 * the video is no reply to a video. Mirrors the app's
 * `VideoEvent.replyRootRouteId`, which a reply sticker opens.
 */
export function getReplyRootRouteId(tags: readonly unknown[] | undefined): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  const eventId = firstTagValue(tags, 'E');
  const rawAddress = firstTagValue(tags, 'A');
  const separator = rawAddress?.indexOf(':') ?? -1;
  const addressKind = rawAddress === undefined
    ? null
    : parseKind(separator === -1 ? rawAddress : rawAddress.slice(0, separator));
  const address = addressKind !== null && REPLY_ROOT_VIDEO_KINDS.has(addressKind)
    ? rawAddress
    : undefined;
  if (eventId === undefined && address === undefined) return undefined;

  const explicitKind = parseKind(firstTagValue(tags, 'K') ?? '');
  const rootKind = explicitKind !== null
    ? (REPLY_ROOT_VIDEO_KINDS.has(explicitKind) ? explicitKind : null)
    : (address !== undefined ? addressKind : null);
  if (rootKind === null) return undefined;

  return address ?? eventId;
}

/** The stickers and reply root of a video's tags, for `ParsedVideoData`. */
export function getVideoStickerFields(
  tags: readonly unknown[] | undefined,
): { stickers?: VideoSticker[]; replyRootRouteId?: string } {
  const stickers = parseVideoStickers(tags);
  const replyRootRouteId = getReplyRootRouteId(tags);
  return {
    ...(stickers.length > 0 ? { stickers } : {}),
    ...(replyRootRouteId !== undefined ? { replyRootRouteId } : {}),
  };
}

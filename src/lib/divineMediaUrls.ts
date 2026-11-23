// ABOUTME: Picks the playback URL for videos hosted on media.divine.video
// ABOUTME: Plays the progressive 720p MP4 first and keeps the original blob as fallback

const DIVINE_MEDIA_HOSTNAME = 'media.divine.video';
const ORIGINAL_BLOB_PATH = /^\/([0-9a-f]{64})(?:\.[a-z0-9]+)?$/i;
const PROGRESSIVE_720P_PATH = /^\/([0-9a-f]{64})\/720p\.mp4$/i;

/**
 * How long a failed 720p rendition is skipped. A missing rendition makes the
 * media server start transcoding, so it is worth trying again later.
 */
const UNAVAILABLE_RETRY_MS = 10 * 60 * 1000;

const unavailableSince = new Map<string, number>();

interface DivineMediaPath {
  origin: string;
  hash: string;
}

function toProgressiveUrl({ origin, hash }: DivineMediaPath): string {
  return `${origin}/${hash}/720p.mp4`;
}

function matchDivineMediaPath(url: string, pattern: RegExp): DivineMediaPath | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== DIVINE_MEDIA_HOSTNAME) return undefined;
    const hash = pattern.exec(parsed.pathname)?.[1];
    return hash ? { origin: parsed.origin, hash: hash.toLowerCase() } : undefined;
  } catch {
    return undefined;
  }
}

function isMarkedUnavailable(hash: string, now: number): boolean {
  const failedAt = unavailableSince.get(hash);
  if (failedAt === undefined) return false;
  if (now - failedAt < UNAVAILABLE_RETRY_MS) return true;
  unavailableSince.delete(hash);
  return false;
}

/**
 * Returns the progressive 720p MP4 rendition of an original Divine blob URL
 * (`https://media.divine.video/{sha256}`, with or without an extension).
 * Any other URL, including renditions and HLS playlists, returns undefined.
 *
 * Divine videos are a few seconds long, so one faststart MP4 request starts
 * faster than HLS, and the rendition is a fraction of the original's size.
 */
export function getProgressive720pUrl(url: string): string | undefined {
  const match = matchDivineMediaPath(url, ORIGINAL_BLOB_PATH);
  return match ? toProgressiveUrl(match) : undefined;
}

/**
 * Remembers that a 720p rendition failed to load, so the next playback of the
 * same video goes straight to the original for a while. URLs that are not
 * 720p renditions are ignored.
 */
export function markProgressiveUnavailable(url: string, now: number = Date.now()): void {
  const match = matchDivineMediaPath(url, PROGRESSIVE_720P_PATH);
  if (match) unavailableSince.set(match.hash, now);
}

/**
 * Orders the URLs a player should try: the 720p rendition of a Divine blob
 * (unless it recently failed or the clip is from the migrated archive), then
 * the source itself, then the fallbacks.
 */
export function buildPlaybackUrls(
  src: string | undefined,
  fallbackUrls: readonly string[] = [],
  { now = Date.now(), isVineMigrated = false }: { now?: number; isVineMigrated?: boolean } = {},
): string[] {
  const urls: string[] = [];
  if (src) {
    const original = matchDivineMediaPath(src, ORIGINAL_BLOB_PATH);
    if (original && !isVineMigrated && !isMarkedUnavailable(original.hash, now)) {
      urls.push(toProgressiveUrl(original));
    }
    urls.push(src);
  }
  urls.push(...fallbackUrls);
  return [...new Set(urls)];
}

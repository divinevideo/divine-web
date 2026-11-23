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
 * How long after publishing link previews keep pointing at the original. The
 * rendition is made from a queue after upload and may lag behind.
 */
const LINK_PREVIEW_RENDITION_DELAY_SECONDS = 60 * 60;

/**
 * Picks the video URL for link previews (`og:video`, `twitter:player:stream`).
 * Unfurlers cannot fall back to a second URL, so the 720p rendition is used
 * only where it surely exists: an hour after publishing, and never for classic
 * Vines, which may not have a rendition yet.
 */
export function selectLinkPreviewVideoUrl(
  videoUrl: string | undefined,
  { createdAt, isClassicVine }: { createdAt?: number; isClassicVine: boolean },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string | undefined {
  if (!videoUrl || isClassicVine || !createdAt) return videoUrl;
  if (nowSeconds - createdAt < LINK_PREVIEW_RENDITION_DELAY_SECONDS) return videoUrl;
  return getProgressive720pUrl(videoUrl) ?? videoUrl;
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
 * (unless it recently failed), then the source itself, then the fallbacks.
 */
export function buildPlaybackUrls(
  src: string | undefined,
  fallbackUrls: readonly string[] = [],
  now: number = Date.now(),
): string[] {
  const urls: string[] = [];
  if (src) {
    const original = matchDivineMediaPath(src, ORIGINAL_BLOB_PATH);
    if (original && !isMarkedUnavailable(original.hash, now)) {
      urls.push(toProgressiveUrl(original));
    }
    urls.push(src);
  }
  urls.push(...fallbackUrls);
  return [...new Set(urls)];
}

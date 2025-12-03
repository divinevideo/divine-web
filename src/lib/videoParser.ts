// ABOUTME: Liberal video URL parser implementing Postel's Law for maximum compatibility
// ABOUTME: Extracts video URLs and metadata from multiple tag sources with fallback to content parsing

import type { NostrEvent } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND, VIDEO_KINDS, type ParsedVideoData, type RepostMetadata } from '@/types/video';
import type { VideoMetadata, VideoEvent, ProofModeData, ProofModeLevel } from '@/types/video';

// Common video file extensions - used only as hints, not requirements
const _VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.gif', '.m3u8', '.mpd', '.avi', '.mkv', '.ogv', '.ogg'];

/**
 * Checks if a URL looks like it could be a video URL
 * Following Postel's Law - be liberal in what we accept
 */
function isValidVideoUrl(url: string): boolean {
  try {
    // Just verify it's a valid URL structure
    const parsedUrl = new URL(url);

    // Block vine.co URLs - they're CORS-blocked and the site is dead
    if (parsedUrl.hostname === 'vine.co' || parsedUrl.hostname.endsWith('.vine.co')) {
      return false;
    }

    // Accept any other valid URL - let the video player handle whether it can play it
    return true;
  } catch {
    // Not a valid URL structure
    return false;
  }
}

/**
 * Parse imeta tag to extract video metadata
 * Supports two formats:
 * Format 1: ["imeta", "url https://...", "m video/mp4"] - space-separated key-value
 * Format 2: ["imeta", "url", "https://...", "m", "video/mp4"] - separate elements
 */
function parseImetaTag(tag: string[]): VideoMetadata | null {
  if (tag[0] !== 'imeta') return null;

  const metadata: VideoMetadata = { url: '' };

  // Detect format: if tag[1] contains a space, it's Format 1
  const isFormat1 = tag[1] && tag[1].includes(' ');

  if (isFormat1) {
    // Format 1: "key value" pairs with space separation
    for (let i = 1; i < tag.length; i++) {
      const element = tag[i];
      if (!element || typeof element !== 'string') continue;

      const spaceIndex = element.indexOf(' ');
      if (spaceIndex === -1) continue;

      const key = element.substring(0, spaceIndex);
      const value = element.substring(spaceIndex + 1);

      if (!value) continue;

      switch (key) {
        case 'url':
          if (isValidVideoUrl(value)) {
            metadata.url = value;
          }
          break;
        case 'm':
          metadata.mimeType = value;
          break;
        case 'dim':
          metadata.dimensions = value;
          break;
        case 'blurhash':
          metadata.blurhash = value;
          break;
        case 'image':
          metadata.thumbnailUrl = value;
          break;
        case 'duration':
          metadata.duration = parseInt(value);
          break;
        case 'size':
          metadata.size = parseInt(value);
          break;
        case 'x':
          metadata.hash = value;
          break;
        case 'hls':
          metadata.hlsUrl = value;
          break;
      }
    }
  } else {
    // Format 2: separate elements for keys and values
    for (let i = 1; i < tag.length; i += 2) {
      const key = tag[i];
      const value = tag[i + 1];

      if (!key || !value || typeof key !== 'string' || typeof value !== 'string') continue;

      switch (key) {
        case 'url':
          if (isValidVideoUrl(value)) {
            metadata.url = value;
          }
          break;
        case 'm':
          metadata.mimeType = value;
          break;
        case 'dim':
          metadata.dimensions = value;
          break;
        case 'blurhash':
          metadata.blurhash = value;
          break;
        case 'image':
          metadata.thumbnailUrl = value;
          break;
        case 'duration':
          metadata.duration = parseInt(value);
          break;
        case 'size':
          metadata.size = parseInt(value);
          break;
        case 'x':
          metadata.hash = value;
          break;
        case 'hls':
          metadata.hlsUrl = value;
          break;
      }
    }
  }

  return metadata.url ? metadata : null;
}

/**
 * Convert Divine CDN HLS URL to MP4 URL (only for specific Divine CDN URLs)
 * Example: https://cdn.divine.video/xyz/manifest/video.m3u8 -> https://cdn.divine.video/xyz/downloads/default.mp4
 */
function _convertHlsToMp4(hlsUrl: string): string | null {
  // Only convert Divine CDN URLs to avoid breaking other services
  if (hlsUrl.includes('cdn.divine.video') && hlsUrl.includes('/manifest/video.m3u8')) {
    return hlsUrl.replace('/manifest/video.m3u8', '/downloads/default.mp4');
  }
  return null;
}

/**
 * Extract video URL from event following spec priority
 */
function extractVideoUrl(event: NostrEvent): string | null {
  // Primary video URL should be in `imeta` tag with url field
  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const metadata = parseImetaTag(tag);
      if (metadata?.url && isValidVideoUrl(metadata.url)) {
        return metadata.url;
      }
    }
  }

  // Fallback 1: Check 'url' tag (basic video URL)
  const urlTag = event.tags.find(tag => tag[0] === 'url' && tag[1] && isValidVideoUrl(tag[1]));
  if (urlTag?.[1]) {
    return urlTag[1];
  }

  // Fallback 2: Check 'r' tag for video reference
  const rTags = event.tags.filter(tag => tag[0] === 'r' && tag[1] && isValidVideoUrl(tag[1]));
  for (const rTag of rTags) {
    // Prioritize MP4 URLs over streaming formats
    if (rTag[1].includes('.mp4')) {
      return rTag[1];
    }
  }

  // Return first valid r tag if no MP4 found
  if (rTags.length > 0) {
    return rTags[0][1];
  }

  // Last resort: Parse URLs from content
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = event.content.match(urlRegex) || [];
  for (const url of urls) {
    if (isValidVideoUrl(url)) {
      return url;
    }
  }

  return null;
}

/**
 * Extract limited fallback video URLs from event tags
 */
function extractAllVideoUrls(event: NostrEvent): string[] {
  const urls: string[] = [];

  // 1. All URLs from imeta tags (both MP4 and HLS)
  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const metadata = parseImetaTag(tag);
      if (metadata?.url && isValidVideoUrl(metadata.url) && !urls.includes(metadata.url)) {
        // Prioritize MP4 URLs over HLS
        if (metadata.url.includes('.mp4')) {
          urls.unshift(metadata.url);
        } else {
          urls.push(metadata.url);
        }
      }
    }
  }

  // 2. Only include MP4 r tags as fallbacks (skip streaming formats that cause issues)
  const rTags = event.tags.filter(tag => tag[0] === 'r' && tag[1] && isValidVideoUrl(tag[1]));
  for (const rTag of rTags) {
    if (rTag[1].includes('.mp4') && !urls.includes(rTag[1])) {
      urls.push(rTag[1]);
    }
  }

  // 3. URL tag as final fallback
  const urlTag = event.tags.find(tag => tag[0] === 'url' && tag[1] && isValidVideoUrl(tag[1]));
  if (urlTag?.[1] && !urls.includes(urlTag[1])) {
    urls.push(urlTag[1]);
  }

  // Limit to max 3 URLs to prevent cascade failures
  return urls.slice(0, 3);
}

/**
 * Extract video metadata from video event
 */
export function extractVideoMetadata(event: NostrEvent): VideoMetadata | null {
  const primaryUrl = extractVideoUrl(event);
  if (!primaryUrl) {
    return null;
  }

  const metadata: VideoMetadata = { url: primaryUrl };

  // Extract additional metadata from imeta tag
  for (const tag of event.tags) {
    if (tag[0] === 'imeta') {
      const imetaData = parseImetaTag(tag);
      if (imetaData) {
        metadata.mimeType = imetaData.mimeType || metadata.mimeType;
        metadata.dimensions = imetaData.dimensions || metadata.dimensions;
        metadata.blurhash = imetaData.blurhash || metadata.blurhash;
        metadata.thumbnailUrl = imetaData.thumbnailUrl || metadata.thumbnailUrl;
        metadata.duration = imetaData.duration || metadata.duration;
        metadata.size = imetaData.size || metadata.size;
        metadata.hash = imetaData.hash || metadata.hash;
      }
    }
  }

  // Extract HLS manifest URL (.m3u8) from all available sources
  const allUrls = extractAllVideoUrls(event);
  for (const url of allUrls) {
    if (url.includes('.m3u8') && !metadata.hlsUrl) {
      metadata.hlsUrl = url;
      break;
    }
  }

  // Add limited fallback URLs to prevent cascade failures
  const fallbackUrls = allUrls.filter(u => u !== primaryUrl && u !== metadata.hlsUrl);
  if (fallbackUrls.length > 0) {
    metadata.fallbackUrls = fallbackUrls;
  }

  return metadata;
}

/**
 * Parse a video event and extract all relevant data
 */
export function parseVideoEvent(event: NostrEvent): VideoEvent | null {
  // Extract video metadata
  const videoMetadata = extractVideoMetadata(event);
  if (!videoMetadata) {
    return null;
  }

  // Extract other metadata
  const titleTag = event.tags.find(tag => tag[0] === 'title');
  const title = titleTag?.[1];

  // Extract hashtags
  const hashtags = event.tags
    .filter(tag => tag[0] === 't')
    .map(tag => tag[1])
    .filter(Boolean);

  // Create VideoEvent
  const videoEvent: VideoEvent = {
    ...event,
    kind: event.kind as typeof SHORT_VIDEO_KIND, // Kind 34236 Addressable Short Videos
    videoMetadata,
    title,
    hashtags
  };

  return videoEvent;
}

/**
 * Get the d tag (vine ID) from an event
 */
export function getVineId(event: NostrEvent): string | null {
  const dTag = event.tags.find(tag => tag[0] === 'd');
  return dTag?.[1] || null;
}

/**
 * Get original publication timestamp from event tags
 * NOTE: This is the published_at tag (NIP-31) which can be used by ANY video
 * to set a custom publication date. DO NOT use this to determine if a video
 * is from Vine - use getOriginPlatform() instead.
 */
export function getOriginalVineTimestamp(event: NostrEvent): number | undefined {
  // Check for published_at tag (NIP-31 timestamp)
  const publishedAtTag = event.tags.find(tag => tag[0] === 'published_at');
  if (publishedAtTag?.[1]) {
    const timestamp = parseInt(publishedAtTag[1]);
    if (!isNaN(timestamp)) {
      return timestamp;
    }
  }

  // Check for vine_created_at tag (fallback)
  const vineCreatedAtTag = event.tags.find(tag => tag[0] === 'vine_created_at' || tag[0] === 'original_created_at');
  if (vineCreatedAtTag?.[1]) {
    const timestamp = parseInt(vineCreatedAtTag[1]);
    if (!isNaN(timestamp)) return timestamp;
  }

  return undefined;
}

/**
 * Get origin platform information from event tags
 * Checks both 'origin' tag (newer format) and 'platform' tag (legacy vine-archaeologist format)
 * Origin format: ["origin", platform, external-id, original-url, optional-metadata]
 * Example: ["origin", "vine", "hBFP5LFKUOU", "https://vine.co/v/hBFP5LFKUOU"]
 * Platform format: ["platform", "vine"] (used by vine-archaeologist)
 */
export function getOriginPlatform(event: NostrEvent): {
  platform: string;
  externalId: string;
  url?: string;
  metadata?: string;
} | undefined {
  // First check for 'origin' tag (newer format)
  const originTag = event.tags.find(tag => tag[0] === 'origin');
  if (originTag && originTag[1] && originTag[2]) {
    return {
      platform: originTag[1],
      externalId: originTag[2],
      url: originTag[3],
      metadata: originTag[4]
    };
  }

  // Fallback to 'platform' tag (legacy vine-archaeologist format)
  const platformTag = event.tags.find(tag => tag[0] === 'platform');
  if (platformTag && platformTag[1]) {
    // For platform tag, extract externalId from d tag
    const dTag = event.tags.find(tag => tag[0] === 'd');
    const externalId = dTag?.[1] || '';

    // Extract original URL from r tag
    const rTag = event.tags.find(tag => tag[0] === 'r' && tag[1]?.includes('vine.co'));

    return {
      platform: platformTag[1],
      externalId,
      url: rTag?.[1],
      metadata: undefined
    };
  }

  return undefined;
}

/**
 * Check if video is migrated from original Vine platform
 * Uses 'origin' or 'platform' tag, NOT 'published_at' tag
 */
export function isVineMigrated(event: NostrEvent): boolean {
  const origin = getOriginPlatform(event);
  return origin?.platform?.toLowerCase() === 'vine';
}

/**
 * Get loop count from event tags
 */
export function getLoopCount(event: NostrEvent): number {
  // Check for loop_count tag
  const loopCountTag = event.tags.find(tag => tag[0] === 'loop_count' || tag[0] === 'loops');
  if (loopCountTag?.[1]) {
    const count = parseInt(loopCountTag[1]);
    if (!isNaN(count)) return count;
  }

  // Check for view_count tag as fallback
  const viewCountTag = event.tags.find(tag => tag[0] === 'view_count' || tag[0] === 'views');
  if (viewCountTag?.[1]) {
    const count = parseInt(viewCountTag[1]);
    if (!isNaN(count)) return count;
  }

  // Return 0 for videos without explicit view counts
  return 0;
}

/**
 * Get original Vine like count from event tags
 */
export function getOriginalLikeCount(event: NostrEvent): number | undefined {
  const likesTag = event.tags.find(tag => tag[0] === 'likes');
  if (likesTag?.[1]) {
    const count = parseInt(likesTag[1]);
    if (!isNaN(count)) return count;
  }
  return undefined;
}

/**
 * Get original Vine repost count from event tags
 */
export function getOriginalRepostCount(event: NostrEvent): number | undefined {
  const repostsTag = event.tags.find(tag => tag[0] === 'reposts' || tag[0] === 'revines');
  if (repostsTag?.[1]) {
    const count = parseInt(repostsTag[1]);
    if (!isNaN(count)) return count;
  }
  return undefined;
}

/**
 * Get original Vine comment count from event tags
 */
export function getOriginalCommentCount(event: NostrEvent): number | undefined {
  const commentsTag = event.tags.find(tag => tag[0] === 'comments');
  if (commentsTag?.[1]) {
    const count = parseInt(commentsTag[1]);
    if (!isNaN(count)) return count;
  }
  return undefined;
}

/**
 * Extract ProofMode verification data from event tags
 * Tags follow Flutter app format (matching video_event_publisher.dart):
 * - verification: verified_mobile | verified_web | basic_proof | unverified
 * - proofmode: JSON string with native proof data
 * - device_attestation: Device attestation token
 * - pgp_fingerprint: PGP public key fingerprint
 */
export function getProofModeData(event: NostrEvent): ProofModeData | undefined {
  const levelTag = event.tags.find(tag => tag[0] === 'verification');

  // If no verification level tag found, return undefined
  if (!levelTag?.[1]) {
    return undefined;
  }

  // Parse verification level
  let level: ProofModeLevel = 'unverified';
  const tagLevel = levelTag[1];
  if (tagLevel === 'verified_mobile' || tagLevel === 'verified_web' ||
      tagLevel === 'basic_proof' || tagLevel === 'unverified') {
    level = tagLevel;
  }

  // Extract other proof data
  const manifestTag = event.tags.find(tag => tag[0] === 'proofmode');
  const attestationTag = event.tags.find(tag => tag[0] === 'device_attestation');
  const fingerprintTag = event.tags.find(tag => tag[0] === 'pgp_fingerprint');

  // Parse manifest JSON if present
  let manifestData: Record<string, unknown> | undefined;
  if (manifestTag?.[1]) {
    try {
      manifestData = JSON.parse(manifestTag[1]);
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {
    level,
    manifest: manifestTag?.[1],
    manifestData,
    deviceAttestation: attestationTag?.[1],
    pgpFingerprint: fingerprintTag?.[1],
  };
}

/**
 * Generate thumbnail URL for a video
 */
export function getThumbnailUrl(event: VideoEvent): string | undefined {
  // First check if we have thumbnail in metadata
  if (event.videoMetadata?.thumbnailUrl) {
    return event.videoMetadata.thumbnailUrl;
  }

  // Check for image tag
  const imageTag = event.tags.find(tag => tag[0] === 'image');
  if (imageTag?.[1]) {
    return imageTag[1];
  }

  // Check for thumb tag
  const thumbTag = event.tags.find(tag => tag[0] === 'thumb');
  if (thumbTag?.[1]) {
    return thumbTag[1];
  }

  // If we have a video URL, return it as fallback (video element can show first frame)
  if (event.videoMetadata?.url) {
    return event.videoMetadata.url;
  }

  // No thumbnail available
  return undefined;
}

/**
 * Helper functions for working with ParsedVideoData reposts array
 */

/**
 * Check if a video has been reposted
 */
export function isReposted(video: ParsedVideoData): boolean {
  return video.reposts && video.reposts.length > 0;
}

/**
 * Get the most recent repost timestamp, or createdAt if no reposts
 */
export function getLatestRepostTime(video: ParsedVideoData): number {
  if (!video.reposts || video.reposts.length === 0) {
    return video.createdAt;
  }
  return Math.max(...video.reposts.map(r => r.repostedAt));
}

/**
 * Get total number of reposts
 */
export function getTotalReposts(video: ParsedVideoData): number {
  return video.reposts ? video.reposts.length : 0;
}

/**
 * Get list of unique reposters (deduplicated by pubkey)
 */
export function getUniqueReposters(video: ParsedVideoData): RepostMetadata[] {
  if (!video.reposts || video.reposts.length === 0) return [];

  const seen = new Set<string>();
  return video.reposts.filter(repost => {
    if (seen.has(repost.reposterPubkey)) return false;
    seen.add(repost.reposterPubkey);
    return true;
  });
}

/**
 * Add a repost to a video's reposts array
 */
export function addRepost(video: ParsedVideoData, repost: RepostMetadata): ParsedVideoData {
  return {
    ...video,
    reposts: [...(video.reposts || []), repost]
  };
}

/**
 * Validates that a NIP-71 video event has required fields
 * Centralized validation function used by all video hooks
 */
export function validateVideoEvent(event: NostrEvent): boolean {
  if (!VIDEO_KINDS.includes(event.kind)) return false;

  // Kind 34236 (addressable/replaceable event) MUST have d tag per NIP-33
  if (event.kind === SHORT_VIDEO_KIND) {
    const vineId = getVineId(event);
    if (!vineId) {
      // Validation failure - missing required d tag
      return false;
    }
  }

  return true;
}

/**
 * Parse video events into standardized format
 * Centralized parsing function used by all video hooks
 *
 * @param events - Array of NostrEvent objects to parse
 * @returns Array of ParsedVideoData objects
 */
export function parseVideoEvents(events: NostrEvent[]): ParsedVideoData[] {
  const parsedVideos: ParsedVideoData[] = [];

  for (const event of events) {
    if (!validateVideoEvent(event)) continue;

    const videoEvent = parseVideoEvent(event);
    if (!videoEvent) continue;

    const vineId = getVineId(event);
    if (!vineId && event.kind === SHORT_VIDEO_KIND) continue;

    const videoUrl = videoEvent.videoMetadata?.url;
    if (!videoUrl) continue;

    parsedVideos.push({
      id: event.id,
      pubkey: event.pubkey,
      kind: event.kind as typeof SHORT_VIDEO_KIND,
      createdAt: event.created_at,
      originalVineTimestamp: getOriginalVineTimestamp(event),
      content: event.content,
      videoUrl,
      fallbackVideoUrls: videoEvent.videoMetadata?.fallbackUrls,
      hlsUrl: videoEvent.videoMetadata?.hlsUrl,
      thumbnailUrl: getThumbnailUrl(videoEvent),
      blurhash: videoEvent.videoMetadata?.blurhash,
      title: videoEvent.title,
      duration: videoEvent.videoMetadata?.duration,
      hashtags: videoEvent.hashtags || [],
      vineId,
      loopCount: getLoopCount(event),
      likeCount: getOriginalLikeCount(event),
      repostCount: getOriginalRepostCount(event),
      commentCount: getOriginalCommentCount(event),
      proofMode: getProofModeData(event),
      origin: getOriginPlatform(event),
      isVineMigrated: isVineMigrated(event),
      reposts: [],
      originalEvent: event
    });
  }

  return parsedVideos;
}

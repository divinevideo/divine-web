// ABOUTME: Transform Funnelcake API responses to ParsedVideoData format
// ABOUTME: Bridges the gap between REST API data and existing video display components

import { parseByteArrayId } from './funnelcakeClient';
import { SHORT_VIDEO_KIND, type ParsedVideoData, type ProofModeData, type ProofModeLevel } from '@/types/video';
import type { FunnelcakeVideoRaw, FunnelcakeResponse } from '@/types/funnelcake';
import { debugLog } from './debug';
import { getProofModeData } from './videoParser';
import { extractSha256FromVideoUrl } from './videoVerification';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Parse loop count from video content text
 * Vine videos often have "Original stats: X loops" embedded in the content
 */
function parseLoopsFromContent(content?: string): number | null {
  if (!content) return null;

  // Match patterns like "2,965,624 loops" or "2965624 loops"
  const match = content.match(/([0-9,]+)\s*loops/i);
  if (match) {
    // Remove commas and parse as integer
    const loops = parseInt(match[1].replace(/,/g, ''), 10);
    if (!isNaN(loops) && loops > 0) {
      return loops;
    }
  }
  return null;
}

function parseLoopsFromTags(tags?: string[][]): number | null {
  const tagValue = tags?.find((tag) => tag[0] === 'loops')?.[1];
  if (!tagValue) return null;

  const loops = parseInt(tagValue.replace(/,/g, ''), 10);
  return Number.isFinite(loops) && loops > 0 ? loops : null;
}

function getVineExternalId(raw: FunnelcakeVideoRaw): string {
  const originTag = raw.tags?.find((tag) => tag[0] === 'origin');
  if (originTag?.[1]?.toLowerCase() === 'vine' && originTag[2]) {
    return originTag[2];
  }

  return raw.d_tag || '';
}

export function parseFullEvent(raw: FunnelcakeVideoRaw, id: string, pubkey: string): NostrEvent | undefined {
  const eventJson = raw.event_json;
  if (eventJson) {
    try {
      const event = typeof eventJson === 'string' ? JSON.parse(eventJson) : eventJson;
      if (event && typeof event === 'object' && Array.isArray(event.tags)) {
        // Detail APIs may send partial payloads; default any missing fields
        // from the raw row the same way the tags branch below does.
        const partial = event as Partial<NostrEvent> & { tags: string[][] };
        return {
          id: typeof partial.id === 'string' ? partial.id : id,
          pubkey: typeof partial.pubkey === 'string' ? partial.pubkey : pubkey,
          created_at: typeof partial.created_at === 'number' ? partial.created_at : raw.created_at,
          kind: typeof partial.kind === 'number' ? partial.kind : raw.kind,
          tags: partial.tags,
          content: typeof partial.content === 'string' ? partial.content : (raw.content || ''),
          sig: typeof partial.sig === 'string' ? partial.sig : '',
        } as NostrEvent;
      }
    } catch {
      // Fall through to top-level tags below.
    }
  }

  if (!raw.tags) return undefined;

  return {
    id,
    pubkey,
    created_at: raw.created_at,
    kind: raw.kind,
    tags: raw.tags,
    content: raw.content || '',
    sig: '',
  } as NostrEvent;
}

function isProofModeLevel(level: string): level is ProofModeLevel {
  return level === 'verified_mobile' ||
    level === 'verified_web' ||
    level === 'basic_proof' ||
    level === 'unverified';
}

/**
 * Sentinel stored in ProofModeData component fields when the data comes from a
 * compact proof summary. A summary only says "this component exists and did
 * not fail verification" — it carries no real manifest JSON, fingerprint, or
 * attestation token. These values are presence markers only and MUST NOT be
 * rendered verbatim in UI (e.g. ProofModeBadge's showDetails popover).
 */
const SUMMARY_PRESENT = 'summary:present';

function proofSummaryToProofMode(raw: FunnelcakeVideoRaw): ProofModeData | undefined {
  if (!raw.proof || raw.proof.status === 'unknown' || raw.proof.status === 'invalid') return undefined;

  const checks = raw.proof.checks ?? {};
  const manifest = checks.proofmode_present && checks.proofmode_parse_ok === true
    ? SUMMARY_PRESENT
    : undefined;
  const deviceAttestation = checks.device_attestation_present && checks.device_attestation_valid !== false
    ? SUMMARY_PRESENT
    : undefined;
  const pgpFingerprint = checks.pgp_signature_present && checks.pgp_signature_valid !== false
    ? SUMMARY_PRESENT
    : undefined;
  const c2paManifestId = checks.c2pa_manifest_present && checks.c2pa_manifest_valid !== false
    ? SUMMARY_PRESENT
    : undefined;

  // A summary with no usable components carries nothing worth badging — even
  // a (contradictory) 'verified' status over an all-failed checklist.
  if (!manifest && !deviceAttestation && !pgpFingerprint && !c2paManifestId) {
    return undefined;
  }

  const isVerified = raw.proof.status === 'verified';
  const summaryLevel = raw.proof.level && isProofModeLevel(raw.proof.level)
    ? raw.proof.level
    : undefined;
  // Only a 'verified' status can earn a verified_* badge. Cap anything else to
  // basic_proof — the same fallback used when present/partial summaries omit
  // the level entirely.
  const cappedLevel = !isVerified && (summaryLevel === 'verified_mobile' || summaryLevel === 'verified_web')
    ? 'basic_proof'
    : summaryLevel;
  const level: ProofModeLevel = cappedLevel ?? (isVerified ? 'verified_web' : 'basic_proof');

  return {
    level,
    manifest,
    deviceAttestation,
    pgpFingerprint,
    c2paManifestId,
  };
}

/**
 * Transform a single Funnelcake video to ParsedVideoData format
 */
export function transformFunnelcakeVideo(raw: FunnelcakeVideoRaw): ParsedVideoData {
  // Handle byte array conversion for id and pubkey
  const id = Array.isArray(raw.id) ? parseByteArrayId(raw.id) : String(raw.id);
  const pubkey = Array.isArray(raw.pubkey) ? parseByteArrayId(raw.pubkey) : String(raw.pubkey);

  // Extract hashtags from title/content (if not already parsed by Funnelcake)
  // Funnelcake might not return hashtags separately, extract from title if needed
  const hashtags: string[] = [];
  if (raw.title) {
    const matches = raw.title.match(/#(\w+)/g);
    if (matches) {
      hashtags.push(...matches.map(tag => tag.slice(1).toLowerCase()));
    }
  }

  const taggedPlatform = raw.tags?.find((tag) => tag[0] === 'platform')?.[1]?.toLowerCase();
  const originPlatform = raw.tags?.find((tag) => tag[0] === 'origin')?.[1]?.toLowerCase();

  // Single-video lookups can omit top-level platform/classic fields, so fall back to tags.
  const isVineMigrated = raw.platform === 'vine' || raw.classic === true || taggedPlatform === 'vine' || originPlatform === 'vine';
  const archivedLoopCount = parseLoopsFromTags(raw.tags)
    ?? parseLoopsFromContent(raw.content)
    ?? parseLoopsFromContent(raw.title);

  const fullEvent = parseFullEvent(raw, id, pubkey);
  const fullEventProofMode = fullEvent ? getProofModeData(fullEvent) : undefined;

  const video: ParsedVideoData = {
    id,
    pubkey,
    authorName: raw.author_name, // Cached author name from Funnelcake
    authorAvatar: raw.author_avatar, // Cached author avatar from Funnelcake
    kind: SHORT_VIDEO_KIND,
    createdAt: raw.created_at,
    content: raw.content || '',
    videoUrl: raw.video_url,
    thumbnailUrl: raw.thumbnail,
    blurhash: raw.blurhash,
    title: raw.title,
    dimensions: raw.dim ?? raw.dimensions, // Video dimensions from API (e.g., "1080x1920"); v2 uses `dimensions`
    sha256: extractSha256FromVideoUrl(raw.video_url),
    ageRestricted: raw.age_restricted === true || raw.moderation_status === 'age_restricted',
    hashtags,

    // Vine-specific fields
    vineId: raw.d_tag || null, // d_tag is the unique identifier
    // loops only meaningful for Vine archive videos — for new Divine videos,
    // the API `loops` field tracks playback re-loops, NOT classic Vine loop counts
    loopCount: isVineMigrated
      ? (archivedLoopCount ?? raw.loops ?? 0)
      : 0,
    divineViewCount: raw.views ?? 0,

    // Social metrics from Funnelcake (pre-computed).
    // Schema varies by endpoint:
    // - v1 /api/videos: only `embedded_*` populated
    // - v1 /api/users/{pubkey}/videos: only `reactions|comments|reposts` populated
    // - v2 /api/v2/videos: BOTH populated — `embedded_*` carries archive-import stats
    //   (e.g. 138k Vine likes), `reactions|comments|reposts` carries current Nostr
    //   engagement. We want to surface activity loudly, so add them — Vine rows show
    //   archive + current together, native rows just show current. The missing side
    //   defaults to 0 so v1 endpoints stay correct.
    likeCount: (raw.embedded_likes ?? 0) + (raw.reactions ?? 0),
    repostCount: (raw.embedded_reposts ?? 0) + (raw.reposts ?? 0),
    commentCount: (raw.embedded_comments ?? 0) + (raw.comments ?? 0),

    // Origin data for Vine migrations
    isVineMigrated,
    origin: isVineMigrated ? {
      platform: 'vine',
      externalId: getVineExternalId(raw),
    } : undefined,

    // Subtitle / text track fields from API
    textTrackRef: raw.text_track_ref,
    textTrackContent: raw.text_track_content,

    // ProofMode data - extract from tags when available (single video endpoint)
    proofMode: fullEventProofMode ?? proofSummaryToProofMode(raw),

    // Empty reposts array (Funnelcake doesn't return individual reposts)
    reposts: [],

    // No original event from REST API
    originalEvent: undefined,
  };

  return video;
}

/**
 * Transform a Funnelcake API response to an array of ParsedVideoData
 */
export function transformFunnelcakeResponse(response: FunnelcakeResponse): ParsedVideoData[] {
  if (!response.videos || !Array.isArray(response.videos)) {
    debugLog('[FunnelcakeTransform] No videos in response');
    return [];
  }

  const transformed = response.videos
    .map(raw => {
      try {
        return transformFunnelcakeVideo(raw);
      } catch (err) {
        debugLog('[FunnelcakeTransform] Failed to transform video:', err, raw);
        return null;
      }
    })
    .filter((v): v is ParsedVideoData => v !== null);

  // Deduplicate by pubkey:kind:d-tag (addressable event key per NIP-33)
  // The API may return duplicate rows for the same video
  const seen = new Set<string>();
  const videos = transformed.filter(v => {
    const key = `${v.pubkey}:${v.kind}:${v.vineId || v.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (videos.length < transformed.length) {
    debugLog(`[FunnelcakeTransform] Deduplicated ${transformed.length} → ${videos.length} videos`);
  }
  debugLog(`[FunnelcakeTransform] Transformed ${videos.length}/${response.videos.length} videos`);

  return videos;
}

/**
 * Transform Funnelcake response to video page format for infinite scroll hooks
 */
export function transformToVideoPage(
  response: FunnelcakeResponse,
  cursorType: 'timestamp' | 'offset' | 'cursor' = 'timestamp'
): {
  videos: ParsedVideoData[];
  nextCursor: number | undefined;
  offset?: number;
  /** Raw opaque cursor string for cursor-based pagination (recommendations) */
  rawCursor?: string;
  hasMore: boolean;
} {
  const videos = transformFunnelcakeResponse(response);

  // Parse next cursor based on pagination type
  let nextCursor: number | undefined;
  let offset: number | undefined;
  let rawCursor: string | undefined;

  if (response.has_more && response.next_cursor) {
    if (cursorType === 'cursor') {
      // Opaque cursor: pass through as-is (recommendations)
      rawCursor = response.next_cursor;
    } else if (cursorType === 'offset') {
      offset = parseInt(response.next_cursor, 10);
    } else {
      // Timestamp cursor - parse as number
      nextCursor = parseInt(response.next_cursor, 10);
      // If parsing fails, use last video's timestamp
      if (isNaN(nextCursor) && videos.length > 0) {
        nextCursor = videos[videos.length - 1].createdAt - 1;
      }
    }
  }

  return {
    videos,
    nextCursor,
    offset,
    rawCursor,
    hasMore: response.has_more,
  };
}

/**
 * Merge Funnelcake stats into existing ParsedVideoData
 * Useful for updating videos with fresh stats
 */
export function mergeVideoStats(
  video: ParsedVideoData,
  stats: {
    reactions?: number;
    comments?: number;
    reposts?: number;
    loops?: number;
  }
): ParsedVideoData {
  return {
    ...video,
    likeCount: stats.reactions ?? video.likeCount,
    commentCount: stats.comments ?? video.commentCount,
    repostCount: stats.reposts ?? video.repostCount,
    loopCount: video.isVineMigrated ? (stats.loops ?? video.loopCount) : video.loopCount,
  };
}

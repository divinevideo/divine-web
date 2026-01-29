// ABOUTME: Core video event types and interfaces for OpenVine/Divine Web
// ABOUTME: Defines the structure of video events (kind 34236) and related metadata

import type { NostrEvent } from '@nostrify/nostrify';

// Video Event Kinds
export const SHORT_VIDEO_KIND = 34236; // Kind 34236 - Addressable short-form videos

// Array of all supported video kinds
export const VIDEO_KINDS = [SHORT_VIDEO_KIND];

export const REPOST_KIND = 6;

export interface VideoMetadata {
  url: string;
  fallbackUrls?: string[];  // Alternative URLs to try if primary fails
  hlsUrl?: string;  // HLS manifest URL (.m3u8) for adaptive bitrate streaming
  mimeType?: string;
  dimensions?: string;
  blurhash?: string;
  thumbnailUrl?: string;
  duration?: number;
  size?: number;
  hash?: string;
}

export interface VideoEvent extends NostrEvent {
  kind: typeof SHORT_VIDEO_KIND;
  videoMetadata?: VideoMetadata;
  title?: string;
  hashtags?: string[];
  isRepost?: boolean;
  reposterPubkey?: string;
  repostedAt?: number;
  originalEvent?: NostrEvent;
}

export interface RepostEvent extends NostrEvent {
  kind: typeof REPOST_KIND;
  referencedEventAddress?: string;
  referencedAuthor?: string;
}

export type ProofModeLevel = 'verified_mobile' | 'verified_web' | 'basic_proof' | 'unverified';

export interface ProofModeData {
  level: ProofModeLevel;
  manifest?: string; // Raw JSON string
  manifestData?: Record<string, unknown>; // Parsed manifest object
  deviceAttestation?: string; // Hardware attestation token (iOS App Attest / Android Play Integrity)
  pgpFingerprint?: string; // PGP public key fingerprint for signature verification
}

export interface OriginData {
  platform: string;      // e.g., 'vine', 'tiktok', 'instagram'
  externalId: string;    // Original platform's ID
  url?: string;          // Original platform URL
  metadata?: string;     // Optional additional metadata
}

export interface RepostMetadata {
  eventId: string;           // Repost event ID
  reposterPubkey: string;    // Who reposted
  repostedAt: number;        // When they reposted
}

export interface ParsedVideoData {
  id: string;                // Original video event ID
  pubkey: string;            // Original author pubkey
  authorName?: string;       // Cached author name from Funnelcake API
  authorAvatar?: string;     // Cached author avatar from Funnelcake API
  kind: typeof SHORT_VIDEO_KIND;   // // NIP-71 video kind (34236).
  createdAt: number;
  originalVineTimestamp?: number; // Custom published_at timestamp (NIP-31 - can be set by any video)
  content: string;
  videoUrl: string;
  fallbackVideoUrls?: string[];  // Alternative URLs to try if primary fails
  hlsUrl?: string;  // HLS manifest URL (.m3u8) for adaptive bitrate streaming
  thumbnailUrl?: string;
  blurhash?: string; // Blurhash for progressive loading placeholder
  title?: string;
  duration?: number;
  dimensions?: string; // Video dimensions from imeta dim tag (e.g., "1080x1920")
  hashtags: string[];
  vineId: string | null;
  loopCount?: number;
  likeCount?: number;
  repostCount?: number;
  commentCount?: number;
  proofMode?: ProofModeData; // ProofMode verification data
  origin?: OriginData;        // Import source platform info (if imported content)
  isVineMigrated: boolean;    // True only if origin platform is 'vine'

  // NEW: Aggregated repost data (replaces individual isRepost/reposterPubkey/repostedAt)
  reposts: RepostMetadata[];

  // Original Nostr event for full source viewing
  originalEvent?: NostrEvent;

  // COMPUTED FIELDS: Use helper functions from videoParser.ts
  // - isReposted(video): boolean - Has any reposts
  // - getLatestRepostTime(video): number - Most recent repost timestamp (or createdAt if no reposts)
  // - getTotalReposts(video): number - Total number of reposts
  // - getUniqueReposters(video): RepostMetadata[] - Deduplicated list of reposters
}

export interface UserInteractions {
  hasLiked: boolean;
  hasReposted: boolean;
  likeEventId: string | null;
  repostEventId: string | null;
}
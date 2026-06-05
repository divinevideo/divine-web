// ABOUTME: Pure helpers for NIP-71 video publish tag construction (kind 34236)
// ABOUTME: Extracted for unit testing without React or relay I/O

import type { VideoMetadata } from '@/types/video';

/**
 * Generate a unique vine ID if not provided by the caller.
 */
export function generateVineId(): string {
  return `vine-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Build imeta tag from video metadata (NIP-71 / OpenVine).
 */
export function buildImetaTag(metadata: VideoMetadata): string[] {
  const tag = ['imeta'];

  if (metadata.url) {
    tag.push('url', metadata.url);
  }
  if (metadata.mimeType) {
    tag.push('m', metadata.mimeType);
  }
  if (metadata.dimensions) {
    tag.push('dim', metadata.dimensions);
  }
  if (metadata.blurhash) {
    tag.push('blurhash', metadata.blurhash);
  }
  if (metadata.thumbnailUrl) {
    tag.push('image', metadata.thumbnailUrl);
  }
  if (metadata.duration !== undefined) {
    tag.push('duration', String(metadata.duration));
  }
  if (metadata.size !== undefined) {
    tag.push('size', String(metadata.size));
  }
  if (metadata.hash) {
    tag.push('x', metadata.hash);
  }

  return tag;
}

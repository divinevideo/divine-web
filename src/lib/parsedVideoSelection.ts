// ABOUTME: Shared deterministic selection helpers for parsed video data

import type { ParsedVideoData } from '@/types/video';

export function isNewerParsedVideo(candidate: ParsedVideoData, existing: ParsedVideoData): boolean {
  return candidate.createdAt > existing.createdAt ||
    (candidate.createdAt === existing.createdAt && candidate.id < existing.id);
}

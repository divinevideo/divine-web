// ABOUTME: Prefetches the next 2-3 video URLs while the current video plays
// ABOUTME: Uses <link rel="prefetch"> elements in the document head for browser-native preloading

import { useEffect, useRef } from 'react';
import type { ParsedVideoData } from '@/types/video';
import { debugLog } from '@/lib/debug';

const PREFETCH_COUNT = 3;

function isProtectedDivineMediaUrl(url: string): boolean {
  try {
    return new URL(url).hostname === 'media.divine.video';
  } catch {
    return false;
  }
}

function shouldSkipProtectedPrefetch(url: string | undefined, ageRestricted: boolean | undefined): boolean {
  return !!url && isProtectedDivineMediaUrl(url) && ageRestricted !== false;
}

/**
 * Prefetch upcoming video URLs when the active video changes.
 * Inserts <link rel="prefetch"> elements into <head> for the next
 * 2-3 videos in the list, allowing the browser to load them in idle time.
 * Cleans up old prefetch links when the active video changes.
 */
export function useVideoPrefetch(
  activeVideoId: string | null,
  videos: ParsedVideoData[]
) {
  const prefetchLinksRef = useRef<HTMLLinkElement[]>([]);

  useEffect(() => {
    // Clean up previous prefetch links
    const cleanup = () => {
      for (const link of prefetchLinksRef.current) {
        link.remove();
      }
      prefetchLinksRef.current = [];
    };

    if (!activeVideoId || videos.length === 0) {
      cleanup();
      return cleanup;
    }

    const activeIndex = videos.findIndex(v => v.id === activeVideoId);
    if (activeIndex === -1) {
      cleanup();
      return cleanup;
    }

    // Get next videos to prefetch
    const nextVideos = videos.slice(activeIndex + 1, activeIndex + 1 + PREFETCH_COUNT);
    if (nextVideos.length === 0) {
      cleanup();
      return cleanup;
    }

    // Collect unique URLs to prefetch (video URL + thumbnail)
    const urlsToPrefetch: { url: string; as: string }[] = [];
    for (const video of nextVideos) {
      if (!shouldSkipProtectedPrefetch(video.videoUrl, video.ageRestricted)) {
        urlsToPrefetch.push({ url: video.videoUrl, as: 'video' });
      }
      if (video.thumbnailUrl && !shouldSkipProtectedPrefetch(video.thumbnailUrl, video.ageRestricted)) {
        urlsToPrefetch.push({ url: video.thumbnailUrl, as: 'image' });
      }
    }

    // Remove old links before adding new ones
    cleanup();

    // Create prefetch link elements
    const newLinks: HTMLLinkElement[] = [];
    for (const { url, as } of urlsToPrefetch) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = as;
      document.head.appendChild(link);
      newLinks.push(link);
    }
    prefetchLinksRef.current = newLinks;

    debugLog(
      `[VideoPrefetch] Prefetching ${nextVideos.length} upcoming videos (${newLinks.length} resources) from index ${activeIndex + 1}`
    );

    return cleanup;
  }, [activeVideoId, videos]);
}

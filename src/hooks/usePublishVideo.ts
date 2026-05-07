// ABOUTME: Hook for publishing video events (kind 34236) to Nostr
// ABOUTME: Handles video metadata creation and event signing with proper tags

import { useMutation } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { buildImetaTag, generateVineId } from '@/lib/publishVideoTags';
import { SHORT_VIDEO_KIND } from '@/types/video';
import type { VideoMetadata } from '@/types/video';

interface PublishVideoOptions {
  content: string;
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
  duration?: number;
  dimensions?: string;
  hashtags?: string[];
  vineId?: string; // Optional, will generate if not provided
}

/**
 * Hook to publish video events
 */
export function usePublishVideo() {
  const { mutateAsync: publishEvent } = useNostrPublish();

  return useMutation({
    mutationFn: async (options: PublishVideoOptions) => {
      const {
        content,
        videoUrl,
        thumbnailUrl,
        title,
        duration = 6,
        dimensions = '480x480',
        hashtags = [],
        vineId = generateVineId()
      } = options;

      // Build tags according to NIP-71
      const tags: string[][] = [
        ['d', vineId], // Required for addressability
        ['title', title || 'Untitled'], // Required by NIP-71
        ['published_at', String(Math.floor(Date.now() / 1000))] // Required by NIP-71
      ];

      // Add video metadata (required imeta tag)
      const videoMetadata: VideoMetadata = {
        url: videoUrl,
        mimeType: videoUrl.endsWith('.gif') ? 'image/gif' : 'video/mp4',
        dimensions,
        duration,
        thumbnailUrl
      };

      tags.push(buildImetaTag(videoMetadata));

      // Add optional NIP-71 metadata
      if (duration !== undefined) {
        tags.push(['duration', String(duration)]);
      }

      // Add hashtags (normalized to lowercase for consistent querying)
      for (const hashtag of hashtags) {
        tags.push(['t', hashtag.replace(/^#/, '').toLowerCase()]);
      }

      // Add alt text for accessibility
      if (content) {
        tags.push(['alt', content]);
      }

      // Add client tag for attribution
      tags.push(['client', 'divine-web']);

      // Publish the event
      const event = await publishEvent({
        kind: SHORT_VIDEO_KIND,
        content,
        tags
      });

      return event;
    }
  });
}

/**
 * Hook to publish a repost of a video
 */
export function useRepostVideo() {
  const { mutateAsync: publishEvent } = useNostrPublish();

  return useMutation({
    mutationFn: async ({
      originalPubkey,
      vineId
    }: {
      originalPubkey: string;
      vineId: string;
    }) => {
      const tags: string[][] = [
        ['a', `${SHORT_VIDEO_KIND}:${originalPubkey}:${vineId}`],
        ['p', originalPubkey],
        ['k', SHORT_VIDEO_KIND.toString()],
        ['client', 'divine-web']
      ];

      const event = await publishEvent({
        kind: 16, // Generic repost kind
        content: '',
        tags
      });

      return event;
    }
  });
}
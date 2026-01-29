// ABOUTME: Hook for publishing video view events (Kind 22236) to Nostr relays
// ABOUTME: Tracks video watch time and publishes ephemeral analytics events

import { useCallback } from 'react';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { debugLog } from '@/lib/debug';
import type { ParsedVideoData } from '@/types/video';

/** Kind 22236 - Ephemeral video view event (NIP-71 extension) */
export const VIEW_EVENT_KIND = 22236;

/** Traffic source for video views */
export type ViewTrafficSource =
  | 'home'       // Video viewed from home/following feed
  | 'discovery'  // Video viewed from explore/discovery feed
  | 'profile'    // Video viewed from a user's profile page
  | 'share'      // Video viewed via shared link
  | 'search'     // Video viewed from search results
  | 'hashtag'    // Video viewed from hashtag feed
  | 'trending'   // Video viewed from trending feed
  | 'unknown';   // Unknown/unspecified source

/** Client identifier for analytics */
const CLIENT_ID = 'divine-web/1.0';

interface PublishViewEventParams {
  video: ParsedVideoData;
  startSeconds: number;
  endSeconds: number;
  source?: ViewTrafficSource;
}

interface UseViewEventPublisherResult {
  publishViewEvent: (params: PublishViewEventParams) => Promise<boolean>;
  isAuthenticated: boolean;
}

/**
 * Hook for publishing video view events to Nostr relays.
 *
 * View events are ephemeral (kind 22236) and are processed by analytics
 * services in real-time. They track watch time, traffic sources, and
 * enable creator analytics and recommendation systems.
 */
export function useViewEventPublisher(): UseViewEventPublisherResult {
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: publishEvent } = useNostrPublish();

  const publishViewEvent = useCallback(async ({
    video,
    startSeconds,
    endSeconds,
    source = 'unknown',
  }: PublishViewEventParams): Promise<boolean> => {
    // Skip if no meaningful watch time
    if (endSeconds <= startSeconds) {
      debugLog('[ViewEventPublisher] Skipping: no watch time', { startSeconds, endSeconds });
      return false;
    }

    // Skip very short views (less than 1 second)
    if (endSeconds - startSeconds < 1) {
      debugLog('[ViewEventPublisher] Skipping: less than 1 second watched');
      return false;
    }

    // Check authentication
    if (!user) {
      debugLog('[ViewEventPublisher] Skipping: user not authenticated');
      return false;
    }

    // Need vineId for addressable reference
    if (!video.vineId) {
      debugLog('[ViewEventPublisher] Skipping: video has no vineId');
      return false;
    }

    try {
      // Build the addressable coordinate (a tag)
      // Format: "34236:author_pubkey:d_tag"
      const aTag = `34236:${video.pubkey}:${video.vineId}`;

      // Get relay hint from config
      const relayHint = config.relayUrl || 'wss://relay.divine.video';

      // Build tags
      const tags: string[][] = [
        // Addressable reference (required)
        ['a', aTag, relayHint],
        // Event ID reference (required)
        ['e', video.id, relayHint],
        // Watched segment (required)
        ['viewed', startSeconds.toString(), endSeconds.toString()],
        // Traffic source (optional but recommended)
        ['source', source],
        // Client identifier (optional)
        ['client', CLIENT_ID],
      ];

      debugLog('[ViewEventPublisher] Publishing view event', {
        videoId: video.id,
        watchedSeconds: endSeconds - startSeconds,
        source,
      });

      // Create and publish the ephemeral event
      await publishEvent({
        kind: VIEW_EVENT_KIND,
        content: '',
        tags,
      });

      debugLog('[ViewEventPublisher] View event published successfully');
      return true;
    } catch (error) {
      debugLog('[ViewEventPublisher] Failed to publish view event:', error);
      return false;
    }
  }, [user, config.relayUrl, publishEvent]);

  return {
    publishViewEvent,
    isAuthenticated: !!user,
  };
}

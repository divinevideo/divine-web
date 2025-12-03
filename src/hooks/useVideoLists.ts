// ABOUTME: Hook for managing video lists and discovering videos through lists
// ABOUTME: Handles NIP-51 lists (kind 30005 for video sets) for organizing and sharing vine collections

import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';

export type PlayOrder = 'chronological' | 'reverse' | 'manual' | 'shuffle';

export interface VideoList {
  id: string;
  name: string;
  description?: string;
  image?: string;
  pubkey: string;
  createdAt: number;
  videoCoordinates: string[]; // Array of "34236:pubkey:d-tag" coordinates (NIP-71)
  public: boolean;
  tags?: string[]; // Categorization tags
  isCollaborative?: boolean; // Allow others to add videos
  allowedCollaborators?: string[]; // Pubkeys allowed to collaborate
  thumbnailEventId?: string; // Featured video as thumbnail
  playOrder?: PlayOrder; // How videos should be ordered
}

/**
 * Parse a video list event (kind 30005)
 */
function parseVideoList(event: NostrEvent): VideoList | null {
  const dTag = event.tags.find(tag => tag[0] === 'd')?.[1];
  if (!dTag) return null;

  const title = event.tags.find(tag => tag[0] === 'title')?.[1] || dTag;
  const description = event.tags.find(tag => tag[0] === 'description')?.[1];
  const image = event.tags.find(tag => tag[0] === 'image')?.[1];

  // Extract video coordinates from 'a' tags
  const videoCoordinates = event.tags
    .filter(tag => tag[0] === 'a' && tag[1]?.startsWith(`${SHORT_VIDEO_KIND}:`))
    .map(tag => tag[1]);

  // Extract categorization tags (t tags)
  const tags = event.tags
    .filter(tag => tag[0] === 't')
    .map(tag => tag[1]);

  // Extract collaborative settings
  const isCollaborative = event.tags.find(tag => tag[0] === 'collaborative')?.[1] === 'true';
  const allowedCollaborators = event.tags
    .filter(tag => tag[0] === 'collaborator')
    .map(tag => tag[1]);

  // Extract featured thumbnail
  const thumbnailEventId = event.tags.find(tag => tag[0] === 'thumbnail-event')?.[1];

  // Extract play order
  const playOrderTag = event.tags.find(tag => tag[0] === 'play-order')?.[1];
  const playOrder: PlayOrder = playOrderTag === 'reverse' || playOrderTag === 'manual' || playOrderTag === 'shuffle'
    ? playOrderTag
    : 'chronological';

  // Parse encrypted content if present (private items)
  let privateCoordinates: string[] = [];
  if (event.content) {
    try {
      // Note: In production, this would need to be decrypted using NIP-04
      // For now, we'll just mark as having private content
      privateCoordinates = [];
    } catch {
      // Ignore decryption errors
    }
  }

  return {
    id: dTag,
    name: title,
    description,
    image,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    videoCoordinates: [...videoCoordinates, ...privateCoordinates],
    public: true, // For now, all lists are public
    tags,
    isCollaborative,
    allowedCollaborators,
    thumbnailEventId,
    playOrder
  };
}

/**
 * Hook to fetch video lists
 */
export function useVideoLists(pubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const targetPubkey = pubkey || user?.pubkey;

  return useQuery({
    queryKey: ['video-lists', targetPubkey],
    queryFn: async (context) => {
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      const filter: NostrFilter = {
        kinds: [30005], // Video sets
        limit: 100
      };

      if (targetPubkey) {
        filter.authors = [targetPubkey];
      }

      console.log('[useVideoLists] Querying for lists with filter:', filter);

      const events = await nostr.query([filter], { signal });

      console.log('[useVideoLists] Found', events.length, 'list events');

      const lists = events
        .map(parseVideoList)
        .filter((list): list is VideoList => list !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      console.log('[useVideoLists] Parsed', lists.length, 'valid lists');

      return lists;
    },
    enabled: !!targetPubkey || !pubkey, // Enable for all lists if no specific pubkey
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Hook to fetch videos that are in lists
 */
export function useVideosInLists(videoId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['videos-in-lists', videoId],
    queryFn: async (context) => {
      if (!videoId) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      // Query for lists that contain this video
      const events = await nostr.query([{
        kinds: [30005], // Video sets
        '#a': [`${SHORT_VIDEO_KIND}:*:${videoId}`], // Search for any author with this d-tag
        limit: 100
      }], { signal });

      const lists = events
        .map(parseVideoList)
        .filter((list): list is VideoList => list !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      return lists;
    },
    enabled: !!videoId,
    staleTime: 60000,
    gcTime: 300000,
  });
}

/**
 * Hook to create or update a video list
 */
export function useCreateVideoList() {
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      image,
      videoCoordinates,
      tags: listTags,
      isCollaborative,
      allowedCollaborators,
      thumbnailEventId,
      playOrder
    }: {
      id: string;
      name: string;
      description?: string;
      image?: string;
      videoCoordinates: string[];
      tags?: string[];
      isCollaborative?: boolean;
      allowedCollaborators?: string[];
      thumbnailEventId?: string;
      playOrder?: PlayOrder;
    }) => {
      if (!user) throw new Error('Must be logged in to create lists');

      const tags: string[][] = [
        ['d', id],
        ['title', name]
      ];

      if (description) {
        tags.push(['description', description]);
      }

      if (image) {
        tags.push(['image', image]);
      }

      // Add categorization tags
      if (listTags && listTags.length > 0) {
        listTags.forEach(tag => {
          tags.push(['t', tag]);
        });
      }

      // Add collaborative settings
      if (isCollaborative) {
        tags.push(['collaborative', 'true']);
        if (allowedCollaborators && allowedCollaborators.length > 0) {
          allowedCollaborators.forEach(pubkey => {
            tags.push(['collaborator', pubkey]);
          });
        }
      }

      // Add featured thumbnail
      if (thumbnailEventId) {
        tags.push(['thumbnail-event', thumbnailEventId]);
      }

      // Add play order
      if (playOrder && playOrder !== 'chronological') {
        tags.push(['play-order', playOrder]);
      }

      // Add video coordinates as 'a' tags
      videoCoordinates.forEach(coord => {
        tags.push(['a', coord]);
      });

      await publishEvent({
        kind: 30005,
        content: '', // Empty for public lists
        tags
      });
    },
    onSuccess: () => {
      // Invalidate video lists queries
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
    }
  });
}

/**
 * Hook to add a video to a list
 */
export function useAddVideoToList() {
  const { nostr } = useNostr();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      listId,
      videoCoordinate
    }: {
      listId: string;
      videoCoordinate: string;
    }) => {
      if (!user) throw new Error('Must be logged in to modify lists');

      // Fetch current list
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [30005],
        authors: [user.pubkey],
        '#d': [listId],
        limit: 1
      }], { signal });

      if (events.length === 0) {
        throw new Error('List not found');
      }

      const currentList = parseVideoList(events[0]);
      if (!currentList) throw new Error('Invalid list format');

      // Check if video already in list
      if (currentList.videoCoordinates.includes(videoCoordinate)) {
        return; // Already in list
      }

      // Rebuild tags with new video
      const tags: string[][] = [
        ['d', listId],
        ['title', currentList.name]
      ];

      if (currentList.description) {
        tags.push(['description', currentList.description]);
      }

      if (currentList.image) {
        tags.push(['image', currentList.image]);
      }

      // Add all existing videos
      currentList.videoCoordinates.forEach(coord => {
        tags.push(['a', coord]);
      });

      // Add new video
      tags.push(['a', videoCoordinate]);

      await publishEvent({
        kind: 30005,
        content: '',
        tags
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['videos-in-lists'] });
    }
  });
}

/**
 * Hook to remove a video from a list
 */
export function useRemoveVideoFromList() {
  const { nostr } = useNostr();
  const { mutate: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      listId,
      videoCoordinate
    }: {
      listId: string;
      videoCoordinate: string;
    }) => {
      if (!user) throw new Error('Must be logged in to modify lists');

      // Fetch current list
      const signal = AbortSignal.timeout(5000);
      const events = await nostr.query([{
        kinds: [30005],
        authors: [user.pubkey],
        '#d': [listId],
        limit: 1
      }], { signal });

      if (events.length === 0) {
        throw new Error('List not found');
      }

      const currentList = parseVideoList(events[0]);
      if (!currentList) throw new Error('Invalid list format');

      // Filter out the video to remove
      const updatedCoordinates = currentList.videoCoordinates.filter(
        coord => coord !== videoCoordinate
      );

      // Rebuild tags without the removed video
      const tags: string[][] = [
        ['d', listId],
        ['title', currentList.name]
      ];

      if (currentList.description) {
        tags.push(['description', currentList.description]);
      }

      if (currentList.image) {
        tags.push(['image', currentList.image]);
      }

      // Add categorization tags
      if (currentList.tags && currentList.tags.length > 0) {
        currentList.tags.forEach(tag => {
          tags.push(['t', tag]);
        });
      }

      // Add collaborative settings
      if (currentList.isCollaborative) {
        tags.push(['collaborative', 'true']);
        if (currentList.allowedCollaborators && currentList.allowedCollaborators.length > 0) {
          currentList.allowedCollaborators.forEach(pubkey => {
            tags.push(['collaborator', pubkey]);
          });
        }
      }

      // Add featured thumbnail
      if (currentList.thumbnailEventId) {
        tags.push(['thumbnail-event', currentList.thumbnailEventId]);
      }

      // Add play order
      if (currentList.playOrder && currentList.playOrder !== 'chronological') {
        tags.push(['play-order', currentList.playOrder]);
      }

      // Add remaining videos
      updatedCoordinates.forEach(coord => {
        tags.push(['a', coord]);
      });

      await publishEvent({
        kind: 30005,
        content: '',
        tags
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['videos-in-lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-videos'] });
    }
  });
}

/**
 * Hook to fetch popular/trending lists
 */
export function useTrendingVideoLists() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['trending-video-lists'],
    queryFn: async (context) => {
      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      // Get recent video lists
      const since = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60); // Last week
      const events = await nostr.query([{
        kinds: [30005],
        since,
        limit: 50
      }], { signal });

      const lists = events
        .map(parseVideoList)
        .filter((list): list is VideoList => list !== null && list.videoCoordinates.length > 0)
        .sort((a, b) => {
          // Sort by number of videos and recency
          const scoreA = a.videoCoordinates.length * 10 + (a.createdAt / 1000);
          const scoreB = b.videoCoordinates.length * 10 + (b.createdAt / 1000);
          return scoreB - scoreA;
        })
        .slice(0, 20); // Top 20 lists

      return lists;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
}
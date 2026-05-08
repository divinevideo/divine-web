// ABOUTME: Hook for managing video lists and discovering videos through lists
// ABOUTME: Handles NIP-51 lists (kind 30005 for video sets) for organizing and sharing vine collections

import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { SHORT_VIDEO_KIND } from '@/types/video';
import { resolveListPermissions } from '@/lib/listPermissions';

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
    .map(tag => tag[1])
    .filter((tag): tag is string => Boolean(tag));

  // Extract collaborative settings
  const isCollaborative = event.tags.find(tag => tag[0] === 'collaborative')?.[1] === 'true';
  const allowedCollaborators = event.tags
    .filter(tag => tag[0] === 'collaborator')
    .map(tag => tag[1])
    .filter((pubkey): pubkey is string => Boolean(pubkey));

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

function buildListTags(
  list: Pick<VideoList, 'id' | 'name' | 'description' | 'image' | 'tags' | 'isCollaborative' | 'allowedCollaborators' | 'thumbnailEventId' | 'playOrder'>,
  videoCoordinates: string[],
): string[][] {
  const tags: string[][] = [
    ['d', list.id],
    ['title', list.name],
  ];

  if (list.description) {
    tags.push(['description', list.description]);
  }

  if (list.image) {
    tags.push(['image', list.image]);
  }

  if (list.tags && list.tags.length > 0) {
    list.tags.forEach((tag) => {
      tags.push(['t', tag]);
    });
  }

  if (list.isCollaborative) {
    tags.push(['collaborative', 'true']);
    if (list.allowedCollaborators && list.allowedCollaborators.length > 0) {
      list.allowedCollaborators.forEach((pubkey) => {
        tags.push(['collaborator', pubkey]);
      });
    }
  }

  if (list.thumbnailEventId) {
    tags.push(['thumbnail-event', list.thumbnailEventId]);
  }

  if (list.playOrder && list.playOrder !== 'chronological') {
    tags.push(['play-order', list.playOrder]);
  }

  videoCoordinates.forEach((coord) => {
    tags.push(['a', coord]);
  });

  return tags;
}

async function fetchListByOwner(
  nostr: { query: (filters: NostrFilter[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  ownerPubkey: string,
  listId: string,
  signal: AbortSignal,
): Promise<VideoList> {
  const ownerEvents = await nostr.query([{
    kinds: [30005],
    authors: [ownerPubkey],
    '#d': [listId],
    limit: 1,
  }], { signal });

  if (ownerEvents.length === 0) {
    throw new Error('List not found');
  }

  const ownerList = parseVideoList(ownerEvents[0]);
  if (!ownerList) {
    throw new Error('Invalid list format');
  }

  if (!ownerList.isCollaborative || !ownerList.allowedCollaborators || ownerList.allowedCollaborators.length === 0) {
    return ownerList;
  }

  const participantPubkeys = Array.from(new Set([ownerPubkey, ...ownerList.allowedCollaborators]));
  const participantEvents = await nostr.query([{
    kinds: [30005],
    authors: participantPubkeys,
    '#d': [listId],
    limit: 50,
  }], { signal });

  const participantSet = new Set(participantPubkeys);
  const latestList = participantEvents
    .map(parseVideoList)
    .filter((list): list is VideoList => list !== null && participantSet.has(list.pubkey))
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  return latestList || ownerList;
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
  const { mutateAsync: publishEvent } = useNostrPublish();
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

      // Return the created list data for optimistic update
      return {
        id,
        name,
        description,
        image,
        pubkey: user.pubkey,
        createdAt: Math.floor(Date.now() / 1000),
        videoCoordinates,
        public: true,
        tags: listTags,
        isCollaborative,
        allowedCollaborators,
        thumbnailEventId,
        playOrder: playOrder || 'chronological'
      } as VideoList;
    },
    onSuccess: (newList) => {
      // Optimistically add the new list to the cache immediately
      // This ensures the UI updates even if the gateway cache is stale
      if (newList && user) {
        queryClient.setQueryData<VideoList[]>(
          ['video-lists', user.pubkey],
          (oldLists) => {
            if (!oldLists) return [newList];
            // Add new list at the beginning (most recent first)
            return [newList, ...oldLists.filter(l => l.id !== newList.id)];
          }
        );
      }
      // Also invalidate to eventually get fresh data from server
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
    }
  });
}

/**
 * Hook to add a video to a list
 */
export function useAddVideoToList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      listId,
      ownerPubkey,
      videoCoordinate
    }: {
      listId: string;
      ownerPubkey: string;
      videoCoordinate: string;
    }) => {
      if (!user) throw new Error('Must be logged in to modify lists');

      const signal = AbortSignal.timeout(5000);
      const currentList = await fetchListByOwner(nostr, ownerPubkey, listId, signal);
      const permissions = resolveListPermissions({
        ownerPubkey,
        isCollaborative: currentList.isCollaborative,
        allowedCollaborators: currentList.allowedCollaborators,
      }, user.pubkey);
      if (!permissions.canEditContent) {
        throw new Error('You do not have permission to edit this list');
      }

      // Check if video already in list
      if (currentList.videoCoordinates.includes(videoCoordinate)) {
        return; // Already in list
      }

      const tags = buildListTags(currentList, [...currentList.videoCoordinates, videoCoordinate]);

      await publishEvent({
        kind: 30005,
        content: '',
        tags
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['videos-in-lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-videos'] });
      queryClient.invalidateQueries({ queryKey: ['list-detail', variables.ownerPubkey, variables.listId] });
    }
  });
}

/**
 * Hook to remove a video from a list
 */
export function useRemoveVideoFromList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      listId,
      ownerPubkey,
      videoCoordinate
    }: {
      listId: string;
      ownerPubkey: string;
      videoCoordinate: string;
    }) => {
      if (!user) throw new Error('Must be logged in to modify lists');

      const signal = AbortSignal.timeout(5000);
      const currentList = await fetchListByOwner(nostr, ownerPubkey, listId, signal);
      const permissions = resolveListPermissions({
        ownerPubkey,
        isCollaborative: currentList.isCollaborative,
        allowedCollaborators: currentList.allowedCollaborators,
      }, user.pubkey);
      if (!permissions.canEditContent) {
        throw new Error('You do not have permission to edit this list');
      }

      // Filter out the video to remove
      const updatedCoordinates = currentList.videoCoordinates.filter(
        coord => coord !== videoCoordinate
      );

      const tags = buildListTags(currentList, updatedCoordinates);

      await publishEvent({
        kind: 30005,
        content: '',
        tags
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['videos-in-lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-videos'] });
      queryClient.invalidateQueries({ queryKey: ['list-detail', variables.ownerPubkey, variables.listId] });
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

/**
 * Hook to delete a video list (publishes deletion event)
 */
export function useDeleteVideoList() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, ownerPubkey }: { listId: string; ownerPubkey: string }) => {
      if (!user) throw new Error('Must be logged in to delete lists');
      if (user.pubkey !== ownerPubkey) {
        throw new Error('Only the list owner can delete this list');
      }

      // Publish a kind 5 deletion event targeting the list
      // The 'a' tag references the addressable event to delete
      await publishEvent({
        kind: 5, // NIP-09 deletion event
        content: 'List deleted by owner',
        tags: [
          ['a', `30005:${ownerPubkey}:${listId}`],
        ]
      });

      return { listId, ownerPubkey };
    },
    onSuccess: ({ listId, ownerPubkey }) => {
      // Remove from cache immediately
      if (user && user.pubkey === ownerPubkey) {
        queryClient.setQueryData<VideoList[]>(
          ['video-lists', ownerPubkey],
          (oldLists) => oldLists?.filter(l => l.id !== listId) || []
        );
      }
      queryClient.invalidateQueries({ queryKey: ['video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-detail', ownerPubkey, listId] });
      queryClient.invalidateQueries({ queryKey: ['trending-video-lists'] });
      queryClient.invalidateQueries({ queryKey: ['followed-users-lists'] });
    }
  });
}

/**
 * Hook to fetch lists from users the current user follows
 */
export function useFollowedUsersLists(followedPubkeys: string[] | undefined) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['followed-users-lists', followedPubkeys?.slice(0, 50)],
    queryFn: async (context) => {
      if (!followedPubkeys || followedPubkeys.length === 0) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(8000)
      ]);

      // Query lists from followed users (limit to first 50 to avoid huge queries)
      const pubkeysToQuery = followedPubkeys.slice(0, 50);

      const events = await nostr.query([{
        kinds: [30005],
        authors: pubkeysToQuery,
        limit: 100
      }], { signal });

      const lists = events
        .map(parseVideoList)
        .filter((list): list is VideoList => list !== null && list.videoCoordinates.length > 0)
        .sort((a, b) => b.createdAt - a.createdAt);

      return lists;
    },
    enabled: !!followedPubkeys && followedPubkeys.length > 0,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
}
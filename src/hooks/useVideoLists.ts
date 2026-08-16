// ABOUTME: Hook for managing video lists and discovering videos through lists
// ABOUTME: Handles NIP-51 lists (kind 30005 for video sets) for organizing and sharing vine collections

import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import {
  deduplicateVideoLists,
  isVideoCoordinate,
  memberMatchesCoordinate,
  memberMatchesVideoId,
  parseVideoListFromEvent,
  videoListMemberKey,
  videoListMemberToTag,
  type PlayOrder,
  type VideoList,
  type VideoListMember,
} from '@/lib/parseVideoListFromEvent';
import { resolveListPermissions } from '@/lib/listPermissions';
import { debugLog } from '@/lib/debug';

export type { PlayOrder, VideoList };

function memberFromCoordinate(videoCoordinate: string): VideoListMember {
  return { type: 'a', value: videoCoordinate };
}

function getPreferredSourceTagName(sourceTags: string[][] | undefined, supportedNames: string[], fallback: string): string {
  return sourceTags?.find(tag => supportedNames.includes(tag[0]))?.[0] ?? fallback;
}

function buildListTags(
  list: Pick<VideoList, 'id' | 'name' | 'description' | 'image' | 'tags' | 'isCollaborative' | 'allowedCollaborators' | 'thumbnailEventId' | 'playOrder'> & Partial<Pick<VideoList, 'sourceTags'>>,
  members: VideoListMember[],
): string[][] {
  const ownedTags = new Set([
    'd',
    'title',
    'description',
    'image',
    't',
    'collaborative',
    'collaborator',
    'thumbnail',
    'thumbnail-event',
    'playorder',
    'play-order',
    'e',
    'a',
  ]);

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
    tags.push([
      getPreferredSourceTagName(list.sourceTags, ['thumbnail', 'thumbnail-event'], 'thumbnail'),
      list.thumbnailEventId,
    ]);
  }

  if (list.playOrder && list.playOrder !== 'chronological') {
    tags.push([
      getPreferredSourceTagName(list.sourceTags, ['playorder', 'play-order'], 'playorder'),
      list.playOrder,
    ]);
  }

  const preservedSourceTags = (list.sourceTags ?? [])
    .filter((tag) => !ownedTags.has(tag[0]))
    .map(tag => [...tag]);

  tags.push(...preservedSourceTags);
  tags.push(...members.map(videoListMemberToTag));

  return tags;
}

function toVideoListSnapshot(
  list: Pick<VideoList, 'id' | 'name' | 'description' | 'image' | 'pubkey' | 'tags' | 'isCollaborative' | 'allowedCollaborators' | 'thumbnailEventId' | 'playOrder'>,
  members: VideoListMember[],
  sourceTags: string[][],
): VideoList {
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    image: list.image,
    pubkey: list.pubkey,
    createdAt: Math.floor(Date.now() / 1000),
    members,
    memberCount: members.length,
    videoCoordinates: members
      .filter((member): member is Extract<VideoListMember, { type: 'a' }> => member.type === 'a')
      .map(member => member.value),
    public: true,
    tags: list.tags,
    isCollaborative: list.isCollaborative,
    allowedCollaborators: list.allowedCollaborators,
    thumbnailEventId: list.thumbnailEventId,
    playOrder: list.playOrder || 'chronological',
    sourceTags,
  };
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

  const ownerList = parseVideoListFromEvent(ownerEvents[0]);
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
    .map(parseVideoListFromEvent)
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

      debugLog('[useVideoLists] Querying for lists with filter:', filter);

      const events = await nostr.query([filter], { signal });

      debugLog('[useVideoLists] Found', events.length, 'list events');

      const lists = deduplicateVideoLists(events);

      debugLog('[useVideoLists] Parsed', lists.length, 'valid lists');

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
export function useVideosInLists(videoId?: string, videoEventId?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['videos-in-lists', videoId, videoEventId],
    queryFn: async (context) => {
      if (!videoId) return [];

      const signal = AbortSignal.any([
        context.signal,
        AbortSignal.timeout(5000)
      ]);

      // Relay tag filters require exact addressable coordinates, but this call
      // only has the video's d tag. Query recent public lists and match locally.
      const events = await nostr.query([{
        kinds: [30005], // Video sets
        limit: 100
      }], { signal });

      const lists = deduplicateVideoLists(events)
        .filter((list) => list.members.some((member) => memberMatchesVideoId(member, videoId, videoEventId)));

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
      playOrder,
      members,
      sourceTags,
    }: {
      id: string;
      name: string;
      description?: string;
      image?: string;
      videoCoordinates: string[];
      members?: VideoListMember[];
      sourceTags?: string[][];
      tags?: string[];
      isCollaborative?: boolean;
      allowedCollaborators?: string[];
      thumbnailEventId?: string;
      playOrder?: PlayOrder;
    }) => {
      if (!user) throw new Error('Must be logged in to create lists');

      const listMembers = members ?? videoCoordinates
        .filter(isVideoCoordinate)
        .map(memberFromCoordinate);
      const tags = buildListTags({
        id,
        name,
        description,
        image,
        tags: listTags,
        isCollaborative,
        allowedCollaborators,
        thumbnailEventId,
        playOrder,
        sourceTags,
      }, listMembers);

      await publishEvent({
        kind: 30005,
        content: '', // Empty for public lists
        tags
      });

      // Return the created list data for optimistic update
      return toVideoListSnapshot({
        id,
        name,
        description,
        image,
        pubkey: user.pubkey,
        tags: listTags,
        isCollaborative,
        allowedCollaborators,
        thumbnailEventId,
        playOrder,
      }, listMembers, tags);
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
      videoCoordinate,
      videoEventId,
    }: {
      listId: string;
      ownerPubkey: string;
      videoCoordinate: string;
      videoEventId?: string;
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

      const incomingMember = memberFromCoordinate(videoCoordinate);
      const incomingVideoId = videoCoordinate.split(':').at(-1) ?? '';

      if (currentList.members.some((member) => (
        memberMatchesCoordinate(member, videoCoordinate) || memberMatchesVideoId(member, incomingVideoId, videoEventId)
      ))) {
        return; // Already in list
      }

      const tags = buildListTags(currentList, [...currentList.members, incomingMember]);

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
      videoMember,
    }: {
      listId: string;
      ownerPubkey: string;
      videoMember: VideoListMember;
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

      const updatedMembers = currentList.members
        .filter(member => videoListMemberKey(member) !== videoListMemberKey(videoMember));

      const tags = buildListTags(currentList, updatedMembers);

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

      const lists = deduplicateVideoLists(events)
        .filter((list) => list.memberCount > 0)
        .sort((a, b) => {
          // Sort by number of videos and recency
          const scoreA = a.memberCount * 10 + (a.createdAt / 1000);
          const scoreB = b.memberCount * 10 + (b.createdAt / 1000);
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

      // Publish a kind 5 deletion event targeting the list.
      // The 'a' tag references the addressable event, and 'k' names its kind.
      await publishEvent({
        kind: 5, // NIP-09 deletion event
        content: 'List deleted by owner',
        tags: [
          ['a', `30005:${ownerPubkey}:${listId}`],
          ['k', '30005'],
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

      const lists = deduplicateVideoLists(events)
        .filter((list) => list.memberCount > 0)
        .sort((a, b) => b.createdAt - a.createdAt);

      return lists;
    },
    enabled: !!followedPubkeys && followedPubkeys.length > 0,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
}

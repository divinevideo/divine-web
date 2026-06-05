// ABOUTME: Hook for managing follow relationships using kind 3 contact lists
// ABOUTME: Handles following/unfollowing users and querying follow status
// ABOUTME: Invalidates follow list cache on follow/unfollow for instant UI updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { followListCache } from '@/lib/followListCache';
import { debugLog } from '@/lib/debug';
import type { NostrEvent } from '@nostrify/nostrify';
import { PRIMARY_RELAY } from '@/config/relays';

/** Thrown when a follow request races with stale UI state. */
export class FollowRaceError extends Error {
  constructor() {
    super('Already following this user');
    this.name = 'FollowRaceError';
  }
}

interface FollowRelationshipData {
  isFollowing: boolean;
  mutualFollows: number;
  contactListEvent: NostrEvent | null;
}

interface FollowUserParams {
  targetPubkey: string;
  currentContactList: NostrEvent | null;
  targetDisplayName?: string;
}

interface UnfollowUserParams {
  targetPubkey: string;
  currentContactList: NostrEvent | null;
}

/**
 * Check if current user follows a target user and get relationship details
 */
export function useFollowRelationship(targetPubkey: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<FollowRelationshipData>({
    queryKey: ['follow-relationship', user?.pubkey, targetPubkey],
    queryFn: async (context) => {
      if (!user?.pubkey || !targetPubkey) {
        return {
          isFollowing: false,
          mutualFollows: 0,
          contactListEvent: null,
        };
      }

      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(3000)]);

      try {
        // Optimized: Single batched query for both contact lists
        const allContactLists = await nostr.query([
          {
            kinds: [3],
            authors: [user.pubkey],
            limit: 1,
          },
          {
            kinds: [3],
            authors: [targetPubkey],
            limit: 1,
          }
        ], { signal });

        // Separate and find latest for each user
        const currentUserLists = allContactLists.filter(e => e.pubkey === user.pubkey);
        const targetUserLists = allContactLists.filter(e => e.pubkey === targetPubkey);

        const currentContactListEvent = currentUserLists
          .sort((a, b) => b.created_at - a.created_at)[0] || null;

        const targetContactListEvent = targetUserLists
          .sort((a, b) => b.created_at - a.created_at)[0] || null;

        // Check if current user follows target
        const isFollowing = currentContactListEvent
          ? currentContactListEvent.tags.some(tag => tag[0] === 'p' && tag[1] === targetPubkey)
          : false;

        // Calculate mutual follows
        let mutualFollows = 0;
        if (currentContactListEvent && targetContactListEvent) {
          const currentFollowing = new Set(
            currentContactListEvent.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1])
          );

          const targetFollowing = new Set(
            targetContactListEvent.tags
              .filter(tag => tag[0] === 'p')
              .map(tag => tag[1])
          );

          mutualFollows = [...currentFollowing].filter(pubkey => targetFollowing.has(pubkey)).length;
        }

        return {
          isFollowing,
          mutualFollows,
          contactListEvent: currentContactListEvent,
        };
      } catch (error) {
        console.error('Failed to fetch follow relationship:', error);
        return {
          isFollowing: false,
          mutualFollows: 0,
          contactListEvent: null,
        };
      }
    },
    enabled: !!user?.pubkey && !!targetPubkey,
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 300000, // Keep in cache for 5 minutes
  });
}

/**
 * Follow a user by updating the contact list (kind 3)
 *
 * IMPORTANT: Always fetches the latest Kind 3 from the relay before publishing
 * to prevent accidental follow list overwrites when the UI's cached contact list
 * is stale or hasn't loaded yet (e.g., fresh mobile Safari login).
 */
export function useFollowUser() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ targetPubkey, currentContactList, targetDisplayName }: FollowUserParams) => {
      if (!user?.pubkey) throw new Error('No current user');

      // CRITICAL: Always fetch the latest Kind 3 from the relay before publishing.
      // The passed currentContactList may be stale or null if the UI query hasn't
      // loaded yet (race condition on fresh sessions / mobile browsers).
      let bestContactList = currentContactList;
      let relayQuerySucceeded = false;

      try {
        const relayEvents = await nostr.query([
          { kinds: [3], authors: [user.pubkey], limit: 1 },
        ], { signal: AbortSignal.timeout(5000) });

        relayQuerySucceeded = true;

        const relayContactList = relayEvents
          .filter((e: NostrEvent) => e.kind === 3)
          .sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at)[0] || null;

        if (relayContactList) {
          const relayFollowCount = relayContactList.tags.filter((t: string[]) => t[0] === 'p').length;
          const passedFollowCount = currentContactList?.tags.filter((t: string[]) => t[0] === 'p').length ?? 0;

          // Use whichever has more follows to prevent data loss
          if (relayFollowCount >= passedFollowCount) {
            bestContactList = relayContactList;
            debugLog('[useFollowUser] Using relay contact list:', relayFollowCount, 'follows (passed had', passedFollowCount, ')');
          } else {
            debugLog('[useFollowUser] Using passed contact list:', passedFollowCount, 'follows (relay had', relayFollowCount, ')');
          }
        }
      } catch (error) {
        debugLog('[useFollowUser] Failed to fetch latest Kind 3 from relay, using passed contact list:', error);
      }

      // If relay query failed and we have no cached list, refuse to publish
      // to prevent creating a Kind 3 with only 1 follow that overwrites an existing list.
      // But if the relay query succeeded and returned nothing, this user has genuinely
      // never followed anyone — allow creating their first Kind 3.
      if (!bestContactList && !relayQuerySucceeded) {
        throw new Error(
          'Could not load your existing follow list. Please try again in a moment.'
        );
      }

      const currentTags = bestContactList?.tags ?? [];

      // Check if already following (shouldn't happen but good safety check)
      const alreadyFollowing = currentTags.some(tag => tag[0] === 'p' && tag[1] === targetPubkey);
      if (alreadyFollowing) {
        throw new FollowRaceError();
      }

      // Add new follow tag
      // Format: ['p', pubkey, relayUrl, petname]
      const newFollowTag = ['p', targetPubkey, '', targetDisplayName || ''];
      const updatedTags = [...currentTags, newFollowTag];

      // Preserve relay information from existing contact list or use default
      const relayContent = bestContactList?.content || JSON.stringify({
        [PRIMARY_RELAY.url]: { read: true, write: true },
      });

      // Create new contact list event
      return await publishEvent({
        kind: 3,
        content: relayContent,
        tags: updatedTags,
      });
    },
    onSuccess: (_, { targetPubkey }) => {
      // Invalidate follow list cache for instant UI updates
      if (user?.pubkey) {
        followListCache.invalidate(user.pubkey);
        debugLog('[useFollowUser] Invalidated follow list cache after following', targetPubkey);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['follow-relationship', user?.pubkey, targetPubkey],
      });
      queryClient.invalidateQueries({
        queryKey: ['follow-list', user?.pubkey],
      });
      queryClient.invalidateQueries({
        queryKey: ['profile-stats', targetPubkey],
      });
      queryClient.invalidateQueries({
        queryKey: ['profile-stats', user?.pubkey],
      });
    },
  });
}

/**
 * Unfollow a user by removing them from the contact list
 *
 * IMPORTANT: Always fetches the latest Kind 3 from the relay before publishing
 * to prevent accidental follow list overwrites.
 */
export function useUnfollowUser() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ targetPubkey, currentContactList }: UnfollowUserParams) => {
      if (!user?.pubkey) throw new Error('No current user');

      // Fetch latest Kind 3 from relay, same as useFollowUser
      let bestContactList = currentContactList;

      try {
        const relayEvents = await nostr.query([
          { kinds: [3], authors: [user.pubkey], limit: 1 },
        ], { signal: AbortSignal.timeout(5000) });

        const relayContactList = relayEvents
          .filter((e: NostrEvent) => e.kind === 3)
          .sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at)[0] || null;

        if (relayContactList) {
          const relayFollowCount = relayContactList.tags.filter((t: string[]) => t[0] === 'p').length;
          const passedFollowCount = currentContactList?.tags.filter((t: string[]) => t[0] === 'p').length ?? 0;

          if (relayFollowCount >= passedFollowCount) {
            bestContactList = relayContactList;
            debugLog('[useUnfollowUser] Using relay contact list:', relayFollowCount, 'follows');
          }
        }
      } catch (error) {
        debugLog('[useUnfollowUser] Failed to fetch latest Kind 3, using passed contact list:', error);
      }

      if (!bestContactList) throw new Error('No contact list to update');

      // Remove the target user from tags
      const updatedTags = bestContactList.tags.filter(tag =>
        !(tag[0] === 'p' && tag[1] === targetPubkey)
      );

      // Create new contact list event with removed user
      return await publishEvent({
        kind: 3,
        content: bestContactList.content,
        tags: updatedTags,
      });
    },
    onSuccess: (_, { targetPubkey }) => {
      // Invalidate follow list cache for instant UI updates
      if (user?.pubkey) {
        followListCache.invalidate(user.pubkey);
        debugLog('[useUnfollowUser] Invalidated follow list cache after unfollowing', targetPubkey);
      }

      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['follow-relationship', user?.pubkey, targetPubkey],
      });
      queryClient.invalidateQueries({
        queryKey: ['follow-list', user?.pubkey],
      });
      queryClient.invalidateQueries({
        queryKey: ['profile-stats', targetPubkey],
      });
      queryClient.invalidateQueries({
        queryKey: ['profile-stats', user?.pubkey],
      });
    },
  });
}

// ABOUTME: Hook for managing follow relationships using kind 3 contact lists
// ABOUTME: Handles following/unfollowing users and querying follow status
// ABOUTME: Invalidates follow list cache on follow/unfollow for instant UI updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { followListCache } from '@/lib/followListCache';
import {
  countContactListFollows,
  selectContactListForPublish,
} from '@/lib/contactListSelection';
import { debugLog } from '@/lib/debug';
import { latestEvent } from '@/lib/nostrEvents';
import type { NostrEvent } from '@nostrify/nostrify';
import { PRIMARY_RELAY } from '@/config/relays';
import { getExplicitBlockedPubkeys } from '@/lib/blockProvenance';
import { MUTE_LIST_KIND } from '@/types/moderation';

/** Thrown when a follow request races with stale UI state. */
export class FollowRaceError extends Error {
  constructor() {
    super('Already following this user');
    this.name = 'FollowRaceError';
  }
}

export class ContactListUnavailableError extends Error {
  constructor() {
    super('Could not load your existing follow list. Please try again in a moment.');
    this.name = 'ContactListUnavailableError';
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

type NostrClient = ReturnType<typeof useNostr>['nostr'];

export async function fetchAndSelectContactList(
  nostr: NostrClient,
  userPubkey: string,
  currentContactList: NostrEvent | null,
  logPrefix: string
): Promise<NostrEvent | null> {
  let relayQuerySucceeded = false;

  try {
    const signal = AbortSignal.timeout(5000);
    const relayEvents: NostrEvent[] = [];
    for await (const message of nostr.req(
      [{ kinds: [3], authors: [userPubkey], limit: 1 }],
      { signal, relays: [PRIMARY_RELAY.url] },
    )) {
      if (message[0] === 'EVENT') {
        relayEvents.push(message[2]);
      } else if (message[0] === 'EOSE') {
        relayQuerySucceeded = true;
        break;
      } else if (message[0] === 'CLOSED') {
        break;
      }
    }

    relayQuerySucceeded &&= !signal.aborted;
    if (!relayQuerySucceeded) {
      throw new ContactListUnavailableError();
    }

    const relayContactList = latestEvent(
      relayEvents.filter((event: NostrEvent) => event.kind === 3),
    );

    const selection = selectContactListForPublish(currentContactList, relayContactList);
    let source = 'passed';
    if (selection.chosen === null) {
      source = 'none';
    } else if (selection.chosen === relayContactList) {
      source = 'relay';
    }

    debugLog(
      `[${logPrefix}] Using ${source} contact list:`,
      selection.reason,
      '(relay had',
      countContactListFollows(relayContactList),
      'follows, passed had',
      countContactListFollows(currentContactList),
      ')'
    );

    return selection.chosen;
  } catch (error) {
    if (error instanceof ContactListUnavailableError) {
      throw error;
    }

    debugLog(`[${logPrefix}] Failed to fetch latest Kind 3 from relay:`, error);
    throw new ContactListUnavailableError();
  }
}

function filterExplicitBlockedContactTags(tags: string[][], blockedPubkeys: ReadonlySet<string>): string[][] {
  if (blockedPubkeys.size === 0) return tags;
  return tags.filter(tag => !(tag[0] === 'p' && tag[1] && blockedPubkeys.has(tag[1])));
}

async function fetchExplicitBlockedPubkeysForPublish(
  nostr: NostrClient,
  userPubkey: string,
): Promise<Set<string>> {
  const signal = AbortSignal.timeout(5000);
  const events = await nostr.query([{
    kinds: [MUTE_LIST_KIND],
    authors: [userPubkey],
    limit: 1,
  }], { signal });
  const latestMuteList = latestEvent(events.filter(event => event.kind === MUTE_LIST_KIND));
  const mutedPubkeys = latestMuteList?.tags
    .filter(tag => tag[0] === 'p' && tag[1])
    .map(tag => tag[1]) ?? [];
  return getExplicitBlockedPubkeys(userPubkey, mutedPubkeys);
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

      const bestContactList = await fetchAndSelectContactList(
        nostr,
        user.pubkey,
        currentContactList,
        'useFollowUser'
      );

      const currentTags = bestContactList?.tags ?? [];

      // Check if already following (shouldn't happen but good safety check)
      const alreadyFollowing = currentTags.some(tag => tag[0] === 'p' && tag[1] === targetPubkey);
      if (alreadyFollowing) {
        throw new FollowRaceError();
      }

      // Add new follow tag
      // Format: ['p', pubkey, relayUrl, petname]
      const newFollowTag = ['p', targetPubkey, '', targetDisplayName || ''];
      const explicitBlocked = await fetchExplicitBlockedPubkeysForPublish(nostr, user.pubkey);
      explicitBlocked.delete(targetPubkey);
      const updatedTags = filterExplicitBlockedContactTags([...currentTags, newFollowTag], explicitBlocked);

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

      const bestContactList = await fetchAndSelectContactList(
        nostr,
        user.pubkey,
        currentContactList,
        'useUnfollowUser'
      );

      if (!bestContactList) throw new Error('No contact list to update');

      // Remove the target user from tags
      const explicitBlocked = await fetchExplicitBlockedPubkeysForPublish(nostr, user.pubkey);
      const updatedTags = filterExplicitBlockedContactTags(bestContactList.tags, explicitBlocked).filter(tag =>
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

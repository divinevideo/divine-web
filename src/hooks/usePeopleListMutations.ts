// ABOUTME: Hooks for adding/removing members from NIP-51 people lists (kind 30000)
// ABOUTME: Both hooks use optimistic updates with rollback on publish failure

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { parsePeopleList, PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';

interface MemberMutationInput {
  listId: string;
  memberPubkey: string;
}

// Shared: fetch the current list event from relay
async function fetchCurrentList(
  nostr: { query: (filters: unknown[], opts: unknown) => Promise<{ id: string; pubkey: string; kind: number; created_at: number; content: string; sig: string; tags: string[][] }[]> },
  pubkey: string,
  listId: string,
) {
  const events = await nostr.query(
    [{ kinds: [PEOPLE_LIST_KIND], authors: [pubkey], '#d': [listId], limit: 1 }],
    { signal: AbortSignal.timeout(5000) },
  );

  if (events.length === 0) throw new Error('List not found');

  const currentList = parsePeopleList(events[0]);
  if (!currentList) throw new Error('Invalid list format');

  return { event: events[0], list: currentList };
}

// Shared: rebuild tags from the original event preserving metadata, with a new members array
function rebuildTags(
  originalEvent: { tags: string[][] },
  newMembers: string[],
): string[][] {
  // Collect metadata tags (non-p tags) from original event
  const metaTags = originalEvent.tags.filter((t) => t[0] !== 'p');
  // Append the new p tags
  return [...metaTags, ...newMembers.map((pk) => ['p', pk])];
}

export function useAddToPeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, memberPubkey }: MemberMutationInput) => {
      if (!user) throw new Error('Must be logged in to update lists');

      const { event, list } = await fetchCurrentList(nostr, user.pubkey, listId);

      // Idempotent: already a member, nothing to do
      if (list.members.includes(memberPubkey)) return;

      const newMembers = [...list.members, memberPubkey];
      const tags = rebuildTags(event, newMembers);

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: '',
        tags,
      });
    },

    onMutate: async ({ listId, memberPubkey }: MemberMutationInput) => {
      if (!user) return;
      const queryKey = ['people-list', user.pubkey, listId];

      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Capture snapshot for rollback
      const snapshot = queryClient.getQueryData<PeopleList>(queryKey);

      // Optimistic update: append the new member
      queryClient.setQueryData<PeopleList>(queryKey, (old) => {
        if (!old) return old;
        if (old.members.includes(memberPubkey)) return old;
        return { ...old, members: [...old.members, memberPubkey] };
      });

      return { snapshot, queryKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(context.queryKey, context.snapshot);
      }
    },

    onSuccess: (_data, variables) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['people-lists', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['people-list', user.pubkey, variables.listId] });
      }
    },
  });
}

export function useRemoveFromPeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, memberPubkey }: MemberMutationInput) => {
      if (!user) throw new Error('Must be logged in to update lists');

      const { event, list } = await fetchCurrentList(nostr, user.pubkey, listId);

      // Idempotent: not a member, nothing to do
      if (!list.members.includes(memberPubkey)) return;

      const newMembers = list.members.filter((pk) => pk !== memberPubkey);
      const tags = rebuildTags(event, newMembers);

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: '',
        tags,
      });
    },

    onMutate: async ({ listId, memberPubkey }: MemberMutationInput) => {
      if (!user) return;
      const queryKey = ['people-list', user.pubkey, listId];

      await queryClient.cancelQueries({ queryKey });

      const snapshot = queryClient.getQueryData<PeopleList>(queryKey);

      // Optimistic update: remove the member
      queryClient.setQueryData<PeopleList>(queryKey, (old) => {
        if (!old) return old;
        return { ...old, members: old.members.filter((pk) => pk !== memberPubkey) };
      });

      return { snapshot, queryKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(context.queryKey, context.snapshot);
      }
    },

    onSuccess: (_data, variables) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['people-lists', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['people-list', user.pubkey, variables.listId] });
      }
    },
  });
}

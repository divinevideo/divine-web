// ABOUTME: Mutation hooks for publishing NIP-51 kind 30000 people lists without erasing private content

import { useNostr } from '@nostrify/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { latestEvent } from '@/lib/nostrEvents';
import {
  isReservedListDTag,
  parsePeopleListFromEvent,
  PEOPLE_LIST_KIND,
  type PeopleList,
} from '@/lib/parsePeopleListFromEvent';
import { buildAddressableCoordinate, isHex64 } from '@/lib/nostrCoordinates';

interface CreatePeopleListInput {
  id: string;
  name: string;
  description?: string;
  image?: string;
  memberPubkeys?: string[];
}

interface UpdatePeopleListInput {
  listId: string;
  name?: string;
  description?: string;
  image?: string;
}

interface MemberMutationInput {
  listId: string;
  memberPubkey: string;
}

interface DeletePeopleListInput {
  listId: string;
}

function peopleListQueryKey(pubkey: string, listId: string) {
  return ['people-list', pubkey, listId] as const;
}

function peopleListsQueryKey(pubkey: string) {
  return ['people-lists', pubkey] as const;
}

// Hex pubkeys are case-insensitive, so fold to lower case before deduplicating —
// otherwise the same member can be tagged twice in two different casings.
function uniqueHexPubkeys(pubkeys: string[]): string[] {
  return Array.from(new Set(pubkeys.filter(isHex64).map((pubkey) => pubkey.toLowerCase())));
}

function removeTags(tags: string[][], names: Set<string>): string[][] {
  return tags.filter((tag) => !names.has(tag[0]));
}

function withMetadataTags(
  originalTags: string[][],
  listId: string,
  metadata: { name?: string; description?: string; image?: string },
): string[][] {
  const replacedTags = new Set(['d']);
  if (metadata.name !== undefined) replacedTags.add('title');
  if (metadata.description !== undefined) replacedTags.add('description');
  if (metadata.image !== undefined) replacedTags.add('image');

  const tags = removeTags(originalTags, replacedTags);

  return [
    ['d', listId],
    ...(metadata.name ? [['title', metadata.name]] : []),
    ...(metadata.description ? [['description', metadata.description]] : []),
    ...(metadata.image ? [['image', metadata.image]] : []),
    ...tags,
  ];
}

function withMemberTags(originalTags: string[][], memberPubkeys: string[]): string[][] {
  const existingPTags = new Map<string, string[]>();
  const preservedPTags: string[][] = [];
  for (const tag of originalTags) {
    if (tag[0] !== 'p') continue;
    if (tag[1] && isHex64(tag[1])) {
      const pubkey = tag[1].toLowerCase();
      if (!existingPTags.has(pubkey)) existingPTags.set(pubkey, tag);
    } else {
      preservedPTags.push(tag);
    }
  }

  return [
    ...removeTags(originalTags, new Set(['p'])),
    ...preservedPTags,
    ...uniqueHexPubkeys(memberPubkeys).map((pubkey) => existingPTags.get(pubkey) ?? ['p', pubkey]),
  ];
}

function eventToPeopleList(event: NostrEvent): PeopleList {
  const list = parsePeopleListFromEvent(event);
  if (!list) throw new Error('Invalid people list event');
  return list;
}

async function fetchCurrentPeopleListEvent(
  nostr: { query: (filters: unknown[], options: { signal: AbortSignal }) => Promise<NostrEvent[]> },
  pubkey: string,
  listId: string,
): Promise<{ event: NostrEvent; list: PeopleList }> {
  const events = await nostr.query(
    [{ kinds: [PEOPLE_LIST_KIND], authors: [pubkey], '#d': [listId], limit: 10 }],
    { signal: AbortSignal.timeout(5000) },
  );
  const event = latestEvent(events);

  if (!event) throw new Error('People list not found');

  return { event, list: eventToPeopleList(event) };
}

/**
 * Mirrors what `withMetadataTags` publishes: an omitted field keeps the current
 * value, and an empty one clears the tag — which makes the parsed name fall
 * back to the d tag.
 */
function withMetadata(
  list: PeopleList,
  metadata: { name?: string; description?: string; image?: string },
): PeopleList {
  return {
    ...list,
    name: metadata.name === undefined ? list.name : metadata.name || list.id,
    description: metadata.description === undefined ? list.description : metadata.description || undefined,
    image: metadata.image === undefined ? list.image : metadata.image || undefined,
  };
}

function updateListCache(
  oldLists: PeopleList[] | undefined,
  nextList: PeopleList,
): PeopleList[] {
  const lists = oldLists ?? [];
  const index = lists.findIndex((list) => list.pubkey === nextList.pubkey && list.id === nextList.id);
  if (index === -1) return [nextList, ...lists];

  return lists.map((list, currentIndex) => (currentIndex === index ? nextList : list));
}

export function useCreatePeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ id, name, description, image, memberPubkeys = [] }: CreatePeopleListInput) => {
      if (!user) throw new Error('Must be logged in to create people lists');
      if (!id.trim()) throw new Error('List id is required');
      if (isReservedListDTag(id)) throw new Error('That list name is reserved');
      if (memberPubkeys.some((pubkey) => !isHex64(pubkey))) throw new Error('Invalid member pubkey');

      const events = await nostr.query(
        [{ kinds: [PEOPLE_LIST_KIND], authors: [user.pubkey], '#d': [id], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );
      if (events.length > 0) throw new Error('People list already exists');

      const tags = withMemberTags(
        withMetadataTags([], id, { name, description, image }),
        memberPubkeys,
      );

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: '',
        tags,
      });
    },
    onSuccess: (_data, variables) => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: peopleListsQueryKey(user.pubkey) });
      queryClient.invalidateQueries({ queryKey: peopleListQueryKey(user.pubkey, variables.id) });
    },
  });
}

export function useUpdatePeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, name, description, image }: UpdatePeopleListInput) => {
      if (!user) throw new Error('Must be logged in to update people lists');

      const { event } = await fetchCurrentPeopleListEvent(nostr, user.pubkey, listId);
      const tags = withMetadataTags(event.tags, listId, {
        name,
        description,
        image,
      });

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: event.content,
        tags,
      });
    },
    onMutate: async ({ listId, name, description, image }) => {
      if (!user) return undefined;
      const listKey = peopleListQueryKey(user.pubkey, listId);
      const listsKey = peopleListsQueryKey(user.pubkey);

      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: listsKey });

      const previousList = queryClient.getQueryData<PeopleList | null>(listKey);
      const previousLists = queryClient.getQueryData<PeopleList[]>(listsKey);

      const update = (list: PeopleList | null | undefined): PeopleList | null | undefined => (
        list ? withMetadata(list, { name, description, image }) : list
      );

      queryClient.setQueryData<PeopleList | null>(listKey, update);
      queryClient.setQueryData<PeopleList[]>(listsKey, (oldLists) => {
        const list = update(oldLists?.find((item) => item.id === listId && item.pubkey === user.pubkey));
        if (!list) return oldLists;
        return updateListCache(oldLists, list);
      });

      return { listKey, listsKey, previousList, previousLists };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.listKey, context.previousList);
      queryClient.setQueryData(context.listsKey, context.previousLists);
    },
    onSuccess: (_data, variables) => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: peopleListsQueryKey(user.pubkey) });
      queryClient.invalidateQueries({ queryKey: peopleListQueryKey(user.pubkey, variables.listId) });
    },
  });
}

export function useAddToPeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, memberPubkey }: MemberMutationInput) => {
      if (!user) throw new Error('Must be logged in to update people lists');
      if (!isHex64(memberPubkey)) throw new Error('Invalid member pubkey');

      const { event, list } = await fetchCurrentPeopleListEvent(nostr, user.pubkey, listId);
      if (list.memberPubkeys.includes(memberPubkey)) return;

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: event.content,
        tags: withMemberTags(event.tags, [...list.memberPubkeys, memberPubkey]),
      });
    },
    onMutate: async ({ listId, memberPubkey }) => {
      if (!user) return undefined;
      const listKey = peopleListQueryKey(user.pubkey, listId);
      const listsKey = peopleListsQueryKey(user.pubkey);

      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: listsKey });

      const previousList = queryClient.getQueryData<PeopleList | null>(listKey);
      const previousLists = queryClient.getQueryData<PeopleList[]>(listsKey);

      const update = (list: PeopleList | null | undefined): PeopleList | null | undefined => {
        if (!list || list.memberPubkeys.includes(memberPubkey)) return list;
        return { ...list, memberPubkeys: [...list.memberPubkeys, memberPubkey] };
      };

      queryClient.setQueryData<PeopleList | null>(listKey, update);
      queryClient.setQueryData<PeopleList[]>(listsKey, (oldLists) => {
        const list = update(oldLists?.find((item) => item.id === listId && item.pubkey === user.pubkey));
        if (!list) return oldLists;
        return updateListCache(oldLists, list);
      });

      return { listKey, listsKey, previousList, previousLists };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.listKey, context.previousList);
      queryClient.setQueryData(context.listsKey, context.previousLists);
    },
    onSuccess: (_data, variables) => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: peopleListsQueryKey(user.pubkey) });
      queryClient.invalidateQueries({ queryKey: peopleListQueryKey(user.pubkey, variables.listId) });
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
      if (!user) throw new Error('Must be logged in to update people lists');
      if (!isHex64(memberPubkey)) throw new Error('Invalid member pubkey');

      const { event, list } = await fetchCurrentPeopleListEvent(nostr, user.pubkey, listId);
      if (!list.memberPubkeys.includes(memberPubkey)) return;

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: event.content,
        tags: withMemberTags(
          event.tags,
          list.memberPubkeys.filter((pubkey) => pubkey !== memberPubkey),
        ),
      });
    },
    onMutate: async ({ listId, memberPubkey }) => {
      if (!user) return undefined;
      const listKey = peopleListQueryKey(user.pubkey, listId);
      const listsKey = peopleListsQueryKey(user.pubkey);

      await queryClient.cancelQueries({ queryKey: listKey });
      await queryClient.cancelQueries({ queryKey: listsKey });

      const previousList = queryClient.getQueryData<PeopleList | null>(listKey);
      const previousLists = queryClient.getQueryData<PeopleList[]>(listsKey);

      const update = (list: PeopleList | null | undefined): PeopleList | null | undefined => {
        if (!list) return list;
        return {
          ...list,
          memberPubkeys: list.memberPubkeys.filter((pubkey) => pubkey !== memberPubkey),
        };
      };

      queryClient.setQueryData<PeopleList | null>(listKey, update);
      queryClient.setQueryData<PeopleList[]>(listsKey, (oldLists) => {
        const list = update(oldLists?.find((item) => item.id === listId && item.pubkey === user.pubkey));
        if (!list) return oldLists;
        return updateListCache(oldLists, list);
      });

      return { listKey, listsKey, previousList, previousLists };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.listKey, context.previousList);
      queryClient.setQueryData(context.listsKey, context.previousLists);
    },
    onSuccess: (_data, variables) => {
      if (!user) return;
      queryClient.invalidateQueries({ queryKey: peopleListsQueryKey(user.pubkey) });
      queryClient.invalidateQueries({ queryKey: peopleListQueryKey(user.pubkey, variables.listId) });
    },
  });
}

export function useDeletePeopleList() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId }: DeletePeopleListInput) => {
      if (!user) throw new Error('Must be logged in to delete people lists');

      await publishEvent({
        kind: 5,
        content: 'People list deleted by owner',
        tags: [
          ['a', buildAddressableCoordinate(PEOPLE_LIST_KIND, user.pubkey, listId)],
          ['k', String(PEOPLE_LIST_KIND)],
        ],
      });
    },
    onSuccess: (_data, variables) => {
      if (!user) return;
      const listsKey = peopleListsQueryKey(user.pubkey);

      queryClient.setQueryData<PeopleList[]>(
        listsKey,
        (oldLists) => oldLists?.filter((list) => list.id !== variables.listId) ?? [],
      );
      queryClient.setQueryData(peopleListQueryKey(user.pubkey, variables.listId), null);
      queryClient.invalidateQueries({ queryKey: listsKey });
      queryClient.invalidateQueries({ queryKey: peopleListQueryKey(user.pubkey, variables.listId) });
    },
  });
}

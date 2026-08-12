import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import {
  type PeopleList,
  isReservedPeopleListDTag,
  PEOPLE_LIST_KIND,
  parsePeopleListFromEvent,
} from '@/lib/parsePeopleListFromEvent';
import { slugifyListName } from '@/lib/listFormUtils';

interface PeopleListMutationInput {
  listId: string;
  ownerPubkey: string;
}

interface CreatePeopleListInput {
  name: string;
  description?: string;
  image?: string;
  memberPubkeys?: string[];
}

interface UpdatePeopleListInput extends PeopleListMutationInput {
  name: string;
  description?: string;
  image?: string;
}

interface PeopleListMutationSnapshot {
  list?: PeopleList | null;
  lists?: PeopleList[];
}

type NostrQueryClient = {
  query: (filters: unknown[], options: unknown) => Promise<NostrEvent[]>;
};

function assertOwner(userPubkey: string | undefined, ownerPubkey: string) {
  if (!userPubkey) {
    throw new Error('Must be logged in to update people lists');
  }

  if (userPubkey !== ownerPubkey) {
    throw new Error('Only the list owner can update this people list');
  }
}

function uniquePubkeys(pubkeys: string[]): string[] {
  return Array.from(new Set(pubkeys.filter(Boolean)));
}

function peopleListsKey(ownerPubkey: string) {
  return ['people-lists', ownerPubkey] as const;
}

function peopleListKey(ownerPubkey: string, listId: string) {
  return ['people-list', ownerPubkey, listId] as const;
}

async function fetchCurrentPeopleListEvent(
  nostr: NostrQueryClient,
  ownerPubkey: string,
  listId: string,
): Promise<{ event: NostrEvent; list: PeopleList }> {
  const events = await nostr.query(
    [{
      kinds: [PEOPLE_LIST_KIND],
      authors: [ownerPubkey],
      '#d': [listId],
      limit: 10,
    }],
    { signal: AbortSignal.timeout(5000) },
  );

  const event = [...events].sort((a, b) => b.created_at - a.created_at)[0];
  if (!event) {
    throw new Error('People list not found');
  }

  const list = parsePeopleListFromEvent(event);
  if (!list) {
    throw new Error('People list is not editable');
  }

  return { event, list };
}

async function fetchExistingPeopleList(
  nostr: NostrQueryClient,
  ownerPubkey: string,
  listId: string,
): Promise<PeopleList | null> {
  const events = await nostr.query(
    [{
      kinds: [PEOPLE_LIST_KIND],
      authors: [ownerPubkey],
      '#d': [listId],
      limit: 1,
    }],
    { signal: AbortSignal.timeout(5000) },
  );

  return events.map(parsePeopleListFromEvent).find((list): list is PeopleList => list !== null) ?? null;
}

function buildPeopleListTags({
  listId,
  name,
  description,
  image,
  memberPubkeys,
}: {
  listId: string;
  name: string;
  description?: string;
  image?: string;
  memberPubkeys: string[];
}): string[][] {
  const tags: string[][] = [
    ['d', listId],
    ['title', name],
  ];

  if (description) {
    tags.push(['description', description]);
  }

  if (image) {
    tags.push(['image', image]);
  }

  for (const pubkey of uniquePubkeys(memberPubkeys)) {
    tags.push(['p', pubkey]);
  }

  return tags;
}

function replacePeopleListMetadataTags(
  originalTags: string[][],
  input: UpdatePeopleListInput,
): string[][] {
  const preservedTags = originalTags.filter(([name]) => (
    name !== 'd' && name !== 'title' && name !== 'description' && name !== 'image'
  ));

  return [
    ...buildPeopleListTags({
      listId: input.listId,
      name: input.name,
      description: input.description,
      image: input.image,
      memberPubkeys: [],
    }),
    ...preservedTags,
  ];
}

export function useCreatePeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      image,
      memberPubkeys = [],
    }: CreatePeopleListInput): Promise<PeopleList> => {
      if (!user) {
        throw new Error('Must be logged in to create people lists');
      }

      const listId = slugifyListName(name);
      if (!listId) {
        throw new Error('People list needs a name');
      }

      if (isReservedPeopleListDTag(listId)) {
        throw new Error('That list name is reserved');
      }

      const existingList = await fetchExistingPeopleList(nostr, user.pubkey, listId);
      if (existingList) {
        throw new Error('A people list with that name already exists');
      }

      const members = uniquePubkeys(memberPubkeys);
      const event = await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: '',
        tags: buildPeopleListTags({
          listId,
          name,
          description,
          image,
          memberPubkeys: members,
        }),
      });

      return {
        id: listId,
        name,
        description,
        image,
        pubkey: user.pubkey,
        createdAt: event.created_at,
        memberPubkeys: members,
      };
    },
    onSuccess: (newList) => {
      queryClient.setQueryData<PeopleList[]>(
        peopleListsKey(newList.pubkey),
        (oldLists) => [newList, ...(oldLists ?? []).filter((list) => list.id !== newList.id)],
      );
      queryClient.setQueryData(peopleListKey(newList.pubkey, newList.id), newList);
      queryClient.invalidateQueries({ queryKey: ['people-lists', newList.pubkey] });
    },
  });
}

export function useUpdatePeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: UpdatePeopleListInput) => {
      assertOwner(user?.pubkey, input.ownerPubkey);
      const { event } = await fetchCurrentPeopleListEvent(nostr, input.ownerPubkey, input.listId);

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: event.content,
        tags: replacePeopleListMetadataTags(event.tags, input),
      });
    },
    onMutate: async (input): Promise<PeopleListMutationSnapshot> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: peopleListKey(input.ownerPubkey, input.listId) }),
        queryClient.cancelQueries({ queryKey: peopleListsKey(input.ownerPubkey) }),
      ]);

      const snapshot = {
        list: queryClient.getQueryData<PeopleList | null>(peopleListKey(input.ownerPubkey, input.listId)),
        lists: queryClient.getQueryData<PeopleList[]>(peopleListsKey(input.ownerPubkey)),
      };

      const updateList = (list: PeopleList): PeopleList => ({
        ...list,
        name: input.name,
        description: input.description || undefined,
        image: input.image || undefined,
      });

      queryClient.setQueryData<PeopleList | null>(
        peopleListKey(input.ownerPubkey, input.listId),
        (oldList) => oldList ? updateList(oldList) : oldList,
      );
      queryClient.setQueryData<PeopleList[]>(
        peopleListsKey(input.ownerPubkey),
        (oldLists) => oldLists?.map((list) => list.id === input.listId ? updateList(list) : list),
      );

      return snapshot;
    },
    onError: (_error, input, snapshot) => {
      queryClient.setQueryData(peopleListKey(input.ownerPubkey, input.listId), snapshot?.list);
      queryClient.setQueryData(peopleListsKey(input.ownerPubkey), snapshot?.lists);
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: peopleListKey(input.ownerPubkey, input.listId) });
      queryClient.invalidateQueries({ queryKey: peopleListsKey(input.ownerPubkey) });
    },
  });
}

export function useDeletePeopleList() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, ownerPubkey }: PeopleListMutationInput) => {
      assertOwner(user?.pubkey, ownerPubkey);

      await publishEvent({
        kind: 5,
        content: 'People list deleted by owner',
        tags: [
          ['a', `${PEOPLE_LIST_KIND}:${ownerPubkey}:${listId}`],
          ['k', String(PEOPLE_LIST_KIND)],
        ],
      });

      return { listId, ownerPubkey };
    },
    onSuccess: ({ listId, ownerPubkey }) => {
      queryClient.setQueryData<PeopleList[]>(
        peopleListsKey(ownerPubkey),
        (oldLists) => oldLists?.filter((list) => list.id !== listId) ?? [],
      );
      queryClient.setQueryData(peopleListKey(ownerPubkey, listId), null);
      queryClient.invalidateQueries({ queryKey: ['people-lists'] });
      queryClient.invalidateQueries({ queryKey: ['people-list', ownerPubkey, listId] });
    },
  });
}

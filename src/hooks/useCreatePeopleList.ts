// ABOUTME: Hook for creating NIP-51 people lists (kind 30000)
// ABOUTME: Publishes a new kind 30000 event and optimistically updates the query cache

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { PEOPLE_LIST_KIND, type PeopleList } from '@/types/peopleList';

interface CreatePeopleListInput {
  name: string;
  description?: string;
  image?: string;
  members?: string[];
}

export function useCreatePeopleList() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      name,
      description,
      image,
      members = [],
    }: CreatePeopleListInput): Promise<PeopleList> => {
      if (!user) throw new Error('Must be logged in to create lists');

      const id = crypto.randomUUID();

      const tags: string[][] = [
        ['d', id],
        ['title', name],
      ];

      if (description) {
        tags.push(['description', description]);
      }

      if (image) {
        tags.push(['image', image]);
      }

      // Dedupe members before adding p tags
      const seen = new Set<string>();
      for (const pubkey of members) {
        if (!seen.has(pubkey)) {
          seen.add(pubkey);
          tags.push(['p', pubkey]);
        }
      }

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: '',
        tags,
      });

      return {
        id,
        pubkey: user.pubkey,
        name,
        description,
        image,
        members: Array.from(seen),
        createdAt: Math.floor(Date.now() / 1000),
      };
    },

    onSuccess: (newList) => {
      if (user) {
        queryClient.setQueryData<PeopleList[]>(
          ['people-lists', user.pubkey],
          (oldLists) => {
            if (!oldLists) return [newList];
            return [newList, ...oldLists];
          },
        );
      }
      queryClient.invalidateQueries({ queryKey: ['people-lists', user?.pubkey] });
    },
  });
}

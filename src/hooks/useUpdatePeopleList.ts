// ABOUTME: Hook for updating metadata of an existing NIP-51 people list (kind 30000)
// ABOUTME: Reads the current event, rebuilds tags with updated metadata, republishes

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { parsePeopleList, PEOPLE_LIST_KIND } from '@/types/peopleList';

interface UpdatePeopleListInput {
  listId: string;
  name?: string;
  description?: string;
  image?: string;
}

export function useUpdatePeopleList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId, name, description, image }: UpdatePeopleListInput) => {
      if (!user) throw new Error('Must be logged in to update lists');

      // Fetch current event from relay
      const events = await nostr.query(
        [{ kinds: [PEOPLE_LIST_KIND], authors: [user.pubkey], '#d': [listId], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );

      if (events.length === 0) throw new Error('List not found');

      const currentList = parsePeopleList(events[0]);
      if (!currentList) throw new Error('Invalid list format');

      // Rebuild tags: preserve d tag and all p tags; apply metadata overrides
      const tags: string[][] = [['d', listId]];

      // Title: use new name if provided, otherwise keep current
      const newName = name !== undefined ? name : currentList.name;
      tags.push(['title', newName]);

      // Description: if provided (including empty string), use it (empty → omit tag);
      // otherwise preserve existing
      if (description !== undefined) {
        if (description !== '') {
          tags.push(['description', description]);
        }
        // empty string → tag is omitted (effectively clears it)
      } else if (currentList.description) {
        tags.push(['description', currentList.description]);
      }

      // Image: same pattern as description
      if (image !== undefined) {
        if (image !== '') {
          tags.push(['image', image]);
        }
      } else if (currentList.image) {
        tags.push(['image', currentList.image]);
      }

      // Preserve all existing p tags
      for (const member of currentList.members) {
        tags.push(['p', member]);
      }

      await publishEvent({
        kind: PEOPLE_LIST_KIND,
        content: '',
        tags,
      });
    },

    onSuccess: (_data, variables) => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['people-lists', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['people-list', user.pubkey, variables.listId] });
      }
    },
  });
}

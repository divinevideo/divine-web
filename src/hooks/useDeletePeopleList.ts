// ABOUTME: Delete people list via kind 5 (NIP-09 deletion event)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from './useNostrPublish';
import { useCurrentUser } from './useCurrentUser';
import type { PeopleList } from '@/types/peopleList';

export function useDeletePeopleList() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ listId }: { listId: string }) => {
      if (!user) throw new Error('Must be logged in to delete lists');

      // Publish a kind 5 deletion event targeting the people list
      // The 'a' tag references the addressable event to delete
      await publishEvent({
        kind: 5, // NIP-09 deletion event
        content: 'List deleted by owner',
        tags: [
          ['a', `30000:${user.pubkey}:${listId}`],
          ['k', '30000'], // NIP-09: k tag names the kind being deleted
        ]
      });

      return { listId };
    },
    onSuccess: ({ listId }) => {
      // Remove from cache immediately
      if (user) {
        queryClient.setQueryData<PeopleList[]>(
          ['people-lists', user.pubkey],
          (oldLists) => oldLists?.filter(l => l.id !== listId) || []
        );
      }
      queryClient.invalidateQueries({ queryKey: ['people-lists'] });
      queryClient.invalidateQueries({ queryKey: ['people-list'] });
    }
  });
}

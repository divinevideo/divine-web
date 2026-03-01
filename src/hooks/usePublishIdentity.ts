// ABOUTME: Hook to publish/update NIP-39 external identity claims (kind 10011)
// ABOUTME: Provides add/remove operations for identity tags on the replaceable event

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useExternalIdentities, type ExternalIdentity } from './useExternalIdentities';

export function usePublishIdentity() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const publishEvent = async (tags: string[][]) => {
    if (!user) throw new Error('User is not logged in');

    const event = await user.signer.signEvent({
      kind: 10011,
      content: '',
      tags,
      created_at: Math.floor(Date.now() / 1000),
    });

    await nostr.event(event, { signal: AbortSignal.timeout(5000) });
    return event;
  };

  const invalidate = () => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: ['external-identities', user.pubkey] });
    }
  };

  return { publishEvent, invalidate, user };
}

export function useAddIdentity() {
  const { publishEvent, invalidate, user } = usePublishIdentity();
  const { data: existingIdentities = [] } = useExternalIdentities(user?.pubkey);

  return useMutation({
    mutationFn: async ({ platform, identity, proof }: { platform: string; identity: string; proof: string }) => {
      // Build tags: keep existing, add new
      const tags = existingIdentities
        .filter((id) => !(id.platform === platform && id.identity === identity))
        .map((id) => ['i', `${id.platform}:${id.identity}`, id.proof]);

      tags.push(['i', `${platform}:${identity}`, proof]);

      return publishEvent(tags);
    },
    onSuccess: () => invalidate(),
  });
}

export function useRemoveIdentity() {
  const { publishEvent, invalidate, user } = usePublishIdentity();
  const { data: existingIdentities = [] } = useExternalIdentities(user?.pubkey);

  return useMutation({
    mutationFn: async ({ platform, identity }: { platform: string; identity: string }) => {
      const tags = existingIdentities
        .filter((id) => !(id.platform === platform && id.identity === identity))
        .map((id) => ['i', `${id.platform}:${id.identity}`, id.proof]);

      return publishEvent(tags);
    },
    onSuccess: () => invalidate(),
  });
}

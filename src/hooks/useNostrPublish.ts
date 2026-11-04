import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";
import { useAppContext } from '@/hooks/useAppContext';
import { PRIMARY_RELAY } from '@/config/relays';
import { isListPublication, publishListToPrimary } from '@/lib/publishListToPrimary';
import { debugLog } from '@/lib/debug';

import type { NostrEvent } from "@nostrify/nostrify";

export function useNostrPublish(): UseMutationResult<NostrEvent> {
  const { nostr } = useNostr();
  const { user, signer } = useCurrentUser();
  const { config } = useAppContext();

  return useMutation({
    retry: false,
    mutationFn: async (t: Omit<NostrEvent, 'id' | 'pubkey' | 'sig'>) => {
      if (user && signer) {
        const requiresPrimary = isListPublication(t);
        if (requiresPrimary && config.disabledPresetUrls?.includes(PRIMARY_RELAY.url)) {
          throw new Error('Enable the Divine primary relay to save lists');
        }
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (location.protocol === "https:" && !tags.some(([name]) => name === "client")) {
          tags.push(["client", location.hostname]);
        }

        const event = await signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        if (requiresPrimary) {
          await publishListToPrimary(nostr, event);
          void nostr.event(event, { signal: AbortSignal.timeout(5000) })
            .catch(error => debugLog('[useNostrPublish] Backup replication failed:', error));
        } else {
          await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        }
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}

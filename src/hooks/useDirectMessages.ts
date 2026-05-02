import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from '@/hooks/useToast';
import { useAppContext } from '@/hooks/useAppContext';
import {
  buildDmShareTags,
  createDmGiftWraps,
  fetchDmMessages,
  groupDmConversations,
  parseDmShareQuery,
  publishDmMessages,
  resolveDmReadRelays,
  resolveDmWriteRelays,
  type DmConversation,
  type DmMessage,
  type DmSharePayload,
  type FetchDmMessagesResult,
} from '@/lib/dm';
import {
  convertOutboxRecordToDmMessage,
  createDmOutboxRecord,
  hydrateDmOutbox,
  markDmOutboxRecordFailed,
  markDmOutboxRecordSending,
  markDmOutboxRecordSent,
  mergeFetchedAndOutboxMessages,
  removeDmOutboxRecord,
  upsertDmOutboxRecord,
} from '@/lib/dmOutbox';

const DM_QUERY_KEY = ['dm'];
const DM_READ_STATE_EVENT = 'dm:read-state';
const DM_OUTBOX_STALE_AFTER_SECONDS = 60;

interface SendDmInput {
  clientId?: string;
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
}

interface SendDmMutationContext {
  clientId?: string;
}

function getDmReadStorageKey(ownerPubkey?: string): string {
  return `dm:read:${ownerPubkey || 'anonymous'}`;
}

function readDmReadState(ownerPubkey?: string): Record<string, number> {
  if (typeof window === 'undefined') {
    return {};
  }

  const storageKey = getDmReadStorageKey(ownerPubkey);

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    return storedValue ? JSON.parse(storedValue) as Record<string, number> : {};
  } catch {
    return {};
  }
}

function writeDmReadState(ownerPubkey: string | undefined, nextState: Record<string, number>): void {
  if (typeof window === 'undefined') {
    return;
  }

  const storageKey = getDmReadStorageKey(ownerPubkey);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    window.dispatchEvent(new CustomEvent(DM_READ_STATE_EVENT, { detail: storageKey }));
  } catch {
    // Ignore persistence failures and keep the in-memory state.
  }
}

const EMPTY_INBOX_RESULT: FetchDmMessagesResult = {
  messages: [],
  fetchedCount: 0,
  decryptFailures: 0,
  malformedCount: 0,
};

function getDmMessageQueryLimits(queryClient: ReturnType<typeof useQueryClient>, ownerPubkey: string): number[] {
  const limits = new Set<number>([200, 300]);
  const existingMessageQueries = queryClient.getQueriesData<FetchDmMessagesResult>({
    queryKey: [...DM_QUERY_KEY, 'messages', ownerPubkey],
  });

  for (const [queryKey] of existingMessageQueries) {
    const maybeLimit = queryKey[3];
    if (typeof maybeLimit === 'number') {
      limits.add(maybeLimit);
    }
  }

  return [...limits];
}

// Updates the messages portion of a cached FetchDmMessagesResult while
// preserving the fetch-meta counts. Optimistic outbox updates flow through
// here, so the meta from the most recent network fetch must survive an
// optimistic write.
function updateDmMessageCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerPubkey: string,
  updater: (existingMessages: DmMessage[]) => DmMessage[],
) {
  for (const limit of getDmMessageQueryLimits(queryClient, ownerPubkey)) {
    queryClient.setQueryData<FetchDmMessagesResult>(
      [...DM_QUERY_KEY, 'messages', ownerPubkey, limit],
      (existing) => existing
        ? { ...existing, messages: updater(existing.messages) }
        : { messages: updater([]), fetchedCount: 0, decryptFailures: 0, malformedCount: 0 },
    );
  }
}

function insertOptimisticDmIntoAllCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerPubkey: string,
  optimisticMessage: DmMessage,
) {
  updateDmMessageCaches(queryClient, ownerPubkey, (existingMessages) => {
    const nextMessages = [
      ...existingMessages.filter((message) => message.clientId !== optimisticMessage.clientId),
      optimisticMessage,
    ];

    return nextMessages.sort((left, right) => left.createdAt - right.createdAt);
  });
}

function updateOptimisticDmInAllCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  ownerPubkey: string,
  clientId: string,
  updates: Pick<DmMessage, 'deliveryState' | 'errorMessage'>,
) {
  updateDmMessageCaches(queryClient, ownerPubkey, (existingMessages) => existingMessages.map((message) => {
    if (message.clientId !== clientId) {
      return message;
    }

    return {
      ...message,
      ...updates,
    };
  }));
}

export function useDmCapability() {
  const { user, signer } = useCurrentUser();

  return {
    isLoggedIn: Boolean(user?.pubkey),
    canUseDirectMessages: Boolean(user?.pubkey && signer?.nip44),
  };
}

export function useDmReadState(ownerPubkey?: string) {
  const storageKey = getDmReadStorageKey(ownerPubkey);
  const [readState, setReadState] = useState<Record<string, number>>(() => readDmReadState(ownerPubkey));

  useEffect(() => {
    setReadState(readDmReadState(ownerPubkey));
  }, [ownerPubkey]);

  useEffect(() => {
    const syncReadState = (event: Event) => {
      if (event instanceof StorageEvent) {
        if (event.key && event.key !== storageKey) return;
      }

      if (event instanceof CustomEvent && event.detail !== storageKey) {
        return;
      }

      setReadState(readDmReadState(ownerPubkey));
    };

    window.addEventListener('storage', syncReadState);
    window.addEventListener(DM_READ_STATE_EVENT, syncReadState as EventListener);

    return () => {
      window.removeEventListener('storage', syncReadState);
      window.removeEventListener(DM_READ_STATE_EVENT, syncReadState as EventListener);
    };
  }, [ownerPubkey, storageKey]);

  const markConversationRead = useCallback((conversationId: string, timestamp: number) => {
    if (!ownerPubkey || !timestamp) {
      return;
    }

    setReadState((previousState) => {
      const nextState = {
        ...previousState,
        [conversationId]: Math.max(previousState[conversationId] || 0, timestamp),
      };

      writeDmReadState(ownerPubkey, nextState);
      return nextState;
    });
  }, [ownerPubkey]);

  return {
    readState,
    markConversationRead,
  };
}

export function useDmMessages(limit = 200) {
  const { user, signer } = useCurrentUser();
  const { config } = useAppContext();

  return useQuery<FetchDmMessagesResult>({
    queryKey: [...DM_QUERY_KEY, 'messages', user?.pubkey || '', limit],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey || !signer?.nip44) {
        return EMPTY_INBOX_RESULT;
      }

      const relayUrls = await resolveDmReadRelays({
        appRelayUrls: config.relayUrls || [config.relayUrl],
        signer,
        currentUserPubkey: user.pubkey,
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });

      const fetched = await fetchDmMessages({
        signer,
        currentUserPubkey: user.pubkey,
        relayUrls,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        limit,
      });

      const hydratedOutbox = hydrateDmOutbox(user.pubkey, DM_OUTBOX_STALE_AFTER_SECONDS);
      const { messages, reconciledClientIds } = mergeFetchedAndOutboxMessages(fetched.messages, hydratedOutbox);

      for (const clientId of reconciledClientIds) {
        removeDmOutboxRecord(user.pubkey, clientId);
      }

      return {
        messages,
        fetchedCount: fetched.fetchedCount,
        decryptFailures: fetched.decryptFailures,
        malformedCount: fetched.malformedCount,
      };
    },
    enabled: Boolean(user?.pubkey && signer?.nip44),
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useDmConversations(limit = 200) {
  const { user } = useCurrentUser();
  const messagesQuery = useDmMessages(limit);
  const { readState } = useDmReadState(user?.pubkey);

  const conversations = useMemo<DmConversation[]>(
    () => groupDmConversations(messagesQuery.data?.messages || [], readState),
    [messagesQuery.data, readState],
  );

  return {
    ...messagesQuery,
    data: conversations,
  };
}

/**
 * Status of the moderator/user inbox for the current signer.
 *
 * - `loading` — the initial fetch hasn't returned yet.
 * - `ok` — at least one message is visible.
 * - `unavailable` — relays returned wraps but every single one failed to
 *   decrypt. This usually means the signer (typically a NIP-46 bunker) is
 *   rejecting `nip44_decrypt` for this account. UI should render an
 *   explicit "inbox unavailable" state, not the generic empty state.
 * - `empty` — relays returned no wraps OR a partial-decrypt scenario where
 *   we have nothing to show. Render the generic empty state.
 */
export type DmInboxStatus = 'loading' | 'ok' | 'empty' | 'unavailable';

export function useDmInboxStatus(limit = 200): DmInboxStatus {
  const { data, isLoading } = useDmMessages(limit);
  if (isLoading) return 'loading';
  if (!data) return 'empty';
  if (data.messages.length > 0) return 'ok';
  if (data.fetchedCount > 0 && data.decryptFailures === data.fetchedCount) return 'unavailable';
  return 'empty';
}

export function useUnreadDmCount(limit = 200) {
  const conversationsQuery = useDmConversations(limit);

  const unreadCount = useMemo(
    () => (conversationsQuery.data || []).reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversationsQuery.data],
  );

  return {
    ...conversationsQuery,
    data: unreadCount,
  };
}

export function useDmConversation(conversationId: string | undefined, limit = 300) {
  const { user } = useCurrentUser();
  const messagesQuery = useDmMessages(limit);
  const { readState, markConversationRead } = useDmReadState(user?.pubkey);

  const messages = useMemo<DmMessage[]>(
    () => (messagesQuery.data?.messages || []).filter((message) => message.conversationId === conversationId),
    [conversationId, messagesQuery.data],
  );

  const latestMessageAt = messages[messages.length - 1]?.createdAt || 0;
  const lastReadAt = conversationId ? readState[conversationId] || 0 : 0;

  return {
    ...messagesQuery,
    data: messages,
    latestMessageAt,
    lastReadAt,
    markConversationRead: () => {
      if (!conversationId) return;
      markConversationRead(conversationId, latestMessageAt);
    },
  };
}

export function useDmSend() {
  const queryClient = useQueryClient();
  const { user, signer } = useCurrentUser();
  const { config } = useAppContext();

  return useMutation<{ relayUrls: string[]; wraps: Awaited<ReturnType<typeof createDmGiftWraps>> }, Error, SendDmInput, SendDmMutationContext>({
    onMutate: ({ clientId, participantPubkeys, content, share }) => {
      if (!user?.pubkey) {
        return {};
      }

      const record = clientId
        ? markDmOutboxRecordSending(user.pubkey, clientId, {
          participantPubkeys,
          content,
          share,
        }) || createDmOutboxRecord({
          ownerPubkey: user.pubkey,
          participantPubkeys,
          content,
          share,
        })
        : createDmOutboxRecord({
          ownerPubkey: user.pubkey,
          participantPubkeys,
          content,
          share,
        });

      const optimisticMessage = convertOutboxRecordToDmMessage(record);
      if (!clientId || record.clientId !== clientId) {
        upsertDmOutboxRecord(user.pubkey, record);
      }

      insertOptimisticDmIntoAllCaches(queryClient, user.pubkey, optimisticMessage);
      return {
        clientId: record.clientId,
      };
    },
    mutationFn: async ({ participantPubkeys, content, share }: SendDmInput) => {
      if (!user?.pubkey) {
        throw new Error('You need to log in before sending a message');
      }

      if (!signer?.nip44) {
        throw new Error('Your current signer does not support NIP-44 direct messages');
      }

      const recipients = [...new Set(participantPubkeys.filter((pubkey) => pubkey !== user.pubkey))];

      if (!recipients.length) {
        throw new Error('Choose at least one person to message');
      }

      const relayUrls = await resolveDmWriteRelays({
        appRelayUrls: config.relayUrls || [config.relayUrl],
        signer,
        recipientPubkeys: recipients,
        signal: AbortSignal.timeout(5000),
      });

      const wraps = await createDmGiftWraps({
        signer,
        senderPubkey: user.pubkey,
        recipientPubkeys: recipients,
        content,
        additionalTags: buildDmShareTags(share),
      });

      await publishDmMessages(relayUrls, wraps, AbortSignal.timeout(10000));
      return { relayUrls, wraps };
    },
    onSuccess: (_result, _variables, context) => {
      if (!user?.pubkey || !context?.clientId) {
        return;
      }

      markDmOutboxRecordSent(user.pubkey, context.clientId);
      updateOptimisticDmInAllCaches(queryClient, user.pubkey, context.clientId, {
        deliveryState: 'sent',
        errorMessage: undefined,
      });
    },
    onError: (error, _variables, context) => {
      if (user?.pubkey && context?.clientId) {
        markDmOutboxRecordFailed(user.pubkey, context.clientId, error.message);
        updateOptimisticDmInAllCaches(queryClient, user.pubkey, context.clientId, {
          deliveryState: 'failed',
          errorMessage: error.message,
        });
      }

      toast({
        title: 'Message failed',
        description: error instanceof Error ? error.message : 'Unable to send your message right now',
        variant: 'destructive',
      });
    },
  });
}

export function useParsedDmShare(search: string) {
  return useMemo(
    () => parseDmShareQuery(new URLSearchParams(search)),
    [search],
  );
}

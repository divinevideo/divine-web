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
} from '@/lib/dm';

const DM_QUERY_KEY = ['dm'];
const DM_READ_STATE_EVENT = 'dm:read-state';

interface SendDmInput {
  participantPubkeys: string[];
  content: string;
  share?: DmSharePayload;
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

  return useQuery({
    queryKey: [...DM_QUERY_KEY, 'messages', user?.pubkey || '', limit],
    queryFn: async ({ signal }) => {
      if (!user?.pubkey || !signer?.nip44) {
        return [];
      }

      const relayUrls = await resolveDmReadRelays({
        appRelayUrls: config.relayUrls || [config.relayUrl],
        signer,
        currentUserPubkey: user.pubkey,
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });

      return fetchDmMessages({
        signer,
        currentUserPubkey: user.pubkey,
        relayUrls,
        signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        limit,
      });
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
    () => groupDmConversations(messagesQuery.data || [], readState),
    [messagesQuery.data, readState],
  );

  return {
    ...messagesQuery,
    data: conversations,
  };
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
    () => (messagesQuery.data || []).filter((message) => message.conversationId === conversationId),
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

  return useMutation({
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: DM_QUERY_KEY });
    },
    onError: (error) => {
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

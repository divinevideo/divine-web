// ABOUTME: Hooks for saving/unsaving addressable lists in the kind 30003 'saved-lists' event
// ABOUTME: Both hooks use optimistic updates on ['saved-lists', pubkey] with rollback on failure

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { SavedListRef } from '@/hooks/useSavedLists';

const HEX64 = /^[0-9a-f]{64}$/i;
const ALLOWED_KINDS = new Set<number>([30000, 30005]);

interface SavedListMutationInput {
  kind: 30000 | 30005;
  pubkey: string;
  dTag: string;
}

function validateInput(input: SavedListMutationInput): void {
  if (!ALLOWED_KINDS.has(input.kind)) {
    throw new Error(`Invalid kind: ${input.kind}. Must be 30000 or 30005.`);
  }
  if (!HEX64.test(input.pubkey)) {
    throw new Error('pubkey must be 64-char lowercase hex');
  }
  if (!input.dTag) {
    throw new Error('dTag must be non-empty');
  }
}

function buildATagValue(input: SavedListMutationInput): string {
  return `${input.kind}:${input.pubkey}:${input.dTag}`;
}

type NostrLike = {
  query: (
    filters: unknown[],
    opts: unknown,
  ) => Promise<{ id: string; pubkey: string; kind: number; created_at: number; content: string; sig: string; tags: string[][] }[]>;
};

/** Fetch the current 'saved-lists' event; returns its a-tag values (empty array if none). */
async function fetchCurrentATags(nostr: NostrLike, pubkey: string): Promise<string[]> {
  const events = await nostr.query(
    [{ kinds: [30003], authors: [pubkey], '#d': ['saved-lists'], limit: 1 }],
    { signal: AbortSignal.timeout(5000) },
  );

  if (events.length === 0) return [];

  const event = events.sort((a, b) => b.created_at - a.created_at)[0];
  return event.tags.filter((t) => t[0] === 'a' && t[1]).map((t) => t[1]);
}

/** Convert raw a-tag value strings to SavedListRef array (best-effort, drops invalid). */
function parseATags(rawValues: string[]): SavedListRef[] {
  const refs: SavedListRef[] = [];
  for (const val of rawValues) {
    const parts = val.split(':');
    if (parts.length !== 3) continue;
    const [kindStr, pubkey, dTag] = parts;
    const kind = Number(kindStr);
    if (!ALLOWED_KINDS.has(kind)) continue;
    if (!HEX64.test(pubkey)) continue;
    if (!dTag) continue;
    refs.push({ kind: kind as 30000 | 30005, pubkey, dTag });
  }
  return refs;
}

export function useSaveList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: SavedListMutationInput) => {
      if (!user) throw new Error('Must be logged in to save lists');

      validateInput(input);

      const currentATags = await fetchCurrentATags(nostr, user.pubkey);
      const newValue = buildATagValue(input);

      // Idempotent: already saved — no-op
      if (currentATags.includes(newValue)) return;

      const updatedATags = [...currentATags, newValue];

      await publishEvent({
        kind: 30003,
        content: '',
        tags: [['d', 'saved-lists'], ...updatedATags.map((v) => ['a', v])],
      });
    },

    onMutate: async (input: SavedListMutationInput) => {
      if (!user) return;
      const queryKey = ['saved-lists', user.pubkey];

      await queryClient.cancelQueries({ queryKey });

      const snapshot = queryClient.getQueryData<SavedListRef[]>(queryKey);

      const newValue = buildATagValue(input);
      queryClient.setQueryData<SavedListRef[]>(queryKey, (old) => {
        const current = old ?? [];
        if (current.some((r) => buildATagValue(r) === newValue)) return current;
        return [...current, { kind: input.kind, pubkey: input.pubkey, dTag: input.dTag }];
      });

      return { snapshot, queryKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(context.queryKey, context.snapshot);
      }
    },

    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['saved-lists', user.pubkey] });
      }
    },
  });
}

export function useUnsaveList() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: SavedListMutationInput) => {
      if (!user) throw new Error('Must be logged in to unsave lists');

      validateInput(input);

      const currentATags = await fetchCurrentATags(nostr, user.pubkey);
      const targetValue = buildATagValue(input);

      // Idempotent: not saved — no-op
      if (!currentATags.includes(targetValue)) return;

      const updatedATags = currentATags.filter((v) => v !== targetValue);

      await publishEvent({
        kind: 30003,
        content: '',
        tags: [['d', 'saved-lists'], ...updatedATags.map((v) => ['a', v])],
      });
    },

    onMutate: async (input: SavedListMutationInput) => {
      if (!user) return;
      const queryKey = ['saved-lists', user.pubkey];

      await queryClient.cancelQueries({ queryKey });

      const snapshot = queryClient.getQueryData<SavedListRef[]>(queryKey);

      const targetValue = buildATagValue(input);
      queryClient.setQueryData<SavedListRef[]>(queryKey, (old) => {
        const current = old ?? [];
        return current.filter((r) => buildATagValue(r) !== targetValue);
      });

      return { snapshot, queryKey };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(context.queryKey, context.snapshot);
      }
    },

    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['saved-lists', user.pubkey] });
      }
    },
  });
}

// Re-export parseATags for potential reuse
export { parseATags };

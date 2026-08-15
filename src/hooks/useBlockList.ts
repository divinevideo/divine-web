import { useEffect, useMemo, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMuteList, publishMuteListUpdate } from '@/hooks/useModeration';
import { fetchAndSelectContactList } from '@/hooks/useFollowRelationship';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { followListCache } from '@/lib/followListCache';
import {
  addBlockProvenance,
  BLOCK_PROVENANCE_EVENT,
  getExplicitBlockedPubkeys,
  removeBlockProvenance,
} from '@/lib/moderationProvenance';
import { debugLog, debugWarn } from '@/lib/debug';
import { MuteType } from '@/types/moderation';

const EMPTY_BLOCKED_SET: ReadonlySet<string> = new Set();

export function useBlockedPubkeys(): ReadonlySet<string> {
  const { user } = useCurrentUser();
  const { data: muteList = [] } = useMuteList();
  const [provenanceVersion, setProvenanceVersion] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleChange = () => setProvenanceVersion(version => version + 1);
    window.addEventListener(BLOCK_PROVENANCE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener(BLOCK_PROVENANCE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  return useMemo(() => {
    if (!user?.pubkey) return EMPTY_BLOCKED_SET;
    void provenanceVersion;
    const mutedPubkeys = muteList
      .filter(item => item.type === MuteType.USER)
      .map(item => item.value);
    return getExplicitBlockedPubkeys(user.pubkey, mutedPubkeys);
  }, [user?.pubkey, muteList, provenanceVersion]);
}

export function useBlockUser() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ targetPubkey }: { targetPubkey: string }) => {
      if (!user?.pubkey) throw new Error('Must be logged in to block users');
      if (targetPubkey === user.pubkey) throw new Error('Cannot block yourself');

      await publishMuteListUpdate({
        nostr,
        publishEvent,
        userPubkey: user.pubkey,
        updateTags: ({ tags, items }) => {
          const alreadyMuted = items.some(
            item => item.type === MuteType.USER && item.value === targetPubkey
          );
          // Already muted: the p-tag is present, so skip a redundant kind-10000
          // republish. Provenance + the kind-3 strip below still run.
          if (alreadyMuted) return null;
          return [...tags, ['p', targetPubkey]];
        },
      });
      addBlockProvenance(user.pubkey, targetPubkey);

      try {
        const bestContactList = await fetchAndSelectContactList(
          nostr,
          user.pubkey,
          null,
          'useBlockUser'
        );
        const currentTags = bestContactList?.tags ?? [];
        const updatedTags = currentTags.filter(tag => !(tag[0] === 'p' && tag[1] === targetPubkey));
        if (updatedTags.length !== currentTags.length) {
          await publishEvent({
            kind: 3,
            content: bestContactList?.content ?? '',
            tags: updatedTags,
          });
        }
      } catch (error) {
        debugWarn('[useBlockUser] Block published, but follow-list cleanup failed:', error);
      }
    },
    onSuccess: (_, { targetPubkey }) => {
      if (user?.pubkey) {
        followListCache.invalidate(user.pubkey);
        debugLog('[useBlockUser] Invalidated follow list cache after blocking', targetPubkey);
      }
      queryClient.invalidateQueries({ queryKey: ['mute-list'] });
      queryClient.invalidateQueries({ queryKey: ['follow-relationship', user?.pubkey, targetPubkey] });
      queryClient.invalidateQueries({ queryKey: ['follow-list', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats', targetPubkey] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats', user?.pubkey] });
    },
  });
}

export function useUnblockUser() {
  const { nostr } = useNostr();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ targetPubkey }: { targetPubkey: string }) => {
      if (!user?.pubkey) throw new Error('Must be logged in to unblock users');

      const didPublish = await publishMuteListUpdate({
        nostr,
        publishEvent,
        userPubkey: user.pubkey,
        updateTags: ({ tags, items }) => {
          const explicitBlocks = getExplicitBlockedPubkeys(
            user.pubkey,
            items.filter(item => item.type === MuteType.USER).map(item => item.value),
          );
          if (!explicitBlocks.has(targetPubkey)) return null;
          return tags.filter(tag => !(tag[0] === 'p' && tag[1] === targetPubkey));
        },
      });
      if (didPublish) {
        removeBlockProvenance(user.pubkey, targetPubkey);
      }
    },
    onSuccess: (_, { targetPubkey }) => {
      queryClient.invalidateQueries({ queryKey: ['mute-list'] });
      queryClient.invalidateQueries({ queryKey: ['follow-relationship', user?.pubkey, targetPubkey] });
      queryClient.invalidateQueries({ queryKey: ['follow-list', user?.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats', targetPubkey] });
      queryClient.invalidateQueries({ queryKey: ['profile-stats', user?.pubkey] });
    },
  });
}

// ABOUTME: Hook to publish/update NIP-39 external identity claims (kind 10011)
// ABOUTME: Provides add/remove operations; removing a sign-in row also clears the verifier's sign-in record

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useExternalIdentities } from './useExternalIdentities';
import { revokeSignInLink, signInPlatform, type SignInRevokeResult } from '@/lib/signInRevoke';
import { clearAccountVerificationCache } from '@/lib/verificationCache';
import { canonicalPlatform } from '@/lib/identityPlatform';
import type { NostrEvent } from '@nostrify/nostrify';

export interface RemoveIdentityResult {
  /** The kind 10011 list that was published without the removed row. */
  event: NostrEvent;
  /** The verifier's answer, or null when the platform has no sign-in. */
  signIn: SignInRevokeResult | null;
}

/**
 * Matches the verifier's LINKED_ACCOUNTS_MAX_SECONDS_AHEAD window (600s).
 * Confirming lists created by verifier.divine.video or divine-mobile can sit
 * slightly ahead of this browser's clock; advancing by 1s keeps replacement
 * lists newer on NIP-01 relays and accepted by /auth/oauth/revoke without
 * propagating bogus far-future timestamps.
 */
const MAX_CLOCK_SKEW_SECONDS = 600;

function nextCreatedAt(nowSeconds: number, previousCreatedAt: number | undefined): number {
  if (
    typeof previousCreatedAt === 'number'
    && previousCreatedAt >= nowSeconds
    && previousCreatedAt < nowSeconds + MAX_CLOCK_SKEW_SECONDS
  ) {
    return previousCreatedAt + 1;
  }
  return nowSeconds;
}

export function usePublishIdentity() {
  const { nostr } = useNostr();
  const { user, signer } = useCurrentUser();
  const queryClient = useQueryClient();

  const publishEvent = async (tags: string[][]) => {
    if (!user || !signer) throw new Error('User is not logged in');

    const nowSeconds = Math.floor(Date.now() / 1000);
    const previousCreatedAt = queryClient.getQueryData<number>([
      'external-identities-created-at',
      user.pubkey,
    ]);

    const event = await signer.signEvent({
      kind: 10011,
      content: '',
      tags,
      created_at: nextCreatedAt(nowSeconds, previousCreatedAt),
    });

    // The signer is live state behind an async gap (e.g. an extension whose
    // active account changed), and the signed list is also sent to the verifier
    // as an auth proof, so never publish something signed as another account.
    if (event.pubkey !== user.pubkey) {
      throw new Error('Signer pubkey does not match the logged-in account');
    }

    await nostr.event(event, { signal: AbortSignal.timeout(5000) });
    queryClient.setQueryData<number>(
      ['external-identities-created-at', user.pubkey],
      (prev) => Math.max(prev ?? 0, event.created_at),
    );
    return event;
  };

  const invalidate = () => {
    if (user) {
      // Delay slightly to let the relay index the new event
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['external-identities', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['identity-verify'] });
      }, 500);
    }
  };

  return { publishEvent, invalidate, user };
}

export function useAddIdentity() {
  const { publishEvent, invalidate, user } = usePublishIdentity();
  const { data: existingIdentities = [] } = useExternalIdentities(user?.pubkey);

  return useMutation({
    mutationFn: async ({ platform, identity, proof }: { platform: string; identity: string; proof: string }) => {
      const targetPlatform = canonicalPlatform(platform);
      // Build tags: keep existing, add new
      const tags = existingIdentities
        .filter((id) => !(id.platform === targetPlatform && id.identity === identity))
        .map((id) => ['i', `${id.platform}:${id.identity}`, id.proof]);

      tags.push(['i', `${targetPlatform}:${identity}`, proof]);

      const event = await publishEvent(tags);
      if (user) {
        clearAccountVerificationCache(targetPlatform, identity, user.pubkey);
      }
      return event;
    },
    onSuccess: () => invalidate(),
  });
}

export function useRemoveIdentity() {
  const { publishEvent, invalidate, user } = usePublishIdentity();
  const { data: existingIdentities = [] } = useExternalIdentities(user?.pubkey);

  return useMutation({
    mutationFn: async ({ platform, identity }: { platform: string; identity: string }): Promise<RemoveIdentityResult> => {
      const targetPlatform = canonicalPlatform(platform);
      const tags = existingIdentities
        .filter((id) => !(id.platform === targetPlatform && id.identity === identity))
        .map((id) => ['i', `${id.platform}:${id.identity}`, id.proof]);

      const event = await publishEvent(tags);

      // Only after the new list is published: the verifier checks it before clearing.
      // A refusal never undoes the removal; revokeSignInLink does not reject.
      const signInName = signInPlatform(platform);
      const signIn = signInName && user
        ? await revokeSignInLink({ platform: signInName, identity, pubkey: user.pubkey, list: event })
        : null;

      if (user) {
        clearAccountVerificationCache(targetPlatform, identity, user.pubkey);
      }

      return { event, signIn };
    },
    onSuccess: () => invalidate(),
  });
}

// ABOUTME: Safety check to prevent accidental follow list overwrites
// ABOUTME: Warns users from other clients if they have no follow list on divine

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { debugLog } from '@/lib/debug';

interface SafetyCheckResult {
  needsWarning: boolean;
  hasExistingFollowList: boolean;
  hasExistingProfile: boolean;
  isRewindClient: boolean;
  clientTag?: string;
}

/**
 * Check if user needs a follow list safety warning
 *
 * Warning shown when:
 * - User has NO follow list on divine (empty or missing Kind 3)
 * - User's Kind 0 profile does NOT contain a "client" tag from divine
 *
 * This prevents users from other clients accidentally wiping their follow list
 * when they first follow someone on divine.
 */
export function useFollowListSafetyCheck(pubkey: string | undefined, enabled: boolean = true) {
  const { nostr } = useNostr();

  return useQuery<SafetyCheckResult>({
    queryKey: ['follow-list-safety-check', pubkey],
    queryFn: async (context) => {
      if (!pubkey) {
        return {
          needsWarning: false,
          hasExistingFollowList: false,
          hasExistingProfile: false,
          isRewindClient: false,
        };
      }

      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(5000)]);

      try {
        debugLog('[SafetyCheck] Checking follow list safety for', pubkey);

        // Query for user's Kind 0 profile and Kind 3 contact list
        const events = await nostr.query([
          {
            kinds: [0, 3],
            authors: [pubkey],
            limit: 2,
          }
        ], { signal });

        const profileEvent = events.find(e => e.kind === 0);
        const contactListEvent = events.find(e => e.kind === 3);

        debugLog('[SafetyCheck] ===========================================');
        debugLog('[SafetyCheck] Profile event found:', !!profileEvent);
        debugLog('[SafetyCheck] Contact list event found:', !!contactListEvent);
        if (profileEvent) {
          debugLog('[SafetyCheck] Profile event ID:', profileEvent.id);
          debugLog('[SafetyCheck] Profile content preview:', profileEvent.content.substring(0, 100));
        }
        if (contactListEvent) {
          debugLog('[SafetyCheck] Contact list tags count:', contactListEvent.tags.length);
        }

        // Check if user has existing profile
        const hasExistingProfile = !!profileEvent;

        // Check if profile has divine client tag
        let isRewindClient = false;
        let clientTag: string | undefined;

        if (profileEvent) {
          try {
            const metadata = JSON.parse(profileEvent.content);

            // Check for client tag in metadata
            // Rewind clients should tag their profiles with "client": "divine" or similar
            clientTag = metadata.client;

            // List of divine client identifiers
            const divineClientNames = [
              'divine',
              'divine.video',
              'divineweb',
              'divine web',
              'openvine',
            ];

            isRewindClient = divineClientNames.some(name =>
              clientTag?.toLowerCase().includes(name)
            );

            debugLog('[SafetyCheck] Client tag found:', clientTag || 'NONE');
            debugLog('[SafetyCheck] Is rewind client:', isRewindClient);
            if (clientTag) {
              debugLog('[SafetyCheck] Client tag lowercase:', clientTag.toLowerCase());
              debugLog('[SafetyCheck] Checking against divine identifiers:',
                ['rewind', 'rewind.community', 'rewindweb', 'rewind web', 'openvine']);
            }
          } catch (err) {
            debugLog('[SafetyCheck] Failed to parse profile metadata:', err);
          }
        }

        // Check if user has existing follow list with contacts
        const hasExistingFollowList = contactListEvent
          ? contactListEvent.tags.filter(tag => tag[0] === 'p').length > 0
          : false;

        debugLog('[SafetyCheck] Has existing follow list:', hasExistingFollowList);
        debugLog('[SafetyCheck] -------------------------------------------');

        // Simple logic: Show warning UNLESS:
        // 1. User HAS a follow list already (nothing to overwrite), OR
        // 2. User's Kind 0 has a client tag that includes "divine"
        //
        // This means:
        // - No Kind 0 found → Show warning
        // - Kind 0 found but no client tag → Show warning
        // - Kind 0 found with non-divine client tag → Show warning
        // - Kind 0 found with divine client tag → Skip warning
        // - Has follow list already → Skip warning
        const needsWarning = !hasExistingFollowList && !isRewindClient;

        debugLog('[SafetyCheck] 🎯 FINAL DECISION:');
        debugLog('[SafetyCheck]    Has follow list?', hasExistingFollowList);
        debugLog('[SafetyCheck]    Is rewind client?', isRewindClient);
        debugLog('[SafetyCheck]    ⚠️  NEEDS WARNING?', needsWarning);
        debugLog('[SafetyCheck] ===========================================');

        return {
          needsWarning,
          hasExistingFollowList,
          hasExistingProfile,
          isRewindClient,
          clientTag,
        };
      } catch (error) {
        console.error('[SafetyCheck] Error checking follow list safety:', error);

        // On error, don't show warning (fail open)
        return {
          needsWarning: false,
          hasExistingFollowList: false,
          hasExistingProfile: false,
          isRewindClient: false,
        };
      }
    },
    enabled: enabled && !!pubkey,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

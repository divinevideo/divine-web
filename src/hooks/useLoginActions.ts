import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';
import { followListCache } from '@/lib/followListCache';
import { debugLog } from '@/lib/debug';
import { nip19 } from 'nostr-tools';

// NOTE: This file should not be edited except for adding new login methods.

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    // Login with a Nostr secret key
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
    },
    // Login with a NIP-46 "bunker://" URI
    async bunker(uri: string): Promise<void> {
      const login = await NLogin.fromBunker(uri, nostr);
      addLogin(login);
    },
    // Login via nostrconnect:// QR code flow (client-initiated NIP-46)
    nostrconnect(
      clientNsec: `nsec1${string}`,
      bunkerPubkey: string,
      userPubkey: string,
      relays: string[]
    ): void {
      const login = {
        id: `bunker-${userPubkey}`,
        type: 'bunker' as const,
        pubkey: userPubkey,
        createdAt: new Date().toISOString(),
        data: {
          bunkerPubkey,
          clientNsec,
          relays,
        },
      };
      addLogin(login as Parameters<typeof addLogin>[0]);
    },
    // Login with a NIP-07 browser extension
    async extension(): Promise<void> {
      const login = await NLogin.fromExtension();
      addLogin(login);
    },
    // Login with Keycast OAuth (REST RPC based signing)
    keycast(pubkey: string, token: string): void {
      // Custom login type for Keycast REST RPC signing
      const login = {
        id: `keycast-${pubkey}`,
        type: 'x-keycast' as const,
        pubkey,
        createdAt: new Date().toISOString(),
        data: { token },
      };
      // Cast to NLoginType which is the union type accepted by addLogin
      addLogin(login as Parameters<typeof addLogin>[0]);
    },
    // Log out the current user
    async logout(): Promise<void> {
      const login = logins[0];
      if (login) {
        // Clear user-specific caches on logout for privacy
        try {
          // Get user pubkey before removing login
          let user: string | undefined;
          if (login.type === 'nsec') {
            const decoded = nip19.decode(login.data.nsec);
            if (decoded.type === 'nsec') {
              // Convert private key bytes to public key
              const { getPublicKey } = await import('nostr-tools');
              user = getPublicKey(decoded.data);
            }
          }

          if (user) {
            debugLog('[useLoginActions] Clearing caches for user on logout:', user);
            followListCache.invalidate(user);
          } else {
            // If we can't determine pubkey, clear all follow list caches
            debugLog('[useLoginActions] Clearing all follow list caches on logout');
            await followListCache.clearAll();
          }
        } catch (error) {
          console.warn('[useLoginActions] Failed to clear caches on logout:', error);
        }

        removeLogin(login.id);
      }
    }
  };
}

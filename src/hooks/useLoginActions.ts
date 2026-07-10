import { useNostr } from '@nostrify/react';
import { NLogin, useNostrLogin } from '@nostrify/react/login';
import { followListCache } from '@/lib/followListCache';
import { setLoginCookie, clearLoginCookie } from '@/lib/crossSubdomainAuth';
import { debugLog } from '@/lib/debug';
import { nip19 } from 'nostr-tools';

// NOTE: This file should not be edited except for adding new login methods.
// Policy stays out of this file: async login methods accept an optional
// beforeCommit guard so the caller can re-check its own policy at the moment
// the signer is committed (#182); the policy predicate lives with the caller.

interface CommitGuardOptions {
  /** Last-chance policy re-check, run after the handshake resolves and before
   *  the signer is committed (addLogin + login cookie). Returning false aborts
   *  the login: nothing is committed and the method resolves false. Needed
   *  because a pre-handshake check goes stale while the extension prompt or
   *  bunker connect is open (dcadenas review on #476). */
  beforeCommit?: () => boolean;
}

export function useLoginActions() {
  const { nostr } = useNostr();
  const { logins, addLogin, removeLogin } = useNostrLogin();

  return {
    // Login with a Nostr secret key
    nsec(nsec: string): void {
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
      setLoginCookie({ type: 'nsec', pubkey: login.pubkey });
    },
    // Login with a NIP-46 "bunker://" URI; resolves whether the signer was committed
    async bunker(uri: string, options?: CommitGuardOptions): Promise<boolean> {
      const login = await NLogin.fromBunker(uri, nostr);
      if (options?.beforeCommit && !options.beforeCommit()) return false;
      addLogin(login);
      setLoginCookie({ type: 'bunker', pubkey: login.pubkey, bunkerData: login.data });
      return true;
    },
    // Login with a NIP-07 browser extension; resolves whether the signer was committed
    async extension(options?: CommitGuardOptions): Promise<boolean> {
      const login = await NLogin.fromExtension();
      if (options?.beforeCommit && !options.beforeCommit()) return false;
      addLogin(login);
      setLoginCookie({ type: 'extension', pubkey: login.pubkey });
      return true;
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
        clearLoginCookie();
      }
    }
  };
}

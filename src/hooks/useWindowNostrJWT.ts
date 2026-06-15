// ABOUTME: React hook for JWT-based window.nostr injection
// ABOUTME: Uses the hosted Divine login RPC API with JWT authentication for signing

import { useEffect, useRef, useState } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import { DivineJWTSigner } from '@/lib/DivineJWTSigner';
import { injectWindowNostr, removeWindowNostr } from '@/lib/bunkerToWindowNostr';

export interface UseWindowNostrJWTOptions {
  /** JWT token for authentication */
  token: string | null;
  /** Enable auto-injection of window.nostr (default: true) */
  autoInject?: boolean;
  /** Timeout for API requests in milliseconds (default: 10000) */
  timeout?: number;
}

export interface UseWindowNostrJWTReturn {
  /** The NostrSigner instance, or null if not available */
  signer: NostrSigner | null;
  /** Whether the signer is currently initializing */
  isInitializing: boolean;
  /** Error that occurred during initialization */
  error: Error | null;
  /** Whether window.nostr is currently injected */
  isInjected: boolean;
  /** Manually trigger injection (only needed if autoInject=false) */
  inject: () => void;
  /** Manually remove window.nostr */
  remove: () => void;
  /** Update the JWT token (when token is refreshed) */
  updateToken: (newToken: string) => void;
}

/**
 * Hook to manage JWT-based window.nostr injection
 *
 * Creates a NostrSigner that signs events via the hosted Divine RPC API with JWT authentication,
 * and optionally injects it as window.nostr for compatibility with existing Nostr libraries.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { getValidToken } = useDivineSession();
 *   const token = getValidToken();
 *
 *   const { signer, isInitializing, error, isInjected } = useWindowNostrJWT({
 *     token,
 *     autoInject: true,
 *   });
 *
 *   if (isInitializing) return <div>Initializing signer...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (isInjected) return <div>✅ window.nostr is ready!</div>;
 *
 *   return <div>Not signed in</div>;
 * }
 * ```
 */
export function useWindowNostrJWT(
  options: UseWindowNostrJWTOptions
): UseWindowNostrJWTReturn {
  const { token, autoInject = true, timeout = 10000 } = options;

  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInjected, setIsInjected] = useState(false);

  // Track the current token to detect changes
  const lastToken = useRef<string | null>(null);
  const signerRef = useRef<DivineJWTSigner | null>(null);

  // Create or update signer when token changes
  useEffect(() => {
    if (!token) {
      setSigner(null);
      setError(null);
      setIsInitializing(false);
      lastToken.current = null;
      signerRef.current = null;
      return;
    }

    // If token hasn't changed and we have a signer, skip
    if (token === lastToken.current && signerRef.current) {
      return;
    }

    lastToken.current = token;

    console.log('[useWindowNostrJWT] Creating JWT signer...');
    setIsInitializing(true);
    setError(null);

    try {
      // Create new JWT signer
      const newSigner = new DivineJWTSigner({ token, timeout });
      signerRef.current = newSigner;

      // Verify it works by fetching pubkey
      newSigner
        .getPublicKey()
        .then((pubkey) => {
          console.log('[useWindowNostrJWT] ✅ JWT signer ready, pubkey:', pubkey);
          setSigner(newSigner);
          setError(null);
        })
        .catch((err) => {
          console.error('[useWindowNostrJWT] ❌ Failed to verify signer:', err);
          setSigner(null);
          setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          setIsInitializing(false);
        });
    } catch (err) {
      console.error('[useWindowNostrJWT] ❌ Failed to create signer:', err);
      setSigner(null);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsInitializing(false);
    }
  }, [token, timeout]);

  // Auto-inject window.nostr when signer is ready
  useEffect(() => {
    if (!autoInject || !signer) {
      return;
    }

    console.log('[useWindowNostrJWT] Auto-injecting window.nostr...');
    injectWindowNostr(signer);
    setIsInjected(true);

    // Cleanup: remove window.nostr when component unmounts or signer changes
    return () => {
      console.log('[useWindowNostrJWT] Cleaning up window.nostr...');
      removeWindowNostr();
      setIsInjected(false);
    };
  }, [signer, autoInject]);

  // Manual injection function
  const inject = () => {
    if (!signer) {
      console.warn('[useWindowNostrJWT] Cannot inject: no signer available');
      return;
    }

    injectWindowNostr(signer);
    setIsInjected(true);
  };

  // Manual removal function
  const remove = () => {
    removeWindowNostr();
    setIsInjected(false);
  };

  // Update token function
  const updateToken = (newToken: string) => {
    if (signerRef.current) {
      console.log('[useWindowNostrJWT] Updating signer token...');
      signerRef.current.updateToken(newToken);
      lastToken.current = newToken;
    }
  };

  return {
    signer,
    isInitializing,
    error,
    isInjected,
    inject,
    remove,
    updateToken,
  };
}

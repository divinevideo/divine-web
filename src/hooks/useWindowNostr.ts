// ABOUTME: React hook for managing window.nostr injection from a remote bunker signer
// ABOUTME: Automatically injects/removes window.nostr based on bunker connection state

import { useEffect, useRef, useState } from 'react';
import type { NostrSigner } from '@nostrify/nostrify';
import {
  createWindowNostrFromBunker,
  injectWindowNostr,
  removeWindowNostr,
} from '@/lib/bunkerToWindowNostr';

export interface UseWindowNostrOptions {
  /** Bunker URL to connect to */
  bunkerUrl: string | null;
  /** Enable auto-injection of window.nostr (default: true) */
  autoInject?: boolean;
  /** Timeout for bunker connection in milliseconds (default: 30000) */
  timeout?: number;
}

export interface UseWindowNostrReturn {
  /** The NostrSigner instance, or null if not connected */
  signer: NostrSigner | null;
  /** Whether the signer is currently connecting */
  isConnecting: boolean;
  /** Error that occurred during connection */
  error: Error | null;
  /** Whether window.nostr is currently injected */
  isInjected: boolean;
  /** Manually trigger injection (only needed if autoInject=false) */
  inject: () => void;
  /** Manually remove window.nostr */
  remove: () => void;
}

/**
 * Hook to manage window.nostr injection from a bunker URL
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const bunkerUrl = getSavedBunkerUrl();
 *   const { signer, isConnecting, error, isInjected } = useWindowNostr({
 *     bunkerUrl,
 *     autoInject: true,
 *   });
 *
 *   if (isConnecting) return <div>Connecting to bunker...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (isInjected) return <div>✅ window.nostr is ready!</div>;
 *
 *   return <div>No bunker connection</div>;
 * }
 * ```
 */
export function useWindowNostr(
  options: UseWindowNostrOptions
): UseWindowNostrReturn {
  const { bunkerUrl, autoInject = true, timeout = 30000 } = options;

  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInjected, setIsInjected] = useState(false);

  // Track if we've already attempted connection for this bunker URL
  const lastBunkerUrl = useRef<string | null>(null);
  const connectionAttempted = useRef(false);

  // Create signer from bunker URL
  useEffect(() => {
    if (!bunkerUrl) {
      setSigner(null);
      setError(null);
      setIsConnecting(false);
      lastBunkerUrl.current = null;
      connectionAttempted.current = false;
      return;
    }

    // Don't reconnect if the bunker URL hasn't changed and we already tried
    if (bunkerUrl === lastBunkerUrl.current && connectionAttempted.current) {
      return;
    }

    lastBunkerUrl.current = bunkerUrl;
    connectionAttempted.current = true;

    console.log('[useWindowNostr] Creating signer from bunker URL...');
    setIsConnecting(true);
    setError(null);

    createWindowNostrFromBunker(bunkerUrl, timeout)
      .then((newSigner) => {
        console.log('[useWindowNostr] ✅ Signer created successfully');
        setSigner(newSigner);
        setError(null);
      })
      .catch((err) => {
        console.error('[useWindowNostr] ❌ Failed to create signer:', err);
        setSigner(null);
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [bunkerUrl, timeout]);

  // Auto-inject window.nostr when signer is ready
  useEffect(() => {
    if (!autoInject || !signer) {
      return;
    }

    console.log('[useWindowNostr] Auto-injecting window.nostr...');
    injectWindowNostr(signer);
    setIsInjected(true);

    // Cleanup: remove window.nostr when component unmounts or signer changes
    return () => {
      console.log('[useWindowNostr] Cleaning up window.nostr...');
      removeWindowNostr();
      setIsInjected(false);
    };
  }, [signer, autoInject]);

  // Manual injection function
  const inject = () => {
    if (!signer) {
      console.warn('[useWindowNostr] Cannot inject: no signer available');
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

  return {
    signer,
    isConnecting,
    error,
    isInjected,
    inject,
    remove,
  };
}

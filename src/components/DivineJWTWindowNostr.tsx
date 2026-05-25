// ABOUTME: Component that injects window.nostr using the hosted Divine JWT signer
// ABOUTME: Alternative to bunker-based signing for simpler HTTP-based authentication

import { useEffect } from 'react';
import { useDivineSession } from '@/hooks/useDivineSession';
import { useWindowNostrJWT } from '@/hooks/useWindowNostrJWT';

export interface DivineJWTWindowNostrProps {
  /** Whether to show console logs (default: false) */
  verbose?: boolean;
}

/**
 * Component that automatically injects window.nostr when user has a valid JWT token
 *
 * This provides window.nostr compatibility for existing Nostr libraries without
 * requiring a bunker connection. Signing happens via direct HTTP requests to
 * the hosted Divine login RPC API with JWT Bearer authentication.
 *
 * Place this component in your app root (App.tsx) to enable JWT-based signing:
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <NostrLoginProvider>
 *       <DivineJWTWindowNostr />
 *       <YourAppContent />
 *     </NostrLoginProvider>
 *   );
 * }
 * ```
 */
export function DivineJWTWindowNostr(
  props: DivineJWTWindowNostrProps = {}
): null {
  const { verbose = false } = props;
  const { getValidToken } = useDivineSession();
  const token = getValidToken();

  const { signer, isInitializing, error, isInjected } = useWindowNostrJWT({
    token,
    autoInject: true,
  });

  // Log status changes if verbose
  useEffect(() => {
    if (!verbose) return;

    if (isInitializing) {
      console.log('[DivineJWTWindowNostr] Initializing JWT signer...');
    } else if (error) {
      console.error('[DivineJWTWindowNostr] Error:', error.message);
    } else if (isInjected) {
      console.log('[DivineJWTWindowNostr] ✅ window.nostr injected successfully!');
    } else if (!token) {
      console.log('[DivineJWTWindowNostr] No JWT token available');
    }
  }, [isInitializing, error, isInjected, token, verbose]);

  // Log when signer becomes available
  useEffect(() => {
    if (verbose && signer) {
      signer.getPublicKey().then((pubkey) => {
        console.log('[DivineJWTWindowNostr] Signed in as:', pubkey);
      });
    }
  }, [signer, verbose]);

  return null; // This component doesn't render anything
}

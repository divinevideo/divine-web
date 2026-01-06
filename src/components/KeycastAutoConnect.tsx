// ABOUTME: Automatically restores Keycast login on page load if user has a session
// ABOUTME: Ensures signing works after page refresh by recreating x-keycast login

import { useEffect, useRef } from 'react';
import { useNostrLogin } from '@nostrify/react/login';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { toast } from '@/hooks/useToast';

export function KeycastAutoConnect() {
  const { logins } = useNostrLogin();
  const login = useLoginActions();
  const { getValidToken, getPubkey, clearSession } = useKeycastSession();
  const hasConnected = useRef(false);

  useEffect(() => {
    // Only run once on mount
    if (hasConnected.current) return;

    // Skip if we're on the OAuth callback page - let AuthCallbackPage handle it
    if (window.location.pathname === '/auth/callback' && window.location.search.includes('code=')) {
      console.log('[KeycastAutoConnect] On OAuth callback page, skipping auto-connect');
      hasConnected.current = true;
      return;
    }

    // Check if we already have a login
    if (logins.length > 0) {
      console.log('[KeycastAutoConnect] Already have login, skipping auto-connect');
      hasConnected.current = true;
      return;
    }

    // Get saved JWT token and pubkey
    const token = getValidToken();
    const pubkey = getPubkey();

    // Debug: also check localStorage directly to catch race conditions
    const rawToken = localStorage.getItem('keycast_jwt_token');
    const rawPubkey = localStorage.getItem('keycast_pubkey');
    console.log('[KeycastAutoConnect] Checking credentials:', {
      token: !!token,
      pubkey: !!pubkey,
      rawToken: !!rawToken,
      rawPubkey: !!rawPubkey,
    });

    if (!token || !pubkey) {
      // Double-check localStorage directly in case React state is stale
      if (rawToken && rawPubkey) {
        console.log('[KeycastAutoConnect] React state stale, but localStorage has values - will retry on next render');
        return;
      }
      console.log('[KeycastAutoConnect] No saved session found');
      return;
    }

    console.log('[KeycastAutoConnect] Found saved credentials, restoring login...');
    hasConnected.current = true;

    // Show reconnecting toast
    toast({
      title: 'Reconnecting',
      description: 'Restoring your session...',
    });

    try {
      // Create Keycast login (synchronous - no bunker connection needed)
      login.keycast(pubkey, token);
      console.log('[KeycastAutoConnect] ✅ Login restored successfully');

      toast({
        title: 'Connected!',
        description: 'Your session has been restored.',
      });
    } catch (err) {
      console.error('[KeycastAutoConnect] Failed to restore login:', err);

      // Clear invalid session
      clearSession();

      toast({
        title: 'Session Expired',
        description: 'Please log in again.',
        variant: 'destructive',
      });
    }
  }, [logins, login, getValidToken, getPubkey, clearSession]);

  return null; // This component doesn't render anything
}

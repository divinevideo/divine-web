// ABOUTME: Type declarations for window globals (nostr extension, HubSpot consent, edge-injected data)
// ABOUTME: Allows TypeScript to recognize window.nostr, window._hsp, and window.__DIVINE_FEED__ properties

import type { NostrSigner } from '@nostrify/nostrify';
import type { FunnelcakeResponse, FunnelcakeVideoRaw } from './funnelcake';

declare global {
  interface Window {
    nostr?: NostrSigner;
    zE?: (namespace: string, action: string, ...args: unknown[]) => void;
    _hsp?: Array<[string, ...unknown[]]>;
    /** Feed data injected by the Fastly edge worker to avoid client round-trip */
    __DIVINE_FEED__?: FunnelcakeResponse | FunnelcakeVideoRaw[];
    /** Feed type that was injected (trending, recent, classics) */
    __DIVINE_FEED_TYPE__?: string;
    /** Set by divine-brain simulations before page scripts run, or by stripSignInCode when it removes a sign-in code, to suppress analytics. */
    __DIVINE_ANALYTICS_DISABLED__?: boolean;
    /** Set when /app/callback removed a one-time sign-in code from the address before the app loaded. */
    __DIVINE_SIGNIN_CODE_STRIPPED__?: boolean;
  }
}

export {};

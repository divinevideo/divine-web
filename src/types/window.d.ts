// ABOUTME: Type declarations for window globals (nostr extension, HubSpot consent)
// ABOUTME: Allows TypeScript to recognize window.nostr and window._hsp properties

import type { NostrSigner } from '@nostrify/nostrify';

declare global {
  interface Window {
    nostr?: NostrSigner;
    zE?: (namespace: string, action: string, ...args: unknown[]) => void;
    _hsp?: Array<[string, ...unknown[]]>;
  }
}

export {};

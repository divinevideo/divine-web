// ABOUTME: Centralized relay configuration for the entire application
// ABOUTME: Single source of truth for all relay URLs and their purposes

import {
  REMOTE_RELAY_HINT_CAP,
  admitRelayUrls,
  admitRemoteSuppliedRelays,
} from '@/lib/relayUrlPolicy';

/**
 * Relay configuration with metadata
 */
export interface RelayConfig {
  url: string;
  name: string;
  capabilities?: {
    nip50?: boolean;  // Full-text search support
    nip05?: boolean;  // NIP-05 verification lookups
    nip96?: boolean;  // HTTP file storage
    blossom?: boolean; // Blossom file storage
    funnelcake?: boolean; // Funnelcake REST API support
  };
  purpose?: 'primary' | 'profile' | 'search' | 'backup';
}

/**
 * Primary relay for video content and main application features
 * - Supports NIP-50 search with sort modes (hot, top, rising, controversial)
 * - Primary relay for kind 34236 video events
 */
export const PRIMARY_RELAY: RelayConfig = {
  url: 'wss://relay.divine.video',
  name: 'DVines',
  capabilities: { nip50: true, funnelcake: true },
  purpose: 'primary',
};

/**
 * Relay optimized for user search (NIP-50)
 * - Used for kind 0 (profile) and general NIP-50 search
 */
export const SEARCH_RELAY: RelayConfig = {
  url: 'wss://relay.divine.video',
  name: 'Divine',
  capabilities: { nip50: true, funnelcake: true },
  purpose: 'search',
};

/**
 * Relays queried when resolving a subdomain's NIP-05 via NIP-50.
 * Fanned out in parallel; first profile with a matching NIP-05 wins.
 * Chosen for broad kind 0 / NIP-05 coverage across public infrastructure.
 */
export const NIP05_SEARCH_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
    capabilities: { nip50: true, nip05: true },
    purpose: 'search',
  },
  {
    url: 'wss://relay.damus.io',
    name: 'Damus',
    capabilities: { nip50: true, nip05: true },
    purpose: 'search',
  },
  {
    url: 'wss://purplepag.es',
    name: 'Purple Pages',
    capabilities: { nip50: true, nip05: true },
    purpose: 'search',
  },
];

/**
 * Relays used for profile metadata (kind 0) and contact lists (kind 3)
 * These relays ensure high availability for critical user data
 * - Queried when fetching profiles and contact lists
 * - Published to when updating contact lists or list events
 */
export const PROFILE_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.divine.video',
    name: 'Divine',
    purpose: 'profile',
  },
  {
    url: 'wss://purplepag.es',
    name: 'Purple Pages',
    purpose: 'profile',
  },
  {
    url: 'wss://relay.damus.io',
    name: 'Damus',
    purpose: 'profile',
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
    purpose: 'profile',
  },
];

/**
 * Public metadata relays where other clients can discover account-move pointers.
 * Divine remains included so clients that know the old home can find the new one,
 * but a pointer that reaches only Divine has not been discovered by anyone else,
 * so `pointerPublishTargets` does not count it toward automatic discovery.
 */
export const DISCOVERY_POINTER_RELAYS: readonly RelayConfig[] = PROFILE_RELAYS;

/**
 * Relays available in the UI relay picker
 * Users can switch between these relays for their main content feed
 */
export const PRESET_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.divine.video',
    name: 'DVines',
    capabilities: { nip50: true, funnelcake: true },
  },
  {
    url: 'wss://relay.damus.io',
    name: 'Damus',
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
  },
];

/**
 * Relays used for NIP-58 badge queries (kinds 30009, 8, 10008, 30008)
 * Badge events may not be accepted by all relays, so we query a broad set.
 * Includes Divine relay (once kinds are allowlisted) plus public relays.
 */
export const BADGE_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.divine.video',
    name: 'Divine',
    purpose: 'primary',
  },
  {
    url: 'wss://relay.damus.io',
    name: 'Damus',
    purpose: 'backup',
  },
  {
    url: 'wss://nos.lol',
    name: 'nos.lol',
    purpose: 'backup',
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
    purpose: 'backup',
  },
];

/**
 * Relays used for direct event and address lookups.
 * These are broader than the app's default feed relay so note/list/event pages
 * can still resolve content that only lives on common public relays.
 */
export const EVENT_LOOKUP_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.divine.video',
    name: 'Divine',
    purpose: 'primary',
  },
  {
    url: 'wss://relay.damus.io',
    name: 'Damus',
    purpose: 'backup',
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
    purpose: 'backup',
  },
  {
    url: 'wss://nos.lol',
    name: 'nos.lol',
    purpose: 'backup',
  },
  {
    url: 'wss://purplepag.es',
    name: 'Purple Pages',
    purpose: 'backup',
  },
];

/**
 * Helper: Extract just the URLs from an array of relay configs
 */
export const getRelayUrls = (relays: RelayConfig[]): string[] =>
  relays.map(r => r.url);

function dedupeRelayUrls(urls: Array<string | null | undefined>): string[] {
  return admitRelayUrls(urls.filter((url): url is string => Boolean(url)));
}

function warnRejectedRelayHint(relayUrl: string, reason: string): void {
  console.warn(`[Relay] Rejected remote relay hint "${relayUrl}": ${reason}`);
}

function warnTruncatedRelayHints(droppedCount: number): void {
  console.warn(`[Relay] Truncated remote relay hints by ${droppedCount} entries`);
}

export function getEventLookupRelayUrls(options?: {
  configuredRelayUrls?: string[];
  relayHints?: string[];
  disabledRelayUrls?: string[];
}): string[] {
  const disabledRelays = new Set(options?.disabledRelayUrls ?? []);
  const configuredRelayUrls = (options?.configuredRelayUrls ?? [])
    .filter((url) => !disabledRelays.has(url));
  const relayHints = admitRemoteSuppliedRelays(options?.relayHints ?? [], {
    cap: REMOTE_RELAY_HINT_CAP,
    onRejected: warnRejectedRelayHint,
    onTruncated: warnTruncatedRelayHints,
  }).sort();
  const lookupRelayUrls = getRelayUrls(EVENT_LOOKUP_RELAYS)
    .filter((url) => !disabledRelays.has(url));

  return dedupeRelayUrls([
    ...configuredRelayUrls,
    ...relayHints,
    ...lookupRelayUrls,
  ]);
}

/**
 * Helper: Find a relay config by URL
 */
export const getRelayByUrl = (url: string): RelayConfig | undefined =>
  PRESET_RELAYS.find(r => r.url === url);

/**
 * Helper: Filter relays by purpose
 */
export const getRelaysByPurpose = (purpose: RelayConfig['purpose']): RelayConfig[] =>
  [...PRESET_RELAYS, ...PROFILE_RELAYS].filter(r => r.purpose === purpose);

/**
 * Convert RelayConfig array to legacy { url, name } format
 * Used for backwards compatibility with components expecting this format
 */
export const toLegacyFormat = (relays: RelayConfig[]): { url: string; name: string }[] =>
  relays.map(r => ({ url: r.url, name: r.name }));

/**
 * Divine infrastructure hostnames that support Funnelcake REST API
 */
const DIVINE_FUNNELCAKE_HOSTS = [
  'relay.divine.video',
  'relay.staging.divine.video',
];

const DIVINE_FUNNELCAKE_API_HOSTS: Record<string, string> = {
  'relay.divine.video': 'api.divine.video',
  'relay.staging.divine.video': 'api.staging.divine.video',
};

/**
 * Check if a relay URL supports the Funnelcake REST API
 * Only Divine infrastructure relays have Funnelcake
 */
export function hasFunnelcake(relayUrl: string): boolean {
  try {
    // Convert wss:// to https:// for URL parsing
    const url = new URL(relayUrl.replace('wss://', 'https://').replace('ws://', 'http://'));
    return DIVINE_FUNNELCAKE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Get the Funnelcake REST API base URL for a relay
 * Returns null if the relay doesn't support Funnelcake
 */
export function getFunnelcakeUrl(relayUrl: string): string | null {
  if (!hasFunnelcake(relayUrl)) {
    return null;
  }
  const parsed = new URL(relayUrl.replace('wss://', 'https://').replace('ws://', 'http://'));
  const apiHost = DIVINE_FUNNELCAKE_API_HOSTS[parsed.hostname];

  if (!apiHost) {
    return null;
  }

  return `https://${apiHost}`;
}

/**
 * Default Funnelcake API URL — Fastly-cached edge endpoint
 * Used for classic vines which always query Divine regardless of selected relay
 */
export const DEFAULT_FUNNELCAKE_URL = 'https://api.divine.video';

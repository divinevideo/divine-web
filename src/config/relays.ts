// ABOUTME: Centralized relay configuration for the entire application
// ABOUTME: Single source of truth for all relay URLs and their purposes

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
  name: 'Rewind',
  capabilities: { nip50: true },
  purpose: 'primary',
};

/**
 * Relay optimized for user search (NIP-50)
 * - Large index of kind 0 (profile) events
 * - Used exclusively for user search functionality
 */
export const SEARCH_RELAY: RelayConfig = {
  url: 'wss://relay.nostr.band',
  name: 'Nostr.Band',
  capabilities: { nip50: true },
  purpose: 'search',
};

/**
 * Relays used for profile metadata (kind 0) and contact lists (kind 3)
 * These relays ensure high availability for critical user data
 * - Queried when fetching profiles and contact lists
 * - Published to when updating contact lists or list events
 */
export const PROFILE_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.divine.video',
    name: 'Rewind',
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
    url: 'wss://relay.ditto.pub',
    name: 'Ditto',
    purpose: 'profile',
  },
  {
    url: 'wss://relay.primal.net',
    name: 'Primal',
    purpose: 'profile',
  },
];

/**
 * Relays available in the UI relay picker
 * Users can switch between these relays for their main content feed
 */
export const PRESET_RELAYS: RelayConfig[] = [
  {
    url: 'wss://relay.divine.video',
    name: 'Rewind',
  },
  {
    url: 'wss://nyc.dvines.org',
    name: 'NYC Rewind',
  },
  {
    url: 'wss://divine.diy',
    name: 'rewind.diy',
  },
  {
    url: 'wss://relay.ditto.pub',
    name: 'Ditto',
  },
  {
    url: 'wss://relay.nostr.band',
    name: 'Nostr.Band',
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
 * Helper: Extract just the URLs from an array of relay configs
 */
export const getRelayUrls = (relays: RelayConfig[]): string[] =>
  relays.map(r => r.url);

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

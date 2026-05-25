// ABOUTME: Relay capability detection for NIP-50 and video-specific sort support
// ABOUTME: Uses NIP-11 metadata plus a lightweight WebSocket probe to avoid lossy feed fallbacks

import type { SortMode } from '@/types/nostr';
import { VIDEO_KINDS } from '@/types/video';

type CapabilitySource = 'optimistic' | 'nip11' | 'probe' | 'fallback';

interface RelayInformationDocument {
  supported_nips?: number[];
  software?: string;
}

export interface RelayCapabilities {
  url: string;
  supportsNIP50: boolean;
  supportsSearch: boolean;
  supportsVideoSorts: boolean;
  supportsCategoryFeed: boolean;
  supportedSortModes: SortMode[];
  detectedAt: number;
  source: CapabilitySource;
  error?: string;
}

const VIDEO_SORT_MODES: SortMode[] = ['hot', 'top', 'rising', 'controversial'];

// Cache relay capabilities (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;
const capabilitiesCache = new Map<string, RelayCapabilities>();

function normalizeRelayUrl(relayUrl: string): URL | null {
  try {
    if (relayUrl.startsWith('ws://') || relayUrl.startsWith('wss://')) {
      return new URL(relayUrl.replace(/^ws/, 'http'));
    }
    return new URL(relayUrl);
  } catch {
    return null;
  }
}

function getRelayHostname(relayUrl: string): string | null {
  return normalizeRelayUrl(relayUrl)?.hostname ?? null;
}

function createCapabilities(
  relayUrl: string,
  overrides: Partial<RelayCapabilities>
): RelayCapabilities {
  return {
    url: relayUrl,
    supportsNIP50: false,
    supportsSearch: false,
    supportsVideoSorts: false,
    supportsCategoryFeed: false,
    supportedSortModes: [],
    detectedAt: Date.now(),
    source: 'fallback',
    ...overrides,
  };
}

export function getOptimisticRelayCapabilities(relayUrl: string): RelayCapabilities {
  const hostname = getRelayHostname(relayUrl);

  switch (hostname) {
    case 'relay.divine.video':
      return createCapabilities(relayUrl, {
        supportsNIP50: true,
        supportsSearch: true,
        supportsVideoSorts: true,
        supportedSortModes: VIDEO_SORT_MODES,
        source: 'optimistic',
      });

    case 'relay.ditto.pub':
    case 'relay.nostr.wine':
    case 'relay.openvine.co':
    case 'relay2.openvine.co':
    case 'relay3.openvine.co':
      return createCapabilities(relayUrl, {
        supportsNIP50: true,
        supportsSearch: true,
        supportsVideoSorts: false,
        supportedSortModes: [],
        source: 'optimistic',
      });

    default:
      return createCapabilities(relayUrl, {
        source: 'optimistic',
      });
  }
}

async function fetchRelayInformation(relayUrl: string): Promise<RelayInformationDocument | null> {
  const metadataUrl = normalizeRelayUrl(relayUrl);
  if (!metadataUrl) {
    return null;
  }

  try {
    const response = await fetch(metadataUrl.toString(), {
      headers: {
        Accept: 'application/nostr+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json() as RelayInformationDocument;
  } catch {
    return null;
  }
}

async function probeVideoSortSupport(relayUrl: string): Promise<boolean> {
  if (typeof WebSocket === 'undefined') {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    const socket = new WebSocket(relayUrl);
    const subId = `video-sort-probe-${Math.random().toString(36).slice(2)}`;
    let settled = false;

    const cleanup = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      try {
        socket.close();
      } catch {
        // Ignore close failures during capability probing.
      }
      resolve(result);
    };

    const timeoutId = globalThis.setTimeout(() => cleanup(false), 4000);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify([
        'REQ',
        subId,
        {
          kinds: VIDEO_KINDS,
          limit: 1,
          search: 'sort:hot',
        },
      ]));
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      try {
        const message = JSON.parse(event.data);
        if (!Array.isArray(message)) {
          return;
        }

        if (message[0] === 'EVENT' && message[1] === subId) {
          cleanup(true);
          return;
        }

        if (message[0] === 'EOSE' && message[1] === subId) {
          cleanup(false);
        }
      } catch {
        cleanup(false);
      }
    });

    socket.addEventListener('error', () => cleanup(false));
    socket.addEventListener('close', () => cleanup(false));
  });
}

/**
 * Detect relay capabilities
 */
export async function detectRelayCapabilities(relayUrl: string): Promise<RelayCapabilities> {
  const cached = getRelayCapabilities(relayUrl);
  if (cached) {
    return cached;
  }

  const optimistic = getOptimisticRelayCapabilities(relayUrl);

  try {
    const relayInformation = await fetchRelayInformation(relayUrl);
    let supportsNIP50 = relayInformation?.supported_nips?.includes(50) ?? optimistic.supportsNIP50;
    let supportsVideoSorts = optimistic.supportsVideoSorts;
    let source: CapabilitySource = relayInformation ? 'nip11' : optimistic.source;

    if (!supportsNIP50 && !relayInformation) {
      supportsVideoSorts = await probeVideoSortSupport(relayUrl);
      if (supportsVideoSorts) {
        supportsNIP50 = true;
        source = 'probe';
      }
    } else if (supportsNIP50 && !optimistic.supportsVideoSorts) {
      supportsVideoSorts = await probeVideoSortSupport(relayUrl);
      source = 'probe';
    }

    const capabilities = createCapabilities(relayUrl, {
      supportsNIP50,
      supportsSearch: supportsNIP50,
      supportsVideoSorts,
      supportedSortModes: supportsVideoSorts ? VIDEO_SORT_MODES : [],
      source,
    });

    capabilitiesCache.set(relayUrl, capabilities);
    return capabilities;
  } catch (error) {
    const fallbackCapabilities = createCapabilities(relayUrl, {
      ...optimistic,
      detectedAt: Date.now(),
      source: 'fallback',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    capabilitiesCache.set(relayUrl, fallbackCapabilities);
    return fallbackCapabilities;
  }
}

/**
 * Get cached capabilities or detect them
 */
export function getRelayCapabilities(relayUrl: string): RelayCapabilities | null {
  const cached = capabilitiesCache.get(relayUrl);
  if (cached && Date.now() - cached.detectedAt < CACHE_DURATION) {
    return cached;
  }
  return null;
}

/**
 * Clear capabilities cache (useful for testing or relay changes)
 */
export function clearCapabilitiesCache(relayUrl?: string) {
  if (relayUrl) {
    capabilitiesCache.delete(relayUrl);
  } else {
    capabilitiesCache.clear();
  }
}

/**
 * Hook-compatible capability checker
 */
export function shouldUseNIP50(relayUrl: string): boolean {
  const capabilities = getRelayCapabilities(relayUrl) ?? getOptimisticRelayCapabilities(relayUrl);
  return capabilities.supportsNIP50;
}

/**
 * Determine whether a relay can sort video events using NIP-50 search directives.
 */
export function shouldUseVideoSorts(relayUrl: string): boolean {
  const capabilities = getRelayCapabilities(relayUrl) ?? getOptimisticRelayCapabilities(relayUrl);
  return capabilities.supportsVideoSorts;
}

/**
 * Get effective sort mode based on relay capabilities
 * Returns undefined if relay doesn't support video sorting for the requested mode.
 */
export function getEffectiveSortMode(
  relayUrl: string,
  requestedMode: SortMode
): SortMode | undefined {
  const capabilities = getRelayCapabilities(relayUrl) ?? getOptimisticRelayCapabilities(relayUrl);

  if (!capabilities.supportsVideoSorts) {
    return undefined;
  }

  if (capabilities.supportedSortModes.includes(requestedMode)) {
    return requestedMode;
  }

  return capabilities.supportedSortModes.includes('hot') ? 'hot' : undefined;
}

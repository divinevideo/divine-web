// ABOUTME: React hook for detecting and using relay capabilities
// ABOUTME: Exposes NIP-50 and video-sort support for capability-driven feed selection

import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import {
  detectRelayCapabilities,
  getEffectiveSortMode,
  getOptimisticRelayCapabilities,
  shouldUseNIP50,
  shouldUseVideoSorts,
  type RelayCapabilities,
} from '@/lib/relayCapabilities';
import type { SortMode } from '@/types/nostr';

/**
 * Hook to detect relay capabilities
 */
export function useRelayCapabilities(relayUrl?: string) {
  const { config } = useAppContext();
  const effectiveRelayUrl = relayUrl || config.relayUrl;

  return useQuery<RelayCapabilities>({
    queryKey: ['relay-capabilities', effectiveRelayUrl],
    queryFn: () => detectRelayCapabilities(effectiveRelayUrl),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}

/**
 * Hook to check if current relay supports NIP-50
 */
export function useNIP50Support(relayUrl?: string): boolean {
  const { config } = useAppContext();
  const effectiveRelayUrl = relayUrl || config.relayUrl;
  const { data } = useRelayCapabilities(effectiveRelayUrl);

  return data?.supportsNIP50 ?? shouldUseNIP50(effectiveRelayUrl);
}

/**
 * Hook to check if current relay supports video sorting for kind 34236 feeds.
 */
export function useVideoSortSupport(relayUrl?: string): boolean {
  const { config } = useAppContext();
  const effectiveRelayUrl = relayUrl || config.relayUrl;
  const { data } = useRelayCapabilities(effectiveRelayUrl);

  return data?.supportsVideoSorts ?? shouldUseVideoSorts(effectiveRelayUrl);
}

/**
 * Hook to access relay capabilities with optimistic defaults while detection is in flight.
 */
export function useResolvedRelayCapabilities(relayUrl?: string): RelayCapabilities {
  const { config } = useAppContext();
  const effectiveRelayUrl = relayUrl || config.relayUrl;
  const { data } = useRelayCapabilities(effectiveRelayUrl);

  return data ?? getOptimisticRelayCapabilities(effectiveRelayUrl);
}

/**
 * Hook to get effective sort mode with fallback
 */
export function useEffectiveSortMode(
  requestedMode: SortMode,
  relayUrl?: string
): SortMode | undefined {
  const { config } = useAppContext();
  const effectiveRelayUrl = relayUrl || config.relayUrl;
  const supportsVideoSorts = useVideoSortSupport(effectiveRelayUrl);

  if (!supportsVideoSorts) {
    return undefined;
  }

  return getEffectiveSortMode(effectiveRelayUrl, requestedMode) || requestedMode;
}

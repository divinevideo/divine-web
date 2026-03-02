// ABOUTME: Resolves the correct pubkey for a subdomain when the KV store mapping is stale
// ABOUTME: Searches relay.nostr.band via NIP-50 to find the profile whose NIP-05 matches the subdomain

import { useQuery } from '@tanstack/react-query';
import { NRelay1 } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { getSubdomainUser } from '@/hooks/useSubdomainUser';
import { SEARCH_RELAY } from '@/config/relays';

interface ResolvedPubkey {
  /** The pubkey to use (either resolved or original fallback) */
  pubkey: string;
  /** The npub to use */
  npub: string;
  /** Whether we resolved to a different pubkey than the KV store had */
  isResolved: boolean;
  /** Whether the search is still in progress */
  isSearching: boolean;
}

/**
 * Check if a NIP-05 matches the expected subdomain pattern.
 * Matches: _@{subdomain}.{apex} or {subdomain}@{apex}
 */
export function isNip05MatchForSubdomain(nip05: string, subdomain: string, apexDomain: string): boolean {
  if (!nip05 || !subdomain || !apexDomain) return false;
  const lower = nip05.toLowerCase();
  const subLower = subdomain.toLowerCase();
  return lower === `_@${subLower}.${apexDomain}` || lower === `${subLower}@${apexDomain}`;
}

/**
 * Search for the correct pubkey when the subdomain's KV mapping is stale.
 * Connects to relay.nostr.band, does a NIP-50 search for profiles mentioning
 * the subdomain, and finds the one whose NIP-05 matches.
 */
async function searchForCorrectPubkey(subdomain: string, apexDomain: string): Promise<string | null> {
  const searchTerm = `${subdomain}.${apexDomain}`;
  let relay: NRelay1 | null = null;

  try {
    relay = new NRelay1(SEARCH_RELAY.url);

    const events = await relay.query(
      [{ kinds: [0], search: searchTerm, limit: 20 }],
      { signal: AbortSignal.timeout(10000) },
    );

    for (const event of events) {
      try {
        const metadata = JSON.parse(event.content);
        if (metadata.nip05 && isNip05MatchForSubdomain(metadata.nip05, subdomain, apexDomain)) {
          console.log(`[useResolveSubdomainPubkey] Found correct pubkey: ${event.pubkey} via NIP-05: ${metadata.nip05}`);
          return event.pubkey;
        }
      } catch {
        // Skip events with invalid JSON content
      }
    }

    console.log(`[useResolveSubdomainPubkey] No matching NIP-05 found for ${searchTerm}`);
    return null;
  } catch (err) {
    console.error('[useResolveSubdomainPubkey] Search failed:', err);
    return null;
  } finally {
    try {
      relay?.close();
    } catch {
      // Ignore close errors
    }
  }
}

/**
 * Hook to resolve the correct pubkey for a subdomain profile when the
 * edge worker detects a NIP-05 mismatch (stale KV store mapping).
 *
 * When nip05Stale is false, returns the original pubkey immediately with no relay queries.
 * When nip05Stale is true, searches relay.nostr.band for the profile whose NIP-05
 * matches this subdomain, and returns the resolved pubkey.
 */
export function useResolveSubdomainPubkey(): ResolvedPubkey {
  const subdomainUser = getSubdomainUser();
  const isStale = subdomainUser?.nip05Stale === true;
  const subdomain = subdomainUser?.subdomain ?? '';
  const apexDomain = subdomainUser?.apexDomain ?? '';
  const originalPubkey = subdomainUser?.pubkey ?? '';
  const originalNpub = subdomainUser?.npub ?? '';

  const { data: resolvedPubkey, isLoading } = useQuery({
    queryKey: ['resolve-subdomain-pubkey', subdomain, apexDomain],
    queryFn: () => searchForCorrectPubkey(subdomain, apexDomain),
    enabled: isStale && !!subdomain && !!apexDomain,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Not on a subdomain or not stale - return original
  if (!subdomainUser || !isStale) {
    return {
      pubkey: originalPubkey,
      npub: originalNpub,
      isResolved: false,
      isSearching: false,
    };
  }

  // Still searching
  if (isLoading) {
    return {
      pubkey: originalPubkey,
      npub: originalNpub,
      isResolved: false,
      isSearching: true,
    };
  }

  // Search completed - use resolved pubkey if found, otherwise fall back
  if (resolvedPubkey) {
    return {
      pubkey: resolvedPubkey,
      npub: nip19.npubEncode(resolvedPubkey),
      isResolved: true,
      isSearching: false,
    };
  }

  // Search completed but no match found - fall back to original
  return {
    pubkey: originalPubkey,
    npub: originalNpub,
    isResolved: false,
    isSearching: false,
  };
}

// ABOUTME: Divine REST Gateway client for fast cached queries
// ABOUTME: Provides HTTP-based access to relay.divine.video data

import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { debugLog, debugError } from './debug';

const GATEWAY_URL = 'https://gateway.divine.video';
const GATEWAY_TIMEOUT_MS = 30000;

/**
 * Check if a relay URL should use the gateway
 */
export function shouldUseGateway(relayUrl: string): boolean {
  try {
    const url = new URL(relayUrl);
    return url.hostname === 'relay.divine.video';
  } catch {
    return false;
  }
}

/**
 * Encode a Nostr filter to base64url format for gateway API
 */
export function encodeFilter(filter: NostrFilter): string {
  const json = JSON.stringify(filter);
  const base64 = btoa(json);
  // Convert to base64url: replace + with -, / with _, remove =
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

interface GatewayResponse {
  events: NostrEvent[];
  cached: boolean;
  cache_age_seconds?: number;
}

/**
 * Query the gateway REST API
 * Returns events or throws on error
 */
export async function queryGateway(
  filter: NostrFilter,
  signal?: AbortSignal
): Promise<NostrEvent[]> {
  const encoded = encodeFilter(filter);
  const url = `${GATEWAY_URL}/query?filter=${encoded}`;

  debugLog('[GatewayClient] Querying:', url);

  const timeoutSignal = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const response = await fetch(url, { signal: combinedSignal });

  if (!response.ok) {
    throw new Error(`Gateway error: ${response.status} ${response.statusText}`);
  }

  const data: GatewayResponse = await response.json();

  debugLog(`[GatewayClient] Got ${data.events.length} events (cached: ${data.cached}, age: ${data.cache_age_seconds}s)`);

  return data.events;
}

/**
 * Fetch a single event by ID from gateway
 */
export async function getEventFromGateway(
  eventId: string,
  signal?: AbortSignal
): Promise<NostrEvent | null> {
  const url = `${GATEWAY_URL}/event/${eventId}`;

  debugLog('[GatewayClient] Fetching event:', eventId);

  const timeoutSignal = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(url, { signal: combinedSignal });
    if (!response.ok) return null;

    const data: GatewayResponse = await response.json();
    return data.events[0] || null;
  } catch (err) {
    debugError('[GatewayClient] Failed to fetch event:', err);
    return null;
  }
}

/**
 * Fetch a profile by pubkey from gateway
 */
export async function getProfileFromGateway(
  pubkey: string,
  signal?: AbortSignal
): Promise<NostrEvent | null> {
  const url = `${GATEWAY_URL}/profile/${pubkey}`;

  // Don't log individual profile fetches - too noisy in batch operations

  const timeoutSignal = AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(url, { signal: combinedSignal });
    if (!response.ok) return null;

    const data: GatewayResponse = await response.json();
    return data.events[0] || null;
  } catch {
    // Don't log individual failures - too noisy in batch operations
    return null;
  }
}

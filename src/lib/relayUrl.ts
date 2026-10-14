// ABOUTME: Helpers for validating relay URLs by scheme
// ABOUTME: Uses the URL constructor instead of regex for correctness

import { isRelayUrlAllowed } from '@/lib/relayUrlPolicy';

export function isWssUrl(value: string): boolean {
  return isRelayUrlAllowed(value) && new URL(value.trim()).protocol === 'wss:';
}

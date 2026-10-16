// ABOUTME: Synthetic Nostr secret key for tests of search input handling
// ABOUTME: Derived from a fixed all-ones key so no real key is ever committed

import { nip19 } from 'nostr-tools';

export const SYNTHETIC_NSEC = nip19.nsecEncode(new Uint8Array(32).fill(1));

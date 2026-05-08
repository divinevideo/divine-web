// Sim-suppression hook for relay routing. Reads
// `localStorage.DIVINE_RELAY_OVERRIDE` (set by divine-brain's
// virtual-persona PR runner via Stagehand `page.addInitScript` before
// navigation) and uses it instead of the production relay URL when set.
//
// In production no override is ever set, so resolveRelayUrl returns
// the default unchanged. In sim sessions the override points at
// `wss://relay.staging.divine.video` so simulated personas never
// touch the production relay.
//
// Empirical motivation: divine-brain/sim/experiments/smoke-one-persona.ts
// against divine.video on 2026-05-08 showed 9+ WS connections to
// `wss://relay.divine.video` despite the override being set in
// localStorage (no production code was reading it yet). This module
// is the read.

const STORAGE_KEY = 'DIVINE_RELAY_OVERRIDE';

/**
 * Returns the override relay URL when the sim flag is set, otherwise
 * the supplied default. The override must be a `wss://` URL — anything
 * else is ignored as a defensive measure (a sim that mis-set the flag
 * shouldn't be able to redirect production users to an attacker URL).
 */
export function resolveRelayUrl(defaultUrl: string): string {
  if (typeof window === 'undefined') return defaultUrl;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && /^wss:\/\//.test(v)) return v;
  } catch {
    // localStorage may be blocked (private mode, sandbox, etc.) — fall through.
  }
  return defaultUrl;
}

/**
 * Same as resolveRelayUrl but maps each entry of an array. Used where
 * the app keeps a relay set rather than a single URL.
 */
export function resolveRelayUrls(defaults: string[]): string[] {
  if (typeof window === 'undefined') return defaults;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && /^wss:\/\//.test(v)) {
      // Replace the production relay everywhere it appears in the
      // default set; preserve any others. This keeps preset relays
      // (search relays, profile relays) intact while routing the
      // primary write/read traffic to staging.
      return defaults.map((d) =>
        /\brelay\.divine\.video\b/i.test(d) && !/\bstaging\b/.test(d) ? v : d,
      );
    }
  } catch {
    // see above
  }
  return defaults;
}

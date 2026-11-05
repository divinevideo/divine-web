/**
 * NIP-40 expiration + the NIP-17 timer tag — the slice of the client's
 * `@/lib/nip17/protocol` that the Chat Plane fold needs (CORD-08).
 *
 * Vendored rather than synced: upstream's module is the whole DM stack
 * (sealing, wrapping, relay lists, a signer surface), and chat.ts uses exactly
 * these three functions. Copied verbatim so the fold agrees with the client on
 * what counts as expired.
 */

/**
 * The NIP-40 deadline (unix seconds) carried by these tags, or undefined when
 * there is none. A malformed / non-finite value is treated as absent rather
 * than as "expired": a garbage tag must not be able to hide a message.
 */
export function expirationOf(tags: readonly string[][]): number | undefined {
  const raw = tags.find(([name]) => name === "expiration")?.[1];
  if (raw === undefined) return undefined;
  const secs = Number(raw);
  return Number.isFinite(secs) ? secs : undefined;
}

/** Whether these tags carry a NIP-40 deadline that has already passed. */
export function isExpired(tags: readonly string[][], nowSecs = Math.floor(Date.now() / 1000)): boolean {
  const at = expirationOf(tags);
  return at !== undefined && at <= nowSecs;
}

/**
 * The disappearing-messages timer (seconds) a rumor declares, or undefined
 * when the tag is absent or unreadable. Zero means "off".
 */
export function dmTimerSeconds(rumor: { tags: readonly string[][] }): number | undefined {
  const raw = rumor.tags.find(([name]) => name === "timer")?.[1];
  if (raw === undefined) return undefined;
  const secs = Number(raw);
  return Number.isFinite(secs) && secs >= 0 ? Math.floor(secs) : undefined;
}

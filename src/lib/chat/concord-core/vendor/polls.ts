/**
 * NIP-88 poll vote shape, extracted from armada `src/lib/polls.ts` (the one
 * type the Chat Plane fold needs).
 *
 * `foldChat` buckets raw votes by their poll's rumor id and leaves them
 * untallied — tallying needs the poll's declared options and `endsAt`, which
 * only the client that renders it has. The bridge folds past them; the type
 * exists so that pass-through is typed rather than `unknown`.
 */

/** A single voter's choice, normalized away from the underlying event shape. */
export interface PollVote {
  pubkey: string;
  /** Selected option ids (filtered against the poll's valid ids by the tally). */
  optionIds: string[];
  /** Ordering timestamp in epoch milliseconds — latest vote per pubkey wins. */
  ms: number;
}

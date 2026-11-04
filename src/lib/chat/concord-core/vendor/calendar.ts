/**
 * NIP-52 calendar RSVP shape, extracted from armada `src/lib/calendar.ts` (the
 * one type the Chat Plane fold needs; see `./polls` for the same reasoning).
 */

/** NIP-52 RSVP statuses. */
export type RsvpStatus = "accepted" | "declined" | "tentative";

/** A single member's RSVP, normalized off the underlying event/rumor shape. */
export interface RsvpVote {
  pubkey: string;
  status: RsvpStatus;
  /** Ordering timestamp in epoch milliseconds — latest per pubkey wins. */
  ms: number;
}

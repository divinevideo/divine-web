/**
 * NIP-25 reaction key normalization, extracted from armada
 * `src/hooks/useReactions.ts` (the pure part only).
 */

/** Normalize reaction content: `+`/empty is 👍, `-` is 👎, else verbatim. */
export function reactionContentKey(content: string): string {
  if (content === "+" || content === "") return "👍";
  if (content === "-") return "👎";
  return content;
}

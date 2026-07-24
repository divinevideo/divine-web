// ABOUTME: Build-time flag selecting which web experience ships
// ABOUTME: 'showcase' = docs + downloads + curated reel; 'full' = the legacy Nostr client

/**
 * Which experience divine.video serves.
 *
 * - `showcase` (default): documents, app download links, and a hand-curated
 *   all-ages video reel. No login, no open feeds, no profile/search/hashtag routes.
 * - `full`: the legacy client — login, feeds, profiles, messages, everything.
 *
 * The legacy client is kept behind this flag rather than deleted so the indexed
 * content surface can be retired deliberately, in a separate step, once we're
 * confident in the showcase experience.
 */
export type WebMode = 'showcase' | 'full';

export const WEB_MODE: WebMode =
  import.meta.env.VITE_WEB_MODE === 'full' ? 'full' : 'showcase';

export function isShowcaseMode(): boolean {
  return WEB_MODE === 'showcase';
}

// ABOUTME: Edge-side mirror of the frontend VITE_WEB_MODE flag
// ABOUTME: Decides whether the worker may inject uncurated feed data into pages

/**
 * Which experience the site serves. MUST stay in sync with `VITE_WEB_MODE`
 * in `src/config/webMode.ts`.
 *
 * The worker has no access to Vite's env, and both are deployed together from
 * this repo (`npm run fastly:deploy && npm run fastly:publish`), so a checked-in
 * constant is the sync mechanism. If you flip one, flip the other in the same
 * commit — a mismatch means the edge injects trending videos into a page whose
 * whole purpose is that its content is curated.
 *
 * @type {'showcase' | 'full'}
 */
export const WEB_MODE = 'showcase';

export function isShowcaseMode() {
  return WEB_MODE === 'showcase';
}

// ABOUTME: Path matching, asset marker, and header policy for the /embed profile widget.
// ABOUTME: Split out of index.js so the rules are testable without the Fastly runtime.

/** The static asset the clean `/embed` URL rewrites to. */
export const EMBED_WIDGET_ASSET = '/embed.html';

/**
 * A string that appears in the widget and cannot appear in the SPA shell.
 *
 * The static publisher answers a missing asset with the SPA shell at HTTP 200,
 * so the worker has no other way to tell "served the widget" from "served the
 * 404 page". `tests/embed-route-parity.test.ts` pins this against the real file.
 */
export const EMBED_WIDGET_MARKER = 'embed-viewer.js';

/**
 * True for the bare widget path only.
 *
 * `/embed/:id` is the oEmbed video player, handled earlier in the worker; it
 * must never match here.
 */
export function isEmbedWidgetPath(pathname) {
  return pathname === '/embed' || pathname === '/embed/';
}

/**
 * Applies the widget's framing and caching policy, mirroring what
 * `public/_headers` gives the Cloudflare deploy.
 *
 * The shell is static — the viewer script fetches live data over its own relay
 * connections — so it is cacheable, unlike the app HTML that
 * `applyStaticResponseHeaders` marks `no-store`.
 */
export function applyEmbedWidgetHeaders(headers) {
  headers.set('Content-Security-Policy', 'frame-ancestors *');
  headers.set('Cache-Control', 'public, max-age=1800');
  headers.set('Surrogate-Control', 'max-age=1800');
  return headers;
}

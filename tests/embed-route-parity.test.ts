// ABOUTME: Guards that the embed URL handed to users resolves on every deploy target
// ABOUTME: GetEmbedPage, public/_redirects, and the Fastly worker must agree on one path

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * The embed widget lives at `public/embed.html`, but users are given the clean
 * `/embed` URL. Three places have to agree on that mapping, one per surface:
 *
 *   1. `GetEmbedPage.tsx`        — generates the iframe users paste
 *   2. `public/_redirects`       — rewrites it on Cloudflare Pages
 *   3. `compute-js/src/index.js` — rewrites it on Fastly (production)
 *
 * Only the first two existed, so the widget resolved on preview deploys and
 * fell through to the SPA shell on production, where `embed` matched the
 * `/:nip19` route and rendered the 404 page inside the subscriber's iframe.
 * Nothing failed loudly: the SPA returns HTTP 200 for every path.
 */
const GENERATOR = readFileSync('src/pages/GetEmbedPage.tsx', 'utf8');
const REDIRECTS = readFileSync('public/_redirects', 'utf8');
const FASTLY_WORKER = readFileSync('compute-js/src/index.js', 'utf8');

describe('embed route parity', () => {
  it('the generator points users at the clean /embed path', () => {
    expect(GENERATOR).toContain('https://divine.video/embed?');
  });

  it('Cloudflare rewrites /embed to the widget', () => {
    const rule = REDIRECTS.split('\n').find(
      (line) => /^\/embed\s/.test(line.trim()),
    );
    expect(rule, 'public/_redirects has no /embed rule').toBeDefined();
    expect(rule).toContain('/embed.html');
  });

  it('the Fastly worker rewrites /embed to the widget', () => {
    // Fastly serves production and never reads _redirects, so the rewrite has
    // to exist here independently.
    expect(
      FASTLY_WORKER,
      'compute-js must special-case the bare /embed path',
    ).toMatch(/pathname === '\/embed'/);
    expect(FASTLY_WORKER).toContain("new URL('/embed.html'");
  });

  it('keeps the widget framable from third-party origins on both targets', () => {
    // A widget browsers refuse to frame is as broken as a missing route.
    expect(REDIRECTS.includes('/embed') && FASTLY_WORKER.includes('frame-ancestors *')).toBe(true);
    expect(readFileSync('public/_headers', 'utf8')).toContain('frame-ancestors *');
  });

  it('does not collide with the /embed/:id video player', () => {
    // The oEmbed player matches `startsWith('/embed/')`, which requires the
    // trailing slash. If that ever loosens, the widget rewrite would swallow it.
    expect(FASTLY_WORKER).toContain("startsWith('/embed/')");
  });
});

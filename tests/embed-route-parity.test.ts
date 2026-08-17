// ABOUTME: Guards that the embed URL handed to users resolves on every deploy target
// ABOUTME: GetEmbedPage, public/_redirects, and the Fastly worker must agree on one path

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

// @ts-expect-error - plain JS module in the Fastly compute package, no type declarations
import {
  EMBED_WIDGET_ASSET,
  EMBED_WIDGET_MARKER,
  applyEmbedWidgetHeaders,
  isEmbedWidgetPath,
} from '../compute-js/src/embedWidget.js';

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
const HEADERS = readFileSync('public/_headers', 'utf8');
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
    expect(rule).toContain(EMBED_WIDGET_ASSET);
  });

  it('Cloudflare serves the trailing-slash form too', () => {
    // The Fastly worker accepts '/embed/' (see the collision test below), and
    // the widget's assets are root-absolute precisely because this document is
    // served under /embed/ as well. Both deploy targets must describe the same
    // surface: on Cloudflare that takes a rewrite rule and the framing/caching
    // headers, or /embed/ renders the 404-in-an-iframe on preview deploys.
    const rule = REDIRECTS.split('\n').find(
      (line) => /^\/embed\/\s/.test(line.trim()),
    );
    expect(rule, 'public/_redirects has no /embed/ rule').toBeDefined();
    expect(rule).toContain(EMBED_WIDGET_ASSET);
    expect(HEADERS).toMatch(/^\/embed\/$/m);
  });

  it('the Fastly worker rewrites /embed to the widget', () => {
    // Fastly serves production and never reads _redirects, so the rewrite has
    // to exist here independently. Nothing executes this worker before it is
    // deployed, so wiring is all a test can check from here.
    expect(
      FASTLY_WORKER,
      'compute-js must route the bare /embed path through isEmbedWidgetPath',
    ).toContain('isEmbedWidgetPath(url.pathname)');
    expect(FASTLY_WORKER).toContain("from './embedWidget.js'");
  });

  it('the rewrite target actually ships', () => {
    // Every assertion above checks that three files agree on a path. None of
    // them notices if the file that path points at stops existing, which
    // silently returns production to the SPA-shell-in-an-iframe bug.
    const widget = readFileSync(`public${EMBED_WIDGET_ASSET}`, 'utf8');
    expect(widget).toContain('<title>Divine Video Widget</title>');
  });

  it('loads its own assets from the site root, not relative to the request path', () => {
    // The same document is served at three URLs — /embed.html, /embed and
    // /embed/ — so a relative href resolves differently depending on which one
    // the subscriber pasted. Under /embed/ it resolves to /embed/<asset>, and
    // every path below /embed/ belongs to the oEmbed video player, which
    // answers 404 for anything that is not a video id. The widget would render
    // an unstyled, scriptless "Loading..." and the 30-minute Cache-Control
    // below would keep it that way.
    const widget = readFileSync(`public${EMBED_WIDGET_ASSET}`, 'utf8');
    const refs = [...widget.matchAll(/(?:href|src)="([^"]*)"/g)].map((match) => match[1]);
    const sameOrigin = refs.filter((ref) => !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(ref));

    expect(sameOrigin.length).toBeGreaterThan(0);
    for (const ref of sameOrigin) {
      expect(ref, `"${ref}" must start with / or it breaks when /embed/ serves this file`)
        .toMatch(/^\//);
    }
  });

  it('the widget carries the marker the worker verifies it by', () => {
    // The worker cannot distinguish the widget from the SPA fallback by status
    // or content type — both are HTML at 200 — so it greps for this string. If
    // the script is ever renamed, the worker starts rejecting the real widget.
    expect(readFileSync(`public${EMBED_WIDGET_ASSET}`, 'utf8')).toContain(EMBED_WIDGET_MARKER);
  });

  it('keeps the widget framable from third-party origins on both targets', () => {
    // A widget browsers refuse to frame is as broken as a missing route.
    expect(HEADERS).toContain('frame-ancestors *');
    expect(applyEmbedWidgetHeaders(new Headers()).get('Content-Security-Policy'))
      .toBe('frame-ancestors *');
  });

  it('caches the widget shell instead of inheriting no-store from app HTML', () => {
    // The shell is static; the viewer script fetches live data over its own
    // relay connections. public/_headers asks for the same 30 minutes.
    const headers = applyEmbedWidgetHeaders(new Headers({ 'Cache-Control': 'no-store' }));
    expect(headers.get('Cache-Control')).toBe('public, max-age=1800');
    expect(headers.get('Surrogate-Control')).toBe('max-age=1800');
    expect(HEADERS).toContain('max-age=1800');
  });

  it('does not collide with the /embed/:id video player', () => {
    // The oEmbed player owns every path below /embed/. The widget owns the bare
    // path and nothing else.
    expect(isEmbedWidgetPath('/embed')).toBe(true);
    expect(isEmbedWidgetPath('/embed/')).toBe(true);
    expect(isEmbedWidgetPath('/embed/abc123')).toBe(false);
    expect(isEmbedWidgetPath('/embedded')).toBe(false);
    expect(isEmbedWidgetPath('/')).toBe(false);
  });
});

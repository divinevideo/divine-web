// ABOUTME: Fastly Compute entry point for divine-web static site
// ABOUTME: Handles www redirects, external redirects, NIP-05 from KV, subdomain profiles, dynamic OG tags, and SPA fallback

/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';
import { KVStore } from 'fastly:kv-store';
import { SecretStore } from 'fastly:secret-store';
import { PublisherServer } from '@fastly/compute-js-static-publish';
import rc from '../static-publish.rc.js';
import { buildFunnelcakeUrl, getFunnelcakeOriginForApiHost } from './funnelcakeOrigin.js';
import { handleAuthPersistCookie } from './authPersistCookie.js';
import { isJsonWellKnownPath, shouldServeWellKnownBeforeWwwRedirect } from './wellKnownPaths.js';
import { buildCrawlerHtml, escapeHtml, cleanText, truncateText } from './ogTags.js';
import { hexToNpub, decodeNpubToHex } from './bech32.js';
import { buildWwwRedirectResponse } from './hostRedirect.js';
import { applyStaticResponseHeaders } from './staticResponseHeaders.js';
import { readPublishedStaticFile } from './staticContent.js';
import {
  handleAtUsernameOg,
  handleHashtagOgTags,
  handleSearchOgTags,
  handleDiscoveryOgTags,
  handleApexOgTags,
} from './crawlerHandlers.js';
import { transformVideoApiResponse } from './videoMetadata.js';
import { renderEmbedPage } from './embedPage.js';
import { renderFeedPage, renderVideoPage, renderProfilePage, renderSearchPage } from './templates/pages.js';

const publisherServer = PublisherServer.fromStaticPublishRc(rc);
const DEFAULT_OG_IMAGE = 'https://divine.video/og.png';
const DEFAULT_SITE_DESCRIPTION = 'Watch and share 6-second looping videos on the decentralized Nostr network.';

// Cached static asset paths (extracted from built index.html)
let _staticAssets = null;

/**
 * Extract JS/CSS asset paths from the built index.html in KV store.
 * Caches the result for the lifetime of the worker instance.
 */
async function getStaticAssets() {
  if (_staticAssets) return _staticAssets;

  try {
    const contentStore = new KVStore('divine-web-content');
    const indexEntry = await contentStore.get('default_index_live');
    if (!indexEntry) return null;

    const kvIndex = JSON.parse(await indexEntry.text());
    const htmlAsset = kvIndex['/index.html'];
    if (!htmlAsset) return null;

    const sha256 = htmlAsset.key.replace('sha256:', '');
    const contentKey = `default_files_sha256_${sha256}`;
    const contentEntry = await contentStore.get(contentKey);
    if (!contentEntry) return null;

    const html = await contentEntry.text();

    // Extract script and CSS paths from the built HTML
    const jsMatch = html.match(/<script[^>]+src="([^"]+\.js)"/);
    const cssMatch = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*rel="stylesheet"/);
    // Also try reversed attribute order
    const cssMatch2 = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/);

    _staticAssets = {
      mainJs: jsMatch?.[1] || '/src/main.tsx',
      mainCss: cssMatch?.[1] || cssMatch2?.[1] || '',
    };

    console.log('Resolved static assets:', _staticAssets);
    return _staticAssets;
  } catch (e) {
    console.error('Failed to resolve static assets:', e.message);
    return null;
  }
}

// Apex domains we serve (used to detect subdomains)
const APEX_DOMAINS = ['dvine.video', 'divine.video'];

// External redirects - always redirect to about.divine.video (Option A)
const EXTERNAL_REDIRECTS = {
  '/press': { url: 'https://about.divine.video/press/', status: 301 },
  '/news': { url: 'https://about.divine.video/news/', status: 301 },
  '/media-resources': { url: 'https://about.divine.video/media-resources/', status: 301 },
  '/news/vine-revisited': { url: 'https://about.divine.video/vine-revisited-a-return-to-the-halcyon-days-of-the-internet/', status: 301 },
  '/discord': { url: 'https://discord.gg/d6HpB6XnHp', status: 302 },
};

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const version = env('FASTLY_SERVICE_VERSION');
  console.log('FASTLY_SERVICE_VERSION', version);

  const request = event.request;
  const url = new URL(request.url);

  // Check for original host passed by divine-router
  const originalHost = request.headers.get('X-Original-Host');
  const forwardedHost = request.headers.get('X-Forwarded-Host');
  const hostnameToUse = originalHost || forwardedHost || url.hostname;
  const funnelcakeTarget = getFunnelcakeOriginForApiHost(hostnameToUse);

  console.log('Request hostname:', url.hostname, 'original:', originalHost, 'path:', url.pathname);

  // App-link verification files must be served directly for every claimed host.
  // Do this before the generic www redirect so iOS/Android and deploy checks get 200 JSON.
  if (shouldServeWellKnownBeforeWwwRedirect(hostnameToUse, url.pathname)) {
    return await serveStaticWellKnownFile(request, url.pathname);
  }

  // 1. Redirect www.* to apex domain (e.g., www.divine.video -> divine.video)
  const wwwRedirect = buildWwwRedirectResponse(url, hostnameToUse);
  if (wwwRedirect) {
    return wwwRedirect;
  }

  // 2. Check if this is a subdomain request (e.g., alice.dvine.video)
  const subdomain = getSubdomain(hostnameToUse);
  
  if (subdomain) {
    // Subdomain .well-known requests
    if (url.pathname.startsWith('/.well-known/')) {
      if (url.pathname === '/.well-known/nostr.json') {
        console.log('Handling subdomain NIP-05 for:', subdomain);
        try {
          return await handleSubdomainNip05(subdomain);
        } catch (err) {
          console.error('Subdomain NIP-05 error:', err.message, err.stack);
          return jsonResponse({ error: 'Handler error' }, 500);
        }
      }
      // Other .well-known files (apple-app-site-association, assetlinks.json)
      console.log('Handling subdomain .well-known file:', url.pathname);
      return await serveStaticWellKnownFile(request, url.pathname);
    }

    // Subdomain profile - serve SPA with injected user data
    console.log('Handling subdomain profile for:', subdomain);
    try {
      return await handleSubdomainProfile(subdomain, url, request, hostnameToUse);
    } catch (err) {
      console.error('Subdomain profile error:', err.message, err.stack);
      return new Response('Profile not found', { status: 404 });
    }
  }

  // 3. Handle external redirects
  const redirect = EXTERNAL_REDIRECTS[url.pathname];
  if (redirect) {
    return Response.redirect(redirect.url, redirect.status);
  }

  // 3b. Handle /@username paths on apex domain (e.g., divine.video/@samuelgrubbs)
  const atUsernameMatch = url.pathname.match(/^\/@([a-zA-Z0-9_-]+)$/);
  if (atUsernameMatch) {
    const username = atUsernameMatch[1].toLowerCase();
    console.log('Handling @username profile for:', username);
    if (isSocialMediaCrawler(request)) {
      try {
        const ogResponse = await handleAtUsernameOg(username, url);
        if (ogResponse) return ogResponse;
      } catch (err) {
        console.error('@username crawler OG error:', err.message);
      }
    }
    try {
      return await handleSubdomainProfile(username, url, request, hostnameToUse);
    } catch (err) {
      console.error('@username profile error:', err.message, err.stack);
      // Fall through to SPA handler which will render the client-side @username route
    }
  }

  // 4. Handle .well-known requests
  if (url.pathname.startsWith('/.well-known/')) {
    // 4a. NIP-05 from KV store
    if (url.pathname === '/.well-known/nostr.json') {
      console.log('Handling NIP-05 request');
      try {
        return await handleNip05(url);
      } catch (err) {
        console.error('NIP-05 handler error:', err.message, err.stack);
        return jsonResponse({ error: 'Handler error', details: err.message }, 500);
      }
    }

    // 4b. Serve other .well-known files (apple-app-site-association, assetlinks.json)
    // These must be served as JSON, not the SPA fallback.
    // apple-app-site-association has no file extension, so the static publisher
    // cannot detect its content type - we handle it explicitly here.
    console.log('Handling .well-known file:', url.pathname);
    return await serveStaticWellKnownFile(request, url.pathname, { varyByOriginalHost: true });
  }

  // 5. Handle /embed/:id — minimal autoplaying iframe for twitter:player / Slack
  if (url.pathname.startsWith('/embed/')) {
    const videoId = url.pathname.split('/embed/')[1]?.split('?')[0];
    if (videoId) {
      let videoMeta = null;
      try {
        videoMeta = await fetchVideoMetadata(videoId);
      } catch (e) {
        console.error('Embed: failed to fetch video metadata:', e.message);
      }
      if (!videoMeta?.videoUrl) {
        return new Response('Video not found', { status: 404 });
      }
      const html = renderEmbedPage({
        videoUrl: videoMeta.videoUrl,
        mime: videoMeta.videoMime,
        poster: videoMeta.thumbnail,
        title: videoMeta.title,
      });
      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
          'Content-Security-Policy': 'frame-ancestors *',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
  }

  // 4b. Diagnostic endpoint — test edge template rendering
  if (url.pathname === '/_divine/diag') {
    try {
      const testResp = await fetchFromFunnelcake(funnelcakeTarget, '/api/videos?sort=trending&limit=1');
      const testData = testResp.ok ? await testResp.json() : null;
      const templateCheck = typeof renderVideoPage === 'function' ? 'OK' : 'MISSING';
      return new Response(JSON.stringify({
        backend: testResp.ok ? 'OK' : `FAIL:${testResp.status}`,
        templateImport: templateCheck,
        videoCount: testData ? (testData.length || 0) : 0,
        firstVideo: testData?.[0]?.title || 'none',
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 5. Handle video pages — serve full edge-templated HTML for all visitors
  if (url.pathname.startsWith('/video/')) {
    const videoId = url.pathname.split('/video/')[1]?.split('?')[0];
    if (videoId) {
      console.log('Handling video page, id:', videoId);
      try {
        const videoPageResponse = await handleVideoPage(request, videoId, url);
        if (videoPageResponse) {
          return videoPageResponse;
        }
      } catch (err) {
        console.error('Video page handler error:', err.message, err.stack);
      }
    }
    console.log('Video page fallthrough to SPA handler');
  }

  // 6. Handle dynamic OG meta tags for crawler requests
  if (isSocialMediaCrawler(request)) {
    if (url.pathname.startsWith('/video/')) {
      console.log('Handling video OG tags for crawler, path:', url.pathname);
      const videoId = url.pathname.split('/video/')[1]?.split('?')[0];
      console.log('Video ID:', videoId);
      if (videoId) {
        const ogResponse = await handleVideoOgTags(request, videoId, url, funnelcakeTarget);
        if (ogResponse) {
          return ogResponse;
        }
      }
      console.log('Falling through to SPA handler');
    }

    if (url.pathname.startsWith('/v/')) {
      console.log('Handling legacy Vine vanity URL for crawler, path:', url.pathname);
      const legacyId = url.pathname.split('/v/')[1]?.split('?')[0];
      if (legacyId) {
        const ogResponse = await handleVideoOgTags(request, legacyId, url, funnelcakeTarget);
        if (ogResponse) {
          return ogResponse;
        }
      }
      console.log('Falling through to SPA handler');
    }

    if (url.pathname.startsWith('/profile/')) {
      const ogResponse = await handleProfileOgTags(request, url, funnelcakeTarget);
      if (ogResponse) {
        return ogResponse;
      }
    }

    if (url.pathname === '/category' || url.pathname.startsWith('/category/')) {
      const ogResponse = await handleCategoryOgTags(request, url, funnelcakeTarget);
      if (ogResponse) {
        return ogResponse;
      }
    }

    if (url.pathname.startsWith('/t/')) {
      const tag = decodeURIComponent(url.pathname.slice(3).split('?')[0]);
      const ogResponse = await handleHashtagOgTags(tag);
      if (ogResponse) return ogResponse;
    }

    if (url.pathname === '/search') {
      const ogResponse = handleSearchOgTags(url.searchParams.get('q'));
      if (ogResponse) return ogResponse;
    }

    if (url.pathname === '/discovery' || url.pathname.startsWith('/discovery/')) {
      const type = url.pathname === '/discovery'
        ? 'trending'
        : url.pathname.slice('/discovery/'.length).split('?')[0];
      const ogResponse = await handleDiscoveryOgTags(type);
      if (ogResponse) return ogResponse;
    }

    // Family resource hub and child guides at /family[/*] on apex.
    if (url.pathname === '/family' || url.pathname.startsWith('/family/')) {
      const ogResponse = handleFamilyOgTags(url, hostnameToUse);
      if (ogResponse) {
        return ogResponse;
      }
    }

    // Age-review page at /age-review on apex.
    if (url.pathname === '/age-review') {
      const ogResponse = handleAgeReviewOgTags(url, hostnameToUse);
      if (ogResponse) {
        return ogResponse;
      }
    }

    // Kids policy page at /kids on apex.
    if (url.pathname === '/kids') {
      const ogResponse = handleKidsPolicyOgTags(url, hostnameToUse);
      if (ogResponse) {
        return ogResponse;
      }
    }
  }

  // 7. Serve sw.js with no-cache to ensure browsers always get the latest service worker
  if (url.pathname === '/sw.js') {
    const response = await publisherServer.serveRequest(request);
    if (response != null) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-cache');
      headers.set('Vary', 'X-Original-Host');
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }
  }

  // 8. Content report API (creates Zendesk tickets)
  if (url.pathname === '/api/report') {
    return await handleReport(request);
  }

  // 8a. Server-set cross-subdomain auth cookie. Browsers handle Set-Cookie far
  // more reliably than client-side document.cookie writes, which silently fail
  // in some contexts (Brave, Firefox ETP-Strict, etc). Same-origin so no CORS.
  if (url.pathname === '/api/auth/persist-cookie') {
    return await handleAuthPersistCookie(request, hostnameToUse);
  }

  // 8b. Proxy RSS feed requests to the relay backend (serves application/rss+xml)
  if (url.pathname.startsWith('/feed/') || url.pathname === '/feed') {
    console.log('Proxying RSS feed request to relay:', url.pathname);
    return fetchFromFunnelcake(funnelcakeTarget, `${url.pathname}${url.search}`, {
      method: request.method,
      accept: request.headers.get('Accept') || '*/*',
    });
  }

  // 9. Serve static content with SPA fallback (handled by PublisherServer config)
  // Detect pages that benefit from edge-injected feed data
  const isApexDomain = APEX_DOMAINS.includes(hostnameToUse) || hostnameToUse.endsWith('.edgecompute.app');
  const isApexLanding = isApexDomain && (url.pathname === '/' || url.pathname === '/index.html');
  const discoveryFeedType = isApexDomain ? getDiscoveryFeedType(url.pathname) : null;
  const isCategoryPage = isApexDomain && url.pathname.startsWith('/category/');
  const isSearchPage = isApexDomain && url.pathname === '/search';
  const shouldRenderFeedPage = isApexLanding || discoveryFeedType || isCategoryPage;

  if (isApexLanding && isSocialMediaCrawler(request)) {
    const ogResponse = await handleApexOgTags();
    if (ogResponse) return ogResponse;
  }

  // Edge-templated feed pages
  if (shouldRenderFeedPage) {
    try {
      const feedType = discoveryFeedType || 'trending';
      const feedPageResponse = await handleFeedPage(feedType);
      if (feedPageResponse) {
        return feedPageResponse;
      }
    } catch (err) {
      console.error('Edge template feed page error:', err.message);
      // Fall through to SPA
    }
  }

  // Edge-templated search page
  if (isSearchPage && url.searchParams.get('q')) {
    try {
      const searchResponse = await handleSearchPage(url.searchParams.get('q'));
      if (searchResponse) {
        return searchResponse;
      }
    } catch (err) {
      console.error('Edge template search page error:', err.message);
    }
  }

  // Serve static content (JS, CSS, images, etc.) with SPA fallback
  const response = await publisherServer.serveRequest(request);
  if (response != null) {
    const isHtmlResponse = response.headers.get('Content-Type')?.includes('text/html') ?? false;
    const headers = applyStaticResponseHeaders(response.headers, { isHtml: isHtmlResponse });

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  return new Response('Not Found', { status: 404 });
}

async function serveStaticWellKnownFile(request, pathname, { varyByOriginalHost = false } = {}) {
  const wkResponse = await publisherServer.serveRequest(request);
  // Guard: if publisher returns text/html, it's the SPA fallback, not the real file.
  if (wkResponse != null && wkResponse.status === 200 && !wkResponse.headers.get('Content-Type')?.includes('text/html')) {
    const headers = new Headers(wkResponse.headers);
    const contentType = isJsonWellKnownPath(pathname)
      ? 'application/json'
      : headers.get('Content-Type') || 'application/octet-stream';
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=3600');
    if (varyByOriginalHost) {
      headers.append('Vary', 'X-Original-Host');
    }
    return new Response(wkResponse.body, { status: 200, headers });
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Map discovery route to feed type and API params.
 */
function getDiscoveryFeedType(pathname) {
  const match = pathname.match(/^\/discovery\/(new|hot|classics|top)$/);
  if (!match) return null;
  const tab = match[1];
  if (tab === 'new') return 'recent';
  if (tab === 'hot') return 'trending';
  if (tab === 'classics' || tab === 'top') return 'classics';
  return null;
}

/**
 * Get Funnelcake API URL for a given feed type.
 */
function getFeedApiUrl(feedType) {
  switch (feedType) {
    case 'trending': return '/api/videos?sort=trending&limit=10';
    case 'recent': return '/api/videos?sort=recent&limit=10';
    case 'classics': return '/api/videos?sort=loops&limit=10';
    default: return '/api/videos?sort=trending&limit=10';
  }
}

function fetchFromFunnelcake(target, path, options = {}) {
  const {
    method = 'GET',
    accept = 'application/json',
  } = options;

  return fetch(buildFunnelcakeUrl(target, path), {
    backend: target.backend,
    method,
    headers: {
      'Accept': accept,
      'Host': target.hostHeader,
    },
  });
}

/**
 * Fetch feed data with KV cache (stale-while-revalidate pattern).
 * Returns cached data if fresh (<60s), otherwise fetches from Funnelcake API
 * and updates the cache for the next request.
 */
async function fetchFeedData(feedType = 'trending', funnelcakeTarget = getFunnelcakeOriginForApiHost()) {
  const CACHE_KEY = `cache:feed:${feedType}`;
  const CACHE_TTL_SECONDS = 60;

  const contentStore = new KVStore('divine-web-content');

  // 1. Check KV cache
  try {
    const cached = await contentStore.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(await cached.text());
      const ageSeconds = Math.floor(Date.now() / 1000) - parsed.timestamp;
      if (ageSeconds < CACHE_TTL_SECONDS) {
        console.log(`Feed ${feedType} cache hit, age:`, ageSeconds, 's');
        return parsed.data;
      }
      console.log(`Feed ${feedType} cache stale, age:`, ageSeconds, 's');
    }
  } catch (e) {
    console.error('KV cache read error:', e.message);
  }

  // 2. Fetch from Funnelcake backend
  let feedData = null;
  try {
    const apiPath = getFeedApiUrl(feedType);
    const resp = await fetchFromFunnelcake(funnelcakeTarget, apiPath);
    if (resp.ok) {
      feedData = await resp.json();
      // 3. Update KV cache (fire and forget)
      try {
        await contentStore.put(CACHE_KEY, JSON.stringify({
          data: feedData,
          timestamp: Math.floor(Date.now() / 1000),
        }));
        console.log(`Feed ${feedType} cached in KV`);
      } catch (e) {
        console.error('KV cache write error:', e.message);
      }
    } else {
      console.error(`Funnelcake ${feedType} fetch failed:`, resp.status);
    }
  } catch (e) {
    console.error(`Funnelcake ${feedType} fetch error:`, e.message);
  }

  return feedData;
}

/**
 * Handle NIP-05 requests by looking up usernames in the divine-names KV store.
 * Returns JSON in NIP-05 format: { "names": { "username": "pubkey" }, "relays": { "pubkey": [...] } }
 */
async function handleNip05(url) {
  const name = url.searchParams.get('name');
  
  // NIP-05 requires a name parameter
  if (!name) {
    return jsonResponse({ error: 'Name is required.' }, 400);
  }

  try {
    const store = new KVStore('divine-names');
    const entry = await store.get(`user:${name.toLowerCase()}`);
    
    if (!entry) {
      // User not found - return empty names object per NIP-05
      return jsonResponse({ names: {} });
    }

    const userData = JSON.parse(await entry.text());
    
    // Build NIP-05 response
    const response = {
      names: {
        [name.toLowerCase()]: userData.pubkey
      }
    };

    // Include relays if available
    if (userData.relays && userData.relays.length > 0) {
      response.relays = {
        [userData.pubkey]: userData.relays
      };
    }

    return jsonResponse(response);
  } catch (error) {
    console.error('NIP-05 KV error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

/**
 * Handle content report API requests.
 * Ported from functions/api/report.ts (CF Pages Function) for Fastly Compute.
 * Creates Zendesk tickets for content reports from the web client.
 */
async function handleReport(req) {
  const REPORT_ALLOWED_ORIGINS = [
    'https://divine.video',
    'https://www.divine.video',
    'https://staging.divine.video',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:8080',
    'https://localhost:8080',
  ];
  const PAGES_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.divine-web-fm8\.pages\.dev$/;

  const origin = req.headers.get('Origin') || '';
  const isAllowed = REPORT_ALLOWED_ORIGINS.includes(origin) || PAGES_PREVIEW_RE.test(origin);

  const corsHeaders = {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // POST only
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Reject disallowed origins
  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Read credentials from Fastly Secret Store
    const store = new SecretStore('divine_web_secrets');
    const [subdomain, email, token] = await Promise.all([
      store.get('ZENDESK_SUBDOMAIN').then(s => s?.plaintext()),
      store.get('ZENDESK_API_EMAIL').then(s => s?.plaintext()),
      store.get('ZENDESK_API_TOKEN').then(s => s?.plaintext()),
    ]);

    if (!subdomain || !email || !token) {
      console.error('[report] Missing Zendesk secret store keys');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { contentType, reason, timestamp, eventId, pubkey, reporterPubkey, reporterName, reporterEmail, details, contentUrl } = body;

    // Validate required fields
    if (!contentType || !reason || !timestamp) {
      return new Response(JSON.stringify({ error: 'Missing required fields: contentType, reason, timestamp' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!eventId && !pubkey) {
      return new Response(JSON.stringify({ error: 'Must provide either eventId or pubkey' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine requester identity
    let requesterEmail;
    let isAuthenticated;

    if (reporterPubkey) {
      requesterEmail = `${reporterPubkey}@reports.divine.video`;
      isAuthenticated = true;
    } else if (reporterEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) {
        return new Response(JSON.stringify({ error: 'Invalid email format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      requesterEmail = reporterEmail;
      isAuthenticated = false;
    } else {
      return new Response(JSON.stringify({ error: 'Must provide either reporterPubkey or reporterEmail' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine priority based on reason
    let priority = 'normal';
    if (reason === 'csam' || reason === 'illegal') priority = 'urgent';
    else if (reason === 'violence' || reason === 'harassment' || reason === 'impersonation') priority = 'high';

    // Build ticket
    const subject = `[Content Report] ${reason} - ${contentType}`;
    const tags = [
      'content-report',
      'client-divine-web',
      `reason-${reason}`,
      `type-${contentType}`,
      isAuthenticated ? 'authenticated' : 'anonymous',
    ];

    const bodyParts = [
      `**Content Type:** ${contentType}`,
      `**Reason:** ${reason}`,
    ];
    if (eventId) bodyParts.push(`**Event ID:** ${eventId}`);
    if (pubkey) bodyParts.push(`**Reported Pubkey:** ${pubkey}`);
    if (contentUrl) bodyParts.push(`**Content URL:** ${contentUrl}`);
    if (details) bodyParts.push(`\n**Details:**\n${details}`);
    bodyParts.push(`\n**Reported at:** ${new Date(timestamp).toISOString()}`);
    bodyParts.push(`**Reporter:** ${isAuthenticated ? `Authenticated user (${reporterPubkey})` : `Anonymous (${reporterEmail})`}`);

    const ticketPayload = {
      ticket: {
        subject,
        comment: { body: bodyParts.join('\n') },
        requester: { email: requesterEmail, name: reporterName || reporterPubkey || reporterEmail },
        tags,
        priority,
      },
    };

    // Create Zendesk ticket via named backend.
    // The 'zendesk' backend must be created in the Fastly console pointing to
    // {subdomain}.zendesk.com. ZENDESK_SUBDOMAIN must match the backend address —
    // Fastly pins TLS to the declared backend host.
    const zendeskUrl = `https://${subdomain}.zendesk.com/api/v2/tickets.json`;
    const authHeader = btoa(`${email}/token:${token}`);

    const zendeskResponse = await fetch(zendeskUrl, {
      backend: 'zendesk',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`,
      },
      body: JSON.stringify(ticketPayload),
    });

    if (!zendeskResponse.ok) {
      const errorText = await zendeskResponse.text();
      console.error('[report] Zendesk API error:', zendeskResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to create ticket' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await zendeskResponse.json();
    return new Response(JSON.stringify({ success: true, ticketId: result.ticket?.id }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[report] Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Helper to create JSON responses with proper headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    },
  });
}

/**
 * Extract subdomain from hostname if it's a user subdomain.
 * Returns null for apex domains, www, or other reserved subdomains.
 */
function getSubdomain(hostname) {
  for (const apex of APEX_DOMAINS) {
    if (hostname === apex) {
      return null; // Apex domain, no subdomain
    }
    if (hostname.endsWith('.' + apex)) {
      const subdomain = hostname.slice(0, -(apex.length + 1));
      // Skip reserved subdomains.
      if (
        subdomain === 'www' ||
        subdomain === 'admin' ||
        subdomain === 'api'
      ) {
        return null;
      }
      // Skip multi-level subdomains (e.g., names.admin.divine.video)
      if (subdomain.includes('.')) {
        return null;
      }
      return subdomain.toLowerCase();
    }
  }
  return null; // Unknown domain
}

/**
 * Handle subdomain NIP-05 requests (e.g., alice.dvine.video/.well-known/nostr.json)
 * Returns { "names": { "_": "pubkey" }, "relays": { "pubkey": [...] } }
 */
async function handleSubdomainNip05(subdomain) {
  const store = new KVStore('divine-names');
  const entry = await store.get(`user:${subdomain}`);
  
  if (!entry) {
    return new Response('Not Found', { status: 404 });
  }

  const userData = JSON.parse(await entry.text());
  
  if (userData.status !== 'active') {
    return new Response('Not Found', { status: 404 });
  }

  // Build NIP-05 response with underscore name for subdomain format
  const response = {
    names: {
      '_': userData.pubkey
    }
  };

  // Include relays if available
  if (userData.relays && userData.relays.length > 0) {
    response.relays = {
      [userData.pubkey]: userData.relays
    };
  }

  return jsonResponse(response);
}

/**
 * Handle subdomain profile requests (e.g., alice.dvine.video/)
 * Serves the SPA directly with injected user data instead of redirecting.
 */
async function handleSubdomainProfile(subdomain, url, request, originalHostname) {
  // Check if this is a static asset request - let publisherServer handle it
  const assetExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.avif', '.woff', '.woff2', '.ttf', '.otf', '.json', '.webmanifest', '.map'];
  const isAsset = assetExtensions.some(ext => url.pathname.endsWith(ext)) || url.pathname.startsWith('/assets/');

  // Use original hostname if provided (from divine-router), otherwise use url.hostname
  const hostnameToUse = originalHostname || url.hostname;
  const funnelcakeTarget = getFunnelcakeOriginForApiHost(hostnameToUse);

  if (isAsset) {
    // Serve static assets normally via publisherServer
    const response = await publisherServer.serveRequest(request);
    if (response != null) {
      return response;
    }
    return new Response('Not Found', { status: 404 });
  }

  // Look up user data from KV store
  const namesStore = new KVStore('divine-names');
  const entry = await namesStore.get(`user:${subdomain}`);

  if (!entry) {
    return new Response('Profile not found', { status: 404 });
  }

  const userData = JSON.parse(await entry.text());

  if (userData.status !== 'active' || !userData.pubkey) {
    return new Response('Profile not found', { status: 404 });
  }

  // Convert hex pubkey to npub for the profile URL
  const npub = hexToNpub(userData.pubkey);

  // Try to fetch user profile from Funnelcake for richer data
  let profileData = null;
  try {
    const profileResponse = await fetchFromFunnelcake(funnelcakeTarget, `/api/users/${userData.pubkey}`);
    if (profileResponse.ok) {
      profileData = await profileResponse.json();
    }
  } catch (e) {
    console.error('Failed to fetch profile from Funnelcake:', e.message);
  }

  // Find the apex domain from the current hostname (use hostnameToUse for subdomain requests)
  let apexDomain = 'dvine.video';
  for (const apex of APEX_DOMAINS) {
    if (hostnameToUse.endsWith(apex)) {
      apexDomain = apex;
      break;
    }
  }

  // Detect NIP-05 mismatch: the profile's NIP-05 doesn't match this subdomain,
  // which means the KV store may be pointing to a stale (old) pubkey.
  const profileNip05 = profileData?.profile?.nip05 || null;
  const nip05Stale = profileNip05
    ? !isNip05MatchForSubdomain(profileNip05, subdomain, apexDomain)
    : false; // No NIP-05 on profile = can't determine, assume OK

  if (nip05Stale) {
    console.log(`NIP-05 mismatch detected: subdomain=${subdomain}, profile nip05=${profileNip05}, expected _@${subdomain}.${apexDomain}`);
  }

  // Build the user data object to inject
  const divineUser = {
    subdomain: subdomain,
    pubkey: userData.pubkey,
    npub: npub,
    username: subdomain,
    displayName: profileData?.profile?.display_name || profileData?.profile?.name || subdomain,
    picture: profileData?.profile?.picture || null,
    banner: profileData?.profile?.banner || null,
    about: profileData?.profile?.about || null,
    nip05: profileData?.profile?.nip05 || `${subdomain}@${apexDomain}`,
    nip05Stale: nip05Stale,
    followersCount: profileData?.social?.follower_count || 0,
    followingCount: profileData?.social?.following_count || 0,
    videoCount: profileData?.stats?.video_count || 0,
    apexDomain: apexDomain,
  };

  // Fetch user's videos for the profile page
  let userVideos = [];
  try {
    const videosResp = await fetch(`https://relay.divine.video/api/users/${userData.pubkey}/videos?limit=12`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Host': 'relay.divine.video' },
    });
    if (videosResp.ok) {
      const videosData = await videosResp.json();
      userVideos = videosData.videos || videosData || [];
    }
  } catch (e) {
    console.error('Failed to fetch user videos:', e.message);
  }

  // Render full edge-templated profile page
  const staticAssets = await getStaticAssets();
  const profileHtml = renderProfilePage({ profile: divineUser, videos: userVideos, staticAssets });

  return new Response(profileHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Vary': 'X-Original-Host',
      'X-Divine-Subdomain': subdomain,
      'X-Divine-Edge': 'template',
    },
  });
}

async function readIndexHtmlFromKv() {
  const { body, sha256 } = await readPublishedStaticFile('/index.html');
  console.log('Got index.html from KV fallback, sha256:', sha256.slice(0, 16) + '...', 'length:', body.length);
  return body;
}

/**
 * Detect if request is from a social media crawler (for OG tag injection)
 */
function isSocialMediaCrawler(request) {
  const userAgent = (request.headers.get('User-Agent') || '').toLowerCase();

  // Common social media and link preview crawlers
  const crawlerPatterns = [
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    'signal',
    'embedly',
    'quora link preview',
    'showyoubot',
    'outbrain',
    'pinterest',
    'vkshare',
    'w3c_validator',
    'baiduspider',
    'facebot',
    'ia_archiver',
    'googlebot',
    'bingbot',
    'yandexbot',
    'duckduckbot',
    'applebot',
  ];

  return crawlerPatterns.some(pattern => userAgent.includes(pattern));
}

/**
 * Fetch video metadata from Funnelcake API using Fastly backend
 */
async function fetchVideoMetadata(videoId, funnelcakeTarget = getFunnelcakeOriginForApiHost()) {
  try {
    const response = await fetchFromFunnelcake(funnelcakeTarget, `/api/videos/${videoId}`);
    if (!response.ok) {
      console.log('Funnelcake API returned:', response.status);
      return null;
    }

    const result = await response.json();
    const meta = transformVideoApiResponse(result, { defaultOgImage: DEFAULT_OG_IMAGE });
    if (meta) {
      console.log('Fetched video metadata - title:', meta.title, 'videoUrl:', meta.videoUrl);
    }
    return meta;
  } catch (err) {
    console.error('Failed to fetch video metadata:', err.message);
    return null;
  }
}

async function fetchProfileMetadata(pubkey, funnelcakeTarget = getFunnelcakeOriginForApiHost()) {
  try {
    const response = await fetchFromFunnelcake(funnelcakeTarget, `/api/users/${pubkey}`);

    if (!response.ok) {
      console.log('Profile API returned:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to fetch profile metadata:', err.message);
    return null;
  }
}

async function fetchCategoriesMetadata(funnelcakeTarget = getFunnelcakeOriginForApiHost()) {
  try {
    const response = await fetchFromFunnelcake(funnelcakeTarget, '/api/categories');

    if (!response.ok) {
      console.log('Categories API returned:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to fetch category metadata:', err.message);
    return null;
  }
}

/**
 * Handle video page requests for social media crawlers
 * Injects dynamic OG meta tags with video-specific content
 */
async function handleVideoOgTags(request, videoId, url, funnelcakeTarget) {
  try {
    // Fetch video metadata from Funnelcake
    let videoMeta = null;
    try {
      videoMeta = await fetchVideoMetadata(videoId, funnelcakeTarget);
    } catch (e) {
      console.error('Failed to fetch video metadata:', e.message);
    }

    // Default meta values if video not found
    const title = videoMeta?.title || 'Video on Divine';
    const description = videoMeta?.description || `Watch this video on Divine. ${DEFAULT_SITE_DESCRIPTION}`;
    const thumbnail = videoMeta?.thumbnail || DEFAULT_OG_IMAGE;
    const authorName = videoMeta?.authorName || '';
    const pageUrl = `https://divine.video/video/${videoId}`;

    const hasPlayableVideo = Boolean(videoMeta?.videoUrl);
    const videoBlock = hasPlayableVideo ? {
      url: videoMeta.videoUrl,
      type: videoMeta.videoMime || 'video/mp4',
      width: videoMeta.videoWidth || 720,
      height: videoMeta.videoHeight || 1280,
      embedUrl: `https://divine.video/embed/${videoId}`,
    } : null;

    console.log('Generating OG HTML for video:', videoId, 'title:', title, 'player:', hasPlayableVideo);
    const html = buildCrawlerHtml({
      title,
      description,
      image: thumbnail,
      url: pageUrl,
      ogType: 'video.other',
      twitterCard: hasPlayableVideo ? 'player' : 'summary_large_image',
      twitterCreator: authorName,
      imageWidth: videoMeta?.imageWidth || 1200,
      imageHeight: videoMeta?.imageHeight || 630,
      video: videoBlock,
      alternate: videoMeta?.originExternalId ? [{
        rel: 'alternate',
        type: 'text/html',
        href: `https://divine.video/v/${videoMeta.originExternalId}`,
        title: 'Legacy Vine URL',
      }] : undefined,
    });

    console.log('Generated OG HTML, length:', html.length);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleVideoOgTags error:', err.message, err.stack);
    return await publisherServer.serveRequest(request);
  }
}

/**
 * Handle video page requests — serve full edge-templated HTML for all visitors.
 * Falls back to SPA shell on error.
 */
async function handleVideoPage(request, videoId, url) {
  const CACHE_KEY = `page:video:${videoId}`;
  const CACHE_TTL = 300;
  const contentStore = new KVStore('divine-web-content');

  // 1. Check KV page cache
  try {
    const cached = await contentStore.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(await cached.text());
      const age = Math.floor(Date.now() / 1000) - parsed.timestamp;
      if (age < CACHE_TTL) {
        console.log(`Video page cache hit, id: ${videoId}, age: ${age}s`);
        return new Response(parsed.html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'Vary': 'X-Original-Host',
            'X-Divine-Edge': 'template',
          },
        });
      }
    }
  } catch (e) {
    console.error('Video page cache read error:', e.message);
  }

  // 2. Fetch video metadata
  let videoMeta = null;
  try {
    videoMeta = await fetchVideoMetadata(videoId);
  } catch (e) {
    console.error('Failed to fetch video metadata:', e.message);
  }

  if (!videoMeta) {
    // Video not found — fall through to SPA
    return null;
  }

  // 3. Render full HTML page
  const staticAssets = await getStaticAssets();
  const html = renderVideoPage({ video: videoMeta, videoId, staticAssets });
  console.log('Rendered video page, id:', videoId, 'length:', html.length);

  // 4. Cache in KV (fire and forget)
  try {
    await contentStore.put(CACHE_KEY, JSON.stringify({
      html,
      timestamp: Math.floor(Date.now() / 1000),
    }));
  } catch (e) {
    console.error('Video page cache write error:', e.message);
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Vary': 'X-Original-Host',
      'X-Divine-Edge': 'template',
    },
  });
}

/**
 * Handle feed/discovery pages — render edge-templated HTML with video grid.
 */
async function handleFeedPage(feedType) {
  const CACHE_KEY = `page:feed:${feedType}`;
  const CACHE_TTL = 60;
  const contentStore = new KVStore('divine-web-content');

  // 1. Check KV page cache
  try {
    const cached = await contentStore.get(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(await cached.text());
      const age = Math.floor(Date.now() / 1000) - parsed.timestamp;
      if (age < CACHE_TTL) {
        console.log(`Feed page cache hit, type: ${feedType}, age: ${age}s`);
        return new Response(parsed.html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'Vary': 'X-Original-Host',
            'X-Divine-Edge': 'template',
          },
        });
      }
    }
  } catch (e) {
    console.error('Feed page cache read error:', e.message);
  }

  // 2. Fetch feed data
  const feedData = await fetchFeedData(feedType);
  if (!feedData) {
    return null;
  }

  // 3. Normalize videos array
  const videos = feedData.videos || feedData;

  // 4. Build compact feed JSON for React (strip bulky Nostr event data)
  const compactVideos = (Array.isArray(videos) ? videos : []).map(v => ({
    id: v.id, pubkey: v.pubkey, kind: v.kind, d_tag: v.d_tag,
    title: v.title, content: v.content, thumbnail: v.thumbnail,
    video_url: v.video_url, created_at: v.created_at,
    reactions: v.reactions, comments: v.comments, reposts: v.reposts,
    loops: v.loops, views: v.views, engagement_score: v.engagement_score,
    author_name: v.author_name, author_avatar: v.author_avatar,
  }));
  const feedJson = JSON.stringify(feedData.videos ? { ...feedData, videos: compactVideos } : compactVideos);
  const staticAssets = await getStaticAssets();
  const html = renderFeedPage({ videos, feedType, feedJson, staticAssets });
  console.log('Rendered feed page, type:', feedType, 'videos:', videos.length, 'length:', html.length);

  // 5. Cache in KV
  try {
    await contentStore.put(CACHE_KEY, JSON.stringify({
      html,
      timestamp: Math.floor(Date.now() / 1000),
    }));
  } catch (e) {
    console.error('Feed page cache write error:', e.message);
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Vary': 'X-Original-Host',
      'X-Divine-Edge': 'template',
    },
  });
}

/**
 * Handle search page with query — render edge-templated HTML with results.
 */
async function handleSearchPage(query) {
  if (!query || !query.trim()) return null;

  try {
    const resp = await fetch(`https://relay.divine.video/api/search?q=${encodeURIComponent(query)}&limit=20`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Host': 'relay.divine.video' },
    });

    if (!resp.ok) {
      console.error('Search API error:', resp.status);
      return null;
    }

    const data = await resp.json();
    const results = data.videos || data.results || data || [];

    const staticAssets = await getStaticAssets();
    const html = renderSearchPage({ query, results, staticAssets });
    console.log('Rendered search page, query:', query, 'results:', results.length);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        'Vary': 'X-Original-Host',
        'X-Divine-Edge': 'template',
      },
    });
  } catch (e) {
    console.error('Search page error:', e.message);
    return null;
  }
}

async function handleProfileOgTags(request, url, funnelcakeTarget) {
  try {
    const npub = url.pathname.split('/profile/')[1]?.split('?')[0];
    const pubkey = decodeNpubToHex(npub || '');
    if (!pubkey) {
      return null;
    }

    const profileMeta = await fetchProfileMetadata(pubkey, funnelcakeTarget);
    const profile = profileMeta?.profile || {};
    const stats = profileMeta?.stats || {};
    const displayName = cleanText(profile.display_name) || cleanText(profile.name) || 'Profile on Divine';
    const about = cleanText(profile.about);
    const videoCount = typeof stats.video_count === 'number' ? stats.video_count : null;
    const description = about
      || (videoCount && videoCount > 0
        ? `Watch ${displayName}'s ${videoCount} videos on Divine.`
        : `Watch ${displayName}'s videos on Divine.`);
    const image = cleanText(profile.picture) || DEFAULT_OG_IMAGE;
    const profileUrl = `https://divine.video/profile/${npub}`;
    const html = buildCrawlerHtml({
      title: `${displayName} on Divine`,
      description,
      image,
      url: profileUrl,
      ogType: 'profile',
      twitterCard: 'summary',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleProfileOgTags error:', err.message, err.stack);
    return await publisherServer.serveRequest(request);
  }
}

async function handleCategoryOgTags(request, url, funnelcakeTarget) {
  try {
    const categoryName = url.pathname === '/category'
      ? null
      : decodeURIComponent(url.pathname.split('/category/')[1]?.split('?')[0] || '');

    let title = 'Browse Categories - Divine';
    let description = 'Explore video categories on Divine - comedy, music, dance, animals, sports, food, and more.';
    let categoryUrl = 'https://divine.video/category';

    if (categoryName) {
      const categories = await fetchCategoriesMetadata(funnelcakeTarget);
      const matchedCategory = categories?.find(category => category.name.toLowerCase() === categoryName.toLowerCase()) || null;
      const label = humanizeCategoryName(categoryName);
      title = `${label} Videos - Divine`;
      description = typeof matchedCategory?.video_count === 'number'
        ? `Explore ${matchedCategory.video_count} ${categoryName.toLowerCase()} videos on Divine.`
        : `Explore ${categoryName.toLowerCase()} videos on Divine.`;
      categoryUrl = `https://divine.video/category/${encodeURIComponent(categoryName)}`;
    }

    const html = buildCrawlerHtml({
      title,
      description,
      image: DEFAULT_OG_IMAGE,
      url: categoryUrl,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      imageWidth: 1200,
      imageHeight: 630,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleCategoryOgTags error:', err.message, err.stack);
    return await publisherServer.serveRequest(request);
  }
}

// Mirrors src/seo/marketingSeo.ts — keep the two tables in sync.
const FAMILY_CRAWLER_META = {
  '/family': {
    title: 'For Families on Divine',
    description:
      "Conversation over surveillance. What our safety tools do, what they can't, and how to talk with your teen about it.",
    image: 'https://divine.video/og-family.png',
    ogType: 'website',
  },
  '/family/talking-to-your-teen': {
    title: 'How to Talk With Your Teen About Social Media',
    description:
      'The goal is not to win the conversation. It is to keep having one. Conversation starters and guidance drawn from youth online-safety research.',
    image: 'https://divine.video/og-family-talking.png',
    ogType: 'article',
  },
  '/family/media-plan': {
    title: 'Creating a Family Media Plan',
    description:
      'A plan that everyone helped write is a plan that everyone is more likely to follow. Templates and habits for household screen use.',
    image: 'https://divine.video/og-family-media-plan.png',
    ogType: 'article',
  },
  '/family/when-something-goes-wrong': {
    title: 'What to Do if Your Child Saw Something Upsetting Online',
    description:
      'What helps most is not a perfect filter. It is a parent who reacts in a way that makes the next conversation possible. Four concrete steps.',
    image: 'https://divine.video/og-family-when-something-goes-wrong.png',
    ogType: 'article',
  },
  '/family/safety-tools': {
    title: "Divine's Safety Tools and Content Settings",
    description:
      'Settings are a useful layer. They are not a guarantee. How adult-content gating, filters, blocking, and reporting work on Divine.',
    image: 'https://divine.video/og-family-safety-tools.png',
    ogType: 'article',
  },
};

function handleFamilyOgTags(url, hostnameToUse) {
  try {
    const meta = FAMILY_CRAWLER_META[url.pathname];
    if (!meta) return null;
    const canonical = `https://${hostnameToUse}${url.pathname}`;
    const html = buildCrawlerHtml({
      title: meta.title,
      description: meta.description,
      image: meta.image,
      url: canonical,
      ogType: meta.ogType,
      twitterCard: 'summary_large_image',
      imageWidth: 1200,
      imageHeight: 630,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleFamilyOgTags error:', err.message, err.stack);
    return null;
  }
}

function handleAgeReviewOgTags(url, hostnameToUse) {
  try {
    const canonical = `https://${hostnameToUse}${url.pathname}`;
    const html = buildCrawlerHtml({
      title: 'Account review — Divine',
      description:
        'If your Divine account was flagged as possibly belonging to someone under 16, this page explains what to do — and the 15-day window for responding.',
      image: DEFAULT_OG_IMAGE,
      url: canonical,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      imageWidth: 1200,
      imageHeight: 630,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleAgeReviewOgTags error:', err.message, err.stack);
    return null;
  }
}

function handleKidsPolicyOgTags(url, hostnameToUse) {
  try {
    const canonical = `https://${hostnameToUse}${url.pathname}`;
    const html = buildCrawlerHtml({
      title: 'Kids on Divine — How accounts work for under-16s',
      description:
        'How Divine handles accounts for people under 16 — the rules, the reasoning, and what families can do together regardless of age.',
      image: DEFAULT_OG_IMAGE,
      url: canonical,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      imageWidth: 1200,
      imageHeight: 630,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleKidsPolicyOgTags error:', err.message, err.stack);
    return null;
  }
}

/**
 * Check if a profile's NIP-05 matches the expected subdomain.
 * Returns true if the NIP-05 indicates this pubkey owns this subdomain.
 *
 * Matches:
 *   _@{subdomain}.{apex}  (subdomain NIP-05 format)
 *   {subdomain}@{apex}    (apex NIP-05 format)
 */
function isNip05MatchForSubdomain(nip05, subdomain, apexDomain) {
  if (!nip05 || !subdomain || !apexDomain) return false;
  const lower = nip05.toLowerCase();
  const subLower = subdomain.toLowerCase();
  // _@alice.divine.video
  if (lower === `_@${subLower}.${apexDomain}`) return true;
  // alice@divine.video
  if (lower === `${subLower}@${apexDomain}`) return true;
  return false;
}

function humanizeCategoryName(name) {
  const normalized = cleanText(decodeURIComponent(name || '').toLowerCase());
  if (!normalized) {
    return 'Category';
  }

  if (normalized === 'diy') return 'DIY';
  if (normalized === 'vlog') return 'Vlog';
  if (normalized === 'ai') return 'AI';

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

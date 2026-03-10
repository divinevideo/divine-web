// ABOUTME: Fastly Compute entry point for divine-web static site
// ABOUTME: Handles www redirects, external redirects, NIP-05 from KV, subdomain profiles, dynamic OG tags, and SPA fallback

/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';
import { KVStore } from 'fastly:kv-store';
import { SecretStore } from 'fastly:secret-store';
import { PublisherServer } from '@fastly/compute-js-static-publish';
import rc from '../static-publish.rc.js';
import { renderFeedPage, renderVideoPage, renderProfilePage, renderSearchPage } from './templates/pages.js';

const publisherServer = PublisherServer.fromStaticPublishRc(rc);

// Funnelcake API URL for fetching video metadata
const FUNNELCAKE_API_URL = 'https://relay.divine.video';

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

// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const version = env('FASTLY_SERVICE_VERSION');
  console.log('FASTLY_SERVICE_VERSION', version);

  const request = event.request;
  const url = new URL(request.url);

  // Check for original host passed by divine-router
  const originalHost = request.headers.get('X-Original-Host');
  const hostnameToUse = originalHost || url.hostname;

  console.log('Request hostname:', url.hostname, 'original:', originalHost, 'path:', url.pathname);

  // 1. Redirect www.* to apex domain (e.g., www.divine.video -> divine.video)
  if (hostnameToUse.startsWith('www.')) {
    const newUrl = new URL(url);
    newUrl.hostname = hostnameToUse.slice(4); // remove 'www.'
    return Response.redirect(newUrl.toString(), 301);
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
      const wkResponse = await publisherServer.serveRequest(request);
      // Guard: if publisher returns text/html, it's the SPA fallback, not the real file
      if (wkResponse != null && wkResponse.status === 200 && !wkResponse.headers.get('Content-Type')?.includes('text/html')) {
        const headers = new Headers(wkResponse.headers);
        const contentType = url.pathname.endsWith('.json') || url.pathname.endsWith('/apple-app-site-association')
          ? 'application/json'
          : headers.get('Content-Type') || 'application/octet-stream';
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 'public, max-age=3600');
        return new Response(wkResponse.body, { status: 200, headers });
      }
      return new Response('Not Found', { status: 404 });
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
    const wkResponse = await publisherServer.serveRequest(request);
    // Guard: if publisher returns text/html, it's the SPA fallback, not the real file
    if (wkResponse != null && wkResponse.status === 200 && !wkResponse.headers.get('Content-Type')?.includes('text/html')) {
      const headers = new Headers(wkResponse.headers);
      // Ensure correct content type for app association files
      const contentType = url.pathname.endsWith('.json') || url.pathname.endsWith('/apple-app-site-association')
        ? 'application/json'
        : headers.get('Content-Type') || 'application/octet-stream';
      headers.set('Content-Type', contentType);
      headers.set('Cache-Control', 'public, max-age=3600');
      headers.append('Vary', 'X-Original-Host');
      return new Response(wkResponse.body, {
        status: 200,
        headers,
      });
    }
    // File not found in KV - return 404 instead of SPA fallback
    return new Response('Not Found', { status: 404 });
  }

  // 4b. Diagnostic endpoint — test edge template rendering
  if (url.pathname === '/_divine/diag') {
    try {
      const testResp = await fetch('https://relay.divine.video/api/videos?sort=trending&limit=1', {
        backend: 'funnelcake',
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Host': 'relay.divine.video' },
      });
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

  // 6. Serve sw.js with no-cache to ensure browsers always get the latest service worker
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

  // 7. Content report API (creates Zendesk tickets)
  if (url.pathname === '/api/report') {
    return await handleReport(request);
  }

  // 7b. Proxy RSS feed requests to the relay backend (serves application/rss+xml)
  if (url.pathname.startsWith('/feed/') || url.pathname === '/feed') {
    console.log('Proxying RSS feed request to relay:', url.pathname);
    const feedUrl = `${FUNNELCAKE_API_URL}${url.pathname}${url.search}`;
    return fetch(feedUrl, {
      backend: 'funnelcake',
      method: request.method,
      headers: {
        'Accept': request.headers.get('Accept') || '*/*',
        'Host': 'relay.divine.video',
      },
    });
  }

  // 8. Serve edge-templated feed pages or static content with SPA fallback
  const isApexDomain = APEX_DOMAINS.includes(hostnameToUse) || hostnameToUse.endsWith('.edgecompute.app');
  const isApexLanding = isApexDomain && (url.pathname === '/' || url.pathname === '/index.html');
  const discoveryFeedType = isApexDomain ? getDiscoveryFeedType(url.pathname) : null;
  const isCategoryPage = isApexDomain && url.pathname.startsWith('/category/');
  const isSearchPage = isApexDomain && url.pathname === '/search';
  const shouldRenderFeedPage = isApexLanding || discoveryFeedType || isCategoryPage;

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
    const headers = new Headers(response.headers);
    headers.append('Vary', 'X-Original-Host');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
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

/**
 * Fetch feed data with KV cache (stale-while-revalidate pattern).
 * Returns cached data if fresh (<60s), otherwise fetches from Funnelcake API
 * and updates the cache for the next request.
 */
async function fetchFeedData(feedType = 'trending') {
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
    const resp = await fetch(`https://relay.divine.video${apiPath}`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Host': 'relay.divine.video',
      },
    });
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

    const { contentType, reason, timestamp, eventId, pubkey, reporterPubkey, reporterEmail, details, contentUrl } = body;

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
        requester: { email: requesterEmail },
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
      // Skip reserved subdomains
      if (subdomain === 'www' || subdomain === 'admin' || subdomain === 'api') {
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
    const profileResponse = await fetch(`https://relay.divine.video/api/users/${userData.pubkey}`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Host': 'relay.divine.video',
      },
    });
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
  const profileHtml = renderProfilePage({ profile: divineUser, videos: userVideos });

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

/**
 * Convert hex pubkey to npub (Bech32) format
 */
function hexToNpub(hex) {
  // Bech32 character set
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  
  // Convert hex to 5-bit groups
  const data = [];
  for (let i = 0; i < hex.length; i += 2) {
    data.push(parseInt(hex.slice(i, i + 2), 16));
  }
  
  // Convert 8-bit to 5-bit
  const converted = convertBits(data, 8, 5, true);
  
  // Compute checksum
  const hrp = 'npub';
  const checksumData = hrpExpand(hrp).concat(converted);
  const checksum = createChecksum(checksumData);
  
  // Encode
  let result = hrp + '1';
  for (const b of converted.concat(checksum)) {
    result += CHARSET[b];
  }
  
  return result;
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  
  if (pad && bits > 0) {
    result.push((acc << (toBits - bits)) & maxv);
  }
  
  return result;
}

function hrpExpand(hrp) {
  const result = [];
  for (const c of hrp) {
    result.push(c.charCodeAt(0) >> 5);
  }
  result.push(0);
  for (const c of hrp) {
    result.push(c.charCodeAt(0) & 31);
  }
  return result;
}

function polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GEN[i];
      }
    }
  }
  return chk;
}

function createChecksum(data) {
  const values = data.concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const result = [];
  for (let i = 0; i < 6; i++) {
    result.push((mod >> (5 * (5 - i))) & 31);
  }
  return result;
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
  ];

  return crawlerPatterns.some(pattern => userAgent.includes(pattern));
}

/**
 * Fetch video metadata from Funnelcake API using Fastly backend
 */
async function fetchVideoMetadata(videoId) {
  try {
    // Use the /api/videos/{id} endpoint
    const response = await fetch(`https://relay.divine.video/api/videos/${videoId}`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Host': 'relay.divine.video',
      },
    });

    if (!response.ok) {
      console.log('Funnelcake API returned:', response.status);
      return null;
    }

    const result = await response.json();

    if (!result.event) {
      console.log('Video not found:', videoId);
      return null;
    }

    const event = result.event;
    const stats = result.stats || {};

    // Extract data from tags
    const getTag = (name) => event.tags?.find(t => t[0] === name)?.[1];

    // Parse imeta tag for thumbnail and video URL
    const imetaTag = event.tags?.find(t => t[0] === 'imeta');
    const imeta = {};
    if (imetaTag) {
      for (let i = 1; i < imetaTag.length; i++) {
        const parts = imetaTag[i].split(' ');
        if (parts.length >= 2) {
          imeta[parts[0]] = parts.slice(1).join(' ');
        }
      }
    }

    const thumbnail = imeta.image || null;
    const title = getTag('title') || null;
    const content = event.content || '';

    // Build a rich description with engagement stats
    const statsList = [];
    if (stats.reactions > 0) statsList.push(`${stats.reactions} ❤️`);
    if (stats.comments > 0) statsList.push(`${stats.comments} 💬`);
    if (stats.reposts > 0) statsList.push(`${stats.reposts} 🔁`);

    let description;
    if (content && content.trim()) {
      // Use the content/caption if available
      description = content.trim();
    } else if (statsList.length > 0) {
      // Show engagement stats
      description = `${statsList.join(' • ')} on diVine`;
    } else {
      description = 'Watch this short video on diVine';
    }

    // Extract video URL from imeta
    const videoUrl = imeta.url || null;

    // Use author info from the result if available (Funnelcake enriches this)
    const authorDisplayName = result.author_name || getTag('author') || '';
    const authorAvatar = result.author_avatar || null;

    console.log('Fetched video metadata - title:', title, 'thumbnail:', thumbnail);

    return {
      id: videoId,
      title: title || 'Video on diVine',
      description: description,
      content: content,
      thumbnail: thumbnail || 'https://divine.video/og.avif',
      video_url: videoUrl,
      authorName: authorDisplayName,
      authorAvatar: authorAvatar,
      pubkey: event.pubkey,
      reactions: stats.reactions || 0,
      comments: stats.comments || 0,
      reposts: stats.reposts || 0,
      loops: stats.loops || stats.loop_count || 0,
    };
  } catch (err) {
    console.error('Failed to fetch video metadata:', err.message);
    return null;
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
  const html = renderVideoPage({ video: videoMeta, videoId });
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
  const html = renderFeedPage({ videos, feedType, feedJson });
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

    const html = renderSearchPage({ query, results });
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

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

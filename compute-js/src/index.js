// ABOUTME: Fastly Compute entry point for divine-web static site
// ABOUTME: Handles www redirects, external redirects, NIP-05 from KV, subdomain profiles, dynamic OG tags, and SPA fallback

/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';
import { KVStore } from 'fastly:kv-store';
import { SecretStore } from 'fastly:secret-store';
import { PublisherServer } from '@fastly/compute-js-static-publish';
import rc from '../static-publish.rc.js';
import { buildFunnelcakeUrl, getFunnelcakeOriginForApiHost } from './funnelcakeOrigin.js';

const publisherServer = PublisherServer.fromStaticPublishRc(rc);
const DEFAULT_OG_IMAGE = 'https://divine.video/og.png';
const DEFAULT_SITE_DESCRIPTION = 'Watch and share 6-second looping videos on the decentralized Nostr network.';

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
  const funnelcakeTarget = getFunnelcakeOriginForApiHost(hostnameToUse);

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

  // 3b. Handle /@username paths on apex domain (e.g., divine.video/@samuelgrubbs)
  const atUsernameMatch = url.pathname.match(/^\/@([a-zA-Z0-9_-]+)$/);
  if (atUsernameMatch) {
    const username = atUsernameMatch[1].toLowerCase();
    console.log('Handling @username profile for:', username);
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

  // 5. Handle dynamic OG meta tags for crawler requests
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
    return fetchFromFunnelcake(funnelcakeTarget, `${url.pathname}${url.search}`, {
      method: request.method,
      accept: request.headers.get('Accept') || '*/*',
    });
  }

  // 8. Serve static content with SPA fallback (handled by PublisherServer config)
  // Detect pages that benefit from edge-injected feed data
  const isApexDomain = APEX_DOMAINS.includes(hostnameToUse);
  const isApexLanding = isApexDomain && (url.pathname === '/' || url.pathname === '/index.html');
  const discoveryFeedType = isApexDomain ? getDiscoveryFeedType(url.pathname) : null;
  const shouldInjectFeed = isApexLanding || discoveryFeedType;

  const response = await publisherServer.serveRequest(request);
  if (response != null) {
    // Add Vary: X-Original-Host so CDN doesn't mix subdomain and apex cached responses
    const headers = new Headers(response.headers);
    headers.append('Vary', 'X-Original-Host');

    // Inject feed data into HTML pages for faster LCP
    if (shouldInjectFeed && response.headers.get('Content-Type')?.includes('text/html')) {
      try {
        let html = await response.text();
        const feedType = discoveryFeedType || 'trending';
        const feedData = await fetchFeedData(feedType, funnelcakeTarget);
        if (feedData) {
          let injection = `<script>window.__DIVINE_FEED__=${JSON.stringify(feedData)};window.__DIVINE_FEED_TYPE__="${feedType}";</script>`;
          const firstVideo = feedData.videos?.[0] || feedData[0];
          const firstVideoUrl = firstVideo?.video_url;
          const firstThumbnail = firstVideo?.thumbnail;
          if (firstVideoUrl) {
            injection += `\n<link rel="preload" href="${escapeHtml(firstVideoUrl)}" as="video" type="video/mp4">`;
          }
          if (firstThumbnail) {
            injection += `\n<link rel="preload" href="${escapeHtml(firstThumbnail)}" as="image" fetchpriority="high">`;
          }
          html = html.replace('</head>', injection + '</head>');
        }
        return new Response(html, { status: response.status, headers });
      } catch (err) {
        console.error('Feed injection error:', err.message);
        // Fall through to serve unmodified response
      }
    }

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
 * Zendesk bug form + custom field IDs — sync with divine-mobile
 * ZendeskSupportService.createStructuredBugReport (zendesk_support_service.dart).
 */
const ZD_BUG_FORM_ID = 14772963437071;
const ZD_FIELD_TICKET_TYPE = 14332953477519;
const ZD_FIELD_PLATFORM = 14884176561807;
const ZD_FIELD_OS_VERSION = 14884157556111;
const ZD_FIELD_BUILD = 14884184890511;
const ZD_FIELD_STEPS = 14677364166031;
const ZD_FIELD_EXPECTED = 14677341431695;

function reportBuildNumberFromAppVersion(appVersion) {
  if (!appVersion || typeof appVersion !== 'string') return 'unknown';
  const plus = appVersion.indexOf('+');
  return plus >= 0 ? appVersion.slice(plus + 1) : appVersion;
}

function buildBugReportCommentBody(effectiveSubject, description, meta) {
  const lines = [effectiveSubject, '', description, '', `App Version: ${meta.appVersion || 'unknown'}`, ''];
  const steps = (meta.stepsToReproduce || '').trim();
  const expected = (meta.expectedBehavior || '').trim();
  if (steps) {
    lines.push('### Steps to Reproduce', steps, '');
  }
  if (expected) {
    lines.push('### Expected Behavior', expected, '');
  }
  lines.push('### Environment');
  lines.push(`- **Page URL:** ${meta.pageUrl || 'n/a'}`);
  lines.push(`- **User-Agent:** ${meta.userAgent || 'n/a'}`);
  if (meta.logsSummary && String(meta.logsSummary).trim()) {
    lines.push('', '### Recent Logs', '```', String(meta.logsSummary).trim(), '```');
  }
  return lines.join('\n');
}

async function zendeskPostTicket(ticketObject, subdomain, email, token, corsHeaders) {
  const zendeskUrl = `https://${subdomain}.zendesk.com/api/v2/tickets.json`;
  const authHeader = btoa(`${email}/token:${token}`);
  const zendeskResponse = await fetch(zendeskUrl, {
    backend: 'zendesk',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authHeader}`,
    },
    body: JSON.stringify({ ticket: ticketObject }),
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
}

function resolveReportRequester(body, corsHeaders) {
  let requesterEmail;
  let isAuthenticated;

  if (body.reporterPubkey) {
    requesterEmail = `${body.reporterPubkey}@reports.divine.video`;
    isAuthenticated = true;
  } else if (body.reporterEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.reporterEmail)) {
      return {
        error: new Response(JSON.stringify({ error: 'Invalid email format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }),
      };
    }
    requesterEmail = body.reporterEmail;
    isAuthenticated = false;
  } else {
    return {
      error: new Response(JSON.stringify({ error: 'Must provide either reporterPubkey or reporterEmail' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  return { requesterEmail, isAuthenticated };
}

/**
 * Handle /api/report: Zendesk tickets for content reports (NIP-56) and structured bug reports.
 * Ported from functions/api/report.ts (CF Pages) for Fastly Compute.
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

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const secretStore = new SecretStore('divine_web_secrets');
    const [subdomain, email, token] = await Promise.all([
      secretStore.get('ZENDESK_SUBDOMAIN').then(s => s?.plaintext()),
      secretStore.get('ZENDESK_API_EMAIL').then(s => s?.plaintext()),
      secretStore.get('ZENDESK_API_TOKEN').then(s => s?.plaintext()),
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

    const reportType = typeof body.reportType === 'string' ? body.reportType : '';
    const looksLikeContent = Boolean(
      body.contentType && body.reason != null && body.timestamp != null,
    );
    const isBug = reportType === 'bug';
    const isContent = reportType === 'content' || (!isBug && looksLikeContent);

    if (isBug) {
      const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!subject || !description || body.timestamp == null) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: subject, description, timestamp',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const who = resolveReportRequester(body, corsHeaders);
      if (who.error) return who.error;

      const { requesterEmail, isAuthenticated } = who;
      const reporterName = body.reporterName || body.reporterPubkey || body.reporterEmail;
      const appVersion = typeof body.appVersion === 'string' ? body.appVersion : 'unknown';
      const osVersion =
        typeof body.osVersion === 'string' && body.osVersion.trim()
          ? body.osVersion.trim()
          : 'web';

      const customFields = [
        { id: ZD_FIELD_TICKET_TYPE, value: 'incident' },
        { id: ZD_FIELD_PLATFORM, value: 'web' },
        { id: ZD_FIELD_OS_VERSION, value: osVersion },
        { id: ZD_FIELD_BUILD, value: reportBuildNumberFromAppVersion(appVersion) },
      ];
      const stepsToReproduce = typeof body.stepsToReproduce === 'string' ? body.stepsToReproduce.trim() : '';
      const expectedBehavior = typeof body.expectedBehavior === 'string' ? body.expectedBehavior.trim() : '';
      if (stepsToReproduce) customFields.push({ id: ZD_FIELD_STEPS, value: stepsToReproduce });
      if (expectedBehavior) customFields.push({ id: ZD_FIELD_EXPECTED, value: expectedBehavior });

      const meta = {
        appVersion,
        stepsToReproduce,
        expectedBehavior,
        pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : '',
        userAgent: typeof body.userAgent === 'string' ? body.userAgent : '',
        logsSummary: typeof body.logsSummary === 'string' ? body.logsSummary : '',
      };

      const effectiveSubject = subject || 'Bug report (divine-web)';
      const commentBody = buildBugReportCommentBody(effectiveSubject, description, meta);

      const requester = {
        email: requesterEmail,
        name: reporterName,
      };
      if (body.reporterPubkey) {
        requester.external_id = body.reporterPubkey;
      }

      const ticketObject = {
        subject: effectiveSubject,
        comment: { body: commentBody },
        requester,
        ticket_form_id: ZD_BUG_FORM_ID,
        custom_fields: customFields,
        tags: ['bug_report', 'divine_app', 'web', 'client-divine-web'],
        priority: 'normal',
      };

      return await zendeskPostTicket(ticketObject, subdomain, email, token, corsHeaders);
    }

    if (!isContent) {
      return new Response(JSON.stringify({
        error: 'Unknown report: set reportType to "bug" or send contentType, reason, and timestamp',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      contentType, reason, timestamp, eventId, pubkey, reporterPubkey, reporterName, reporterEmail, details, contentUrl,
    } = body;

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

    const who = resolveReportRequester(body, corsHeaders);
    if (who.error) return who.error;

    const { requesterEmail, isAuthenticated } = who;

    let priority = 'normal';
    if (reason === 'csam' || reason === 'illegal') priority = 'urgent';
    else if (reason === 'violence' || reason === 'harassment' || reason === 'impersonation') priority = 'high';

    const subject = `[Content Report] ${reason} - ${contentType}`;
    const tags = [
      'content-report',
      'client-divine-web',
      'nip-56',
      'web',
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
    bodyParts.push('\n---');
    bodyParts.push('Reported via Divine web (NIP-56 content report).');

    const ticketObject = {
      subject,
      comment: { body: bodyParts.join('\n') },
      requester: {
        email: requesterEmail,
        name: reporterName || reporterPubkey || reporterEmail,
      },
      tags,
      priority,
    };

    if (reporterPubkey) {
      ticketObject.requester.external_id = reporterPubkey;
    }

    return await zendeskPostTicket(ticketObject, subdomain, email, token, corsHeaders);
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

  // Read index.html directly from KV store
  // (PublisherServer.serveRequest returns empty body for synthetic requests)
  let html;
  try {
    const contentStore = new KVStore('divine-web-content');

    // Read the file index: publishId_index_collectionName
    const indexEntry = await contentStore.get('default_index_live');
    if (!indexEntry) {
      throw new Error('Content index not found in KV');
    }
    const kvIndex = JSON.parse(await indexEntry.text());

    // Find index.html in the index and get its content hash
    const htmlAsset = kvIndex['/index.html'];
    if (!htmlAsset) {
      throw new Error('index.html not in content index');
    }
    // Asset format: { key: "sha256:<hash>", size, contentType, variants }
    // KV content key format: default_files_sha256_<hash>
    const assetKey = htmlAsset.key; // e.g. "sha256:abc123..."
    const sha256 = assetKey.replace('sha256:', '');
    const contentKey = `default_files_sha256_${sha256}`;
    console.log('Reading index.html from KV, sha256:', sha256.slice(0, 16) + '...');
    const contentEntry = await contentStore.get(contentKey);
    if (!contentEntry) {
      throw new Error(`Content not found: ${contentKey}`);
    }
    html = await contentEntry.text();
    console.log('Got index.html from KV, length:', html.length);
  } catch (err) {
    console.error('KV read error:', err.message);
    const profileUrl = `https://${apexDomain}/profile/${npub}`;
    return Response.redirect(profileUrl, 302);
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

  // Inject the user data as a global variable before the main script
  const userScript = `<script>window.__DIVINE_USER__ = ${JSON.stringify(divineUser)};</script>`;

  // Update OG tags for the profile
  const ogTitle = divineUser.displayName + ' on Divine';
  const ogDescription = divineUser.about || `Watch ${divineUser.displayName}'s videos on Divine`;
  const ogImage = divineUser.picture || 'https://divine.video/og.png';
  const ogUrl = `https://${subdomain}.${apexDomain}/`;

  // Replace OG tags in HTML
  html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
  html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(ogUrl)}" />`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`);
  html = html.replace(/<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(ogTitle)}</title>`);

  // Add a debug comment and inject the script before the closing </head> tag
  const debugComment = `<!-- DIVINE_SUBDOMAIN_PROFILE: ${subdomain} -->`;
  html = html.replace('</head>', debugComment + userScript + '</head>');

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60', // Short cache for profile pages
      'Vary': 'X-Original-Host', // Cache varies by original hostname (from divine-router)
      'X-Divine-Subdomain': subdomain, // Debug header to verify subdomain handling
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

function decodeNpubToHex(npub) {
  const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const normalized = (npub || '').toLowerCase();
  if (!normalized.startsWith('npub1')) {
    return null;
  }

  const separatorIndex = normalized.lastIndexOf('1');
  if (separatorIndex === -1) {
    return null;
  }

  const dataPart = normalized.slice(separatorIndex + 1);
  if (dataPart.length < 6) {
    return null;
  }

  const values = [...dataPart].map(char => CHARSET.indexOf(char));
  if (values.some(value => value === -1)) {
    return null;
  }

  const payload = values.slice(0, -6);
  const decoded = convertBits(payload, 5, 8, false);
  if (!decoded) {
    return null;
  }

  return decoded.map(value => value.toString(16).padStart(2, '0')).join('');
}

function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;
  const maxAcc = (1 << (fromBits + toBits - 1)) - 1;
  
  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      return null;
    }
    acc = ((acc << fromBits) | value) & maxAcc;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }
  
  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    return null;
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
async function fetchVideoMetadata(videoId, funnelcakeTarget = getFunnelcakeOriginForApiHost()) {
  try {
    // Use the /api/videos/{id} endpoint
    const response = await fetchFromFunnelcake(funnelcakeTarget, `/api/videos/${videoId}`);

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
    const summary = cleanText(getTag('summary'));
    const alt = cleanText(getTag('alt'));
    const content = cleanText(event.content);
    const title = cleanText(getTag('title')) || alt || summary || truncateText(content, 80) || null;

    // Build a rich description with engagement stats
    const statsList = [];
    if (stats.reactions > 0) statsList.push(`${stats.reactions} ❤️`);
    if (stats.comments > 0) statsList.push(`${stats.comments} 💬`);
    if (stats.reposts > 0) statsList.push(`${stats.reposts} 🔁`);

    let description;
    if (content) {
      description = content;
    } else if (summary) {
      description = summary;
    } else if (alt) {
      description = alt;
    } else if (statsList.length > 0) {
      description = `${statsList.join(' • ')} on Divine`;
    } else {
      description = 'Watch this short video on Divine';
    }

    console.log('Fetched video metadata - title:', title, 'thumbnail:', thumbnail);

    return {
      title: title || 'Video on Divine',
      description: description,
      thumbnail: thumbnail || DEFAULT_OG_IMAGE,
      authorName: cleanText(getTag('author')) || cleanText(stats.author_name) || '',
      reactions: stats.reactions || 0,
      comments: stats.comments || 0,
    };
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

function buildCrawlerHtml({
  title,
  description,
  image,
  url,
  ogType,
  twitterCard = 'summary_large_image',
  twitterCreator = '',
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  <meta property="og:type" content="${escapeHtml(ogType)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:site_name" content="Divine" />

  <meta name="twitter:card" content="${escapeHtml(twitterCard)}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  ${twitterCreator ? `<meta name="twitter:creator" content="${escapeHtml(twitterCreator)}" />` : ''}

  <meta http-equiv="refresh" content="0;url=${escapeHtml(url)}">
  <link rel="canonical" href="${escapeHtml(url)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(url)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;
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
    const videoUrl = `https://divine.video/video/${videoId}`;

    console.log('Generating OG HTML for video:', videoId, 'title:', title);
    const html = buildCrawlerHtml({
      title,
      description,
      image: thumbnail,
      url: videoUrl,
      ogType: 'video.other',
      twitterCard: 'summary_large_image',
      twitterCreator: authorName,
    });

    console.log('Generated OG HTML, length:', html.length);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent', // Cache different versions for crawlers vs browsers
      },
    });
  } catch (err) {
    console.error('handleVideoOgTags error:', err.message, err.stack);
    // Return the normal SPA on error
    return await publisherServer.serveRequest(request);
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

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength) {
  const trimmed = cleanText(value);
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
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

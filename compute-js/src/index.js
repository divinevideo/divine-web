// ABOUTME: Fastly Compute entry point for divine-web static site
// ABOUTME: Handles www redirects, external redirects, NIP-05 from KV, subdomain profiles, dynamic OG tags, and SPA fallback

/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';
import { KVStore } from 'fastly:kv-store';
import { SecretStore } from 'fastly:secret-store';
import { PublisherServer } from '@fastly/compute-js-static-publish';
import rc from '../static-publish.rc.js';

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
    // Subdomain NIP-05 request
    if (url.pathname === '/.well-known/nostr.json') {
      console.log('Handling subdomain NIP-05 for:', subdomain);
      try {
        return await handleSubdomainNip05(subdomain);
      } catch (err) {
        console.error('Subdomain NIP-05 error:', err.message, err.stack);
        return jsonResponse({ error: 'Handler error' }, 500);
      }
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

  // 4. Handle NIP-05 requests from KV store (root domain)
  if (url.pathname === '/.well-known/nostr.json') {
    console.log('Handling NIP-05 request');
    try {
      return await handleNip05(url);
    } catch (err) {
      console.error('NIP-05 handler error:', err.message, err.stack);
      return jsonResponse({ error: 'Handler error', details: err.message }, 500);
    }
  }

  // 5. Handle dynamic OG meta tags for video pages (for social media crawlers)
  if (url.pathname.startsWith('/video/') && isSocialMediaCrawler(request)) {
    console.log('Handling video OG tags for crawler, path:', url.pathname);
    const videoId = url.pathname.split('/video/')[1]?.split('?')[0];
    console.log('Video ID:', videoId);
    if (videoId) {
      const ogResponse = await handleVideoOgTags(request, videoId, url);
      if (ogResponse) {
        return ogResponse;
      }
    }
    console.log('Falling through to SPA handler');
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

  // 8. Serve static content with SPA fallback (handled by PublisherServer config)
  const response = await publisherServer.serveRequest(request);
  if (response != null) {
    // Add Vary: X-Original-Host so CDN doesn't mix subdomain and apex cached responses
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
    followersCount: profileData?.social?.follower_count || 0,
    followingCount: profileData?.social?.following_count || 0,
    videoCount: profileData?.stats?.video_count || 0,
    apexDomain: apexDomain,
  };

  // Inject the user data as a global variable before the main script
  const userScript = `<script>window.__DIVINE_USER__ = ${JSON.stringify(divineUser)};</script>`;

  // Update OG tags for the profile
  const ogTitle = divineUser.displayName + ' on diVine';
  const ogDescription = divineUser.about || `Watch ${divineUser.displayName}'s videos on diVine`;
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

    console.log('Fetched video metadata - title:', title, 'thumbnail:', thumbnail);

    return {
      title: title || 'Video on diVine',
      description: description,
      thumbnail: thumbnail || 'https://divine.video/og.avif',
      authorName: getTag('author') || '',
      reactions: stats.reactions || 0,
      comments: stats.comments || 0,
    };
  } catch (err) {
    console.error('Failed to fetch video metadata:', err.message);
    return null;
  }
}

/**
 * Handle video page requests for social media crawlers
 * Injects dynamic OG meta tags with video-specific content
 */
async function handleVideoOgTags(request, videoId, url) {
  try {
    // Fetch video metadata from Funnelcake
    let videoMeta = null;
    try {
      videoMeta = await fetchVideoMetadata(videoId);
    } catch (e) {
      console.error('Failed to fetch video metadata:', e.message);
    }

    // Default meta values if video not found
    const title = videoMeta?.title || 'Video on diVine';
    const description = videoMeta?.description || 'Watch this video on diVine - Short-form looping videos on Nostr';
    const thumbnail = videoMeta?.thumbnail || 'https://divine.video/og.avif';
    const authorName = videoMeta?.authorName || '';
    const videoUrl = `https://divine.video/video/${videoId}`;

    console.log('Generating OG HTML for video:', videoId, 'title:', title);

    // Generate a minimal HTML page with OG tags for crawlers
    // This is simpler than trying to inject into the SPA HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - diVine</title>

  <!-- Open Graph Meta Tags -->
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(thumbnail)}" />
  <meta property="og:image:width" content="480" />
  <meta property="og:image:height" content="480" />
  <meta property="og:url" content="${escapeHtml(videoUrl)}" />
  <meta property="og:site_name" content="diVine" />

  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(thumbnail)}" />
  ${authorName ? `<meta name="twitter:creator" content="${escapeHtml(authorName)}" />` : ''}

  <!-- Redirect to actual page for any user who lands here -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(videoUrl)}">
  <link rel="canonical" href="${escapeHtml(videoUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(videoUrl)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

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

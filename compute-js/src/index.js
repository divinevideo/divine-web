// ABOUTME: Fastly Compute entry point for divine-web static site
// ABOUTME: Handles www redirects, external redirects, NIP-05 from KV, subdomain profiles, and SPA fallback

/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';
import { KVStore } from 'fastly:kv-store';
import { PublisherServer } from '@fastly/compute-js-static-publish';
import rc from '../static-publish.rc.js';

const publisherServer = PublisherServer.fromStaticPublishRc(rc);

// Apex domains we serve (used to detect subdomains)
const APEX_DOMAINS = ['dvine.video', 'divine.video'];

// External redirects - always redirect to about.divine.video (Option A)
const EXTERNAL_REDIRECTS = {
  '/press': { url: 'https://about.divine.video/press/', status: 301 },
  '/news': { url: 'https://about.divine.video/news/', status: 301 },
  '/media-resources': { url: 'https://about.divine.video/media-resources/', status: 301 },
  '/news/vine-revisited': { url: 'https://about.divine.video/vine-revisited-a-return-to-the-halcyon-days-of-the-internet/', status: 301 },
  '/discord': { url: 'https://discord.gg/RZVbzuQ5qM', status: 302 },
};

// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const version = env('FASTLY_SERVICE_VERSION');
  console.log('FASTLY_SERVICE_VERSION', version);

  const request = event.request;
  const url = new URL(request.url);
  
  console.log('Request hostname:', url.hostname, 'path:', url.pathname);

  // 1. Redirect www.* to apex domain (e.g., www.divine.video -> divine.video)
  if (url.hostname.startsWith('www.')) {
    const newUrl = new URL(url);
    newUrl.hostname = url.hostname.slice(4); // remove 'www.'
    return Response.redirect(newUrl.toString(), 301);
  }

  // 2. Check if this is a subdomain request (e.g., alice.dvine.video)
  const subdomain = getSubdomain(url.hostname);
  
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
    
    // Subdomain profile redirect (alice.dvine.video -> dvine.video/profile/npub...)
    console.log('Handling subdomain profile for:', subdomain);
    try {
      return await handleSubdomainProfile(subdomain, url);
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

  // 5. Serve static content with SPA fallback (handled by PublisherServer config)
  const response = await publisherServer.serveRequest(request);
  if (response != null) {
    return response;
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
 * Redirects to the main app's profile page for that user.
 */
async function handleSubdomainProfile(subdomain, url) {
  const store = new KVStore('divine-names');
  const entry = await store.get(`user:${subdomain}`);
  
  if (!entry) {
    return new Response('Profile not found', { status: 404 });
  }

  const userData = JSON.parse(await entry.text());
  
  if (userData.status !== 'active' || !userData.pubkey) {
    return new Response('Profile not found', { status: 404 });
  }

  // Convert hex pubkey to npub for the profile URL
  const npub = hexToNpub(userData.pubkey);
  
  // Find the apex domain from the current hostname
  let apexDomain = 'dvine.video'; // default
  for (const apex of APEX_DOMAINS) {
    if (url.hostname.endsWith(apex)) {
      apexDomain = apex;
      break;
    }
  }

  // Redirect to profile page
  const profileUrl = `https://${apexDomain}/profile/${npub}`;
  return Response.redirect(profileUrl, 302);
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

// ABOUTME: Minimal test handler
// ABOUTME: Tests if basic handlers work on Fastly Compute

/// <reference types="@fastly/js-compute" />
import { env } from 'fastly:env';

// eslint-disable-next-line no-restricted-globals
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
  const request = event.request;
  const url = new URL(request.url);
  
  // Debug endpoint
  if (url.pathname === '/_debug') {
    return new Response(JSON.stringify({ 
      hostname: url.hostname, 
      pathname: url.pathname,
      version: env('FASTLY_SERVICE_VERSION'),
      message: 'Hello from simple handler!'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Not Found', { status: 404 });
}

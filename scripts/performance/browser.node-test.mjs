import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { auditNavigation, auditPage, discoverRoutes } from './browser.mjs';

let browser;
let server;
let origin;
const device = { name: 'desktop', context: { viewport: { width: 1440, height: 900 } } };
const syntheticPage = `<!doctype html><html data-performance-ready="true" data-performance-outcome="ready"><body>
<h1>Public synthetic content</h1><a href="/video/synthetic-item">Open synthetic video</a>
<a href="/u/synthetic-creator">Open synthetic profile</a>
<div data-testid="profile-header"><h1>Synthetic profile</h1></div>
</body></html>`;

before(async () => {
  browser = await chromium.launch();
  server = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(request.url === '/loading' ? '<h1>Loading</h1><div data-testid="video-skeleton">Loading content</div>'
      : request.url === '/empty' ? '<html data-performance-ready="true" data-performance-outcome="empty"><h1>Empty</h1></html>'
      : request.url === '/overlay' ? '<html data-performance-ready="true" data-performance-outcome="ready"><div role="dialog"><a href="/video/synthetic-item">Sign in</a></div></html>'
      : request.url === '/search?q=synthetic' ? '<html data-performance-ready="true" data-performance-outcome="ready"><main><h1>Search</h1><button aria-label="Search hashtag #synthetic, 1 video">#synthetic</button></main></html>'
      : request.url === '/video/empty-metadata' ? '<html data-performance-ready="true" data-performance-outcome="ready"><h1>Synthetic shell</h1><div data-testid="video-metadata" style="padding:8px"></div></html>'
      : request.url === '/video/gated-metadata' ? '<html data-performance-ready="true" data-performance-outcome="ready"><div class="brand-card"><a href="/u/synthetic-creator">Synthetic author</a><div data-testid="age-restricted-media-placeholder">Sign in to view</div><div data-testid="video-metadata">10 views</div></div></html>'
      : request.url === '/video/slow-synthetic' ? '<h1>Synthetic delayed video</h1><div class="brand-card"><a href="/u/synthetic-creator">Synthetic author</a><video autoplay muted width=320 height=180 onclick="this.pause()"></video></div><canvas hidden width=320 height=180></canvas><script>const canvas=document.querySelector("canvas");document.querySelector("video").play().catch(()=>{});setInterval(()=>canvas.getContext("2d").fillRect(0,0,320,180),30);setTimeout(()=>{document.querySelector("video").srcObject=canvas.captureStream(30)},6000)</script>'
      : request.url === '/delayed-discovery' ? '<h1>Synthetic discovery</h1><a href="/video/synthetic-item">Video</a><script>setTimeout(()=>{const anchor=document.createElement("a");anchor.href="/u/synthetic-creator";anchor.textContent="Creator";document.body.append(anchor)},800)</script>'
      : request.url === '/buffering-feed' ? '<h1>Synthetic feed</h1><div data-testid="video-feed-popular"><div class="brand-card"><a href="/u/synthetic-creator">Synthetic author</a><video width=320 height=180></video></div></div>'
      : request.url === '/thumbnail' ? `<h1>Synthetic thumbnails</h1><div data-testid="thumbnail-container" style="position:relative;width:320px;height:180px"><img width="320" height="180" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='green'/%3E%3C/svg%3E"><a data-testid="thumbnail-link" href="/video/synthetic-item" aria-label="Open synthetic video" style="position:absolute;inset:0"></a></div>`
      : request.url === '/feed-video' ? `<h1>Synthetic feed</h1><video autoplay muted width=320 height=180></video><canvas hidden width=320 height=180></canvas><script>const canvas=document.querySelector('canvas'); setInterval(()=>canvas.getContext('2d').fillRect(0,0,320,180),30); document.querySelector('video').srcObject=canvas.captureStream(30);</script>`
      : syntheticPage);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await browser?.close();
  if (server) { server.close(); await once(server, 'close'); }
});

const options = () => ({ origin, timeoutMs: 500, observeMs: 100 });

test('a loading shell times out and never reports content ready', async () => {
  const { row } = await auditPage(browser, options(), device, '/loading', 1);
  assert.ok(row.failures.includes('content-timeout'));
  assert.equal(row.contentReadyMs, null);
});

test('an application empty outcome fails rather than counting as populated content', async () => {
  const { row } = await auditPage(browser, options(), device, '/empty', 1);
  assert.ok(row.failures.includes('content-empty'));
  assert.equal(row.contentReadyMs, null);
});

test('login overlay links cannot satisfy readiness', async () => {
  const { row } = await auditPage(browser, options(), device, '/overlay', 1);
  assert.ok(row.failures.includes('content-timeout'));
  assert.equal(row.contentReadyMs, null);
});

test('a search with visible hashtag results can settle without a video', async () => {
  const { row } = await auditPage(browser, { ...options(), timeoutMs: 2000 }, device, '/search?q=synthetic', 1);
  assert.deepEqual(row.failures, []);
  assert.ok(row.contentReadyMs > 0);
});

test('empty and age-gated video metadata do not produce content timing', async () => {
  for (const path of ['/video/empty-metadata', '/video/gated-metadata']) {
    const { row } = await auditPage(browser, options(), device, path, 1);
    assert.ok(row.failures.includes('content-timeout'));
    assert.equal(row.contentReadyMs, null);
  }
});

test('visible content and actual discovery links produce measurements without leaking identities', async () => {
  const { row, links } = await auditPage(browser, { ...options(), timeoutMs: 2000 }, device, '/discovery', 1);
  assert.deepEqual(row.failures, []);
  assert.ok(row.contentReadyMs > 0);
  assert.ok(row.lcpMs > 0);
  assert.equal(row.readinessSource, 'application-marker');
  assert.deepEqual(links, { video: '/video/synthetic-item', profile: '/u/synthetic-creator' });
  assert.ok(!JSON.stringify(row).includes('synthetic-creator'));
});

test('discovery rejects off-origin links and falls back to existing profile routes', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    await page.setContent('<a href="https://untrusted.invalid/video/private">External</a><a href="/profile/synthetic-profile">Profile</a>');
    assert.deepEqual(await discoverRoutes(page, origin), { video: null, profile: '/profile/synthetic-profile' });
  } finally { await page.close(); }
});


test('an internal-link journey rejects a hard reload instead of claiming SPA timing', async () => {
  const row = await auditNavigation(browser, { ...options(), timeoutMs: 2000 }, device);
  assert.ok(row.failures.includes('internal-link-hard-reloaded'));
  assert.equal(row.lcpMs, null);
});


test('a visible advancing feed video is primary content without an onscreen metadata link', async () => {
  const { row } = await auditPage(browser, { ...options(), timeoutMs: 2000 }, device, '/feed-video', 1);
  assert.deepEqual(row.failures, []);
  assert.ok(row.contentReadyMs > 0);
});


test('a loaded thumbnail sibling of an empty stretched link is populated content', async () => {
  const { row } = await auditPage(browser, { ...options(), timeoutMs: 2000 }, device, '/thumbnail', 1);
  assert.deepEqual(row.failures, []);
  assert.ok(row.contentReadyMs > 0);
});

test('the mobile slow-network preset is applied through the browser protocol', async () => {
  const { row } = await auditPage(browser, { ...options(), timeoutMs: 4000, throttle: true }, { ...device, name: 'mobile' }, '/discovery', 1);
  assert.deepEqual(row.failures, []);
  assert.equal(row.throttled, true);
  assert.ok(row.ttfbMs >= 100);
});


test('populated feed author metadata can settle before a media frame loads', async () => {
  const { row } = await auditPage(browser, options(), device, '/buffering-feed', 1);
  assert.deepEqual(row.failures, []);
  assert.ok(row.contentReadyMs > 0);
  assert.equal(row.firstAdvancingVideoMs, null);
});


test('discovery waits for a delayed profile link within the navigation budget', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/delayed-discovery`);
    const { waitForRoutes } = await import('./browser.mjs');
    const links = await waitForRoutes(page, origin, Date.now() + 2000);
    assert.equal(links.profile, '/u/synthetic-creator');
  } finally { await page.close(); }
});


test('video playback uses the remaining configured budget beyond five seconds', async () => {
  const { row } = await auditPage(browser, { ...options(), timeoutMs: 8500 }, device, '/video/slow-synthetic', 1);
  assert.deepEqual(row.failures, []);
  assert.ok(row.contentReadyMs < 5000);
  assert.ok(row.firstAdvancingVideoMs >= 6000);
  assert.equal(row.playback, 'autoplay');
});

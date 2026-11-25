import { isExpectedRoute, normalizeRoute, outcomeFailure, redactRequest } from './report.mjs';

export function installObservers() {
  const state = { lcpMs: null, cls: null, longTaskCount: null, blockingTimeMs: null,
    firstAdvancingVideoMs: null, contentReadyMs: null, readinessSource: null, outcome: null };
  window.__publicPerformanceAudit = state;
  const observers = [];
  const observe = (type, callback) => {
    if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
    const observer = new PerformanceObserver(list => callback(list.getEntries()));
    observer.observe({ type, buffered: true });
    observers.push(observer);
  };
  let windowStart;
  let previousShift = 0;
  let windowScore = 0;
  observe('largest-contentful-paint', entries => { state.lcpMs = entries.at(-1).startTime; });
  if (PerformanceObserver.supportedEntryTypes.includes('layout-shift')) state.cls = 0;
  observe('layout-shift', entries => {
    for (const entry of entries) {
      if (entry.hadRecentInput) continue;
      if (windowStart === undefined || entry.startTime - previousShift >= 1000 || entry.startTime - windowStart >= 5000) {
        windowStart = entry.startTime;
        windowScore = 0;
      }
      windowScore += entry.value;
      previousShift = entry.startTime;
      state.cls = Math.max(state.cls, windowScore);
    }
  });
  if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
    state.longTaskCount = 0;
    state.blockingTimeMs = 0;
  }
  observe('longtask', entries => {
    state.longTaskCount += entries.length;
    state.blockingTimeMs += entries.reduce((total, entry) => total + Math.max(0, entry.duration - 50), 0);
  });
  state.stop = () => observers.forEach(observer => observer.disconnect());
  const times = new WeakMap();
  const poll = () => {
    if (state.playbackPath && location.pathname !== state.playbackPath) { requestAnimationFrame(poll); return; }
    for (const video of document.querySelectorAll('video')) {
      const rect = video.getBoundingClientRect();
      const style = getComputedStyle(video);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      if (!video.paused && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight) {
        const previous = times.get(video);
        if (previous !== undefined && video.currentTime > previous + 0.02 && state.firstAdvancingVideoMs === null) {
          state.firstAdvancingVideoMs = performance.now() - (state.startedAt ?? 0);
        }
        if (previous === undefined) times.set(video, video.currentTime);
      }
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

export function inspectContent(route) {
  const visible = element => {
    if (!element || element.closest('[aria-hidden="true"], [hidden], [inert], [data-testid*="skeleton"], [role="dialog"], [role="alertdialog"], .animate-pulse')) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight || style.visibility === 'hidden' || style.display === 'none') return false;
    const x = (Math.max(0, rect.left) + Math.min(innerWidth - 1, rect.right)) / 2;
    const y = (Math.max(0, rect.top) + Math.min(innerHeight - 1, rect.bottom)) / 2;
    const point = document.elementFromPoint(x, y);
    return point && (element.contains(point) || point.contains(element));
  };
  const populated = element => visible(element) && (element.textContent.trim() || [...element.querySelectorAll('img')].some(img => img.complete && img.naturalWidth > 0));
  const loadedVideo = [...document.querySelectorAll('video')].some(video => video.readyState >= 2 && visible(video));
  const thumbnail = [...document.querySelectorAll('[data-testid="thumbnail-container"]')].some(container =>
    visible(container) && container.querySelector('a[data-testid="thumbnail-link"]') && [...container.querySelectorAll('img, video')].some(media =>
      media.tagName === 'IMG' ? media.complete && media.naturalWidth > 0 : media.readyState >= 2));
  const feedMetadata = [...document.querySelectorAll('[data-testid^="video-feed"] .brand-card')].some(card =>
    !card.querySelector('[data-testid="age-restricted-media-placeholder"]') && card.querySelector('video, [data-testid="video-thumbnail"]') &&
    [...card.querySelectorAll('a[href*="/u/"], a[href*="/profile/"]')].some(populated));
  const searchResult = route.split('?')[0] === '/search' &&
    [...document.querySelectorAll('main button[aria-label^="Search hashtag #"], main [role="button"][aria-label^="View profile of "]')].some(populated);
  const primary = route.startsWith('/profile/') || route.startsWith('/u/')
    ? [...document.querySelectorAll('[data-testid="profile-header"] h1')].some(populated)
    : route.startsWith('/video/')
      ? [...document.querySelectorAll('video, [data-testid="video-metadata"]')].some(visible)
      : loadedVideo || thumbnail || feedMetadata || searchResult || [...document.querySelectorAll('a[href*="/video/"]')].some(populated);
  const state = window.__publicPerformanceAudit;
  const marker = document.documentElement.dataset.performanceReady;
  const outcome = document.documentElement.dataset.performanceOutcome;
  if (marker !== undefined) {
    if (['empty', 'error', 'timeout', 'cancelled'].includes(outcome)) return { outcome, source: 'application-marker' };
    if (marker !== 'true' || !primary || (outcome && outcome !== 'ready')) return null;
  } else if (!primary) return null;
  state.contentReadyMs ??= performance.now() - (state.startedAt ?? 0);
  state.readinessSource = marker !== undefined ? 'application-marker' : 'visible-primary-content';
  return { outcome: 'ready', source: state.readinessSource };
}

export async function waitForRoutes(page, origin, deadline, required = ['video', 'profile']) {
  let links = await discoverRoutes(page, origin);
  while (required.some(key => !links[key]) && Date.now() < deadline) {
    await page.waitForTimeout(Math.min(100, Math.max(1, deadline - Date.now())));
    links = await discoverRoutes(page, origin);
  }
  return links;
}

export async function discoverRoutes(page, origin) {
  const hrefs = await page.locator('a[href]').evaluateAll(elements => elements.map(element => element.href));
  const paths = hrefs.flatMap(href => {
    try { const url = new URL(href); return url.origin === origin ? [url.pathname] : []; } catch { return []; }
  });
  return {
    video: paths.find(path => /^\/video\/[^/]+\/?$/.test(path)) ?? null,
    profile: paths.find(path => /^\/u\/[^/]+\/?$/.test(path))
      ?? paths.find(path => /^\/profile\/[^/]+\/?$/.test(path)) ?? null,
  };
}

function collectNetwork(page) {
  const failures = new Map();
  const add = (url, status) => {
    const record = redactRequest(url, status);
    if (failures.size < 50) failures.set(JSON.stringify(record), record);
  };
  page.on('response', response => { if (response.status() >= 400) add(response.url(), response.status()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') add(request.url(), 'network-error');
  });
  return failures;
}

async function measurePlayback(page, row, deadline) {
  if (row.firstAdvancingVideoMs !== null) { row.playback = 'autoplay'; return; }
  if (row.route !== '/video/:id' || row.failures.length) { row.playback = 'not-observed'; return; }
  try {
    if (Date.now() >= deadline) throw new Error('Playback budget exhausted');
    const video = page.locator('video').first();
    const alreadyPlaying = await video.count() && await video.evaluate(element => !element.paused);
    if (!alreadyPlaying) {
      const playButton = page.getByRole('button', { name: /^play(?: video)?$/i }).first();
      if (await playButton.isVisible()) await playButton.click({ timeout: Math.min(1000, Math.max(1, deadline - Date.now())) });
      else await video.click({ timeout: Math.min(1000, Math.max(1, deadline - Date.now())) });
    }
    await page.waitForFunction(() => window.__publicPerformanceAudit.firstAdvancingVideoMs !== null, null, { timeout: Math.max(1, deadline - Date.now()) });
    row.firstAdvancingVideoMs = await page.evaluate(() => window.__publicPerformanceAudit.firstAdvancingVideoMs);
    row.playback = alreadyPlaying ? 'autoplay' : 'after-play-interaction';
  } catch {
    row.playback = 'not-advancing';
    row.failures.push('video-not-advancing');
  }
}

export async function auditPage(browser, options, device, path, sample) {
  const context = await browser.newContext({ ...device.context, serviceWorkers: 'block', locale: 'en-US', colorScheme: 'light' });
  const row = { route: normalizeRoute(path), device: device.name, sample, mode: 'cold', throttled: Boolean(options.throttle && device.name === 'mobile'), failures: [], lcpMs: null,
    cls: null, ttfbMs: null, contentReadyMs: null, firstAdvancingVideoMs: null, longTaskCount: null, blockingTimeMs: null };
  let links = null;
  try {
    const page = await context.newPage();
    const network = collectNetwork(page);
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await configureNetwork(session, options, device);
    await page.addInitScript(installObservers);
    const deadline = Date.now() + options.timeoutMs;
    const response = await page.goto(`${options.origin}${path}`, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    row.httpStatus = response?.status() ?? null;
    if (!response?.ok()) row.failures.push('navigation-http-error');
    if (new URL(page.url()).origin !== options.origin || !isExpectedRoute(path, page.url())) row.failures.push('unexpected-redirect');
    let result;
    try {
      const handle = await page.waitForFunction(inspectContent, path, { timeout: Math.max(1, deadline - Date.now()), polling: 100 });
      result = await handle.jsonValue();
      await handle.dispose();
    } catch { result = { outcome: 'timeout', source: 'none' }; }
    row.outcome = result.outcome;
    row.readinessSource = result.source;
    const failure = outcomeFailure(result.outcome);
    if (failure) row.failures.push(failure);
    await page.waitForTimeout(options.observeMs);
    const metrics = await page.evaluate(() => {
      const state = window.__publicPerformanceAudit;
      state.stop();
      const navigation = performance.getEntriesByType('navigation')[0];
      return Object.fromEntries(['lcpMs', 'cls', 'contentReadyMs', 'firstAdvancingVideoMs', 'longTaskCount', 'blockingTimeMs']
        .map(key => [key, state[key]]).concat([['ttfbMs', navigation ? navigation.responseStart - navigation.startTime : null]]));
    });
    Object.assign(row, metrics);
    if (row.lcpMs === null) row.failures.push('lcp-not-observed');
    if (row.route === '/discovery' && row.outcome === 'ready') links = await waitForRoutes(page, options.origin, deadline);
    await measurePlayback(page, row, deadline);
    row.networkFailures = [...network.values()];
  } catch (error) {
    row.failures.push(error.name === 'TimeoutError' ? 'navigation-timeout' : 'navigation-failed');
  } finally { await context.close(); }
  return { row, links };
}

async function configureNetwork(session, options, device) {
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (options.throttle && device.name === 'mobile') {
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 150,
      downloadThroughput: 1600000 / 8, uploadThroughput: 750000 / 8, connectionType: 'cellular4g' });
    await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
}

export async function auditNavigation(browser, options, device) {
  const context = await browser.newContext({ ...device.context, serviceWorkers: 'block', locale: 'en-US', colorScheme: 'light' });
  const row = { route: '/video/:id', device: device.name, mode: 'soft-navigation', sample: 1,
    throttled: Boolean(options.throttle && device.name === 'mobile'), failures: [], lcpMs: null, cls: null,
    ttfbMs: null, longTaskCount: null, blockingTimeMs: null, contentReadyMs: null, firstAdvancingVideoMs: null };
  try {
    const page = await context.newPage();
    const network = collectNetwork(page);
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await configureNetwork(session, options, device);
    await page.addInitScript(installObservers);
    const sourceDeadline = Date.now() + options.timeoutMs;
    await page.goto(`${options.origin}/discovery`, { waitUntil: 'domcontentloaded', timeout: options.timeoutMs });
    const source = await page.waitForFunction(inspectContent, '/discovery', { timeout: Math.max(1, sourceDeadline - Date.now()) });
    if ((await source.jsonValue()).outcome !== 'ready') { row.failures.push('source-content-missing'); return row; }
    const { video } = await waitForRoutes(page, options.origin, sourceDeadline, ['video']);
    if (!video) { row.failures.push('discovery-link-missing'); return row; }
    const links = page.locator('a[href]');
    const destination = { origin: options.origin, path: video };
    const index = await links.evaluateAll((elements, { origin, path }) =>
      elements.findIndex(element => element.origin === origin && element.pathname === path), destination);
    if (index === -1) { row.failures.push('discovery-link-missing'); return row; }
    const deadline = Date.now() + options.timeoutMs;
    const timeOrigin = await page.evaluate(({ origin, path }) => {
      const state = window.__publicPerformanceAudit;
      state.stop();
      const start = event => {
        const link = event.target.closest?.('a[href]');
        if (link?.origin !== origin || link.pathname !== path) return;
        state.startedAt = event.timeStamp;
        state.playbackPath = path;
        state.firstAdvancingVideoMs = null;
        state.contentReadyMs = null;
        document.removeEventListener('click', start, true);
      };
      document.addEventListener('click', start, true);
      return performance.timeOrigin;
    }, destination);
    await links.nth(index).click({ timeout: Math.max(1, deadline - Date.now()) });
    await page.waitForFunction(path => location.pathname === path, video, { timeout: Math.max(1, deadline - Date.now()) });
    if (await page.evaluate(() => performance.timeOrigin) !== timeOrigin) {
      row.failures.push('internal-link-hard-reloaded');
      return row;
    }
    const ready = await page.waitForFunction(inspectContent, video, { timeout: Math.max(1, deadline - Date.now()) });
    const result = await ready.jsonValue();
    row.outcome = result.outcome;
    row.readinessSource = result.source;
    const failure = outcomeFailure(result.outcome);
    if (failure) row.failures.push(failure);
    await page.waitForTimeout(options.observeMs);
    Object.assign(row, await page.evaluate(() => ({ contentReadyMs: window.__publicPerformanceAudit.contentReadyMs,
      firstAdvancingVideoMs: window.__publicPerformanceAudit.firstAdvancingVideoMs })));
    await measurePlayback(page, row, deadline);
    row.networkFailures = [...network.values()];
  } catch (error) { row.failures.push(error.name === 'TimeoutError' ? 'navigation-timeout' : 'navigation-failed'); }
  finally { await context.close(); }
  return row;
}

export const METRICS = ['lcpMs', 'cls', 'ttfbMs', 'contentReadyMs', 'firstAdvancingVideoMs', 'longTaskCount', 'blockingTimeMs'];
const SERVICE_HOSTS = new Set(['divine.video', 'api.divine.video', 'relay.divine.video', 'media.divine.video', 'blossom.divine.video', 'cdn.divine.video', 'static.divine.video']);
export const BUDGETS = { lcpMs: 2500, cls: 0.1, ttfbMs: 800 };

export function percentile(values, fraction) {
  const measured = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  return measured.length ? measured[Math.max(0, Math.ceil(measured.length * fraction) - 1)] : null;
}

export function summarize(samples) {
  const groups = Map.groupBy ? Map.groupBy(samples, row => `${row.device}:${row.route}:${row.mode ?? "cold"}`) : samples.reduce((map, row) => {
    const key = `${row.device}:${row.route}:${row.mode ?? "cold"}`;
    map.set(key, [...(map.get(key) ?? []), row]);
    return map;
  }, new Map());
  return [...groups.values()].map(rows => {
    const metrics = Object.fromEntries(METRICS.map(key => {
      const applicable = rows[0].mode !== 'soft-navigation' || ['contentReadyMs', 'firstAdvancingVideoMs'].includes(key);
      const values = rows.map(row => row[key]);
      const measured = values.filter(Number.isFinite).length;
      return [key, { p75: applicable ? percentile(values, 0.75) : null, applicable, measured: applicable ? measured : 0, missing: applicable ? rows.length - measured : 0 }];
    }));
    const warnings = Object.entries(BUDGETS).filter(([key, budget]) => metrics[key].p75 > budget)
      .map(([key]) => `${key === 'lcpMs' ? 'lcp' : key === 'ttfbMs' ? 'ttfb' : 'cls'}-target-exceeded`);
    if (rows.length < 20) warnings.push('small-sample-count');
    if (metrics.lcpMs.missing) warnings.push('missing-lcp');
    return { route: rows[0].route, device: rows[0].device, mode: rows[0].mode ?? 'cold', samples: rows.length,
      failedSamples: rows.filter(row => row.failures.length).length, metrics, warnings };
  });
}

export function normalizeRoute(value) {
  const path = new URL(value, 'https://example.invalid').pathname;
  if (['/', '/discovery', '/popular'].includes(path)) return path;
  if (/^\/discovery\/[^/]+\/?$/.test(path)) return '/discovery/:tab';
  if (path === '/search') return '/search?q=:query';
  for (const [prefix, parameter] of [['video', 'id'], ['u', 'name'], ['profile', 'id']]) {
    if (new RegExp(`^/${prefix}/[^/]+/?$`).test(path)) return `/${prefix}/:${parameter}`;
  }
  return '/:path';
}

export function redactRequest(value, status) {
  try {
    const url = new URL(value);
    const known = url.pathname.match(/^\/api\/(videos|users)(?:\/[^/]+)?(?:\/(videos|followers|following))?\/?$/);
    let path = normalizeRoute(url.pathname);
    if (known) {
      const segments = url.pathname.split('/').filter(Boolean);
      path = `/api/${known[1]}${segments.length > 2 ? '/:id' : ''}${known[2] ? `/${known[2]}` : ''}`;
    }
    const origin = ['http:', 'https:'].includes(url.protocol) && SERVICE_HOSTS.has(url.hostname) ? `${url.protocol}//${url.hostname}`
      : ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? 'local-origin' : 'external-origin';
    return { origin, path, status };
  } catch { return { origin: 'unavailable', path: '/:path', status }; }
}

export function outcomeFailure(outcome) {
  return outcome === 'ready' ? null : `content-${['empty', 'error', 'timeout', 'cancelled'].includes(outcome) ? outcome : 'missing'}`;
}

function integer(value, name, fallback, min, max) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`Invalid ${name}`);
  return number;
}

export function parseOptions(args, env = process.env) {
  const options = {};
  const names = ['origin', 'output', 'samples', 'timeout-ms', 'observe-ms', 'search'];
  for (let index = 0; index < args.length; index++) {
    const key = args[index].replace(/^--/, '');
    if (key === 'strict' || key === 'throttle') options[key] = true;
    else if (names.includes(key) && args[index + 1] && !args[index + 1].startsWith('--')) options[key] = args[++index];
    else throw new Error('Unknown or incomplete option; run with --help');
  }
  const origin = new URL(options.origin ?? env.PERFORMANCE_ORIGIN ?? 'https://divine.video');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Origin must be an HTTP(S) origin without credentials, path, query, or fragment');
  }
  return {
    origin: origin.origin, output: options.output ?? env.PERFORMANCE_OUTPUT ?? 'performance-results',
    samples: integer(options.samples ?? env.PERFORMANCE_SAMPLES, 'samples', 3, 1, 10),
    timeoutMs: integer(options['timeout-ms'] ?? env.PERFORMANCE_TIMEOUT_MS, 'timeout-ms', 30000, 500, 60000),
    observeMs: integer(options['observe-ms'] ?? env.PERFORMANCE_OBSERVE_MS, 'observe-ms', 5000, 100, 15000),
    search: options.search ?? env.PERFORMANCE_SEARCH ?? 'funny',
    strict: options.strict ?? env.PERFORMANCE_STRICT === 'true',
    throttle: options.throttle ?? env.PERFORMANCE_THROTTLE === 'true',
  };
}

export function renderMarkdown(report) {
  const format = value => value === null ? 'missing' : Number(value.toFixed(2));
  const metric = value => value.applicable === false ? 'N/A' : format(value.p75);
  const rows = report.summary.map(row => `| ${row.device} | ${row.mode} | ${row.route} | ${row.samples} | ${row.failedSamples} | ${metric(row.metrics.lcpMs)} | ${row.metrics.lcpMs.applicable ? `${row.metrics.lcpMs.measured}/${row.samples}` : 'N/A'} | ${metric(row.metrics.cls)} | ${metric(row.metrics.ttfbMs)} | ${format(row.metrics.contentReadyMs.p75)} | ${format(row.metrics.firstAdvancingVideoMs.p75)} | ${metric(row.metrics.blockingTimeMs)} | ${row.warnings.join(', ') || 'none'} |`);
  const network = new Map();
  for (const record of report.samples.flatMap(row => row.networkFailures ?? [])) {
    const key = JSON.stringify(record);
    network.set(key, { ...record, observations: (network.get(key)?.observations ?? 0) + 1 });
  }
  const networkRows = [...network.values()].sort((a, b) => b.observations - a.observations).slice(0, 50)
    .map(record => `| ${record.origin} | ${record.path} | ${record.status} | ${record.observations} |`);
  const background = networkRows.length ? `| Service origin | Path template | Status | Sample observations |\n|---|---|---|---:|\n${networkRows.join('\n')}` : 'None observed.';
  const failures = report.samples.filter(row => row.failures.length).map(row => `- ${row.device} ${row.mode ?? 'cold'} ${row.route}, sample ${row.sample}: ${row.failures.join(', ')}`);
  return `# Public site performance audit\n\nOrigin: ${report.origin}\n\n${report.generatedAt}; Chromium ${report.browserVersion}. Fresh anonymous context per cold load or navigation journey; HTTP cache and service workers disabled. Desktop 1440×900 and Pixel 7 mobile emulation; ${report.configuration.throttle ? 'Mobile preset: 150 ms added latency, 1.6 Mbps down, 750 kbps up, 4× CPU slowdown via Chromium CDP; desktop unthrottled.' : 'No CPU/network throttling.'} Search values, dynamic identifiers, request bodies and raw error messages are omitted.\n\nNearest-rank p75 across measured samples (missing values excluded and counted). LCP target ≤2500 ms; CLS ≤0.1; TTFB ≤800 ms. Thresholds are ${report.strict ? 'strict' : 'advisory'}. Fewer than 20 runs per route/device is a small diagnostic sample, not field Web Vitals p75. No baseline comparison is implied.\n\n| Device | Mode | Route | Samples | Failed | LCP p75 ms | LCP coverage | CLS p75 | TTFB p75 ms | Content ready p75 ms | Advancing video p75 ms | Blocking time p75 ms | Warnings |\n|---|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---|\n${rows.join('\n')}\n\n## Failures\n\n${failures.join('\n') || 'None.'}\n\n## Background request failures\n\n${background}\n\nRecords are deduplicated within each sample; this table shows up to 50 origin/path/status combinations. Background failures are reported separately from primary-page failures.\n\n## Measurement limits\n\nCold runs use fresh contexts. One additional discovery→video internal-link journey per device checks client-side navigation, with content/playback times relative to click; a hard reload fails that journey. Native LCP, CLS, TTFB and long tasks are N/A for these soft navigations, rather than reusing initial-page metrics. LCP/CLS are bounded navigation observations, not full-session field measurements. CLS uses maximum session windows (1 second gap, 5 seconds maximum). Long tasks and blocking time cover the same bounded window. Content readiness prefers the application marker and also requires visible populated primary content; older deployments use explicit populated card metadata, loaded thumbnail/video or profile selectors. Content timing measures painted data; media advancement is reported separately. Empty, error, loading, login and gated overlays cannot satisfy content readiness. Autoplay observations are separate from content. On a video detail route only, missing autoplay triggers one play interaction after the LCP measurement window; its result is labeled separately. First advancing video requires visible media time to advance, not just a play event. Feed/profile pages need not autoplay. Network failures are bounded, deduplicated service-origin/template/status records; origins outside the public Divine service allowlist are anonymized as external-origin (including personal subdomains and identity domains).\n`;
}

export function isExpectedRoute(requested, actual) {
  const source = normalizeRoute(requested);
  const destination = normalizeRoute(actual);
  return source === destination || (['/', '/discovery'].includes(source) && ['/discovery', '/discovery/:tab'].includes(destination));
}

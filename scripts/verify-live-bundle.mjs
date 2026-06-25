// ABOUTME: Post-deploy guardrail — confirms the live origin actually serves the
// ABOUTME: freshly built entry bundle, so a green deploy can't silently serve stale assets.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vite emits a single hashed module entry as <script type="module" src="/assets/index-<hash>.js">.
// Other chunks are referenced via <link rel="modulepreload">, which we ignore (we only match
// <script src>). Assumes a single-entry SPA with no @vitejs/plugin-legacy: a `nomodule`
// polyfill <script> would precede the entry and be matched instead. Revisit if that plugin
// is ever added (vite.config.ts plugins is currently just react()).
const ENTRY_SCRIPT_RE = /<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["'][^>]*>/i;

// Per-request ceiling so a hung origin (connection accepted, no response — the brownout
// class this guard targets) counts as a failed attempt and retries, rather than blocking
// the await until the GitHub Actions job timeout.
const FETCH_TIMEOUT_MS = 10000;

/**
 * Extract the hashed entry bundle path (e.g. "/assets/index-CkdwgBUK.js") from an
 * index.html string. Returns null when no entry <script> is present.
 */
export function extractEntryScript(html) {
  const match = typeof html === 'string' ? html.match(ENTRY_SCRIPT_RE) : null;
  return match ? match[1] : null;
}

/**
 * Poll each live origin until it serves the expected entry bundle, or fail.
 *
 * `index.html` is served `cache-control: no-store` and requested with
 * `Cache-Control: no-cache` so verification reads through the Compute worker/KV.
 * The retry budget only covers KV propagation. A persistent mismatch means the
 * deploy reported success while the edge keeps serving a stale bundle.
 */
export async function verifyLiveBundle({
  expected,
  urls,
  fetchImpl = fetch,
  attempts = 18,
  delayMs = 20000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = () => {},
}) {
  if (!expected) {
    throw new Error('verifyLiveBundle: expected entry bundle is required');
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error('verifyLiveBundle: at least one url is required');
  }

  for (const url of urls) {
    let lastObserved = 'none';
    let matched = false;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetchImpl(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (response.ok) {
          const served = extractEntryScript(await response.text());
          if (served === expected) {
            // The index.html pointer converged — but it and the hashed JS bundle
            // resolve through the same KV index, and the bundle blob can lag the
            // pointer (eventually-consistent KV) or be a swallowed dropped upload.
            // Confirm the referenced asset is actually fetchable on this origin,
            // not just that the pointer names it.
            const assetUrl = new URL(expected, url).href;
            const assetResponse = await fetchImpl(assetUrl, {
              method: 'GET',
              cache: 'no-store',
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            if (assetResponse.ok) {
              log(`[verify-live-bundle] ${url} serves ${expected} and the asset is reachable (attempt ${attempt}/${attempts})`);
              matched = true;
              break;
            }
            lastObserved = `entry ${expected} but asset HTTP ${assetResponse.status}`;
            log(`[verify-live-bundle] ${url} ${lastObserved} (attempt ${attempt}/${attempts})`);
          } else {
            lastObserved = served ?? 'no entry script';
            log(`[verify-live-bundle] ${url} served ${lastObserved}, expected ${expected} (attempt ${attempt}/${attempts})`);
          }
        } else {
          lastObserved = `HTTP ${response.status}`;
          log(`[verify-live-bundle] ${url} returned ${lastObserved} (attempt ${attempt}/${attempts})`);
        }
      } catch (err) {
        lastObserved = `fetch error: ${err?.message ?? err}`;
        log(`[verify-live-bundle] ${url} ${lastObserved} (attempt ${attempt}/${attempts})`);
      }

      if (attempt < attempts) {
        await sleep(delayMs);
      }
    }

    if (!matched) {
      throw new Error(
        `Live bundle mismatch at ${url}: expected ${expected}, last observed ${lastObserved} ` +
        `after ${attempts} attempts. The deploy reported success but the edge is serving a stale bundle.`,
      );
    }
  }

  return { ok: true, expected, urls };
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const distIndex = path.join(projectRoot, 'dist', 'index.html');

  const html = await readFile(distIndex, 'utf8');
  const expected = extractEntryScript(html);
  if (!expected) {
    console.error(`✗ Could not find a hashed entry bundle in ${distIndex}`);
    process.exit(1);
  }

  const urls = (process.env.VERIFY_BUNDLE_URLS ?? 'https://divine.video/,https://www.divine.video/')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const numberFromEnv = (name, fallback) => {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  // ~6 min of sleeps (18 x 20s), plus up to two fetches per attempt (index.html
  // + the referenced asset, each bounded by FETCH_TIMEOUT_MS). Only the failure
  // path waits; a healthy deploy passes on the first attempt. Sized to outlast
  // Fastly KV propagation of the new index after publish (the publisher's own
  // blob-upload retries run earlier, inside publish-content, so they don't eat
  // this budget).
  const attempts = numberFromEnv('VERIFY_BUNDLE_ATTEMPTS', 18);
  const delayMs = numberFromEnv('VERIFY_BUNDLE_DELAY_MS', 20000);

  try {
    await verifyLiveBundle({ expected, urls, attempts, delayMs, log: (message) => console.log(message) });
    console.log(`✓ Live origins serve the freshly built bundle ${expected}`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }
}

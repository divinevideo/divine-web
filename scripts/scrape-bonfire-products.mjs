// Scrape product cards from bonfire.com/store/divine-18/ and write to
// src/data/merchProducts.json. Run via: npm run merch:scrape
//
// We can't iframe Bonfire (X-Frame-Options: SAMEORIGIN) and their JSON API is
// auth-gated, so we render the storefront in a headless browser and pull
// product data out of the rendered DOM + intercepted XHR responses.

import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_URL = 'https://www.bonfire.com/store/divine-18/';
const OUTPUT = resolve(__dirname, '../src/data/merchProducts.json');

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36',
    viewport: { width: 1280, height: 1800 },
  });
  const page = await context.newPage();

  /** @type {Array<{url: string, body: any}>} */
  const apiResponses = [];
  page.on('response', async (res) => {
    const url = res.url();
    const ct = res.headers()['content-type'] ?? '';
    if (!ct.includes('application/json')) return;
    if (!/bonfire\.com\/api\//i.test(url)) return;
    try {
      const body = await res.json();
      apiResponses.push({ url, body });
    } catch {
      /* ignore non-json bodies */
    }
  });

  console.log(`Loading ${STORE_URL} ...`);
  await page.goto(STORE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  // Give lazy-loaded grids a chance to settle
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  console.log(`Captured ${apiResponses.length} JSON XHRs.`);

  // --- Strategy 1: pull from intercepted Bonfire API responses ---
  /** @type {Array<{name: string, url: string, image: string, price?: string}>} */
  const fromApi = [];
  for (const { url, body } of apiResponses) {
    const candidates = collectProductCandidates(body);
    for (const c of candidates) {
      if (c.name && c.url) fromApi.push(c);
    }
    if (candidates.length) console.log(`  ${candidates.length} products from ${url}`);
  }

  // --- Strategy 2: scrape rendered DOM (Bonfire is Angular; products are <a><h3 class="sw-CampaignTitle"> ...) ---
  const fromDom = await page.$$eval('h3.sw-CampaignTitle', (titles) => {
    /** @type {Array<{name: string, url: string, image: string, price?: string}>} */
    const out = [];
    const seen = new Set();
    for (const h3 of titles) {
      const anchor = h3.closest('a');
      const href = anchor?.getAttribute('href') ?? '';
      if (!href) continue;
      // Resolve against the storefront base
      const url = href.startsWith('http')
        ? href
        : new URL(href, 'https://www.bonfire.com/store/divine-18/').toString();
      if (seen.has(url)) continue;
      const name = (h3.textContent ?? '').trim();
      if (!name) continue;
      // Find a sibling/descendant image inside the same campaign container
      const container = anchor?.closest('[ng-repeat], .sw-ProdCard_New, .sw-ProductSlider') ?? anchor;
      let image = '';
      const imgEl = container?.querySelector('img');
      if (imgEl) {
        image =
          imgEl.getAttribute('src') ??
          imgEl.getAttribute('data-src') ??
          imgEl.getAttribute('data-lazy-src') ??
          '';
      }
      seen.add(url);
      out.push({ name, url, image });
    }
    return out;
  });

  const merged = dedupeByUrl([...fromApi, ...fromDom]);
  console.log(`Total: ${merged.length} products (api=${fromApi.length}, dom=${fromDom.length})`);

  if (merged.length === 0) {
    const snapshotPath = resolve(__dirname, '../scripts/.bonfire-snapshot.html');
    await writeFile(snapshotPath, await page.content(), 'utf8');
    console.error(`No products found. Wrote rendered HTML to ${snapshotPath} for inspection.`);
    process.exitCode = 1;
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  const payload = {
    storeUrl: STORE_URL,
    scrapedAt: new Date().toISOString(),
    products: merged,
  };
  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${merged.length} products to ${OUTPUT}`);

  await browser.close();
}

function collectProductCandidates(node, acc = []) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectProductCandidates(item, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;

  // Heuristic: an object with a productUrl/url + name/title + image-ish field
  const url = pick(node, ['productUrl', 'product_url', 'url', 'shareUrl', 'shopUrl']);
  const name = pick(node, ['name', 'title', 'productName', 'campaignTitle']);
  const image = pick(node, ['imageUrl', 'image', 'thumbUrl', 'thumbnailUrl', 'frontImage', 'mainImage']);
  const price = pick(node, ['price', 'displayPrice', 'priceFormatted', 'minPrice']);
  if (typeof url === 'string' && typeof name === 'string' && (typeof image === 'string' || image == null)) {
    if (/bonfire\.com|^\/[a-z0-9-]+/i.test(url)) {
      acc.push({
        name,
        url: url.startsWith('http') ? url : `https://www.bonfire.com${url}`,
        image: typeof image === 'string' ? image : '',
        price: price ? String(price) : undefined,
      });
    }
  }

  for (const key of Object.keys(node)) {
    collectProductCandidates(node[key], acc);
  }
  return acc;
}

function pick(obj, keys) {
  for (const k of keys) if (obj[k] != null) return obj[k];
  return undefined;
}

function dedupeByUrl(items) {
  const seen = new Map();
  for (const item of items) {
    const key = item.url.split('?')[0];
    if (!seen.has(key)) seen.set(key, item);
  }
  return [...seen.values()];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

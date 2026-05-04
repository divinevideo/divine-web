// Scrape product variants from bonfire.com/store/divine-18/ + each campaign
// detail page, write to src/data/merchProducts.json.
// Run via: npm run merch:scrape
//
// Bonfire blocks iframes (X-Frame-Options: SAMEORIGIN) and the JSON API is
// auth-gated. Two-pass scrape:
//   1. Storefront → discover campaign slugs from <h3 class="sw-CampaignTitle">.
//   2. Each campaign page → extract style variants from the
//      <div class="sw-ProductPicker"> radio-label list. Each label has:
//        - <small class="sw-ProductPicker_Title">Premium Unisex Tee</small>
//        - <span class="sw-ProductPicker_Img-product"><img …/></span>
//      The radio's `value` attribute is the style name; the picker images
//      are 150px thumbs we upgrade to /500/ for the grid card.

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

  console.log(`Loading ${STORE_URL} ...`);
  await page.goto(STORE_URL, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);

  const campaigns = await page.$$eval('h3.sw-CampaignTitle', (titles) => {
    /** @type {Array<{ name: string, slug: string, variantUrls: string[] }>} */
    const out = [];
    const seen = new Set();
    for (const h3 of titles) {
      const name = (h3.textContent ?? '').trim();
      if (!name) continue;
      const container =
        h3.closest('.sw-ProductSliderWrap, .sw-ProductSlider, .sw-ProdCard_New, [ng-repeat]') ??
        h3.parentElement;
      if (!container) continue;
      const figAnchors = Array.from(container.querySelectorAll('a.sw-ProdCard_Fig'));
      // Filter to anchors for THIS campaign's slug (exclude any cross-link).
      /** @type {string[]} */
      const variantUrls = [];
      const seenVariant = new Set();
      let slug = '';
      for (const a of figAnchors) {
        const href = a.getAttribute('href') ?? '';
        const m = href.match(/^\/([^/?#]+)\/(\?.*)?$/);
        if (!m) continue;
        if (!slug) slug = m[1];
        if (m[1] !== slug) continue;
        const fullUrl = new URL(href, 'https://www.bonfire.com/').toString();
        // Dedupe by productType (or by URL if no productType).
        const dedupeKey = new URL(fullUrl).searchParams.get('productType') ?? fullUrl;
        if (seenVariant.has(dedupeKey)) continue;
        seenVariant.add(dedupeKey);
        variantUrls.push(fullUrl);
      }
      if (!slug) continue;
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ name, slug, variantUrls });
    }
    return out;
  });

  console.log(`Found ${campaigns.length} campaigns:`, campaigns.map((c) => `${c.slug}(${c.variantUrls.length}var)`).join(', '));

  /** @type {Array<{ name: string, url: string, image: string, campaign: string, campaignTitle: string }>} */
  const allProducts = [];
  /** @type {Array<{ slug: string, error: string }>} */
  const failures = [];

  for (const campaign of campaigns) {
    const url = `https://www.bonfire.com/${campaign.slug}/`;
    console.log(`  Loading ${url} ...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(2000);

      // Pull the productType UUID for each style by reading Angular's
      // `vm.productTypes` scope on the campaign controller. The UUIDs are
      // what `?productType=<uuid>` deep links require to land users on
      // the hoodie / tank / sticker variant rather than the campaign's
      // default style.
      const productTypeMap = await page.evaluate(() => {
        // Try a couple of likely controller hosts.
        const candidates = document.querySelectorAll(
          '[ng-controller], [data-ng-controller], body, [ng-app]',
        );
        const ng = window.angular;
        if (!ng) return {};
        for (const el of candidates) {
          const scope = ng.element(el).scope?.();
          const types = scope?.vm?.productTypes;
          if (Array.isArray(types) && types.length) {
            /** @type {Record<string, string>} */
            const out = {};
            for (const pt of types) {
              const id = pt?.id ?? pt?.productTypeId ?? pt?.uuid;
              const name = pt?.name ?? pt?.type ?? pt?.title ?? pt?.products?.[0]?.type;
              if (id && name) out[String(name).trim()] = String(id);
            }
            if (Object.keys(out).length) return out;
          }
        }
        return {};
      });
      if (Object.keys(productTypeMap).length) {
        console.log(`    productType UUIDs:`, productTypeMap);
      }

      // The style picker is hidden inside slick slider; "click" each label
      // is overkill. We just read all <label> blocks under .sw-ProductPicker.
      // Bonfire renders all variant labels in the DOM up-front (slick clones
      // them); we dedupe by style title.
      const variants = await page.$$eval(
        '.sw-ProductPicker label, .sw-ProdCard_Styles label',
        (labels, ctx) => {
          /** @type {Array<{ name: string, url: string, image: string, campaign: string, campaignTitle: string }>} */
          const items = [];
          const seen = new Set();
          for (const label of labels) {
            const title =
              label.querySelector('.sw-ProductPicker_Title, .sw-ProdCard_StylesText')?.textContent?.trim() ??
              label.querySelector('input')?.getAttribute('value')?.trim() ??
              '';
            if (!title) continue;
            if (seen.has(title)) continue;

            const imgEl = label.querySelector('.sw-ProductPicker_Img-product img, img.sw-ProdCard_Img');
            const rawSrc =
              imgEl?.getAttribute('src') ??
              imgEl?.getAttribute('ng-src') ??
              imgEl?.getAttribute('data-src') ??
              '';
            if (!rawSrc || rawSrc.startsWith('data:')) continue;
            // Upgrade Bonfire CDN thumb size from /150/ → /500/ for the card.
            const image = rawSrc.replace(/\/(75|150|200|450)\/$/, '/500/');

            const productTypeId = ctx.productTypeMap[title];
            const url = productTypeId
              ? `https://www.bonfire.com/${ctx.slug}/?productType=${productTypeId}`
              : `https://www.bonfire.com/${ctx.slug}/`;
            seen.add(title);
            items.push({
              name: title,
              url,
              image,
              campaign: ctx.slug,
              campaignTitle: ctx.campaignName,
            });
          }
          return items;
        },
        { slug: campaign.slug, campaignName: campaign.name, productTypeMap },
      );

      // Fallback: if the campaign page has no style picker (single-variant
      // campaign like the bucket hat), grab the main product image and
      // emit a single entry with the campaign title.
      if (variants.length === 0) {
        const single = await page
          .$eval('img.sw-ProdCard_Img, .camp-DesktopPreview_ActiveImg', (img) => {
            const src =
              img.getAttribute('src') ?? img.getAttribute('ng-src') ?? '';
            const alt = img.getAttribute('alt') ?? '';
            return { src, alt };
          })
          .catch(() => null);
        if (single?.src) {
          variants.push({
            name: campaign.name,
            url,
            image: single.src.replace(/\/(75|150|200|450)\/$/, '/500/'),
            campaign: campaign.slug,
            campaignTitle: campaign.name,
          });
        }
      }

      // Match storefront productType URLs to campaign-page variants by index.
      // Both lists come out in the same render order (Bonfire's slick slider
      // and the .sw-ProductPicker label list both follow vm.productTypes).
      // For single-variant campaigns, this just confirms the campaign URL.
      for (let i = 0; i < variants.length; i++) {
        if (campaign.variantUrls[i]) {
          variants[i].url = campaign.variantUrls[i];
        }
      }
      console.log(
        `    ${variants.length} variant(s) for ${campaign.slug}:`,
        variants.map((v) => `${v.name} → ${v.url}`).join(' | '),
      );
      allProducts.push(...variants);
    } catch (err) {
      console.warn(`    Failed to scrape ${campaign.slug}: ${err.message}`);
      failures.push({ slug: campaign.slug, error: err.message ?? String(err) });
    }
  }

  if (allProducts.length === 0) {
    console.error('No products scraped.');
    process.exitCode = 1;
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  // Note: no `scrapedAt` field — would cause a noisy JSON diff on every run
  // even when product data is unchanged.
  const payload = {
    storeUrl: STORE_URL,
    products: allProducts,
  };
  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${allProducts.length} products to ${OUTPUT}`);

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} campaign(s) failed:`,
      failures.map((f) => `${f.slug} (${f.error})`).join('; '),
    );
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

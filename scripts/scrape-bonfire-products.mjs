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
    /** @type {Array<{ name: string, slug: string }>} */
    const out = [];
    const seen = new Set();
    for (const h3 of titles) {
      const name = (h3.textContent ?? '').trim();
      if (!name) continue;
      const container =
        h3.closest('.sw-ProductSliderWrap, .sw-ProductSlider, .sw-ProdCard_New, [ng-repeat]') ??
        h3.parentElement;
      const fig = container?.querySelector('a.sw-ProdCard_Fig');
      const m = (fig?.getAttribute('href') ?? '').match(/^\/([^/?#]+)/);
      if (!m) continue;
      const slug = m[1];
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ name, slug });
    }
    return out;
  });

  console.log(`Found ${campaigns.length} campaigns:`, campaigns.map((c) => c.slug).join(', '));

  /** @type {Array<{ name: string, url: string, image: string, campaign: string, campaignTitle: string }>} */
  const allProducts = [];

  for (const campaign of campaigns) {
    const url = `https://www.bonfire.com/${campaign.slug}/`;
    console.log(`  Loading ${url} ...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(2000);

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

            seen.add(title);
            items.push({
              name: title,
              url: `https://www.bonfire.com/${ctx.slug}/`,
              image,
              campaign: ctx.slug,
              campaignTitle: ctx.campaignName,
            });
          }
          return items;
        },
        { slug: campaign.slug, campaignName: campaign.name },
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

      console.log(`    ${variants.length} variant(s) for ${campaign.slug}: ${variants.map((v) => v.name).join(', ')}`);
      allProducts.push(...variants);
    } catch (err) {
      console.warn(`    Failed to scrape ${campaign.slug}: ${err.message}`);
    }
  }

  if (allProducts.length === 0) {
    console.error('No products scraped.');
    process.exitCode = 1;
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  const payload = {
    storeUrl: STORE_URL,
    scrapedAt: new Date().toISOString(),
    products: allProducts,
  };
  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${allProducts.length} products to ${OUTPUT}`);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

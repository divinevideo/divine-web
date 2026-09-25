// ABOUTME: Build-time SSG for marketing (family) routes using the real React components
// ABOUTME: Renders each route via vite ssrLoadModule and writes dist/<route>/index.html with per-route meta

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDistDir } from './lib/distDir.mjs';
import { withViteSsr } from './lib/viteSsr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Extract shell head tags, CSS bundle links, fonts, inline styles, and the JS entry from the built index.html
function getShellTemplate(indexHtml) {
  const collect = (re) => {
    const out = [];
    let m;
    while ((m = re.exec(indexHtml)) !== null) out.push(m[0]);
    return out;
  };

  const fontLinks = collect(/<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi);
  const cssLinks = collect(/<link[^>]+rel="stylesheet"[^>]*>/gi).filter(
    (l) => !l.includes('fonts.googleapis.com')
  );
  const styleBlocks = collect(/<style[^>]*>[\s\S]*?<\/style>/gi);
  const scriptMatch = indexHtml.match(/<script[^>]+type="module"[^>]+src="[^"]+"[^>]*><\/script>/);
  const modulePreloads = collect(/<link[^>]+rel="modulepreload"[^>]*>/gi);
  const shellHeadTags = [
    ...collect(/<meta[^>]+>/gi).filter((tag) => {
      const lower = tag.toLowerCase();
      return !lower.includes('charset=')
        && !lower.includes('name="viewport"')
        && !lower.includes('name="description"')
        && !lower.includes('name="theme-color"')
        && !lower.includes('property="og:')
        && !lower.includes('name="twitter:');
    }),
    ...collect(/<link[^>]+>/gi).filter((tag) => {
      const lower = tag.toLowerCase();
      return !lower.includes('rel="canonical"')
        && !lower.includes('rel="stylesheet"')
        && !lower.includes('rel="modulepreload"')
        && !lower.includes('rel="icon"')
        && !lower.includes('rel="apple-touch-icon"')
        && !lower.includes('fonts.googleapis.com')
        && !lower.includes('fonts.gstatic.com');
    }),
  ];

  return {
    fontLinks,
    cssLinks,
    styleBlocks,
    modulePreloads,
    shellHeadTags,
    script: scriptMatch ? scriptMatch[0] : '',
  };
}

function buildPage({ headTags, appHtml, shell }) {
  const { fontLinks, cssLinks, styleBlocks, modulePreloads, shellHeadTags, script } = shell;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    ${shellHeadTags.join('\n    ')}
    ${headTags}
    <meta name="theme-color" content="#27C58B">
    <link rel="icon" type="image/png" sizes="72x72" href="/favicon.png">
    <link rel="apple-touch-icon" href="/app_icon.png">
    ${fontLinks.join('\n    ')}
    ${cssLinks.join('\n    ')}
    ${modulePreloads.join('\n    ')}
    ${styleBlocks.join('\n    ')}
  </head>
  <body>
    <div id="root">${appHtml}</div>
    ${script}
  </body>
</html>`;
}

async function main() {
  const DIST = resolveDistDir(ROOT);
  if (!existsSync(DIST)) {
    console.error('Error: dist/ directory not found. Run "vite build" first.');
    process.exit(1);
  }

  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8');
  if (!indexHtml.includes('/assets/')) {
    console.warn('Warning: dist/index.html does not reference /assets/ bundles. Build may not be complete.');
  }
  const shell = getShellTemplate(indexHtml);

  await withViteSsr(ROOT, async (load) => {
    const { MARKETING_SSG_ROUTES, renderMarketingRoute } = await load('/src/prerender/render-marketing.tsx');
    const heads = await (await load('/src/seo/pageSeo.ts')).resolveAllPageSeoForBuild();
    const { renderHeadTags } = await load('/src/seo/headTags.ts');

    for (const path of MARKETING_SSG_ROUTES) {
      const head = heads.find((h) => h.path === path && h.prerenderedBy === 'marketing');
      if (!head) {
        throw new Error(`${path}: no PAGE_SEO row with prerenderedBy 'marketing'`);
      }
      const { appHtml } = await renderMarketingRoute(path);
      const html = buildPage({ headTags: renderHeadTags(head), appHtml, shell });

      const outDir = join(DIST, path.slice(1));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'index.html'), html);
      console.log(`Pre-rendered: ${path} -> ${join(outDir, 'index.html')}`);
    }
  });

  console.log('Marketing page pre-rendering complete.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('prerender-marketing failed:', err);
    process.exit(1);
  });
}

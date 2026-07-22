// ABOUTME: Build-time SSG for marketing (family) routes using the real React components
// ABOUTME: Renders each route via vite ssrLoadModule and writes dist/<route>/index.html with per-route meta

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Extract CSS bundle links, fonts, inline styles, and the JS entry from the built index.html
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

  return { fontLinks, cssLinks, styleBlocks, modulePreloads, script: scriptMatch ? scriptMatch[0] : '' };
}

function buildPage({ seo, appHtml, shell }) {
  const { fontLinks, cssLinks, styleBlocks, modulePreloads, script } = shell;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}">
    <meta name="theme-color" content="#27C58B">
    <link rel="canonical" href="${seo.canonical}">
    <meta property="og:type" content="${seo.ogType}">
    <meta property="og:url" content="${seo.canonical}">
    <meta property="og:title" content="${escapeHtml(seo.ogTitle)}">
    <meta property="og:description" content="${escapeHtml(seo.ogDescription)}">
    <meta property="og:image" content="${seo.ogImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(seo.ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(seo.ogDescription)}">
    <meta name="twitter:image" content="${seo.ogImage}">
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
  if (!existsSync(DIST)) {
    console.error('Error: dist/ directory not found. Run "vite build" first.');
    process.exit(1);
  }

  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8');
  if (!indexHtml.includes('/assets/')) {
    console.warn('Warning: dist/index.html does not reference /assets/ bundles. Build may not be complete.');
  }
  const shell = getShellTemplate(indexHtml);

  const vite = await createServer({
    root: ROOT,
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
  });

  try {
    const { MARKETING_SSG_ROUTES, renderMarketingRoute } = await vite.ssrLoadModule(
      '/src/prerender/render-marketing.tsx'
    );

    for (const path of MARKETING_SSG_ROUTES) {
      const { appHtml, seo } = await renderMarketingRoute(path);
      const html = buildPage({ seo, appHtml, shell });

      const outDir = join(DIST, path.slice(1));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'index.html'), html);
      console.log(`Pre-rendered: ${path} -> ${join(outDir, 'index.html')}`);
    }
  } finally {
    await vite.close();
  }

  console.log('Marketing page pre-rendering complete.');
}

main().catch((err) => {
  console.error('prerender-marketing failed:', err);
  process.exit(1);
});

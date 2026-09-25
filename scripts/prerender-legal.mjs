// ABOUTME: Build-time pre-render script for legal pages (terms, privacy, safety, dmca, faq)
// ABOUTME: Generates static HTML in dist/ so non-JS clients see real content instead of a loading spinner

import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDistDir } from './lib/distDir.mjs';
import { withViteSsr } from './lib/viteSsr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Read the built index.html to extract CSS bundle links, fonts, and styles
function getShellTemplate(indexHtml) {
  // Extract Google Fonts preconnect + stylesheet links
  const fontLinks = [];
  const fontRe = /<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>/gi;
  let m;
  while ((m = fontRe.exec(indexHtml)) !== null) fontLinks.push(m[0]);

  // Extract non-font <link rel="stylesheet" ...> tags (i.e. Tailwind CSS bundle)
  const cssLinks = [];
  const linkRe = /<link[^>]+rel="stylesheet"[^>]*>/gi;
  while ((m = linkRe.exec(indexHtml)) !== null) {
    if (!m[0].includes('fonts.googleapis.com')) {
      cssLinks.push(m[0]);
    }
  }

  // Extract inline <style> blocks from <head>
  const styleBlocks = [];
  const styleRe = /<style[^>]*>[\s\S]*?<\/style>/gi;
  while ((m = styleRe.exec(indexHtml)) !== null) {
    styleBlocks.push(m[0]);
  }

  // Extract the CSP meta tag. These pages boot the full SPA, and the app's
  // only CSP is this tag (_headers sets a policy for /embed alone), so a
  // prerendered page without it would run the whole app unprotected for any
  // session that entered through /terms, /faq, /services, and so on.
  const cspMatch = indexHtml.match(
    /<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i
  );
  const cspMeta = cspMatch ? cspMatch[0] : '';

  return { cssLinks, styleBlocks, fontLinks, cspMeta };
}

function buildPage({ headTags, content, shell }) {
  const { cssLinks, styleBlocks, fontLinks, cspMeta } = shell;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    ${cspMeta}
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    ${headTags}
    <meta name="theme-color" content="#27C58B">
    <link rel="icon" type="image/png" sizes="72x72" href="/favicon.png">
    <link rel="apple-touch-icon" href="/app_icon.png">
    ${fontLinks.join('\n    ')}
    ${cssLinks.join('\n    ')}
    ${styleBlocks.join('\n    ')}
    <style>
      /* Prerender page base styles */
      .prerender-page { font-family: Inter, system-ui, sans-serif; }
      .prerender-page a { color: #27C58B; }
      .prerender-page a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="prerender-page min-h-screen flex flex-col bg-background">
        <!-- Header -->
        <nav class="fixed top-0 left-0 right-0 z-50 bg-brand-dark-green border-b border-brand-green" style="background:#07241B;border-bottom:1px solid #27C58B;">
          <div class="container mx-auto px-4">
            <div class="flex items-center justify-between h-16">
              <a href="/"><img src="/divine-logo.svg" alt="Divine" style="height:20px;"></a>
              <div class="flex items-center gap-8">
                <a href="https://about.divine.video/" style="color:#F9F7F6;font-size:14px;">About</a>
                <a href="https://about.divine.video/blog/" style="color:#F9F7F6;font-size:14px;">Blog</a>
                <a href="https://about.divine.video/faqs/" style="color:#F9F7F6;font-size:14px;">FAQ</a>
                <a href="/discovery" style="background:#27C58B;color:white;padding:8px 16px;border-radius:9999px;font-size:14px;font-weight:600;text-decoration:none;">Try it</a>
              </div>
            </div>
          </div>
        </nav>

        <!-- Content -->
        <div class="flex-1 pt-16">
          <div class="container mx-auto px-4 py-8 max-w-4xl">
            ${content}
          </div>
        </div>

        <!-- Footer -->
        <footer style="background:#07241B;border-top:1px solid #27C58B;padding:24px 0;color:white;font-size:12px;">
          <div class="container mx-auto px-4 text-center">
            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:12px;">
              <a href="/support" style="color:white;">Help</a>
              &bull; <a href="/terms" style="color:white;">Terms of Service</a>
              &bull; <a href="/privacy" style="color:white;">Privacy</a>
              &bull; <a href="/safety" style="color:white;">Safety</a>
              &bull; <a href="/dmca" style="color:white;">DMCA &amp; Copyright</a>
              &bull; <a href="/open-source" style="color:white;">Open Source</a>
              &bull; <a href="https://opencollective.com/aos-collective/contribute/divine-keepers-95646" target="_blank" rel="noopener noreferrer" style="color:white;">Donate</a>
            </div>
            <p style="color:#999;">&copy; Divine Web</p>
          </div>
        </footer>
      </div>
    </div>
    <noscript>
      <p style="text-align:center;padding:20px;color:#666;">
        This page works without JavaScript. For the full interactive experience,
        please enable JavaScript.
      </p>
    </noscript>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function getTranslationValue(messages, key) {
  return key.split('.').reduce((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return value[segment];
    }
    return undefined;
  }, messages);
}

function resolveTCalls(source, content) {
  const namespaceMatch = source.match(/useTranslation\('([^']+)'\)/);

  if (!namespaceMatch) {
    return content;
  }

  const localePath = join(__dirname, '..', 'src', 'lib', 'i18n', 'locales', 'en', `${namespaceMatch[1]}.json`);
  if (!existsSync(localePath)) {
    return content;
  }

  const messages = JSON.parse(readFileSync(localePath, 'utf-8'));

  return content.replace(/\{t\('([^']+)'\)\}/g, (match, key) => {
    const value = getTranslationValue(messages, key);
    return typeof value === 'string' ? value : match;
  });
}

// ── Page content (semantic HTML versions of the React components) ──────────

export const PAGES = [
  { path: '/terms', sourceFile: '../src/pages/TermsPage.tsx' },
  { path: '/privacy', sourceFile: '../src/pages/PrivacyPage.tsx' },
  { path: '/safety', sourceFile: '../src/pages/SafetyPage.tsx' },
  { path: '/dmca', sourceFile: '../src/pages/DMCAPage.tsx' },
  { path: '/faq', contentFile: 'faq-content.html' },
  { path: '/services', contentFile: 'services-content.html' },
];

function extractContentFromTsx(sourcePath) {
  const source = readFileSync(sourcePath, 'utf-8');
  const match = source.match(/<ZendeskWidget\s*\/>\s*([\s\S]*?)\s*<\/div>\s*<\/MarketingLayout>/);

  if (!match) {
    throw new Error(`Could not extract prerender content from ${sourcePath}`);
  }

  return resolveTCalls(source, match[1])
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<Link\s+to=/g, '<a href=')
    .replace(/<\/Link>/g, '</a>')
    .replace(/className=/g, 'class=')
    .replace(/\{\s*' '\s*\}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const DIST = resolveDistDir(ROOT);
  if (!existsSync(DIST)) {
    console.error('Error: dist/ directory not found. Run "vite build" first.');
    process.exit(1);
  }

  const { heads, renderHeadTags } = await withViteSsr(ROOT, async (load) => ({
    heads: await (await load('/src/seo/pageSeo.ts')).resolveAllPageSeoForBuild(),
    renderHeadTags: (await load('/src/seo/headTags.ts')).renderHeadTags,
  }));
  const legalHeads = new Map(heads.filter((h) => h.prerenderedBy === 'legal').map((h) => [h.path, h]));

  // Check if the built index.html has the actual JS bundle reference
  // (not the dev /src/main.tsx)
  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8');
  const hasBundle = indexHtml.includes('/assets/');
  if (!hasBundle) {
    console.warn('Warning: dist/index.html does not reference /assets/ bundles. Build may not be complete.');
  }

  // Extract shell template once (CSS, fonts, styles)
  const shell = getShellTemplate(indexHtml);

  // Find the actual JS entry point from built index.html
  const scriptMatch = indexHtml.match(/<script[^>]+src="([^"]+)"[^>]*>/);

  for (const page of PAGES) {
    let content;
    if (page.sourceFile) {
      const sourcePath = join(__dirname, page.sourceFile);
      if (!existsSync(sourcePath)) {
        console.warn(`Skipping ${page.path}: source file not found at ${sourcePath}`);
        continue;
      }
      content = extractContentFromTsx(sourcePath);
    } else {
      const contentPath = join(__dirname, 'prerender-content', page.contentFile);
      if (!existsSync(contentPath)) {
        console.warn(`Skipping ${page.path}: content file not found at ${contentPath}`);
        continue;
      }
      content = readFileSync(contentPath, 'utf-8');
    }

    const head = legalHeads.get(page.path);
    if (!head) {
      throw new Error(`${page.path}: no PAGE_SEO row with prerenderedBy 'legal'`);
    }

    const html = buildPage({
      headTags: renderHeadTags(head),
      content,
      shell,
    });

    // Replace the placeholder script src with the actual bundle. The regex
    // only captures the opening tag, so re-add the closing </script> —
    // without it the parser swallows the rest of the document and the app
    // never boots on prerendered pages.
    const finalHtml = html.replace(
      '<script type="module" src="/src/main.tsx"></script>',
      scriptMatch ? scriptMatch[0] + '</script>' : ''
    );

    const outDir = join(DIST, page.path.slice(1));
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, 'index.html');
    writeFileSync(outFile, finalHtml);
    console.log(`Pre-rendered: ${page.path} -> ${outFile}`);
  }

  console.log('Legal page pre-rendering complete.');
}

if (import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  main().catch((err) => {
    console.error('prerender-legal failed:', err);
    process.exit(1);
  });
}

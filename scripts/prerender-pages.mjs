// ABOUTME: Writes dist/<path>/index.html for every fixed-page row no other prerender owns, plus dist/sitemap.xml
// ABOUTME: Runs last in the prerender chain and ends with the self-check over every row, including legal and family

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDistDir } from './lib/distDir.mjs';
import { withViteSsr } from './lib/viteSsr.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const distDir = resolveDistDir(ROOT);
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    console.error(`Error: ${indexPath} not found. Run "vite build" first.`);
    process.exit(1);
  }

  const problems = await withViteSsr(ROOT, async (load) => {
    const heads = await (await load('/src/seo/pageSeo.ts')).resolveAllPageSeoForBuild();
    const { buildPageFiles, buildSitemap, checkPageFiles } = await load('/src/seo/pageFiles.ts');

    for (const { file, html } of buildPageFiles(readFileSync(indexPath, 'utf8'), heads)) {
      const target = join(distDir, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, html);
    }
    writeFileSync(join(distDir, 'sitemap.xml'), buildSitemap(heads));

    return checkPageFiles(heads, (file) => {
      const target = join(distDir, file);
      return existsSync(target) ? readFileSync(target, 'utf8') : undefined;
    });
  });

  if (problems.length > 0) {
    console.error(`Page head self-check failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Page heads verified for every fixed page; sitemap written.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('prerender-pages failed:', err);
    process.exit(1);
  });
}

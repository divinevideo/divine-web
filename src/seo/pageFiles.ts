// ABOUTME: Pure build logic for fixed pages' static heads and the sitemap
// ABOUTME: scripts/prerender-pages.mjs does the file IO; tests call these directly

import { checkHeadTags, renderSitemap, replaceHeadTags, type ResolvedPageHead } from './headTags';
import { SITE_ORIGIN } from './pageSeo';

export function pageFilePath(path: string): string {
  return `${path.slice(1)}/index.html`;
}

/** One static file per row that no other prerender script owns. */
export function buildPageFiles(
  shellHtml: string,
  heads: readonly ResolvedPageHead[],
): Array<{ file: string; html: string }> {
  return heads
    .filter((head) => !head.prerenderedBy)
    .map((head) => ({ file: pageFilePath(head.path), html: replaceHeadTags(shellHtml, head) }));
}

export function buildSitemap(heads: readonly ResolvedPageHead[]): string {
  return renderSitemap([
    { loc: `${SITE_ORIGIN}/` },
    ...heads.map((head) => ({ loc: head.canonical, lastmod: head.lastModified })),
  ]);
}

/** Self-check: every row's file exists and carries exactly the tags the table resolves to. */
export function checkPageFiles(
  heads: readonly ResolvedPageHead[],
  readFile: (file: string) => string | undefined,
): string[] {
  const problems: string[] = [];
  for (const head of heads) {
    const file = pageFilePath(head.path);
    const html = readFile(file);
    if (html === undefined) {
      problems.push(`${head.path}: missing ${file}`);
      continue;
    }
    for (const problem of checkHeadTags(html, head)) problems.push(`${head.path}: ${problem}`);
  }
  return problems;
}

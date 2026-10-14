// ABOUTME: Guards the route builders against pulling React hook modules into pure libs
// ABOUTME: eventRouting is imported by share links, search and every list surface

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = resolve('src');

function resolveSpecifier(specifier: string, importer: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(importer), specifier);
  else return null;

  base = base.replace(/\.(ts|tsx|js)$/, '');
  for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + suffix)) return base + suffix;
  }
  return null;
}

function localImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const specifiers = [...source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)];
  return specifiers
    .map(([, specifier]) => resolveSpecifier(specifier, file))
    .filter((f): f is string => f !== null);
}

/** Shortest import chain from `entry` to a module under src/hooks, if one exists. */
function findHookChain(entry: string): string[] | null {
  const queue: string[][] = [[entry]];
  const seen = new Set([entry]);

  while (queue.length > 0) {
    const chain = queue.shift()!;
    for (const next of localImports(chain[chain.length - 1])) {
      if (seen.has(next)) continue;
      if (relative(SRC, next).startsWith('hooks/')) return [...chain, next];
      seen.add(next);
      queue.push([...chain, next]);
    }
  }

  return null;
}

// Path builders run in share-link, search and transform code that has no React
// context. Reaching a hook module drags react-query, nostrify and the signer
// stack behind every URL these modules build, and invites an import cycle the
// moment a hook needs a route builder.
describe('route builders stay free of hook modules', () => {
  it.each([
    'src/lib/eventRouting.ts',
    'src/lib/parsePeopleListFromEvent.ts',
  ])('%s does not transitively import src/hooks', (entry) => {
    const chain = findHookChain(resolve(entry));
    expect(chain?.map((f) => relative(process.cwd(), f)) ?? null).toBeNull();
  });
});

// ABOUTME: Pins the Fastly edge shell's CSP to index.html so the two copies cannot drift
// ABOUTME: Drift here silently broke the App Store badge on edge-templated routes (see PR #292 fallout)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

// @ts-expect-error - plain JS module in the Fastly compute package, no type declarations
import { renderShell } from '../compute-js/src/templates/shell.js';

const CSP_META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/;

function extractCsp(html: string, source: string): string {
  const match = html.match(CSP_META);
  if (!match) throw new Error(`No Content-Security-Policy meta tag found in ${source}`);
  return match[1];
}

function parseDirectives(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const indexCsp = extractCsp(readFileSync('index.html', 'utf8'), 'index.html');
const shellCsp = extractCsp(renderShell({}), 'compute-js/src/templates/shell.js');

describe('CSP single source of truth', () => {
  it('the edge shell serves byte-identical CSP to index.html', () => {
    // Fastly serves the edge shell for `/` and `/discovery/hot` (x-divine-edge: template)
    // while every other route serves index.html. A directive present in one and not the
    // other means a feature works on some routes and silently fails on others.
    expect(shellCsp).toBe(indexCsp);
  });

  it('reports which directives differ when they drift', () => {
    const index = parseDirectives(indexCsp);
    const shell = parseDirectives(shellCsp);

    const drift: string[] = [];
    for (const name of new Set([...index.keys(), ...shell.keys()])) {
      const inIndex = index.get(name) ?? [];
      const inShell = shell.get(name) ?? [];
      const onlyInIndex = inIndex.filter((s) => !inShell.includes(s));
      const onlyInShell = inShell.filter((s) => !inIndex.includes(s));
      if (onlyInIndex.length || onlyInShell.length) {
        drift.push(
          `${name}: index.html only=[${onlyInIndex.join(' ')}] shell.js only=[${onlyInShell.join(' ')}]`,
        );
      }
    }

    expect(drift).toEqual([]);
  });

  it('does not permit itunes.apple.com in script-src', () => {
    // The App Store badge is a static link; nothing loads a script from Apple.
    // A JSONP availability lookup used to live here and failed closed whenever it
    // was blocked, hiding the badge entirely.
    expect(parseDirectives(indexCsp).get('script-src')).not.toContain('https://itunes.apple.com');
    expect(parseDirectives(shellCsp).get('script-src')).not.toContain('https://itunes.apple.com');
  });

  it('no src/** file loads a script from itunes.apple.com', () => {
    // Test files are excluded: they assert the absence of such a script and
    // legitimately mention the host in a DOM selector.
    const violations = walk('src')
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('itunes.apple.com'));

    expect(violations).toEqual([]);
  });
});

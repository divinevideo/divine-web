// ABOUTME: Guards that every static public route in AppRouter has a link-preview decision
// ABOUTME: Each route is in PAGE_SEO or EXCLUDED_ROUTES, and each entry there is a real route

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXCLUDED_ROUTES, PAGE_SEO } from './pageSeo';

function staticRoutes(): string[] {
  const source = readFileSync(join(process.cwd(), 'src/AppRouter.tsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, ''); // line comments
  const paths = [...source.matchAll(/<Route\s[^>]*?\bpath="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(paths.filter((path) => !path.includes(':') && path !== '*'))];
}

describe('fixed-page route coverage', () => {
  const routes = staticRoutes();
  const decided = new Set([...PAGE_SEO.map((row) => row.path), ...Object.keys(EXCLUDED_ROUTES)]);

  it('finds the router routes (parser sanity check)', () => {
    expect(routes).toContain('/kids');
    expect(routes).toContain('/__brand-preview'); // multi-line <Route> under a DEV guard
    expect(routes).not.toContain('/upload'); // only exists inside a JSX comment
    expect(routes.length).toBeGreaterThan(40);
  });

  it('gives every static route a table row or an exclusion reason', () => {
    expect(routes.filter((path) => !decided.has(path))).toEqual([]);
  });

  it('only lists real routes', () => {
    expect([...decided].filter((path) => !routes.includes(path))).toEqual([]);
  });

  it('never lists a route in both places', () => {
    expect(PAGE_SEO.map((row) => row.path).filter((path) => path in EXCLUDED_ROUTES)).toEqual([]);
  });
});

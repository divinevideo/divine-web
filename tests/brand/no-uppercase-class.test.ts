import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Matches `className="... uppercase ..."`, `class="... uppercase ..."`, also inside cn(...) literals.
// Deliberately narrow: looks for the word `uppercase` surrounded by whitespace or quotes
// within a JSX className-ish context. Won't catch uppercase in backtick templates; acceptable for now.
const UPPERCASE_RE = /class(Name)?\s*=\s*[`"'][^`"']*\buppercase\b/;

describe('brand rule: no uppercase Tailwind class', () => {
  it('src/ contains no `uppercase` class inside className/class attributes', () => {
    const violations: string[] = [];
    for (const f of walk('src')) {
      const content = readFileSync(f, 'utf8');
      if (UPPERCASE_RE.test(content)) violations.push(f);
    }
    expect(violations).toEqual([]);
  });
});

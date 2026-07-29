import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx', '.json'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Brand rule: the name is always written "Divine". The stylized capital "V"
// belongs to the logotype artwork only and never appears in text.
// Pattern is assembled dynamically so this test's own source does not self-match.
const MISCASING_RE = new RegExp(['[dD]', '[iI]', 'Vine'].join(''));

describe('brand rule: product name casing', () => {
  it('src/ contains no brand-name miscasing', () => {
    const violations: string[] = [];
    for (const f of walk('src')) {
      const content = readFileSync(f, 'utf8');
      if (MISCASING_RE.test(content)) violations.push(f);
    }
    expect(violations).toEqual([]);
  });

  it('public/llms.txt uses the correct brand-name casing', () => {
    const content = readFileSync('public/llms.txt', 'utf8');
    expect(MISCASING_RE.test(content)).toBe(false);
  });
});

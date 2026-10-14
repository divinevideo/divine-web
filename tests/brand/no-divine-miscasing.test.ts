import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { describe, it, expect } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (['.ts', '.tsx', '.json', '.html'].includes(extname(p))) out.push(p);
  }
  return out;
}

// Brand rule: the name is always written "Divine". The stylized capital "V"
// belongs to the logotype artwork only and never appears in text. Markdown is
// intentionally excluded because brand docs include negative examples.
// Pattern is assembled dynamically so this test's own source does not self-match.
const MISCASING_RE = new RegExp(['[dD]', '[iI]', 'Vine'].join(''));

describe('brand rule: product name casing', () => {
  it('shipped app surfaces contain no brand-name miscasing', () => {
    const violations: string[] = [];

    for (const f of [
      ...walk('src'),
      'index.html',
      'public/llms.txt',
      'public/manifest.webmanifest',
    ]) {
      const content = readFileSync(f, 'utf8');
      content.split('\n').forEach((line, index) => {
        const match = MISCASING_RE.exec(line);
        if (match) violations.push(`${f}:${index + 1}: ${match[0]}`);
      });
    }

    expect(violations).toEqual([]);
  });
});

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

// Enforced since Phase 3 codemod migrated all Lucide imports to Phosphor.
// The iconMap documents the Lucide→Phosphor mapping; its JSDoc legitimately
// references the string 'lucide-react' for illustration. Allowlist it.
const ALLOWLIST: RegExp[] = [
  /src\/lib\/iconMap\.ts$/,
];

describe('brand rule: no lucide-react imports', () => {
  it('no src/** file imports from lucide-react', () => {
    const violations: string[] = [];
    for (const f of walk('src')) {
      if (ALLOWLIST.some(r => r.test(f))) continue;
      if (/from ['"]lucide-react['"]/.test(readFileSync(f, 'utf8'))) violations.push(f);
    }
    expect(violations).toEqual([]);
  });
});

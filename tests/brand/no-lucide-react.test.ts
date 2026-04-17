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

// TODO(phase-3): re-enable after the codemod migrates all Lucide imports to Phosphor.
describe.skip('brand rule: no lucide-react imports (Phase 3+)', () => {
  it('no src/** file imports from lucide-react', () => {
    const violations: string[] = [];
    for (const f of walk('src')) {
      if (/from ['"]lucide-react['"]/.test(readFileSync(f, 'utf8'))) violations.push(f);
    }
    expect(violations).toEqual([]);
  });
});

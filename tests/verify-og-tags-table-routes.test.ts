// ABOUTME: Keeps the live preview check's fixed-page list equal to the PAGE_SEO table
// ABOUTME: So a page added to the table is also audited in production

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PAGE_SEO } from '../src/seo/pageSeo';

describe('verify-og-tags.sh TABLE_ROUTES', () => {
  it('lists exactly the PAGE_SEO paths', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/verify-og-tags.sh'), 'utf8');
    const block = script.match(/^TABLE_ROUTES=\(\n([\s\S]*?)\n\)/m);
    expect(block, 'TABLE_ROUTES array not found').not.toBeNull();
    const routes = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(routes).toEqual(PAGE_SEO.map((row) => row.path).sort());
  });
});

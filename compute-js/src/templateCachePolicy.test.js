import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { EDGE_TEMPLATE_VARY } from './templateCachePolicy.js';

describe('edge template cache policy', () => {
  it('separates crawler responses from browser responses', () => {
    expect(EDGE_TEMPLATE_VARY.split(/,\s*/)).toEqual(
      expect.arrayContaining(['X-Original-Host', 'User-Agent']),
    );
  });

  it('applies the policy to every edge-templated response', () => {
    const indexSource = readFileSync('compute-js/src/index.js', 'utf8');
    const templateHeaderBlocks = [
      ...indexSource.matchAll(/headers: \{([\s\S]*?)'X-Divine-Edge': 'template'/g),
    ];

    expect(templateHeaderBlocks).toHaveLength(6);
    for (const [, headers] of templateHeaderBlocks) {
      expect(headers).toContain("'Vary': EDGE_TEMPLATE_VARY");
    }
  });
});

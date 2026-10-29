import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('PR preview sharing', () => {
  it('disables production short-link signing in the preview build', () => {
    const workflow = readFileSync('.github/workflows/preview.yml', 'utf8');
    const buildStep = workflow.match(/ {6}- name: Build\n([\s\S]*?)(?=\n {6}- name:)/)?.[1];

    expect(buildStep).toBeDefined();
    expect(buildStep).toMatch(/run: npm run build/);
    expect(buildStep).toMatch(/env:\n(?:.*\n)*?\s+VITE_SHORT_LINKS_ENABLED: 'false'/);
  });
});

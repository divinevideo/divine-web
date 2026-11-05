import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const production = readFileSync('.github/workflows/deploy.yml', 'utf8');
const preview = readFileSync('.github/workflows/preview.yml', 'utf8');

describe('production community chat build configuration', () => {
  it('passes the public repository invite variable to the production Build step', () => {
    const build = production.match(/- name: Build\n([\s\S]*?)\n      - name:/)?.[1];
    expect(build).toContain('VITE_CONCORD_INVITE_URL: ${{ vars.VITE_CONCORD_INVITE_URL }}');
    expect(build).toContain("VITE_PRODUCT_ANALYTICS_ENABLED: 'false'");
    expect(build).not.toContain('VITE_CHAT_POC_ENABLED');
  });
  it('keeps preview builds on their existing POC gate without injecting the production invite', () => {
    expect(preview).toContain("VITE_CHAT_POC_ENABLED: 'true'");
    expect(preview).not.toContain('VITE_CONCORD_INVITE_URL');
  });
});

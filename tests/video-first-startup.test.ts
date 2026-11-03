import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderShell } from '../compute-js/src/templates/shell.js';

describe('anonymous video startup', () => {
  it('does not inject the HubSpot banner in the SPA or edge shell', () => {
    expect(readFileSync('index.html', 'utf8')).not.toContain('/src/lib/hubSpotLoader.ts');
    expect(renderShell({})).not.toContain('id="hs-script-loader"');
  });

  it('does not initialize Firebase analytics before consent', () => {
    expect(readFileSync('src/main.tsx', 'utf8')).not.toMatch(/\binitializeAnalytics\(\)/);
  });
});

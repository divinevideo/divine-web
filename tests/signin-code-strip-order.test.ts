// ABOUTME: Pins that the sign-in code strip runs before any other module:
// ABOUTME: first in index.html, and with no imports of its own.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const moduleScripts = [...html.matchAll(/<script\s+type="module"\s+src="([^"]+)"/g)].map((m) => m[1]);

describe('sign-in code strip load order', () => {
  it('is the first module script, ahead of HubSpot and the app', () => {
    expect(moduleScripts[0]).toBe('/src/lib/stripSignInCode.ts');
    expect(moduleScripts).toContain('/src/lib/hubSpotLoader.ts');
    expect(moduleScripts).toContain('/src/main.tsx');
  });

  it('imports nothing, so nothing else is evaluated before it', () => {
    const source = readFileSync('src/lib/stripSignInCode.ts', 'utf8');
    expect(source).not.toMatch(/\bimport\b|\bexport\b[^;]*\bfrom\b/);
  });

  it('no script tag of any kind precedes it', () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    expect(scripts[0]).toContain('/src/lib/stripSignInCode.ts');
  });
});

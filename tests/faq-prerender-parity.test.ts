import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..');

function readSource(path: string) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

function collectIds(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

describe('prerendered FAQ parity', () => {
  // `npm run build` writes dist/faq/index.html from faq-content.html, so that
  // file — not FAQPage.tsx — is the document a visitor, a crawler, or a
  // deep link from the mobile app receives at /faq. An answer added to the
  // React page alone is missing from the served HTML until the SPA boots, and
  // its #anchor does not exist for the browser to scroll to at all.
  it('mirrors every FAQ anchor from the React page into the prerendered page', () => {
    const spaAnchors = collectIds(
      readSource('src/pages/FAQPage.tsx'),
      /<FAQQuestion\s+value="([^"]+)"/g,
    );
    const prerenderAnchors = collectIds(
      readSource('scripts/prerender-content/faq-content.html'),
      /<details\s+id="([^"]+)"/g,
    );

    expect(spaAnchors.length).toBeGreaterThan(0);
    expect(prerenderAnchors).toEqual(expect.arrayContaining(spaAnchors));
  });

  it('keeps the prerendered follower-count answer accurate', () => {
    const source = readSource('scripts/prerender-content/faq-content.html').replace(/\s+/g, ' ');

    expect(source).toContain('How does Divine count followers and following?');
    expect(source).toContain(
      'Your follower count is the number of accounts that currently follow you',
    );
    // Follower counts come from Funnelcake, which filters platform-banned,
    // suspended, and vanished pubkeys — not the profile owner's mute list. A
    // follow is a public Nostr event, so blocking cannot retract it.
    expect(source).toContain(
      'blocking doesn\'t remove their follow or change public follower counts',
    );
  });
});

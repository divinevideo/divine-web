import { describe, expect, it } from 'vitest';
import { shouldServeWellKnownBeforeWwwRedirect } from './wellKnownPaths.js';

describe('shouldServeWellKnownBeforeWwwRedirect', () => {
  it('serves app-link files directly on www hosts', () => {
    expect(shouldServeWellKnownBeforeWwwRedirect('www.divine.video', '/.well-known/apple-app-site-association')).toBe(true);
    expect(shouldServeWellKnownBeforeWwwRedirect('www.divine.video', '/.well-known/assetlinks.json')).toBe(true);
  });

  it('keeps other www paths on the normal redirect path', () => {
    expect(shouldServeWellKnownBeforeWwwRedirect('www.divine.video', '/')).toBe(false);
    expect(shouldServeWellKnownBeforeWwwRedirect('www.divine.video', '/.well-known/nostr.json')).toBe(false);
  });
});

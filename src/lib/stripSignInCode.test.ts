import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CODE = 'C'.repeat(43);

function visit(address: string) {
  window.history.replaceState(null, '', address);
}

async function loadModule() {
  vi.resetModules();
  return import('./stripSignInCode');
}

describe('stripSignInCode', () => {
  beforeEach(() => {
    delete window.__DIVINE_SIGNIN_CODE_STRIPPED__;
  });

  afterEach(() => {
    visit('/');
  });

  it('removes a code after the # on /app/callback as soon as it loads, and keeps the rest', async () => {
    visit(`/app/callback?signin=abc&platform=bluesky&identity=alice.bsky.social#oauth_confirm=${CODE}`);
    await loadModule();
    expect(window.location.pathname).toBe('/app/callback');
    expect(window.location.search).toBe('?signin=abc&platform=bluesky&identity=alice.bsky.social');
    expect(window.location.hash).toBe('');
    expect(window.location.href).not.toContain(CODE);
    expect(window.__DIVINE_SIGNIN_CODE_STRIPPED__).toBe(true);
  });

  it('removes a code in the query', async () => {
    visit(`/app/callback?signin=abc&oauth_confirm=${CODE}`);
    const { stripSignInCode } = await loadModule();
    expect(window.location.search).toBe('?signin=abc');
    expect(window.location.href).not.toContain(CODE);
    expect(stripSignInCode()).toBe(false);
  });

  it('keeps other values after the # when it removes the code', async () => {
    visit(`/app/callback?signin=abc#oauth_confirm=${CODE}&_=_`);
    await loadModule();
    expect(window.location.hash).toBe('#_=_');
  });

  it('leaves a sign-in return without a code alone (Keycast login)', async () => {
    visit('/app/callback?code=keycast-code&state=s');
    await loadModule();
    expect(window.location.search).toBe('?code=keycast-code&state=s');
    expect(window.__DIVINE_SIGNIN_CODE_STRIPPED__).toBeUndefined();
  });

  it('only acts on /app/callback', async () => {
    visit(`/somewhere?oauth_confirm=${CODE}#oauth_confirm=${CODE}`);
    await loadModule();
    expect(window.location.href).toContain(CODE);
    visit(`/app/callback/?oauth_confirm=${CODE}`);
    await loadModule();
    expect(window.location.href).toContain(CODE);
    expect(window.__DIVINE_SIGNIN_CODE_STRIPPED__).toBeUndefined();
  });
});

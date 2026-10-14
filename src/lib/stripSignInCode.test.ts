import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CODE = 'C'.repeat(43);
const HUBSPOT_SCRIPT_ID = 'hs-script-loader';

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
    delete window.__DIVINE_ANALYTICS_DISABLED__;
    document.getElementById(HUBSPOT_SCRIPT_ID)?.remove();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('removes a code that is in the query and after the # at once', async () => {
    visit(`/app/callback?signin=abc&oauth_confirm=${CODE}#oauth_confirm=${CODE}&_=_`);
    await loadModule();
    expect(window.location.search).toBe('?signin=abc');
    expect(window.location.hash).toBe('#_=_');
    expect(window.location.href).not.toContain(CODE);
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
    expect(window.__DIVINE_ANALYTICS_DISABLED__).toBeUndefined();
  });

  it('turns analytics off for the page view when it removes a code', async () => {
    visit(`/app/callback?signin=abc#oauth_confirm=${CODE}`);
    await loadModule();
    expect(window.__DIVINE_ANALYTICS_DISABLED__).toBe(true);
  });

  it('keeps HubSpot and analytics from loading after it removes a code', async () => {
    visit(`/app/callback?signin=abc#oauth_confirm=${CODE}`);
    await loadModule();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await import('./hubSpotLoader');
    const { initializeAnalytics } = await import('./analytics');
    initializeAnalytics();

    expect(document.getElementById(HUBSPOT_SCRIPT_ID)).toBeNull();
    const logged = log.mock.calls.map((call) => String(call[0]));
    expect(logged).toContain('[Analytics] Suppressed by __DIVINE_ANALYTICS_DISABLED__');
  });

  it('still lets HubSpot load on an ordinary return', async () => {
    visit('/app/callback?code=keycast-code&state=s');
    await loadModule();
    await import('./hubSpotLoader');
    expect(document.getElementById(HUBSPOT_SCRIPT_ID)).not.toBeNull();
  });

  it('only acts on /app/callback', async () => {
    visit(`/somewhere?oauth_confirm=${CODE}#oauth_confirm=${CODE}`);
    await loadModule();
    expect(window.location.href).toContain(CODE);
    expect(window.__DIVINE_SIGNIN_CODE_STRIPPED__).toBeUndefined();
    expect(window.__DIVINE_ANALYTICS_DISABLED__).toBeUndefined();
  });
  it.each(['/app/callback/', '/App/Callback', '/APP/CALLBACK///'])('strips router-matched path %s', async (path) => {
    visit(`${path}?oauth_confirm=${CODE}`);
    await loadModule();
    expect(window.location.href).not.toContain(CODE);
    expect(window.__DIVINE_ANALYTICS_DISABLED__).toBe(true);
  });

  it.each(['#section-2', '#/profile', '#next=%2Fa%20b&flag'])('preserves an unrelated fragment %s', async (hash) => {
    visit(`/app/callback?redirect=%2Fa%20b&flag&oauth_confirm=${CODE}${hash}`);
    await loadModule();
    expect(window.location.search).toBe('?redirect=%2Fa%20b&flag');
    expect(window.location.hash).toBe(hash);
  });

  it('removes repeated encoded parameter names without rewriting other pairs', async () => {
    visit(`/app/callback?flag&oauth%5Fconfirm=${CODE}&redirect=%2Fa%20b&oauth_confirm=${CODE}#keep=%2f&oauth%5fconfirm=${CODE}`);
    await loadModule();
    expect(window.location.search).toBe('?flag&redirect=%2Fa%20b');
    expect(window.location.hash).toBe('#keep=%2f');
  });

  it('keeps analytics suppressed and boot running when history rejects the strip', async () => {
    visit(`/app/callback?oauth_confirm=${CODE}`);
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {
      expect(window.__DIVINE_ANALYTICS_DISABLED__).toBe(true);
      expect(window.__DIVINE_SIGNIN_CODE_STRIPPED__).toBe(true);
      throw new DOMException('History unavailable', 'SecurityError');
    });
    await expect(loadModule()).resolves.toBeDefined();
    expect(window.__DIVINE_ANALYTICS_DISABLED__).toBe(true);
    await import('./hubSpotLoader');
    expect(document.getElementById(HUBSPOT_SCRIPT_ID)).toBeNull();
    vi.restoreAllMocks();
  });

});

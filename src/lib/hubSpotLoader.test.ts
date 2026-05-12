import { beforeEach, describe, expect, it, vi } from 'vitest';

const HUBSPOT_SCRIPT_ID = 'hs-script-loader';
const HUBSPOT_SCRIPT_SRC = 'https://js-na2.hs-scripts.com/244466832.js';

describe('HubSpot loader', () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.__DIVINE_ANALYTICS_DISABLED__;
    document.getElementById(HUBSPOT_SCRIPT_ID)?.remove();
  });

  it('loads HubSpot tracking by default', async () => {
    await import('./hubSpotLoader');

    const script = document.getElementById(HUBSPOT_SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script?.src).toBe(HUBSPOT_SCRIPT_SRC);
    expect(script?.async).toBe(true);
    expect(script?.defer).toBe(true);
  });

  it('does not load HubSpot tracking when analytics are suppressed', async () => {
    window.__DIVINE_ANALYTICS_DISABLED__ = true;

    await import('./hubSpotLoader');

    expect(document.getElementById(HUBSPOT_SCRIPT_ID)).toBeNull();
  });

  it('does not duplicate an existing HubSpot script', async () => {
    const existing = document.createElement('script');
    existing.id = HUBSPOT_SCRIPT_ID;
    existing.src = HUBSPOT_SCRIPT_SRC;
    document.head.appendChild(existing);

    const { loadHubSpotTracking } = await import('./hubSpotLoader');
    loadHubSpotTracking();

    expect(document.querySelectorAll(`#${HUBSPOT_SCRIPT_ID}`)).toHaveLength(1);
  });
});

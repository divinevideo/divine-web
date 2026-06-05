import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionWithRefresh = vi.fn();

vi.mock('@divinevideo/login', () => ({
  createDivineClient: () => ({
    oauth: { getSessionWithRefresh },
    createRpc: () => null,
  }),
}));

import { refreshDivineSession } from './divineLogin';

describe('refreshDivineSession', () => {
  beforeEach(() => {
    getSessionWithRefresh.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the refreshed access token', async () => {
    getSessionWithRefresh.mockResolvedValue({ bunkerUrl: 'bunker://x', accessToken: 'fresh-token', expiresAt: 123 });
    await expect(refreshDivineSession()).resolves.toBe('fresh-token');
  });

  it('returns null when there is no session / refresh failed', async () => {
    getSessionWithRefresh.mockResolvedValue(null);
    await expect(refreshDivineSession()).resolves.toBeNull();
  });

  it('returns null when the refreshed credentials have no access token', async () => {
    getSessionWithRefresh.mockResolvedValue({ bunkerUrl: 'bunker://x' });
    await expect(refreshDivineSession()).resolves.toBeNull();
  });

  it('singleflights concurrent calls into one refresh (the single-use token is consumed once)', async () => {
    // Resolve on a deferred so all parallel callers overlap in the in-flight window.
    let resolve!: (v: { accessToken: string }) => void;
    getSessionWithRefresh.mockReturnValue(new Promise((r) => { resolve = r; }));

    const calls = [
      refreshDivineSession(),
      refreshDivineSession(),
      refreshDivineSession(),
      refreshDivineSession(),
      refreshDivineSession(),
    ];
    resolve({ accessToken: 'fresh-token' });
    const results = await Promise.all(calls);

    // ~55 mounted useDivineSession instances must not each race the rotating
    // single-use refresh token — exactly one POST, shared by every caller.
    expect(getSessionWithRefresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['fresh-token', 'fresh-token', 'fresh-token', 'fresh-token', 'fresh-token']);
  });

  it('clears the in-flight slot so a later renewal still refreshes', async () => {
    getSessionWithRefresh.mockResolvedValueOnce({ accessToken: 'token-1' });
    await expect(refreshDivineSession()).resolves.toBe('token-1');

    // A subsequent renewal (e.g. the next pre-expiry window) must hit the server again.
    getSessionWithRefresh.mockResolvedValueOnce({ accessToken: 'token-2' });
    await expect(refreshDivineSession()).resolves.toBe('token-2');
    expect(getSessionWithRefresh).toHaveBeenCalledTimes(2);
  });
});

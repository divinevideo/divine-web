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
});

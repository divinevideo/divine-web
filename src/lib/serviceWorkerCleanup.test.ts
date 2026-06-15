import { describe, expect, it, vi } from 'vitest';

import { cleanupServiceWorkersAndCaches } from '@/lib/serviceWorkerCleanup';

describe('cleanupServiceWorkersAndCaches', () => {
  it('unregisters existing service workers and clears browser caches', async () => {
    const unregisterFirst = vi.fn().mockResolvedValue(true);
    const unregisterSecond = vi.fn().mockResolvedValue(true);
    const deleteCache = vi.fn().mockResolvedValue(true);

    const result = await cleanupServiceWorkersAndCaches({
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([
          { scope: 'https://divine.video/', unregister: unregisterFirst },
          { scope: 'https://divine.video/old/', unregister: unregisterSecond },
        ]),
      },
      caches: {
        keys: vi.fn().mockResolvedValue(['workbox-precache-v1', 'runtime-videos']),
        delete: deleteCache,
      },
      logger: { log: vi.fn(), warn: vi.fn() },
    });

    expect(unregisterFirst).toHaveBeenCalledTimes(1);
    expect(unregisterSecond).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('workbox-precache-v1');
    expect(deleteCache).toHaveBeenCalledWith('runtime-videos');
    expect(result).toEqual({
      registrationsRemoved: 2,
      cachesDeleted: 2,
    });
  });

  it('does nothing when the browser has no service worker or cache APIs', async () => {
    const result = await cleanupServiceWorkersAndCaches({
      logger: { log: vi.fn(), warn: vi.fn() },
    });

    expect(result).toEqual({
      registrationsRemoved: 0,
      cachesDeleted: 0,
    });
  });
});

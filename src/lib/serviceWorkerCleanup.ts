type ServiceWorkerRegistrationLike = {
  scope?: string;
  unregister: () => boolean | Promise<boolean>;
};

type ServiceWorkerContainerLike = {
  getRegistrations: () => Promise<readonly ServiceWorkerRegistrationLike[]>;
};

type CacheStorageLike = {
  keys: () => Promise<string[]>;
  delete: (cacheName: string) => boolean | Promise<boolean>;
};

type CleanupLogger = {
  log?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
};

type CleanupDependencies = {
  serviceWorker?: ServiceWorkerContainerLike;
  caches?: CacheStorageLike;
  logger?: CleanupLogger;
};

type CleanupResult = {
  registrationsRemoved: number;
  cachesDeleted: number;
};

function getBrowserCleanupDependencies(): CleanupDependencies {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {};
  }

  return {
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    caches: 'caches' in window ? window.caches : undefined,
    logger: console,
  };
}

export async function cleanupServiceWorkersAndCaches(
  dependencies: CleanupDependencies = getBrowserCleanupDependencies()
): Promise<CleanupResult> {
  let registrationsRemoved = 0;
  let cachesDeleted = 0;

  try {
    const registrations = await dependencies.serviceWorker?.getRegistrations() ?? [];

    for (const registration of registrations) {
      const removed = await registration.unregister();
      if (removed !== false) {
        registrationsRemoved += 1;
      }
    }
  } catch (error) {
    dependencies.logger?.warn?.('[PWA] Service worker cleanup failed:', error);
  }

  try {
    const cacheNames = await dependencies.caches?.keys() ?? [];

    for (const cacheName of cacheNames) {
      const deleted = await dependencies.caches?.delete(cacheName);
      if (deleted !== false) {
        cachesDeleted += 1;
      }
    }
  } catch (error) {
    dependencies.logger?.warn?.('[PWA] Cache cleanup failed:', error);
  }

  if (registrationsRemoved > 0 || cachesDeleted > 0) {
    dependencies.logger?.log?.('[PWA] Removed stale offline cache state:', {
      registrationsRemoved,
      cachesDeleted,
    });
  }

  return {
    registrationsRemoved,
    cachesDeleted,
  };
}

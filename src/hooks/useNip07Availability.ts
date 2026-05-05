import { useCallback, useEffect, useState } from 'react';
import { hasNip07Provider } from '@/lib/nostrLogin';

const RETRY_INTERVAL_MS = 200;
const MAX_RETRY_MS = 4000;
const RECOVERY_RETRY_INTERVAL_MS = 2000;

type Nip07AvailabilityState = {
  isAvailable: boolean;
  isRestoring: boolean;
};

function getAvailabilityState(shouldWatch: boolean): Nip07AvailabilityState {
  const isAvailable = hasNip07Provider();
  return {
    isAvailable,
    isRestoring: shouldWatch && !isAvailable,
  };
}

export function useNip07Availability(shouldWatch: boolean): Nip07AvailabilityState {
  const [state, setState] = useState(() => getAvailabilityState(shouldWatch));

  const updateState = useCallback((isAvailable: boolean) => {
    const isRestoring = shouldWatch && !isAvailable;
    setState((prev) => {
      if (prev.isAvailable === isAvailable && prev.isRestoring === isRestoring) {
        return prev;
      }

      return { isAvailable, isRestoring };
    });
  }, [shouldWatch]);

  useEffect(() => {
    const checkAvailability = (): boolean => {
      const isAvailable = hasNip07Provider();
      updateState(isAvailable);
      return isAvailable;
    };

    if (!shouldWatch) {
      updateState(hasNip07Provider());
      return;
    }

    if (checkAvailability()) {
      return;
    }

    let elapsedMs = 0;
    let intervalMs = RETRY_INTERVAL_MS;
    let intervalId = window.setInterval(() => {
      if (checkAvailability()) {
        window.clearInterval(intervalId);
        return;
      }

      elapsedMs += intervalMs;

      // Keep watching after the initial retry window so late provider
      // injection can still recover in the same mounted tree.
      if (intervalMs === RETRY_INTERVAL_MS && elapsedMs >= MAX_RETRY_MS) {
        window.clearInterval(intervalId);
        intervalMs = RECOVERY_RETRY_INTERVAL_MS;
        intervalId = window.setInterval(() => {
          if (checkAvailability()) {
            window.clearInterval(intervalId);
          }
        }, intervalMs);
      }
    }, intervalMs);

    const handlePotentialRecovery = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      if (checkAvailability()) {
        window.clearInterval(intervalId);
      }
    };

    window.addEventListener('focus', handlePotentialRecovery);
    window.addEventListener('pageshow', handlePotentialRecovery);
    document.addEventListener('visibilitychange', handlePotentialRecovery);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handlePotentialRecovery);
      window.removeEventListener('pageshow', handlePotentialRecovery);
      document.removeEventListener('visibilitychange', handlePotentialRecovery);
    };
  }, [shouldWatch, updateState]);

  return state;
}

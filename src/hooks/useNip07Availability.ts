import { useEffect, useState } from 'react';

import { hasNip07Provider } from '@/lib/nostrLogin';

export const NIP07_GRACE_MS = 30000;
export const NIP07_POLL_INTERVAL_MS = 200;
const FAST_RETRY_MS = 4000;
const RECOVERY_RETRY_INTERVAL_MS = 2000;

type Nip07AvailabilityState = {
  isAvailable: boolean;
  isRestoring: boolean;
};

export function useNip07Availability(shouldWatch: boolean): Nip07AvailabilityState {
  const [state, setState] = useState(() => ({
    isAvailable: hasNip07Provider(),
    isRestoring: shouldWatch && !hasNip07Provider(),
  }));

  useEffect(() => {
    let timedOut = false;
    const timers: { poll?: number; deadline?: number } = {};
    const startedAt = Date.now();
    const check = () => {
      const isAvailable = hasNip07Provider();
      const isRestoring = shouldWatch && !timedOut && !isAvailable;
      setState((prev) => prev.isAvailable === isAvailable && prev.isRestoring === isRestoring
        ? prev : { isAvailable, isRestoring });
      if (isAvailable) {
        timedOut = true;
        window.clearTimeout(timers.poll);
        window.clearTimeout(timers.deadline);
      }
      return isAvailable;
    };
    const isAvailable = check();
    if (!shouldWatch || isAvailable) return;
    const retry = () => {
      if (!check() && !timedOut) {
        timers.poll = window.setTimeout(retry, Date.now() - startedAt < FAST_RETRY_MS
          ? NIP07_POLL_INTERVAL_MS : RECOVERY_RETRY_INTERVAL_MS);
      }
    };
    timers.poll = window.setTimeout(retry, NIP07_POLL_INTERVAL_MS);
    timers.deadline = window.setTimeout(() => {
      timedOut = true;
      window.clearTimeout(timers.poll);
      check();
    }, NIP07_GRACE_MS);
    const recover = () => {
      if (document.visibilityState !== 'hidden') check();
    };
    window.addEventListener('focus', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.clearTimeout(timers.poll);
      window.clearTimeout(timers.deadline);
      window.removeEventListener('focus', recover);
      window.removeEventListener('pageshow', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [shouldWatch]);

  return state;
}

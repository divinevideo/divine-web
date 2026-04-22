import { useEffect, useState } from 'react';
import { hasNip07Provider } from '@/lib/nostrLogin';

const RETRY_INTERVAL_MS = 200;
const MAX_RETRY_MS = 4000;

export function useNip07Availability(shouldWatch: boolean): boolean {
  const [isAvailable, setIsAvailable] = useState(() => hasNip07Provider());

  useEffect(() => {
    if (!shouldWatch) {
      setIsAvailable(hasNip07Provider());
      return;
    }

    if (hasNip07Provider()) {
      setIsAvailable(true);
      return;
    }

    setIsAvailable(false);

    let elapsedMs = 0;
    const intervalId = window.setInterval(() => {
      if (hasNip07Provider()) {
        setIsAvailable(true);
        window.clearInterval(intervalId);
        return;
      }

      elapsedMs += RETRY_INTERVAL_MS;
      if (elapsedMs >= MAX_RETRY_MS) {
        window.clearInterval(intervalId);
      }
    }, RETRY_INTERVAL_MS);

    // Long-tail recovery: re-probe when the user refocuses the tab in case the
    // extension finishes loading after the polling window expires.
    const handleVisibility = () => {
      if (hasNip07Provider()) setIsAvailable(true);
    };
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('pageshow', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('pageshow', handleVisibility);
    };
  }, [shouldWatch]);

  return isAvailable;
}

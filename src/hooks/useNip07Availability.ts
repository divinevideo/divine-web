import { useEffect, useState } from 'react';

import { hasNip07Provider } from '@/lib/nostrLogin';

/** How long to wait for a NIP-07 extension to inject `window.nostr` after mount. */
export const NIP07_GRACE_MS = 2000;
export const NIP07_POLL_INTERVAL_MS = 100;

export type Nip07Status = 'checking' | 'available' | 'unavailable';

/**
 * Tracks whether a NIP-07 browser extension is usable. Extension content
 * scripts can inject `window.nostr` after the app's first render, so a stored
 * extension login must not be declared broken at mount — poll briefly and only
 * settle on 'unavailable' once the grace period has elapsed.
 *
 * @param needed - true when a stored extension login is waiting on the
 * provider; polling only runs while this is set.
 */
export function useNip07Availability(needed: boolean): Nip07Status {
  const [status, setStatus] = useState<Nip07Status>(() =>
    hasNip07Provider() ? 'available' : 'checking',
  );

  useEffect(() => {
    if (!needed || status !== 'checking') {
      return;
    }

    if (hasNip07Provider()) {
      setStatus('available');
      return;
    }

    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += NIP07_POLL_INTERVAL_MS;

      if (hasNip07Provider()) {
        setStatus('available');
        clearInterval(timer);
      } else if (elapsed >= NIP07_GRACE_MS) {
        setStatus('unavailable');
        clearInterval(timer);
      }
    }, NIP07_POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [needed, status]);

  return status;
}

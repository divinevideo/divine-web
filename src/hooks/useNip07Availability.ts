import { useEffect, useSyncExternalStore } from 'react';

import { hasNip07Provider } from '@/lib/nostrLogin';

/** How long to wait for a NIP-07 extension to inject `window.nostr` after the check starts. */
export const NIP07_GRACE_MS = 2000;
export const NIP07_POLL_INTERVAL_MS = 100;

export type Nip07Status = 'checking' | 'available' | 'unavailable';

// One check for the whole app. useCurrentUser runs in most components, and a
// check per hook instance let components that mounted at different times
// disagree about the same extension login.
let status: Nip07Status | undefined;
let pollTimer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function getStatus(): Nip07Status {
  status ??= hasNip07Provider() ? 'available' : 'checking';
  return status;
}

function setStatus(next: Nip07Status): void {
  if (status === next) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function stopPolling(): void {
  clearInterval(pollTimer);
  pollTimer = undefined;
}

function recheck(): void {
  if (status !== 'unavailable' || !hasNip07Provider()) return;

  stopListeningForLateExtension();
  setStatus('available');
}

// An extension slower than the grace period may have loaded by the time the
// tab regains focus or is shown again.
function listenForLateExtension(): void {
  window.addEventListener('focus', recheck);
  window.addEventListener('pageshow', recheck);
  document.addEventListener('visibilitychange', recheck);
}

function stopListeningForLateExtension(): void {
  window.removeEventListener('focus', recheck);
  window.removeEventListener('pageshow', recheck);
  document.removeEventListener('visibilitychange', recheck);
}

/**
 * Starts the shared check, or re-checks one that already gave up: a component
 * mounting is a cheap moment to notice an extension that loaded late.
 */
function checkForProvider(): void {
  const current = getStatus();
  if (current === 'unavailable') {
    recheck();
    return;
  }
  if (current !== 'checking' || pollTimer !== undefined) return;

  if (hasNip07Provider()) {
    setStatus('available');
    return;
  }

  let elapsed = 0;
  pollTimer = setInterval(() => {
    elapsed += NIP07_POLL_INTERVAL_MS;

    if (hasNip07Provider()) {
      stopPolling();
      setStatus('available');
    } else if (elapsed >= NIP07_GRACE_MS) {
      stopPolling();
      setStatus('unavailable');
      listenForLateExtension();
    }
  }, NIP07_POLL_INTERVAL_MS);
}

/** Test seam: forget the shared check, its timer and its listeners. */
export function resetNip07Availability(): void {
  stopPolling();
  stopListeningForLateExtension();
  status = undefined;
}

/**
 * Tracks whether a NIP-07 browser extension is usable. Extension content
 * scripts can inject `window.nostr` after the app's first render, so a stored
 * extension login must not be declared broken at mount: poll briefly and only
 * settle on 'unavailable' once the grace period has elapsed. A later focus,
 * tab switch or component mount re-checks, so a slow extension still counts.
 *
 * @param needed - true when a stored extension login is waiting on the
 * provider; the check starts only once a caller needs it.
 */
export function useNip07Availability(needed: boolean): Nip07Status {
  const current = useSyncExternalStore(subscribe, getStatus, () => 'checking' as const);

  useEffect(() => {
    if (needed) {
      checkForProvider();
    }
  }, [needed]);

  return current;
}

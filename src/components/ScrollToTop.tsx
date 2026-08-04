import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

/** How long to keep chasing a saved position while content loads in. */
const RESTORE_TIMEOUT_MS = 3000;

function getScrollKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

/**
 * Scroll to `target`, retrying while the document is too short to honour it.
 *
 * Feeds restore into a page whose rows have not laid out yet, so a single
 * `scrollTo` gets clamped to the current document height and the viewer lands
 * near the top. Retrying across frames lets the position land once the cached
 * pages render. Returns a function that stops the attempt.
 */
interface ScrollRestoration {
  stop: () => void;
  /** True while the loop is still chasing a position it has not reached. */
  isPending: () => boolean;
}

function restoreScrollPosition(target: number): ScrollRestoration {
  if (target <= 0) {
    window.scrollTo(0, 0);
    return { stop: () => {}, isPending: () => false };
  }

  let frame: number | null = null;
  let stopped = false;
  const deadline = Date.now() + RESTORE_TIMEOUT_MS;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    window.removeEventListener('wheel', stop);
    window.removeEventListener('touchstart', stop);
    window.removeEventListener('keydown', stop);
    window.removeEventListener('mousedown', stop);
  };

  // Once the viewer takes over, stop dragging them back to where they were.
  // `mousedown` covers grabbing the scrollbar, which fires none of the others
  // and is exactly how someone escapes a page the loop cannot satisfy.
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchstart', stop, { passive: true });
  window.addEventListener('keydown', stop);
  window.addEventListener('mousedown', stop, { passive: true });

  const attempt = () => {
    if (stopped) return;
    window.scrollTo(0, target);

    if (window.scrollY >= target || Date.now() > deadline) {
      stop();
      return;
    }

    frame = window.requestAnimationFrame(attempt);
  };

  attempt();

  return { stop, isPending: () => !stopped };
}

export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const navigationType = useNavigationType();
  const scrollKey = getScrollKey(pathname, search);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      const previousRestoration = window.history.scrollRestoration;
      window.history.scrollRestoration = 'manual';

      return () => {
        window.history.scrollRestoration = previousRestoration;
      };
    }
  }, []);

  useEffect(() => {
    const saveCurrentPosition = () => {
      scrollPositions.set(scrollKey, window.scrollY);
    };

    window.addEventListener('pagehide', saveCurrentPosition);

    return () => {
      window.removeEventListener('pagehide', saveCurrentPosition);
    };
  }, [scrollKey]);

  useLayoutEffect(() => {
    if (hash) {
      // If there's a hash, scroll to that element after a short delay
      // to allow the page content to render
      const scrollToHash = () => {
        const id = hash.replace('#', '');
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };

      // Try immediately
      scrollToHash();

      // Also try after a delay to handle slow-loading content
      timeoutRef.current = window.setTimeout(scrollToHash, 100);

      return () => {
        scrollPositions.set(scrollKey, window.scrollY);
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }

    // Only restore the saved position on browser back/forward (POP) — including
    // in-app `navigate(-1)`. Forward link clicks (PUSH/REPLACE) start at the top
    // so footer/sidebar/nav links always land at the top of the destination.
    const savedPosition =
      navigationType === 'POP' ? (scrollPositions.get(scrollKey) ?? 0) : 0;
    const restoration = restoreScrollPosition(savedPosition);

    return () => {
      // Navigating away mid-restore leaves the window clamped short of the
      // saved offset, because the content that would make room for it has not
      // rendered. Persisting that partial value would overwrite the real
      // position and walk the feed closer to the top on every interrupted
      // back-navigation. A restore that settled, by reaching its target,
      // timing out, or being handed over to the viewer, leaves a position
      // worth saving.
      const wasInterrupted = restoration.isPending();
      restoration.stop();

      if (!wasInterrupted) {
        scrollPositions.set(scrollKey, window.scrollY);
      }
    };
  }, [scrollKey, hash, navigationType]);

  return null;
}

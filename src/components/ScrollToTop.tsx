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
  /**
   * True once the viewer has moved the page themselves. Only a position the
   * viewer chose is worth persisting.
   */
  isViewerChosen: () => boolean;
  stop: () => void;
}

function restoreScrollPosition(target: number): ScrollRestoration {
  if (target <= 0) {
    // Nothing to chase, so wherever the viewer ends up on this route is theirs.
    window.scrollTo(0, 0);
    return { stop: () => {}, isViewerChosen: () => true };
  }

  // The offset this loop last left on the page, read back after the write so it
  // holds what the browser accepted rather than what we asked for.
  let written = 0;
  let frame: number | null = null;
  let stopped = false;
  let viewerMoved = false;
  const deadline = Date.now() + RESTORE_TIMEOUT_MS;

  // After handover the loop no longer writes, so a scroll that lands anywhere
  // other than the offset the loop last wrote is the viewer's own. Latching it
  // as it happens is what separates "the viewer settled here" from "the loop
  // was interrupted here", even when the two offsets end up equal: a viewer who
  // reads down and comes back to the top passed through other offsets on the
  // way, and each one fired this. Reading the offsets equal at teardown cannot
  // tell those apart. The trailing scroll event from the loop's own last write
  // reads `written`, so it does not latch.
  const noteViewerScroll = () => {
    if (window.scrollY !== written) viewerMoved = true;
  };

  const handOver = () => {
    if (stopped) return;
    stopped = true;
    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }
    window.removeEventListener('wheel', handOver);
    window.removeEventListener('touchstart', handOver);
    window.removeEventListener('keydown', handOver);
    window.removeEventListener('mousedown', handOver);
    window.addEventListener('scroll', noteViewerScroll, { passive: true });
  };

  const stop = () => {
    handOver();
    window.removeEventListener('scroll', noteViewerScroll);
  };

  // Once the viewer takes over, stop dragging them back to where they were.
  // `mousedown` covers grabbing the scrollbar, which fires none of the others
  // and is exactly how someone escapes a page the loop cannot satisfy.
  window.addEventListener('wheel', handOver, { passive: true });
  window.addEventListener('touchstart', handOver, { passive: true });
  window.addEventListener('keydown', handOver);
  window.addEventListener('mousedown', handOver, { passive: true });

  const attempt = () => {
    if (stopped) return;
    // Options form, not `scrollTo(0, target)`. The positional form scrolls with
    // behavior "auto", which resolves to the root's computed `scroll-behavior` —
    // and that is `smooth` app-wide (src/index.css:233). An animated restore
    // reads short of its target on every frame, so the loop ends up chasing its
    // own animation rather than the page's height: measured in Chromium at 154
    // frames over 1.3s on a page already tall enough to honour the offset in
    // one. Worse, cancelling the loop does not cancel the animation, so the
    // page kept travelling to the target after the viewer had taken over,
    // defeating the handover listeners above.
    window.scrollTo({ top: target, behavior: 'instant' });
    written = window.scrollY;

    if (written >= target || Date.now() > deadline) {
      handOver();
      return;
    }

    frame = window.requestAnimationFrame(attempt);
  };

  attempt();

  return { stop, isViewerChosen: () => viewerMoved };
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
      // Only persist an offset the viewer chose. A restore that never reached
      // its target is holding a value clamped by a page that had not finished
      // laying out; saving that would overwrite the offset the restore was
      // chasing and walk the feed toward the top on every interrupted
      // back-navigation. Cancelling the loop is not the same as moving the
      // page — a click or a keystroke hands control back without scrolling
      // anywhere — so "did the loop stop" cannot stand in for "is this the
      // viewer's position". Ask whether the viewer actually scrolled instead.
      const viewerChose = restoration.isViewerChosen();
      restoration.stop();

      if (viewerChose) {
        scrollPositions.set(scrollKey, window.scrollY);
      }
    };
  }, [scrollKey, hash, navigationType]);

  return null;
}

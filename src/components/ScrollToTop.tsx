import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

function getScrollKey(pathname: string, search: string) {
  return `${pathname}${search}`;
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
    window.scrollTo(0, savedPosition);

    return () => {
      scrollPositions.set(scrollKey, window.scrollY);
    };
  }, [scrollKey, hash, navigationType]);

  return null;
}

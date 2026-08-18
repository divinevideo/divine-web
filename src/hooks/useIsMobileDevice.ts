// ABOUTME: Reports whether the page is being viewed in a mobile browser, by user agent
// ABOUTME: Not useIsMobile — that one measures viewport width, which a narrow desktop window also passes

import { useEffect, useState } from 'react';
import { isMobileUserAgent } from '@/lib/isMobileUserAgent';

/**
 * True on a phone or tablet browser.
 *
 * Starts false and only settles after the effect runs. The user agent is
 * readable in the browser alone, so answering during the first render would
 * make prerendered markup disagree with what hydration produces. Callers must
 * therefore treat the desktop branch as the safe default, not as a fact.
 */
export function useIsMobileDevice(): boolean {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(isMobileUserAgent(window.navigator.userAgent));
  }, []);

  return isMobileDevice;
}

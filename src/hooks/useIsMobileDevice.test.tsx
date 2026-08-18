import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useIsMobileDevice } from './useIsMobileDevice';

const ORIGINAL_USER_AGENT = window.navigator.userAgent;

function setUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  });
}

describe('useIsMobileDevice', () => {
  afterEach(() => {
    setUserAgent(ORIGINAL_USER_AGENT);
  });

  it('reports true for a phone user agent', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1');

    const { result } = renderHook(() => useIsMobileDevice());

    expect(result.current).toBe(true);
  });

  it('reports false for a desktop user agent', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

    const { result } = renderHook(() => useIsMobileDevice());

    expect(result.current).toBe(false);
  });

  // The user agent is only readable in the browser. Reporting mobile during the
  // first render would make prerendered markup disagree with hydration, so the
  // answer only arrives once the effect has run.
  it('does not claim mobile before the effect reads the user agent', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1');

    const renders: boolean[] = [];
    renderHook(() => {
      const value = useIsMobileDevice();
      renders.push(value);
      return value;
    });

    expect(renders[0]).toBe(false);
    expect(renders.at(-1)).toBe(true);
  });
});
